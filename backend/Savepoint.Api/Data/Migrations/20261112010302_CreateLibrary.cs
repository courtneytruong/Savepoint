using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Savepoint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CreateLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Medium = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Creator = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Items", x => x.Id);
                    table.CheckConstraint("CK_Items_Creator_Length", "char_length(\"Creator\") BETWEEN 1 AND 200");
                    table.CheckConstraint("CK_Items_Medium", "\"Medium\" IN ('Book', 'Game')");
                    table.CheckConstraint("CK_Items_Title_Length", "char_length(\"Title\") BETWEEN 1 AND 200");
                    table.ForeignKey(
                        name: "FK_Items_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StatusChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StatusChanges", x => x.Id);
                    table.CheckConstraint("CK_StatusChanges_Status", "\"Status\" IN ('Backlog', 'InProgress', 'Finished', 'Dropped')");
                    table.ForeignKey(
                        name: "FK_StatusChanges_Items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "Items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Items_UserId",
                table: "Items",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StatusChanges_ItemId_ChangedAt",
                table: "StatusChanges",
                columns: new[] { "ItemId", "ChangedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StatusChanges");

            migrationBuilder.DropTable(
                name: "Items");
        }
    }
}
