using Microsoft.EntityFrameworkCore;
using Npgsql;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Library;
using Savepoint.Api.Sessions;
using Savepoint.Api.Tags;

namespace Savepoint.Api.Tests;

/// <summary>
/// Checks that the database itself holds the tag rules in docs/data-model.md, so
/// data that skips the API, or an API bug, still can't break them.
/// </summary>
public class TagsModelTests(PostgresFixture postgres)
{
    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    private SavepointDbContext NewContext() =>
        new(new DbContextOptionsBuilder<SavepointDbContext>().UseNpgsql(postgres.ConnectionString).Options);

    // Each test has its own user, since the tests share one database.
    private async Task<User> CreateUserAsync(SavepointDbContext db)
    {
        var user = new User { DisplayName = "Tags test", Email = $"tags-{Guid.NewGuid():N}@example.com" };
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        return user;
    }

    // A reflection on a session of a new item of the user's.
    private async Task<Reflection> CreateReflectionAsync(SavepointDbContext db, User user, params Tag[] tags)
    {
        var item = new Item
        {
            UserId = user.Id,
            Medium = Medium.Game,
            Title = "Outer Wilds",
            StatusChanges = { new StatusChange { Status = ItemStatus.InProgress } },
        };
        var reflection = new Reflection
        {
            ItemId = item.Id,
            Mood = Mood.Curious,
            Notes = "The quantum moon keeps slipping away from me.",
            Tags = [.. tags],
        };
        db.Items.Add(item);
        db.Sessions.Add(new Session
        {
            ItemId = item.Id,
            Date = new DateOnly(2026, 11, 20),
            DurationMinutes = 90,
            Reflection = reflection,
        });
        await db.SaveChangesAsync(cancellationToken);
        return reflection;
    }

    private static Tag NewTag(User user, string name, string? normalizedName = null) =>
        new() { UserId = user.Id, Name = name, NormalizedName = normalizedName ?? name.ToLowerInvariant() };

    [Fact]
    public async Task Saves_a_reflections_tags()
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        var reflection = await CreateReflectionAsync(db, user, NewTag(user, "Space"), NewTag(user, "found family"));

        await using var fresh = NewContext();
        var saved = await fresh.Reflections.Include(r => r.Tags).SingleAsync(r => r.Id == reflection.Id, cancellationToken);
        Assert.Equal(new[] { "found family", "Space" }, saved.Tags.Select(t => t.Name).Order(StringComparer.OrdinalIgnoreCase));
        Assert.All(saved.Tags, tag => Assert.Equal(user.Id, tag.UserId));
    }

    [Fact]
    public async Task Refuses_a_users_second_tag_with_the_same_normalized_name()
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        db.Tags.Add(NewTag(user, "Cozy", "cozy"));
        await db.SaveChangesAsync(cancellationToken);

        db.Tags.Add(NewTag(user, "cózy", "cozy"));
        await AssertRefusedAsync(db, PostgresErrorCodes.UniqueViolation, "IX_Tags_UserId_NormalizedName");
    }

    [Fact]
    public async Task Allows_two_users_a_tag_with_the_same_name()
    {
        await using var db = NewContext();
        db.Tags.Add(NewTag(await CreateUserAsync(db), "Cozy"));
        db.Tags.Add(NewTag(await CreateUserAsync(db), "Cozy"));
        await db.SaveChangesAsync(cancellationToken);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(TagRules.MaxNameLength + 1)]
    public async Task Refuses_a_name_outside_1_to_40_characters(int length)
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        db.Tags.Add(NewTag(user, new string('a', length)));
        await AssertRefusedAsync(db, PostgresErrorCodes.CheckViolation, "CK_Tags_Name_Length");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(TagRules.MaxNameLength)]
    public async Task Allows_a_name_of_exactly_1_or_40_characters(int length)
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        db.Tags.Add(NewTag(user, new string('a', length)));
        await db.SaveChangesAsync(cancellationToken);
    }

    [Fact]
    public async Task Refuses_the_same_tag_twice_on_one_reflection()
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        var tag = NewTag(user, "Space");
        var reflection = await CreateReflectionAsync(db, user, tag);

        // Raw SQL, since EF keeps a reflection's tags as a set.
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(
            """INSERT INTO "ReflectionTags" ("ReflectionId", "TagId") VALUES (@reflection, @tag)""",
            [new NpgsqlParameter("reflection", reflection.Id), new NpgsqlParameter("tag", tag.Id)],
            cancellationToken));
        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("PK_ReflectionTags", error.ConstraintName);
    }

    [Fact]
    public async Task Deleting_a_session_unlinks_its_reflections_tags_but_keeps_them()
    {
        // The API deletes tags that are left unused; the database only removes links.
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        var tag = NewTag(user, "Space");
        var reflection = await CreateReflectionAsync(db, user, tag);

        await db.Sessions.Where(s => s.Id == reflection.SessionId).ExecuteDeleteAsync(cancellationToken);

        Assert.False(await db.ReflectionTags.AnyAsync(l => l.TagId == tag.Id, cancellationToken));
        Assert.True(await db.Tags.AnyAsync(t => t.Id == tag.Id, cancellationToken));
    }

    [Fact]
    public async Task Deleting_a_tag_takes_it_off_its_reflections()
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        var tag = NewTag(user, "Space");
        var reflection = await CreateReflectionAsync(db, user, tag);

        await db.Tags.Where(t => t.Id == tag.Id).ExecuteDeleteAsync(cancellationToken);

        Assert.False(await db.ReflectionTags.AnyAsync(l => l.ReflectionId == reflection.Id, cancellationToken));
        Assert.True(await db.Reflections.AnyAsync(r => r.Id == reflection.Id, cancellationToken));
    }

    [Fact]
    public async Task Deleting_an_account_deletes_its_tags()
    {
        await using var db = NewContext();
        var user = await CreateUserAsync(db);
        await CreateReflectionAsync(db, user, NewTag(user, "Space"));

        await db.Users.Where(u => u.Id == user.Id).ExecuteDeleteAsync(cancellationToken);

        Assert.False(await db.Tags.AnyAsync(t => t.UserId == user.Id, cancellationToken));
    }

    private async Task AssertRefusedAsync(SavepointDbContext db, string sqlState, string constraint)
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync(cancellationToken));
        var postgresError = Assert.IsType<PostgresException>(error.InnerException);
        Assert.Equal(sqlState, postgresError.SqlState);
        Assert.Equal(constraint, postgresError.ConstraintName);
    }
}
