using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>PUT /api/items/{itemId}/reflections/{reflectionId}, editing a standalone reflection.</summary>
public sealed class UpdateReflectionTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Notes = "A slow start, but the ending earned every page.";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private Task<ReflectionTestClient> NewReader() => ReflectionTestClient.CreateAsync(factory, cancellationToken);

    private Task<JsonElement> Write(ReflectionTestClient reader, params string[] tags) =>
        reader.WriteAsync(Notes, tags, cancellationToken);

    private static object Body(string mood = "Delighted", string notes = Notes, params string[] tags) =>
        new { mood, notes, tags };

    private Task<HttpResponseMessage> Update(ReflectionTestClient reader, Guid reflectionId, object body, Guid? itemId = null) =>
        reader.Client.PutAsJsonAsync(reader.PathOf(reflectionId, itemId), body, cancellationToken);

    private async Task<JsonElement> UpdateOk(ReflectionTestClient reader, JsonElement reflection, object body)
    {
        var response = await Update(reader, IdOf(reflection), body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
    }

    private static Guid IdOf(JsonElement reflection) => reflection.GetProperty("id").GetGuid();

    private static DateTimeOffset Time(JsonElement reflection, string name) => reflection.GetProperty(name).GetDateTimeOffset();

    private static string?[] TagsOf(JsonElement reflection) =>
        [.. reflection.GetProperty("tags").EnumerateArray().Select(t => t.GetString())];

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/items/{Guid.NewGuid()}/reflections/{Guid.NewGuid()}", Body(), cancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Replaces_the_mood_notes_and_tags_and_marks_it_edited()
    {
        using var reader = await NewReader();
        var written = await Write(reader, "ending", "slow");

        var edited = await UpdateOk(reader, written, Body("Delighted", "  Better on a second read, honestly.  ", "ending", "Reread"));

        Assert.Equal(IdOf(written), IdOf(edited));
        Assert.Equal("Delighted", edited.GetProperty("mood").GetString());
        Assert.Equal("Better on a second read, honestly.", edited.GetProperty("notes").GetString());
        Assert.Equal(["ending", "Reread"], TagsOf(edited));
        Assert.Equal(Time(written, "createdAt"), Time(edited, "createdAt"));
        Assert.True(Time(edited, "updatedAt") > Time(edited, "createdAt"));
    }

    [Fact]
    public async Task Changes_nothing_when_sent_the_same_with_tags_in_another_order_or_case()
    {
        using var reader = await NewReader();
        var written = await Write(reader, "ending", "Slow");

        var edited = await UpdateOk(reader, written, Body("Moved", Notes, "slow", "ENDING"));

        Assert.Equal(["ending", "Slow"], TagsOf(edited));
        Assert.Equal(Time(written, "updatedAt"), Time(edited, "updatedAt"));
    }

    [Fact]
    public async Task Answers_as_the_item_lists_it_afterwards()
    {
        using var reader = await NewReader();
        var written = await Write(reader);

        var edited = await UpdateOk(reader, written, Body(tags: "ending"));

        var listed = await reader.Client.GetFromJsonAsync<JsonElement>($"/api/items/{reader.ItemId}/reflections", cancellationToken);
        Assert.Equal(edited.GetRawText(), Assert.Single(listed.EnumerateArray()).GetRawText());
    }

    [Fact]
    public async Task Deletes_a_tag_left_on_no_reflection_but_keeps_one_still_in_use()
    {
        using var reader = await NewReader();
        var written = await Write(reader, "ending", "slow");
        await Write(reader, "ending");

        await UpdateOk(reader, written, Body());

        Assert.Equal(["ending"], await reader.SavedTagsAsync(cancellationToken));
    }

    [Theory]
    [InlineData("mood", "Sleepy", "invalid")]
    [InlineData("notes", "Too short.", "tooShort")]
    public async Task Answers_a_code_for_a_field_that_breaks_a_rule_and_changes_nothing(string field, string value, string code)
    {
        using var reader = await NewReader();
        var written = await Write(reader, "ending");
        var body = new Dictionary<string, object> { ["mood"] = "Delighted", ["notes"] = Notes, ["tags"] = new[] { "new" } };
        body[field] = value;

        var response = await Update(reader, IdOf(written), body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken))
            .GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
        Assert.Equal(code, Assert.Single(errors[field]));
        Assert.Equal(["ending"], await reader.SavedTagsAsync(cancellationToken));
    }

    [Fact]
    public async Task Answers_404_for_a_sessions_reflection_which_is_edited_with_its_session()
    {
        using var reader = await NewReader();
        var sessionReflectionId = await reader.LogSessionAsync(cancellationToken);

        var response = await Update(reader, sessionReflectionId, Body());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(["A thought about one sitting."], await reader.SavedNotesAsync(cancellationToken));
    }

    [Fact]
    public async Task Answers_404_for_a_reflection_about_another_item()
    {
        using var reader = await NewReader();
        var written = await Write(reader);
        var otherItem = await reader.Client.PostAsJsonAsync("/api/items", new { medium = "Game", title = "Outer Wilds" }, cancellationToken);
        var otherItemId = (await otherItem.Content.ReadFromJsonAsync<JsonElement>(cancellationToken)).GetProperty("id").GetGuid();

        var response = await Update(reader, IdOf(written), Body(), otherItemId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_for_someone_elses_reflection_and_changes_nothing()
    {
        using var owner = await NewReader();
        using var stranger = await NewReader();
        var written = await Write(owner);

        var response = await stranger.Client.PutAsJsonAsync(owner.PathOf(IdOf(written)), Body(notes: "Not my thought to change."), cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal([Notes], await owner.SavedNotesAsync(cancellationToken));
    }

    [Fact]
    public async Task Answers_404_for_a_reflection_that_doesnt_exist()
    {
        using var reader = await NewReader();

        var response = await Update(reader, Guid.NewGuid(), Body());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
