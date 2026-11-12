namespace Savepoint.Api.Library;

/// <summary>
/// A book or game in someone's library. Its status isn't stored here: the newest
/// of its StatusChanges is its status, so there's only one source of truth and
/// the timeline keeps every change.
/// </summary>
public class Item
{
    public Guid Id { get; set; }

    /// <summary>Whose library it's in. Everyone's data is their own.</summary>
    public Guid UserId { get; set; }

    public Medium Medium { get; set; }

    /// <summary>1 to 200 characters after trimming.</summary>
    public required string Title { get; set; }

    /// <summary>The author or studio: optional, and null rather than empty when not known.</summary>
    public string? Creator { get; set; }

    /// <summary>Set by the database, like User.CreatedAt, so no code can set it by mistake.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Every status it has had. It gets its first when it's created.</summary>
    public List<StatusChange> StatusChanges { get; } = [];
}
