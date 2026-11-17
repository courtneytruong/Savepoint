using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

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
        return app;
    }

    // Strings and nullable numbers, so a missing or unknown value gets a field code
    // rather than a request the JSON reader refuses outright. The frontend also
    // sends reflection tags, which wait for the tags feature and are ignored. The
    // same body logs a session and edits one.
    public record SessionRequest(string? Date, int? DurationMinutes, int? PagesRead, ReflectionRequest? Reflection);

    public record ReflectionRequest(string? Mood, string? Notes);

    /// <summary>A session as the frontend sees it, with its reflection. Date is "yyyy-MM-dd".</summary>
    public record SessionResponse(
        Guid Id,
        Guid ItemId,
        DateOnly Date,
        int DurationMinutes,
        int? PagesRead,
        DateTimeOffset CreatedAt,
        ReflectionResponse Reflection);

    public record ReflectionResponse(Guid Id, string Mood, string Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

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
            .Include(s => s.Reflection)
            // Ids are made in time order, so they break a tie between sessions saved at once.
            .OrderByDescending(s => s.Date).ThenByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(sessions.Select(ToResponse).ToList());
    }

    /// <summary>
    /// Logs a session with its reflection, in one transaction: both save, or neither
    /// does, since every session has a reflection. 201 with the session, 404 when the
    /// item isn't the signed-in person's, or 400 with a code per field. Reflection
    /// fields are named reflection.mood and reflection.notes.
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

        var session = new Session
        {
            ItemId = itemId,
            Date = details.Date,
            DurationMinutes = details.DurationMinutes,
            PagesRead = details.PagesRead,
            Reflection = new Reflection { ItemId = itemId, Mood = details.Mood, Notes = details.Notes },
        };
        // One save, so it's one transaction.
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created($"/api/items/{itemId}/sessions/{session.Id}", ToResponse(session));
    }

    /// <summary>
    /// Replaces a session's date, duration and pages, and its reflection's mood and
    /// notes, so everything is sent each time, as when logging it. One transaction,
    /// so the two change together. The reflection's UpdatedAt moves only when its
    /// mood or notes change, since fixing a session's duration isn't editing what was
    /// thought. 200 with the session, 404 when the item isn't the signed-in person's
    /// or the session isn't that item's, or 400 as for logging one.
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
                .SetProperty(s => s.Date, details.Date)
                .SetProperty(s => s.DurationMinutes, details.DurationMinutes)
                .SetProperty(s => s.PagesRead, details.PagesRead),
            cancellationToken);
        // Leaving without committing rolls the transaction back.
        if (changed == 0) return TypedResults.NotFound();

        await db.Reflections
            .Where(r => r.SessionId == sessionId)
            .ExecuteUpdateAsync(
                set => set
                    // The database's clock, as for CreatedAt, so the two always compare.
                    // Worked out from the old values, since SET reads the row as it was.
                    .SetProperty(
                        r => r.UpdatedAt,
                        r => r.Mood != details.Mood || r.Notes != details.Notes ? DateTimeOffset.UtcNow : r.UpdatedAt)
                    .SetProperty(r => r.Mood, details.Mood)
                    .SetProperty(r => r.Notes, details.Notes),
                cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var session = await mine.Include(s => s.Reflection).AsNoTracking().SingleAsync(cancellationToken);
        return TypedResults.Ok(ToResponse(session));
    }

    // The checked, trimmed fields shared by logging and editing a session.
    private sealed record SessionDetails(DateOnly Date, int DurationMinutes, int? PagesRead, Mood Mood, string Notes);

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
        return new SessionDetails(date, durationMinutes, request.PagesRead, mood, notes);
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
            new ReflectionResponse(
                reflection.Id, reflection.Mood.ToString(), reflection.Notes, reflection.CreatedAt, reflection.UpdatedAt));
    }
}
