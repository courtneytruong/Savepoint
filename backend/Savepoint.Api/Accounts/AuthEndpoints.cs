using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Savepoint.Api.Accounts;

/// <summary>
/// Creating accounts and signing in, under /api/auth. Every error is Problem
/// Details (RFC 9457). Where the frontend needs to tell answers apart, an extra
/// "error" field names it with the same codes the forms use, such as emailTaken.
/// </summary>
public static partial class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth");
        auth.MapPost("/register", Register);
        return app;
    }

    // Nullable, so a missing field gets a "required" answer rather than a failed request.
    public record RegisterRequest(string? DisplayName, string? Email, string? Password);

    public record AccountResponse(Guid Id, string DisplayName, string Email);

    // The same check as the frontend's looksLikeEmail: something, an @, then
    // something, with no spaces. Stricter checks turn away real addresses.
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+$")]
    private static partial Regex LooksLikeEmail();

    /// <summary>
    /// Creates an account and signs it in, so there's no second step of typing the
    /// same password again. 201 with the account, 409 emailTaken, or 400 with a
    /// code per field: required, tooShort, tooLong or invalid.
    /// </summary>
    private static async Task<Results<Created<AccountResponse>, ValidationProblem, ProblemHttpResult>> Register(
        RegisterRequest request, UserManager<User> users, SignInManager<User> signIn)
    {
        var displayName = request.DisplayName?.Trim() ?? "";
        var email = request.Email?.Trim() ?? "";
        // Never trimmed: spaces count in a password.
        var password = request.Password ?? "";

        var errors = new Dictionary<string, string[]>();
        if (displayName.Length == 0) errors["displayName"] = ["required"];
        else if (displayName.Length > AccountRules.MaxDisplayNameLength) errors["displayName"] = ["tooLong"];

        if (email.Length == 0) errors["email"] = ["required"];
        else if (email.Length > AccountRules.MaxEmailLength) errors["email"] = ["tooLong"];
        else if (!LooksLikeEmail().IsMatch(email)) errors["email"] = ["invalid"];

        if (password.Length == 0) errors["password"] = ["required"];
        else if (password.Length < AccountRules.MinPasswordLength) errors["password"] = ["tooShort"];
        else if (password.Length > AccountRules.MaxPasswordLength) errors["password"] = ["tooLong"];

        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        // The email is the username too, because people sign in with it.
        var user = new User { DisplayName = displayName, Email = email, UserName = email };
        IdentityResult result;
        try
        {
            result = await users.CreateAsync(user, password);
        }
        catch (DbUpdateException exception) when (IsDuplicateEmail(exception))
        {
            // Identity checks for the email first, but two sign-ups at the same moment
            // can both pass that check. The database's unique index stops the second.
            return EmailTaken();
        }

        if (!result.Succeeded)
        {
            // Identity reports a taken email twice, once for the email and once for the
            // username, because they're the same value.
            if (result.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName")) return EmailTaken();
            if (result.Errors.Any(e => e.Code is "InvalidEmail" or "InvalidUserName"))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["invalid"] });
            }
            // Anything else means the checks above have drifted from Identity's settings:
            // a bug, so a 500 that gets logged, rather than an answer the form can't show.
            throw new InvalidOperationException(
                "Identity refused a new account: " + string.Join(", ", result.Errors.Select(e => e.Code)));
        }

        // Persistent, so the cookie outlives closing the browser, as a journal people
        // come back to should. It lasts 14 days, renewed as they use the app.
        await signIn.SignInAsync(user, isPersistent: true);
        return TypedResults.Created("/api/auth/me", new AccountResponse(user.Id, user.DisplayName, user.Email!));
    }

    private static ProblemHttpResult EmailTaken() => TypedResults.Problem(
        title: "That email already has an account.",
        statusCode: StatusCodes.Status409Conflict,
        extensions: new Dictionary<string, object?> { ["error"] = "emailTaken" });

    // 23505 is PostgreSQL's code for breaking a unique index.
    private static bool IsDuplicateEmail(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } postgres
        && postgres.ConstraintName is "EmailIndex" or "UserNameIndex";
}
