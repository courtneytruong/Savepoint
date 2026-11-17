using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Savepoint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CreateSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    PagesRead = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                    table.UniqueConstraint("AK_Sessions_Id_ItemId", x => new { x.Id, x.ItemId });
                    table.CheckConstraint("CK_Sessions_DurationMinutes", "\"DurationMinutes\" BETWEEN 1 AND 1440");
                    table.CheckConstraint("CK_Sessions_PagesRead", "\"PagesRead\" > 0");
                    table.ForeignKey(
                        name: "FK_Sessions_Items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Reflections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Mood = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reflections", x => x.Id);
                    table.CheckConstraint("CK_Reflections_Mood", "\"Mood\" IN ('Hooked', 'Delighted', 'Moved', 'Curious', 'Frustrated', 'Bored')");
                    table.CheckConstraint("CK_Reflections_Notes_Length", "char_length(\"Notes\") BETWEEN 20 AND 10000");
                    table.ForeignKey(
                        name: "FK_Reflections_Items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reflections_Sessions_SessionId_ItemId",
                        columns: x => new { x.SessionId, x.ItemId },
                        principalTable: "Sessions",
                        principalColumns: new[] { "Id", "ItemId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reflections_ItemId",
                table: "Reflections",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_Reflections_SessionId_ItemId",
                table: "Reflections",
                columns: new[] { "SessionId", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_ItemId_Date",
                table: "Sessions",
                columns: new[] { "ItemId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reflections");

            migrationBuilder.DropTable(
                name: "Sessions");
        }
    }
}
