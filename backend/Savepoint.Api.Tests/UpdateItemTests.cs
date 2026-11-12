using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Savepoint.Api.Library;

namespace Savepoint.Api.Tests;

/// <summary>PUT /api/items/{id}, changing an item's medium, title and creator.</summary>
public sealed class UpdateItemTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<JsonElement> Create(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items",
            new { medium = "Book", title = "Piranesi", creator = "Susanna Clarke", status = "InProgress" },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    private Task<HttpResponseMessage> Update(HttpClient client, JsonElement item, object body) =>
        client.PutAsJsonAsync($"/api/items/{item.GetProperty("id")}", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    [Fact]
    public async Task Replaces_the_details_trimmed_and_answers_with_the_item()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await Update(client, created, new { medium = "Game", title = " Hades ", creator = " Supergiant " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var item = await ReadJson(response);
        Assert.Equal("Game", item.GetProperty("medium").GetString());
        Assert.Equal("Hades", item.GetProperty("title").GetString());
        Assert.Equal("Supergiant", item.GetProperty("creator").GetString());
    }

    [Fact]
    public async Task Keeps_the_status_and_when_it_was_created()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var item = await ReadJson(await Update(client, created, new { medium = "Book", title = "Piranesi (2020)" }));

        Assert.Equal("InProgress", item.GetProperty("status").GetString());
        Assert.Equal(created.GetProperty("statusChangedAt").GetRawText(), item.GetProperty("statusChangedAt").GetRawText());
        Assert.Equal(created.GetProperty("createdAt").GetRawText(), item.GetProperty("createdAt").GetRawText());
    }

    [Fact]
    public async Task Saves_the_change_so_getting_it_afterwards_agrees()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var updated = await ReadJson(await Update(client, created, new { medium = "Book", title = "The Ladies of Grace Adieu" }));
        var fetched = await ReadJson(await client.GetAsync($"/api/items/{created.GetProperty("id")}", cancellationToken));

        Assert.Equal(updated.GetRawText(), fetched.GetRawText());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public async Task Clears_the_creator_when_it_is_missing_or_empty(string? creator)
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var item = await ReadJson(await Update(client, created, new { medium = "Book", title = "Piranesi", creator }));

        Assert.Equal(JsonValueKind.Null, item.GetProperty("creator").ValueKind);
    }

    [Fact]
    public async Task Checks_the_fields_like_creating_and_changes_nothing_when_they_are_wrong()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);
        var longest = new string('a', LibraryRules.MaxCreatorLength);

        var response = await Update(client, created, new { medium = "Film", title = " ", creator = longest + "a" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var codes = (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
        Assert.Equal(["invalid"], codes["medium"]);
        Assert.Equal(["required"], codes["title"]);
        Assert.Equal(["tooLong"], codes["creator"]);
        var fetched = await ReadJson(await client.GetAsync($"/api/items/{created.GetProperty("id")}", cancellationToken));
        Assert.Equal(created.GetRawText(), fetched.GetRawText());
    }

    [Fact]
    public async Task Answers_404_and_changes_nothing_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        var (other, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        using var __ = other;
        var created = await Create(owner);

        var response = await Update(other, created, new { medium = "Game", title = "Taken over" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var fetched = await ReadJson(await owner.GetAsync($"/api/items/{created.GetProperty("id")}", cancellationToken));
        Assert.Equal("Piranesi", fetched.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Answers_404_for_an_item_that_does_not_exist()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await client.PutAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}", new { medium = "Book", title = "Nothing" }, cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}", new { medium = "Book", title = "Nothing" }, cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
