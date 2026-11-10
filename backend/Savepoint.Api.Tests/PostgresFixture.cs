using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(Savepoint.Api.Tests.PostgresFixture))]

namespace Savepoint.Api.Tests;

/// <summary>
/// A real PostgreSQL in a Docker container, started once for the whole test run
/// and removed afterwards. Tests that need a database ask for this in their
/// constructor. They share one database, so each test should use its own data,
/// such as a unique email.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    // The same major version as compose.yaml, so tests match what the app runs on.
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:18").Build();

    public string ConnectionString => container.GetConnectionString();

    public async ValueTask InitializeAsync() => await container.StartAsync();

    public async ValueTask DisposeAsync() => await container.DisposeAsync();
}
