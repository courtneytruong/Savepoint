using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/activity, everything that happened across the person's library.</summary>
public sealed class ActivityTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private static string DaysAgo(int days) =>
        DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-days).ToString("yyyy-MM-dd");

    private async Task<Guid> CreateItem(HttpClient client, string medium, string title, string status = "Backlog")
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium, title, status }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private async Task Post(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body, cancellationToken);
        Assert.True(response.IsSuccessStatusCode, $"{path} answered {response.StatusCode}");
    }

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement> ActivityOk(HttpClient client)
    {
        var response = await client.GetAsync("/api/activity", cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private static JsonElement[] ListOf(JsonElement activity, string name) => [.. activity.GetProperty(name).EnumerateArray()];

    private static void AssertItem(JsonElement entry, Guid id, string title, string medium)
    {
        var item = entry.GetProperty("item");
        Assert.Equal(id, item.GetProperty("id").GetGuid());
        Assert.Equal(title, item.GetProperty("title").GetString());
        Assert.Equal(medium, item.GetProperty("medium").GetString());
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/activity", cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Answers_with_four_empty_lists_for_someone_with_no_items()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var activity = await ActivityOk(client);

        foreach (var name in new[] { "statusChanges", "ratingChanges", "sessions", "reflections" })
        {
            Assert.Empty(ListOf(activity, name));
        }
    }

    [Fact]
    public async Task Lists_every_items_status_changes_oldest_first_with_their_items()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var book = await CreateItem(client, "Book", "Piranesi");
        var game = await CreateItem(client, "Game", "Outer Wilds", "InProgress");
        await Post(client, $"/api/items/{book}/status", new { status = "Finished" });

        var changes = ListOf(await ActivityOk(client), "statusChanges");

        Assert.Equal(
            ["Backlog", "InProgress", "Finished"],
            changes.Select(c => c.GetProperty("status").GetString()));
        AssertItem(changes[0], book, "Piranesi", "Book");
        AssertItem(changes[1], game, "Outer Wilds", "Game");
        AssertItem(changes[2], book, "Piranesi", "Book");
        Assert.NotEqual(default, changes[0].GetProperty("changedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Lists_rating_changes_with_their_items()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var game = await CreateItem(client, "Game", "Outer Wilds");
        await Post(client, $"/api/items/{game}/rating", new { rating = 4 });
        await Post(client, $"/api/items/{game}/rating", new { rating = 5 });

        var changes = ListOf(await ActivityOk(client), "ratingChanges");

        Assert.Equal([4, 5], changes.Select(c => c.GetProperty("rating").GetInt32()));
        AssertItem(changes[1], game, "Outer Wilds", "Game");
    }

    [Fact]
    public async Task Lists_sessions_by_day_with_their_reflections_tags_and_items()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var book = await CreateItem(client, "Book", "Piranesi");
        await Post(client, $"/api/items/{book}/sessions", new
        {
            date = DaysAgo(1),
            durationMinutes = 45,
            pagesRead = 30,
            reflection = new { mood = "Curious", notes = "The house has its own tides.", tags = new[] { "house" } },
        });
        await Post(client, $"/api/items/{book}/sessions", new
        {
            date = DaysAgo(3),
            durationMinutes = 20,
            reflection = new { mood = "Bored", notes = "A slow start to the book, honestly." },
        });

        var sessions = ListOf(await ActivityOk(client), "sessions");

        Assert.Equal([DaysAgo(3), DaysAgo(1)], sessions.Select(s => s.GetProperty("date").GetString()));
        var latest = sessions[1];
        Assert.Equal(45, latest.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(30, latest.GetProperty("pagesRead").GetInt32());
        Assert.Equal(book, latest.GetProperty("itemId").GetGuid());
        var reflection = latest.GetProperty("reflection");
        Assert.Equal("Curious", reflection.GetProperty("mood").GetString());
        Assert.Equal(["house"], reflection.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        AssertItem(latest, book, "Piranesi", "Book");
    }

    [Fact]
    public async Task Lists_only_standalone_reflections_as_reflections()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var game = await CreateItem(client, "Game", "Outer Wilds");
        await Post(client, $"/api/items/{game}/reflections", new
        {
            mood = "Moved",
            notes = "Nothing else has made me feel this small.",
            tags = new[] { "awe" },
        });
        await Post(client, $"/api/items/{game}/sessions", new
        {
            date = DaysAgo(1),
            durationMinutes = 60,
            reflection = new { mood = "Curious", notes = "A thought about one sitting." },
        });

        var reflection = Assert.Single(ListOf(await ActivityOk(client), "reflections"));

        Assert.Equal("Nothing else has made me feel this small.", reflection.GetProperty("notes").GetString());
        Assert.Equal(["awe"], reflection.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        AssertItem(reflection, game, "Outer Wilds", "Game");
    }

    [Fact]
    public async Task Lists_only_the_signed_in_persons_activity()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;
        var theirs = await CreateItem(owner, "Book", "Piranesi");
        await Post(owner, $"/api/items/{theirs}/rating", new { rating = 5 });
        await Post(owner, $"/api/items/{theirs}/reflections", new { mood = "Moved", notes = "Private thoughts about it, all mine." });
        var mine = await CreateItem(stranger, "Game", "Outer Wilds");

        var activity = await ActivityOk(stranger);

        var change = Assert.Single(ListOf(activity, "statusChanges"));
        AssertItem(change, mine, "Outer Wilds", "Game");
        Assert.Empty(ListOf(activity, "ratingChanges"));
        Assert.Empty(ListOf(activity, "reflections"));
    }
}
