import { useEffect, useEffectEvent, useId, useState } from 'react'
import { editSession, getSessions, logSession } from '../api/sessions.js'
import {
  Alert,
  Button,
  EditSessionModal,
  Heading,
  LogSessionModal,
  ReflectionCard,
  SkeletonGroup,
  SkeletonText,
  Text,
  useToast,
  VisuallyHidden,
} from '../components/index.js'
import { EditIcon, ReflectionIcon } from '../components/icons.js'
import { newestFirst, wasLoggedLate } from '../rules/sessionList.js'
import { parseDateKey } from '../utils/calendarDates.js'
import styles from './ItemPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// For telling apart each card's buttons, as in "Edit the session from 14 Nov 2026".
const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const sessionDay = (session) => dayFormat.format(parseDateKey(session.date))

/**
 * The Sessions part of an item's page: every session with its reflection, newest
 * day first, and the way to log another. Give it key={item.id}, so another item
 * starts afresh.
 *
 * item: the item the page shows. onItemMissing: called when the API says the item
 * is no longer in this library, so the page can say so.
 */
export function ItemSessions({ item, onItemMissing }) {
  const headingId = useId()
  // loading, failed or ready, with the sessions once ready.
  const [loaded, setLoaded] = useState({ state: 'loading', sessions: [] })
  // Counting tries makes Try again load afresh, through the same effect.
  const [tries, setTries] = useState(0)
  const [logging, setLogging] = useState(false)
  // The session being edited, if any.
  const [editing, setEditing] = useState(null)
  const toast = useToast()
  // Always the page's latest callback, without it being a reason to load again:
  // the page passes a new function each render.
  const reportMissing = useEffectEvent(() => onItemMissing())

  useEffect(() => {
    const controller = new AbortController()
    getSessions(item.id, { signal: controller.signal })
      .then((sessions) => {
        if (sessions) setLoaded({ state: 'ready', sessions })
        else reportMissing()
      })
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLoaded({ state: 'failed', sessions: [] })
      })
    return () => controller.abort()
  }, [item.id, tries])

  function tryAgain() {
    setLoaded({ state: 'loading', sessions: [] })
    setTries((count) => count + 1)
  }

  async function saveSession(values) {
    const result = await logSession(item.id, values)
    if (result.session) {
      setLogging(false)
      // Slotted in where a reload would put it, so a session from days ago doesn't
      // jump to the top. Only into a list that has loaded, or it would show alone.
      setLoaded((current) =>
        current.state === 'ready'
          ? { state: 'ready', sessions: newestFirst([result.session, ...current.sessions]) }
          : current,
      )
      toast.show({ title: 'Session logged' })
    } else if (result.error === 'missing') {
      setLogging(false)
      onItemMissing()
      return {}
    }
    return result
  }

  async function saveEdit(values) {
    const result = await editSession(item.id, editing.id, values)
    if (result.session) {
      setEditing(null)
      // Its date may have changed, so it may move.
      setLoaded((current) => ({
        ...current,
        sessions: newestFirst(current.sessions.map((s) => (s.id === result.session.id ? result.session : s))),
      }))
      toast.show({ title: 'Changes saved' })
    } else if (result.error === 'missing') {
      // The session, or the whole item, was deleted meanwhile. Loading afresh
      // shows which: the list without it, or the item as not found.
      setEditing(null)
      tryAgain()
      return {}
    }
    return result
  }

  let content
  if (loaded.state === 'loading') {
    content = (
      <SkeletonGroup label="Loading sessions" className={styles.sessionList}>
        <SkeletonText lines={3} />
        <SkeletonText lines={3} />
      </SkeletonGroup>
    )
  } else if (loaded.state === 'failed') {
    content = (
      <Alert tone="error" title="Couldn't load the sessions">
        {FAILED_MESSAGE}{' '}
        <Button variant="text" onClick={tryAgain}>
          Try again
        </Button>
      </Alert>
    )
  } else if (loaded.sessions.length === 0) {
    content = <Text>No sessions yet. Each one you log shows here, with its reflection.</Text>
  } else {
    content = (
      <ol className={styles.sessionList}>
        {loaded.sessions.map((session) => (
          <li key={session.id}>
            <ReflectionCard
              mood={session.reflection.mood}
              notes={session.reflection.notes}
              session={session}
              medium={item.medium}
              date={session.date}
              loggedOn={wasLoggedLate(session) ? session.createdAt : undefined}
              actions={
                <Button variant="text" onClick={() => setEditing(session)}>
                  <EditIcon />
                  Edit
                  <VisuallyHidden> the session from {sessionDay(session)}</VisuallyHidden>
                </Button>
              }
            />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <section aria-labelledby={headingId} className={styles.sessions}>
      <header className={styles.header}>
        <Heading as="h2" id={headingId}>
          Sessions
        </Heading>
        <Button onClick={() => setLogging(true)}>
          <ReflectionIcon />
          Log session
        </Button>
      </header>
      {content}
      <LogSessionModal open={logging} item={item} onClose={() => setLogging(false)} onSubmit={saveSession} />
      <EditSessionModal
        open={editing !== null}
        item={item}
        session={editing}
        onClose={() => setEditing(null)}
        onSubmit={saveEdit}
      />
    </section>
  )
}
