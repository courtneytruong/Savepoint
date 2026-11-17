// The reflection rules in docs/data-model.md. The API checks the same rules, so
// these only exist to tell the user sooner.

export const MIN_NOTES_LENGTH = 20
export const MAX_NOTES_LENGTH = 10_000

/**
 * How much of the notes counts toward the limits: spaces at either end don't.
 * Counts characters as the API and the database do, by code point, so an emoji
 * is one character. String length would count it as two, and let through notes
 * the API then refuses as too short.
 */
export const notesLength = (notes = '') => [...notes.trim()].length

const plural = (count, word) => `${count.toLocaleString()} ${count === 1 ? word : `${word}s`}`

/** Returns a message for each field that breaks a rule, or an empty object. */
export function validateReflection({ mood, notes }) {
  const errors = {}
  if (!mood) errors.mood = 'Choose the mood that fits best.'

  const length = notesLength(notes)
  if (length === 0) errors.notes = 'Write a sentence or two about it.'
  else if (length < MIN_NOTES_LENGTH) {
    errors.notes = `Write a little more: ${plural(MIN_NOTES_LENGTH - length, 'more character')} to go.`
  } else if (length > MAX_NOTES_LENGTH) {
    errors.notes = `Keep it to ${MAX_NOTES_LENGTH.toLocaleString()} characters: ${plural(length - MAX_NOTES_LENGTH, 'character')} over.`
  }

  return errors
}
