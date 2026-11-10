using Microsoft.AspNetCore.Identity;

namespace Savepoint.Api.Accounts;

/// <summary>
/// A person with an account. Identity's own columns hold the email and the
/// password's hash, so this adds only what Savepoint needs on top.
/// </summary>
public class User : IdentityUser<Guid>
{
    /// <summary>The name shown in the app, 1 to 50 characters after trimming.</summary>
    public required string DisplayName { get; set; }

    /// <summary>
    /// When the account was created. The database fills it in, so the setter is
    /// private: no code can set it by mistake, and EF Core can still read it back.
    /// </summary>
    public DateTimeOffset CreatedAt { get; private set; }
}
