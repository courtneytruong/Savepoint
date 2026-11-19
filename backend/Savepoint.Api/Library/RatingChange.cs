namespace Savepoint.Api.Library;

/// <summary>
/// One rating given to an item. A change adds a row rather than editing one, as
/// for status, so the timeline can show a change of heart. An item has none until
/// it's rated, and a rating can be changed but not removed.
/// </summary>
public class RatingChange
{
    public Guid Id { get; set; }

    public Guid ItemId { get; set; }

    /// <summary>Whole stars, from 1 to 5.</summary>
    public int Rating { get; set; }

    /// <summary>Set by the database when the change is saved.</summary>
    public DateTimeOffset ChangedAt { get; private set; }
}
