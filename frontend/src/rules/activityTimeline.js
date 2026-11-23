// The whole library's history as one timeline, for the Timeline and Calendar pages.

import { itemPath } from '../paths.js'
import { buildTimeline } from './timelineEntries.js'

const LISTS = ['statusChanges', 'ratingChanges', 'sessions', 'reflections']

/**
 * What getActivity gives, as timeline entries, oldest first, in the order an item's
 * own timeline uses. Each item's history goes through buildTimeline on its own, so
 * its first status change is marked first (it was added), and each status or rating
 * change's previous is that item's own, not another item's.
 *
 * Every entry is a buildTimeline entry with item: { id, title, medium, href }.
 */
export function buildActivityTimeline(activity) {
  const byItem = new Map()
  for (const list of LISTS) {
    for (const { item, ...entry } of activity?.[list] ?? []) {
      if (!byItem.has(item.id)) {
        const history = Object.fromEntries(LISTS.map((name) => [name, []]))
        byItem.set(item.id, { item: { ...item, href: itemPath(item.id) }, ...history })
      }
      byItem.get(item.id)[list].push(entry)
    }
  }

  return [...byItem.values()]
    .flatMap(({ item, ...history }) => buildTimeline(history).map((entry) => ({ ...entry, item })))
    .sort((a, b) => a.time - b.time)
}
