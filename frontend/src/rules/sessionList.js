// How an item's sessions are described, shared by its page and the timeline.

import { toDateKey } from '../utils/calendarDates.js'
import { wasEdited } from './reflectionRules.js'

/** Whether a session was logged on a later day than it happened, in the reader's own time zone. */
export const wasLoggedLate = (session) =>
  Boolean(session.createdAt) && toDateKey(new Date(session.createdAt)) > session.date

/**
 * When a session was last edited: its date, duration or pages, or its reflection's
 * mood or notes, whichever changed last. Undefined when neither was edited.
 */
export function sessionEditedAt(session) {
  return [session, session.reflection]
    .filter(wasEdited)
    .map((edited) => edited.updatedAt)
    .reduce((latest, time) => (latest && new Date(latest) > new Date(time) ? latest : time), undefined)
}
