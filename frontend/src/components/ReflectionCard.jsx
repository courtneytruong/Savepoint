import { formatDuration, parseDateKey } from './calendarDates.js'
import { classNames } from './classNames.js'
import { MediumLabel } from './ItemCard.jsx'
import { MoodBadge } from './Mood.jsx'
import styles from './ReflectionCard.module.css'

const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullDayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// The tags, each marked with a #.
function ReflectionTags({ tags }) {
  if (!tags?.length) return null
  return (
    <ul className={styles.tags} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>#{tag}</li>
      ))}
    </ul>
  )
}

// "Read for 1h 30m · 40 pages" for a session, or "Reflection" for one that stands alone.
function Kind({ session, medium }) {
  if (!session) return 'Reflection'
  return (
    <>
      {medium === 'Game' ? 'Played' : 'Read'} for {formatDuration(session.durationMinutes)}
      {session.pagesRead ? <span className={styles.meta}> · {session.pagesRead} pages</span> : null}
    </>
  )
}

/**
 * One reflection: its mood, notes and tags, and what it reflects on. A session's
 * reflection says how long the session was. A standalone one is a final word, so
 * its notes are larger. Every card has the same border, whatever its mood.
 *
 * session: { durationMinutes, pagesRead? }, or nothing for a standalone reflection.
 * medium: 'Book' or 'Game', for "Read for" or "Played for".
 * item: { title, medium, href? }, shown above everything else, for lists that mix
 * items, such as the Reflections page. On an item's own timeline, leave it out.
 * date: 'YYYY-MM-DD', for lists without their own dates.
 * loggedOn: when a session was logged, if later than it happened.
 */
export function ReflectionCard({
  mood,
  notes,
  tags,
  session,
  medium,
  item,
  date,
  loggedOn,
  headingAs: ItemHeading = 'h3',
  className,
}) {
  const kindMedium = item?.medium ?? medium

  return (
    <article className={classNames(styles.card, className)}>
      <div className={styles.top}>
        {item ? (
          <ItemHeading className={styles.itemTitle}>
            {item.href ? <a href={item.href}>{item.title}</a> : item.title}
          </ItemHeading>
        ) : (
          <p className={styles.title}>
            <Kind session={session} medium={kindMedium} />
          </p>
        )}
        <MoodBadge mood={mood} />
      </div>

      {(item || date) && (
        <p className={styles.details}>
          {item && <MediumLabel medium={item.medium} />}
          {date && (
            <time dateTime={date}>{fullDayFormat.format(parseDateKey(date))}</time>
          )}
          {item && (
            <span>
              <Kind session={session} medium={kindMedium} />
            </span>
          )}
        </p>
      )}

      <p className={session ? styles.notes : styles.thought}>{notes}</p>
      <ReflectionTags tags={tags} />
      {loggedOn && <p className={styles.logged}>Logged on {dayFormat.format(new Date(loggedOn))}</p>}
    </article>
  )
}
