import { useEffect, useState } from 'react'
import { getActivity } from '../api/activity.js'
import { ActivityCalendar, Button, EmptyState, Heading, Skeleton, SkeletonGroup } from '../components/index.js'
import { CalendarIcon, ErrorIcon } from '../components/icons.js'
import { LIBRARY_PATH } from '../paths.js'
import { buildActivityTimeline } from '../rules/activityTimeline.js'
import { AppLayout } from './AppLayout.jsx'
import styles from './CalendarPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// Five weeks of day boxes while it loads.
const LOADING_DAYS = Array.from({ length: 35 }, (_, index) => index)

/**
 * What happened across the library, a month at a time, day by day: sessions and
 * reflections as dots in their moods, other changes as a ring, and the chosen day's
 * entries as timeline cards, each naming its book or game.
 */
export function CalendarPage({ account, onSignedOut }) {
  // loading, failed or ready, with the entries once ready, oldest first.
  const [loaded, setLoaded] = useState({ state: 'loading', entries: [] })
  const [tries, setTries] = useState(0)

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

  const { state, entries } = loaded

  let content
  if (state === 'loading') {
    content = (
      <SkeletonGroup label="Loading your calendar" className={styles.loading}>
        {LOADING_DAYS.map((day) => (
          <Skeleton key={day} height="76px" />
        ))}
      </SkeletonGroup>
    )
  } else if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load your calendar"
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
  } else if (entries.length === 0) {
    content = (
      <EmptyState
        icon={<CalendarIcon />}
        title="Nothing on your calendar yet"
        headingAs="h2"
        action={
          <Button variant="outline" href={LIBRARY_PATH}>
            Go to your library
          </Button>
        }
      >
        Add a book or game, and each session, reflection and change of heart shows up here, on the day it happened.
      </EmptyState>
    )
  } else {
    content = <ActivityCalendar entries={entries} headingAs="h2" />
  }

  return (
    <AppLayout account={account} onSignedOut={onSignedOut} current="calendar">
      <div className={styles.toolbar}>
        <Heading as="h1">Calendar</Heading>
      </div>
      <div className={styles.content}>{content}</div>
    </AppLayout>
  )
}
