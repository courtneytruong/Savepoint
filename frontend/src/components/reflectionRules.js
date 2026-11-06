// The reflection rules in docs/data-model.md. The API checks the same rules, so
// these only exist to tell the user sooner.

export const MIN_NOTES_LENGTH = 20

/**
 * How much of the notes counts toward the minimum: spaces at either end don't.
 * Uses string length (UTF-16 units) because .NET's string.Length counts the same
 * way, so the form and the API agree on every note, emoji included.
 */
export const notesLength = (notes = '') => notes.trim().length

/** Returns a message for each field that breaks a rule, or an empty object. */
export function validateReflection({ mood, notes }) {
  const errors = {}
  if (!mood) errors.mood = 'Choose the mood that fits best.'

  const length = notesLength(notes)
  if (length === 0) errors.notes = 'Write a sentence or two about it.'
  else if (length < MIN_NOTES_LENGTH) {
    const short = MIN_NOTES_LENGTH - length
    errors.notes = `Write a little more: ${short} more ${short === 1 ? 'character' : 'characters'} to go.`
  }

  return errors
}
