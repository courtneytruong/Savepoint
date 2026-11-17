using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Sessions;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/items/{itemId}/sessions, logging a session with its reflection.</summary>
public sealed class CreateSessionTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Notes = "The crossing of the ice stayed with me.";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // The API's own today, which is in UTC.
    private static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    private static string DateKey(DateOnly date) => date.ToString("yyyy-MM-dd");

    // A signed-in client with an item of its own to log sessions for.
    private async Task<(HttpClient Client, Guid ItemId)> ClientWithItem(string medium = "Book")
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        var response = await client.PostAsJsonAsync("/api/items", new { medium, title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (client, (await ReadJson(response)).GetProperty("id").GetGuid());
    }

    // A valid body, as the frontend's SessionForm sends it, with any changes made.
    private static Dictionary<string, object?> Body(Action<Dictionary<string, object?>, Dictionary<string, object?>>? change = null)
    {
        var reflection = new Dictionary<string, object?> { ["mood"] = "Moved", ["notes"] = Notes, ["tags"] = new[] { "ice" } };
        var body = new Dictionary<string, object?>
        {
            ["itemId"] = Guid.NewGuid(),
            ["date"] = DateKey(UtcToday),
            ["durationMinutes"] = 45,
            ["pagesRead"] = 30,
            ["reflection"] = reflection,
        };
        change?.Invoke(body, reflection);
        return body;
    }

    private Task<HttpResponseMessage> Log(HttpClient client, Guid itemId, object body) =>
        client.PostAsJsonAsync($"/api/items/{itemId}/sessions", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    // The code for each field in a 400. Read once, since a body can only be read once.
    private async Task<Dictionary<string, string[]>> ErrorCodes(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private async Task<string> ErrorCode(HttpResponseMessage response, string field) =>
        Assert.Single((await ErrorCodes(response))[field]);

    private async Task<int> SessionCount(Guid itemId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return await db.Sessions.CountAsync(s => s.ItemId == itemId, cancellationToken);
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await Log(client, Guid.NewGuid(), Body());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logs_the_session_and_answers_with_it_and_its_reflection()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((_, reflection) => reflection["notes"] = $"  {Notes}\n"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = await ReadJson(response);
        var id = session.GetProperty("id").GetGuid();
        Assert.Equal($"/api/items/{itemId}/sessions/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal(itemId, session.GetProperty("itemId").GetGuid());
        Assert.Equal(DateKey(UtcToday), session.GetProperty("date").GetString());
        Assert.Equal(45, session.GetProperty("durationMinutes").GetInt32());
        Assert.Equal(30, session.GetProperty("pagesRead").GetInt32());

        var reflection = session.GetProperty("reflection");
        Assert.Equal("Moved", reflection.GetProperty("mood").GetString());
        Assert.Equal(Notes, reflection.GetProperty("notes").GetString());
        // Saved in one transaction, so the database's clock gave them one time.
        var createdAt = session.GetProperty("createdAt").GetDateTimeOffset();
        Assert.Equal(createdAt, reflection.GetProperty("createdAt").GetDateTimeOffset());
        Assert.Equal(createdAt, reflection.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Saves_the_session_and_its_reflection_together()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var id = (await ReadJson(await Log(client, itemId, Body()))).GetProperty("id").GetGuid();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        var saved = await db.Sessions.Include(s => s.Reflection).SingleAsync(s => s.Id == id, cancellationToken);
        Assert.Equal(itemId, saved.ItemId);
        Assert.NotNull(saved.Reflection);
        Assert.Equal(itemId, saved.Reflection.ItemId);
        Assert.Equal(Mood.Moved, saved.Reflection.Mood);
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item_and_saves_nothing()
    {
        var (owner, itemId) = await ClientWithItem();
        using var _ = owner;
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        var response = await Log(stranger, itemId, Body());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, await SessionCount(itemId));
    }

    [Fact]
    public async Task Answers_404_for_an_item_that_doesnt_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await Log(client, Guid.NewGuid(), Body());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Allows_a_book_session_with_no_page_count()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body["pagesRead"] = null));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ReadJson(response)).GetProperty("pagesRead").ValueKind);
    }

    [Fact]
    public async Task Logs_a_game_session_without_pages()
    {
        var (client, itemId) = await ClientWithItem("Game");
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body["pagesRead"] = null));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Refuses_pages_for_a_game_and_saves_nothing()
    {
        var (client, itemId) = await ClientWithItem("Game");
        using var _ = client;

        var response = await Log(client, itemId, Body());

        Assert.Equal("invalid", await ErrorCode(response, "pagesRead"));
        Assert.Equal(0, await SessionCount(itemId));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task Refuses_a_page_count_that_isnt_above_0(int pages)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body["pagesRead"] = pages));

        Assert.Equal("invalid", await ErrorCode(response, "pagesRead"));
    }

    [Fact]
    public async Task Allows_a_date_one_day_past_the_apis_today()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        // The person's own day can be ahead of UTC.
        var response = await Log(client, itemId, Body((body, _) => body["date"] = DateKey(UtcToday.AddDays(1))));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData("", "required")]
    [InlineData("14/11/2026", "invalid")]
    [InlineData("2026-02-30", "invalid")]
    [InlineData("2026-11-14T10:00:00Z", "invalid")]
    public async Task Refuses_a_missing_or_unreadable_date(string? date, string code)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body["date"] = date));

        Assert.Equal(code, await ErrorCode(response, "date"));
    }

    [Fact]
    public async Task Refuses_a_date_more_than_a_day_past_the_apis_today()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body["date"] = DateKey(UtcToday.AddDays(2))));

        Assert.Equal("inFuture", await ErrorCode(response, "date"));
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData(0, "tooShort")]
    [InlineData(SessionRules.MaxDurationMinutes + 1, "tooLong")]
    public async Task Refuses_a_duration_outside_1_to_1440_minutes(int? minutes, string code)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body["durationMinutes"] = minutes));

        Assert.Equal(code, await ErrorCode(response, "durationMinutes"));
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData("Sleepy", "invalid")]
    [InlineData("moved", "invalid")]
    [InlineData("2", "invalid")]
    public async Task Refuses_a_mood_thats_missing_or_not_in_the_list(string? mood, string code)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((_, reflection) => reflection["mood"] = mood));

        Assert.Equal(code, await ErrorCode(response, "reflection.mood"));
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData("   ", "required")]
    [InlineData("  Nineteen characters  ", "tooShort")] // 19 once trimmed
    public async Task Refuses_notes_that_are_missing_or_too_short(string? notes, string code)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((_, reflection) => reflection["notes"] = notes));

        Assert.Equal(code, await ErrorCode(response, "reflection.notes"));
    }

    [Fact]
    public async Task Refuses_notes_over_10000_characters()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var notes = new string('a', SessionRules.MaxNotesLength + 1);
        var response = await Log(client, itemId, Body((_, reflection) => reflection["notes"] = notes));

        Assert.Equal("tooLong", await ErrorCode(response, "reflection.notes"));
    }

    // An emoji is one character to the database but two to string.Length, so the
    // API must count as the database does, or a note could pass here and fail there.
    [Theory]
    [InlineData(19, HttpStatusCode.Created)]
    [InlineData(18, HttpStatusCode.BadRequest)]
    public async Task Counts_an_emoji_as_one_character(int letters, HttpStatusCode expected)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var notes = new string('a', letters) + "🌊";
        var response = await Log(client, itemId, Body((_, reflection) => reflection["notes"] = notes));

        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.BadRequest) Assert.Equal("tooShort", await ErrorCode(response, "reflection.notes"));
    }

    [Fact]
    public async Task Refuses_a_session_without_a_reflection_and_saves_nothing()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, Body((body, _) => body.Remove("reflection")));

        var codes = await ErrorCodes(response);
        Assert.Equal(["required"], codes["reflection.mood"]);
        Assert.Equal(["required"], codes["reflection.notes"]);
        Assert.Equal(0, await SessionCount(itemId));
    }

    [Fact]
    public async Task Reports_every_wrong_field_at_once()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Log(client, itemId, new { });

        var codes = await ErrorCodes(response);
        Assert.Equal(
            ["date", "durationMinutes", "reflection.mood", "reflection.notes"],
            codes.Keys.Order().ToArray());
    }
}
