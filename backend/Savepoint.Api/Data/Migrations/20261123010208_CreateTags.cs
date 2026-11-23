using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Savepoint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CreateTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    NormalizedName = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tags", x => x.Id);
                    table.CheckConstraint("CK_Tags_Name_Length", "char_length(\"Name\") BETWEEN 1 AND 40");
                    table.ForeignKey(
                        name: "FK_Tags_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReflectionTags",
                columns: table => new
                {
                    ReflectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReflectionTags", x => new { x.ReflectionId, x.TagId });
                    table.ForeignKey(
                        name: "FK_ReflectionTags_Reflections_ReflectionId",
                        column: x => x.ReflectionId,
                        principalTable: "Reflections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReflectionTags_Tags_TagId",
                        column: x => x.TagId,
                        principalTable: "Tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReflectionTags_TagId",
                table: "ReflectionTags",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_Tags_UserId_NormalizedName",
                table: "Tags",
                columns: new[] { "UserId", "NormalizedName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReflectionTags");

            migrationBuilder.DropTable(
                name: "Tags");
        }
    }
}
