using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tests;

/// <summary>
/// A signed-in person with an item, for tests that edit and delete reflections:
/// writing standalone ones and logging sessions, and reading what was saved.
/// </summary>
public sealed class ReflectionTestClient(ApiFactory factory, HttpClient client, Guid userId, Guid itemId) : IDisposable
{
    public HttpClient Client => client;

    public Guid UserId => userId;

    public Guid ItemId => itemId;

    public static async Task<ReflectionTestClient> CreateAsync(ApiFactory factory, CancellationToken cancellationToken)
    {
        var (client, userId) = await factory.SignedInClientAsync(cancellationToken);
        var item = await client.PostAsJsonAsync("/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, item.StatusCode);
        var itemId = (await item.Content.ReadFromJsonAsync<JsonElement>(cancellationToken)).GetProperty("id").GetGuid();
        return new ReflectionTestClient(factory, client, userId, itemId);
    }

    public void Dispose() => client.Dispose();

    public string PathOf(Guid reflectionId, Guid? itemId = null) =>
        $"/api/items/{itemId ?? ItemId}/reflections/{reflectionId}";

    /// <summary>Writes a standalone reflection about the item, answering with it.</summary>
    public async Task<JsonElement> WriteAsync(
        string notes, string[] tags, CancellationToken cancellationToken, Guid? itemId = null)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{itemId ?? ItemId}/reflections", new { mood = "Moved", notes, tags }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    /// <summary>Logs a session of the item, answering with its reflection's id.</summary>
    public async Task<Guid> LogSessionAsync(CancellationToken cancellationToken)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/items/{ItemId}/sessions",
            new
            {
                date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1).ToString("yyyy-MM-dd"),
                durationMinutes = 30,
                reflection = new { mood = "Curious", notes = "A thought about one sitting.", tags = new[] { "sitting" } },
            },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        return session.GetProperty("reflection").GetProperty("id").GetGuid();
    }

    /// <summary>The notes of every reflection about the item, sessions' included, oldest first.</summary>
    public async Task<string[]> SavedNotesAsync(CancellationToken cancellationToken)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return await db.Reflections.Where(r => r.ItemId == ItemId).OrderBy(r => r.CreatedAt).Select(r => r.Notes)
            .ToArrayAsync(cancellationToken);
    }

    /// <summary>The names of the person's tags in the database, in order.</summary>
    public async Task<string[]> SavedTagsAsync(CancellationToken cancellationToken)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return await db.Tags.Where(t => t.UserId == UserId).OrderBy(t => t.NormalizedName).Select(t => t.Name)
            .ToArrayAsync(cancellationToken);
    }
}
