using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Savepoint.Api.Tests;

/// <summary>
/// Runs the real API in memory, using the connection string a test gives it.
/// With migrateOnStartup, the API brings the database up to date as it starts,
/// as it does under Compose.
/// </summary>
public class ApiFactory(string connectionString, bool migrateOnStartup = false) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // The default, Development, would load the real connection string from
        // User Secrets, so tests could behave differently on each machine.
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Savepoint", connectionString);
        builder.UseSetting("Database:MigrateOnStartup", migrateOnStartup.ToString());
    }
}
