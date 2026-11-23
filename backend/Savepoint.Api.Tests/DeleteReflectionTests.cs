using System.Net;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>DELETE /api/items/{itemId}/reflections/{reflectionId}, deleting a standalone reflection.</summary>
public sealed class DeleteReflectionTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Notes = "A slow start, but the ending earned every page.";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private Task<ReflectionTestClient> NewReader() => ReflectionTestClient.CreateAsync(factory, cancellationToken);

    private Task<HttpResponseMessage> Delete(ReflectionTestClient reader, Guid reflectionId) =>
        reader.Client.DeleteAsync(reader.PathOf(reflectionId), cancellationToken);

    private static Guid IdOf(JsonElement reflection) => reflection.GetProperty("id").GetGuid();

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.DeleteAsync($"/api/items/{Guid.NewGuid()}/reflections/{Guid.NewGuid()}", cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Deletes_it_and_answers_204()
    {
        using var reader = await NewReader();
        var kept = await reader.WriteAsync("This one stays where it is.", [], cancellationToken);
        var deleted = await reader.WriteAsync(Notes, [], cancellationToken);

        var response = await Delete(reader, IdOf(deleted));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal([kept.GetProperty("notes").GetString()], await reader.SavedNotesAsync(cancellationToken));
    }

    [Fact]
    public async Task Deletes_a_tag_left_on_no_reflection_but_keeps_one_still_in_use()
    {
        using var reader = await NewReader();
        var deleted = await reader.WriteAsync(Notes, ["ending", "slow"], cancellationToken);
        await reader.WriteAsync(Notes, ["ending"], cancellationToken);

        await Delete(reader, IdOf(deleted));

        Assert.Equal(["ending"], await reader.SavedTagsAsync(cancellationToken));
    }

    [Fact]
    public async Task Answers_404_when_deleting_it_a_second_time()
    {
        using var reader = await NewReader();
        var written = await reader.WriteAsync(Notes, [], cancellationToken);
        await Delete(reader, IdOf(written));

        var response = await Delete(reader, IdOf(written));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_for_a_sessions_reflection_and_leaves_it_alone()
    {
        using var reader = await NewReader();
        var sessionReflectionId = await reader.LogSessionAsync(cancellationToken);

        var response = await Delete(reader, sessionReflectionId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(["A thought about one sitting."], await reader.SavedNotesAsync(cancellationToken));
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_reflection_and_leaves_it_alone()
    {
        using var owner = await NewReader();
        using var stranger = await NewReader();
        var written = await owner.WriteAsync(Notes, ["ending"], cancellationToken);

        var response = await stranger.Client.DeleteAsync(owner.PathOf(IdOf(written)), cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal([Notes], await owner.SavedNotesAsync(cancellationToken));
        Assert.Equal(["ending"], await owner.SavedTagsAsync(cancellationToken));
    }
}
