// The session rules in docs/data-model.md, plus two the form adds: a session
// can't be in the future, and can't be longer than the day it's logged on.
// The API checks the same rules, so these only exist to tell the user sooner.

import { toDateKey } from '../utils/calendarDates.js'

export const MAX_SESSION_MINUTES = 24 * 60

// Number fields hold text. Empty counts as 0 for hours and minutes, so "45
// minutes" doesn't need a 0 in the hours.
const WHOLE = /^\d+$/
const toNumber = (text) => (text.trim() === '' ? 0 : WHOLE.test(text.trim()) ? Number(text) : NaN)

/** Total minutes from the hours and minutes fields, or NaN if either isn't a whole number. */
export const sessionMinutes = ({ hours = '', minutes = '' }) => toNumber(hours) * 60 + toNumber(minutes)

/**
 * Returns a message for each field that breaks a rule, or an empty object.
 * value: { itemId, date, hours, minutes, pagesRead }, with the numbers as text.
 * medium: the chosen item's medium, since only books count pages.
 */
export function validateSession(value, { medium, today = new Date() } = {}) {
  const errors = {}

  if (value.itemId == null) errors.itemId = 'Choose what you read or played.'

  // Date keys compare correctly as text, because they're written largest unit first.
  if (!value.date) errors.date = 'Choose the day of the session.'
  else if (value.date > toDateKey(today)) errors.date = "A session can't be in the future."

  const total = sessionMinutes(value)
  if (Number.isNaN(total)) errors.duration = 'Use whole numbers for hours and minutes.'
  else if (total === 0) errors.duration = 'Enter how long the session was.'
  else if (total > MAX_SESSION_MINUTES) errors.duration = "A session can't be longer than 24 hours."

  const pages = value.pagesRead?.trim() ?? ''
  if (medium === 'Book' && pages !== '' && !(WHOLE.test(pages) && Number(pages) > 0)) {
    errors.pagesRead = "Use a whole number above 0, or leave it empty if you didn't count."
  }

  return errors
}
