using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;

namespace Savepoint.Api.Library;

/// <summary>How the library's tables are set up, following docs/data-model.md.</summary>
public static class LibraryModel
{
    public static void ConfigureLibrary(this ModelBuilder builder)
    {
        builder.Entity<Item>(item =>
        {
            item.ToTable("Items", table =>
            {
                table.HasCheckConstraint("CK_Items_Medium", OneOf<Medium>("Medium"));
                // The API trims before saving, so these check the trimmed length.
                table.HasCheckConstraint(
                    "CK_Items_Title_Length",
                    $"""char_length("Title") BETWEEN 1 AND {LibraryRules.MaxTitleLength}""");
                // A check passes when its value is null, so no creator is allowed, but an
                // empty one isn't: the API saves "" as null.
                table.HasCheckConstraint(
                    "CK_Items_Creator_Length",
                    $"""char_length("Creator") BETWEEN 1 AND {LibraryRules.MaxCreatorLength}""");
            });

            // Saved as names rather than numbers, so the data reads clearly and
            // reordering the enum can't change what's stored.
            item.Property(i => i.Medium).HasConversion<string>();
            item.Property(i => i.CreatedAt).HasDefaultValueSql("now()");

            // No navigation to User is needed, only the key. Deleting an account
            // deletes its library.
            item.HasOne<User>().WithMany().HasForeignKey(i => i.UserId).OnDelete(DeleteBehavior.Cascade);

            item.HasMany(i => i.StatusChanges)
                .WithOne()
                .HasForeignKey(s => s.ItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<StatusChange>(change =>
        {
            change.ToTable("StatusChanges", table =>
                table.HasCheckConstraint("CK_StatusChanges_Status", OneOf<ItemStatus>("Status")));

            change.Property(s => s.Status).HasConversion<string>();
            change.Property(s => s.ChangedAt).HasDefaultValueSql("now()");

            // Finding an item's newest status reads its changes by time, so the index
            // covers both. It also serves as the index for the foreign key.
            change.HasIndex(s => new { s.ItemId, s.ChangedAt });
        });
    }

    // A check that a column holds one of an enum's names, built from the enum so
    // the two can't drift apart: a new value changes the model, and so the next
    // migration.
    private static string OneOf<TEnum>(string column) where TEnum : struct, Enum =>
        $"\"{column}\" IN ({string.Join(", ", Enum.GetNames<TEnum>().Select(name => $"'{name}'"))})";
}
