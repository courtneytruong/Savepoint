namespace Savepoint.Api.Tags;

/// <summary>One tag on one reflection.</summary>
public class ReflectionTag
{
    public Guid ReflectionId { get; set; }

    public Guid TagId { get; set; }
}
