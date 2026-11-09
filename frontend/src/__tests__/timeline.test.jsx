import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildTimeline, groupByMonth, Timeline } from '../components/index.js'

afterEach(cleanup)

// Timestamps without a Z are local time, so these pass in any time zone.
const HISTORY = {
  statusChanges: [
    { id: 2, status: 'InProgress', changedAt: '2026-09-20T19:00:00' },
    { id: 1, status: 'Backlog', changedAt: '2026-09-02T18:00:00' },
    { id: 3, status: 'Finished', changedAt: '2026-10-04T08:00:00' },
    { id: 4, status: 'InProgress', changedAt: '2026-10-25T19:00:00' },
  ],
  ratingChanges: [
    { id: 2, rating: 9, changedAt: '2026-10-26T21:30:00' },
    { id: 1, rating: 7, changedAt: '2026-10-04T21:30:00' },
  ],
  sessions: [
    {
      id: 1,
      date: '2026-09-20',
      createdAt: '2026-09-20T20:00:00',
      durationMinutes: 50,
      pagesRead: 40,
      reflection: { mood: 'Curious', notes: 'The house has tides.', tags: ['worldbuilding'] },
    },
    // Happened on the 3rd, logged the morning of the 4th.
    {
      id: 2,
      date: '2026-10-03',
      createdAt: '2026-10-04T09:00:00',
      durationMinutes: 95,
      reflection: { mood: 'Moved', notes: 'Read the whole last part in one go.' },
    },
  ],
  reflections: [{ id: 1, mood: 'Delighted', notes: 'Better the second time.', createdAt: '2026-10-26T22:00:00' }],
}

describe('buildTimeline', () => {
  it('orders sessions by the day they happened and everything else by when it was saved', () => {
    expect(buildTimeline(HISTORY).map((entry) => entry.key)).toEqual([
      'status-1',
      'status-2',
      'session-1',
      'session-2',
      'status-3',
      'rating-1',
      'status-4',
      'rating-2',
      'reflection-1',
    ])
  })

  it('puts a session logged late at the end of its own day, and marks it', () => {
    const entries = buildTimeline({
      statusChanges: [{ id: 1, status: 'Finished', changedAt: '2026-10-03T23:00:00' }],
      sessions: [HISTORY.sessions[1]],
    })

    expect(entries.map((entry) => entry.key)).toEqual(['status-1', 'session-2'])
    expect(entries[1]).toMatchObject({ day: '2026-10-03', loggedLate: true })
    expect(buildTimeline({ sessions: [HISTORY.sessions[0]] })[0].loggedLate).toBe(false)
  })

  it('marks the first status change and gives each change the value before it', () => {
    const entries = buildTimeline(HISTORY)
    const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry]))

    expect(byKey['status-1']).toMatchObject({ first: true, previous: undefined })
    expect(byKey['status-4']).toMatchObject({ first: false, previous: 'Finished' })
    expect(byKey['rating-1'].previous).toBeUndefined()
    expect(byKey['rating-2'].previous).toBe(7)
  })

  it('works with any of the lists left out', () => {
    expect(buildTimeline({})).toEqual([])
  })
})

describe('groupByMonth', () => {
  it('groups consecutive entries by month, keeping their order', () => {
    const groups = groupByMonth([{ day: '2026-10-26' }, { day: '2026-10-04' }, { day: '2026-09-20' }])

    expect(groups.map(({ month, entries }) => [month, entries.length])).toEqual([
      ['2026-10', 2],
      ['2026-09', 1],
    ])
  })
})

describe('Timeline', () => {
  const entries = buildTimeline(HISTORY)
  const items = () => screen.getAllByRole('listitem').filter((item) => item.querySelector('time'))

  it('shows the newest entry first by default, grouped under month headings', () => {
    render(<Timeline entries={entries} medium="Book" />)

    const months = screen.getAllByRole('heading').map((heading) => heading.textContent)
    expect(months).toHaveLength(2)
    expect(months[0]).toMatch(/October/)
    expect(items()[0].textContent).toContain('Better the second time.')
    expect(items().at(-1).textContent).toContain('Added to your library')
  })

  it('can show the oldest first', () => {
    render(<Timeline entries={entries} medium="Book" order="oldest" />)

    expect(screen.getAllByRole('heading')[0].textContent).toMatch(/September/)
    expect(items()[0].textContent).toContain('Added to your library')
  })

  it('describes each kind of entry in words, not only with color', () => {
    render(<Timeline entries={entries} medium="Book" order="oldest" />)
    const text = items().map((item) => item.textContent)

    expect(text[1]).toContain('Started reading')
    expect(text[2]).toContain('Read for 50m · 40 pages')
    expect(text[2]).toContain('Curious')
    expect(text[2]).toContain('#worldbuilding')
    expect(text[3]).toMatch(/Logged on/)
    expect(text[4]).toContain('Finished reading')
    expect(text[5]).toContain('Rated 7/10')
    expect(text[6]).toContain('Picked back up')
    expect(text[7]).toContain('Changed rating from 7 to 9/10')
    expect(text[8]).toContain('Reflection')
    expect(text[8]).toContain('Delighted')
  })

  it('words sessions and starting for games', () => {
    render(<Timeline entries={entries} medium="Game" order="oldest" />)

    expect(items()[1].textContent).toContain('Started playing')
    expect(items()[2].textContent).toContain('Played for 50m')
  })

  it('gives each entry a machine-readable date', () => {
    render(<Timeline entries={entries} medium="Book" order="oldest" />)

    expect(within(items()[3]).getByText(/./, { selector: 'time' }).getAttribute('dateTime')).toBe('2026-10-03')
  })

  it('shows an empty state, or the one it is given', () => {
    const { rerender } = render(<Timeline entries={[]} />)
    expect(screen.getByText('Nothing on this timeline yet')).toBeTruthy()

    rerender(<Timeline entries={[]} empty={<p>Nothing of that kind</p>} />)
    expect(screen.getByText('Nothing of that kind')).toBeTruthy()
    expect(screen.queryByText('Nothing on this timeline yet')).toBeNull()
  })

  it('announces that it is loading', () => {
    render(<Timeline loading />)

    expect(screen.getByRole('status', { name: 'Loading timeline' })).toBeTruthy()
  })
})
