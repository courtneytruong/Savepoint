import { formatDuration, parseDateKey, toDateKey } from './calendarDates.js'
import { classNames } from './classNames.js'
import { EmptyState } from './EmptyState.jsx'
import { RatingIcon, ReflectionIcon, TimelineIcon } from './icons.js'
import { MoodBadge } from './Mood.jsx'
import { moodFor } from './moods.js'
import { Skeleton, SkeletonGroup, SkeletonText } from './Skeleton.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { STATUSES } from './statuses.js'
import { useId } from 'react'
import styles from './Timeline.module.css'
import { groupByMonth } from './timelineEntries.js'

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullDayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// The words say what happened, and the badge beside them shows the new status.
function statusText({ status, first, previous }, medium) {
  const verb = medium === 'Game' ? 'playing' : 'reading'
  if (first) return 'Added to your library'
  if (status === 'Backlog') return 'Moved back to your backlog'
  if (status === 'InProgress') {
    return previous === 'Finished' || previous === 'Dropped' ? 'Picked back up' : `Started ${verb}`
  }
  return status === 'Finished' ? `Finished ${verb}` : `Stopped ${verb}`
}

function Tags({ tags }) {
  if (!tags?.length) return null
  return (
    <ul className={styles.tags} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>#{tag}</li>
      ))}
    </ul>
  )
}

// What each kind of entry shows: the dot's icon and color, and its content.
function describe(entry, medium) {
  switch (entry.type) {
    case 'status': {
      const { Icon, color } = STATUSES[entry.status]
      return {
        Icon,
        color,
        content: (
          <div className={styles.change}>
            <span>{statusText(entry, medium)}</span>
            <StatusBadge status={entry.status} />
          </div>
        ),
      }
    }
    case 'rating':
      return {
        Icon: RatingIcon,
        color: 'var(--color-mood-delighted)',
        content: (
          // One span, so the sentence flows as text rather than as spaced-out flex items.
          <p className={styles.change}>
            <span>
              {entry.previous === undefined ? (
                <>
                  Rated <strong className={styles.value}>{entry.rating}/10</strong>
                </>
              ) : (
                <>
                  Changed rating from <span className={styles.old}>{entry.previous}</span> to{' '}
                  <strong className={styles.value}>{entry.rating}/10</strong>
                </>
              )}
            </span>
          </p>
        ),
      }
    case 'session': {
      const { mood, notes, tags } = entry.reflection
      const verb = medium === 'Game' ? 'Played' : 'Read'
      return {
        Icon: moodFor(mood).Icon,
        color: moodFor(mood).color,
        content: (
          <article className={styles.card}>
            <div className={styles.cardTop}>
              <p className={styles.cardTitle}>
                {verb} for {formatDuration(entry.durationMinutes)}
                {entry.pagesRead ? <span className={styles.meta}> · {entry.pagesRead} pages</span> : null}
              </p>
              <MoodBadge mood={mood} />
            </div>
            <p className={styles.notes}>{notes}</p>
            <Tags tags={tags} />
            {entry.loggedLate && (
              <p className={styles.logged}>Logged on {dayFormat.format(new Date(entry.createdAt))}</p>
            )}
          </article>
        ),
      }
    }
    case 'reflection':
      return {
        Icon: ReflectionIcon,
        color: moodFor(entry.mood).color,
        content: (
          <article className={classNames(styles.card, styles.reflection)}>
            <div className={styles.cardTop}>
              <p className={styles.cardTitle}>Reflection</p>
              <MoodBadge mood={entry.mood} />
            </div>
            <p className={styles.thought}>{entry.notes}</p>
            <Tags tags={entry.tags} />
          </article>
        ),
      }
  }
}

function TimelineSkeleton() {
  return (
    <SkeletonGroup label="Loading timeline" className={styles.timeline}>
      <Skeleton width="120px" className={styles.month} />
      <ol className={styles.list}>
        {[2, 3, 2].map((lines, index) => (
          <li key={index} className={styles.entry}>
            <Skeleton width="48px" className={styles.date} />
            <Skeleton variant="circle" width="32px" height="32px" className={styles.node} />
            <div className={classNames(styles.card, styles.body)}>
              <Skeleton width="40%" height="20px" />
              <SkeletonText lines={lines} />
            </div>
          </li>
        ))}
      </ol>
    </SkeletonGroup>
  )
}

/**
 * An item's history: status and rating changes, sessions and their reflections,
 * and standalone reflections, grouped by month along a line.
 *
 * entries: from buildTimeline, oldest first.
 * medium: 'Book' or 'Game', for wording like "Started reading".
 * order: newest (default) or oldest first.
 * empty: shown when there are no entries, in place of the default empty state.
 */
export function Timeline({
  entries = [],
  medium,
  order = 'newest',
  loading = false,
  empty,
  headingAs: MonthHeading = 'h3',
  className,
}) {
  const id = useId()
  if (loading) return <TimelineSkeleton />

  if (entries.length === 0) {
    return (
      empty ?? (
        <EmptyState icon={<TimelineIcon />} title="Nothing on this timeline yet" headingAs={MonthHeading}>
          Sessions, reflections and changes of heart will show up here as you log them.
        </EmptyState>
      )
    )
  }

  const ordered = order === 'oldest' ? entries : [...entries].reverse()

  return (
    <div className={classNames(styles.timeline, className)}>
      {groupByMonth(ordered).map(({ month, entries: monthEntries }) => (
        <section key={month} className={styles.group} aria-labelledby={`${id}-${month}`}>
          <MonthHeading id={`${id}-${month}`} className={styles.month}>
            {monthFormat.format(parseDateKey(`${month}-01`))}
          </MonthHeading>
          <ol className={styles.list}>
            {monthEntries.map((entry, index) => {
              const { Icon, color, content } = describe(entry, medium)
              const date = parseDateKey(entry.day)
              const sameDay = monthEntries[index - 1]?.day === entry.day
              return (
                <li key={entry.key} className={styles.entry} style={{ '--node-color': color }}>
                  <time
                    className={classNames(styles.date, sameDay && styles.sameDay)}
                    dateTime={toDateKey(date)}
                    title={fullDayFormat.format(date)}
                  >
                    {dayFormat.format(date)}
                  </time>
                  <span className={styles.node} aria-hidden="true">
                    <Icon />
                  </span>
                  <div className={styles.body}>{content}</div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
