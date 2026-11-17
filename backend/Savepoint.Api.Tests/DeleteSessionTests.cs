using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tests;

/// <summary>DELETE /api/items/{itemId}/sessions/{sessionId}, deleting a session and its reflection.</summary>
public sealed class DeleteSessionTests(PostgresFixture postgres) : IAsyncDisposable
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

    private async Task<Guid> Log(HttpClient client, Guid itemId)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{itemId}/sessions",
            new
            {
                date = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
                durationMinutes = 30,
                pagesRead = 12,
                reflection = new { mood = "Curious", notes = "The house has its own tides." },
            },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private Task<HttpResponseMessage> Delete(HttpClient client, Guid itemId, Guid sessionId) =>
        client.DeleteAsync($"/api/items/{itemId}/sessions/{sessionId}", cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    // Straight from the database, so a reflection left behind would show.
    private async Task<(bool Session, bool Reflection)> StillSaved(Guid sessionId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return (
            await db.Sessions.AnyAsync(s => s.Id == sessionId, cancellationToken),
            await db.Reflections.AnyAsync(r => r.SessionId == sessionId, cancellationToken));
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await Delete(client, Guid.NewGuid(), Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Deletes_the_session_and_its_reflection()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var sessionId = await Log(client, itemId);

        var response = await Delete(client, itemId, sessionId);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal((false, false), await StillSaved(sessionId));
    }

    [Fact]
    public async Task Leaves_the_items_other_sessions()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var deletedId = await Log(client, itemId);
        var keptId = await Log(client, itemId);

        await Delete(client, itemId, deletedId);

        var sessions = await ReadJson(await client.GetAsync($"/api/items/{itemId}/sessions", cancellationToken));
        Assert.Equal(keptId, Assert.Single(sessions.EnumerateArray()).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Answers_404_when_deleting_it_a_second_time()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var sessionId = await Log(client, itemId);
        await Delete(client, itemId, sessionId);

        var response = await Delete(client, itemId, sessionId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_and_deletes_nothing_for_someone_elses_session()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        var itemId = await CreateItem(owner);
        var sessionId = await Log(owner, itemId);
        var (stranger, _) = await factory.SignedInClientAsync(cancellationToken);
        using var __ = stranger;

        var response = await Delete(stranger, itemId, sessionId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal((true, true), await StillSaved(sessionId));
    }

    [Fact]
    public async Task Answers_404_and_deletes_nothing_when_the_session_is_another_items()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var itemId = await CreateItem(client);
        var otherItemId = await CreateItem(client);
        var sessionId = await Log(client, itemId);

        var response = await Delete(client, otherItemId, sessionId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal((true, true), await StillSaved(sessionId));
    }
}
