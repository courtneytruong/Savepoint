import { useState } from 'react'
import {
  Button,
  EmptyState,
  FilterGroup,
  FilterPill,
  Heading,
  ItemCard,
  matchesSearch,
  SearchField,
  ItemGrid,
  pageAfterResize,
  paginate,
  Pagination,
  Select,
  sortRows,
  Table,
  useStoredChoice,
  useStoredView,
  ViewToggle,
} from '../components/index.js'
import { classNames } from '../components/classNames.js'
import { NoResultsIcon } from '../components/icons.js'
import styles from './LibraryDemo.module.css'
import { SAMPLE_COLUMNS, SAMPLE_ITEMS, SORT_OPTIONS } from './sampleData.jsx'

const PAGE_SIZES = [3, 6, 12]

const MEDIUM_FILTERS = [
  ['All', null],
  ['Books', 'Book'],
  ['Games', 'Game'],
]

const STATUS_FILTERS = [
  ['Any status', null],
  ['Backlog', 'Backlog'],
  ['In progress', 'InProgress'],
  ['Finished', 'Finished'],
  ['Dropped', 'Dropped'],
]

const sortName = (sort) => sort && `${sort.key}:${sort.direction}`

/**
 * A working mock of the library: filters, sorting, pages, and the list and grid
 * views. Both views share one sort, so switching keeps the same order.
 */
export function LibraryDemo() {
  const [view, setView] = useStoredView()
  const [search, setSearch] = useState('')
  const [medium, setMedium] = useState(null)
  const [status, setStatus] = useState(null)
  const [sort, setSort] = useState(SORT_OPTIONS[0][1])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useStoredChoice('savepoint.library.pageSize', PAGE_SIZES, 6)

  // Any change to what's shown starts again from the first page.
  const update = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const filtered = SAMPLE_ITEMS.filter(
    (item) =>
      (!medium || item.medium === medium) &&
      (!status || item.status === status) &&
      matchesSearch([item.title, item.creator], search),
  )
  const paged = paginate(sortRows(filtered, SAMPLE_COLUMNS, sort), page, pageSize)
  const searching = search.trim() !== ''
  const filtering = medium !== null || status !== null

  const noMatches = (
    <EmptyState
      icon={<NoResultsIcon />}
      title={searching ? `Nothing matches “${search.trim()}”` : 'Nothing matches those filters'}
      headingAs="h3"
      action={
        <Button
          variant="outline"
          onClick={() => {
            update(setSearch)('')
            setMedium(null)
            setStatus(null)
          }}
        >
          {searching && filtering ? 'Clear search and filters' : searching ? 'Clear search' : 'Clear filters'}
        </Button>
      }
    >
      {searching
        ? 'Search looks at titles and creators. Check the spelling, or try part of a word.'
        : 'Try removing a filter to see more of your library.'}
    </EmptyState>
  )

  return (
    <div>
      <div className={classNames(styles.toolbar, styles.libraryToolbar)}>
        <Heading as="h2">Library</Heading>
        <SearchField
          label="Search your library"
          placeholder="Search by title or creator"
          className={styles.search}
          value={search}
          onChange={update(setSearch)}
        />
        <ViewToggle value={view} onChange={setView} />
      </div>
      <div className={styles.filters}>
        <FilterGroup label="Filter by type">
          {MEDIUM_FILTERS.map(([label, value]) => (
            <FilterPill key={label} selected={medium === value} onClick={() => update(setMedium)(value)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>
        <FilterGroup label="Filter by status">
          {STATUS_FILTERS.map(([label, value]) => (
            <FilterPill key={label} selected={status === value} onClick={() => update(setStatus)(value)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>
        {view === 'grid' && (
          <Select
            label="Sort by"
            className={styles.sort}
            value={sortName(sort)}
            onChange={(event) =>
              update(setSort)(SORT_OPTIONS.find(([, option]) => sortName(option) === event.target.value)[1])
            }
          >
            {/* A header sort with no matching option, such as by mood, shows as its own entry. */}
            {!SORT_OPTIONS.some(([, option]) => sortName(option) === sortName(sort)) && (
              <option value={sortName(sort)} disabled>
                Sorted from the list view
              </option>
            )}
            {SORT_OPTIONS.map(([label, option]) => (
              <option key={label} value={sortName(option)}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </div>
      {filtered.length === 0 ? (
        noMatches
      ) : view === 'list' ? (
        <Table
          caption="Your library"
          columns={SAMPLE_COLUMNS}
          rows={paged.pageRows}
          sort={sort}
          onSortChange={update(setSort)}
        />
      ) : (
        <ItemGrid className={styles.grid}>
          {paged.pageRows.map((item) => (
            <ItemCard key={item.id} href="#item" {...item} />
          ))}
        </ItemGrid>
      )}
      <Pagination
        className={styles.pagination}
        label="Library pages"
        page={paged.page}
        pageCount={paged.pageCount}
        first={paged.first}
        last={paged.last}
        total={paged.total}
        onPageChange={setPage}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZES}
        onPageSizeChange={(size) => {
          setPageSize(size)
          // Keeps the first item that was showing still in view.
          setPage(pageAfterResize(paged.first, size))
        }}
      />
    </div>
  )
}
