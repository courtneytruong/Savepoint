import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link as RouterLink, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
import { TimelinePage } from '../pages/TimelinePage.jsx'

const ACCOUNT = { id: 'a1', displayName: 'Courtney', email: 'reader@example.com' }

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }

const EMPTY = { statusChanges: [], ratingChanges: [], sessions: [], reflections: [] }

// Times without a zone are the reader's own, so the days hold wherever tests run.
const ACTIVITY = {
  ...EMPTY,
  statusChanges: [
    { id: 'c1', status: 'Backlog', changedAt: '2026-10-20T12:00:00', item: BOOK },
    { id: 'c2', status: 'InProgress', changedAt: '2026-11-02T12:00:00', item: GAME },
  ],
  ratingChanges: [{ id: 'r1', rating: 4, changedAt: '2026-11-05T12:00:00', item: BOOK }],
}

// One item added a day, for more entries than show at first.
const manyItems = (count) => ({
  ...EMPTY,
  statusChanges: Array.from({ length: count }, (_, n) => {
    const day = new Date(2026, 0, 1 + n, 12)
    return {
      id: `c${n}`,
      status: 'Backlog',
      changedAt: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}T12:00:00`,
      item: { id: `i${n}`, title: `Item ${n}`, medium: 'Book' },
    }
  }),
})

const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const neverAnswers = () => new Promise(() => {})

function stubFetch(...answers) {
  const fetchStub = vi.fn()
  for (const answer of answers) fetchStub.mockImplementationOnce(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/timeline']}>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <Routes>
            <Route path="/timeline" element={<TimelinePage account={ACCOUNT} onSignedOut={vi.fn()} />} />
            <Route path="/items/:id" element={<p>An item’s page</p>} />
          </Routes>
        </ToastProvider>
      </LinkProvider>
    </MemoryRouter>,
  )
}

// The timeline's entries, each with its own date, in the order they show.
const entries = () =>
  screen
    .getAllByRole('listitem')
    .filter((item) => item.querySelector('time'))
    .map((item) => item.textContent)

describe('TimelinePage', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('asks the API for everything that happened and says it is loading until it arrives', () => {
    const fetchStub = stubFetch(neverAnswers)
    renderPage()
    expect(fetchStub.mock.calls[0][0]).toBe('/api/activity')
    expect(screen.getByRole('status', { name: 'Loading timeline' })).toBeTruthy()
  })

  it('shows everything newest first, under month headings, naming each item', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: /November/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: /October/ })).toBeTruthy()
    const shown = entries()
    expect(shown[0]).toContain('Rated Piranesi 4 stars')
    expect(shown[1]).toContain('Added Outer Wilds to your library')
    expect(shown[2]).toContain('Added Piranesi to your library')
    expect(screen.getByRole('status').textContent).toBe('Showing 3 of 3')
    expect(screen.queryByRole('button', { name: /Show \d+/ })).toBeNull()
  })

  it('links each item’s name to its page', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()

    fireEvent.click((await screen.findAllByRole('link', { name: 'Outer Wilds' }))[0])

    expect(await screen.findByText('An item’s page')).toBeTruthy()
  })

  it('can show the oldest first, and remembers it as item pages do', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()
    await screen.findByRole('heading', { level: 2, name: /November/ })

    fireEvent.click(screen.getByRole('button', { name: 'Oldest first' }))

    expect(entries()[0]).toContain('Added Piranesi to your library')
    expect(window.localStorage.getItem('savepoint.timeline.order')).toBe('oldest')
  })

  it('shows the newest 50 at first, and more on asking', async () => {
    stubFetch(async () => json(manyItems(60)))
    renderPage()
    await screen.findAllByRole('heading', { level: 2 })

    expect(entries()).toHaveLength(50)
    expect(entries()[0]).toContain('Item 59')
    expect(screen.getByRole('status').textContent).toBe('Showing 50 of 60')

    fireEvent.click(screen.getByRole('button', { name: 'Show 10 earlier' }))

    expect(entries()).toHaveLength(60)
    expect(entries().at(-1)).toContain('Item 0')
    expect(screen.queryByRole('button', { name: /Show \d+/ })).toBeNull()
  })

  it('shows the oldest 50 first when reading oldest first', async () => {
    window.localStorage.setItem('savepoint.timeline.order', 'oldest')
    stubFetch(async () => json(manyItems(60)))
    renderPage()
    await screen.findAllByRole('heading', { level: 2 })

    expect(entries()[0]).toContain('Item 0')
    expect(screen.getByRole('button', { name: 'Show 10 later' })).toBeTruthy()
  })

  describe('filters', () => {
    const MIXED = {
      statusChanges: [
        { id: 'c1', status: 'Backlog', changedAt: '2026-11-01T12:00:00', item: BOOK },
        { id: 'c2', status: 'InProgress', changedAt: '2026-11-02T12:00:00', item: GAME },
      ],
      ratingChanges: [{ id: 'r1', rating: 4, changedAt: '2026-11-03T12:00:00', item: BOOK }],
      sessions: [
        {
          id: 's1',
          itemId: 'g1',
          date: '2026-11-04',
          durationMinutes: 90,
          pagesRead: null,
          createdAt: '2026-11-04T20:00:00',
          updatedAt: '2026-11-04T20:00:00',
          reflection: { id: 'sr1', mood: 'Curious', notes: 'The quantum moon keeps slipping away.', tags: [] },
          item: GAME,
        },
      ],
      reflections: [
        {
          id: 'x1',
          mood: 'Moved',
          notes: 'The house has its own tides.',
          createdAt: '2026-11-05T12:00:00',
          updatedAt: '2026-11-05T12:00:00',
          tags: [],
          item: BOOK,
        },
      ],
    }
    const press = (group, name) =>
      fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name }))

    async function shown() {
      stubFetch(async () => json(MIXED))
      renderPage()
      await screen.findByRole('heading', { level: 2, name: /November/ })
    }

    it('filters by type', async () => {
      await shown()
      press('Filter by type', 'Books')

      const text = entries()
      expect(text).toHaveLength(3)
      for (const entry of text) expect(entry).toContain('Piranesi')
      expect(screen.getByRole('status').textContent).toBe('Showing 3 of 3')
    })

    it.each([
      ['Sessions', 'The quantum moon keeps slipping away.'],
      ['Reflections', 'The house has its own tides.'],
      ['Ratings', 'Rated Piranesi 4 stars'],
    ])('filters by kind: %s', async (kind, text) => {
      await shown()
      press('Filter by kind', kind)

      expect(entries()).toHaveLength(1)
      expect(entries()[0]).toContain(text)
    })

    it('counts an item being added as a status change', async () => {
      await shown()
      press('Filter by kind', 'Status changes')

      expect(entries()).toEqual([
        expect.stringContaining('Added Outer Wilds to your library'),
        expect.stringContaining('Added Piranesi to your library'),
      ])
    })

    it('combines both, and says when nothing matches, with a way to clear them', async () => {
      await shown()
      press('Filter by type', 'Games')
      press('Filter by kind', 'Ratings')

      expect(screen.getByRole('heading', { name: 'Nothing matches those filters' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

      expect(entries()).toHaveLength(5)
    })

    it('starts again from the first 50 when a filter changes', async () => {
      stubFetch(async () => json(manyItems(120)))
      renderPage()
      await screen.findAllByRole('heading', { level: 2 })
      fireEvent.click(screen.getByRole('button', { name: 'Show 50 earlier' }))
      expect(entries()).toHaveLength(100)

      press('Filter by type', 'Books')

      expect(entries()).toHaveLength(50)
    })
  })

  it('marks itself in the header and the sidebar', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()
    await screen.findByRole('heading', { level: 2, name: /November/ })

    const links = screen.getAllByRole('link', { name: /^Timeline/ })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('says when nothing has happened yet', async () => {
    stubFetch(async () => json(EMPTY))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Nothing on your timeline yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to your library' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Oldest first' })).toBeNull()
  })

  it('says when it can’t load, and tries again', async () => {
    stubFetch(async () => json({ status: 500 }, 500), async () => json(ACTIVITY))
    renderPage()

    expect(await screen.findByRole('heading', { name: "Couldn't load your timeline" })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 2, name: /November/ })).toBeTruthy()
    expect(within(screen.getByRole('main')).queryByText("Couldn't load your timeline")).toBeNull()
  })
})
