/** Splits rows into pages, and keeps the page in range if the rows shrink. */
export function paginate(rows, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const start = (currentPage - 1) * pageSize

  return {
    pageRows: rows.slice(start, start + pageSize),
    page: currentPage,
    pageCount,
    first: rows.length === 0 ? 0 : start + 1,
    last: Math.min(start + pageSize, rows.length),
    total: rows.length,
  }
}

/** The page that keeps the first item in view after the page size changes. */
export function pageAfterResize(first, pageSize) {
  return Math.floor(Math.max(first - 1, 0) / pageSize) + 1
}

/**
 * The page numbers to show. With many pages, it keeps the first, the last and
 * those next to the current one, and puts a gap ('gap') in place of the rest.
 * Gaps only replace two or more pages, since a gap for one page saves nothing.
 */
export function pageRange(page, pageCount) {
  const shown = new Set([1, pageCount, page - 1, page, page + 1])
  // Near the ends, show two neighbours on the inner side, so the count of
  // buttons stays about the same and the controls don't jump around.
  if (page <= 3) shown.add(4).add(5)
  if (page >= pageCount - 2) shown.add(pageCount - 3).add(pageCount - 4)

  const pages = [...shown].filter((number) => number >= 1 && number <= pageCount).sort((a, b) => a - b)
  const range = []
  for (const number of pages) {
    const previous = range.at(-1)
    if (typeof previous === 'number' && number - previous === 2) range.push(previous + 1)
    else if (typeof previous === 'number' && number - previous > 2) range.push('gap')
    range.push(number)
  }
  return range
}
