import { useEffect, useMemo, useState } from 'react'
import { getAllReflections } from '../api/reflections.js'
import {
  Button,
  Combobox,
  countMoods,
  EmptyState,
  FilterDivider,
  FilterGroup,
  FilterPill,
  filterReflections,
  Heading,
  MOODS,
  pageAfterResize,
  paginate,
  Pagination,
  ReflectionCard,
  SkeletonGroup,
  SkeletonText,
  useStoredChoice,
} from '../components/index.js'
import { ErrorIcon, NoResultsIcon, ReflectionIcon } from '../components/icons.js'
import { LIBRARY_PATH } from '../paths.js'
import { toLibraryReflections } from '../rules/libraryReflections.js'
import { AppLayout } from './AppLayout.jsx'
import styles from './ReflectionsPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

const PAGE_SIZES = [10, 20, 50]

const MEDIUM_FILTERS = [
  ['All', null],
  ['Books', 'Book'],
  ['Games', 'Game'],
]

// The typeahead needs a value for "no tag", and no tag can be empty, so '' is safe.
const ANY_TAG = ''

/**
 * Every reflection across the library, sessions' and standalone ones, newest
 * first, each naming and linking to its book or game. Filtered by type, mood and
 * tag in the browser, as the library is. The mood counts follow the other two
 * filters, so they show how often each mood comes up among what's shown.
 */
export function ReflectionsPage({ account, onSignedOut }) {
  // loading, failed or ready, with the reflections once ready.
  const [loaded, setLoaded] = useState({ state: 'loading', reflections: [] })
  const [tries, setTries] = useState(0)
  const [medium, setMedium] = useState(null)
  const [mood, setMood] = useState(null)
  const [tag, setTag] = useState(ANY_TAG)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useStoredChoice('savepoint.reflections.pageSize', PAGE_SIZES, PAGE_SIZES[0])

  useEffect(() => {
    const controller = new AbortController()
    getAllReflections({ signal: controller.signal })
      .then((reflections) => setLoaded({ state: 'ready', reflections: toLibraryReflections(reflections) }))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLoaded({ state: 'failed', reflections: [] })
      })
    return () => controller.abort()
  }, [tries])

  function tryAgain() {
    setLoaded({ state: 'loading', reflections: [] })
    setTries((count) => count + 1)
  }

  // Any change to what's shown starts again from the first page.
  const update = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  function clearFilters() {
    setMedium(null)
    setMood(null)
    setTag(ANY_TAG)
    setPage(1)
  }

  const { state, reflections: all } = loaded

  const tagOptions = useMemo(() => {
    const names = [...new Set(all.flatMap((reflection) => reflection.tags ?? []))].sort((a, b) => a.localeCompare(b))
    return [{ value: ANY_TAG, label: 'Any tag' }, ...names.map((name) => ({ value: name, label: `#${name}` }))]
  }, [all])

  const beforeMood = filterReflections(all, { medium, tag: tag || null })
  const counts = countMoods(beforeMood)
  const shown = filterReflections(beforeMood, { mood })
  const paged = paginate(shown, page, pageSize)
  const hasAny = state === 'ready' && all.length > 0

  let content
  if (state === 'loading') {
    content = (
      <SkeletonGroup label="Loading your reflections" className={styles.loading}>
        <SkeletonText lines={3} />
        <SkeletonText lines={3} />
        <SkeletonText lines={3} />
      </SkeletonGroup>
    )
  } else if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load your reflections"
        headingAs="h2"
        action={
          <Button variant="outline" onClick={tryAgain}>
            Try again
          </Button>
        }
      >
        {FAILED_MESSAGE}
      </EmptyState>
    )
  } else if (!hasAny) {
    content = (
      <EmptyState
        icon={<ReflectionIcon />}
        title="No reflections yet"
        headingAs="h2"
        action={
          <Button variant="outline" href={LIBRARY_PATH}>
            Go to your library
          </Button>
        }
      >
        Log a session, or write a reflection on any book or game from its page, and it will show up here.
      </EmptyState>
    )
  } else if (shown.length === 0) {
    content = (
      <EmptyState
        icon={<NoResultsIcon />}
        title="No reflections match those filters"
        headingAs="h2"
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      >
        Try another mood or tag, or remove a filter to see more.
      </EmptyState>
    )
  } else {
    content = (
      <ul className={styles.list} aria-label="Reflections">
        {paged.pageRows.map((reflection) => (
          <li key={reflection.key}>
            <ReflectionCard
              item={reflection.item}
              headingAs="h2"
              date={reflection.day}
              session={reflection.session}
              mood={reflection.mood}
              notes={reflection.notes}
              tags={reflection.tags}
              loggedOn={reflection.loggedOn}
              editedAt={reflection.editedAt}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <AppLayout
      account={account}
      onSignedOut={onSignedOut}
      current="reflections"
      counts={{ reflections: state === 'ready' ? all.length : undefined }}
    >
      <div className={styles.toolbar}>
        <Heading as="h1">Reflections</Heading>
        {hasAny && (
          <Combobox
            label="Tag"
            className={styles.tag}
            options={tagOptions}
            value={tag}
            onChange={update(setTag)}
            emptyMessage="No tags match"
          />
        )}
      </div>

      {hasAny && (
        <div className={styles.filters}>
          <FilterGroup label="Filter by type" showLabel>
            {MEDIUM_FILTERS.map(([label, value]) => (
              <FilterPill key={label} selected={medium === value} onClick={() => update(setMedium)(value)}>
                {label}
              </FilterPill>
            ))}
          </FilterGroup>
          <FilterDivider />
          <FilterGroup label="Filter by mood" showLabel>
            <FilterPill selected={mood === null} onClick={() => update(setMood)(null)}>
              Any mood
            </FilterPill>
            {MOODS.map(({ value, color, Icon }) => (
              <FilterPill
                key={value}
                color={color}
                selected={mood === value}
                count={counts[value] ?? 0}
                // Pressing the chosen mood again goes back to any mood.
                onClick={() => update(setMood)(mood === value ? null : value)}
              >
                <Icon aria-hidden="true" />
                {value}
              </FilterPill>
            ))}
          </FilterGroup>
        </div>
      )}

      {content}

      {hasAny && shown.length > 0 && (
        <Pagination
          className={styles.pagination}
          label="Reflection pages"
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
            // Keeps the first reflection that was showing still in view.
            setPage(pageAfterResize(paged.first, size))
          }}
        />
      )}
    </AppLayout>
  )
}
