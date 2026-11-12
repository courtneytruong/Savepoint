using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tests;

/// <summary>DELETE /api/items/{id}, removing an item and its history.</summary>
public sealed class DeleteItemTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // An item with more than one status change, so deleting it has history to remove.
    private async Task<Guid> CreateWithHistory(HttpClient client)
    {
        var response = await client.PostAsJsonAsync(
            "/api/items", new { medium = "Game", title = "Hades" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken)).GetProperty("id").GetGuid();
        var changed = await client.PostAsJsonAsync($"/api/items/{id}/status", new { status = "InProgress" }, cancellationToken);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        return id;
    }

    private Task<HttpResponseMessage> Delete(HttpClient client, Guid id) =>
        client.DeleteAsync($"/api/items/{id}", cancellationToken);

    // Whether the item and its status changes are still in the database.
    private async Task<(bool Item, bool History)> StillSaved(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return (
            await db.Items.AnyAsync(i => i.Id == id, cancellationToken),
            await db.StatusChanges.AnyAsync(s => s.ItemId == id, cancellationToken));
    }

    [Fact]
    public async Task Deletes_the_item_and_its_history_and_answers_204()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var id = await CreateWithHistory(client);

        var response = await Delete(client, id);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal((false, false), await StillSaved(id));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/items/{id}", cancellationToken)).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<JsonElement>("/api/items", cancellationToken)).EnumerateArray());
    }

    [Fact]
    public async Task Leaves_the_other_items_alone()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var deleted = await CreateWithHistory(client);
        var kept = await CreateWithHistory(client);

        await Delete(client, deleted);

        Assert.Equal((true, true), await StillSaved(kept));
    }

    [Fact]
    public async Task Answers_404_when_deleting_the_same_item_again()
    {
        var (client, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;
        var id = await CreateWithHistory(client);
        await Delete(client, id);

        var again = await Delete(client, id);

        Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
    }

    [Fact]
    public async Task Answers_404_and_deletes_nothing_for_someone_elses_item()
    {
        var (owner, _) = await factory.SignedInClientAsync(cancellationToken);
        var (other, _) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = owner;
        using var __ = other;
        var id = await CreateWithHistory(owner);

        var response = await Delete(other, id);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal((true, true), await StillSaved(id));
    }

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await Delete(client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
