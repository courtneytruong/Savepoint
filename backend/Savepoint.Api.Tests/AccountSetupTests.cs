using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Savepoint.Api.Accounts;

namespace Savepoint.Api.Tests;

/// <summary>Checks Identity is set up with the rules in docs/data-model.md "Accounts".</summary>
public sealed class AccountSetupTests : IAsyncDisposable
{
    private readonly ApiFactory factory;
    private readonly AsyncServiceScope scope;
    private readonly UserManager<User> users;

    public AccountSetupTests(PostgresFixture postgres)
    {
        factory = new ApiFactory(postgres.ConnectionString, migrateOnStartup: true);
        scope = factory.Services.CreateAsyncScope();
        users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
    }

    public async ValueTask DisposeAsync()
    {
        await scope.DisposeAsync();
        await factory.DisposeAsync();
    }

    // The tests share one database, so each account needs an email of its own.
    private static User NewUser(string? email = null)
    {
        email ??= $"{Guid.NewGuid()}@example.com";
        return new User { DisplayName = "Test", Email = email, UserName = email };
    }

    [Fact]
    public async Task Accepts_a_12_character_password_with_no_mixing_rules()
    {
        var result = await users.CreateAsync(NewUser(), "only letters");

        Assert.True(result.Succeeded, string.Join(", ", result.Errors.Select(e => e.Code)));
    }

    [Fact]
    public async Task Refuses_a_password_shorter_than_12_characters()
    {
        var result = await users.CreateAsync(NewUser(), "eleven char");

        Assert.Contains(result.Errors, e => e.Code == "PasswordTooShort");
    }

    [Fact]
    public async Task Refuses_a_second_account_for_an_email_in_any_case()
    {
        var email = $"{Guid.NewGuid()}@example.com";
        await users.CreateAsync(NewUser(email), "a long password");

        var result = await users.CreateAsync(NewUser(email.ToUpperInvariant()), "a long password");

        Assert.Contains(result.Errors, e => e.Code == "DuplicateEmail");
    }

    [Fact]
    public async Task Accepts_an_email_with_an_apostrophe()
    {
        var result = await users.CreateAsync(NewUser($"o'brien.{Guid.NewGuid()}@example.com"), "a long password");

        Assert.True(result.Succeeded, string.Join(", ", result.Errors.Select(e => e.Code)));
    }

    [Fact]
    public async Task Locks_an_account_for_5_minutes_after_5_wrong_passwords()
    {
        var user = NewUser();
        await users.CreateAsync(user, "a long password");

        for (var attempt = 1; attempt < AccountRules.MaxFailedSignIns; attempt++)
        {
            await users.AccessFailedAsync(user);
        }
        Assert.False(await users.IsLockedOutAsync(user));

        await users.AccessFailedAsync(user);

        Assert.True(await users.IsLockedOutAsync(user));
        var lockoutEnd = await users.GetLockoutEndDateAsync(user);
        Assert.NotNull(lockoutEnd);
        Assert.InRange(lockoutEnd.Value - DateTimeOffset.UtcNow, TimeSpan.FromMinutes(4.5), TimeSpan.FromMinutes(5));
    }
}
