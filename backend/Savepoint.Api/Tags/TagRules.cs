namespace Savepoint.Api.Tags;

/// <summary>
/// The numbers behind the tag rules in docs/data-model.md, in one place for the
/// database check, the endpoints and the tests.
/// </summary>
public static class TagRules
{
    // Room for a short phrase, such as "found family", while keeping cards tidy.
    public const int MaxNameLength = 40;

    // Enough to label a reflection, without a typo-filled edit adding dozens. The
    // API enforces it, since a check can't count rows.
    public const int MaxTagsPerReflection = 10;
}
