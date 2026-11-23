using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Tags;

namespace Savepoint.Api.Tests;

/// <summary>
/// Tags on a session's reflection, through POST and PUT /api/items/{itemId}/sessions,
/// and their tidying when sessions and items are edited or deleted.
/// </summary>
public sealed class SessionTagsTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Notes = "The crossing of the ice stayed with me.";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private static string Yesterday => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1).ToString("yyyy-MM-dd");

    private sealed record Reader(HttpClient Client, Guid UserId, Guid ItemId) : IDisposable
    {
        public void Dispose() => Client.Dispose();
    }

    private async Task<Reader> NewReader()
    {
        var (client, userId) = await factory.SignedInClientAsync(cancellationToken);
        return new Reader(client, userId, await CreateItem(client));
    }

    private async Task<Guid> CreateItem(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/items", new { medium = "Book", title = "Piranesi" }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    // tags is sent as given, so null leaves the field out.
    private static object Body(object? tags, string notes = Notes)
    {
        var reflection = new Dictionary<string, object?> { ["mood"] = "Moved", ["notes"] = notes };
        if (tags is not null) reflection["tags"] = tags;
        return new { date = Yesterday, durationMinutes = 45, reflection };
    }

    private Task<HttpResponseMessage> Log(Reader reader, object? tags, Guid? itemId = null) =>
        reader.Client.PostAsJsonAsync($"/api/items/{itemId ?? reader.ItemId}/sessions", Body(tags), cancellationToken);

    private async Task<JsonElement> LogOk(Reader reader, object? tags, Guid? itemId = null)
    {
        var response = await Log(reader, tags, itemId);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJson(response);
    }

    private Task<HttpResponseMessage> Edit(Reader reader, JsonElement session, object? tags, string notes = Notes) =>
        reader.Client.PutAsJsonAsync(
            $"/api/items/{session.GetProperty("itemId").GetGuid()}/sessions/{session.GetProperty("id").GetGuid()}",
            Body(tags, notes),
            cancellationToken);

    private async Task<JsonElement> EditOk(Reader reader, JsonElement session, object? tags)
    {
        var response = await Edit(reader, session, tags);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJson(response);
    }

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private static string?[] TagsOf(JsonElement session) =>
        [.. session.GetProperty("reflection").GetProperty("tags").EnumerateArray().Select(t => t.GetString())];

    private static DateTimeOffset ReflectionUpdatedAt(JsonElement session) =>
        session.GetProperty("reflection").GetProperty("updatedAt").GetDateTimeOffset();

    private async Task<string> TagsErrorCode(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
        return Assert.Single(errors["reflection.tags"]);
    }

    // The names of the user's tags in the database, in order.
    private async Task<string[]> SavedTags(Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        return await db.Tags.Where(t => t.UserId == userId).OrderBy(t => t.NormalizedName).Select(t => t.Name)
            .ToArrayAsync(cancellationToken);
    }

    [Fact]
    public async Task Logs_a_session_with_new_tags()
    {
        using var reader = await NewReader();

        var session = await LogOk(reader, new[] { "Space", "cozy" });

        Assert.Equal(["cozy", "Space"], TagsOf(session));
        Assert.Equal(["cozy", "Space"], await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Logs_a_session_with_no_tags_when_they_are_missing_or_empty()
    {
        using var reader = await NewReader();

        Assert.Empty(TagsOf(await LogOk(reader, tags: null)));
        Assert.Empty(TagsOf(await LogOk(reader, Array.Empty<string>())));
        Assert.Empty(await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Cleans_the_spaces_in_a_name()
    {
        using var reader = await NewReader();

        var session = await LogOk(reader, new[] { "  found \t  family  " });

        Assert.Equal(["found family"], TagsOf(session));
    }

    [Fact]
    public async Task Reuses_a_tag_ignoring_case_and_accents_and_keeps_its_first_spelling()
    {
        using var reader = await NewReader();
        await LogOk(reader, new[] { "Cozy" });

        var session = await LogOk(reader, new[] { "cózy" });

        Assert.Equal(["Cozy"], TagsOf(session));
        Assert.Equal(["Cozy"], await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Merges_names_in_one_request_that_are_the_same_tag()
    {
        using var reader = await NewReader();

        var session = await LogOk(reader, new[] { "Cozy", "COZY", "cózy" });

        Assert.Equal(["Cozy"], TagsOf(session));
    }

    [Fact]
    public async Task Keeps_each_persons_tags_their_own()
    {
        using var owner = await NewReader();
        using var stranger = await NewReader();
        await LogOk(owner, new[] { "Cozy" });

        // The stranger's own spelling, so it's a tag of theirs, not the owner's.
        Assert.Equal(["cozy"], TagsOf(await LogOk(stranger, new[] { "cozy" })));
        Assert.Equal(["Cozy"], await SavedTags(owner.UserId));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Answers_invalid_for_an_empty_name(string? name)
    {
        using var reader = await NewReader();

        var response = await Log(reader, new[] { "Space", name });

        Assert.Equal("invalid", await TagsErrorCode(response));
        Assert.Empty(await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Answers_tooLong_for_a_name_over_40_characters()
    {
        using var reader = await NewReader();

        var response = await Log(reader, new[] { new string('a', TagRules.MaxNameLength + 1) });

        Assert.Equal("tooLong", await TagsErrorCode(response));
    }

    [Fact]
    public async Task Allows_a_name_of_40_characters_counting_an_emoji_as_one()
    {
        using var reader = await NewReader();
        // 40 characters to the database, though C# counts each emoji as two.
        var name = string.Concat(Enumerable.Repeat("🌙", TagRules.MaxNameLength));

        Assert.Equal([name], TagsOf(await LogOk(reader, new[] { name })));
    }

    [Fact]
    public async Task Answers_tooMany_for_more_than_10_tags()
    {
        using var reader = await NewReader();
        var names = Enumerable.Range(1, TagRules.MaxTagsPerReflection + 1).Select(n => $"tag {n}").ToArray();

        var response = await Log(reader, names);

        Assert.Equal("tooMany", await TagsErrorCode(response));
        Assert.Empty(await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Allows_10_tags_counting_the_same_tag_once()
    {
        using var reader = await NewReader();
        var names = Enumerable.Range(1, TagRules.MaxTagsPerReflection).Select(n => $"tag {n}").Append("TAG 1").ToArray();

        Assert.Equal(TagRules.MaxTagsPerReflection, TagsOf(await LogOk(reader, names)).Length);
    }

    [Fact]
    public async Task Editing_replaces_the_tags_and_marks_the_reflection_edited()
    {
        using var reader = await NewReader();
        var session = await LogOk(reader, new[] { "Space", "cozy" });

        var edited = await EditOk(reader, session, new[] { "cozy", "Mystery" });

        Assert.Equal(["cozy", "Mystery"], TagsOf(edited));
        Assert.True(ReflectionUpdatedAt(edited) > ReflectionUpdatedAt(session));
    }

    [Fact]
    public async Task Editing_with_the_same_tags_in_another_order_or_case_changes_nothing()
    {
        using var reader = await NewReader();
        var session = await LogOk(reader, new[] { "Space", "cozy" });

        var edited = await EditOk(reader, session, new[] { "COZY", "space" });

        Assert.Equal(["cozy", "Space"], TagsOf(edited));
        Assert.Equal(ReflectionUpdatedAt(session), ReflectionUpdatedAt(edited));
    }

    [Fact]
    public async Task Editing_with_tags_missing_removes_them()
    {
        using var reader = await NewReader();
        var session = await LogOk(reader, new[] { "Space" });

        Assert.Empty(TagsOf(await EditOk(reader, session, tags: null)));
    }

    [Fact]
    public async Task Editing_deletes_a_tag_left_on_no_reflection_but_keeps_one_still_in_use()
    {
        using var reader = await NewReader();
        var session = await LogOk(reader, new[] { "Space", "cozy" });
        await LogOk(reader, new[] { "cozy" });

        await EditOk(reader, session, Array.Empty<string>());

        Assert.Equal(["cozy"], await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task A_refused_edit_leaves_the_tags_as_they_were()
    {
        using var reader = await NewReader();
        var session = await LogOk(reader, new[] { "Space" });

        var response = await Edit(reader, session, new[] { "Mystery" }, notes: "Too short.");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Space"], await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Deleting_a_session_deletes_tags_left_on_no_reflection()
    {
        using var reader = await NewReader();
        var session = await LogOk(reader, new[] { "Space", "cozy" });
        await LogOk(reader, new[] { "cozy" });

        var response = await reader.Client.DeleteAsync(
            $"/api/items/{reader.ItemId}/sessions/{session.GetProperty("id").GetGuid()}", cancellationToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(["cozy"], await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Deleting_an_item_deletes_tags_left_on_no_reflection()
    {
        using var reader = await NewReader();
        var otherItemId = await CreateItem(reader.Client);
        await LogOk(reader, new[] { "Space", "cozy" });
        await LogOk(reader, new[] { "cozy" }, otherItemId);

        var response = await reader.Client.DeleteAsync($"/api/items/{reader.ItemId}", cancellationToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(["cozy"], await SavedTags(reader.UserId));
    }

    [Fact]
    public async Task Deleting_someone_elses_session_leaves_their_tags_alone()
    {
        using var owner = await NewReader();
        using var stranger = await NewReader();
        var session = await LogOk(owner, new[] { "Space" });

        var response = await stranger.Client.DeleteAsync(
            $"/api/items/{owner.ItemId}/sessions/{session.GetProperty("id").GetGuid()}", cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(["Space"], await SavedTags(owner.UserId));
    }
}
