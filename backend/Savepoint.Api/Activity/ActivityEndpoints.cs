using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Library;
using Savepoint.Api.Sessions;

namespace Savepoint.Api.Activity;

/// <summary>
/// Everything that happened across the signed-in person's library, at
/// /api/activity, for the Timeline and Calendar pages. It's the item timeline's
/// history for every item at once, with each entry naming its item.
/// </summary>
public static class ActivityEndpoints
{
    public static IEndpointRouteBuilder MapActivityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/activity", Get).RequireAuthorization();
        return app;
    }

    /// <summary>
    /// What happened, in four lists shaped as the item endpoints give them, each
    /// entry with its item added. An item's first status change is when it was
    /// added. Reflections are only the standalone ones: a session's comes with it.
    /// </summary>
    public record ActivityResponse(
        List<ActivityStatusChange> StatusChanges,
        List<ActivityRatingChange> RatingChanges,
        List<ActivitySession> Sessions,
        List<ActivityReflection> Reflections);

    public record ActivityStatusChange(Guid Id, string Status, DateTimeOffset ChangedAt, ItemSummary Item);

    public record ActivityRatingChange(Guid Id, int Rating, DateTimeOffset ChangedAt, ItemSummary Item);

    /// <summary>A session as GET /api/items/{itemId}/sessions gives it, with its item.</summary>
    public record ActivitySession(
        Guid Id,
        Guid ItemId,
        DateOnly Date,
        int DurationMinutes,
        int? PagesRead,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        ReflectionResponse Reflection,
        ItemSummary Item);

    /// <summary>A standalone reflection as GET /api/items/{itemId}/reflections gives it, with its item.</summary>
    public record ActivityReflection(
        Guid Id,
        string Mood,
        string Notes,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        List<string> Tags,
        ItemSummary Item);

    /// <summary>
    /// All of it at once, each list oldest first, as for one item's: the pages put
    /// it in order and filter it in the browser, and one person's history is small
    /// enough. 200, with empty lists for someone with no items.
    /// </summary>
    private static async Task<ActivityResponse> Get(
        ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db, CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);

        // The person's items, which every list below keeps to.
        var items = await db.Items
            .Where(i => i.UserId == userId)
            .Select(i => new { i.Id, i.Title, i.Medium })
            .AsNoTracking()
            .ToDictionaryAsync(i => i.Id, i => new ItemSummary(i.Id, i.Title, i.Medium.ToString()), cancellationToken);
        var mine = items.Keys.ToList();

        // Ids are made in time order, so they break a tie between ones saved at once.
        var statusChanges = await db.StatusChanges
            .Where(c => mine.Contains(c.ItemId))
            .OrderBy(c => c.ChangedAt).ThenBy(c => c.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var ratingChanges = await db.RatingChanges
            .Where(c => mine.Contains(c.ItemId))
            .OrderBy(c => c.ChangedAt).ThenBy(c => c.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var sessions = await db.Sessions
            .Where(s => mine.Contains(s.ItemId))
            .Include(s => s.Reflection).ThenInclude(r => r!.Tags)
            .OrderBy(s => s.Date).ThenBy(s => s.CreatedAt).ThenBy(s => s.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var reflections = await db.Reflections
            .Where(r => mine.Contains(r.ItemId) && r.SessionId == null)
            .Include(r => r.Tags)
            .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new ActivityResponse(
            [.. statusChanges.Select(c => new ActivityStatusChange(c.Id, c.Status.ToString(), c.ChangedAt, items[c.ItemId]))],
            [.. ratingChanges.Select(c => new ActivityRatingChange(c.Id, c.Rating, c.ChangedAt, items[c.ItemId]))],
            [.. sessions.Select(s => WithItem(SessionEndpoints.ToResponse(s), items[s.ItemId]))],
            [.. reflections.Select(r => WithItem(ReflectionWriting.ToResponse(r), items[r.ItemId]))]);
    }

    private static ActivitySession WithItem(SessionEndpoints.SessionResponse s, ItemSummary item) =>
        new(s.Id, s.ItemId, s.Date, s.DurationMinutes, s.PagesRead, s.CreatedAt, s.UpdatedAt, s.Reflection, item);

    private static ActivityReflection WithItem(ReflectionResponse r, ItemSummary item) =>
        new(r.Id, r.Mood, r.Notes, r.CreatedAt, r.UpdatedAt, r.Tags, item);
}
