using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Accounts;

namespace Savepoint.Api.Tests;

/// <summary>POST /api/auth/sign-in, with the shapes agreed for the frontend.</summary>
public sealed class SignInTests(PostgresFixture postgres) : IAsyncDisposable
{
    private const string Password = "a long password";

    private readonly ApiFactory factory = new(postgres.ConnectionString);
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    // The tests share one database, so each account needs an email of its own.
    private async Task<string> CreateAccount()
    {
        var email = $"{Guid.NewGuid()}@example.com";
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var result = await users.CreateAsync(new User { DisplayName = "Reader", Email = email, UserName = email }, Password);
        Assert.True(result.Succeeded);
        return email;
    }

    private Task<HttpResponseMessage> SignIn(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/auth/sign-in", body, cancellationToken);

    private async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);

    private async Task<string?> ErrorOf(HttpResponseMessage response) =>
        (await ReadJson(response)).GetProperty("error").GetString();

    [Fact]
    public async Task Signs_in_with_the_email_in_any_case_and_sets_the_cookie()
    {
        var email = await CreateAccount();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        var response = await SignIn(client, new { email = $"  {email.ToUpperInvariant()}  ", password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var account = await ReadJson(response);
        Assert.Equal("Reader", account.GetProperty("displayName").GetString());
        Assert.Equal(email, account.GetProperty("email").GetString());
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("savepoint.auth="));
    }

    [Fact]
    public async Task Answers_unknownEmail_when_no_account_uses_it()
    {
        using var client = factory.CreateClient();

        var response = await SignIn(client, new { email = $"{Guid.NewGuid()}@example.com", password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("unknownEmail", await ErrorOf(response));
    }

    [Fact]
    public async Task Answers_wrongPassword_without_setting_a_cookie()
    {
        var email = await CreateAccount();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        var response = await SignIn(client, new { email, password = "not the password" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("wrongPassword", await ErrorOf(response));
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Pauses_for_5_minutes_from_the_5th_wrong_password_even_for_the_right_one()
    {
        var email = await CreateAccount();
        using var client = factory.CreateClient();

        for (var attempt = 1; attempt < AccountRules.MaxFailedSignIns; attempt++)
        {
            var wrong = await SignIn(client, new { email, password = "not the password" });
            Assert.Equal("wrongPassword", await ErrorOf(wrong));
        }
        var fifth = await SignIn(client, new { email, password = "not the password" });

        Assert.Equal(HttpStatusCode.TooManyRequests, fifth.StatusCode);
        var body = await ReadJson(fifth);
        Assert.Equal("tooManyTries", body.GetProperty("error").GetString());
        Assert.InRange(body.GetProperty("retryAfterSeconds").GetInt32(), 290, 300);
        Assert.Equal(body.GetProperty("retryAfterSeconds").GetInt32().ToString(), fifth.Headers.GetValues("Retry-After").Single());

        var right = await SignIn(client, new { email, password = Password });
        Assert.Equal(HttpStatusCode.TooManyRequests, right.StatusCode);
    }

    [Fact]
    public async Task Signing_in_starts_the_count_of_wrong_passwords_again()
    {
        var email = await CreateAccount();
        using var client = factory.CreateClient();
        async Task WrongPasswords(int count)
        {
            for (var attempt = 0; attempt < count; attempt++) await SignIn(client, new { email, password = "not the password" });
        }

        await WrongPasswords(AccountRules.MaxFailedSignIns - 1);
        await SignIn(client, new { email, password = Password });
        await WrongPasswords(AccountRules.MaxFailedSignIns - 2);
        var response = await SignIn(client, new { email, password = "not the password" });

        Assert.Equal("wrongPassword", await ErrorOf(response));
    }

    [Theory]
    [InlineData(null, null, "email", "required")]
    [InlineData("not an email", "a long password", "email", "invalid")]
    [InlineData("name@example.com", "", "password", "required")]
    public async Task Answers_a_code_for_each_field_that_cant_be_tried(
        string? email, string? password, string field, string code)
    {
        using var client = factory.CreateClient();

        var response = await SignIn(client, new { email, password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, (await ReadJson(response)).GetProperty("errors").GetProperty(field)[0].GetString());
    }
}
