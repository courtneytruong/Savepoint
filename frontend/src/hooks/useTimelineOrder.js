import { useStoredChoice } from './useStoredView.js'

/**
 * Which way round timelines are read: newest (the default) or oldest first.
 * Remembered in this browser, and shared by every timeline, an item's or the
 * whole library's, so the choice holds wherever you read one. Answers
 * [order, setOrder].
 */
export function useTimelineOrder() {
  return useStoredChoice('savepoint.timeline.order', ['newest', 'oldest'], 'newest')
}
