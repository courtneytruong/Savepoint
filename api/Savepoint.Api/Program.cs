using Savepoint.Api.Health;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Savepoint");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'Savepoint' is missing. See 'Run the API locally' in README.md.");
}

builder.Services.AddNpgsqlDataSource(connectionString);

builder.Services.AddHealthChecks()
    .AddCheck<PostgresHealthCheck>("postgres", timeout: TimeSpan.FromSeconds(5));

var app = builder.Build();

app.MapHealthChecks("/health");

app.Run();
