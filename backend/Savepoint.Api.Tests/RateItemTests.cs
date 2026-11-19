using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/items/{id}/rating, rating an item by adding to its rating history.</summary>
public sealed class RateItemTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<JsonElement> Create(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJson(response);
    }

    private Task<HttpResponseMessage> Rate(HttpClient client, JsonElement item, object body) =>
        client.PostAsJsonAsync($"/api/items/{item.GetProperty("id")}/rating", body, cancellationToken);

    private async Task<JsonElement> RateOk(HttpClient client, JsonElement item, int rating)
    {
        var response = await Rate(client, item, new { rating });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    // Every rating the item has had, oldest first, straight from the database.
    private async Task<int[]> History(JsonElement item)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        var id = item.GetProperty("id").GetGuid();
        return await db.RatingChanges
            .Where(r => r.ItemId == id)
            .OrderBy(r => r.ChangedAt).ThenBy(r => r.Id)
            .Select(r => r.Rating)
            .ToArrayAsync(cancellationToken);
    }

    [Fact]
    public async Task Rates_an_item_and_answers_with_it()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var item = await RateOk(client, created, 4);

        Assert.Equal(4, item.GetProperty("rating").GetInt32());
        Assert.NotEqual(Guid.Empty, item.GetProperty("ratingChangeId").GetGuid());
        Assert.True(item.GetProperty("ratingChangedAt").GetDateTimeOffset() > created.GetProperty("createdAt").GetDateTimeOffset());
        Assert.Equal(created.GetProperty("title").GetString(), item.GetProperty("title").GetString());
        Assert.Equal(created.GetProperty("status").GetString(), item.GetProperty("status").GetString());
        Assert.Equal(new[] { 4 }, await History(created));
    }

    [Fact]
    public async Task Keeps_every_change_of_heart_in_order_and_shows_the_newest_everywhere()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var first = await RateOk(client, created, 2);
        var second = await RateOk(client, created, 5);

        Assert.Equal(new[] { 2, 5 }, await History(created));
        Assert.NotEqual(first.GetProperty("ratingChangeId").GetGuid(), second.GetProperty("ratingChangeId").GetGuid());
        Assert.True(second.GetProperty("ratingChangedAt").GetDateTimeOffset() > first.GetProperty("ratingChangedAt").GetDateTimeOffset());
        var fetched = await ReadJson(await client.GetAsync($"/api/items/{created.GetProperty("id")}", cancellationToken));
        Assert.Equal(second.GetRawText(), fetched.GetRawText());
    }

    [Fact]
    public async Task Adds_nothing_when_the_rating_is_already_the_one_asked_for()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);
        var rated = await RateOk(client, created, 3);

        var again = await RateOk(client, created, 3);

        Assert.Equal(rated.GetRawText(), again.GetRawText());
        Assert.Equal(new[] { 3 }, await History(created));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public async Task Allows_one_to_five_stars(int rating)
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        Assert.Equal(rating, (await RateOk(client, await Create(client), rating)).GetProperty("rating").GetInt32());
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData(0, "invalid")]
    [InlineData(6, "invalid")]
    [InlineData(-1, "invalid")]
    public async Task Refuses_a_missing_or_out_of_range_rating_and_adds_nothing(int? rating, string code)
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await Rate(client, created, new { rating });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var codes = (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
        Assert.Equal([code], codes["rating"]);
        Assert.Empty(await History(created));
    }

    [Theory]
    [InlineData("""{ "rating": 3.5 }""")]
    [InlineData("""{ "rating": "four" }""")]
    public async Task Refuses_a_rating_that_isnt_a_whole_number(string json)
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await client.PostAsync(
            $"/api/items/{created.GetProperty("id")}/rating",
            new StringContent(json, Encoding.UTF8, "application/json"),
            cancellationToken);

        // The JSON reader turns these away before the endpoint sees them, so there's no field code.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await History(created));
    }

    [Fact]
    public async Task Answers_404_and_adds_nothing_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        var (other, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        using var __ = other;
        var created = await Create(owner);

        var response = await Rate(other, created, new { rating = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await History(created));
    }

    [Fact]
    public async Task Answers_404_for_an_item_that_does_not_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await client.PostAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}/rating", new { rating = 4 }, cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}/rating", new { rating = 4 }, cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
