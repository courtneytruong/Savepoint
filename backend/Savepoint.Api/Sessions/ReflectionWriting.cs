using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Data;
using Savepoint.Api.Tags;

namespace Savepoint.Api.Sessions;

/// <summary>
/// A reflection as the frontend sends it, alone or inside a session. Strings, so a
/// missing or unknown mood gets a field code rather than a request the JSON reader
/// refuses outright. Tags are names, so a new one is created by using it; missing
/// means none.
/// </summary>
public record ReflectionRequest(string? Mood, string? Notes, List<string?>? Tags);

/// <summary>A reflection with its tags' names, in alphabetical order ignoring case and accents.</summary>
public record ReflectionResponse(
    Guid Id, string Mood, string Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, List<string> Tags);

/// <summary>A reflection's checked fields: the notes trimmed, and tags as cleaned names, one per tag.</summary>
public sealed record ReflectionDetails(Mood Mood, string Notes, List<string> Tags);

/// <summary>
/// Checking, answering with and editing a reflection, the same whether it's a
/// session's or stands alone.
/// </summary>
public static class ReflectionWriting
{
    /// <summary>
    /// The reflection's mood, trimmed notes and tags, adding a code to errors for each
    /// one that's wrong. Fields are named with prefix in front, such as
    /// "reflection." inside a session. A missing reflection counts as missing its
    /// mood and notes. The details are only meaningful when it added no codes.
    /// </summary>
    public static ReflectionDetails Check(ReflectionRequest? reflection, string prefix, Dictionary<string, string[]> errors)
    {
        Mood mood = default;
        if (reflection?.Mood is null) errors[$"{prefix}mood"] = ["required"];
        else if (!EnumNames.TryParse(reflection.Mood, out mood)) errors[$"{prefix}mood"] = ["invalid"];

        var notes = reflection?.Notes?.Trim() ?? "";
        // Counted as the database counts characters: by code point, so an emoji is one
        // character, not the two that string.Length counts. Counting the other way, a
        // note could pass here and then fail the database's check.
        var length = notes.EnumerateRunes().Count();
        if (length == 0) errors[$"{prefix}notes"] = ["required"];
        else if (length < SessionRules.MinNotesLength) errors[$"{prefix}notes"] = ["tooShort"];
        else if (length > SessionRules.MaxNotesLength) errors[$"{prefix}notes"] = ["tooLong"];

        var tags = TagStore.Check(reflection?.Tags, $"{prefix}tags", errors);
        return new ReflectionDetails(mood, notes, tags);
    }

    /// <summary>
    /// Replaces a saved reflection's mood, notes and tags, inside the caller's
    /// transaction. UpdatedAt moves only when one of them really changes, by the
    /// database's clock, so it compares with CreatedAt. A tag left on no reflection is
    /// deleted. The reflection must be the user's, loaded and tracked with its tags.
    /// </summary>
    public static async Task UpdateAsync(
        SavepointDbContext db, Guid userId, Reflection reflection, ReflectionDetails details,
        CancellationToken cancellationToken)
    {
        // Tags are compared as sets of normalized names, so sending the same tags in
        // another order or case isn't a change.
        var tagsChanged = !reflection.Tags.Select(t => t.NormalizedName).ToHashSet()
            .SetEquals(details.Tags.Select(TagNames.Normalize));

        await db.Reflections
            .Where(r => r.Id == reflection.Id)
            .ExecuteUpdateAsync(
                set => set
                    // Worked out from the old values, since SET reads the row as it was.
                    .SetProperty(
                        r => r.UpdatedAt,
                        r => tagsChanged || r.Mood != details.Mood || r.Notes != details.Notes
                            ? DateTimeOffset.UtcNow
                            : r.UpdatedAt)
                    .SetProperty(r => r.Mood, details.Mood)
                    .SetProperty(r => r.Notes, details.Notes),
                cancellationToken);

        if (tagsChanged)
        {
            var tags = await TagStore.FindOrAddAsync(db, userId, details.Tags, cancellationToken);
            reflection.Tags.Clear();
            reflection.Tags.AddRange(tags);
            await db.SaveChangesAsync(cancellationToken);
            await TagStore.DeleteUnusedAsync(db, userId, cancellationToken);
        }
    }

    /// <summary>The reflection as the frontend sees it. Its tags must be loaded.</summary>
    public static ReflectionResponse ToResponse(Reflection reflection) => new(
        reflection.Id,
        reflection.Mood.ToString(),
        reflection.Notes,
        reflection.CreatedAt,
        reflection.UpdatedAt,
        TagNamesInOrder(reflection.Tags));

    /// <summary>
    /// Tag names in alphabetical order ignoring case and accents. Sorted here rather
    /// than in SQL, so the order doesn't depend on the database's collation. Two of a
    /// user's tags never share a normalized name.
    /// </summary>
    public static List<string> TagNamesInOrder(IEnumerable<Tag> tags) =>
        [.. tags.OrderBy(t => t.NormalizedName, StringComparer.Ordinal).Select(t => t.Name)];
}
