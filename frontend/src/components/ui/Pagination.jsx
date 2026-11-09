import { useId } from 'react'
import { NextIcon, PreviousIcon } from '../icons.js'
import styles from './Pagination.module.css'
import { classNames } from '../../utils/classNames.js'
import { pageRange } from '../../utils/pagination.js'

/**
 * Moves between pages.
 *
 * first, last and total describe what's shown, as in "6–10 of 23", which is
 * announced to screen readers when the page changes. paginate gives all of these.
 *
 * Pass pageSize, pageSizeOptions and onPageSizeChange to let people choose how
 * many show at once. Without them, it shows nothing when everything fits on one
 * page. With them, it stays while a smaller page size would still split the list.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  first,
  last,
  total,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  label = 'Pagination',
  className,
}) {
  const sizeId = useId()
  const canChooseSize = Boolean(onPageSizeChange && pageSizeOptions?.length)
  const sizeMatters = canChooseSize && total > Math.min(...pageSizeOptions)
  if (pageCount <= 1 && !sizeMatters) return null

  return (
    <nav aria-label={label} className={classNames(styles.pagination, className)}>
      <div className={styles.info}>
        {total !== undefined && (
          <p className={styles.summary} aria-live="polite">
            {first}–{last} of {total}
          </p>
        )}
        {sizeMatters && (
          <div className={styles.size}>
            <label htmlFor={sizeId}>Show</label>
            <select
              id={sizeId}
              className={styles.select}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span aria-hidden="true">per page</span>
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <ul className={styles.pages}>
          <li>
            <button
              type="button"
              aria-label="Previous page"
              className={styles.step}
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              <PreviousIcon aria-hidden="true" />
            </button>
          </li>
          {pageRange(page, pageCount).map((number, index) =>
            number === 'gap' ? (
              <li key={`gap-${index}`} className={styles.gap} aria-hidden="true">
                …
              </li>
            ) : (
              <li key={number}>
                <button
                  type="button"
                  aria-label={`Page ${number}`}
                  aria-current={number === page ? 'page' : undefined}
                  className={classNames(styles.page, number === page && styles.current)}
                  onClick={() => onPageChange(number)}
                >
                  {number}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              aria-label="Next page"
              className={styles.step}
              disabled={page === pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <NextIcon aria-hidden="true" />
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}
