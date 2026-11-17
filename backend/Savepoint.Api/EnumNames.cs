namespace Savepoint.Api;

/// <summary>Reads enum values sent in requests, such as a status or a mood.</summary>
internal static class EnumNames
{
    // Only the exact names, such as "InProgress". Enum.TryParse alone would also take
    // "inprogress" with ignoreCase, or a number like "1".
    public static bool TryParse<TEnum>(string value, out TEnum parsed) where TEnum : struct, Enum
    {
        parsed = default;
        return Enum.GetNames<TEnum>().Contains(value) && Enum.TryParse(value, out parsed);
    }
}
