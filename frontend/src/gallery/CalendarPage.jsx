import { Heading, SessionCalendar } from '../components/index.js'
import styles from './LibraryDemo.module.css'

/** The calendar as its own page, laid out like the library's. */
export function CalendarPage({ sessions }) {
  return (
    <div>
      <div className={styles.toolbar}>
        <Heading as="h2">Calendar</Heading>
      </div>
      <div className={styles.page}>
        <SessionCalendar sessions={sessions} />
      </div>
    </div>
  )
}
