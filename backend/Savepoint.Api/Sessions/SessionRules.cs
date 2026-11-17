namespace Savepoint.Api.Sessions;

/// <summary>
/// The numbers behind the session and reflection rules in docs/data-model.md, in
/// one place for the database checks, the endpoints and the tests.
/// </summary>
public static class SessionRules
{
    // A session can't be longer than the day it's logged on.
    public const int MaxDurationMinutes = 24 * 60;

    // About one short sentence, so a required reflection can't be empty.
    public const int MinNotesLength = 20;

    // Room for a long entry, while turning away pasted junk.
    public const int MaxNotesLength = 10_000;
}
