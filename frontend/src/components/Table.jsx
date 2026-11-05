import { useState } from 'react'
import { SortAscendingIcon, SortDescendingIcon, SortIcon } from './icons.js'
import { Skeleton } from './Skeleton.jsx'
import styles from './Table.module.css'
import { classNames } from './classNames.js'
import { nextSort, sortRows } from './tableSort.js'

const SORT_ICONS = { ascending: SortAscendingIcon, descending: SortDescendingIcon }

/**
 * A data table.
 *
 * columns: { key, header, render?, align?: 'end', hideOnMobile?, sortable?,
 * sortValue?, sortFirst?: 'descending' }. Without render, a cell shows row[key].
 * Without sortValue, a sortable column sorts by row[key].
 * caption: names the table for screen readers. It isn't shown on screen.
 * loading: shows placeholder rows. empty: shown instead of a table with no rows.
 *
 * Sorting: by default the table sorts its own rows, starting from defaultSort.
 * To share the order with something else, such as a grid or pagination, pass
 * sort and onSortChange, and sort the rows yourself with sortRows.
 */
export function Table({
  columns,
  rows = [],
  rowKey = 'id',
  caption,
  loading = false,
  loadingRows = 5,
  empty,
  sort: controlledSort,
  onSortChange,
  defaultSort = null,
  className,
  ...props
}) {
  const [ownSort, setOwnSort] = useState(defaultSort)
  const controlled = onSortChange !== undefined
  const sort = controlled ? controlledSort : ownSort
  const setSort = controlled ? onSortChange : setOwnSort
  const shownRows = controlled ? rows : sortRows(rows, columns, sort)

  if (!loading && rows.length === 0 && empty) return empty

  const columnClass = ({ align, hideOnMobile }) =>
    classNames(align === 'end' && styles.alignEnd, hideOnMobile && styles.hideOnMobile) || undefined

  function header(column) {
    if (!column.sortable) return column.header
    const direction = sort?.key === column.key ? sort.direction : null
    const Icon = SORT_ICONS[direction] ?? SortIcon

    return (
      <button
        type="button"
        className={classNames(styles.sortButton, direction && styles.sorted)}
        onClick={() => setSort(nextSort(sort, column))}
      >
        {column.header}
        <Icon aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className={classNames(styles.wrapper, className)}>
      {loading && (
        <span role="status" className={styles.visuallyHidden}>
          Loading {caption}
        </span>
      )}
      <table className={styles.table} aria-busy={loading || undefined} {...props}>
        {caption && <caption className={styles.visuallyHidden}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sortable && sort?.key === column.key ? sort.direction : undefined}
                className={columnClass(column)}
              >
                {header(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }, (_, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.key} className={columnClass(column)}>
                      <Skeleton width="70%" />
                    </td>
                  ))}
                </tr>
              ))
            : shownRows.map((row) => (
                <tr key={row[rowKey]}>
                  {columns.map((column) => (
                    <td key={column.key} className={columnClass(column)}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
