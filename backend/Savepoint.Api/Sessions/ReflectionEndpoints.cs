using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
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
        return app;
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

    // Whether the item is the signed-in person's; anything else is a 404.
    private static Task<bool> IsOwnItem(
        Guid itemId, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        return db.Items.AnyAsync(i => i.Id == itemId && i.UserId == userId, cancellationToken);
    }
}
