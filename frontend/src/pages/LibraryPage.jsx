import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { getItems } from '../api/items.js'
import {
  Button,
  EmptyState,
  FilterGroup,
  FilterPill,
  Heading,
  ItemCard,
  ItemGrid,
  matchesSearch,
  pageAfterResize,
  paginate,
  Pagination,
  SearchField,
  Select,
  SkeletonCard,
  SkeletonGroup,
  sortRows,
  Table,
  useStoredChoice,
  useStoredView,
  ViewToggle,
} from '../components/index.js'
import { ErrorIcon, LibraryIcon, NoResultsIcon } from '../components/icons.js'
import { libraryPath } from '../paths.js'
import { AppLayout } from './AppLayout.jsx'
import { LIBRARY_COLUMNS, MEDIUM_FILTERS, SORT_OPTIONS, STATUS_FILTERS } from './libraryColumns.jsx'
import styles from './LibraryPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// Whole rows of 2, 3 or 4 cards in the grid.
const PAGE_SIZES = [12, 24, 48]

const sortName = (sort) => `${sort.key}:${sort.direction}`

// A filter from the address, or null when it's missing or not one of the choices.
const choiceFrom = (params, name, filters) => {
  const value = params.get(name)
  return filters.some(([, choice]) => choice === value) ? value : null
}

/**
 * The signed-in person's books and games, in the list or grid view they chose
 * last. The type and status filters live in the address, as ?medium=Book and
 * ?status=InProgress, so the sidebar's shortcuts are links and Back undoes a
 * filter. Search, sort and page are only for this visit.
 */
export function LibraryPage({ account, onSignedOut }) {
  const [view, setView] = useStoredView()
  // loading, failed or ready, with the items once ready.
  const [library, setLibrary] = useState({ state: 'loading', items: [] })
  // Counting tries makes Try again load afresh, through the same effect.
  const [tries, setTries] = useState(0)

  const [params] = useSearchParams()
  const navigate = useNavigate()
  const medium = choiceFrom(params, 'medium', MEDIUM_FILTERS)
  const status = choiceFrom(params, 'status', STATUS_FILTERS)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0][1])
  const [pageSize, setPageSize] = useStoredChoice('savepoint.library.pageSize', PAGE_SIZES, PAGE_SIZES[0])

  // The page belongs to what's shown, so any change to it, including a sidebar
  // link changing the address, starts again from the first page.
  const shown = [medium, status, search, sortName(sort)].join('|')
  const [pageFor, setPageFor] = useState({ page: 1, shown })
  const page = pageFor.shown === shown ? pageFor.page : 1
  const setPage = (next) => setPageFor({ page: next, shown })

  useEffect(() => {
    const controller = new AbortController()
    getItems({ signal: controller.signal })
      .then((items) => setLibrary({ state: 'ready', items }))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLibrary({ state: 'failed', items: [] })
      })
    return () => controller.abort()
  }, [tries])

  function tryAgain() {
    setLibrary({ state: 'loading', items: [] })
    setTries((count) => count + 1)
  }

  const filterBy = (changes) => navigate(libraryPath({ medium, status, ...changes }))

  function clearSearchAndFilters() {
    setSearch('')
    if (medium || status) filterBy({ medium: null, status: null })
  }

  const { state, items } = library
  const loading = state === 'loading'
  const filtered = items.filter(
    (item) =>
      (!medium || item.medium === medium) &&
      (!status || item.status === status) &&
      matchesSearch([item.title, item.creator], search),
  )
  const paged = paginate(sortRows(filtered, LIBRARY_COLUMNS, sort), page, pageSize)
  const searching = search.trim() !== ''
  const filtering = medium !== null || status !== null

  let content
  if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load your library"
        headingAs="h3"
        action={
          <Button variant="outline" onClick={tryAgain}>
            Try again
          </Button>
        }
      >
        {FAILED_MESSAGE}
      </EmptyState>
    )
  } else if (state === 'ready' && items.length === 0) {
    content = (
      <EmptyState icon={<LibraryIcon />} title="Your library is empty" headingAs="h3">
        Add a book or game to get started.
      </EmptyState>
    )
  } else if (state === 'ready' && filtered.length === 0) {
    content = (
      <EmptyState
        icon={<NoResultsIcon />}
        title={searching ? `Nothing matches “${search.trim()}”` : 'Nothing matches those filters'}
        headingAs="h3"
        action={
          <Button variant="outline" onClick={clearSearchAndFilters}>
            {searching && filtering ? 'Clear search and filters' : searching ? 'Clear search' : 'Clear filters'}
          </Button>
        }
      >
        {searching
          ? 'Search looks at titles and creators. Check the spelling, or try part of a word.'
          : 'Try removing a filter to see more of your library.'}
      </EmptyState>
    )
  } else if (view === 'list') {
    content = (
      <Table
        caption="Your library"
        columns={LIBRARY_COLUMNS}
        rows={paged.pageRows}
        loading={loading}
        loadingRows={3}
        sort={sort}
        onSortChange={setSort}
      />
    )
  } else if (loading) {
    content = (
      <SkeletonGroup label="Loading your library" className={styles.loadingGrid}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </SkeletonGroup>
    )
  } else {
    content = (
      <ItemGrid className={styles.grid}>
        {paged.pageRows.map((item) => (
          <ItemCard key={item.id} {...item} />
        ))}
      </ItemGrid>
    )
  }

  const counted = state === 'ready'
  const countOf = (wanted) => (counted ? items.filter((item) => item.medium === wanted).length : undefined)

  return (
    <AppLayout
      account={account}
      onSignedOut={onSignedOut}
      medium={medium}
      counts={{ library: counted ? items.length : undefined, Book: countOf('Book'), Game: countOf('Game') }}
    >
      <div className={styles.toolbar}>
        <Heading as="h2">Library</Heading>
        <SearchField
          label="Search your library"
          placeholder="Search by title or creator"
          className={styles.search}
          value={search}
          onChange={setSearch}
        />
        <ViewToggle value={view} onChange={setView} />
      </div>
      <div className={styles.filters}>
        <FilterGroup label="Filter by type">
          {MEDIUM_FILTERS.map(([label, value]) => (
            <FilterPill key={label} selected={medium === value} onClick={() => filterBy({ medium: value })}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>
        <FilterGroup label="Filter by status">
          {STATUS_FILTERS.map(([label, value]) => (
            <FilterPill key={label} selected={status === value} onClick={() => filterBy({ status: value })}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>
        {view === 'grid' && (
          <Select
            label="Sort by"
            className={styles.sort}
            value={sortName(sort)}
            onChange={(event) => setSort(SORT_OPTIONS.find(([, option]) => sortName(option) === event.target.value)[1])}
          >
            {/* A header sort with no matching option, such as by type, shows as its own entry. */}
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
      {content}
      {counted && filtered.length > 0 && (
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
      )}
    </AppLayout>
  )
}
