import { simplify } from '../utils/textSearch.js'

/**
 * The reflections that match every filter given. null means any. Tags match
 * ignoring case and accents, as the tag suggestions do.
 *
 * reflections: { item: { medium }, mood, tags? }
 */
export function filterReflections(reflections, { medium = null, mood = null, tag = null } = {}) {
  const wanted = tag && simplify(tag)
  return reflections.filter(
    (reflection) =>
      (!medium || reflection.item.medium === medium) &&
      (!mood || reflection.mood === mood) &&
      (!wanted || (reflection.tags ?? []).some((name) => simplify(name) === wanted)),
  )
}

/** How many reflections have each mood, as { Hooked: 3, … }. Moods with none are left out. */
export function countMoods(reflections) {
  const counts = {}
  for (const { mood } of reflections) counts[mood] = (counts[mood] ?? 0) + 1
  return counts
}
