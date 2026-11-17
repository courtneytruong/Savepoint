// How an item's sessions are ordered and described, shared by its page and the timeline.

import { toDateKey } from '../utils/calendarDates.js'

/**
 * Newest day first, and within a day the one logged last first: the API's own
 * order, so a session added on the page lands where a reload would put it. Day
 * keys and ISO times both compare correctly as text.
 */
export function newestFirst(sessions) {
  const descending = (a, b) => (a < b ? 1 : a > b ? -1 : 0)
  return [...sessions].sort(
    (a, b) => descending(a.date, b.date) || descending(a.createdAt, b.createdAt) || descending(a.id, b.id),
  )
}

/** Whether a session was logged on a later day than it happened, in the reader's own time zone. */
export const wasLoggedLate = (session) =>
  Boolean(session.createdAt) && toDateKey(new Date(session.createdAt)) > session.date
