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
/// An item's standalone reflections, under /api/items/{itemId}/reflections: final
/// thoughts or reviews that aren't about a session. A session's reflection is
/// reached through its session instead. As for sessions, every endpoint needs
/// someone signed in, someone else's item is a 404, and errors are Problem Details
/// with a code per field, here named mood, notes and tags.
/// </summary>
public static class ReflectionEndpoints
{
    public static IEndpointRouteBuilder MapReflectionEndpoints(this IEndpointRouteBuilder app)
    {
        // :guid, so an id that isn't one is a 404 like any other unknown item.
        var reflections = app.MapGroup("/api/items/{itemId:guid}/reflections").RequireAuthorization();
        reflections.MapGet("/", List);
        reflections.MapPost("/", Create);
        reflections.MapPut("/{reflectionId:guid}", Update);
        reflections.MapDelete("/{reflectionId:guid}", Delete);

        app.MapGet("/api/reflections", ListAll).RequireAuthorization();
        return app;
    }

    /// <summary>A reflection anywhere in the library, with what it's about, for the Reflections page.</summary>
    public record LibraryReflectionResponse(
        Guid Id,
        string Mood,
        string Notes,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        List<string> Tags,
        ItemSummary Item,
        ReflectionSession? Session);

    /// <summary>The session a reflection is about. Date is "yyyy-MM-dd", the day it happened.</summary>
    public record ReflectionSession(
        Guid Id, DateOnly Date, int DurationMinutes, int? PagesRead, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

    /// <summary>
    /// Every reflection in the person's library, sessions' and standalone ones alike,
    /// newest written first. Each has its item, and its session when it has one, which
    /// is null for a standalone one. The day a standalone one belongs on is left to the
    /// frontend, which knows the person's time zone. All at once, since the page
    /// filters in the browser, as the library does. 200, with an empty list for
    /// someone with none.
    /// </summary>
    private static async Task<List<LibraryReflectionResponse>> ListAll(
        ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db, CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        // One query: each reflection joined to its item, which also keeps to the
        // person's own, and to its session, if any.
        var rows = await (
                from reflection in db.Reflections
                join item in db.Items on reflection.ItemId equals item.Id
                where item.UserId == userId
                orderby reflection.CreatedAt descending, reflection.Id descending
                select new
                {
                    reflection.Id,
                    reflection.Mood,
                    reflection.Notes,
                    reflection.CreatedAt,
                    reflection.UpdatedAt,
                    Tags = reflection.Tags.ToList(),
                    Item = new { item.Id, item.Title, item.Medium },
                    Session = db.Sessions
                        .Where(s => s.Id == reflection.SessionId)
                        .Select(s => new ReflectionSession(s.Id, s.Date, s.DurationMinutes, s.PagesRead, s.CreatedAt, s.UpdatedAt))
                        .SingleOrDefault(),
                })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return
        [
            .. rows.Select(r => new LibraryReflectionResponse(
                r.Id,
                r.Mood.ToString(),
                r.Notes,
                r.CreatedAt,
                r.UpdatedAt,
                ReflectionWriting.TagNamesInOrder(r.Tags),
                new ItemSummary(r.Item.Id, r.Item.Title, r.Item.Medium.ToString()),
                r.Session)),
        ];
    }

    /// <summary>
    /// The item's standalone reflections, newest first, each with its tags. Its
    /// sessions' reflections come with the sessions instead. All of them at once, as
    /// for sessions. 200, with an empty list for an item with none, or 404 when the
    /// item isn't the signed-in person's.
    /// </summary>
    private static async Task<Results<Ok<List<ReflectionResponse>>, NotFound>> List(
        Guid itemId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        // Asked first, so someone else's item is a 404 rather than an empty list that
        // would look the same as an item of theirs with none.
        if (!await IsOwnItem(itemId, principal, users, db, cancellationToken)) return TypedResults.NotFound();

        var reflections = await db.Reflections
            .Where(r => r.ItemId == itemId && r.SessionId == null)
            .Include(r => r.Tags)
            // Ids are made in time order, so they break a tie between ones saved at once.
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(reflections.Select(ReflectionWriting.ToResponse).ToList());
    }

    /// <summary>
    /// Writes a reflection about an item, at any status, with its tags, in one save.
    /// It's dated by when it was written. 201 with the reflection, 404 when the item
    /// isn't the signed-in person's, or 400 with a code per field.
    /// </summary>
    private static async Task<Results<Created<ReflectionResponse>, NotFound, ValidationProblem>> Create(
        Guid itemId, ReflectionRequest request, ClaimsPrincipal principal, UserManager<User> users,
        SavepointDbContext db, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var details = ReflectionWriting.Check(request, "", errors);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        if (!await IsOwnItem(itemId, principal, users, db, cancellationToken)) return TypedResults.NotFound();

        var userId = CurrentUser.IdOf(principal, users);
        var reflection = new Reflection
        {
            ItemId = itemId,
            Mood = details.Mood,
            Notes = details.Notes,
            Tags = await TagStore.FindOrAddAsync(db, userId, details.Tags, cancellationToken),
        };
        // One save, so it's one transaction, new tags included.
        db.Reflections.Add(reflection);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/items/{itemId}/reflections/{reflection.Id}", ReflectionWriting.ToResponse(reflection));
    }

    /// <summary>
    /// Replaces a standalone reflection's mood, notes and tags, all of them each time,
    /// as when writing it. Its UpdatedAt moves only when one really changes, and a tag
    /// left on no reflection is deleted, in one transaction. 200 with the reflection,
    /// 404 when the item isn't the signed-in person's, the reflection isn't that item's,
    /// or it's a session's, which is edited with its session, or 400 as for writing one.
    /// </summary>
    private static async Task<Results<Ok<ReflectionResponse>, NotFound, ValidationProblem>> Update(
        Guid itemId, Guid reflectionId, ReflectionRequest request, ClaimsPrincipal principal,
        UserManager<User> users, SavepointDbContext db, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var details = ReflectionWriting.Check(request, "", errors);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var userId = CurrentUser.IdOf(principal, users);
        var mine = OwnStandalone(itemId, reflectionId, userId, db);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var reflection = await mine.Include(r => r.Tags).SingleOrDefaultAsync(cancellationToken);
        if (reflection is null) return TypedResults.NotFound();

        await ReflectionWriting.UpdateAsync(db, userId, reflection, details, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // Read afresh, since the update went straight to the database.
        var saved = await mine.Include(r => r.Tags).AsNoTracking().SingleAsync(cancellationToken);
        return TypedResults.Ok(ReflectionWriting.ToResponse(saved));
    }

    /// <summary>
    /// Deletes a standalone reflection, along with any tag that leaves on no
    /// reflection. 204, or 404 as for editing, which includes deleting the same one a
    /// second time.
    /// </summary>
    private static async Task<Results<NoContent, NotFound>> Delete(
        Guid itemId, Guid reflectionId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // One DELETE, which also says whether it was there.
        var deleted = await OwnStandalone(itemId, reflectionId, userId, db).ExecuteDeleteAsync(cancellationToken);
        if (deleted == 0) return TypedResults.NotFound();

        await TagStore.DeleteUnusedAsync(db, userId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    // The reflection, when it stands alone and is about this item of the person's.
    private static IQueryable<Reflection> OwnStandalone(
        Guid itemId, Guid reflectionId, Guid userId, SavepointDbContext db) =>
        db.Reflections.Where(r => r.Id == reflectionId
            && r.ItemId == itemId
            && r.SessionId == null
            && db.Items.Any(i => i.Id == itemId && i.UserId == userId));

    // Whether the item is the signed-in person's; anything else is a 404.
    private static Task<bool> IsOwnItem(
        Guid itemId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        return db.Items.AnyAsync(i => i.Id == itemId && i.UserId == userId, cancellationToken);
    }
}
