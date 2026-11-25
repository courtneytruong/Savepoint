import { describe, expect, it } from 'vitest'
import { buildActivityTimeline } from '../rules/activityTimeline.js'
import { buildStats, rangeStart, TOP_TAGS } from '../rules/stats.js'
import { toDateKey } from '../utils/calendarDates.js'

// A fixed today, so the ranges don't move: November 24, 2026.
const TODAY = new Date(2026, 10, 24)

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }

const EMPTY = { statusChanges: [], ratingChanges: [], sessions: [], reflections: [] }

// Times without a zone are read as local, so each lands on the day written.
let ids = 0
const id = () => `id${++ids}`
const status = (item, value, changedAt) => ({ id: id(), status: value, changedAt, item })
const session = (item, date, durationMinutes, { pagesRead = null, mood = 'Curious', tags = [], createdAt } = {}) => ({
  id: id(),
  itemId: item.id,
  date,
  durationMinutes,
  pagesRead,
  createdAt: createdAt ?? `${date}T20:00:00`,
  updatedAt: createdAt ?? `${date}T20:00:00`,
  reflection: { mood, notes: '', tags },
  item,
})
const reflection = (item, createdAt, { mood = 'Moved', tags = [] } = {}) => ({
  id: id(),
  mood,
  notes: '',
  tags,
  createdAt,
  updatedAt: createdAt,
  item,
})

const statsFor = (activity, range, items = []) =>
  buildStats({ items, entries: buildActivityTimeline({ ...EMPTY, ...activity }), range, today: TODAY })

describe('rangeStart', () => {
  it('starts this year on January 1st', () => {
    expect(toDateKey(rangeStart('year', TODAY))).toBe('2026-01-01')
  })

  it('starts the last 12 months on the 1st, eleven months before this one', () => {
    expect(toDateKey(rangeStart('last12', TODAY))).toBe('2025-12-01')
  })

  it('has no start for all time', () => {
    expect(rangeStart('all', TODAY)).toBeNull()
  })
})

describe('buildStats', () => {
  it('counts every finish, so a reread or replay counts again', () => {
    const stats = statsFor(
      {
        statusChanges: [
          status(BOOK, 'InProgress', '2026-02-01T12:00:00'),
          status(BOOK, 'Finished', '2026-03-01T12:00:00'),
          status(BOOK, 'InProgress', '2026-06-01T12:00:00'),
          status(BOOK, 'Finished', '2026-07-01T12:00:00'),
          status(GAME, 'InProgress', '2026-04-01T12:00:00'),
          status(GAME, 'Finished', '2026-05-01T12:00:00'),
        ],
      },
      'year',
    )

    expect(stats.finished).toEqual({ Book: 2, Game: 1 })
  })

  it("doesn't count an item added as Finished, which may have been finished long ago", () => {
    const stats = statsFor(
      {
        statusChanges: [
          status(BOOK, 'Finished', '2026-04-01T12:00:00'),
          // A reread after adding it does count.
          status(BOOK, 'InProgress', '2026-05-01T12:00:00'),
          status(BOOK, 'Finished', '2026-06-01T12:00:00'),
        ],
      },
      'year',
    )
    expect(stats.finished.Book).toBe(1)
  })

  it('leaves out what happened before the range, and keeps it for all time', () => {
    const activity = {
      statusChanges: [
        status(BOOK, 'InProgress', '2025-05-01T12:00:00'),
        status(BOOK, 'Finished', '2025-06-01T12:00:00'),
        status(BOOK, 'InProgress', '2025-12-01T12:00:00'),
        status(BOOK, 'Finished', '2026-01-01T00:30:00'),
      ],
      sessions: [session(BOOK, '2025-06-01', 60), session(BOOK, '2026-01-01', 30)],
    }

    expect(statsFor(activity, 'year').finished.Book).toBe(1)
    expect(statsFor(activity, 'year').minutes.Book).toBe(30)
    expect(statsFor(activity, 'all').finished.Book).toBe(2)
    expect(statsFor(activity, 'all').minutes.Book).toBe(90)
  })

  it('counts a session by the day it happened, not the day it was logged', () => {
    const late = session(BOOK, '2025-12-31', 45, { createdAt: '2026-01-02T09:00:00' })
    expect(statsFor({ sessions: [late] }, 'year').minutes.Book).toBe(0)
    expect(statsFor({ sessions: [late] }, 'last12').minutes.Book).toBe(45)
  })

  it('adds up minutes by type, and pages from book sessions', () => {
    const stats = statsFor(
      {
        sessions: [
          session(BOOK, '2026-03-02', 40, { pagesRead: 30 }),
          session(BOOK, '2026-03-05', 20, { pagesRead: 12 }),
          session(GAME, '2026-03-05', 90),
        ],
      },
      'year',
    )

    expect(stats.minutes).toEqual({ Book: 60, Game: 90 })
    expect(stats.pagesRead).toBe(42)
  })

  it('counts both kinds of reflection, with every mood listed in order', () => {
    const stats = statsFor(
      {
        sessions: [session(BOOK, '2026-03-02', 40, { mood: 'Hooked' }), session(GAME, '2026-03-03', 40, { mood: 'Hooked' })],
        reflections: [reflection(BOOK, '2026-04-01T12:00:00', { mood: 'Moved' })],
      },
      'year',
    )

    expect(stats.reflections).toBe(3)
    expect(stats.moods).toEqual([
      { mood: 'Hooked', count: 2 },
      { mood: 'Delighted', count: 0 },
      { mood: 'Moved', count: 1 },
      { mood: 'Curious', count: 0 },
      { mood: 'Frustrated', count: 0 },
      { mood: 'Bored', count: 0 },
    ])
  })

  it('lists the most-used tags first, ties by name, and only the top ones', () => {
    const many = Array.from({ length: TOP_TAGS + 2 }, (_, index) => `tag ${String(index).padStart(2, '0')}`)
    const stats = statsFor(
      {
        sessions: [session(BOOK, '2026-03-02', 40, { tags: ['twist', 'cozy'] })],
        reflections: [reflection(BOOK, '2026-04-01T12:00:00', { tags: ['twist', ...many] })],
      },
      'year',
    )

    expect(stats.tags).toHaveLength(TOP_TAGS)
    expect(stats.tags[0]).toEqual({ name: 'twist', count: 2 })
    expect(stats.tags[1]).toEqual({ name: 'cozy', count: 1 })
    expect(stats.tags[2]).toEqual({ name: 'tag 00', count: 1 })
  })

  it('charts every month of this year so far, with minutes by type and pages', () => {
    const stats = statsFor(
      {
        sessions: [
          session(BOOK, '2026-03-02', 40, { pagesRead: 25 }),
          session(GAME, '2026-03-20', 90),
          session(BOOK, '2026-11-01', 15, { pagesRead: 8 }),
        ],
      },
      'year',
    )

    expect(stats.months.map((month) => month.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ])
    expect(stats.months[0]).toEqual({ month: '2026-01', Book: 0, Game: 0, pages: 0 })
    expect(stats.months[2]).toEqual({ month: '2026-03', Book: 40, Game: 90, pages: 25 })
    expect(stats.months[10]).toEqual({ month: '2026-11', Book: 15, Game: 0, pages: 8 })
  })

  it('charts twelve months for the last 12 months, across the new year', () => {
    const { months } = statsFor({}, 'last12')
    expect(months).toHaveLength(12)
    expect(months[0].month).toBe('2025-12')
    expect(months.at(-1).month).toBe('2026-11')
  })

  it('charts all time from the first session, and nothing with no sessions', () => {
    const { months } = statsFor({ sessions: [session(GAME, '2025-10-15', 30)] }, 'all')
    expect(months).toHaveLength(14)
    expect(months[0]).toEqual({ month: '2025-10', Book: 0, Game: 30, pages: 0 })

    expect(statsFor({}, 'all').months).toEqual([])
  })

  it('counts the library as it is now, whatever the range', () => {
    const items = [
      { ...BOOK, status: 'Finished', rating: 5 },
      { ...GAME, status: 'Finished', rating: 3 },
      { id: 'b2', medium: 'Book', status: 'Backlog', rating: null },
    ]

    for (const range of ['year', 'all']) {
      const stats = statsFor({}, range, items)
      expect(stats.statuses).toEqual([
        { status: 'Backlog', count: 1 },
        { status: 'InProgress', count: 0 },
        { status: 'Finished', count: 2 },
        { status: 'Dropped', count: 0 },
      ])
      expect(stats.ratings).toEqual([
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 1 },
        { rating: 4, count: 0 },
        { rating: 5, count: 1 },
      ])
      expect(stats.unrated).toBe(1)
    }
  })

  it('answers with zeros for an empty library', () => {
    const stats = buildStats({ today: TODAY })
    expect(stats.finished).toEqual({ Book: 0, Game: 0 })
    expect(stats.minutes).toEqual({ Book: 0, Game: 0 })
    expect(stats.pagesRead).toBe(0)
    expect(stats.reflections).toBe(0)
    expect(stats.tags).toEqual([])
    expect(stats.unrated).toBe(0)
  })
})
