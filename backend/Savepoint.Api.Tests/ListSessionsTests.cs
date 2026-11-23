using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Tags;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/items/{itemId}/sessions, an item's sessions with their reflections.</summary>
public sealed class ListSessionsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    private static string DaysAgo(int days) => UtcToday.AddDays(-days).ToString("yyyy-MM-dd");

    private async Task<Guid> CreateItem(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    // Logs a session, with notes that say which it is, so the order can be checked.
    private async Task Log(HttpClient client, Guid itemId, string date, string notes)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/sessions",
            new { date, durationMinutes = 30, pagesRead = 12, reflection = new { mood = "Curious", notes } },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private Task<HttpResponseMessage> List(HttpClient client, Guid itemId) =>
        client.GetAsync($"/api/items/{itemId}/sessions", cancellationToken);

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
    public async Task Answers_an_empty_list_for_an_item_with_no_sessions()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        Assert.Empty(await ListOk(client, await CreateItem(client)));
    }

    [Fact]
    public async Task Answers_with_each_session_and_its_reflection()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        await Log(client, itemId, DaysAgo(1), "The house has its own tides.");

        var session = Assert.Single(await ListOk(client, itemId));

        Assert.Equal(itemId, session.GetProperty("itemId").GetGuid());
        Assert.Equal(DaysAgo(1), session.GetProperty("date").GetString());
        Assert.Equal(30, session.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(12, session.GetProperty("pagesRead").GetInt32());
        var reflection = session.GetProperty("reflection");
        Assert.Equal("Curious", reflection.GetProperty("mood").GetString());
        Assert.Equal("The house has its own tides.", reflection.GetProperty("notes").GetString());
        Assert.Equal(
            session.GetProperty("createdAt").GetDateTimeOffset(),
            reflection.GetProperty("updatedAt").GetDateTimeOffset());
        Assert.Equal(
            session.GetProperty("createdAt").GetDateTimeOffset(),
            session.GetProperty("updatedAt").GetDateTimeOffset());
        Assert.Empty(reflection.GetProperty("tags").EnumerateArray());
    }

    [Fact]
    public async Task Answers_with_a_reflections_tags_in_order_ignoring_case_and_accents()
    {
        var (client, userId) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        await Log(client, itemId, DaysAgo(1), "The statues in the halls.");
        // Straight into the database, since saving tags through the API comes later.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
            var reflection = await db.Reflections.Include(r => r.Tags).SingleAsync(r => r.ItemId == itemId, cancellationToken);
            reflection.Tags.AddRange(
                new Tag { UserId = userId, Name = "Space", NormalizedName = "space" },
                new Tag { UserId = userId, Name = "Épique", NormalizedName = "epique" },
                new Tag { UserId = userId, Name = "cozy", NormalizedName = "cozy" });
            await db.SaveChangesAsync(cancellationToken);
        }

        var session = Assert.Single(await ListOk(client, itemId));

        var tags = session.GetProperty("reflection").GetProperty("tags").EnumerateArray().Select(t => t.GetString());
        Assert.Equal(["cozy", "Épique", "Space"], tags);
    }

    [Fact]
    public async Task Lists_the_newest_day_first_and_the_latest_logged_first_within_a_day()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        // Logged out of order, as when catching up on a few days at once.
        await Log(client, itemId, DaysAgo(3), "Three days ago, logged first.");
        await Log(client, itemId, DaysAgo(1), "Yesterday, the newest day.");
        await Log(client, itemId, DaysAgo(3), "Three days ago, logged later.");
        await Log(client, itemId, DaysAgo(2), "Two days ago, in the middle.");

        var notes = (await ListOk(client, itemId))
            .Select(s => s.GetProperty("reflection").GetProperty("notes").GetString());

        Assert.Equal(
            [
                "Yesterday, the newest day.",
                "Two days ago, in the middle.",
                "Three days ago, logged later.",
                "Three days ago, logged first.",
            ],
            notes);
    }

    [Fact]
    public async Task Lists_only_that_items_sessions()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var otherId = await CreateItem(client);
        await Log(client, itemId, DaysAgo(1), "This one is about the item.");
        await Log(client, otherId, DaysAgo(1), "This one is about another.");

        var session = Assert.Single(await ListOk(client, itemId));

        Assert.Equal(itemId, session.GetProperty("itemId").GetGuid());
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var itemId = await CreateItem(owner);
        await Log(owner, itemId, DaysAgo(1), "Private thoughts about it.");
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        var response = await List(stranger, itemId);

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
