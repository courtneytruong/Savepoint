using System.Net;
using System.Net.Http.Json;

namespace Savepoint.Api.Tests;

/// <summary>GET /api/tags, the signed-in person's tag names for suggestions.</summary>
public sealed class ListTagsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // Logs a session on a new item, with these tags on its reflection.
    private async Task LogWithTags(HttpClient client, params string[] tags)
    {
        var item = await client.PostAsJsonAsync("/api/items", new { medium = "Game", title = "Outer Wilds" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, item.StatusCode);
        var itemId = (await item.Content.ReadFromJsonAsync<IdOnly>(cancellationToken))!.Id;

        var session = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/sessions",
            new
            {
                date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1).ToString("yyyy-MM-dd"),
                durationMinutes = 60,
                reflection = new { mood = "Curious", notes = "The quantum moon keeps slipping away.", tags },
            },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, session.StatusCode);
    }

    private sealed record IdOnly(Guid Id);

    private async Task<string[]> ListOk(HttpClient client)
    {
        var response = await client.GetAsync("/api/tags", cancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<string[]>(cancellationToken))!;
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/tags", cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Answers_an_empty_list_for_someone_with_no_tags()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        Assert.Empty(await ListOk(client));
    }

    [Fact]
    public async Task Lists_each_tag_once_in_order_ignoring_case_and_accents()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        await LogWithTags(client, "Space", "Épique");
        await LogWithTags(client, "cozy", "space");

        Assert.Equal(["cozy", "Épique", "Space"], await ListOk(client));
    }

    [Fact]
    public async Task Lists_only_the_signed_in_persons_tags()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;
        await LogWithTags(owner, "Private");
        await LogWithTags(stranger, "Mine");

        Assert.Equal(["Mine"], await ListOk(stranger));
    }
}
