using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>PUT /api/items/{itemId}/sessions/{sessionId}, editing a session and its reflection.</summary>
public sealed class UpdateSessionTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Notes = "The house has its own tides.";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private static string DaysAgo(int days) =>
        DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-days).ToString("yyyy-MM-dd");

    private static object Body(
        string? date = null, int? durationMinutes = 40, int? pagesRead = 20, string mood = "Curious", string notes = Notes) =>
        new { date = date ?? DaysAgo(2), durationMinutes, pagesRead, reflection = new { mood, notes } };

    private async Task<Guid> CreateItem(HttpClient client, string medium = "Book")
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium, title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private async Task<JsonElement> Log(HttpClient client, Guid itemId, object? body = null)
    {
        var response = await client.PostAsJsonAsync($"/api/items/{itemId}/sessions", body ?? Body(), cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJson(response);
    }

    // A signed-in client with an item, and a session logged for it.
    private async Task<(HttpClient Client, Guid ItemId, JsonElement Session)> ClientWithSession(string medium = "Book")
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        var itemId = await CreateItem(client, medium);
        var session = await Log(client, itemId, medium == "Book" ? Body() : Body(pagesRead: null));
        return (client, itemId, session);
    }

    private Task<HttpResponseMessage> Update(HttpClient client, Guid itemId, JsonElement session, object body) =>
        client.PutAsJsonAsync($"/api/items/{itemId}/sessions/{session.GetProperty("id")}", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement> OnlySession(HttpClient client, Guid itemId)
    {
        var response = await client.GetAsync($"/api/items/{itemId}/sessions", cancellationToken);
        return Assert.Single((await ReadJson(response)).EnumerateArray());
    }

    private async Task<Dictionary<string, string[]>> ErrorCodes(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private static DateTimeOffset Time(JsonElement element, string property) =>
        element.GetProperty(property).GetDateTimeOffset();

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}/sessions/{Guid.NewGuid()}", Body(), cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Replaces_the_session_and_reflection_and_answers_with_them()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;

        var response = await Update(client, itemId, created, Body(
            date: DaysAgo(5), durationMinutes: 90, pagesRead: 48, mood: "Moved", notes: "  Now I see what the statues mean.  "));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await ReadJson(response);
        Assert.Equal(created.GetProperty("id").GetGuid(), session.GetProperty("id").GetGuid());
        Assert.Equal(DaysAgo(5), session.GetProperty("date").GetString());
        Assert.Equal(90, session.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(48, session.GetProperty("pagesRead").GetInt32());
        var reflection = session.GetProperty("reflection");
        Assert.Equal(created.GetProperty("reflection").GetProperty("id").GetGuid(), reflection.GetProperty("id").GetGuid());
        Assert.Equal("Moved", reflection.GetProperty("mood").GetString());
        Assert.Equal("Now I see what the statues mean.", reflection.GetProperty("notes").GetString());
        Assert.Equal(Time(created, "createdAt"), Time(session, "createdAt"));
    }

    [Fact]
    public async Task Saves_the_change_so_listing_afterwards_agrees()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;

        var updated = await ReadJson(await Update(client, itemId, created, Body(durationMinutes: 75, mood: "Hooked")));

        Assert.Equal(updated.GetRawText(), (await OnlySession(client, itemId)).GetRawText());
    }

    [Fact]
    public async Task Moves_updatedAt_on_when_the_reflection_changes()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;

        var session = await ReadJson(await Update(client, itemId, created, Body(notes: "A second look at the tides.")));

        var reflection = session.GetProperty("reflection");
        Assert.Equal(Time(created.GetProperty("reflection"), "createdAt"), Time(reflection, "createdAt"));
        Assert.True(Time(reflection, "updatedAt") > Time(reflection, "createdAt"));
    }

    [Fact]
    public async Task Keeps_updatedAt_when_only_the_session_changes()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;

        // The same mood and notes, with a fixed duration and date.
        var session = await ReadJson(await Update(client, itemId, created, Body(date: DaysAgo(3), durationMinutes: 55)));

        var reflection = session.GetProperty("reflection");
        Assert.Equal(55, session.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(Time(created.GetProperty("reflection"), "updatedAt"), Time(reflection, "updatedAt"));
    }

    [Fact]
    public async Task Clears_the_page_count_when_it_is_left_out()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;

        var session = await ReadJson(await Update(client, itemId, created, Body(pagesRead: null)));

        Assert.Equal(JsonValueKind.Null, session.GetProperty("pagesRead").ValueKind);
    }

    [Fact]
    public async Task Checks_the_fields_like_logging_and_changes_nothing_when_they_are_wrong()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;

        var response = await Update(client, itemId, created, new { pagesRead = 0 });

        var codes = await ErrorCodes(response);
        Assert.Equal(
            ["date", "durationMinutes", "pagesRead", "reflection.mood", "reflection.notes"],
            codes.Keys.Order().ToArray());
        Assert.Equal(created.GetRawText(), (await OnlySession(client, itemId)).GetRawText());
    }

    [Fact]
    public async Task Refuses_a_date_more_than_a_day_ahead()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;
        var tooLate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(2).ToString("yyyy-MM-dd");

        var response = await Update(client, itemId, created, Body(date: tooLate));

        Assert.Equal(["inFuture"], (await ErrorCodes(response))["date"]);
    }

    [Fact]
    public async Task Refuses_pages_for_a_game_and_changes_nothing()
    {
        var (client, itemId, created) = await ClientWithSession("Game");
        using var _ = client;

        var response = await Update(client, itemId, created, Body(pagesRead: 10));

        Assert.Equal(["invalid"], (await ErrorCodes(response))["pagesRead"]);
        Assert.Equal(created.GetRawText(), (await OnlySession(client, itemId)).GetRawText());
    }

    [Fact]
    public async Task Answers_404_and_changes_nothing_for_someone_elses_session()
    {
        var (owner, itemId, created) = await ClientWithSession();
        using var _ = owner;
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        var response = await Update(stranger, itemId, created, Body(durationMinutes: 5));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(created.GetRawText(), (await OnlySession(owner, itemId)).GetRawText());
    }

    [Fact]
    public async Task Answers_404_and_changes_nothing_when_the_session_is_another_items()
    {
        var (client, itemId, created) = await ClientWithSession();
        using var _ = client;
        var otherItemId = await CreateItem(client);

        // The person's own item and session, but they don't belong together.
        var response = await Update(client, otherItemId, created, Body(durationMinutes: 5));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(created.GetRawText(), (await OnlySession(client, itemId)).GetRawText());
    }

    [Fact]
    public async Task Answers_404_for_a_session_that_doesnt_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);

        var response = await client.PutAsJsonAsync(
            $"/api/items/{itemId}/sessions/{Guid.NewGuid()}", Body(), cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
