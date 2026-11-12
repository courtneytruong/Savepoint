using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;

namespace Savepoint.Api.Library;

/// <summary>
/// The signed-in person's library, under /api/items. Every endpoint needs someone
/// signed in, and only ever sees that person's items. Errors are Problem Details,
/// with the same field codes as /api/auth: required, tooLong and invalid.
/// </summary>
public static class ItemEndpoints
{
    public static IEndpointRouteBuilder MapItemEndpoints(this IEndpointRouteBuilder app)
    {
        var items = app.MapGroup("/api/items").RequireAuthorization();
        items.MapGet("/", List);
        // :guid, so an id that isn't one is a 404 like any other unknown item.
        items.MapGet("/{id:guid}", Get);
        items.MapPost("/", Create);
        items.MapPut("/{id:guid}", Update);
        items.MapPost("/{id:guid}/status", ChangeStatus);
        return app;
    }

    // An item with its newest status change. The database picks the newest, rather
    // than every change being loaded to find it.
    private sealed record ItemRow(Item Item, StatusChange Current);

    // Filters and ordering go before this, on Items, where they can become SQL.
    private static IQueryable<ItemRow> WithCurrentStatus(this IQueryable<Item> items) => items
        .Select(i => new ItemRow(
            i,
            // Ids are made in time order, so they break a tie between changes saved at once.
            i.StatusChanges.OrderByDescending(s => s.ChangedAt).ThenByDescending(s => s.Id).First()))
        .AsNoTracking();

    /// <summary>
    /// One item, with its current status. 404 when there's no such item, and also
    /// when it's someone else's, so the answer never says that it exists.
    /// </summary>
    private static async Task<Results<Ok<ItemResponse>, NotFound>> Get(
        Guid id, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(principal, users);
        var row = await db.Items
            .Where(i => i.Id == id && i.UserId == userId)
            .WithCurrentStatus()
            .SingleOrDefaultAsync(cancellationToken);

        return row is null ? TypedResults.NotFound() : TypedResults.Ok(ToResponse(row.Item, row.Current));
    }

    /// <summary>
    /// Every item in the library, newest first, each with its current status. All
    /// of them at once, because the browser searches, filters and sorts: a personal
    /// library is small enough that paging on the server isn't needed.
    /// </summary>
    private static async Task<Ok<List<ItemResponse>>> List(
        ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(principal, users);
        var rows = await db.Items
            .Where(i => i.UserId == userId)
            // Ids are made in time order, so they break a tie between items made at once.
            .OrderByDescending(i => i.CreatedAt).ThenByDescending(i => i.Id)
            .WithCurrentStatus()
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(rows.Select(row => ToResponse(row.Item, row.Current)).ToList());
    }

    // Strings rather than enums, and nullable, so a missing or unknown value gets a
    // field code rather than a request the JSON reader refuses outright.
    public record CreateItemRequest(string? Medium, string? Title, string? Creator, string? Status);

    public record UpdateItemRequest(string? Medium, string? Title, string? Creator);

    public record ChangeStatusRequest(string? Status);

    /// <summary>
    /// An item as the frontend sees it, with its current status: the newest of its
    /// status changes, and when that happened.
    /// </summary>
    public record ItemResponse(
        Guid Id,
        string Medium,
        string Title,
        string? Creator,
        string Status,
        DateTimeOffset StatusChangedAt,
        DateTimeOffset CreatedAt);

    /// <summary>
    /// Adds an item with its first status, Backlog unless the request says otherwise,
    /// since people often add what they're already in the middle of. 201 with the
    /// item, or 400 with a code per field.
    /// </summary>
    private static async Task<Results<Created<ItemResponse>, ValidationProblem>> Create(
        CreateItemRequest request, ClaimsPrincipal principal, UserManager<User> users, SavepointDbContext db,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var details = CheckDetails(request.Medium, request.Title, request.Creator, errors);

        var status = ItemStatus.Backlog;
        if (request.Status is not null && !TryParseName(request.Status, out status)) errors["status"] = ["invalid"];

        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var item = new Item
        {
            UserId = CurrentUserId(principal, users),
            Medium = details.Medium,
            Title = details.Title,
            Creator = details.Creator,
            StatusChanges = { new StatusChange { Status = status } },
        };
        // One save, so the item and its first status are one transaction: both are
        // saved, or neither is.
        db.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        // A new item has only its first status, which is its current one.
        return TypedResults.Created($"/api/items/{item.Id}", ToResponse(item, item.StatusChanges.Single()));
    }

    /// <summary>
    /// Replaces an item's medium, title and creator, so all three are sent each time
    /// and a missing or empty creator clears it. Its status isn't changed here,
    /// because a change of status adds to its history. 200 with the item, 404 as for
    /// Get, or 400 with a code per field.
    /// </summary>
    private static async Task<Results<Ok<ItemResponse>, NotFound, ValidationProblem>> Update(
        Guid id, UpdateItemRequest request, ClaimsPrincipal principal, UserManager<User> users,
        SavepointDbContext db, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var details = CheckDetails(request.Medium, request.Title, request.Creator, errors);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var userId = CurrentUserId(principal, users);
        var mine = db.Items.Where(i => i.Id == id && i.UserId == userId);
        // One UPDATE, which also says whether the item was there to change.
        var changed = await mine.ExecuteUpdateAsync(
            set => set
                .SetProperty(i => i.Medium, details.Medium)
                .SetProperty(i => i.Title, details.Title)
                .SetProperty(i => i.Creator, details.Creator),
            cancellationToken);
        if (changed == 0) return TypedResults.NotFound();

        var row = await mine.WithCurrentStatus().SingleAsync(cancellationToken);
        return TypedResults.Ok(ToResponse(row.Item, row.Current));
    }

    /// <summary>
    /// Changes an item's status by adding to its history, so the timeline can show
    /// when it changed. Asking for the status it already has adds nothing, since
    /// that row would show no change, and makes retrying harmless. 200 with the
    /// item, 404 as for Get, or 400 with required or invalid.
    /// </summary>
    private static async Task<Results<Ok<ItemResponse>, NotFound, ValidationProblem>> ChangeStatus(
        Guid id, ChangeStatusRequest request, ClaimsPrincipal principal, UserManager<User> users,
        SavepointDbContext db, CancellationToken cancellationToken)
    {
        ItemStatus status = default;
        string? problem = request.Status is null ? "required"
            : !TryParseName(request.Status, out status) ? "invalid"
            : null;
        if (problem is not null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["status"] = [problem] });
        }

        var userId = CurrentUserId(principal, users);
        var row = await db.Items
            .Where(i => i.Id == id && i.UserId == userId)
            .WithCurrentStatus()
            .SingleOrDefaultAsync(cancellationToken);
        if (row is null) return TypedResults.NotFound();
        if (row.Current.Status == status) return TypedResults.Ok(ToResponse(row.Item, row.Current));

        // Its own transaction, so the database's clock gives it a later time than
        // the change before.
        var change = new StatusChange { ItemId = id, Status = status };
        db.StatusChanges.Add(change);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(ToResponse(row.Item, change));
    }

    // The checked, trimmed fields shared by creating and editing.
    private sealed record ItemDetails(Medium Medium, string Title, string? Creator);

    /// <summary>
    /// Checks the fields that creating and editing share, adding a code to errors
    /// for each one that's wrong. The details it returns are only meaningful when
    /// it added none.
    /// </summary>
    private static ItemDetails CheckDetails(
        string? mediumText, string? titleText, string? creatorText, Dictionary<string, string[]> errors)
    {
        var title = titleText?.Trim() ?? "";
        // An empty creator means none is known, saved as null.
        var creator = string.IsNullOrWhiteSpace(creatorText) ? null : creatorText.Trim();

        Medium medium = default;
        if (mediumText is null) errors["medium"] = ["required"];
        else if (!TryParseName(mediumText, out medium)) errors["medium"] = ["invalid"];

        if (title.Length == 0) errors["title"] = ["required"];
        else if (title.Length > LibraryRules.MaxTitleLength) errors["title"] = ["tooLong"];

        if (creator?.Length > LibraryRules.MaxCreatorLength) errors["creator"] = ["tooLong"];

        return new ItemDetails(medium, title, creator);
    }

    private static ItemResponse ToResponse(Item item, StatusChange current) =>
        new(
            item.Id,
            item.Medium.ToString(),
            item.Title,
            item.Creator,
            current.Status.ToString(),
            current.ChangedAt,
            item.CreatedAt);

    // Only the exact names, such as "InProgress". Enum.TryParse alone would also take
    // "inprogress" with ignoreCase, or a number like "1".
    private static bool TryParseName<TEnum>(string value, out TEnum parsed) where TEnum : struct, Enum
    {
        parsed = default;
        return Enum.GetNames<TEnum>().Contains(value) && Enum.TryParse(value, out parsed);
    }

    // The group requires someone signed in, so the cookie always holds their id.
    private static Guid CurrentUserId(ClaimsPrincipal principal, UserManager<User> users) =>
        Guid.Parse(users.GetUserId(principal)
            ?? throw new InvalidOperationException("A signed-in request had no user id."));
}
