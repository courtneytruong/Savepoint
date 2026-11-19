using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/items/{id}/status-changes, an item's status history for its timeline.</summary>
public sealed class ListStatusChangesTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<JsonElement> CreateItem(HttpClient client, string? status = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Book", title = "Piranesi", status }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJson(response);
    }

    private async Task ChangeStatus(HttpClient client, JsonElement item, string status)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{item.GetProperty("id")}/status", new { status }, cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private Task<HttpResponseMessage> List(HttpClient client, Guid itemId) =>
        client.GetAsync($"/api/items/{itemId}/status-changes", cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement[]> ListOk(HttpClient client, JsonElement item)
    {
        var response = await List(client, item.GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return [.. (await ReadJson(response)).EnumerateArray()];
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await List(client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_new_item_has_its_first_status()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var item = await CreateItem(client, "InProgress");

        var change = Assert.Single(await ListOk(client, item));

        Assert.Equal(item.GetProperty("statusChangeId").GetGuid(), change.GetProperty("id").GetGuid());
        Assert.Equal("InProgress", change.GetProperty("status").GetString());
        Assert.Equal(
            item.GetProperty("statusChangedAt").GetDateTimeOffset(),
            change.GetProperty("changedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Lists_every_change_oldest_first()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var item = await CreateItem(client);
        await ChangeStatus(client, item, "InProgress");
        await ChangeStatus(client, item, "Finished");
        await ChangeStatus(client, item, "InProgress");

        var changes = await ListOk(client, item);

        Assert.Equal(
            ["Backlog", "InProgress", "Finished", "InProgress"],
            changes.Select(c => c.GetProperty("status").GetString()));
        var times = changes.Select(c => c.GetProperty("changedAt").GetDateTimeOffset()).ToArray();
        Assert.Equal(times.Order(), times);
    }

    [Fact]
    public async Task Lists_only_that_items_changes()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var item = await CreateItem(client);
        var other = await CreateItem(client);
        await ChangeStatus(client, other, "Finished");

        var change = Assert.Single(await ListOk(client, item));

        Assert.Equal("Backlog", change.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var item = await CreateItem(owner);
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        var response = await List(stranger, item.GetProperty("id").GetGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_for_an_item_that_doesnt_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await List(client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
