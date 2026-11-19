using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/items/{id}/rating-changes, an item's rating history for its timeline.</summary>
public sealed class ListRatingChangesTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<Guid> CreateItem(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Game", title = "Outer Wilds" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private async Task<JsonElement> Rate(HttpClient client, Guid itemId, int rating)
    {
        var response = await client.PostAsJsonAsync($"/api/items/{itemId}/rating", new { rating }, cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private Task<HttpResponseMessage> List(HttpClient client, Guid itemId) =>
        client.GetAsync($"/api/items/{itemId}/rating-changes", cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement[]> ListOk(HttpClient client, Guid itemId)
    {
        var response = await List(client, itemId);
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
    public async Task Answers_an_empty_list_for_an_item_not_rated_yet()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        Assert.Empty(await ListOk(client, await CreateItem(client)));
    }

    [Fact]
    public async Task Answers_with_each_rating_as_the_item_shows_it()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var item = await Rate(client, itemId, 4);

        var change = Assert.Single(await ListOk(client, itemId));

        Assert.Equal(item.GetProperty("ratingChangeId").GetGuid(), change.GetProperty("id").GetGuid());
        Assert.Equal(4, change.GetProperty("rating").GetInt32());
        Assert.Equal(
            item.GetProperty("ratingChangedAt").GetDateTimeOffset(),
            change.GetProperty("changedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Lists_every_change_oldest_first()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        await Rate(client, itemId, 3);
        await Rate(client, itemId, 5);
        await Rate(client, itemId, 4);

        var changes = await ListOk(client, itemId);

        Assert.Equal(new[] { 3, 5, 4 }, changes.Select(c => c.GetProperty("rating").GetInt32()));
        var times = changes.Select(c => c.GetProperty("changedAt").GetDateTimeOffset()).ToArray();
        Assert.Equal(times.Order(), times);
    }

    [Fact]
    public async Task Lists_only_that_items_ratings()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var otherId = await CreateItem(client);
        await Rate(client, itemId, 2);
        await Rate(client, otherId, 5);

        var change = Assert.Single(await ListOk(client, itemId));

        Assert.Equal(2, change.GetProperty("rating").GetInt32());
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item_even_when_it_has_no_ratings()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var rated = await CreateItem(owner);
        var unrated = await CreateItem(owner);
        await Rate(owner, rated, 5);
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        Assert.Equal(HttpStatusCode.NotFound, (await List(stranger, rated)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await List(stranger, unrated)).StatusCode);
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
