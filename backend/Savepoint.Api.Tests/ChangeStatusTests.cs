using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/items/{id}/status, changing an item's status by adding to its history.</summary>
public sealed class ChangeStatusTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<JsonElement> Create(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    private Task<HttpResponseMessage> Change(HttpClient client, JsonElement item, object body) =>
        client.PostAsJsonAsync($"/api/items/{item.GetProperty("id")}/status", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    // Every status the item has had, oldest first, straight from the database.
    private async Task<ItemStatus[]> History(JsonElement item)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        var id = item.GetProperty("id").GetGuid();
        return await db.StatusChanges
            .Where(s => s.ItemId == id)
            .OrderBy(s => s.ChangedAt).ThenBy(s => s.Id)
            .Select(s => s.Status)
            .ToArrayAsync(cancellationToken);
    }

    [Fact]
    public async Task Adds_the_new_status_to_the_history_and_answers_with_the_item()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await Change(client, created, new { status = "InProgress" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var item = await ReadJson(response);
        Assert.Equal("InProgress", item.GetProperty("status").GetString());
        Assert.True(item.GetProperty("statusChangedAt").GetDateTimeOffset() > created.GetProperty("statusChangedAt").GetDateTimeOffset());
        Assert.Equal(created.GetProperty("title").GetString(), item.GetProperty("title").GetString());
        Assert.Equal([ItemStatus.Backlog, ItemStatus.InProgress], await History(created));
    }

    [Fact]
    public async Task Keeps_every_change_in_order_and_shows_the_newest_everywhere()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        await Change(client, created, new { status = "InProgress" });
        await Change(client, created, new { status = "Dropped" });
        var last = await ReadJson(await Change(client, created, new { status = "InProgress" }));

        Assert.Equal(
            [ItemStatus.Backlog, ItemStatus.InProgress, ItemStatus.Dropped, ItemStatus.InProgress],
            await History(created));
        var fetched = await ReadJson(await client.GetAsync($"/api/items/{created.GetProperty("id")}", cancellationToken));
        var listed = (await ReadJson(await client.GetAsync("/api/items", cancellationToken)))[0];
        Assert.Equal(last.GetRawText(), fetched.GetRawText());
        Assert.Equal(last.GetRawText(), listed.GetRawText());
    }

    [Fact]
    public async Task Adds_nothing_when_the_status_is_already_the_one_asked_for()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await Change(client, created, new { status = "Backlog" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(created.GetRawText(), (await ReadJson(response)).GetRawText());
        Assert.Equal([ItemStatus.Backlog], await History(created));
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData("Paused", "invalid")]
    [InlineData("finished", "invalid")]
    public async Task Refuses_a_missing_or_unknown_status_and_adds_nothing(string? status, string code)
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await Change(client, created, new { status });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var codes = (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
        Assert.Equal([code], codes["status"]);
        Assert.Equal([ItemStatus.Backlog], await History(created));
    }

    [Fact]
    public async Task Answers_404_and_adds_nothing_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        var (other, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        using var __ = other;
        var created = await Create(owner);

        var response = await Change(other, created, new { status = "Finished" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal([ItemStatus.Backlog], await History(created));
    }

    [Fact]
    public async Task Answers_404_for_an_item_that_does_not_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await client.PostAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}/status", new { status = "Finished" }, cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}/status", new { status = "Finished" }, cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
