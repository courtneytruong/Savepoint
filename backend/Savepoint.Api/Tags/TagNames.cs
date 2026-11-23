using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Savepoint.Api.Tags;

/// <summary>
/// How tag names are tidied and compared. These follow the frontend's cleanTag and
/// simplify, so a tag the frontend suggests as the same is the same here.
/// </summary>
public static partial class TagNames
{
    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    /// <summary>
    /// The name as saved: its ends trimmed and runs of spaces made single. Composed
    /// (NFC) too, so an accent typed as one character or as two is stored alike.
    /// </summary>
    public static string Clean(string name) => Spaces().Replace(name.Trim(), " ").Normalize(NormalizationForm.FormC);

    /// <summary>
    /// The name without case or accents, so "Cozy", "cozy" and "Cózy" are one tag.
    /// Accents are split from their letters (NFD) and dropped.
    /// </summary>
    public static string Normalize(string name)
    {
        var letters = name
            .Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray();
        return new string(letters).ToLowerInvariant();
    }

    /// <summary>Counted as the database counts: by code point, so an emoji is one character.</summary>
    public static int Length(string name) => name.EnumerateRunes().Count();
}
