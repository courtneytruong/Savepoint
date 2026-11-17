using System.Security.Claims;
using Microsoft.AspNetCore.Identity;

namespace Savepoint.Api.Accounts;

internal static class CurrentUser
{
    /// <summary>
    /// The signed-in person's id, for endpoints that require someone signed in, so
    /// the cookie always holds it.
    /// </summary>
    public static Guid IdOf(ClaimsPrincipal principal, UserManager<User> users) =>
        Guid.Parse(users.GetUserId(principal)
            ?? throw new InvalidOperationException("A signed-in request had no user id."));
}
