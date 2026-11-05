using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Savepoint.Api.Tests;

/// <summary>Runs the real API in memory, using the connection string a test gives it.</summary>
public class ApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // The default, Development, would load the real connection string from
        // User Secrets, so tests could behave differently on each machine.
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Savepoint", connectionString);
    }
}
