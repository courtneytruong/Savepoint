import { useMemo, useState } from 'react'
import {
  Button,
  Combobox,
  countMoods,
  EmptyState,
  FilterGroup,
  FilterPill,
  filterReflections,
  Heading,
  MOODS,
  pageAfterResize,
  paginate,
  Pagination,
  ReflectionCard,
  useStoredChoice,
} from '../components/index.js'
import { NoResultsIcon, ReflectionIcon } from '../components/icons.js'
import styles from './LibraryDemo.module.css'
import { makeSampleReflections } from './sampleData.jsx'

const PAGE_SIZES = [5, 10, 20]

const MEDIUM_FILTERS = [
  ['All', null],
  ['Books', 'Book'],
  ['Games', 'Game'],
]

// The typeahead needs a value for "no tag", and no tag can be empty, so '' is safe.
const ANY_TAG = ''

/**
 * Every reflection across the library, newest first, filtered by medium, mood and
 * tag. The mood counts follow the other two filters, so they show how often each
 * mood comes up among what's shown.
 */
export function ReflectionsPage({ sessions }) {
  const all = useMemo(() => makeSampleReflections(sessions), [sessions])
  const [medium, setMedium] = useState(null)
  const [mood, setMood] = useState(null)
  const [tag, setTag] = useState(ANY_TAG)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useStoredChoice('savepoint.reflections.pageSize', PAGE_SIZES, 10)

  // Any change to what's shown starts again from the first page.
  const update = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const tagOptions = useMemo(() => {
    const names = [...new Set(all.flatMap((reflection) => reflection.tags ?? []))].sort((a, b) => a.localeCompare(b))
    return [{ value: ANY_TAG, label: 'Any tag' }, ...names.map((name) => ({ value: name, label: `#${name}` }))]
  }, [all])

  const beforeMood = filterReflections(all, { medium, tag: tag || null })
  const counts = countMoods(beforeMood)
  const shown = filterReflections(beforeMood, { mood })
  const paged = paginate(shown, page, pageSize)

  if (all.length === 0) {
    return (
      <div className={styles.page}>
        <EmptyState icon={<ReflectionIcon />} title="No reflections yet" headingAs="h2">
          Log a session, or write a final thought about something you&apos;ve finished, and it will show up here.
        </EmptyState>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Heading as="h2">Reflections</Heading>
        <Combobox
          label="Tag"
          className={styles.picker}
          options={tagOptions}
          value={tag}
          onChange={update(setTag)}
          emptyMessage="No tags match"
        />
      </div>

      <div className={styles.filters}>
        <FilterGroup label="Filter by type">
          {MEDIUM_FILTERS.map(([label, value]) => (
            <FilterPill key={label} selected={medium === value} onClick={() => update(setMedium)(value)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>
        <FilterGroup label="Filter by mood">
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

      {shown.length === 0 ? (
        <EmptyState
          icon={<NoResultsIcon />}
          title="No reflections match those filters"
          headingAs="h3"
          action={
            <Button
              variant="outline"
              onClick={() => {
                update(setMedium)(null)
                setMood(null)
                setTag(ANY_TAG)
              }}
            >
              Clear filters
            </Button>
          }
        >
          Try another mood or tag, or remove a filter to see more.
        </EmptyState>
      ) : (
        <ul className={styles.reflectionList} aria-label="Reflections">
          {paged.pageRows.map((reflection) => (
            <li key={reflection.key}>
              <ReflectionCard
                item={reflection.item}
                date={reflection.day}
                session={reflection.session}
                mood={reflection.mood}
                notes={reflection.notes}
                tags={reflection.tags}
                loggedOn={reflection.loggedOn}
              />
            </li>
          ))}
        </ul>
      )}

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
    </div>
  )
}
