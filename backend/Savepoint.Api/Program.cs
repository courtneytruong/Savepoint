using Microsoft.EntityFrameworkCore;
using Npgsql;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Health;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Savepoint");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Savepoint' is missing. See README.md.");
}

builder.Services.AddNpgsqlDataSource(connectionString);

// EF Core uses the same data source as the health check, so the app has one
// connection pool, and /health checks the very connections the app relies on.
builder.Services.AddDbContext<SavepointDbContext>((services, options) =>
    options.UseNpgsql(services.GetRequiredService<NpgsqlDataSource>()));

builder.Services.AddAccounts();

builder.Services.AddHealthChecks()
    .AddCheck<PostgresHealthCheck>("postgres", timeout: TimeSpan.FromSeconds(5));

var app = builder.Build();

// Compose turns this on, so a fresh database gets its tables when the API starts.
// It's off by default, so the API can still start and report an unreachable
// database through /health. Without Compose, apply migrations with
// dotnet ef database update.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
    await db.Database.MigrateAsync();
}

// Reads the sign-in cookie to work out who's asking, then checks they're allowed.
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");

app.Run();
