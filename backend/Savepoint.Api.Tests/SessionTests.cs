using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Savepoint.Api.Tests;

/// <summary>
/// GET /api/auth/me and POST /api/auth/sign-out. The client keeps cookies like a
/// browser, so these also prove the cookie from signing in really works.
/// </summary>
public sealed class SessionTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Password = "a long password";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // The tests share one database, so each account needs an email of its own.
    private static string NewEmail() => $"{Guid.NewGuid()}@example.com";

    private async Task<HttpResponseMessage> Register(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/register", new { displayName = "Reader", email, password = Password }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return response;
    }

    private Task<HttpResponseMessage> Me(HttpClient client) => client.GetAsync("/api/auth/me", cancellationToken);

    private Task<HttpResponseMessage> SignOut(HttpClient client) =>
        client.PostAsync("/api/auth/sign-out", content: null, cancellationToken);

    [Fact]
    public async Task Me_answers_401_with_problem_details_when_not_signed_in()
    {
        using var client = factory.CreateClient();

        var response = await Me(client);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Me_answers_with_the_account_after_registering()
    {
        using var client = factory.CreateClient();
        var email = NewEmail();
        await Register(client, email);

        var response = await Me(client);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        Assert.Equal("Reader", account.GetProperty("displayName").GetString());
        Assert.Equal(email, account.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Me_answers_with_the_account_after_signing_in()
    {
        var email = NewEmail();
        using (var registering = factory.CreateClient()) await Register(registering, email);
        // A new client, so it has no cookie until it signs in.
        using var client = factory.CreateClient();

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new { email, password = Password }, cancellationToken);
        var response = await Me(client);

        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Signing_out_deletes_the_cookie_so_me_answers_401()
    {
        using var client = factory.CreateClient();
        await Register(client, NewEmail());

        var signOut = await SignOut(client);
        var response = await Me(client);

        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Signing_out_when_not_signed_in_is_not_an_error()
    {
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        var response = await SignOut(client);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
