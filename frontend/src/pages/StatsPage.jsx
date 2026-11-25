import { useEffect, useState } from 'react'
import { getActivity } from '../api/activity.js'
import { getItems } from '../api/items.js'
import {
  Button,
  EmptyState,
  FilterGroup,
  FilterPill,
  formatDuration,
  Heading,
  MonthlyPagesChart,
  MonthlyTimeChart,
  Skeleton,
  SkeletonGroup,
  StatGroup,
  StatTile,
  Text,
  useStoredChoice,
} from '../components/index.js'
import { BookIcon, ErrorIcon, GameIcon, PagesIcon, ReflectionIcon, StatsIcon, TimeIcon } from '../components/icons.js'
import { LIBRARY_PATH } from '../paths.js'
import { buildActivityTimeline } from '../rules/activityTimeline.js'
import { buildStats, RANGES } from '../rules/stats.js'
import { AppLayout } from './AppLayout.jsx'
import styles from './StatsPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// One placeholder for each headline tile while it loads.
const LOADING_TILES = [1, 2, 3, 4, 5]

const count = new Intl.NumberFormat()

// The mood written most often, or null with no reflections. A tie goes to the
// mood listed first, so the answer doesn't change from one load to the next.
function mostOften(moods) {
  const top = moods.reduce((best, mood) => (mood.count > best.count ? mood : best), { count: 0 })
  return top.count ? top.mood : null
}

const RANGE_VALUES = RANGES.map(([, value]) => value)

// How each range ends "No time logged …" and "No pages logged …".
const NOTHING_LOGGED = { year: 'this year', last12: 'in the last 12 months', all: 'yet' }

/**
 * Numbers about the library: what was finished, how long was spent, pages read
 * and reflections written, over the time range chosen. Worked out in the browser
 * from the library and its history, loaded at the same time, so changing the
 * range needs no new request.
 */
export function StatsPage({ account, onSignedOut }) {
  // loading, failed or ready, with the library and its history once ready.
  const [loaded, setLoaded] = useState({ state: 'loading', items: [], entries: [] })
  const [tries, setTries] = useState(0)
  // Remembered in this browser, like the library's view.
  const [range, setRange] = useStoredChoice('savepoint.stats.range', RANGE_VALUES, RANGE_VALUES[0])
  const [rangeLabel] = RANGES.find(([, value]) => value === range)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getItems({ signal: controller.signal }), getActivity({ signal: controller.signal })])
      .then(([items, activity]) => setLoaded({ state: 'ready', items, entries: buildActivityTimeline(activity) }))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLoaded({ state: 'failed', items: [], entries: [] })
      })
    return () => controller.abort()
  }, [tries])

  function tryAgain() {
    setLoaded({ state: 'loading', items: [], entries: [] })
    setTries((tried) => tried + 1)
  }

  const { state, items, entries } = loaded
  // The choice only means something once there's a library to count.
  const hasAny = state === 'ready' && items.length > 0

  let content
  if (state === 'loading') {
    content = (
      <SkeletonGroup label="Loading your stats" className={styles.loading}>
        {LOADING_TILES.map((tile) => (
          <Skeleton key={tile} height="118px" />
        ))}
      </SkeletonGroup>
    )
  } else if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load your stats"
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
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={<StatsIcon />}
        title="No stats yet"
        headingAs="h2"
        action={
          <Button variant="outline" href={LIBRARY_PATH}>
            Go to your library
          </Button>
        }
      >
        Add a book or game and log your sessions, and your reading and playing add up here.
      </EmptyState>
    )
  } else {
    const stats = buildStats({ items, entries, range })
    const minutes = stats.minutes.Book + stats.minutes.Game
    const mood = mostOften(stats.moods)

    content = (
      <>
        <section aria-labelledby="stats-headline" className={styles.section}>
          <Heading as="h2" id="stats-headline">
            {rangeLabel}
          </Heading>
          <StatGroup>
            <StatTile icon={<BookIcon />} label="Books finished" value={count.format(stats.finished.Book)} />
            <StatTile icon={<GameIcon />} label="Games finished" value={count.format(stats.finished.Game)} />
            <StatTile
              icon={<TimeIcon />}
              label="Time logged"
              value={formatDuration(minutes)}
              hint={
                minutes
                  ? `${formatDuration(stats.minutes.Book)} reading, ${formatDuration(stats.minutes.Game)} playing`
                  : undefined
              }
            />
            <StatTile icon={<PagesIcon />} label="Pages read" value={count.format(stats.pagesRead)} />
            <StatTile
              icon={<ReflectionIcon />}
              label="Reflections"
              value={count.format(stats.reflections)}
              hint={mood ? `Most often: ${mood}` : undefined}
            />
          </StatGroup>
        </section>
        <section aria-labelledby="stats-time" className={styles.section}>
          <Heading as="h2" id="stats-time">
            Time per month
          </Heading>
          {minutes ? (
            <MonthlyTimeChart months={stats.months} label={`Time logged each month, ${rangeLabel.toLowerCase()}`} />
          ) : (
            <Text>No time logged {NOTHING_LOGGED[range]}. Log a session to see it here.</Text>
          )}
        </section>
        <section aria-labelledby="stats-pages" className={styles.section}>
          <Heading as="h2" id="stats-pages">
            Pages read per month
          </Heading>
          {stats.pagesRead ? (
            <MonthlyPagesChart months={stats.months} label={`Pages read each month, ${rangeLabel.toLowerCase()}`} />
          ) : (
            <Text>No pages logged {NOTHING_LOGGED[range]}. Add pages read to a book session to see them here.</Text>
          )}
        </section>
      </>
    )
  }

  return (
    <AppLayout account={account} onSignedOut={onSignedOut} current="stats">
      <div className={styles.toolbar}>
        <Heading as="h1">Stats</Heading>
      </div>
      {hasAny && (
        <div className={styles.filters}>
          <FilterGroup label="Time range" showLabel>
            {RANGES.map(([label, value]) => (
              <FilterPill key={value} selected={range === value} onClick={() => setRange(value)}>
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
