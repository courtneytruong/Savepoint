using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Savepoint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionUpdatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Sessions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            // Sessions saved before this had no edits it could know of. Left at now(),
            // every one of them would look edited.
            migrationBuilder.Sql("UPDATE \"Sessions\" SET \"UpdatedAt\" = \"CreatedAt\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Sessions");
        }
    }
}
