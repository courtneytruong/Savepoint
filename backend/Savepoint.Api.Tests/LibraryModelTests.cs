using Microsoft.EntityFrameworkCore;
using Npgsql;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Library;

namespace Savepoint.Api.Tests;

/// <summary>
/// Checks that the database itself holds the library rules in docs/data-model.md,
/// so data that skips the API, or an API bug, still can't break them.
/// </summary>
public class LibraryModelTests(PostgresFixture postgres)
{
    private SavepointDbContext NewContext() =>
        new(new DbContextOptionsBuilder<SavepointDbContext>().UseNpgsql(postgres.ConnectionString).Options);

    // Each test has its own user, since the tests share one database.
    private async Task<Guid> CreateUserAsync(SavepointDbContext db)
    {
        var user = new User { DisplayName = "Library test", Email = $"library-{Guid.NewGuid():N}@example.com" };
        db.Users.Add(user);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return user.Id;
    }

    private static Item NewItem(Guid userId, string title = "Piranesi", string? creator = "Susanna Clarke") => new()
    {
        UserId = userId,
        Medium = Medium.Book,
        Title = title,
        Creator = creator,
        StatusChanges = { new StatusChange { Status = ItemStatus.Backlog } },
    };

    [Fact]
    public async Task Saves_an_item_with_its_first_status_named_in_words()
    {
        await using var db = NewContext();
        var cancellationToken = TestContext.Current.CancellationToken;
        var item = NewItem(await CreateUserAsync(db));
        db.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        await using var fresh = NewContext();
        var saved = await fresh.Items.Include(i => i.StatusChanges).SingleAsync(i => i.Id == item.Id, cancellationToken);
        Assert.Equal(Medium.Book, saved.Medium);
        Assert.Equal(ItemStatus.Backlog, Assert.Single(saved.StatusChanges).Status);
        // The database's clock filled both in, in the same transaction, so they match.
        Assert.NotEqual(default, saved.CreatedAt);
        Assert.Equal(saved.CreatedAt, saved.StatusChanges[0].ChangedAt);

        // Stored as names, so the data reads clearly.
        var medium = await fresh.Database
            .SqlQuery<string>($"""SELECT "Medium" AS "Value" FROM "Items" WHERE "Id" = {item.Id}""")
            .SingleAsync(cancellationToken);
        Assert.Equal("Book", medium);
    }

    [Fact]
    public async Task Allows_no_creator()
    {
        await using var db = NewContext();
        db.Items.Add(NewItem(await CreateUserAsync(db), creator: null));
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(LibraryRules.MaxTitleLength + 1)]
    public async Task Refuses_a_title_outside_1_to_200_characters(int length)
    {
        await using var db = NewContext();
        db.Items.Add(NewItem(await CreateUserAsync(db), title: new string('a', length)));
        await AssertRefusedByAsync(db, "CK_Items_Title_Length");
    }

    [Fact]
    public async Task Allows_a_title_and_creator_of_exactly_200_characters()
    {
        await using var db = NewContext();
        var longest = new string('a', LibraryRules.MaxTitleLength);
        db.Items.Add(NewItem(await CreateUserAsync(db), title: longest, creator: longest));
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(LibraryRules.MaxCreatorLength + 1)]
    public async Task Refuses_a_creator_that_is_empty_or_over_200_characters(int length)
    {
        await using var db = NewContext();
        db.Items.Add(NewItem(await CreateUserAsync(db), creator: new string('a', length)));
        await AssertRefusedByAsync(db, "CK_Items_Creator_Length");
    }

    [Theory]
    [InlineData("""INSERT INTO "Items" ("Id", "UserId", "Medium", "Title") VALUES (gen_random_uuid(), @user, 'Film', 'Alien')""", "CK_Items_Medium")]
    [InlineData("""INSERT INTO "StatusChanges" ("Id", "ItemId", "Status") VALUES (gen_random_uuid(), @item, 'Paused')""", "CK_StatusChanges_Status")]
    public async Task Refuses_a_medium_or_status_not_in_the_list(string sql, string constraint)
    {
        await using var db = NewContext();
        var cancellationToken = TestContext.Current.CancellationToken;
        var item = NewItem(await CreateUserAsync(db));
        db.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        // Raw SQL, since the enums can't hold a value outside the list.
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(
            sql,
            [new NpgsqlParameter("user", item.UserId), new NpgsqlParameter("item", item.Id)],
            cancellationToken));
        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Fact]
    public async Task Deleting_an_account_deletes_its_library()
    {
        await using var db = NewContext();
        var cancellationToken = TestContext.Current.CancellationToken;
        var userId = await CreateUserAsync(db);
        var item = NewItem(userId);
        db.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync(cancellationToken);

        Assert.False(await db.Items.AnyAsync(i => i.Id == item.Id, cancellationToken));
        Assert.False(await db.StatusChanges.AnyAsync(s => s.ItemId == item.Id, cancellationToken));
    }

    private static async Task AssertRefusedByAsync(SavepointDbContext db, string constraint)
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(
            () => db.SaveChangesAsync(TestContext.Current.CancellationToken));
        var postgresError = Assert.IsType<PostgresException>(error.InnerException);
        Assert.Equal(PostgresErrorCodes.CheckViolation, postgresError.SqlState);
        Assert.Equal(constraint, postgresError.ConstraintName);
    }
}
