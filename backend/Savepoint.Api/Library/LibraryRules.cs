namespace Savepoint.Api.Library;

/// <summary>
/// The numbers behind the library rules in docs/data-model.md, in one place for
/// the database checks, the endpoints and the tests.
/// </summary>
public static class LibraryRules
{
    // Room for long subtitles and several authors, while turning away pasted junk.
    public const int MaxTitleLength = 200;
    public const int MaxCreatorLength = 200;
}
