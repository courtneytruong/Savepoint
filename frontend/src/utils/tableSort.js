const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Sorts rows the way a table's column does, so a grid of the same rows can share
 * the order. A column sorts by sortValue(row) if it has one, otherwise row[key].
 * Rows with no value always go last, whichever way the sort runs.
 */
export function sortRows(rows, columns, sort) {
  if (!sort) return rows
  const column = columns.find(({ key }) => key === sort.key)
  if (!column) return rows

  const valueOf = column.sortValue ?? ((row) => row[column.key])
  const direction = sort.direction === 'descending' ? -1 : 1

  return [...rows].sort((a, b) => {
    const first = valueOf(a)
    const second = valueOf(b)
    const firstMissing = first === undefined || first === null || first === ''
    const secondMissing = second === undefined || second === null || second === ''
    if (firstMissing || secondMissing) return firstMissing - secondMissing

    const order =
      typeof first === 'number' && typeof second === 'number'
        ? first - second
        : collator.compare(String(first), String(second))
    return order * direction
  })
}

/**
 * The sort after a column's header is clicked. A new column starts with its
 * sortFirst direction (ascending unless set), and clicking again reverses it.
 */
export function nextSort(sort, column) {
  if (sort?.key === column.key) {
    return { key: column.key, direction: sort.direction === 'ascending' ? 'descending' : 'ascending' }
  }
  return { key: column.key, direction: column.sortFirst ?? 'ascending' }
}
