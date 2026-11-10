using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Accounts;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/auth/register, with the shapes agreed for the frontend.</summary>
public sealed class RegisterTests(PostgresFixture postgres) : IAsyncDisposable
{
    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // The tests share one database, so each account needs an email of its own.
    private static string NewEmail() => $"{Guid.NewGuid()}@example.com";

    private Task<HttpResponseMessage> Register(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/auth/register", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    [Fact]
    public async Task Creates_the_account_with_a_trimmed_name_and_email_and_signs_it_in()
    {
        // Cookies off, so the response's Set-Cookie header can be read directly.
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var email = NewEmail();

        var response = await Register(client, new { displayName = "  Courtney  ", email = $"  {email}  ", password = "a long password" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/auth/me", response.Headers.Location?.OriginalString);
        var account = await ReadJson(response);
        Assert.Equal("Courtney", account.GetProperty("displayName").GetString());
        Assert.Equal(email, account.GetProperty("email").GetString());
        Assert.True(Guid.TryParse(account.GetProperty("id").GetString(), out _));

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("savepoint.auth="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Keeps_spaces_in_the_password()
    {
        using var client = factory.CreateClient();
        var email = NewEmail();

        await Register(client, new { displayName = "Spaces", email, password = "  spaced out  " });

        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var user = await users.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.True(await users.CheckPasswordAsync(user, "  spaced out  "));
        Assert.False(await users.CheckPasswordAsync(user, "spaced out"));
    }

    [Fact]
    public async Task Answers_emailTaken_for_an_email_that_has_an_account_in_any_case()
    {
        using var client = factory.CreateClient();
        var email = NewEmail();
        await Register(client, new { displayName = "First", email, password = "a long password" });

        var response = await Register(client, new { displayName = "Second", email = email.ToUpperInvariant(), password = "a long password" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("emailTaken", (await ReadJson(response)).GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("", "name@example.com", "a long password", "displayName", "required")]
    [InlineData("   ", "name@example.com", "a long password", "displayName", "required")]
    [InlineData("This name is far too long for Savepoint to accept!!", "name@example.com", "a long password", "displayName", "tooLong")]
    [InlineData("Name", "", "a long password", "email", "required")]
    [InlineData("Name", "not an email", "a long password", "email", "invalid")]
    [InlineData("Name", "name@example.com", "", "password", "required")]
    [InlineData("Name", "name@example.com", "eleven char", "password", "tooShort")]
    public async Task Answers_a_code_for_each_field_that_breaks_a_rule(
        string displayName, string email, string password, string field, string code)
    {
        using var client = factory.CreateClient();

        var response = await Register(client, new { displayName, email, password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors");
        Assert.Equal(code, errors.GetProperty(field)[0].GetString());
    }

    [Fact]
    public async Task Refuses_an_email_or_password_over_its_maximum_length()
    {
        using var client = factory.CreateClient();
        var longEmail = new string('a', AccountRules.MaxEmailLength - "@example.com".Length + 1) + "@example.com";
        var longPassword = new string('p', AccountRules.MaxPasswordLength + 1);

        var response = await Register(client, new { displayName = "Name", email = longEmail, password = longPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors");
        Assert.Equal("tooLong", errors.GetProperty("email")[0].GetString());
        Assert.Equal("tooLong", errors.GetProperty("password")[0].GetString());
    }

    [Fact]
    public async Task Answers_required_for_fields_missing_from_the_request()
    {
        using var client = factory.CreateClient();

        var response = await Register(client, new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors");
        Assert.Equal("required", errors.GetProperty("displayName")[0].GetString());
        Assert.Equal("required", errors.GetProperty("email")[0].GetString());
        Assert.Equal("required", errors.GetProperty("password")[0].GetString());
    }
}
