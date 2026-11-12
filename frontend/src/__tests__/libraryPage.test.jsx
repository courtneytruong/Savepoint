import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { Link as RouterLink, MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
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

// Newest first, as the API sends them.
const ITEMS = [
  item({ medium: 'Game', title: 'Hades', creator: 'Supergiant Games', status: 'InProgress', createdAt: '2026-11-10T12:00:00+00:00' }),
  item({ title: 'Piranesi', createdAt: '2026-11-09T12:00:00+00:00' }),
  item({ title: 'Tetris', medium: 'Game', creator: null, status: 'Finished', createdAt: '2026-11-08T12:00:00+00:00' }),
]

const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const neverAnswers = () => new Promise(() => {})

function stubItems(...answers) {
  const fetchStub = vi.fn()
  for (const answer of answers) fetchStub.mockImplementationOnce(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

// Where the page has navigated to, as the router sees it. Kept in an effect,
// since changing something outside a component while rendering is a side effect.
const seen = { location: null }
function LocationProbe() {
  const location = useLocation()
  useEffect(() => {
    seen.location = location
  })
  return null
}

function renderPage(path = '/') {
  return render(
    // With the router's links, as in the app, so the sidebar's shortcuts work.
    <MemoryRouter initialEntries={[path]}>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <LibraryPage account={ACCOUNT} onSignedOut={vi.fn()} />
          <LocationProbe />
        </ToastProvider>
      </LinkProvider>
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

  it("links each title in the list to the item's page, which opens on a click", async () => {
    stubItems(async () => json(ITEMS))
    renderPage()
    await vi.waitFor(() => expect(screen.getByText('Hades')).toBeTruthy())

    const link = screen.getByRole('link', { name: 'Hades' })
    expect(link.getAttribute('href')).toBe(`/items/${ITEMS[0].id}`)
    fireEvent.click(link)
    expect(seen.location.pathname).toBe(`/items/${ITEMS[0].id}`)
  })

  it("links each card in the grid to the item's page", async () => {
    window.localStorage.setItem('savepoint.library.view', 'grid')
    stubItems(async () => json(ITEMS))
    renderPage()
    await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'Tetris' })).toBeTruthy())

    const card = screen.getByRole('heading', { name: 'Tetris' })
    expect(within(card).getByRole('link').getAttribute('href')).toBe(`/items/${ITEMS[2].id}`)
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

    // Each card's title is a level 3 heading.
    await vi.waitFor(() => expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(ITEMS.length))
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

  describe('finding things', () => {
    // The titles shown, in order: the list view's first cell in each row.
    const titles = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].firstChild.textContent)

    async function loaded(items = ITEMS, path = '/') {
      stubItems(async () => json(items))
      renderPage(path)
      // The sidebar's count, since a filter in the address may hide some items.
      await vi.waitFor(() => expect(sidebarLink(items.length)).toBeTruthy())
    }

    const search = (text) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } })

    it('shows the most recently added first', async () => {
      await loaded()
      expect(titles()).toEqual(['Hades', 'Piranesi', 'Tetris'])
    })

    it('searches titles and creators, ignoring case', async () => {
      await loaded()
      search('susanna')
      expect(titles()).toEqual(['Piranesi'])
      search('TET')
      expect(titles()).toEqual(['Tetris'])
    })

    it('filters by type, keeping it in the address', async () => {
      await loaded()
      fireEvent.click(screen.getByRole('button', { name: 'Games' }))

      expect(titles()).toEqual(['Hades', 'Tetris'])
      expect(seen.location.search).toBe('?medium=Game')
      expect(screen.getByRole('button', { name: 'Games' }).getAttribute('aria-pressed')).toBe('true')
    })

    it('filters by status alongside the type', async () => {
      await loaded()
      fireEvent.click(screen.getByRole('button', { name: 'Games' }))
      fireEvent.click(screen.getByRole('button', { name: 'Finished' }))

      expect(titles()).toEqual(['Tetris'])
      expect(seen.location.search).toBe('?medium=Game&status=Finished')
    })

    it('starts filtered when the address says so, and marks the sidebar shortcut', async () => {
      await loaded(ITEMS, '/?medium=Book')
      expect(titles()).toEqual(['Piranesi'])
      expect(screen.getByRole('link', { name: /^Books/ }).getAttribute('aria-current')).toBe('page')
      expect(screen.getByRole('link', { name: /^Library/, current: false })).toBeTruthy()
    })

    it('filters by type from the sidebar, with counts for each', async () => {
      await loaded()
      expect(screen.getByRole('link', { name: /^Books\s*,\s*1$/ })).toBeTruthy()
      fireEvent.click(screen.getByRole('link', { name: /^Games\s*,\s*2$/ }))
      expect(titles()).toEqual(['Hades', 'Tetris'])
    })

    it('ignores a filter in the address that isn’t one of the choices', async () => {
      await loaded(ITEMS, '/?medium=Film&status=Paused')
      expect(titles()).toEqual(['Hades', 'Piranesi', 'Tetris'])
    })

    it('says when nothing matches, and clears the search and filters', async () => {
      await loaded(ITEMS, '/?medium=Book')
      search('zelda')
      expect(screen.getByText('Nothing matches “zelda”')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))

      expect(titles()).toEqual(['Hades', 'Piranesi', 'Tetris'])
      expect(seen.location.search).toBe('')
      expect(screen.getByRole('searchbox').value).toBe('')
    })

    it('sorts by a column header in the list view', async () => {
      await loaded()
      fireEvent.click(screen.getByRole('button', { name: /Title/ }))
      expect(titles()).toEqual(['Hades', 'Piranesi', 'Tetris'])
      fireEvent.click(screen.getByRole('button', { name: /Title/ }))
      expect(titles()).toEqual(['Tetris', 'Piranesi', 'Hades'])
    })

    it('sorts from a menu in the grid view, which has no headers', async () => {
      window.localStorage.setItem('savepoint.library.view', 'grid')
      await loaded()
      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'createdAt:ascending' } })
      const cardTitles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
      expect(cardTitles).toEqual(['Tetris', 'Piranesi', 'Hades'])
    })

    describe('pages', () => {
      // 13 books, one more than a page, newest first.
      const MANY = Array.from({ length: 13 }, (_, index) =>
        item({ title: `Book ${index + 1}`, createdAt: new Date(Date.UTC(2026, 10, 30 - index)).toISOString() }),
      )

      it('shows 12 at a time, with the rest on the next page', async () => {
        await loaded(MANY)
        expect(titles()).toHaveLength(12)

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

        expect(titles()).toEqual(['Book 13'])
      })

      it('goes back to the first page when what’s shown changes', async () => {
        await loaded(MANY)
        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

        search('Book')

        expect(titles()).toHaveLength(12)
        expect(titles()[0]).toBe('Book 1')
      })
    })
  })

  describe('adding an item', () => {
    const NEW = item({ medium: 'Game', title: 'Outer Wilds', creator: 'Mobius Digital', createdAt: '2026-11-11T12:00:00+00:00' })

    // The library loads with items, and adding answers with saved.
    function stubLibrary(items, saved = async () => json(NEW, 201)) {
      const fetchStub = vi.fn(async (path, options = {}) => (options.method === 'POST' ? saved() : json(items)))
      vi.stubGlobal('fetch', fetchStub)
      return fetchStub
    }

    it('adds it at the top of the list, closes the form, and says so', async () => {
      const fetchStub = stubLibrary(ITEMS)
      renderPage()
      await vi.waitFor(() => expect(sidebarLink(3)).toBeTruthy())

      fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
      expect(document.querySelector('dialog').open).toBe(true)
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Outer Wilds' } })
      await act(async () => fireEvent.click(within(document.querySelector('dialog')).getByRole('button', { name: 'Add item' })))

      expect(document.querySelector('dialog').open).toBe(false)
      expect(screen.getAllByRole('row')[1].textContent).toMatch('Outer Wilds')
      expect(sidebarLink(4)).toBeTruthy()
      expect(screen.getByText('Outer Wilds added to your library')).toBeTruthy()
      // Added as it is, without loading the whole library again.
      expect(fetchStub.mock.calls.filter(([, options = {}]) => options.method !== 'POST')).toHaveLength(1)
    })

    it('offers adding the first item when the library is empty', async () => {
      stubLibrary([])
      renderPage()
      await vi.waitFor(() => expect(screen.getByText('Your library is empty')).toBeTruthy())

      fireEvent.click(screen.getByRole('button', { name: 'Add your first item' }))
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Outer Wilds' } })
      await act(async () => fireEvent.click(within(document.querySelector('dialog')).getByRole('button', { name: 'Add item' })))

      expect(screen.queryByText('Your library is empty')).toBeNull()
      expect(screen.getByText('Outer Wilds')).toBeTruthy()
    })

    it('keeps the form open, with what was typed, when saving fails', async () => {
      stubLibrary(ITEMS, async () => json({ status: 500 }, 500))
      renderPage()
      await vi.waitFor(() => expect(sidebarLink(3)).toBeTruthy())

      fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Outer Wilds' } })
      await act(async () => fireEvent.click(within(document.querySelector('dialog')).getByRole('button', { name: 'Add item' })))

      expect(document.querySelector('dialog').open).toBe(true)
      expect(screen.getByText("Couldn't add it")).toBeTruthy()
      expect(screen.getByLabelText('Title').value).toBe('Outer Wilds')
      expect(sidebarLink(3)).toBeTruthy()
    })
  })
})

