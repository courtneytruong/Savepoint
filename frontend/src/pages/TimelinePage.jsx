import { useEffect, useState } from 'react'
import { getActivity } from '../api/activity.js'
import { Button, EmptyState, Heading, Timeline, TimelineOrderToggle, useTimelineOrder } from '../components/index.js'
import { ErrorIcon, TimelineIcon } from '../components/icons.js'
import { LIBRARY_PATH } from '../paths.js'
import { buildActivityTimeline } from '../rules/activityTimeline.js'
import { AppLayout } from './AppLayout.jsx'
import styles from './TimelinePage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// How many entries show at first, and how many more each press of Show more adds.
// Page numbers would cut months in half, so the list only grows.
const STEP = 50

/**
 * Everything that happened across the library, newest first unless chosen
 * otherwise, grouped by month: items added, status and rating changes, sessions
 * and standalone reflections, each naming its book or game.
 */
export function TimelinePage({ account, onSignedOut }) {
  // loading, failed or ready, with the entries once ready, oldest first.
  const [loaded, setLoaded] = useState({ state: 'loading', entries: [] })
  const [tries, setTries] = useState(0)
  const [order, setOrder] = useTimelineOrder()
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

  const { state, entries } = loaded
  const total = entries.length
  // The first ones in reading order: the newest, or the oldest.
  const shown = order === 'oldest' ? entries.slice(0, count) : entries.slice(-count)
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
        {state === 'ready' && total > 0 && (
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
        {state === 'ready' && total > 0 && <TimelineOrderToggle value={order} onChange={setOrder} />}
      </div>
      <div className={styles.content}>{content}</div>
    </AppLayout>
  )
}
