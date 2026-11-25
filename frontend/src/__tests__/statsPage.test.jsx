import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link as RouterLink, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
import { StatsPage } from '../pages/StatsPage.jsx'
import { toDateKey } from '../utils/calendarDates.js'

const ACCOUNT = { id: 'a1', displayName: 'Courtney', email: 'reader@example.com' }

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }
const ITEMS = [
  { ...BOOK, creator: 'Susanna Clarke', status: 'Finished', rating: 5, createdAt: '2026-01-02T12:00:00' },
  { ...GAME, creator: 'Mobius Digital', status: 'InProgress', rating: null, createdAt: '2026-01-02T12:00:00' },
]

const EMPTY = { statusChanges: [], ratingChanges: [], sessions: [], reflections: [] }

// The 1st of this month, so everything falls in this year, the page's default,
// and two years back, which only all time reaches, whatever month it is now.
const now = new Date()
const FIRST = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
const LONG_AGO = toDateKey(new Date(now.getFullYear() - 2, 0, 15))

const session = (id, item, durationMinutes, pagesRead, mood, date = FIRST) => ({
  id,
  itemId: item.id,
  date,
  durationMinutes,
  pagesRead,
  createdAt: `${date}T20:00:00`,
  updatedAt: `${date}T20:00:00`,
  reflection: { id: `r-${id}`, mood, notes: '', tags: [] },
  item,
})

const ACTIVITY = {
  ...EMPTY,
  statusChanges: [
    { id: 'c1', status: 'InProgress', changedAt: `${FIRST}T08:00:00`, item: BOOK },
    { id: 'c2', status: 'Finished', changedAt: `${FIRST}T22:00:00`, item: BOOK },
    { id: 'c3', status: 'InProgress', changedAt: `${FIRST}T08:00:00`, item: GAME },
  ],
  sessions: [
    session('s0', BOOK, 60, 100, 'Moved', LONG_AGO),
    session('s1', BOOK, 45, 30, 'Curious'),
    session('s2', GAME, 90, null, 'Curious'),
  ],
  reflections: [
    { id: 'r1', mood: 'Hooked', notes: '', tags: [], createdAt: `${FIRST}T23:00:00`, updatedAt: `${FIRST}T23:00:00`, item: GAME },
  ],
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const neverAnswers = () => new Promise(() => {})

// The page asks for both at once, so each address gets its own answers, in turn.
function stubFetch({ items = [], activity = [] }) {
  const answers = { '/api/items': items, '/api/activity': activity }
  const fetchStub = vi.fn((url) => (answers[url].length > 1 ? answers[url].shift() : answers[url][0])())
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/stats']}>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <Routes>
            <Route path="/stats" element={<StatsPage account={ACCOUNT} onSignedOut={vi.fn()} />} />
          </Routes>
        </ToastProvider>
      </LinkProvider>
    </MemoryRouter>,
  )
}

// A tile, found by its label in the stats, not the header's or sidebar's links.
const tile = (label, range = 'This year') =>
  within(screen.getByRole('region', { name: range })).getByText(label).closest('div')
const loaded = () => screen.findByRole('group', { name: 'Time range' })

describe('StatsPage', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('asks for the library and its history at once, and says it is loading', () => {
    const fetchStub = stubFetch({ items: [neverAnswers], activity: [neverAnswers] })
    renderPage()

    expect(fetchStub.mock.calls.map(([url]) => url).sort()).toEqual(['/api/activity', '/api/items'])
    expect(screen.getByRole('status', { name: 'Loading your stats' })).toBeTruthy()
  })

  it("shows this year's headline numbers", async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(ACTIVITY)] })
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'This year' })).toBeTruthy()
    expect(tile('Books finished').textContent).toBe('Books finished1')
    expect(tile('Games finished').textContent).toBe('Games finished0')
    expect(tile('Time logged').textContent).toBe('Time logged2h 15m45m reading, 1h 30m playing')
    expect(tile('Pages read').textContent).toBe('Pages read30')
    expect(tile('Reflections').textContent).toBe('Reflections3Most often: Curious')
  })

  it('starts on this year, and changes every number with the range', async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(ACTIVITY)] })
    renderPage()

    const ranges = await loaded()
    const pill = (name) => within(ranges).getByRole('button', { name })
    expect(pill('This year').getAttribute('aria-pressed')).toBe('true')
    expect(pill('All time').getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(pill('All time'))
    expect(pill('All time').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { level: 2, name: 'All time' })).toBeTruthy()
    expect(tile('Time logged', 'All time').textContent).toBe('Time logged3h 15m1h 45m reading, 1h 30m playing')
    expect(tile('Pages read', 'All time').textContent).toBe('Pages read130')

    // Two years back is further than the last 12 months.
    fireEvent.click(pill('Last 12 months'))
    expect(tile('Pages read', 'Last 12 months').textContent).toBe('Pages read30')
  })

  it('remembers the range for the next visit', async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(ACTIVITY)] })
    renderPage()
    fireEvent.click(within(await loaded()).getByRole('button', { name: 'All time' }))
    expect(window.localStorage.getItem('savepoint.stats.range')).toBe('all')

    cleanup()
    renderPage()
    expect(await screen.findByRole('heading', { level: 2, name: 'All time' })).toBeTruthy()
  })

  it('leaves out the hints and the chart when nothing was logged', async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(EMPTY)] })
    renderPage()

    await screen.findByRole('heading', { level: 2, name: 'This year' })
    expect(tile('Time logged').textContent).toBe('Time logged0m')
    expect(tile('Reflections').textContent).toBe('Reflections0')
    const time = screen.getByRole('region', { name: 'Time per month' })
    expect(within(time).getByText('No time logged this year. Log a session to see it here.')).toBeTruthy()
    expect(within(time).queryByRole('list')).toBeNull()
    const pages = screen.getByRole('region', { name: 'Pages read per month' })
    expect(within(pages).getByText('No pages logged this year. Add pages read to a book session to see them here.')).toBeTruthy()
  })

  it("charts the range's pages by month", async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(ACTIVITY)] })
    renderPage()

    const chart = await screen.findByRole('list', { name: 'Pages read each month, this year' })
    const month = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now)
    expect(within(chart).getByRole('img', { name: `${month}: 30 pages` })).toBeTruthy()
  })

  it("charts the range's time by month", async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(ACTIVITY)] })
    renderPage()

    const chart = await screen.findByRole('list', { name: 'Time logged each month, this year' })
    // January to this month, whichever it is.
    expect(within(chart).getAllByRole('img')).toHaveLength(now.getMonth() + 1)
    const month = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now)
    expect(within(chart).getByRole('img', { name: `${month}: 2h 15m, 45m reading and 1h 30m playing` })).toBeTruthy()

    fireEvent.click(within(await loaded()).getByRole('button', { name: 'All time' }))
    // From the session two years back, in January, to this month.
    expect(within(screen.getByRole('list', { name: 'Time logged each month, all time' })).getAllByRole('img')).toHaveLength(
      24 + now.getMonth() + 1,
    )
  })

  it('marks itself in the header and the sidebar', async () => {
    stubFetch({ items: [async () => json(ITEMS)], activity: [async () => json(ACTIVITY)] })
    renderPage()
    await screen.findByRole('heading', { level: 2, name: 'This year' })

    const links = screen.getAllByRole('link', { name: /^Stats/ })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('says when the library is empty', async () => {
    stubFetch({ items: [async () => json([])], activity: [async () => json(EMPTY)] })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No stats yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to your library' })).toBeTruthy()
    // With nothing to count, there's no range to choose.
    expect(screen.queryByRole('group', { name: 'Time range' })).toBeNull()
  })

  it('says when it can’t load, and tries again', async () => {
    stubFetch({
      items: [async () => json({ status: 500 }, 500), async () => json(ITEMS)],
      activity: [async () => json(ACTIVITY)],
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: "Couldn't load your stats" })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'This year' })).toBeTruthy()
  })
})
