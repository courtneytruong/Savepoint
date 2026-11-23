namespace Savepoint.Api.Library;

/// <summary>
/// Which book or game something is about, for lists that mix items, such as every
/// reflection or everything that happened.
/// </summary>
public record ItemSummary(Guid Id, string Title, string Medium);
