// How an item's sessions are described, shared by its page and the timeline.

import { toDateKey } from '../utils/calendarDates.js'

/** Whether a session was logged on a later day than it happened, in the reader's own time zone. */
export const wasLoggedLate = (session) =>
  Boolean(session.createdAt) && toDateKey(new Date(session.createdAt)) > session.date
