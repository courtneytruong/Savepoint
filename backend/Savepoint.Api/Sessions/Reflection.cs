namespace Savepoint.Api.Sessions;

/// <summary>
/// A thought about an item: a mood and notes. Usually it's a session's, but one
/// with no session is a final thought or overall review, so every reflection
/// keeps its own ItemId.
/// </summary>
public class Reflection
{
    public Guid Id { get; set; }

    public Guid ItemId { get; set; }

    /// <summary>
    /// The session it's about, if any. A session has at most one, and it must be
    /// for the same item, which the database checks.
    /// </summary>
    public Guid? SessionId { get; set; }

    public Mood Mood { get; set; }

    /// <summary>20 to 10,000 characters after trimming.</summary>
    public required string Notes { get; set; }

    /// <summary>Set by the database when the reflection is saved.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>
    /// When it last changed. The database sets it to CreatedAt's time at first, and
    /// the API moves it on each edit.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; set; }
}
