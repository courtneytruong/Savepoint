// Calls to the API's /api/items/{itemId}/sessions endpoints: an item's sessions,
// each with its reflection.

const sessionsPath = (itemId) => `/api/items/${encodeURIComponent(itemId)}/sessions`

// The body the API takes, from what SessionForm gives: without its itemId, which
// is in the address, or the reflection's tags, which wait for the tags feature.
const toRequest = ({ date, durationMinutes, pagesRead, reflection }) => ({
  date,
  durationMinutes,
  pagesRead,
  reflection: { mood: reflection.mood, notes: reflection.notes },
})

/**
 * Every session for an item, newest day first, each as { id, itemId, date,
 * durationMinutes, pagesRead, createdAt, reflection: { id, mood, notes, createdAt,
 * updatedAt } }. date is a "yyyy-MM-dd" day key, and pagesRead is null when not
 * counted. Answers null when there's no such item in this library: the API answers
 * 404 for other people's items too. Throws on any other answer, as when the server
 * fails or can't be reached.
 */
export async function getSessions(itemId, { signal } = {}) {
  const response = await fetch(sessionsPath(itemId), { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Loading sessions got ${response.status}`)
  return response.json()
}

/**
 * Logs a session with its reflection, which the API saves together. Takes what
 * SessionForm gives; its itemId and the reflection's tags aren't sent, since the
 * item is in the address and tags wait for the tags feature.
 *
 * Resolves with { session }, in the shape getSessions gives, { error: 'missing' }
 * when the item is no longer in this library, or { error: 'failed' } for any other
 * answer: the form checks the same rules first, so a 400 means they've drifted
 * apart. If the server can't be reached, fetch throws, which counts as failed too.
 */
export async function logSession(itemId, values) {
  const response = await fetch(sessionsPath(itemId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRequest(values)),
  })
  if (response.status === 404) return { error: 'missing' }
  if (response.status !== 201) return { error: 'failed' }
  return { session: await response.json() }
}

/**
 * Replaces a session's date, duration and pages, and its reflection's mood and
 * notes, all of them each time, so a null pagesRead clears it. Takes what
 * SessionForm gives, as logSession does. Answers as logSession does too: { session },
 * { error: 'missing' } when the item or the session is no longer there, or
 * { error: 'failed' }, and throws if the server can't be reached.
 */
export async function editSession(itemId, sessionId, values) {
  const response = await fetch(`${sessionsPath(itemId)}/${encodeURIComponent(sessionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRequest(values)),
  })
  if (response.status === 404) return { error: 'missing' }
  if (!response.ok) return { error: 'failed' }
  return { session: await response.json() }
}

/**
 * Deletes a session and its reflection. Resolves with { deleted: true }, also
 * when it was already gone (a 404), since either way it's no longer there, or
 * { error: 'failed' } for any other answer. Throws if the server can't be reached.
 */
export async function deleteSession(itemId, sessionId) {
  const response = await fetch(`${sessionsPath(itemId)}/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
  if (response.status === 204 || response.status === 404) return { deleted: true }
  return { error: 'failed' }
}
