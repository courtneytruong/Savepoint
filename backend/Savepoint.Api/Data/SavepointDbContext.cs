using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;

namespace Savepoint.Api.Data;

/// <summary>
/// Savepoint's database. It builds on Identity's user tables without the role
/// tables, because Savepoint has no roles: everyone's data is simply their own.
/// </summary>
public class SavepointDbContext(DbContextOptions<SavepointDbContext> options)
    : IdentityUserContext<User, Guid>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Identity's own setup comes first, so the lines below can adjust it.
        base.OnModelCreating(builder);

        builder.Entity<User>(user =>
        {
            // docs/data-model.md calls this table Users, rather than Identity's AspNetUsers.
            user.ToTable("Users", table =>
                // The API trims the name before saving, so this checks the trimmed length.
                // A check rather than varchar(50), so the column stays text as in the model
                // and an empty name is refused too.
                table.HasCheckConstraint(
                    "CK_Users_DisplayName_Length",
                    """char_length("DisplayName") BETWEEN 1 AND 50"""));

            // An email can have only one account. Identity indexes the normalized
            // (uppercased) email for lookups, and this makes that index unique too, so
            // two sign-ups at the same moment can't both get through. Postgres allows
            // any number of nulls in a unique index.
            user.HasIndex(u => u.NormalizedEmail).HasDatabaseName("EmailIndex").IsUnique();

            // The database's clock sets this, whatever creates the row.
            user.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
        });
    }
}
