// Lowercase, with accents removed, so "eloise" finds "Éloïse".
const simplify = (text = '') =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()

/**
 * Whether any of the fields contains what was typed, ignoring case and accents.
 * An empty query matches everything. Missing fields are skipped.
 */
export function matchesSearch(fields, query) {
  const wanted = simplify(query.trim())
  return !wanted || fields.some((field) => simplify(field).includes(wanted))
}

/**
 * The options matching what was typed, best matches first: titles that start with
 * it, then titles with a word that starts with it, then titles that contain it
 * anywhere, then options whose description (such as the author) contains it.
 * Within each group the options keep their order. An empty query matches all.
 */
export function filterOptions(options, query) {
  const wanted = simplify(query.trim())
  if (!wanted) return options

  const rank = (option) => {
    const label = simplify(option.label)
    if (label.startsWith(wanted)) return 0
    if (` ${label}`.includes(` ${wanted}`)) return 1
    if (label.includes(wanted)) return 2
    if (simplify(option.description).includes(wanted)) return 3
    return null
  }

  return options
    .map((option) => ({ option, rank: rank(option) }))
    .filter(({ rank }) => rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map(({ option }) => option)
}
