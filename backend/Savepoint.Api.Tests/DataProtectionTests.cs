using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tests;

/// <summary>The keys that encrypt the sign-in cookie live in the database.</summary>
public class DataProtectionTests(PostgresFixture postgres)
{
    [Fact]
    public async Task Keys_are_stored_in_the_database_and_work_after_a_restart()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        string encrypted;

        await using (var first = new ApiFactory(postgres.ConnectionString))
        {
            var protector = first.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("test");
            encrypted = protector.Protect("still readable");

            using var scope = first.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SavepointDbContext>();
            // Without this check the test could pass anyway, because both instances
            // would fall back to the same key folder on the machine running the tests.
            Assert.NotEmpty(await db.DataProtectionKeys.ToListAsync(cancellationToken));
        }

        // A second instance of the API, as after rebuilding its container.
        await using var second = new ApiFactory(postgres.ConnectionString);
        var secondProtector = second.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("test");

        Assert.Equal("still readable", secondProtector.Unprotect(encrypted));
    }
}
