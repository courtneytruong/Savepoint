import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { changeItemStatus, editItem, getItem } from '../api/items.js'
import {
  Button,
  EditItemModal,
  EmptyState,
  FilterGroup,
  FilterPill,
  Heading,
  Link,
  MediumLabel,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  STATUSES,
  Text,
  useToast,
} from '../components/index.js'
import { EditIcon, ErrorIcon, NoResultsIcon, PreviousIcon } from '../components/icons.js'
import { LIBRARY_PATH } from '../paths.js'
import { AppLayout } from './AppLayout.jsx'
import styles from './ItemPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

// In the reader's own language and calendar, such as "12 Nov 2026".
const longDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const DateTime = ({ value }) => <time dateTime={value}>{longDate.format(new Date(value))}</time>

/**
 * One book or game, at /items/{id}. An item that isn't in this library, whether
 * it never existed or is someone else's, shows as not found.
 */
export function ItemPage({ account, onSignedOut }) {
  const { id } = useParams()
  // loading, missing, failed or ready, with the item once ready. Kept with the
  // id it's for, so going to another item shows loading, not the last one.
  const [loaded, setLoaded] = useState({ id: null, state: 'loading', item: null })
  // Counting tries makes Try again load afresh, through the same effect.
  const [tries, setTries] = useState(0)
  // The status being saved, if any, so a second press waits for the first.
  const [changing, setChanging] = useState(null)
  const [editing, setEditing] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const controller = new AbortController()
    getItem(id, { signal: controller.signal })
      .then((item) => setLoaded({ id, state: item ? 'ready' : 'missing', item }))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLoaded({ id, state: 'failed', item: null })
      })
    return () => controller.abort()
  }, [id, tries])

  function tryAgain() {
    setLoaded({ id: null, state: 'loading', item: null })
    setTries((count) => count + 1)
  }

  const { state, item } = loaded.id === id ? loaded : { state: 'loading', item: null }

  // Only if this page still shows the same item, in case they moved on.
  const stillShowing = (forId, next) => setLoaded((current) => (current.id === forId ? next : current))

  // Gone from the library means it was deleted since the page loaded, so the
  // page says so, as it would on arriving now.
  async function saveDetails(details) {
    const result = await editItem(item.id, details)
    if (result.item) {
      setEditing(false)
      stillShowing(item.id, { id: item.id, state: 'ready', item: result.item })
      toast.show({ title: 'Changes saved' })
    } else if (result.error === 'missing') {
      setEditing(false)
      stillShowing(item.id, { id: item.id, state: 'missing', item: null })
      return {}
    }
    return result
  }

  // Saves straight away, since each press is one small change that's easy to
  // undo by pressing the old status again.
  async function changeStatus(status) {
    if (changing || status === item.status) return
    setChanging(status)
    let result
    try {
      result = await changeItemStatus(item.id, status)
    } catch {
      result = { error: 'failed' }
    }
    setChanging(null)

    if (result.item) {
      stillShowing(item.id, { id: item.id, state: 'ready', item: result.item })
      toast.show({ title: `${result.item.title} moved to ${STATUSES[status].label}` })
    } else if (result.error === 'missing') {
      stillShowing(item.id, { id: item.id, state: 'missing', item: null })
    } else {
      toast.show({
        tone: 'error',
        title: "Couldn't change the status",
        description: FAILED_MESSAGE,
        action: { label: 'Try again', onClick: () => changeStatus(status) },
      })
    }
  }

  let content
  if (state === 'loading') {
    content = (
      <SkeletonGroup label="Loading this item" className={styles.details}>
        <Skeleton width="50%" height="32px" />
        <SkeletonText lines={2} />
      </SkeletonGroup>
    )
  } else if (state === 'missing') {
    content = (
      <EmptyState
        icon={<NoResultsIcon />}
        title="This item isn't in your library"
        headingAs="h2"
        action={
          <Button href={LIBRARY_PATH} variant="outline">
            Go to your library
          </Button>
        }
      >
        It may have been deleted, or the link may be wrong.
      </EmptyState>
    )
  } else if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load this item"
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
      <article className={styles.details}>
        <header className={styles.header}>
          <div>
            <Heading as="h2">{item.title}</Heading>
            {item.creator && <Text className={styles.creator}>{item.creator}</Text>}
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <EditIcon />
            Edit
          </Button>
        </header>
        <MediumLabel medium={item.medium} />
        {/* The current status is the pressed one, so there's no badge as well. */}
        <FilterGroup label="Status" aria-busy={changing ? true : undefined} className={styles.statuses}>
          {Object.entries(STATUSES).map(([value, { label, color, Icon }]) => (
            <FilterPill
              key={value}
              color={color}
              selected={item.status === value}
              aria-disabled={changing ? true : undefined}
              onClick={() => changeStatus(value)}
            >
              <Icon aria-hidden="true" />
              {changing === value ? `Moving to ${label}…` : label}
            </FilterPill>
          ))}
        </FilterGroup>
        <dl className={styles.facts}>
          <div>
            <dt>Added</dt>
            <dd>
              <DateTime value={item.createdAt} />
            </dd>
          </div>
          <div>
            <dt>Status since</dt>
            <dd>
              <DateTime value={item.statusChangedAt} />
            </dd>
          </div>
        </dl>
        <EditItemModal open={editing} item={item} onClose={() => setEditing(false)} onSubmit={saveDetails} />
      </article>
    )
  }

  return (
    <AppLayout account={account} onSignedOut={onSignedOut}>
      <nav aria-label="Breadcrumb" className={styles.back}>
        <Link href={LIBRARY_PATH}>
          <PreviousIcon aria-hidden="true" />
          Library
        </Link>
      </nav>
      {content}
    </AppLayout>
  )
}
