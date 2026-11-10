namespace Savepoint.Api.Accounts;

/// <summary>
/// The account rules from docs/data-model.md "Accounts". The frontend has the same
/// numbers in rules/authRules.js, so a change belongs in both places.
/// </summary>
public static class AccountRules
{
    public const int MaxDisplayNameLength = 50;

    // Identity's Email column is varchar(256).
    public const int MaxEmailLength = 256;

    // Length only, with no rules about mixing character types, following NIST SP 800-63B.
    public const int MinPasswordLength = 12;
    public const int MaxPasswordLength = 128;

    public const int MaxFailedSignIns = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(5);
}
