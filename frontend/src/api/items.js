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

/**
 * Adds an item to the library. Resolves with { item }, in the shape getItems
 * gives, or { error: 'failed' } for any other answer: the form checks the same
 * rules first, so a 400 means they've drifted apart. If the server can't be
 * reached, fetch throws, which the form also counts as failed.
 */
export async function createItem({ medium, title, creator, status }) {
  const response = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medium, title, creator, status }),
  })
  if (response.status !== 201) return { error: 'failed' }
  return { item: await response.json() }
}
