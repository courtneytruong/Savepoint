// Calls to the API's /api/tags endpoint, the signed-in person's tags. Tags are
// made and removed by saving sessions, so there's only reading here.

/**
 * The names of every tag the person has, alphabetical ignoring case and accents,
 * for suggesting while they type. Throws on any answer but a list, as when the
 * server fails or can't be reached.
 */
export async function getTags({ signal } = {}) {
  const response = await fetch('/api/tags', { signal })
  if (!response.ok) throw new Error(`Loading tags got ${response.status}`)
  return response.json()
}
