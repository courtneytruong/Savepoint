using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Savepoint.Api.Tests;

/// <summary>Signed-in clients for tests of endpoints that need an account.</summary>
public static class TestAccounts
{
    /// <summary>
    /// A client signed in as a new account of its own, since the tests share one
    /// database. It keeps the cookie like a browser, and knows the account's id.
    /// </summary>
    public static async Task<(HttpClient Client, Guid UserId)> SignedInClientAsync(
        this ApiFactory factory, CancellationToken cancellationToken)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { displayName = "Reader", email = $"{Guid.NewGuid()}@example.com", password = "a long password" },
            cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken);
        return (client, account.GetProperty("id").GetGuid());
    }
}
