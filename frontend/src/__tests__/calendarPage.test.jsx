import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link as RouterLink, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
import { CalendarPage } from '../pages/CalendarPage.jsx'
import { toDateKey } from '../utils/calendarDates.js'

const ACCOUNT = { id: 'a1', displayName: 'Courtney', email: 'reader@example.com' }

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }

const EMPTY = { statusChanges: [], ratingChanges: [], sessions: [], reflections: [] }

// Days in the current month, so the calendar opens on them: it starts on today's month.
const now = new Date()
const dayThisMonth = (day) => toDateKey(new Date(now.getFullYear(), now.getMonth(), day))
const FIRST = dayThisMonth(1)

const ACTIVITY = {
  ...EMPTY,
  statusChanges: [{ id: 'c1', status: 'InProgress', changedAt: `${FIRST}T09:00:00`, item: GAME }],
  sessions: [
    {
      id: 's1',
      itemId: 'b1',
      date: FIRST,
      durationMinutes: 45,
      pagesRead: 30,
      createdAt: `${FIRST}T20:00:00`,
      updatedAt: `${FIRST}T20:00:00`,
      reflection: { id: 'r1', mood: 'Curious', notes: 'The house has its own tides.', tags: [] },
      item: BOOK,
    },
  ],
}

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
    <MemoryRouter initialEntries={['/calendar']}>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <Routes>
            <Route path="/calendar" element={<CalendarPage account={ACCOUNT} onSignedOut={vi.fn()} />} />
            <Route path="/items/:id" element={<p>An item’s page</p>} />
          </Routes>
        </ToastProvider>
      </LinkProvider>
    </MemoryRouter>,
  )
}

const detail = () => within(screen.getByRole('region', { name: 'Selected day' }))

describe('CalendarPage', () => {
  afterEach(cleanup)

  it('asks the API for everything that happened and says it is loading until it arrives', () => {
    const fetchStub = stubFetch(neverAnswers)
    renderPage()
    expect(fetchStub.mock.calls[0][0]).toBe('/api/activity')
    expect(screen.getByRole('status', { name: 'Loading your calendar' })).toBeTruthy()
  })

  it('shows this month, with each day’s activity, opening on its latest day', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()

    const month = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now)
    expect(await screen.findByRole('heading', { level: 2, name: month })).toBeTruthy()
    const day = screen.getByRole('button', { name: /1 session, 45m; 1 other change\. Curious$/ })
    expect(day.getAttribute('aria-pressed')).toBe('true')
    expect(detail().getByRole('heading', { level: 3 })).toBeTruthy()
    expect(detail().getByText(/Added/).textContent).toBe('Added Outer Wilds to your library')
    expect(detail().getByText('The house has its own tides.')).toBeTruthy()
  })

  it('links each entry’s item to its page', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()

    await screen.findByRole('region', { name: 'Selected day' })
    fireEvent.click(detail().getByRole('link', { name: 'Piranesi' }))

    expect(await screen.findByText('An item’s page')).toBeTruthy()
  })

  it('marks itself in the header and the sidebar', async () => {
    stubFetch(async () => json(ACTIVITY))
    renderPage()
    await screen.findByRole('region', { name: 'Selected day' })

    const links = screen.getAllByRole('link', { name: /^Calendar/ })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('says when nothing has happened yet', async () => {
    stubFetch(async () => json(EMPTY))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Nothing on your calendar yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to your library' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('says when it can’t load, and tries again', async () => {
    stubFetch(async () => json({ status: 500 }, 500), async () => json(ACTIVITY))
    renderPage()

    expect(await screen.findByRole('heading', { name: "Couldn't load your calendar" })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('region', { name: 'Selected day' })).toBeTruthy()
  })
})
