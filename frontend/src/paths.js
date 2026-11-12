// The app's addresses, in one place for the routes, the links and the tests.
export const SIGN_IN_PATH = '/sign-in'
export const CREATE_ACCOUNT_PATH = '/create-account'
export const LIBRARY_PATH = '/'
// The route for an item's own page; itemPath fills in the id.
export const ITEM_PATH = '/items/:id'

/**
 * The library, filtered by medium (Book or Game) and status, each left out of
 * the address when it's not filtered by.
 */
export function libraryPath({ medium = null, status = null } = {}) {
  const params = new URLSearchParams()
  if (medium) params.set('medium', medium)
  if (status) params.set('status', status)
  const query = params.toString()
  return query ? `${LIBRARY_PATH}?${query}` : LIBRARY_PATH
}

/** An item's own page. */
export function itemPath(id) {
  return `/items/${encodeURIComponent(id)}`
}
