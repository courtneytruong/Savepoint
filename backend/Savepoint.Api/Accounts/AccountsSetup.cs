using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Savepoint.Api.Data;

namespace Savepoint.Api.Accounts;

public static class AccountsSetup
{
    /// <summary>
    /// Identity, for storing accounts and checking passwords, and a sign-in cookie.
    /// AddIdentityCore leaves out Identity's built-in pages and role support, which
    /// Savepoint doesn't use. The frontend has its own forms and calls the API.
    /// </summary>
    public static IServiceCollection AddAccounts(this IServiceCollection services)
    {
        services
            .AddIdentityCore<User>(options =>
            {
                options.User.RequireUniqueEmail = true;
                // People sign in with their email, so it's also their username. An empty
                // list turns off Identity's username character check, which would refuse
                // some valid emails, such as ones with an apostrophe.
                options.User.AllowedUserNameCharacters = "";

                // Identity has no maximum length, so the register endpoint checks that.
                options.Password.RequiredLength = AccountRules.MinPasswordLength;
                options.Password.RequiredUniqueChars = 1;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.MaxFailedAccessAttempts = AccountRules.MaxFailedSignIns;
                options.Lockout.DefaultLockoutTimeSpan = AccountRules.LockoutDuration;
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddEntityFrameworkStores<SavepointDbContext>()
            .AddSignInManager();

        // The sign-in cookie is encrypted with keys ASP.NET Core makes and rotates
        // itself. Stored in the database, they outlive the container, so rebuilding
        // the API doesn't sign everyone out. The application name keeps the keys
        // tied to Savepoint, rather than to the folder the app happens to run from.
        services.AddDataProtection()
            .PersistKeysToDbContext<SavepointDbContext>()
            .SetApplicationName("Savepoint");

        // All of Identity's cookie schemes, because signing out clears every one of
        // them, but only the application cookie, which says who is signed in, is used.
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "savepoint.auth";
            // The browser only sends it to Savepoint itself, never on a request
            // started by another site, which blocks cross-site request forgery.
            options.Cookie.SameSite = SameSiteMode.Strict;
            // HttpOnly is already the default: page scripts can never read the cookie.

            // Identity's default is to redirect to a login page. An API should answer
            // with a status code, and the frontend decides what to show.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorization();
        return services;
    }
}
