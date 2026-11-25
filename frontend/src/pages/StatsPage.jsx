import { useEffect, useState } from 'react'
import { getActivity } from '../api/activity.js'
import { getItems } from '../api/items.js'
import {
  Button,
  EmptyState,
  formatDuration,
  Heading,
  Skeleton,
  SkeletonGroup,
  StatGroup,
  StatTile,
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

/**
 * Numbers about the library: what was finished, how long was spent, pages read
 * and reflections written. Worked out in the browser from the library and its
 * history, loaded at the same time.
 */
export function StatsPage({ account, onSignedOut }) {
  // loading, failed or ready, with the library and its history once ready.
  const [loaded, setLoaded] = useState({ state: 'loading', items: [], entries: [] })
  const [tries, setTries] = useState(0)
  const [rangeLabel, range] = RANGES[0]

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
    )
  }

  return (
    <AppLayout account={account} onSignedOut={onSignedOut} current="stats">
      <div className={styles.toolbar}>
        <Heading as="h1">Stats</Heading>
      </div>
      <div className={styles.content}>{content}</div>
    </AppLayout>
  )
}
