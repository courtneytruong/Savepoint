// What the item forms check before sending anything: the library rules in
// docs/data-model.md, which the API checks again.

export const MAX_TITLE_LENGTH = 200
export const MAX_CREATOR_LENGTH = 200

/**
 * Returns a message for each field that breaks a rule, or an empty object. Both
 * are trimmed first, as the API does, and an empty creator is simply none.
 */
export function validateItem({ title = '', creator = '' }) {
  const errors = {}

  const trimmedTitle = title.trim()
  if (trimmedTitle === '') errors.title = 'Enter a title.'
  else if (trimmedTitle.length > MAX_TITLE_LENGTH) errors.title = `Use ${MAX_TITLE_LENGTH} characters or fewer.`

  if (creator.trim().length > MAX_CREATOR_LENGTH) errors.creator = `Use ${MAX_CREATOR_LENGTH} characters or fewer.`

  return errors
}

/**
 * What the API can say went wrong saving an item: pagesLogged, shown on the type
 * field, when a book with pages logged can't become a game, or failed, shown
 * above the form.
 */
export const ITEM_ERRORS = ['pagesLogged', 'failed']

export const PAGES_LOGGED_MESSAGE =
  "Its sessions have pages logged, and games don't have pages. Remove the page counts from its sessions first, or keep it a book."

