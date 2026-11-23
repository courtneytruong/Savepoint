import { useEffect, useEffectEvent, useId, useState } from 'react'
import { getRatingChanges, getStatusChanges } from '../api/items.js'
import { deleteReflection, editReflection, getReflections, writeReflection } from '../api/reflections.js'
import { deleteSession, editSession, getSessions, logSession } from '../api/sessions.js'
import {
  Alert,
  Button,
  buildTimeline,
  DeleteModal,
  EditReflectionModal,
  EditSessionModal,
  Heading,
  LogSessionModal,
  Text,
  Timeline,
  TimelineOrderToggle,
  useTimelineOrder,
  useToast,
  VisuallyHidden,
  WriteReflectionModal,
} from '../components/index.js'
import {
  DeleteIcon,
  EditIcon,
  ReflectionIcon,
  WriteReflectionIcon,
} from '../components/icons.js'
import { useTagSuggestions } from '../hooks/useTagSuggestions.js'
import { parseDateKey } from '../utils/calendarDates.js'
import styles from './ItemPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// For telling apart each card's buttons, as in "Edit the session from 14 Nov 2026".
const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const sessionDay = (session) => dayFormat.format(parseDateKey(session.date))
// A standalone reflection's day is when it was written, in the person's own time zone.
const reflectionDay = (reflection) => dayFormat.format(new Date(reflection.createdAt))

const NOT_LOADED = { state: 'loading', sessions: [], reflections: [], statusChanges: [], ratingChanges: [] }

/**
 * The Timeline part of an item's page: its status and rating changes, its sessions
 * with their reflections, and its standalone reflections, newest first, and the ways
 * to log another session or write another reflection. Give it key={item.id}, so
 * another item starts afresh.
 *
 * item: the item the page shows. onItemMissing: called when the API says the item
 * is no longer in this library, so the page can say so.
 */
export function ItemTimeline({ item, onItemMissing }) {
  const headingId = useId()
  // loading, failed or ready, with what the timeline is built from once ready.
  const [loaded, setLoaded] = useState(NOT_LOADED)
  // Counting tries makes Try again load afresh, through the same effect.
  const [tries, setTries] = useState(0)
  const [logging, setLogging] = useState(false)
  const [writing, setWriting] = useState(false)
  // The session being edited, if any.
  const [editing, setEditing] = useState(null)
  // The session being deleted, if any.
  const [deleting, setDeleting] = useState(null)
  // The standalone reflection being edited or deleted, if any.
  const [editingReflection, setEditingReflection] = useState(null)
  const [deletingReflection, setDeletingReflection] = useState(null)
  const tagSuggestions = useTagSuggestions(logging || writing || editing !== null || editingReflection !== null)
  const [order, setOrder] = useTimelineOrder()
  const toast = useToast()
  // Always the page's latest callback, without it being a reason to load again:
  // the page passes a new function each render.
  const reportMissing = useEffectEvent(() => onItemMissing())

  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    // All at once. Any one answering 404 means the item is gone.
    Promise.all([
      getSessions(item.id, options),
      getReflections(item.id, options),
      getStatusChanges(item.id, options),
      getRatingChanges(item.id, options),
    ])
      .then(([sessions, reflections, statusChanges, ratingChanges]) => {
        if (sessions && reflections && statusChanges && ratingChanges) {
          setLoaded({ state: 'ready', sessions, reflections, statusChanges, ratingChanges })
        } else {
          reportMissing()
        }
      })
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLoaded({ ...NOT_LOADED, state: 'failed' })
      })
    return () => controller.abort()
  }, [item.id, tries])

  function tryAgain() {
    setLoaded(NOT_LOADED)
    setTries((count) => count + 1)
  }

  // The timeline puts sessions in order itself, so changes only add, replace or remove.
  const updateSessions = (change) => setLoaded((current) => ({ ...current, sessions: change(current.sessions) }))
  const updateReflections = (change) =>
    setLoaded((current) => ({ ...current, reflections: change(current.reflections) }))

  async function saveSession(values) {
    const result = await logSession(item.id, values)
    if (result.session) {
      setLogging(false)
      // Only into a timeline that has loaded, or it would show alone.
      setLoaded((current) =>
        current.state === 'ready' ? { ...current, sessions: [...current.sessions, result.session] } : current,
      )
      toast.show({ title: 'Session logged' })
    } else if (result.error === 'missing') {
      setLogging(false)
      onItemMissing()
      return {}
    }
    return result
  }

  async function saveReflection(values) {
    const result = await writeReflection(item.id, values)
    if (result.reflection) {
      setWriting(false)
      // Only into a timeline that has loaded, as for a session.
      setLoaded((current) =>
        current.state === 'ready' ? { ...current, reflections: [...current.reflections, result.reflection] } : current,
      )
      toast.show({ title: 'Reflection saved' })
    } else if (result.error === 'missing') {
      setWriting(false)
      onItemMissing()
      return {}
    }
    return result
  }

  async function saveEdit(values) {
    const result = await editSession(item.id, editing.id, values)
    if (result.session) {
      setEditing(null)
      updateSessions((sessions) => sessions.map((s) => (s.id === result.session.id ? result.session : s)))
      toast.show({ title: 'Changes saved' })
    } else if (result.error === 'missing') {
      // The session, or the whole item, was deleted meanwhile. Loading afresh
      // shows which: the timeline without it, or the item as not found.
      setEditing(null)
      tryAgain()
      return {}
    }
    return result
  }

  async function confirmDelete() {
    const result = await deleteSession(item.id, deleting.id)
    if (result.deleted) {
      const gone = deleting.id
      setDeleting(null)
      updateSessions((sessions) => sessions.filter((s) => s.id !== gone))
      toast.show({ title: 'Session deleted' })
    }
    return result
  }

  async function saveReflectionEdit(values) {
    const result = await editReflection(item.id, editingReflection.id, values)
    if (result.reflection) {
      setEditingReflection(null)
      const saved = result.reflection
      updateReflections((reflections) => reflections.map((r) => (r.id === saved.id ? saved : r)))
      toast.show({ title: 'Changes saved' })
    } else if (result.error === 'missing') {
      // As for a session: loading afresh shows whether the reflection or the item went.
      setEditingReflection(null)
      tryAgain()
      return {}
    }
    return result
  }

  async function confirmReflectionDelete() {
    const result = await deleteReflection(item.id, deletingReflection.id)
    if (result.deleted) {
      const gone = deletingReflection.id
      setDeletingReflection(null)
      updateReflections((reflections) => reflections.filter((r) => r.id !== gone))
      toast.show({ title: 'Reflection deleted' })
    }
    return result
  }

  // Edit and Delete for a session's card or a standalone reflection's.
  const actionsFor = (entry) =>
    entry.type === 'session' ? sessionActions(entry) : entry.type === 'reflection' ? reflectionActions(entry) : null

  // A timeline entry carries extra fields, so the buttons hand on the session itself.
  function sessionActions(entry) {
    const session = loaded.sessions.find((s) => s.id === entry.id)
    if (!session) return null
    return (
      <>
        <Button variant="text" onClick={() => setEditing(session)}>
          <EditIcon />
          Edit
          <VisuallyHidden> the session from {sessionDay(session)}</VisuallyHidden>
        </Button>
        <Button variant="text" onClick={() => setDeleting(session)}>
          <DeleteIcon />
          Delete
          <VisuallyHidden> the session from {sessionDay(session)}</VisuallyHidden>
        </Button>
      </>
    )
  }

  // As for a session's: the buttons hand on the reflection itself.
  function reflectionActions(entry) {
    const reflection = loaded.reflections.find((r) => r.id === entry.id)
    if (!reflection) return null
    return (
      <>
        <Button variant="text" onClick={() => setEditingReflection(reflection)}>
          <EditIcon />
          Edit
          <VisuallyHidden> the reflection from {reflectionDay(reflection)}</VisuallyHidden>
        </Button>
        <Button variant="text" onClick={() => setDeletingReflection(reflection)}>
          <DeleteIcon />
          Delete
          <VisuallyHidden> the reflection from {reflectionDay(reflection)}</VisuallyHidden>
        </Button>
      </>
    )
  }

  // The page changes the item's status and rating itself, and the item then carries
  // its newest change of each, so one picked on the page shows here without loading
  // again. An unrated item has no rating change to add.
  const withCurrent = (changes, current) =>
    loaded.state !== 'ready' || !current.id || changes.some((change) => change.id === current.id)
      ? changes
      : [...changes, current]
  const statusChanges = withCurrent(loaded.statusChanges, {
    id: item.statusChangeId,
    status: item.status,
    changedAt: item.statusChangedAt,
  })
  const ratingChanges = withCurrent(loaded.ratingChanges, {
    id: item.ratingChangeId,
    rating: item.rating,
    changedAt: item.ratingChangedAt,
  })

  let content
  if (loaded.state === 'failed') {
    content = (
      <Alert tone="error" title="Couldn't load the timeline">
        {FAILED_MESSAGE}{' '}
        <Button variant="text" onClick={tryAgain}>
          Try again
        </Button>
      </Alert>
    )
  } else {
    content = (
      <>
        {/* There's always the status it was added with, so this says what's still to come. */}
        {loaded.state === 'ready' && loaded.sessions.length === 0 && loaded.reflections.length === 0 && (
          <Text>No sessions yet. Each one you log shows here, with its reflection.</Text>
        )}
        <Timeline
          entries={buildTimeline({
            sessions: loaded.sessions,
            reflections: loaded.reflections,
            statusChanges,
            ratingChanges,
          })}
          medium={item.medium}
          order={order}
          actionsFor={actionsFor}
          loading={loaded.state === 'loading'}
        />
      </>
    )
  }

  return (
    <section aria-labelledby={headingId} className={styles.timeline}>
      <header className={styles.header}>
        <Heading as="h2" id={headingId}>
          Timeline
        </Heading>
        <div className={styles.actions}>
          {loaded.state === 'ready' && (
            <TimelineOrderToggle value={order} onChange={setOrder} />
          )}
          <Button variant="outline" onClick={() => setWriting(true)}>
            <WriteReflectionIcon />
            Write a reflection
          </Button>
          <Button onClick={() => setLogging(true)}>
            <ReflectionIcon />
            Log session
          </Button>
        </div>
      </header>
      {content}
      <LogSessionModal
        open={logging}
        item={item}
        tagSuggestions={tagSuggestions}
        onClose={() => setLogging(false)}
        onSubmit={saveSession}
      />
      <WriteReflectionModal
        open={writing}
        item={item}
        tagSuggestions={tagSuggestions}
        onClose={() => setWriting(false)}
        onSubmit={saveReflection}
      />
      <EditSessionModal
        open={editing !== null}
        item={item}
        session={editing}
        tagSuggestions={tagSuggestions}
        onClose={() => setEditing(null)}
        onSubmit={saveEdit}
      />
      <DeleteModal
        open={deleting !== null}
        title="Delete this session?"
        description={
          deleting && `The session from ${sessionDay(deleting)} and its reflection. This can't be undone.`
        }
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
      <EditReflectionModal
        open={editingReflection !== null}
        item={item}
        reflection={editingReflection}
        tagSuggestions={tagSuggestions}
        onClose={() => setEditingReflection(null)}
        onSubmit={saveReflectionEdit}
      />
      <DeleteModal
        open={deletingReflection !== null}
        title="Delete this reflection?"
        description={
          deletingReflection && `Your reflection from ${reflectionDay(deletingReflection)}. This can't be undone.`
        }
        onClose={() => setDeletingReflection(null)}
        onConfirm={confirmReflectionDelete}
      />
    </section>
  )
}
