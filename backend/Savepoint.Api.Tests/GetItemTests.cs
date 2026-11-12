using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/items/{id}, one item from the signed-in person's library.</summary>
public sealed class GetItemTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<JsonElement> Create(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items",
            new { medium = "Game", title = "Hades", creator = "Supergiant Games", status = "InProgress" },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    [Fact]
    public async Task Answers_with_the_item_as_it_was_created()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var created = await Create(client);

        var response = await client.GetAsync($"/api/items/{created.GetProperty("id")}", cancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var item = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        // The same JSON as creating gave, field for field.
        Assert.Equal(created.GetRawText(), item.GetRawText());
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_item_the_same_as_for_none()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        var (other, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        using var __ = other;
        var id = (await Create(owner)).GetProperty("id");

        var theirs = await other.GetAsync($"/api/items/{id}", cancellationToken);
        var missing = await other.GetAsync($"/api/items/{Guid.NewGuid()}", cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, theirs.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        // Problem Details, like every other error.
        Assert.Equal("application/problem+json", theirs.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Answers_404_for_an_id_that_is_not_a_guid()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await client.GetAsync("/api/items/not-an-id", cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync($"/api/items/{Guid.NewGuid()}", cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
