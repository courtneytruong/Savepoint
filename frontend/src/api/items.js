// Calls to the API's /api/items endpoints, the signed-in person's library.

/**
 * Every item in the library, newest first, each as { id, medium, title, creator,
 * status, statusChangeId, statusChangedAt, createdAt }. statusChangeId is the id of
 * the current status in getStatusChanges. Throws on any answer but a list, as when
 * the server fails or can't be reached.
 */
export async function getItems({ signal } = {}) {
  const response = await fetch('/api/items', { signal })
  if (!response.ok) throw new Error(`Loading the library got ${response.status}`)
  return response.json()
}

/**
 * One item, in the shape getItems gives, or null when there's no such item in
 * this library: the API answers 404 for other people's items too. Throws on any
 * other answer, as when the server fails or can't be reached.
 */
export async function getItem(id, { signal } = {}) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading an item got ${response.status}`)
  return response.json()
}

/**
 * Every status an item has had, oldest first, each as { id, status, changedAt },
 * starting with the one it was added with, for its timeline. Answers null when
 * there's no such item in this library, and throws on any other answer, as
 * getItem does.
 */
export async function getStatusChanges(id, { signal } = {}) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}/status-changes`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading status changes got ${response.status}`)
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

/**
 * Moves an item to another status. Resolves with { item }, in the shape getItems
 * gives, { error: 'missing' } when it's no longer in this library, or
 * { error: 'failed' } for any other answer. If the server can't be reached,
 * fetch throws, which counts as failed too.
 */
export async function changeItemStatus(id, status) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (response.status === 404) return { error: 'missing' }
  if (!response.ok) return { error: 'failed' }
  return { item: await response.json() }
}

/**
 * Replaces an item's medium, title and creator, all three each time, so a null
 * creator clears it. Answers as changeItemStatus does: { item }, { error:
 * 'missing' } or { error: 'failed' }, and throws if the server can't be reached.
 * It also answers { error: 'pagesLogged' } when a book can't become a game,
 * because some of its sessions have pages logged.
 */
export async function editItem(id, { medium, title, creator }) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medium, title, creator }),
  })
  if (response.status === 404) return { error: 'missing' }
  if (response.status === 409 && (await errorCode(response)) === 'pagesLogged') return { error: 'pagesLogged' }
  if (!response.ok) return { error: 'failed' }
  return { item: await response.json() }
}

// The "error" code in a Problem Details answer, or null when there's none to read.
async function errorCode(response) {
  try {
    return (await response.json()).error ?? null
  } catch {
    return null
  }
}

/**
 * Deletes an item and its whole history. Resolves with { deleted: true }, also
 * when it was already gone (a 404), since either way it's no longer there, or
 * { error: 'failed' } for any other answer. Throws if the server can't be reached.
 */
export async function deleteItem(id) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (response.status === 204 || response.status === 404) return { deleted: true }
  return { error: 'failed' }
}
