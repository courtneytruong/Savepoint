// Calls to the API's /api/items endpoints, the signed-in person's library.

/**
 * Every item in the library, newest first, each as { id, medium, title, creator,
 * status, statusChangedAt, createdAt }. Throws on any answer but a list, as when
 * the server fails or can't be reached.
 */
export async function getItems({ signal } = {}) {
  const response = await fetch('/api/items', { signal })
  if (!response.ok) throw new Error(`Loading the library got ${response.status}`)
  return response.json()
}
