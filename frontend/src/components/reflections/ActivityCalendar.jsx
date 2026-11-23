import { createElement, useState } from 'react'
import { Button } from '../ui/Button.jsx'
import {
  addMonths,
  formatDuration,
  localeWeekStart,
  monthWeeks,
  parseDateKey,
  startOfMonth,
  toDateKey,
  weekdayNames,
} from '../../utils/calendarDates.js'
import { classNames } from '../../utils/classNames.js'
import { EmptyState } from '../feedback/EmptyState.jsx'
import { CalendarIcon, NextIcon, PreviousIcon } from '../icons.js'
import { MOODS, moodFor } from '../../rules/moods.js'
import { Timeline } from './Timeline.jsx'
import styles from './ActivityCalendar.module.css'

const MAX_DOTS = 4
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

const LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const levelBelow = (heading) => LEVELS[Math.min(LEVELS.indexOf(heading) + 1, LEVELS.length - 1)]

function groupByDay(entries) {
  const days = new Map()
  for (const entry of entries) {
    days.set(entry.day, [...(days.get(entry.day) ?? []), entry])
  }
  return days
}

// The mood an entry was written in, for sessions and reflections, which get a dot.
const moodOf = (entry) =>
  entry.type === 'session' ? entry.reflection.mood : entry.type === 'reflection' ? entry.mood : null

const isChange = (entry) => entry.type === 'status' || entry.type === 'rating'

const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`

function minutesOn(entries) {
  return entries.reduce((total, entry) => total + (entry.type === 'session' ? entry.durationMinutes : 0), 0)
}

// What a day's dots and marker say, in words, for its button's label.
function describeDay(date, entries) {
  const sessions = entries.filter((entry) => entry.type === 'session').length
  const reflections = entries.filter((entry) => entry.type === 'reflection').length
  const changes = entries.filter(isChange).length
  const parts = [
    sessions && `${plural(sessions, 'session')}, ${formatDuration(minutesOn(entries))}`,
    reflections && plural(reflections, 'reflection'),
    changes && plural(changes, 'other change'),
  ].filter(Boolean)
  const moods = [...new Set(entries.map(moodOf).filter(Boolean))].join(', ')
  return `${dayFormat.format(date)}: ${parts.join('; ')}.${moods ? ` ${moods}` : ''}`
}

// The most recent day with anything on it in the month, up to today.
function latestDay(days, month, today) {
  const prefix = toDateKey(month).slice(0, 7)
  const todayKey = toDateKey(today)
  return [...days.keys()].filter((key) => key.startsWith(prefix) && key <= todayKey).sort().at(-1) ?? null
}

/**
 * A month of activity, day by day. Each day shows a dot in its mood for every
 * session or reflection, a small ring when anything else happened, such as an item
 * being added or rated, and the time spent. Choosing a day lists everything from
 * it, as timeline cards.
 *
 * entries: timeline entries, oldest first, as buildActivityTimeline gives them,
 * each with its item, or as buildTimeline gives them for one item.
 * headingAs: the month's heading level, h2 by default; the chosen day's sits below it.
 * weekStartsOn: 0 for Sunday through 6 for Saturday. Defaults to the person's locale.
 * today: only for tests, which need a fixed date.
 */
export function ActivityCalendar({
  entries,
  headingAs: MonthHeading = 'h2',
  weekStartsOn = localeWeekStart(),
  today: fixedToday,
  className,
}) {
  // Read once, so "today" can't change between renders.
  const [today] = useState(() => fixedToday ?? new Date())
  const days = groupByDay(entries)
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(() => latestDay(days, startOfMonth(today), today))
  const todayKey = toDateKey(today)
  const dayHeading = levelBelow(MonthHeading)

  function showMonth(nextMonth) {
    setMonth(nextMonth)
    setSelected(latestDay(days, nextMonth, today))
  }

  return (
    <div className={classNames(styles.calendar, className)}>
      <div className={styles.header}>
        <MonthHeading className={styles.month} aria-live="polite">
          {monthFormat.format(month)}
        </MonthHeading>
        <div className={styles.controls}>
          <Button variant="text" onClick={() => showMonth(startOfMonth(today))}>
            Today
          </Button>
          <button
            type="button"
            className={styles.step}
            aria-label="Previous month"
            onClick={() => showMonth(addMonths(month, -1))}
          >
            <PreviousIcon aria-hidden="true" />
          </button>
          <button type="button" className={styles.step} aria-label="Next month" onClick={() => showMonth(addMonths(month, 1))}>
            <NextIcon aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <table className={styles.grid}>
          <caption className={styles.visuallyHidden}>What happened in {monthFormat.format(month)}</caption>
          <thead>
            <tr>
              {weekdayNames(weekStartsOn).map((name) => (
                <th key={name} scope="col">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthWeeks(month, weekStartsOn).map((week, index) => (
              <tr key={index}>
                {week.map((date, dayIndex) => {
                  if (!date) return <td key={dayIndex} />
                  const key = toDateKey(date)
                  const dayEntries = days.get(key)
                  const isToday = key === todayKey

                  if (!dayEntries) {
                    return (
                      <td key={key}>
                        <span
                          aria-current={isToday ? 'date' : undefined}
                          className={classNames(styles.day, isToday && styles.today)}
                        >
                          <span className={styles.number}>{date.getDate()}</span>
                        </span>
                      </td>
                    )
                  }

                  const moods = dayEntries.filter(moodOf)
                  const minutes = minutesOn(dayEntries)
                  return (
                    <td key={key}>
                      <button
                        type="button"
                        aria-pressed={selected === key}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={describeDay(date, dayEntries)}
                        className={classNames(
                          styles.day,
                          styles.active,
                          selected === key && styles.selected,
                          isToday && styles.today,
                        )}
                        onClick={() => setSelected(key)}
                      >
                        <span className={styles.number}>{date.getDate()}</span>
                        <span className={styles.dots} aria-hidden="true">
                          {moods.slice(0, MAX_DOTS).map((entry) => (
                            <span
                              key={entry.key}
                              className={styles.dot}
                              style={{ background: moodFor(moodOf(entry)).color }}
                            />
                          ))}
                          {moods.length > MAX_DOTS && <span className={styles.more}>+{moods.length - MAX_DOTS}</span>}
                          {dayEntries.some(isChange) && <span className={styles.change} />}
                        </span>
                        {minutes > 0 && (
                          <span className={styles.minutes} aria-hidden="true">
                            {formatDuration(minutes)}
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>
                {/* Screen readers get all this in each day's label, so this key is for sight only. */}
                <ul className={styles.legend} aria-hidden="true">
                  {MOODS.map(({ value, color }) => (
                    <li key={value}>
                      <span className={styles.dot} style={{ background: color }} />
                      {value}
                    </li>
                  ))}
                  <li>
                    <span className={styles.change} />
                    Other changes
                  </li>
                </ul>
              </td>
            </tr>
          </tfoot>
        </table>

        <section className={styles.detail} aria-label="Selected day">
          {selected ? (
            <>
              {/* createElement, as the level is worked out here, which JSX would take for a new component. */}
              {createElement(dayHeading, { className: styles.detailTitle }, dayFormat.format(parseDateKey(selected)))}
              <Timeline entries={days.get(selected)} order="oldest" oneDay headingAs={dayHeading} />
            </>
          ) : (
            <EmptyState icon={<CalendarIcon />} title="Nothing happened this month" headingAs={dayHeading}>
              Sessions, reflections and changes of heart show up here, on the day they happened.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}
