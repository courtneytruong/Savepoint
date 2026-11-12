import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/index.js'
import { LibraryPage } from '../pages/LibraryPage.jsx'

const ACCOUNT = { id: 'a1', displayName: 'Courtney', email: 'reader@example.com' }

const item = (overrides) => ({
  id: crypto.randomUUID(),
  medium: 'Book',
  title: 'Piranesi',
  creator: 'Susanna Clarke',
  status: 'Backlog',
  statusChangedAt: '2026-11-10T12:00:00+00:00',
  createdAt: '2026-11-10T12:00:00+00:00',
  ...overrides,
})

const ITEMS = [
  item({ medium: 'Game', title: 'Hades', creator: 'Supergiant Games', status: 'InProgress' }),
  item({ title: 'Piranesi' }),
  item({ title: 'Tetris', medium: 'Game', creator: null, status: 'Finished' }),
]

const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const neverAnswers = () => new Promise(() => {})

function stubItems(...answers) {
  const fetchStub = vi.fn()
  for (const answer of answers) fetchStub.mockImplementationOnce(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <LibraryPage account={ACCOUNT} onSignedOut={vi.fn()} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

// The sidebar's Library link reads its count after a comma, as "Library, 3".
const sidebarLink = (count) => screen.getByRole('link', { name: new RegExp(`^Library\\s*,\\s*${count}$`) })

describe('LibraryPage', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('asks the API for the library', () => {
    const fetchStub = stubItems(neverAnswers)
    renderPage()
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items')
  })

  it('shows placeholder rows while loading', () => {
    stubItems(neverAnswers)
    renderPage()
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true')
  })

  it('lists every item with its creator, type and status', async () => {
    stubItems(async () => json(ITEMS))
    renderPage()

    // The text, not the number of rows: the placeholder rows while loading count too.
    await vi.waitFor(() => expect(screen.getByText('Hades')).toBeTruthy())
    expect(screen.getAllByRole('row')).toHaveLength(ITEMS.length + 1)
    const hades = within(screen.getAllByRole('row')[1])
    expect(hades.getByText('Hades')).toBeTruthy()
    expect(hades.getByText('Supergiant Games')).toBeTruthy()
    expect(hades.getByText('Game')).toBeTruthy()
    expect(hades.getByText('In progress')).toBeTruthy()
  })

  it('shows how many items there are in the sidebar once loaded', async () => {
    stubItems(async () => json(ITEMS))
    renderPage()
    await vi.waitFor(() => expect(sidebarLink(3)).toBeTruthy())
  })

  it('shows cards in the grid view, the choice remembered from last time', async () => {
    window.localStorage.setItem('savepoint.library.view', 'grid')
    stubItems(async () => json(ITEMS))
    renderPage()

    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(ITEMS.length + 1))
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Tetris' })).toBeTruthy()
  })

  it('switches between the list and grid views', async () => {
    stubItems(async () => json(ITEMS))
    renderPage()
    await vi.waitFor(() => expect(screen.getByText('Hades')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }))

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Hades' })).toBeTruthy()
  })

  it('says when the library is empty', async () => {
    stubItems(async () => json([]))
    renderPage()
    await vi.waitFor(() => expect(screen.getByText('Your library is empty')).toBeTruthy())
    expect(screen.queryByRole('table')).toBeNull()
    expect(sidebarLink(0)).toBeTruthy()
  })

  it.each([
    ['a server error', async () => json({ status: 500 }, 500)],
    [
      'no answer',
      async () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('says it couldn’t load after %s, and loads again on Try again', async (_, failure) => {
    const fetchStub = stubItems(failure, async () => json(ITEMS))
    renderPage()
    await vi.waitFor(() => expect(screen.getByText("Couldn't load your library")).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await vi.waitFor(() => expect(screen.getByText('Hades')).toBeTruthy())
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('cancels the request when the page goes away', () => {
    const fetchStub = stubItems(neverAnswers)
    const { unmount } = renderPage()
    const { signal } = fetchStub.mock.calls[0][1]
    unmount()
    expect(signal.aborted).toBe(true)
  })
})
