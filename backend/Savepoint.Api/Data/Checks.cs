namespace Savepoint.Api.Data;

/// <summary>SQL for check constraints that more than one part of the model needs.</summary>
internal static class Checks
{
    // A check that a column holds one of an enum's names, built from the enum so
    // the two can't drift apart: a new value changes the model, and so the next
    // migration.
    public static string OneOf<TEnum>(string column) where TEnum : struct, Enum =>
        $"\"{column}\" IN ({string.Join(", ", Enum.GetNames<TEnum>().Select(name => $"'{name}'"))})";
}
