// The numbers on the Stats page, worked out in the browser from the library and
// its history, as the Timeline and Calendar pages do. One person's history is
// small enough to count all at once.

import { addMonths, parseDateKey, startOfMonth, toDateKey } from '../utils/calendarDates.js'
import { MOODS } from './moods.js'
import { STATUSES } from './statuses.js'

/** The time ranges the page offers, as [label, value], the first being the default. */
export const RANGES = [
  ['This year', 'year'],
  ['Last 12 months', 'last12'],
  ['All time', 'all'],
]

/** How many of the most-used tags to list. */
export const TOP_TAGS = 10

const MEDIA = ['Book', 'Game']
const RATINGS = [1, 2, 3, 4, 5]

/**
 * The first day a range covers, as a Date at local midnight, or null for all
 * time. Last 12 months means this month and the 11 before it, whole months, so
 * it matches the bars of the chart.
 */
export function rangeStart(range, today = new Date()) {
  if (range === 'year') return new Date(today.getFullYear(), 0, 1)
  if (range === 'last12') return addMonths(startOfMonth(today), -11)
  return null
}

const monthKey = (date) => toDateKey(date).slice(0, 7)

// Every month from first to last, as 'YYYY-MM', so a month with nothing in it
// still gets its place on the chart.
function monthsBetween(first, last) {
  const months = []
  for (let month = startOfMonth(first); monthKey(month) <= monthKey(last); month = addMonths(month, 1)) {
    months.push(monthKey(month))
  }
  return months
}

const countBy = (list, keyOf) => {
  const counts = new Map()
  for (const entry of list) counts.set(keyOf(entry), (counts.get(keyOf(entry)) ?? 0) + 1)
  return counts
}

/**
 * Everything the Stats page shows.
 *
 * items: the library as getItems gives it, { medium, status, rating }.
 * entries: the library's history as buildActivityTimeline gives it, each with a
 * type, a local day ('YYYY-MM-DD') and its item's medium.
 * range: one of RANGES' values. It limits the history, not the library: the
 * status and rating breakdowns are the library as it is now.
 *
 * Within the range, by the day each thing happened (a session by its own date,
 * even if it was logged later):
 * finished: { Book, Game }, every move to Finished, so a reread or replay counts
 * again. Adding an item as Finished doesn't count: it could have been finished
 * years ago, and adding a shelf of old books shouldn't fill this year.
 * minutes: { Book, Game } from sessions. pagesRead: from book sessions.
 * reflections: how many, a session's and standalone ones alike.
 * months: [{ month: 'YYYY-MM', Book, Game, pages }] for every month of the range
 * up to this one, Book and Game in minutes, pages from book sessions. All time
 * starts at the first session's month, so it's empty with no sessions.
 * moods: [{ mood, count }] for every mood, in MOODS' order.
 * tags: [{ name, count }], the TOP_TAGS most used, most used first, ties by name.
 *
 * The library now:
 * statuses: [{ status, count }] for every status, in STATUSES' order.
 * ratings: [{ rating, count }] for 1 to 5 stars. unrated: items with no rating.
 */
export function buildStats({ items = [], entries = [], range = RANGES[0][1], today = new Date() }) {
  const start = rangeStart(range, today)
  const startKey = start && toDateKey(start)
  const inRange = startKey ? entries.filter((entry) => entry.day >= startKey) : entries

  const sessions = inRange.filter((entry) => entry.type === 'session')
  const reflections = inRange.flatMap((entry) => {
    if (entry.type === 'session') return entry.reflection ? [entry.reflection] : []
    return entry.type === 'reflection' ? [entry] : []
  })

  const byMedium = (list, amount) =>
    Object.fromEntries(
      MEDIA.map((medium) => [
        medium,
        list.filter((entry) => entry.item.medium === medium).reduce((sum, entry) => sum + amount(entry), 0),
      ]),
    )

  // An item's first status change is when it was added, not when it was finished.
  const finishes = inRange.filter((entry) => entry.type === 'status' && entry.status === 'Finished' && !entry.first)

  // The first month to chart: the range's, or for all time the first session's.
  const firstDay = startKey ?? sessions.map((session) => session.day).sort()[0]
  const months = firstDay
    ? monthsBetween(parseDateKey(firstDay), today).map((month) => ({ month, Book: 0, Game: 0, pages: 0 }))
    : []
  const monthIndex = new Map(months.map((month, index) => [month.month, index]))
  for (const session of sessions) {
    const index = monthIndex.get(session.day.slice(0, 7))
    // A session dated after this month has no bar yet.
    if (index === undefined) continue
    months[index][session.item.medium] += session.durationMinutes
    months[index].pages += session.pagesRead ?? 0
  }

  const moodCounts = countBy(reflections, (reflection) => reflection.mood)
  const tagCounts = countBy(
    reflections.flatMap((reflection) => reflection.tags ?? []),
    (tag) => tag,
  )
  const statusCounts = countBy(items, (item) => item.status)
  const ratingCounts = countBy(items, (item) => item.rating ?? null)

  return {
    finished: byMedium(finishes, () => 1),
    minutes: byMedium(sessions, (session) => session.durationMinutes),
    pagesRead: sessions.reduce((sum, session) => sum + (session.pagesRead ?? 0), 0),
    reflections: reflections.length,
    months,
    moods: MOODS.map(({ value }) => ({ mood: value, count: moodCounts.get(value) ?? 0 })),
    tags: [...tagCounts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, TOP_TAGS),
    statuses: Object.keys(STATUSES).map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    ratings: RATINGS.map((rating) => ({ rating, count: ratingCounts.get(rating) ?? 0 })),
    unrated: ratingCounts.get(null) ?? 0,
  }
}
