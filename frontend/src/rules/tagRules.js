// The tag rules in docs/data-model.md. The API checks the same rules, so these
// only exist to tell the user sooner.

export const MAX_TAG_LENGTH = 40
export const MAX_TAGS = 10

/**
 * Spaces trimmed from the ends and runs of spaces inside made single. Composed
 * (NFC) too, as the API saves it, so an accent typed as one character or as two
 * shows the same.
 */
export const cleanTag = (text) => text.trim().replace(/\s+/g, ' ').normalize('NFC')

/** Characters in a cleaned name, counted by code point as the API does, so an emoji is one. */
export const tagLength = (name = '') => [...cleanTag(name)].length

/** A message when a name is too long to be a tag, or null. */
export function tagNameError(name) {
  const over = tagLength(name) - MAX_TAG_LENGTH
  return over > 0 ? `Keep a tag to ${MAX_TAG_LENGTH} characters: ${over} over.` : null
}

/** A message when a reflection's tags break a rule, or null. */
export function validateTags(tags = []) {
  const long = tags.find(tagNameError)
  if (long) return tagNameError(long)
  const over = tags.length - MAX_TAGS
  if (over > 0) return `Use up to ${MAX_TAGS} tags: remove ${over}.`
  return null
}
