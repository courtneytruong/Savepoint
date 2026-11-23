// The Reflections page's list: every reflection in the library, as cards.

import { itemPath } from '../paths.js'
import { wasEdited } from './reflectionRules.js'
import { sessionEditedAt } from './sessionList.js'
import { buildTimeline } from './timelineEntries.js'

/**
 * The reflections getAllReflections gives, newest first, in the order an item's
 * timeline uses: a session's reflection on the session's day, a standalone one on
 * the day it was written, in the reader's own time zone. They go through
 * buildTimeline, so the two orders can't drift apart.
 *
 * Each comes out as what a ReflectionCard shows, plus a key: { key, item: { id,
 * title, medium, href }, day, session?, mood, notes, tags, loggedOn?, editedAt? }.
 * session is { durationMinutes, pagesRead } for a session's reflection, and missing
 * for a standalone one.
 */
export function toLibraryReflections(reflections) {
  const sessions = []
  const standalone = []
  for (const { item, session, ...reflection } of reflections) {
    const about = { ...item, href: itemPath(item.id) }
    if (session) sessions.push({ ...session, item: about, reflection })
    else standalone.push({ ...reflection, item: about })
  }

  return buildTimeline({ sessions, reflections: standalone })
    .reverse()
    .map((entry) =>
      entry.type === 'session'
        ? {
            key: entry.key,
            item: entry.item,
            day: entry.day,
            session: { durationMinutes: entry.durationMinutes, pagesRead: entry.pagesRead },
            mood: entry.reflection.mood,
            notes: entry.reflection.notes,
            tags: entry.reflection.tags,
            loggedOn: entry.loggedLate ? entry.createdAt : undefined,
            editedAt: sessionEditedAt(entry),
          }
        : {
            key: entry.key,
            item: entry.item,
            day: entry.day,
            mood: entry.mood,
            notes: entry.notes,
            tags: entry.tags,
            editedAt: wasEdited(entry) ? entry.updatedAt : undefined,
          },
    )
}
