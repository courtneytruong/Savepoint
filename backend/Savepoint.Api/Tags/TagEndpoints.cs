using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tags;

/// <summary>
/// The signed-in person's tags, under /api/tags. Tags are made and deleted by
/// saving reflections, so there's only reading here.
/// </summary>
public static class TagEndpoints
{
    public static IEndpointRouteBuilder MapTagEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/api/tags").RequireAuthorization().MapGet("/", List);
        return app;
    }

    /// <summary>
    /// The names of every tag the person has, for suggesting while they type, in
    /// alphabetical order ignoring case and accents, as on a reflection. All at once:
    /// one person's tags are few, and unused ones are deleted. 200, with an empty list
    /// for someone with none.
    /// </summary>
    private static async Task<List<string>> List(
        ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db, CancellationToken cancellationToken)
    {
        var userId = CurrentUser.IdOf(principal, users);
        var tags = await db.Tags
            .Where(t => t.UserId == userId)
            .Select(t => new { t.Name, t.NormalizedName })
            .ToListAsync(cancellationToken);

        // Sorted here rather than in SQL, as for a reflection's tags, so the order
        // doesn't depend on the database's collation.
        return [.. tags.OrderBy(t => t.NormalizedName, StringComparer.Ordinal).Select(t => t.Name)];
    }
}
