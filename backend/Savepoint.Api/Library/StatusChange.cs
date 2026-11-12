namespace Savepoint.Api.Library;

/// <summary>
/// One change of an item's status. A change adds a row rather than editing one,
/// so the timeline can show when someone started, finished or gave up.
/// </summary>
public class StatusChange
{
    public Guid Id { get; set; }

    public Guid ItemId { get; set; }

    public ItemStatus Status { get; set; }

    /// <summary>Set by the database when the change is saved.</summary>
    public DateTimeOffset ChangedAt { get; private set; }
}
