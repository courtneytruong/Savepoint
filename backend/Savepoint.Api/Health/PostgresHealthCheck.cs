using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace Savepoint.Api.Health;

public class PostgresHealthCheck(NpgsqlDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var command = dataSource.CreateCommand("SELECT 1");
            await command.ExecuteScalarAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Passing the exception on gets the reason into the server logs,
            // while the /health response itself only says "Unhealthy".
            return new HealthCheckResult(context.Registration.FailureStatus, exception: exception);
        }
    }
}
