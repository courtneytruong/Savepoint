// Calls to the API's /api/activity endpoint: everything that happened across the
// signed-in person's library, for the Timeline and Calendar pages.

/**
 * Everything that happened, as { statusChanges, ratingChanges, sessions,
 * reflections }, each list oldest first and shaped as an item's own endpoints give
 * it, with item: { id, title, medium } added to every entry:
 *
 * statusChanges: { id, status, changedAt, item }. An item's first is when it was added.
 * ratingChanges: { id, rating, changedAt, item }
 * sessions: as getSessions gives them, with their reflections, plus item.
 * reflections: standalone ones only, as getReflections gives them, plus item.
 *
 * Throws on any other answer, as when the server fails or can't be reached.
 */
export async function getActivity({ signal } = {}) {
  const response = await fetch('/api/activity', { signal })
  if (!response.ok) throw new Error(`Loading activity got ${response.status}`)
  return response.json()
}
