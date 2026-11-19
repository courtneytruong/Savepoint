using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

namespace Savepoint.Api.Sessions;

/// <summary>How the session and reflection tables are set up, following docs/data-model.md.</summary>
public static class SessionsModel
{
    public static void ConfigureSessions(this ModelBuilder builder)
    {
        builder.Entity<Session>(session =>
        {
            session.ToTable("Sessions", table =>
            {
                // "Not after today" isn't here: a check must give the same answer every
                // day, so the API enforces that one.
                table.HasCheckConstraint(
                    "CK_Sessions_DurationMinutes",
                    $"\"DurationMinutes\" BETWEEN 1 AND {SessionRules.MaxDurationMinutes}");
                // Passes when null, so no page count is allowed, but zero isn't.
                table.HasCheckConstraint("CK_Sessions_PagesRead", "\"PagesRead\" > 0");
            });

            session.Property(s => s.CreatedAt).HasDefaultValueSql("now()");
            session.Property(s => s.UpdatedAt).HasDefaultValueSql("now()");

            // Deleting an item deletes its sessions.
            session.HasOne<Item>().WithMany().HasForeignKey(s => s.ItemId).OnDelete(DeleteBehavior.Cascade);

            // Unique already, since Id is, but the composite foreign key below needs a
            // key on both columns to point at.
            session.HasAlternateKey(s => new { s.Id, s.ItemId });

            // An item's sessions are read newest day first. It also serves as the
            // index for the foreign key.
            session.HasIndex(s => new { s.ItemId, s.Date });

            // A reflection about a session must be for the same item: the foreign key
            // covers both columns. Postgres skips the check when SessionId is null, as
            // it is for a reflection that stands alone. The unique index this makes on
            // (SessionId, ItemId) means a session has at most one reflection, since a
            // session has only one ItemId. Deleting a session deletes its reflection.
            session.HasOne(s => s.Reflection)
                .WithOne()
                .HasForeignKey<Reflection>(r => new { r.SessionId, r.ItemId })
                .HasPrincipalKey<Session>(s => new { s.Id, s.ItemId })
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Reflection>(reflection =>
        {
            reflection.ToTable("Reflections", table =>
            {
                table.HasCheckConstraint("CK_Reflections_Mood", Checks.OneOf<Mood>("Mood"));
                // The API trims before saving, so this checks the trimmed length.
                table.HasCheckConstraint(
                    "CK_Reflections_Notes_Length",
                    $"""char_length("Notes") BETWEEN {SessionRules.MinNotesLength} AND {SessionRules.MaxNotesLength}""");
            });

            reflection.Property(r => r.Mood).HasConversion<string>();
            reflection.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
            reflection.Property(r => r.UpdatedAt).HasDefaultValueSql("now()");

            // Deleting an item deletes its reflections, including ones with no session.
            reflection.HasOne<Item>().WithMany().HasForeignKey(r => r.ItemId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
