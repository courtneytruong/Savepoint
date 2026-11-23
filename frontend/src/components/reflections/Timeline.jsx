import { parseDateKey, toDateKey } from '../../utils/calendarDates.js'
import { classNames } from '../../utils/classNames.js'
import { EmptyState } from '../feedback/EmptyState.jsx'
import { Link } from '../ui/Link.jsx'
import { RatingIcon, ReflectionIcon, TimelineIcon } from '../icons.js'
import { moodFor } from '../../rules/moods.js'
import { wasEdited } from '../../rules/reflectionRules.js'
import { sessionEditedAt } from '../../rules/sessionList.js'
import { ReflectionCard } from './ReflectionCard.jsx'
import cardStyles from './ReflectionCard.module.css'
import { Skeleton, SkeletonGroup, SkeletonText } from '../feedback/Skeleton.jsx'
import { starsLabel } from '../../rules/ratingRules.js'
import { StatusBadge } from '../library/StatusBadge.jsx'
import { STATUSES } from '../../rules/statuses.js'
import { useId } from 'react'
import styles from './Timeline.module.css'
import { groupByMonth } from '../../rules/timelineEntries.js'

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullDayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// The item's title, linked to its page, for timelines that mix items.
function ItemName({ item }) {
  return item.href ? (
    <Link href={item.href} className={styles.itemName}>
      {item.title}
    </Link>
  ) : (
    <span className={styles.itemName}>{item.title}</span>
  )
}

// Words before and after where the item's name goes, as in "Moved" Piranesi "back to
// your backlog". Without an item, the two simply join.
function withItem([before, after], item) {
  if (!item) return before + after
  return (
    <>
      {before} <ItemName item={item} />
      {after}
    </>
  )
}

// The words say what happened, and the badge beside them shows the new status.
function statusText({ status, first, previous }, medium, item) {
  const verb = medium === 'Game' ? 'playing' : 'reading'
  if (first) return withItem(['Added', ' to your library'], item)
  if (status === 'Backlog') return withItem(['Moved', ' back to your backlog'], item)
  if (status === 'InProgress') {
    return previous === 'Finished' || previous === 'Dropped'
      ? withItem(['Picked', ' back up'], item)
      : withItem([`Started ${verb}`, ''], item)
  }
  return withItem([status === 'Finished' ? `Finished ${verb}` : `Stopped ${verb}`, ''], item)
}

// The heading level below another, so a card's item title sits under its month.
const LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
function levelBelow(heading) {
  const level = LEVELS.indexOf(heading)
  return level === -1 ? 'h4' : LEVELS[Math.min(level + 1, LEVELS.length - 1)]
}

// What each kind of entry shows: the dot's icon and color, and its content. An entry
// with an item, on a timeline that mixes items, is worded for and names that item.
function describe(entry, timelineMedium, actionsFor, cardHeading) {
  const { item } = entry
  const medium = item?.medium ?? timelineMedium
  switch (entry.type) {
    case 'status': {
      const { Icon, color } = STATUSES[entry.status]
      return {
        Icon,
        color,
        content: (
          <div className={styles.change}>
            <span>{statusText(entry, medium, item)}</span>
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
                  {withItem(['Rated', ''], item)} <strong className={styles.value}>{starsLabel(entry.rating)}</strong>
                </>
              ) : (
                <>
                  {item ? withItem(['Changed rating of', ''], item) : 'Changed rating'} from{' '}
                  <span className={styles.old}>{entry.previous}</span> to{' '}
                  <strong className={styles.value}>{starsLabel(entry.rating)}</strong>
                </>
              )}
            </span>
          </p>
        ),
      }
    case 'session': {
      const { mood, notes, tags } = entry.reflection
      return {
        Icon: moodFor(mood).Icon,
        color: moodFor(mood).color,
        content: (
          <ReflectionCard
            mood={mood}
            notes={notes}
            tags={tags}
            session={entry}
            medium={medium}
            item={item}
            headingAs={cardHeading}
            loggedOn={entry.loggedLate ? entry.createdAt : undefined}
            editedAt={sessionEditedAt(entry)}
            actions={actionsFor?.(entry)}
          />
        ),
      }
    }
    case 'reflection':
      return {
        Icon: ReflectionIcon,
        color: moodFor(entry.mood).color,
        content: (
          <ReflectionCard
            mood={entry.mood}
            notes={entry.notes}
            tags={entry.tags}
            medium={medium}
            item={item}
            headingAs={cardHeading}
            editedAt={wasEdited(entry) ? entry.updatedAt : undefined}
            actions={actionsFor?.(entry)}
          />
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
            <div className={classNames(cardStyles.card, styles.body)}>
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
 * An item's history, or the whole library's: status and rating changes, sessions
 * and their reflections, and standalone reflections, grouped by month along a line.
 *
 * entries: from buildTimeline, oldest first. An entry with an item ({ title, medium,
 * href? }), as from buildActivityTimeline, names it, as in "Started reading
 * Piranesi", and its card shows the item's title, linked, as a heading below the month's.
 * medium: 'Book' or 'Game', for wording like "Started reading" on one item's timeline.
 * order: newest (default) or oldest first.
 * empty: shown when there are no entries, in place of the default empty state.
 * actionsFor: given a session or reflection entry, buttons for its card, such as Edit.
 */
export function Timeline({
  entries = [],
  medium,
  actionsFor,
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
              const { Icon, color, content } = describe(entry, medium, actionsFor, levelBelow(MonthHeading))
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
