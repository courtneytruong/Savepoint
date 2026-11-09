import { parseDateKey, toDateKey } from '../utils/calendarDates.js'

const DAY = 24 * 60 * 60 * 1000

// A session's Date has no time, and it may have been logged on a later day. On its
// own day it sits where it was logged; logged late, it goes at the end of the day
// it happened, after anything else from that day.
function sessionTime(session) {
  const logged = session.createdAt && new Date(session.createdAt)
  if (logged && toDateKey(logged) === session.date) return logged.getTime()
  return parseDateKey(session.date).getTime() + DAY - 1
}

const at = (timestamp) => {
  const date = new Date(timestamp)
  return { day: toDateKey(date), time: date.getTime() }
}

/**
 * Puts an item's history into one list, oldest first, in the order docs/data-model.md
 * gives: a session's reflection by the session's Date, everything else by when it
 * was saved.
 *
 * statusChanges: { id, status, changedAt }
 * ratingChanges: { id, rating, changedAt }
 * sessions: { id, date: 'YYYY-MM-DD', durationMinutes, pagesRead?, createdAt, reflection: { mood, notes, tags? } }
 * reflections: standalone ones only, { id, mood, notes, tags?, createdAt }
 *
 * Each entry has a type, a key, a day ('YYYY-MM-DD') and the fields above. The first
 * status change is marked first (the item was added). Status and rating changes
 * carry the value before them as previous, and a session logged on a later day than
 * it happened is marked loggedLate.
 */
export function buildTimeline({ statusChanges = [], ratingChanges = [], sessions = [], reflections = [] }) {
  const byTime = (a, b) => a.time - b.time
  const statuses = statusChanges.map((change) => ({ type: 'status', ...change, ...at(change.changedAt) })).sort(byTime)
  const ratings = ratingChanges.map((change) => ({ type: 'rating', ...change, ...at(change.changedAt) })).sort(byTime)

  const entries = [
    ...statuses.map((entry, index) => ({ ...entry, first: index === 0, previous: statuses[index - 1]?.status })),
    ...ratings.map((entry, index) => ({ ...entry, previous: ratings[index - 1]?.rating })),
    ...sessions.map((session) => ({
      type: 'session',
      ...session,
      day: session.date,
      time: sessionTime(session),
      loggedLate: Boolean(session.createdAt) && toDateKey(new Date(session.createdAt)) > session.date,
    })),
    ...reflections.map((reflection) => ({ type: 'reflection', ...reflection, ...at(reflection.createdAt) })),
  ]

  return entries.map((entry) => ({ ...entry, key: `${entry.type}-${entry.id}` })).sort(byTime)
}

/** Groups entries by month, as [{ month: 'YYYY-MM', entries }], keeping their order. */
export function groupByMonth(entries) {
  const months = []
  for (const entry of entries) {
    const month = entry.day.slice(0, 7)
    if (months.at(-1)?.month !== month) months.push({ month, entries: [] })
    months.at(-1).entries.push(entry)
  }
  return months
}
