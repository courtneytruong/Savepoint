using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/items, the signed-in person's whole library.</summary>
public sealed class ListItemsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<Guid> Create(HttpClient client, string title, string medium = "Book", string status = "Backlog")
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium, title, status }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken)).GetProperty("id").GetGuid();
    }

    private async Task<JsonElement[]> List(HttpClient client)
    {
        var response = await client.GetAsync("/api/items", cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken)).EnumerateArray().ToArray();
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/items", cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Answers_an_empty_list_for_a_new_library()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        Assert.Empty(await List(client));
    }

    [Fact]
    public async Task Lists_every_item_newest_first_with_the_same_shape_as_creating()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        await Create(client, "Piranesi");
        await Create(client, "Hades", medium: "Game", status: "InProgress");

        var items = await List(client);

        Assert.Equal(["Hades", "Piranesi"], items.Select(i => i.GetProperty("title").GetString()));
        var hades = items[0];
        Assert.Equal("Game", hades.GetProperty("medium").GetString());
        Assert.Equal("InProgress", hades.GetProperty("status").GetString());
        Assert.Equal(
            ["id", "medium", "title", "creator", "status", "statusChangedAt", "createdAt"],
            hades.EnumerateObject().Select(p => p.Name));
    }

    [Fact]
    public async Task Shows_only_the_signed_in_persons_items()
    {
        var (mine, _) = await factory.SignedInClientAsync(cancellationToken);
        var (theirs, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = mine;
        using var __ = theirs;
        await Create(mine, "Mine");
        await Create(theirs, "Theirs");

        Assert.Equal(["Mine"], (await List(mine)).Select(i => i.GetProperty("title").GetString()));
    }

    [Fact]
    public async Task Shows_the_newest_status_as_current()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var id = await Create(client, "Piranesi");

        // Added straight to the database, until there's an endpoint for changing a
        // status. A later transaction, so the database's clock gives it a later time.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
            db.StatusChanges.Add(new StatusChange { ItemId = id, Status = ItemStatus.InProgress });
            await db.SaveChangesAsync(cancellationToken);
        }

        var item = Assert.Single(await List(client));
        Assert.Equal("InProgress", item.GetProperty("status").GetString());
        Assert.True(item.GetProperty("statusChangedAt").GetDateTimeOffset() > item.GetProperty("createdAt").GetDateTimeOffset());
    }
}
