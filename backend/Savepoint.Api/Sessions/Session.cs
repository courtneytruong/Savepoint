namespace Savepoint.Api.Sessions;

/// <summary>
/// One sitting with a book or game. Logging one always saves its reflection with
/// it, in the same transaction, since reflection is why the app exists.
/// </summary>
public class Session
{
    public Guid Id { get; set; }

    public Guid ItemId { get; set; }

    /// <summary>
    /// The person's own calendar day, with no time or zone. It sorts the timeline,
    /// so a session logged late still shows on the day it happened.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>1 to 1440 minutes.</summary>
    public int DurationMinutes { get; set; }

    /// <summary>Optional and above 0. Only books have pages, which the API checks.</summary>
    public int? PagesRead { get; set; }

    /// <summary>Set by the database when the session is saved.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>
    /// When its date, duration or pages last changed. The database sets it to
    /// CreatedAt's time at first, and the API moves it on each edit that changes
    /// one of them. Its reflection keeps its own UpdatedAt for the mood and notes.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>What was thought. Every session the API saves has one.</summary>
    public Reflection? Reflection { get; set; }
}
