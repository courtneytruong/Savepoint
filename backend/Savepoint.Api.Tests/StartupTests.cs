namespace Savepoint.Api.Tests;

public class StartupTests
{
    [Fact]
    public async Task Refuses_to_start_without_a_connection_string()
    {
        await using var factory = new ApiFactory(connectionString: "");

        // The API starts the first time a client is requested.
        var exception = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());

        Assert.Contains("Connection string 'Savepoint' is missing", exception.Message);
    }
}
