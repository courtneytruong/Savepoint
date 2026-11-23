using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/reflections, every reflection in the person's library.</summary>
public sealed class ListAllReflectionsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private static string DaysAgo(int days) =>
        DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-days).ToString("yyyy-MM-dd");

    private async Task<Guid> CreateItem(HttpClient client, string medium, string title)
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium, title }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private async Task Write(HttpClient client, Guid itemId, string notes, params string[] tags)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/reflections", new { mood = "Moved", notes, tags }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task Log(HttpClient client, Guid itemId, string date, string notes, int? pagesRead = null)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/sessions",
            new { date, durationMinutes = 45, pagesRead, reflection = new { mood = "Curious", notes, tags = new[] { "Space" } } },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement[]> ListOk(HttpClient client)
    {
        var response = await client.GetAsync("/api/reflections", cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return [.. (await ReadJson(response)).EnumerateArray()];
    }

    private static string? NotesOf(JsonElement reflection) => reflection.GetProperty("notes").GetString();

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/reflections", cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Answers_an_empty_list_for_someone_with_none()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        await CreateItem(client, "Book", "Piranesi");

        Assert.Empty(await ListOk(client));
    }

    [Fact]
    public async Task Answers_with_every_reflection_across_items_newest_written_first()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var book = await CreateItem(client, "Book", "Piranesi");
        var game = await CreateItem(client, "Game", "Outer Wilds");
        await Log(client, book, DaysAgo(3), "A session of the book, logged first.");
        await Write(client, game, "A thought about the game, written second.");
        await Log(client, game, DaysAgo(1), "A session of the game, logged last.");

        var notes = (await ListOk(client)).Select(NotesOf);

        Assert.Equal(
            [
                "A session of the game, logged last.",
                "A thought about the game, written second.",
                "A session of the book, logged first.",
            ],
            notes);
    }

    [Fact]
    public async Task Gives_a_sessions_reflection_its_item_and_session()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var book = await CreateItem(client, "Book", "Piranesi");
        await Log(client, book, DaysAgo(2), "The house has its own tides.", pagesRead: 30);

        var reflection = Assert.Single(await ListOk(client));

        Assert.Equal("Curious", reflection.GetProperty("mood").GetString());
        Assert.Equal(["Space"], reflection.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        var item = reflection.GetProperty("item");
        Assert.Equal(book, item.GetProperty("id").GetGuid());
        Assert.Equal("Piranesi", item.GetProperty("title").GetString());
        Assert.Equal("Book", item.GetProperty("medium").GetString());
        var session = reflection.GetProperty("session");
        Assert.Equal(DaysAgo(2), session.GetProperty("date").GetString());
        Assert.Equal(45, session.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(30, session.GetProperty("pagesRead").GetInt32());
        Assert.Equal(session.GetProperty("createdAt").GetDateTimeOffset(), session.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Gives_a_standalone_reflection_its_item_and_no_session()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var game = await CreateItem(client, "Game", "Outer Wilds");
        await Write(client, game, "Nothing else has made me feel this small.", "Space", "awe");

        var reflection = Assert.Single(await ListOk(client));

        Assert.Equal(game, reflection.GetProperty("item").GetProperty("id").GetGuid());
        Assert.Equal("Game", reflection.GetProperty("item").GetProperty("medium").GetString());
        Assert.Equal(JsonValueKind.Null, reflection.GetProperty("session").ValueKind);
        Assert.Equal(["awe", "Space"], reflection.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        Assert.Equal(
            reflection.GetProperty("createdAt").GetDateTimeOffset(),
            reflection.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Lists_only_the_signed_in_persons_reflections()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;
        await Write(owner, await CreateItem(owner, "Book", "Piranesi"), "Private thoughts about it.");
        await Write(stranger, await CreateItem(stranger, "Game", "Outer Wilds"), "My own thoughts, not theirs.");

        var reflection = Assert.Single(await ListOk(stranger));

        Assert.Equal("My own thoughts, not theirs.", NotesOf(reflection));
    }
}
