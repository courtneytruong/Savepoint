import { useMemo } from 'react'
import { ActivityCalendar, buildTimeline, Heading } from '../components/index.js'
import styles from './LibraryDemo.module.css'
import { makeSampleHistory, SAMPLE_ITEMS } from './sampleData.jsx'

// Every sample item's history as one list, oldest first, each entry with its item,
// as the app's buildActivityTimeline gives it. Sample ids repeat between items, so
// keys carry the item's id.
function sampleActivity(sessions) {
  return SAMPLE_ITEMS.flatMap((item) =>
    buildTimeline(makeSampleHistory(item.title, sessions)).map((entry) => ({
      ...entry,
      key: `${item.id}-${entry.key}`,
      item: { id: item.id, title: item.title, medium: item.medium },
    })),
  ).sort((a, b) => a.time - b.time)
}

/** The calendar as its own page, laid out like the library's. */
export function CalendarPage({ sessions }) {
  const entries = useMemo(() => sampleActivity(sessions), [sessions])
  return (
    <div>
      <div className={styles.toolbar}>
        <Heading as="h2">Calendar</Heading>
      </div>
      <div className={styles.page}>
        <ActivityCalendar entries={entries} headingAs="h3" />
      </div>
    </div>
  )
}
