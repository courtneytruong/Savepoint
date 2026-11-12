namespace Savepoint.Api.Library;

/// <summary>Where someone is with an item. Saved as its name, such as "InProgress".</summary>
public enum ItemStatus
{
    Backlog,
    InProgress,
    Finished,
    Dropped,
}
