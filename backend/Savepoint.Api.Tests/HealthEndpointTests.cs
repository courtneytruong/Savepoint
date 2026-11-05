using System.Net;

namespace Savepoint.Api.Tests;

public class HealthEndpointTests
{
    // Nothing listens on port 1, so connecting always fails.
    private const string UnreachableDatabase =
        "Host=127.0.0.1;Port=1;Database=test;Username=test;Password=test";

    [Fact]
    public async Task Returns_503_when_the_database_is_unreachable()
    {
        await using var factory = new ApiFactory(UnreachableDatabase);
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var response = await client.GetAsync("/health", cancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync(cancellationToken));
    }
}
