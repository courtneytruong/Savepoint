using Microsoft.EntityFrameworkCore;
using Npgsql;
using Savepoint.Api.Accounts;
using Savepoint.Api.Data;
using Savepoint.Api.Library;
using Savepoint.Api.Sessions;

namespace Savepoint.Api.Tests;

/// <summary>
/// Checks that the database itself holds the session and reflection rules in
/// docs/data-model.md, so data that skips the API, or an API bug, still can't
/// break them.
/// </summary>
public class SessionsModelTests(PostgresFixture postgres)
{
    private const string Notes = "The crossing of the ice stayed with me.";

    private readonly CancellationToken cancellationToken = TestContext.Current.CancellationToken;

    private SavepointDbContext NewContext() =>
        new(new DbContextOptionsBuilder<SavepointDbContext>().UseNpgsql(postgres.ConnectionString).Options);

    // Each test has its own user and item, since the tests share one database.
    private async Task<Item> CreateItemAsync(SavepointDbContext db)
    {
        var user = new User { DisplayName = "Sessions test", Email = $"sessions-{Guid.NewGuid():N}@example.com" };
        db.Users.Add(user);
        var item = new Item
        {
            UserId = user.Id,
            Medium = Medium.Book,
            Title = "The Left Hand of Darkness",
            StatusChanges = { new StatusChange { Status = ItemStatus.InProgress } },
        };
        db.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        return item;
    }

    private static Session NewSession(
        Guid itemId, int durationMinutes = 45, int? pagesRead = 30, string notes = Notes) => new()
    {
        ItemId = itemId,
        Date = new DateOnly(2026, 11, 14),
        DurationMinutes = durationMinutes,
        PagesRead = pagesRead,
        Reflection = new Reflection { ItemId = itemId, Mood = Mood.Moved, Notes = notes },
    };

    [Fact]
    public async Task Saves_a_session_with_its_reflection_and_mood_named_in_words()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        var session = NewSession(item.Id);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        await using var fresh = NewContext();
        var saved = await fresh.Sessions.Include(s => s.Reflection).SingleAsync(s => s.Id == session.Id, cancellationToken);
        Assert.Equal(new DateOnly(2026, 11, 14), saved.Date);
        Assert.Equal(30, saved.PagesRead);
        Assert.NotNull(saved.Reflection);
        Assert.Equal(session.Id, saved.Reflection.SessionId);
        Assert.Equal(Mood.Moved, saved.Reflection.Mood);
        // The database's clock filled these in, in the same transaction, so they match.
        Assert.NotEqual(default, saved.CreatedAt);
        Assert.Equal(saved.CreatedAt, saved.Reflection.CreatedAt);
        Assert.Equal(saved.Reflection.CreatedAt, saved.Reflection.UpdatedAt);

        var mood = await fresh.Database
            .SqlQuery<string>($"""SELECT "Mood" AS "Value" FROM "Reflections" WHERE "SessionId" = {session.Id}""")
            .SingleAsync(cancellationToken);
        Assert.Equal("Moved", mood);
    }

    [Fact]
    public async Task Allows_no_page_count_and_the_longest_session()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Sessions.Add(NewSession(item.Id, durationMinutes: SessionRules.MaxDurationMinutes, pagesRead: null));
        await db.SaveChangesAsync(cancellationToken);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(SessionRules.MaxDurationMinutes + 1)]
    public async Task Refuses_a_duration_outside_1_to_1440_minutes(int minutes)
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Sessions.Add(NewSession(item.Id, durationMinutes: minutes));
        await AssertRefusedAsync(db, PostgresErrorCodes.CheckViolation, "CK_Sessions_DurationMinutes");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task Refuses_a_page_count_that_isnt_above_0(int pages)
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Sessions.Add(NewSession(item.Id, pagesRead: pages));
        await AssertRefusedAsync(db, PostgresErrorCodes.CheckViolation, "CK_Sessions_PagesRead");
    }

    [Theory]
    [InlineData(SessionRules.MinNotesLength - 1)]
    [InlineData(SessionRules.MaxNotesLength + 1)]
    public async Task Refuses_notes_outside_20_to_10000_characters(int length)
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Sessions.Add(NewSession(item.Id, notes: new string('a', length)));
        await AssertRefusedAsync(db, PostgresErrorCodes.CheckViolation, "CK_Reflections_Notes_Length");
    }

    [Theory]
    [InlineData(SessionRules.MinNotesLength)]
    [InlineData(SessionRules.MaxNotesLength)]
    public async Task Allows_notes_of_exactly_20_or_10000_characters(int length)
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Sessions.Add(NewSession(item.Id, notes: new string('a', length)));
        await db.SaveChangesAsync(cancellationToken);
    }

    [Fact]
    public async Task Refuses_a_mood_not_in_the_list()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);

        // Raw SQL, since the enum can't hold a value outside the list.
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(
            """INSERT INTO "Reflections" ("Id", "ItemId", "Mood", "Notes") VALUES (gen_random_uuid(), @item, 'Sleepy', @notes)""",
            [new NpgsqlParameter("item", item.Id), new NpgsqlParameter("notes", Notes)],
            cancellationToken));
        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("CK_Reflections_Mood", error.ConstraintName);
    }

    [Fact]
    public async Task Allows_a_reflection_with_no_session()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Reflections.Add(new Reflection { ItemId = item.Id, Mood = Mood.Curious, Notes = Notes });
        await db.SaveChangesAsync(cancellationToken);
    }

    [Fact]
    public async Task Refuses_a_reflection_on_a_session_for_another_item()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        var other = await CreateItemAsync(db);
        var session = NewSession(item.Id);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        // Raw SQL, since EF would fill in the session's own ItemId.
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO "Reflections" ("Id", "ItemId", "SessionId", "Mood", "Notes")
            VALUES (gen_random_uuid(), @item, @session, 'Moved', @notes)
            """,
            [
                new NpgsqlParameter("item", other.Id),
                new NpgsqlParameter("session", session.Id),
                new NpgsqlParameter("notes", Notes),
            ],
            cancellationToken));
        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal("FK_Reflections_Sessions_SessionId_ItemId", error.ConstraintName);
    }

    [Fact]
    public async Task Refuses_a_second_reflection_on_one_session()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        var session = NewSession(item.Id);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        // A fresh context, as the API would use. This one still tracks the session, so
        // EF would take the new reflection as a replacement and delete the first.
        await using var fresh = NewContext();
        fresh.Reflections.Add(new Reflection { ItemId = item.Id, SessionId = session.Id, Mood = Mood.Bored, Notes = Notes });
        await AssertRefusedAsync(fresh, PostgresErrorCodes.UniqueViolation, "IX_Reflections_SessionId_ItemId");
    }

    [Fact]
    public async Task Deleting_a_session_deletes_its_reflection()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        var session = NewSession(item.Id);
        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        await db.Sessions.Where(s => s.Id == session.Id).ExecuteDeleteAsync(cancellationToken);

        Assert.False(await db.Reflections.AnyAsync(r => r.ItemId == item.Id, cancellationToken));
    }

    [Fact]
    public async Task Deleting_an_item_deletes_its_sessions_and_reflections()
    {
        await using var db = NewContext();
        var item = await CreateItemAsync(db);
        db.Sessions.Add(NewSession(item.Id));
        db.Reflections.Add(new Reflection { ItemId = item.Id, Mood = Mood.Curious, Notes = Notes });
        await db.SaveChangesAsync(cancellationToken);

        await db.Items.Where(i => i.Id == item.Id).ExecuteDeleteAsync(cancellationToken);

        Assert.False(await db.Sessions.AnyAsync(s => s.ItemId == item.Id, cancellationToken));
        Assert.False(await db.Reflections.AnyAsync(r => r.ItemId == item.Id, cancellationToken));
    }

    private async Task AssertRefusedAsync(SavepointDbContext db, string sqlState, string constraint)
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync(cancellationToken));
        var postgresError = Assert.IsType<PostgresException>(error.InnerException);
        Assert.Equal(sqlState, postgresError.SqlState);
        Assert.Equal(constraint, postgresError.ConstraintName);
    }
}
