namespace Savepoint.Api.Tags;

/// <summary>
/// A free-form label a user puts on reflections. Each user has their own, and one
/// tag is shared by every reflection it's on, so renaming or counting it later
/// touches one row.
/// </summary>
public class Tag
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    /// <summary>
    /// As first typed, after cleaning: 1 to 40 characters, ends trimmed and runs of
    /// spaces made single.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// The name without case or accents, so "Cozy" and "cózy" are one tag. Unique
    /// per user; the API sets it from Name.
    /// </summary>
    public required string NormalizedName { get; set; }
}
