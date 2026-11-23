using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/items/{itemId}/reflections, an item's standalone reflections.</summary>
public sealed class ListReflectionsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<Guid> CreateItem(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    // Writes a standalone reflection, with notes that say which it is.
    private async Task Write(HttpClient client, Guid itemId, string notes, params string[] tags)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/reflections", new { mood = "Moved", notes, tags }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private Task<HttpResponseMessage> List(HttpClient client, Guid itemId) =>
        client.GetAsync($"/api/items/{itemId}/reflections", cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<JsonElement[]> ListOk(HttpClient client, Guid itemId)
    {
        var response = await List(client, itemId);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return [.. (await ReadJson(response)).EnumerateArray()];
    }

    private static string? NotesOf(JsonElement reflection) => reflection.GetProperty("notes").GetString();

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await List(client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Answers_an_empty_list_for_an_item_with_none()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        Assert.Empty(await ListOk(client, await CreateItem(client)));
    }

    [Fact]
    public async Task Answers_with_each_reflection_and_its_tags_newest_first()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        await Write(client, itemId, "The first thought, written first.");
        await Write(client, itemId, "The second thought, written last.", "Space", "cozy");

        var reflections = await ListOk(client, itemId);

        Assert.Equal(["The second thought, written last.", "The first thought, written first."], reflections.Select(NotesOf));
        var newest = reflections[0];
        Assert.Equal("Moved", newest.GetProperty("mood").GetString());
        Assert.Equal(["cozy", "Space"], newest.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        Assert.Equal(newest.GetProperty("createdAt").GetDateTimeOffset(), newest.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Leaves_out_the_reflections_of_sessions()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        await Write(client, itemId, "A thought about the whole book.");
        var session = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/sessions",
            new
            {
                date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1).ToString("yyyy-MM-dd"),
                durationMinutes = 30,
                reflection = new { mood = "Curious", notes = "A thought about one sitting." },
            },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, session.StatusCode);

        var reflection = Assert.Single(await ListOk(client, itemId));

        Assert.Equal("A thought about the whole book.", NotesOf(reflection));
    }

    [Fact]
    public async Task Lists_only_that_items_reflections()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var otherId = await CreateItem(client);
        await Write(client, itemId, "This one is about the item.");
        await Write(client, otherId, "This one is about another.");

        var reflection = Assert.Single(await ListOk(client, itemId));

        Assert.Equal("This one is about the item.", NotesOf(reflection));
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var itemId = await CreateItem(owner);
        await Write(owner, itemId, "Private thoughts about it.");
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
