using Microsoft.EntityFrameworkCore;
using Savepoint.Api.Data;

namespace Savepoint.Api.Tags;

/// <summary>Checking, finding and tidying a user's tags, for the endpoints that save reflections.</summary>
public static class TagStore
{
    /// <summary>
    /// The cleaned names of the tags asked for, with names that are the same tag
    /// (ignoring case and accents) merged into the first. Missing means none. Adds one
    /// code under field to errors when a name is empty (invalid) or too long
    /// (tooLong), or there are too many (tooMany); the names are then meaningless.
    /// </summary>
    public static List<string> Check(List<string?>? names, string field, Dictionary<string, string[]> errors)
    {
        var cleaned = new List<string>();
        foreach (var name in names ?? [])
        {
            var clean = TagNames.Clean(name ?? "");
            if (clean.Length == 0)
            {
                errors[field] = ["invalid"];
                return [];
            }
            if (TagNames.Length(clean) > TagRules.MaxNameLength)
            {
                errors[field] = ["tooLong"];
                return [];
            }
            cleaned.Add(clean);
        }

        var distinct = cleaned.DistinctBy(TagNames.Normalize).ToList();
        if (distinct.Count > TagRules.MaxTagsPerReflection) errors[field] = ["tooMany"];
        return distinct;
    }

    /// <summary>
    /// The user's tags with these names, adding the ones they don't have yet. New
    /// ones are only added to the context, so the caller's save inserts them with
    /// the rest. Two saves creating the same new tag at once can't both succeed: the
    /// unique index refuses the second, which is accepted for a personal app.
    /// </summary>
    public static async Task<List<Tag>> FindOrAddAsync(
        SavepointDbContext db, Guid userId, List<string> names, CancellationToken cancellationToken)
    {
        var wanted = names.Select(name => (Name: name, Normalized: TagNames.Normalize(name))).ToList();
        var normalized = wanted.Select(w => w.Normalized).ToList();
        var existing = await db.Tags
            .Where(t => t.UserId == userId && normalized.Contains(t.NormalizedName))
            .ToDictionaryAsync(t => t.NormalizedName, cancellationToken);

        // An existing tag keeps the spelling it was first given.
        var tags = wanted
            .Select(w => existing.GetValueOrDefault(w.Normalized)
                ?? new Tag { UserId = userId, Name = w.Name, NormalizedName = w.Normalized })
            .ToList();
        db.Tags.AddRange(tags.Where(t => !existing.ContainsKey(t.NormalizedName)));
        return tags;
    }

    /// <summary>
    /// Deletes the user's tags that are on no reflection, so old typos stop being
    /// suggested. Run after any save that can take tags off reflections, in the same
    /// transaction.
    /// </summary>
    public static Task<int> DeleteUnusedAsync(SavepointDbContext db, Guid userId, CancellationToken cancellationToken) =>
        db.Tags
            .Where(t => t.UserId == userId && !db.ReflectionTags.Any(l => l.TagId == t.Id))
            .ExecuteDeleteAsync(cancellationToken);
}
