using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Accounts;
using Savepoint.Api.Sessions;

namespace Savepoint.Api.Tags;

/// <summary>How the tag tables are set up, following docs/data-model.md.</summary>
public static class TagsModel
{
    public static void ConfigureTags(this ModelBuilder builder)
    {
        builder.Entity<Tag>(tag =>
        {
            tag.ToTable("Tags", table =>
                // The API cleans the name before saving, so this checks the cleaned length.
                table.HasCheckConstraint(
                    "CK_Tags_Name_Length",
                    $"""char_length("Name") BETWEEN 1 AND {TagRules.MaxNameLength}"""));

            // Deleting an account deletes its tags.
            tag.HasOne<User>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);

            // One tag per name for each user, ignoring case and accents, so two saves
            // can't both create "Cozy". It also serves as the index for the foreign key.
            tag.HasIndex(t => new { t.UserId, t.NormalizedName }).IsUnique();
        });

        // The tags on a reflection, through ReflectionTags. Deleting either side
        // deletes the link. The key starts with ReflectionId, which covers reading a
        // reflection's tags; EF adds an index on TagId for finding a tag's uses.
        //
        // The database can't check that a tag and its reflection belong to the same
        // user, since a reflection reaches its user through its item. The API only
        // ever links the signed-in user's tags.
        builder.Entity<Reflection>()
            .HasMany(r => r.Tags)
            .WithMany()
            .UsingEntity<ReflectionTag>(
                link => link.HasOne<Tag>().WithMany().HasForeignKey(l => l.TagId).OnDelete(DeleteBehavior.Cascade),
                link => link.HasOne<Reflection>().WithMany().HasForeignKey(l => l.ReflectionId).OnDelete(DeleteBehavior.Cascade),
                link =>
                {
                    link.ToTable("ReflectionTags");
                    link.HasKey(l => new { l.ReflectionId, l.TagId });
                });
    }
}
