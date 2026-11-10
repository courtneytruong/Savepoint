using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tests;

/// <summary>Checks the API against a real database.</summary>
public class DatabaseTests(PostgresFixture postgres)
{
    [Fact]
    public async Task Applies_every_migration_on_startup()
    {
        // An empty database of its own, because the shared one is already migrated.
        var emptyDatabase = await postgres.CreateEmptyDatabaseAsync();
        await using var factory = new ApiFactory(emptyDatabase, migrateOnStartup: true);
        // The API starts, and so migrates, the first time a client is requested.
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();

        Assert.Empty(await db.Database.GetPendingMigrationsAsync(cancellationToken));
        // A query on Users only works if the migration really created the table.
        Assert.Equal(0, await db.Users.CountAsync(cancellationToken));
    }

    [Fact]
    public async Task Health_is_healthy_when_the_database_is_reachable()
    {
        await using var factory = new ApiFactory(postgres.ConnectionString);
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var response = await client.GetAsync("/health", cancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(cancellationToken));
    }
}
