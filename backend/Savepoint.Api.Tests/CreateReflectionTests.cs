using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Sessions;
using Savepoint.Api.Tags;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/items/{itemId}/reflections, writing a reflection with no session.</summary>
public sealed class CreateReflectionTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Notes = "A slow start, but the ending earned every page.";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // A signed-in client with an item of its own, at the status given.
    private async Task<(HttpClient Client, Guid ItemId)> ClientWithItem(string status = "Finished")
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Book", title = "Piranesi", status }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (client, (await ReadJson(response)).GetProperty("id").GetGuid());
    }

    // A valid body, as the frontend's ReflectionForm sends it, with any changes made.
    private static Dictionary<string, object?> Body(Action<Dictionary<string, object?>>? change = null)
    {
        var body = new Dictionary<string, object?> { ["mood"] = "Moved", ["notes"] = Notes, ["tags"] = new[] { "ending" } };
        change?.Invoke(body);
        return body;
    }

    private Task<HttpResponseMessage> Write(HttpClient client, Guid itemId, object body) =>
        client.PostAsJsonAsync($"/api/items/{itemId}/reflections", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<string> ErrorCode(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
        return Assert.Single(errors[field]);
    }

    private async Task<List<Reflection>> SavedReflections(Guid itemId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return await db.Reflections.Where(r => r.ItemId == itemId).AsNoTracking().ToListAsync(cancellationToken);
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await Write(client, Guid.NewGuid(), Body());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Writes_the_reflection_with_no_session_and_answers_with_it()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Write(client, itemId, Body(body => body["notes"] = $"  {Notes}\n"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var reflection = await ReadJson(response);
        var id = reflection.GetProperty("id").GetGuid();
        Assert.Equal($"/api/items/{itemId}/reflections/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal("Moved", reflection.GetProperty("mood").GetString());
        Assert.Equal(Notes, reflection.GetProperty("notes").GetString());
        Assert.Equal(["ending"], reflection.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        var createdAt = reflection.GetProperty("createdAt").GetDateTimeOffset();
        Assert.NotEqual(default, createdAt);
        Assert.Equal(createdAt, reflection.GetProperty("updatedAt").GetDateTimeOffset());

        var saved = Assert.Single(await SavedReflections(itemId));
        Assert.Equal(id, saved.Id);
        Assert.Null(saved.SessionId);
    }

    [Theory]
    [InlineData("Backlog")]
    [InlineData("InProgress")]
    [InlineData("Dropped")]
    public async Task Writes_one_about_an_item_at_any_status(string status)
    {
        var (client, itemId) = await ClientWithItem(status);
        using var _ = client;

        var response = await Write(client, itemId, Body());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Writes_as_many_as_wanted_about_one_item()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        Assert.Equal(HttpStatusCode.Created, (await Write(client, itemId, Body())).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Write(client, itemId, Body())).StatusCode);

        Assert.Equal(2, (await SavedReflections(itemId)).Count);
    }

    [Fact]
    public async Task Reuses_the_persons_tags_as_a_session_does()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;
        await Write(client, itemId, Body(body => body["tags"] = new[] { "Ending" }));

        var response = await Write(client, itemId, Body(body => body["tags"] = new[] { "ending", "found  family" }));

        var tags = (await ReadJson(response)).GetProperty("tags").EnumerateArray().Select(t => t.GetString());
        Assert.Equal(["Ending", "found family"], tags);
    }

    [Fact]
    public async Task Writes_one_with_no_tags_when_they_are_missing()
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Write(client, itemId, Body(body => body.Remove("tags")));

        Assert.Empty((await ReadJson(response)).GetProperty("tags").EnumerateArray());
    }

    public static TheoryData<string, object?, string> BadFields => new()
    {
        { "mood", null, "required" },
        { "mood", "Sleepy", "invalid" },
        { "notes", null, "required" },
        { "notes", "   ", "required" },
        { "notes", "Too short.", "tooShort" },
        { "notes", new string('a', SessionRules.MaxNotesLength + 1), "tooLong" },
        { "tags", new[] { "ok", " " }, "invalid" },
        { "tags", new[] { new string('a', TagRules.MaxNameLength + 1) }, "tooLong" },
        { "tags", Enumerable.Range(1, TagRules.MaxTagsPerReflection + 1).Select(n => $"tag {n}").ToArray(), "tooMany" },
    };

    [Theory]
    [MemberData(nameof(BadFields))]
    public async Task Answers_a_code_for_a_field_that_breaks_a_rule_and_saves_nothing(
        string field, object? value, string code)
    {
        var (client, itemId) = await ClientWithItem();
        using var _ = client;

        var response = await Write(client, itemId, Body(body => body[field] = value));

        Assert.Equal(code, await ErrorCode(response, field));
        Assert.Empty(await SavedReflections(itemId));
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item()
    {
        var (owner, itemId) = await ClientWithItem();
        using var _ = owner;
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        var response = await Write(stranger, itemId, Body());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await SavedReflections(itemId));
    }

    [Fact]
    public async Task Answers_404_for_an_item_that_doesnt_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await Write(client, Guid.NewGuid(), Body());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
