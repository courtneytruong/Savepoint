using Microsoft.EntityFrameworkCore;
using Npgsql;
using Savepoint.Api.Data;
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

    /// <summary>The shared database, already migrated.</summary>
    public string ConnectionString => container.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        await container.StartAsync();

        // Migrated once, here, because test classes run in parallel: if each one
        // started the API with migrations on, two could apply the same migration at
        // once and one would fail.
        await using var db = new SavepointDbContext(
            new DbContextOptionsBuilder<SavepointDbContext>().UseNpgsql(ConnectionString).Options);
        await db.Database.MigrateAsync();
    }

    /// <summary>
    /// A new database with nothing in it, in the same container, for a test that
    /// needs to see the API set one up from scratch.
    /// </summary>
    public async Task<string> CreateEmptyDatabaseAsync()
    {
        var name = $"empty_{Guid.NewGuid():N}";
        await using (var connection = new NpgsqlConnection(ConnectionString))
        {
            await connection.OpenAsync();
            // The name is made above, never taken from input, so building the SQL is safe.
            await using var command = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", connection);
            await command.ExecuteNonQueryAsync();
        }
        return new NpgsqlConnectionStringBuilder(ConnectionString) { Database = name }.ConnectionString;
    }

    public async ValueTask DisposeAsync() => await container.DisposeAsync();
}
