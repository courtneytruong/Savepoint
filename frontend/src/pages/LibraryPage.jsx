import { useEffect, useState } from 'react'
import { getItems } from '../api/items.js'
import {
  Button,
  EmptyState,
  Heading,
  ItemCard,
  ItemGrid,
  SkeletonCard,
  SkeletonGroup,
  Table,
  useStoredView,
  ViewToggle,
} from '../components/index.js'
import { ErrorIcon, LibraryIcon } from '../components/icons.js'
import { AppLayout } from './AppLayout.jsx'
import { LIBRARY_COLUMNS } from './libraryColumns.jsx'
import styles from './LibraryPage.module.css'

const FAILED_MESSAGE = "Something went wrong on Savepoint's server. Try again."

/** The signed-in person's books and games, in the list or grid view they chose last. */
export function LibraryPage({ account, onSignedOut }) {
  const [view, setView] = useStoredView()
  // loading, failed or ready, with the items once ready.
  const [library, setLibrary] = useState({ state: 'loading', items: [] })
  // Counting tries makes Try again load afresh, through the same effect.
  const [tries, setTries] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getItems({ signal: controller.signal })
      .then((items) => setLibrary({ state: 'ready', items }))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setLibrary({ state: 'failed', items: [] })
      })
    return () => controller.abort()
  }, [tries])

  function tryAgain() {
    setLibrary({ state: 'loading', items: [] })
    setTries((count) => count + 1)
  }

  const { state, items } = library
  const loading = state === 'loading'

  let content
  if (state === 'failed') {
    content = (
      <EmptyState
        icon={<ErrorIcon />}
        title="Couldn't load your library"
        headingAs="h3"
        action={
          <Button variant="outline" onClick={tryAgain}>
            Try again
          </Button>
        }
      >
        {FAILED_MESSAGE}
      </EmptyState>
    )
  } else if (state === 'ready' && items.length === 0) {
    content = (
      <EmptyState icon={<LibraryIcon />} title="Your library is empty" headingAs="h3">
        Add a book or game to get started.
      </EmptyState>
    )
  } else if (view === 'list') {
    content = <Table caption="Your library" columns={LIBRARY_COLUMNS} rows={items} loading={loading} loadingRows={3} />
  } else if (loading) {
    content = (
      <SkeletonGroup label="Loading your library" className={styles.loadingGrid}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </SkeletonGroup>
    )
  } else {
    content = (
      <ItemGrid className={styles.grid}>
        {items.map((item) => (
          <ItemCard key={item.id} {...item} />
        ))}
      </ItemGrid>
    )
  }

  return (
    <AppLayout account={account} onSignedOut={onSignedOut} libraryCount={state === 'ready' ? items.length : undefined}>
      <div className={styles.toolbar}>
        <Heading as="h2">Library</Heading>
        <ViewToggle value={view} onChange={setView} />
      </div>
      {content}
    </AppLayout>
  )
}
