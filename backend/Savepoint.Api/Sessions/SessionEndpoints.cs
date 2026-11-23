using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Library;
using Savepoint.Api.Tags;

namespace Savepoint.Api.Sessions;

/// <summary>
/// An item's sessions, under /api/items/{itemId}/sessions. Like /api/items, every
/// endpoint needs someone signed in, and someone else's item is a 404. Errors are
/// Problem Details with a code per field, as in /api/items, plus inFuture for a
/// date after today.
/// </summary>
public static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        // :guid, so an id that isn't one is a 404 like any other unknown item.
        var sessions = app.MapGroup("/api/items/{itemId:guid}/sessions").RequireAuthorization();
        sessions.MapGet("/", List);
        sessions.MapPost("/", Create);
        sessions.MapPut("/{sessionId:guid}", Update);
        sessions.MapDelete("/{sessionId:guid}", Delete);
        return app;
    }

    // Strings and nullable numbers, so a missing or unknown value gets a field code
    // rather than a request the JSON reader refuses outright. The same body logs a
    // session and edits one.
    public record SessionRequest(string? Date, int? DurationMinutes, int? PagesRead, ReflectionRequest? Reflection);

    // Tags are names, so a new one is created by using it. Missing means none.
    public record ReflectionRequest(string? Mood, string? Notes, List<string?>? Tags);

    /// <summary>A session as the frontend sees it, with its reflection. Date is "yyyy-MM-dd".</summary>
    public record SessionResponse(
        Guid Id,
        Guid ItemId,
        DateOnly Date,
        int DurationMinutes,
        int? PagesRead,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        ReflectionResponse Reflection);

    /// <summary>A reflection with its tags' names, in alphabetical order ignoring case and accents.</summary>
    public record ReflectionResponse(
        Guid Id, string Mood, string Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, List<string> Tags);

    /// <summary>
    /// Every session for an item, each with its reflection, newest day first. Within
    /// a day, the one logged last comes first. All of them at once, as for the
    /// library: one item's sessions are few enough. 200, with an empty list for an
    /// item with none, or 404 when the item isn't the signed-in person's.
    /// </summary>
    private static async Task<Results<Ok<List<SessionResponse>>, NotFound>> List(
        Guid itemId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        // Asked first, so someone else's item is a 404 rather than an empty list that
        // would look the same as an item of theirs with no sessions.
        if (await MediumOfOwnItem(itemId, principal, users, db, cancellationToken) is null)
        {
            return TypedResults.NotFound();
        }

        var sessions = await db.Sessions
            .Where(s => s.ItemId == itemId)
            .Include(s => s.Reflection).ThenInclude(r => r!.Tags)
            // Ids are made in time order, so they break a tie between sessions saved at once.
            .OrderByDescending(s => s.Date).ThenByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(sessions.Select(ToResponse).ToList());
    }

    /// <summary>
    /// Logs a session with its reflection and its tags, in one transaction: all save,
    /// or none does, since every session has a reflection. A tag name the person hasn't
    /// used yet makes a new tag. 201 with the session, 404 when the item isn't the
    /// signed-in person's, or 400 with a code per field. Reflection fields are named
    /// reflection.mood, reflection.notes and reflection.tags.
    /// </summary>
    private static async Task<Results<Created<SessionResponse>, NotFound, ValidationProblem>> Create(
        Guid itemId, SessionRequest request, ClaimsPrincipal principal, UserManager<User> users,
        SavepointDbContext db, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var details = CheckDetails(request, errors);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var medium = await MediumOfOwnItem(itemId, principal, users, db, cancellationToken);
        if (medium is null) return TypedResults.NotFound();
        if (PagesForAGame(medium.Value, details) is { } problem) return problem;

        var userId = CurrentUser.IdOf(principal, users);
        var session = new Session
        {
            ItemId = itemId,
            Date = details.Date,
            DurationMinutes = details.DurationMinutes,
            PagesRead = details.PagesRead,
            Reflection = new Reflection
            {
                ItemId = itemId,
                Mood = details.Mood,
                Notes = details.Notes,
                Tags = await TagStore.FindOrAddAsync(db, userId, details.Tags, cancellationToken),
            },
        };
        // One save, so it's one transaction, new tags included.
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created($"/api/items/{itemId}/sessions/{session.Id}", ToResponse(session));
    }

    /// <summary>
    /// Replaces a session's date, duration and pages, and its reflection's mood, notes
    /// and tags, so everything is sent each time, as when logging it. One transaction,
    /// so it all changes together. Each keeps its own UpdatedAt, which moves only when
    /// its own fields change: the session's for its date, duration or pages, the
    /// reflection's for its mood, notes or tags, since fixing a duration isn't editing
    /// what was thought. A tag left on no reflection is deleted. 200 with the session,
    /// 404 when the item isn't the signed-in person's or the session isn't that item's,
    /// or 400 as for logging one.
    /// </summary>
    private static async Task<Results<Ok<SessionResponse>, NotFound, ValidationProblem>> Update(
        Guid itemId, Guid sessionId, SessionRequest request, ClaimsPrincipal principal, UserManager<User> users,
        SavepointDbContext db, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var details = CheckDetails(request, errors);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var medium = await MediumOfOwnItem(itemId, principal, users, db, cancellationToken);
        if (medium is null) return TypedResults.NotFound();
        if (PagesForAGame(medium.Value, details) is { } problem) return problem;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // The item is the person's own, so matching it too keeps to their sessions.
        var mine = db.Sessions.Where(s => s.Id == sessionId && s.ItemId == itemId);
        // One UPDATE, which also says whether the session was there to change.
        var changed = await mine.ExecuteUpdateAsync(
            set => set
                // As for the reflection below: the database's clock, only on a real change.
                .SetProperty(
                    s => s.UpdatedAt,
                    s => s.Date != details.Date
                        || s.DurationMinutes != details.DurationMinutes
                        || s.PagesRead != details.PagesRead
                        ? DateTimeOffset.UtcNow
                        : s.UpdatedAt)
                .SetProperty(s => s.Date, details.Date)
                .SetProperty(s => s.DurationMinutes, details.DurationMinutes)
                .SetProperty(s => s.PagesRead, details.PagesRead),
            cancellationToken);
        // Leaving without committing rolls the transaction back.
        if (changed == 0) return TypedResults.NotFound();

        // Tags are compared as sets of normalized names, so sending the same tags in
        // another order or case isn't a change.
        var reflection = await db.Reflections.Include(r => r.Tags).SingleAsync(r => r.SessionId == sessionId, cancellationToken);
        var tagsChanged = !reflection.Tags.Select(t => t.NormalizedName).ToHashSet()
            .SetEquals(details.Tags.Select(TagNames.Normalize));

        await db.Reflections
            .Where(r => r.Id == reflection.Id)
            .ExecuteUpdateAsync(
                set => set
                    // The database's clock, as for CreatedAt, so the two always compare.
                    // Worked out from the old values, since SET reads the row as it was.
                    .SetProperty(
                        r => r.UpdatedAt,
                        r => tagsChanged || r.Mood != details.Mood || r.Notes != details.Notes
                            ? DateTimeOffset.UtcNow
                            : r.UpdatedAt)
                    .SetProperty(r => r.Mood, details.Mood)
                    .SetProperty(r => r.Notes, details.Notes),
                cancellationToken);

        if (tagsChanged)
        {
            var userId = CurrentUser.IdOf(principal, users);
            var tags = await TagStore.FindOrAddAsync(db, userId, details.Tags, cancellationToken);
            reflection.Tags.Clear();
            reflection.Tags.AddRange(tags);
            await db.SaveChangesAsync(cancellationToken);
            await TagStore.DeleteUnusedAsync(db, userId, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        var session = await mine.Include(s => s.Reflection).ThenInclude(r => r!.Tags).AsNoTracking().SingleAsync(cancellationToken);
        return TypedResults.Ok(ToResponse(session));
    }

    /// <summary>
    /// Deletes a session, and through the database's cascade, its reflection, along
    /// with any tag that leaves on no reflection. 204, or 404 as for editing, which
    /// includes deleting the same session a second time.
    /// </summary>
    private static async Task<Results<NoContent, NotFound>> Delete(
        Guid itemId, Guid sessionId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // One DELETE, which also says whether the session was there. Matching the item
        // and its owner keeps it to the person's own sessions.
        var deleted = await db.Sessions
            .Where(s => s.Id == sessionId
                && s.ItemId == itemId
                && db.Items.Any(i => i.Id == itemId && i.UserId == userId))
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted == 0) return TypedResults.NotFound();

        await TagStore.DeleteUnusedAsync(db, userId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    // The checked, trimmed fields shared by logging and editing a session. Tags are
    // cleaned names, one per tag.
    private sealed record SessionDetails(
        DateOnly Date, int DurationMinutes, int? PagesRead, Mood Mood, string Notes, List<string> Tags);

    /// <summary>
    /// Checks the fields that logging and editing share, adding a code to errors for
    /// each one that's wrong. The details it returns are only meaningful when it
    /// added none.
    /// </summary>
    private static SessionDetails CheckDetails(SessionRequest request, Dictionary<string, string[]> errors)
    {
        var date = CheckDate(request.Date, errors);
        var durationMinutes = CheckDuration(request.DurationMinutes, errors);
        if (request.PagesRead <= 0) errors["pagesRead"] = ["invalid"];
        var (mood, notes) = CheckReflection(request.Reflection, errors);
        var tags = TagStore.Check(request.Reflection?.Tags, "reflection.tags", errors);
        return new SessionDetails(date, durationMinutes, request.PagesRead, mood, notes, tags);
    }

    // The item's medium when it's the signed-in person's, or null, which is a 404.
    private static Task<Medium?> MediumOfOwnItem(
        Guid itemId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        return db.Items
            .Where(i => i.Id == itemId && i.UserId == userId)
            .Select(i => (Medium?)i.Medium)
            .SingleOrDefaultAsync(cancellationToken);
    }

    // Only books have pages. Checked after finding the item, since it depends on it.
    private static ValidationProblem? PagesForAGame(Medium medium, SessionDetails details) =>
        medium == Medium.Game && details.PagesRead is not null
            ? TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["pagesRead"] = ["invalid"] })
            : null;

    /// <summary>
    /// The session's day, which can't be after today. The API runs in UTC while the
    /// date is the person's own calendar day, which can be up to a day ahead, so the
    /// API allows one day past its own today: refusing a real session is worse than
    /// letting a slightly early one through.
    /// </summary>
    private static DateOnly CheckDate(string? text, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            errors["date"] = ["required"];
            return default;
        }
        if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            errors["date"] = ["invalid"];
            return default;
        }

        var latest = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        if (date > latest) errors["date"] = ["inFuture"];
        return date;
    }

    private static int CheckDuration(int? minutes, Dictionary<string, string[]> errors)
    {
        if (minutes is null) errors["durationMinutes"] = ["required"];
        else if (minutes < 1) errors["durationMinutes"] = ["tooShort"];
        else if (minutes > SessionRules.MaxDurationMinutes) errors["durationMinutes"] = ["tooLong"];
        return minutes ?? 0;
    }

    /// <summary>
    /// The reflection's mood and trimmed notes, adding a code to errors for each one
    /// that's wrong. A missing reflection counts as missing both.
    /// </summary>
    private static (Mood Mood, string Notes) CheckReflection(
        ReflectionRequest? reflection, Dictionary<string, string[]> errors)
    {
        Mood mood = default;
        if (reflection?.Mood is null) errors["reflection.mood"] = ["required"];
        else if (!EnumNames.TryParse(reflection.Mood, out mood)) errors["reflection.mood"] = ["invalid"];

        var notes = reflection?.Notes?.Trim() ?? "";
        // Counted as the database counts characters: by code point, so an emoji is one
        // character, not the two that string.Length counts. Counting the other way, a
        // note could pass here and then fail the database's check.
        var length = notes.EnumerateRunes().Count();
        if (length == 0) errors["reflection.notes"] = ["required"];
        else if (length < SessionRules.MinNotesLength) errors["reflection.notes"] = ["tooShort"];
        else if (length > SessionRules.MaxNotesLength) errors["reflection.notes"] = ["tooLong"];

        return (mood, notes);
    }

    // The reflection is always there for sessions the API saved.
    private static SessionResponse ToResponse(Session session)
    {
        var reflection = session.Reflection
            ?? throw new InvalidOperationException($"Session {session.Id} has no reflection.");
        return new(
            session.Id,
            session.ItemId,
            session.Date,
            session.DurationMinutes,
            session.PagesRead,
            session.CreatedAt,
            session.UpdatedAt,
            new ReflectionResponse(
                reflection.Id,
                reflection.Mood.ToString(),
                reflection.Notes,
                reflection.CreatedAt,
                reflection.UpdatedAt,
                // Sorted here rather than in SQL, so the order doesn't depend on the
                // database's collation. Two of a user's tags never share a normalized name.
                [.. reflection.Tags.OrderBy(t => t.NormalizedName, StringComparer.Ordinal).Select(t => t.Name)]));
    }
}
