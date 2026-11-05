import { useState } from 'react'
import { Button } from './Button.jsx'
import {
  addMonths,
  formatDuration,
  localeWeekStart,
  monthWeeks,
  parseDateKey,
  startOfMonth,
  toDateKey,
  weekdayNames,
} from './calendarDates.js'
import { classNames } from './classNames.js'
import { EmptyState } from './EmptyState.jsx'
import { CalendarIcon, NextIcon, PreviousIcon } from './icons.js'
import { MediumLabel } from './ItemCard.jsx'
import { MoodBadge } from './Mood.jsx'
import { MOODS, moodFor } from './moods.js'
import styles from './SessionCalendar.module.css'

const MAX_DOTS = 4
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

function groupByDate(sessions) {
  const days = new Map()
  for (const session of sessions) {
    days.set(session.date, [...(days.get(session.date) ?? []), session])
  }
  return days
}

function describeDay(date, sessions) {
  const minutes = sessions.reduce((total, session) => total + session.durationMinutes, 0)
  const count = sessions.length === 1 ? '1 session' : `${sessions.length} sessions`
  const moods = [...new Set(sessions.map((session) => session.mood))].join(', ')
  return `${dayFormat.format(date)}: ${count}, ${formatDuration(minutes)}. ${moods}`
}

// The most recent day with sessions in the month, up to today.
function latestDay(days, month, today) {
  const prefix = toDateKey(month).slice(0, 7)
  const todayKey = toDateKey(today)
  return [...days.keys()].filter((key) => key.startsWith(prefix) && key <= todayKey).sort().at(-1) ?? null
}

/**
 * A month of sessions, day by day. Each day shows a colored dot per session, one
 * for each mood, and choosing a day lists what was read or played.
 *
 * sessions: { id, date: 'YYYY-MM-DD', itemTitle, medium, durationMinutes,
 * pagesRead?, mood, notes }.
 * weekStartsOn: 0 for Sunday through 6 for Saturday. Defaults to the person's locale.
 * today: only for tests, which need a fixed date.
 */
export function SessionCalendar({ sessions, weekStartsOn = localeWeekStart(), today: fixedToday, className }) {
  // Read once, so "today" can't change between renders.
  const [today] = useState(() => fixedToday ?? new Date())
  const days = groupByDate(sessions)
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(() => latestDay(days, startOfMonth(today), today))
  const todayKey = toDateKey(today)
  const selectedSessions = (selected && days.get(selected)) ?? []

  function showMonth(nextMonth) {
    setMonth(nextMonth)
    setSelected(latestDay(days, nextMonth, today))
  }

  return (
    <div className={classNames(styles.calendar, className)}>
      <div className={styles.header}>
        <h3 className={styles.month} aria-live="polite">
          {monthFormat.format(month)}
        </h3>
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
          <caption className={styles.visuallyHidden}>Sessions in {monthFormat.format(month)}</caption>
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
                  const daySessions = days.get(key)
                  const isToday = key === todayKey

                  return (
                    <td key={key}>
                      {daySessions ? (
                        <button
                          type="button"
                          aria-pressed={selected === key}
                          aria-current={isToday ? 'date' : undefined}
                          aria-label={describeDay(date, daySessions)}
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
                            {daySessions.slice(0, MAX_DOTS).map((session) => (
                              <span
                                key={session.id}
                                className={styles.dot}
                                style={{ background: moodFor(session.mood).color }}
                              />
                            ))}
                            {daySessions.length > MAX_DOTS && (
                              <span className={styles.more}>+{daySessions.length - MAX_DOTS}</span>
                            )}
                          </span>
                          <span className={styles.minutes} aria-hidden="true">
                            {formatDuration(daySessions.reduce((total, session) => total + session.durationMinutes, 0))}
                          </span>
                        </button>
                      ) : (
                        <span
                          aria-current={isToday ? 'date' : undefined}
                          className={classNames(styles.day, isToday && styles.today)}
                        >
                          <span className={styles.number}>{date.getDate()}</span>
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>
                {/* Screen readers get the moods in each day's label, so this key is for sight only. */}
                <ul className={styles.legend} aria-hidden="true">
                  {MOODS.map(({ value, color }) => (
                    <li key={value}>
                      <span className={styles.dot} style={{ background: color }} />
                      {value}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          </tfoot>
        </table>

        <section className={styles.detail} aria-label="Selected day">
          {selected ? (
            <>
              <h4 className={styles.detailTitle}>{dayFormat.format(parseDateKey(selected))}</h4>
              <ul className={styles.sessions}>
                {selectedSessions.map((session) => (
                  <li key={session.id} className={styles.session}>
                    <div className={styles.sessionTop}>
                      <MediumLabel medium={session.medium} />
                      <MoodBadge mood={session.mood} />
                    </div>
                    <p className={styles.sessionTitle}>{session.itemTitle}</p>
                    <p className={styles.sessionMeta}>
                      {formatDuration(session.durationMinutes)}
                      {session.pagesRead ? ` · ${session.pagesRead} pages` : ''}
                    </p>
                    {session.notes && <p className={styles.notes}>{session.notes}</p>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState icon={<CalendarIcon />} title="Nothing logged this month" headingAs="h4">
              Sessions you log will show up here, on the day they happened.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}
