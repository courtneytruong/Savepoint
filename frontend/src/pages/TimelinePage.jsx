import { useEffect, useState } from 'react'
import { getActivity } from '../api/activity.js'
import {
  Button,
  EmptyState,
  FilterDivider,
  FilterGroup,
  FilterPill,
  Heading,
  Timeline,
  TimelineOrderToggle,
  useTimelineOrder,
} from '../components/index.js'
import { ErrorIcon, NoResultsIcon, TimelineIcon } from '../components/icons.js'
import { LIBRARY_PATH } from '../paths.js'
import { buildActivityTimeline } from '../rules/activityTimeline.js'
import { AppLayout } from './AppLayout.jsx'
import styles from './TimelinePage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// How many entries show at first, and how many more each press of Show more adds.
// Page numbers would cut months in half, so the list only grows.
const STEP = 50

const MEDIUM_FILTERS = [
  ['All', null],
  ['Books', 'Book'],
  ['Games', 'Game'],
]

// By the timeline's entry types. Status changes include an item being added.
const KIND_FILTERS = [
  ['Everything', null],
  ['Sessions', 'session'],
  ['Reflections', 'reflection'],
  ['Status changes', 'status'],
  ['Ratings', 'rating'],
]

/**
 * Everything that happened across the library, newest first unless chosen
 * otherwise, grouped by month: items added, status and rating changes, sessions
 * and standalone reflections, each naming its book or game. Filtered by type and
 * by kind in the browser, as the other pages are.
 */
export function TimelinePage({ account, onSignedOut }) {
  // loading, failed or ready, with the entries once ready, oldest first.
  const [loaded, setLoaded] = useState({ state: 'loading', entries: [] })
  const [tries, setTries] = useState(0)
  const [order, setOrder] = useTimelineOrder()
  const [medium, setMedium] = useState(null)
  const [kind, setKind] = useState(null)
  const [count, setCount] = useState(STEP)

  useEffect(() => {
    const controller = new AbortController()
    getActivity({ signal: controller.signal })
      .then((activity) => setLoaded({ state: 'ready', entries: buildActivityTimeline(activity) }))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLoaded({ state: 'failed', entries: [] })
      })
    return () => controller.abort()
  }, [tries])

  function tryAgain() {
    setLoaded({ state: 'loading', entries: [] })
    setTries((count) => count + 1)
  }

  // A change to what's shown starts again from the first ones.
  const filterBy = (setter) => (value) => {
    setter(value)
    setCount(STEP)
  }

  function clearFilters() {
    setMedium(null)
    setKind(null)
    setCount(STEP)
  }

  const { state, entries } = loaded
  const hasAny = state === 'ready' && entries.length > 0
  const matching = entries.filter(
    (entry) => (!medium || entry.item.medium === medium) && (!kind || entry.type === kind),
  )
  const total = matching.length
  // The first ones in reading order: the newest, or the oldest.
  const shown = order === 'oldest' ? matching.slice(0, count) : matching.slice(-count)
  const more = Math.min(STEP, total - shown.length)

  let content
  if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load your timeline"
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
  } else if (hasAny && total === 0) {
    content = (
      <EmptyState
        icon={<NoResultsIcon />}
        title="Nothing matches those filters"
        headingAs="h2"
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      >
        Try another type or kind, or remove a filter to see more.
      </EmptyState>
    )
  } else {
    content = (
      <>
        <Timeline
          entries={shown}
          order={order}
          loading={state === 'loading'}
          headingAs="h2"
          empty={
            <EmptyState
              icon={<TimelineIcon />}
              title="Nothing on your timeline yet"
              headingAs="h2"
              action={
                <Button variant="outline" href={LIBRARY_PATH}>
                  Go to your library
                </Button>
              }
            >
              Add a book or game, and everything you do with it shows up here: sessions, reflections and changes of
              heart.
            </EmptyState>
          }
        />
        {hasAny && (
          <div className={styles.more}>
            <p role="status">
              Showing {shown.length.toLocaleString()} of {total.toLocaleString()}
            </p>
            {more > 0 && (
              <Button variant="outline" onClick={() => setCount((current) => current + STEP)}>
                Show {more} {order === 'oldest' ? 'later' : 'earlier'}
              </Button>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <AppLayout account={account} onSignedOut={onSignedOut} current="timeline">
      <div className={styles.toolbar}>
        <Heading as="h1">Timeline</Heading>
        {hasAny && <TimelineOrderToggle value={order} onChange={setOrder} />}
      </div>
      {hasAny && (
        <div className={styles.filters}>
          <FilterGroup label="Filter by type" showLabel>
            {MEDIUM_FILTERS.map(([label, value]) => (
              <FilterPill key={label} selected={medium === value} onClick={() => filterBy(setMedium)(value)}>
                {label}
              </FilterPill>
            ))}
          </FilterGroup>
          <FilterDivider />
          <FilterGroup label="Filter by kind" showLabel>
            {KIND_FILTERS.map(([label, value]) => (
              <FilterPill key={label} selected={kind === value} onClick={() => filterBy(setKind)(value)}>
                {label}
              </FilterPill>
            ))}
          </FilterGroup>
        </div>
      )}
      <div className={styles.content}>{content}</div>
    </AppLayout>
  )
}
