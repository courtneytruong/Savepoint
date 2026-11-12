import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getItem } from '../api/items.js'
import {
  Button,
  EmptyState,
  Heading,
  Link,
  MediumLabel,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  StatusBadge,
  Text,
} from '../components/index.js'
import { ErrorIcon, NoResultsIcon, PreviousIcon } from '../components/icons.js'
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
        <header>
          <Heading as="h2">{item.title}</Heading>
          {item.creator && <Text className={styles.creator}>{item.creator}</Text>}
        </header>
        <div className={styles.badges}>
          <MediumLabel medium={item.medium} />
          <StatusBadge status={item.status} />
        </div>
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
