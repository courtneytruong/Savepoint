import { describe, expect, it } from 'vitest'
import { toLibraryReflections } from '../rules/libraryReflections.js'

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }

// Times without a zone are the reader's own, so the days hold wherever tests run.
const sessionReflection = (id, item, date, loggedAt, overrides = {}) => ({
  id,
  mood: 'Curious',
  notes: `A session on ${date}.`,
  createdAt: loggedAt,
  updatedAt: loggedAt,
  tags: ['house'],
  item,
  session: { id: `s-${id}`, date, durationMinutes: 45, pagesRead: 30, createdAt: loggedAt, updatedAt: loggedAt },
  ...overrides,
})

const standalone = (id, item, writtenAt, overrides = {}) => ({
  id,
  mood: 'Moved',
  notes: `Written at ${writtenAt}.`,
  createdAt: writtenAt,
  updatedAt: writtenAt,
  tags: [],
  item,
  session: null,
  ...overrides,
})

describe('toLibraryReflections', () => {
  it('puts them newest first, a session’s on its day and a standalone one on the day it was written', () => {
    const cards = toLibraryReflections([
      // The API sends them newest written first, so the one logged late comes first.
      sessionReflection('r3', BOOK, '2026-11-12', '2026-11-15T09:00:00'),
      sessionReflection('r2', GAME, '2026-11-14', '2026-11-14T20:00:00'),
      standalone('r1', BOOK, '2026-11-13T12:00:00'),
    ])

    expect(cards.map((card) => [card.key, card.day])).toEqual([
      ['session-s-r2', '2026-11-14'],
      ['reflection-r1', '2026-11-13'],
      ['session-s-r3', '2026-11-12'],
    ])
  })

  it('gives a session’s reflection its item, linked, and its session', () => {
    const [card] = toLibraryReflections([sessionReflection('r1', BOOK, '2026-11-14', '2026-11-14T20:00:00')])

    expect(card).toEqual({
      key: 'session-s-r1',
      item: { ...BOOK, href: '/items/b1' },
      day: '2026-11-14',
      session: { durationMinutes: 45, pagesRead: 30 },
      mood: 'Curious',
      notes: 'A session on 2026-11-14.',
      tags: ['house'],
      loggedOn: undefined,
      editedAt: undefined,
    })
  })

  it('gives a standalone reflection its item and no session', () => {
    const [card] = toLibraryReflections([standalone('r1', GAME, '2026-11-13T12:00:00', { tags: ['awe'] })])

    expect(card).toEqual({
      key: 'reflection-r1',
      item: { ...GAME, href: '/items/g1' },
      day: '2026-11-13',
      mood: 'Moved',
      notes: 'Written at 2026-11-13T12:00:00.',
      tags: ['awe'],
      editedAt: undefined,
    })
  })

  it('says when a session was logged late', () => {
    const [card] = toLibraryReflections([sessionReflection('r1', BOOK, '2026-11-12', '2026-11-15T09:00:00')])
    expect(card.loggedOn).toBe('2026-11-15T09:00:00')
  })

  it('says when either kind was edited', () => {
    const [session, alone] = toLibraryReflections([
      sessionReflection('r2', BOOK, '2026-11-14', '2026-11-14T20:00:00', {
        session: {
          id: 's-r2',
          date: '2026-11-14',
          durationMinutes: 60,
          pagesRead: null,
          createdAt: '2026-11-14T20:00:00',
          updatedAt: '2026-11-16T08:00:00',
        },
      }),
      standalone('r1', GAME, '2026-11-13T12:00:00', { updatedAt: '2026-11-15T10:00:00' }),
    ])

    expect(session.editedAt).toBe('2026-11-16T08:00:00')
    expect(alone.editedAt).toBe('2026-11-15T10:00:00')
  })
})
