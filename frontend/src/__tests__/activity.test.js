import { describe, expect, it, vi } from 'vitest'
import { getActivity } from '../api/activity.js'
import { buildActivityTimeline } from '../rules/activityTimeline.js'

function stubFetch(answer) {
  const fetchStub = vi.fn(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const json = (body, status) => new Response(JSON.stringify(body), { status })

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }

const EMPTY = { statusChanges: [], ratingChanges: [], sessions: [], reflections: [] }

describe('getActivity', () => {
  it('asks for everything that happened and answers with it', async () => {
    const activity = { ...EMPTY, statusChanges: [{ id: 'c1', status: 'Backlog', changedAt: '2026-11-01T12:00:00', item: BOOK }] }
    const fetchStub = stubFetch(async () => json(activity, 200))

    expect(await getActivity()).toEqual(activity)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/activity')
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getActivity()).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => json(EMPTY, 200))
    const controller = new AbortController()
    await getActivity({ signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('buildActivityTimeline', () => {
  // Times without a zone are the reader's own, so the days hold wherever tests run.
  const ACTIVITY = {
    statusChanges: [
      { id: 'c1', status: 'Backlog', changedAt: '2026-11-01T12:00:00', item: BOOK },
      { id: 'c2', status: 'InProgress', changedAt: '2026-11-02T12:00:00', item: GAME },
      { id: 'c3', status: 'InProgress', changedAt: '2026-11-03T12:00:00', item: BOOK },
    ],
    ratingChanges: [
      { id: 'g-r1', rating: 4, changedAt: '2026-11-04T12:00:00', item: GAME },
      { id: 'b-r1', rating: 2, changedAt: '2026-11-05T12:00:00', item: BOOK },
    ],
    sessions: [
      {
        id: 's1',
        itemId: 'b1',
        date: '2026-11-06',
        durationMinutes: 45,
        pagesRead: 30,
        createdAt: '2026-11-06T20:00:00',
        updatedAt: '2026-11-06T20:00:00',
        reflection: { id: 'r1', mood: 'Curious', notes: 'The house has its own tides.', tags: [] },
        item: BOOK,
      },
    ],
    reflections: [
      {
        id: 'r2',
        mood: 'Moved',
        notes: 'Nothing else has made me feel this small.',
        createdAt: '2026-11-07T12:00:00',
        updatedAt: '2026-11-07T12:00:00',
        tags: ['awe'],
        item: GAME,
      },
    ],
  }

  it('puts every item’s history in one list, oldest first, each entry with its item', () => {
    const entries = buildActivityTimeline(ACTIVITY)

    expect(entries.map((entry) => [entry.key, entry.item.title])).toEqual([
      ['status-c1', 'Piranesi'],
      ['status-c2', 'Outer Wilds'],
      ['status-c3', 'Piranesi'],
      ['rating-g-r1', 'Outer Wilds'],
      ['rating-b-r1', 'Piranesi'],
      ['session-s1', 'Piranesi'],
      ['reflection-r2', 'Outer Wilds'],
    ])
    expect(entries[0].item).toEqual({ ...BOOK, href: '/items/b1' })
    expect(entries[5].day).toBe('2026-11-06')
  })

  it('marks each item’s own first status change as it being added', () => {
    const entries = buildActivityTimeline(ACTIVITY)
    const first = Object.fromEntries(entries.filter((e) => e.type === 'status').map((e) => [e.id, e.first]))

    expect(first).toEqual({ c1: true, c2: true, c3: false })
  })

  it('compares each change with the same item’s previous one, not another item’s', () => {
    const entries = buildActivityTimeline(ACTIVITY)
    const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]))

    expect(byId.c3.previous).toBe('Backlog')
    expect(byId['b-r1'].previous).toBeUndefined()
  })

  it('answers with nothing for no activity', () => {
    expect(buildActivityTimeline(EMPTY)).toEqual([])
    expect(buildActivityTimeline(undefined)).toEqual([])
  })
})
