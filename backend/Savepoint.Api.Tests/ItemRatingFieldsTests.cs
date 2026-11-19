using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

namespace Savepoint.Api.Tests;

/// <summary>
/// The rating, ratingChangeId and ratingChangedAt every item answer carries: the
/// newest of its rating changes, or all null until it's rated.
/// </summary>
public sealed class ItemRatingFieldsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement> Create(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJson(response);
    }

    private async Task<JsonElement> Get(HttpClient client, Guid id)
    {
        var response = await client.GetAsync($"/api/items/{id}", cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    // Straight into the database, one save per rating so each gets a later time.
    // The endpoint for rating comes with its own tests.
    private async Task<Guid> Rate(Guid itemId, int rating)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        var change = new RatingChange { ItemId = itemId, Rating = rating };
        db.RatingChanges.Add(change);
        await db.SaveChangesAsync(cancellationToken);
        return change.Id;
    }

    private static void AssertUnrated(JsonElement item)
    {
        Assert.Equal(JsonValueKind.Null, item.GetProperty("rating").ValueKind);
        Assert.Equal(JsonValueKind.Null, item.GetProperty("ratingChangeId").ValueKind);
        Assert.Equal(JsonValueKind.Null, item.GetProperty("ratingChangedAt").ValueKind);
    }

    [Fact]
    public async Task A_new_item_answers_with_no_rating()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var created = await Create(client);

        AssertUnrated(created);
        AssertUnrated(await Get(client, created.GetProperty("id").GetGuid()));
    }

    [Fact]
    public async Task Answers_with_the_newest_rating()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var id = (await Create(client)).GetProperty("id").GetGuid();
        await Rate(id, 2);
        var newest = await Rate(id, 4);

        var item = await Get(client, id);

        Assert.Equal(4, item.GetProperty("rating").GetInt32());
        Assert.Equal(newest, item.GetProperty("ratingChangeId").GetGuid());
        Assert.True(item.GetProperty("ratingChangedAt").GetDateTimeOffset() > item.GetProperty("createdAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Lists_each_item_with_its_own_rating()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var rated = (await Create(client)).GetProperty("id").GetGuid();
        var unrated = (await Create(client)).GetProperty("id").GetGuid();
        await Rate(rated, 5);

        var response = await client.GetAsync("/api/items", cancellationToken);
        var items = (await ReadJson(response)).EnumerateArray().ToDictionary(i => i.GetProperty("id").GetGuid());

        Assert.Equal(5, items[rated].GetProperty("rating").GetInt32());
        AssertUnrated(items[unrated]);
    }

    [Fact]
    public async Task Keeps_the_rating_when_the_status_or_details_change()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var id = (await Create(client)).GetProperty("id").GetGuid();
        var change = await Rate(id, 3);

        var moved = await ReadJson(await client.PostAsJsonAsync(
            $"/api/items/{id}/status", new { status = "Finished" }, cancellationToken));
        var edited = await ReadJson(await client.PutAsJsonAsync(
            $"/api/items/{id}", new { medium = "Book", title = "Piranesi, again" }, cancellationToken));

        foreach (var item in new[] { moved, edited })
        {
            Assert.Equal(3, item.GetProperty("rating").GetInt32());
            Assert.Equal(change, item.GetProperty("ratingChangeId").GetGuid());
        }
    }
}
