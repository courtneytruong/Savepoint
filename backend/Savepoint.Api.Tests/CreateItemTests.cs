using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/items, adding a book or game to the signed-in person's library.</summary>
public sealed class CreateItemTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    private async Task<HttpClient> SignedInClient() => (await factory.SignedInClientAsync(cancellationToken)).Client;

    private Task<HttpResponseMessage> Create(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/items", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    // The code for each field in a 400. Read once, since a body can only be read once.
    private async Task<Dictionary<string, string[]>> ErrorCodes(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors");
        return errors.Deserialize<Dictionary<string, string[]>>()!;
    }

    private async Task<string> ErrorCode(HttpResponseMessage response, string field) =>
        Assert.Single((await ErrorCodes(response))[field]);

    [Fact]
    public async Task Answers_401_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await Create(client, new { medium = "Book", title = "Piranesi" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Creates_an_item_in_the_backlog_and_answers_with_it()
    {
        using var client = await SignedInClient();

        var response = await Create(client, new { medium = "Book", title = "  Piranesi ", creator = " Susanna Clarke " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var item = await ReadJson(response);
        var id = item.GetProperty("id").GetGuid();
        Assert.Equal($"/api/items/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal("Book", item.GetProperty("medium").GetString());
        Assert.Equal("Piranesi", item.GetProperty("title").GetString());
        Assert.Equal("Susanna Clarke", item.GetProperty("creator").GetString());
        Assert.Equal("Backlog", item.GetProperty("status").GetString());
        Assert.Equal(item.GetProperty("createdAt").GetDateTimeOffset(), item.GetProperty("statusChangedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Saves_the_item_and_its_first_status_for_the_signed_in_account()
    {
        var (client, userId) = await factory.SignedInClientAsync(cancellationToken);
        using var _ = client;

        var response = await Create(client, new { medium = "Game", title = "Hades", status = "InProgress" });
        var id = (await ReadJson(response)).GetProperty("id").GetGuid();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
        var saved = await db.Items.Include(i => i.StatusChanges).SingleAsync(i => i.Id == id, cancellationToken);
        Assert.Equal(userId, saved.UserId);
        Assert.Equal(ItemStatus.InProgress, Assert.Single(saved.StatusChanges).Status);
    }

    [Theory]
    [InlineData("Backlog")]
    [InlineData("InProgress")]
    [InlineData("Finished")]
    [InlineData("Dropped")]
    public async Task Starts_with_the_status_asked_for(string status)
    {
        using var client = await SignedInClient();

        var response = await Create(client, new { medium = "Game", title = "Outer Wilds", status });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(status, (await ReadJson(response)).GetProperty("status").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Saves_no_creator_as_null(string? creator)
    {
        using var client = await SignedInClient();

        var response = await Create(client, new { medium = "Game", title = "Tetris", creator });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ReadJson(response)).GetProperty("creator").ValueKind);
    }

    [Fact]
    public async Task Needs_a_medium_and_a_title()
    {
        using var client = await SignedInClient();

        var response = await Create(client, new { title = "  " });

        var codes = await ErrorCodes(response);
        Assert.Equal(["required"], codes["medium"]);
        Assert.Equal(["required"], codes["title"]);
    }

    [Theory]
    [InlineData("Film")]
    [InlineData("book")]
    [InlineData("0")]
    public async Task Refuses_a_medium_that_is_not_one_of_the_exact_names(string medium)
    {
        using var client = await SignedInClient();

        var response = await Create(client, new { medium, title = "Alien" });

        Assert.Equal("invalid", await ErrorCode(response, "medium"));
    }

    [Theory]
    [InlineData("Paused")]
    [InlineData("inprogress")]
    [InlineData("1")]
    public async Task Refuses_a_status_that_is_not_one_of_the_exact_names(string status)
    {
        using var client = await SignedInClient();

        var response = await Create(client, new { medium = "Book", title = "Piranesi", status });

        Assert.Equal("invalid", await ErrorCode(response, "status"));
    }

    [Fact]
    public async Task Allows_200_characters_after_trimming_and_refuses_more()
    {
        using var client = await SignedInClient();
        var longest = new string('a', LibraryRules.MaxTitleLength);

        var fits = await Create(client, new { medium = "Book", title = $" {longest} ", creator = $" {longest} " });
        var tooLong = await Create(client, new { medium = "Book", title = longest + "a", creator = longest + "a" });

        Assert.Equal(HttpStatusCode.Created, fits.StatusCode);
        var codes = await ErrorCodes(tooLong);
        Assert.Equal(["tooLong"], codes["title"]);
        Assert.Equal(["tooLong"], codes["creator"]);
    }
}
