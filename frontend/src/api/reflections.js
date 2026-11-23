// Calls to the API's reflection endpoints: an item's standalone reflections under
// /api/items/{itemId}/reflections, final thoughts that aren't about a session, and
// every reflection in the library at /api/reflections. A session's reflection is
// saved with its session, through api/sessions.js.

const reflectionsPath = (itemId) => `/api/items/${encodeURIComponent(itemId)}/reflections`
const reflectionPath = (itemId, reflectionId) => `${reflectionsPath(itemId)}/${encodeURIComponent(reflectionId)}`

// The body the API takes, from what ReflectionForm gives. Tags go by name, and the
// API makes any that are new.
const toRequest = ({ mood, notes, tags }) => ({ mood, notes, tags: tags ?? [] })

async function send(url, method, values) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRequest(values)),
  })
  if (response.status === 404) return { error: 'missing' }
  if (!response.ok) return { error: 'failed' }
  return { reflection: await response.json() }
}

/**
 * An item's standalone reflections, newest first, each as { id, mood, notes,
 * createdAt, updatedAt, tags }. updatedAt starts as createdAt, and moves when its
 * mood, notes or tags are edited. tags are names, alphabetical ignoring case and
 * accents. Answers null when there's no such item in this library: the API answers
 * 404 for other people's items too. Throws on any other answer, as when the server
 * fails or can't be reached.
 */
export async function getReflections(itemId, { signal } = {}) {
  const response = await fetch(reflectionsPath(itemId), { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading reflections got ${response.status}`)
  return response.json()
}

/**
 * Writes a reflection about an item, not about any session. Takes what
 * ReflectionForm gives: { mood, notes, tags }.
 *
 * Resolves with { reflection }, in the shape getReflections gives, { error:
 * 'missing' } when the item is no longer in this library, or { error: 'failed' }
 * for any other answer: the form checks the same rules first, so a 400 means
 * they've drifted apart. If the server can't be reached, fetch throws, which counts
 * as failed too.
 */
export function writeReflection(itemId, values) {
  return send(reflectionsPath(itemId), 'POST', values)
}

/**
 * Replaces a standalone reflection's mood, notes and tags, all of them each time,
 * so no tags clears them. Answers as writeReflection does: { reflection },
 * { error: 'missing' } when the item or the reflection is no longer there, or
 * { error: 'failed' }, and throws if the server can't be reached.
 */
export function editReflection(itemId, reflectionId, values) {
  return send(reflectionPath(itemId, reflectionId), 'PUT', values)
}

/**
 * Deletes a standalone reflection. Resolves with { deleted: true }, also when it
 * was already gone (a 404), since either way it's no longer there, or { error:
 * 'failed' } for any other answer. Throws if the server can't be reached.
 */
export async function deleteReflection(itemId, reflectionId) {
  const response = await fetch(reflectionPath(itemId, reflectionId), { method: 'DELETE' })
  if (response.status === 204 || response.status === 404) return { deleted: true }
  return { error: 'failed' }
}

/**
 * Every reflection in the library, sessions' and standalone ones alike, newest
 * written first, each as { id, mood, notes, createdAt, updatedAt, tags, item: { id,
 * title, medium }, session }. session is { id, date, durationMinutes, pagesRead,
 * createdAt, updatedAt } for a session's reflection, with date a "yyyy-MM-dd" day
 * key, or null for one that stands alone, whose day comes from its createdAt.
 * Throws on any answer but a list, as when the server fails or can't be reached.
 */
export async function getAllReflections({ signal } = {}) {
  const response = await fetch('/api/reflections', { signal })
  if (!response.ok) throw new Error(`Loading reflections got ${response.status}`)
  return response.json()
}
