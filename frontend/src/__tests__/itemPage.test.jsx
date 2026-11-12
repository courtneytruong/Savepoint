import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link as RouterLink } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
import { ItemPage } from '../pages/ItemPage.jsx'
import { ITEM_PATH } from '../paths.js'

const ACCOUNT = { id: 'a1', displayName: 'Courtney', email: 'reader@example.com' }

const ITEM = {
  id: 'abc',
  medium: 'Game',
  title: 'Outer Wilds',
  creator: 'Mobius Digital',
  status: 'InProgress',
  statusChangedAt: '2026-11-11T12:00:00+00:00',
  createdAt: '2026-11-01T12:00:00+00:00',
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
const neverAnswers = () => new Promise(() => {})

function stubFetch(...answers) {
  const fetchStub = vi.fn()
  for (const answer of answers) fetchStub.mockImplementationOnce(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function renderPage(path = '/items/abc') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <Routes>
            <Route path={ITEM_PATH} element={<ItemPage account={ACCOUNT} onSignedOut={vi.fn()} />} />
            <Route path="/" element={<p>The library</p>} />
          </Routes>
        </ToastProvider>
      </LinkProvider>
    </MemoryRouter>,
  )
}

describe('ItemPage', () => {
  afterEach(cleanup)

  it('asks the API for the item in the address', () => {
    const fetchStub = stubFetch(neverAnswers)
    renderPage('/items/abc')
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc')
  })

  it('says it is loading until the item arrives', () => {
    stubFetch(neverAnswers)
    renderPage()
    expect(screen.getByRole('status', { name: 'Loading this item' })).toBeTruthy()
  })

  it('shows the item', async () => {
    stubFetch(async () => json(ITEM))
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Outer Wilds' })).toBeTruthy()
    const details = screen.getByRole('article')
    expect(within(details).getByText('Mobius Digital')).toBeTruthy()
    expect(within(details).getByText('Game')).toBeTruthy()
    expect(within(details).getByText('In progress')).toBeTruthy()
    expect(details.querySelector('time[datetime="2026-11-01T12:00:00+00:00"]')).toBeTruthy()
    expect(details.querySelector('time[datetime="2026-11-11T12:00:00+00:00"]')).toBeTruthy()
  })

  it('leaves out a missing creator', async () => {
    stubFetch(async () => json({ ...ITEM, creator: null }))
    renderPage()
    await screen.findByRole('heading', { level: 2, name: 'Outer Wilds' })
    expect(screen.queryByText('Mobius Digital')).toBeNull()
  })

  it('links back to the library', async () => {
    stubFetch(async () => json(ITEM))
    renderPage()
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'Library' }).getAttribute('href')).toBe('/')
  })

  it('says when the item is not in this library', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    renderPage()

    expect(await screen.findByRole('heading', { name: "This item isn't in your library" })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to your library' }).getAttribute('href')).toBe('/')
  })

  it('says when loading failed, and tries again', async () => {
    stubFetch(
      async () => new Response(null, { status: 500 }),
      async () => json(ITEM),
    )
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('status', { name: 'Loading this item' })).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 2, name: 'Outer Wilds' })).toBeTruthy()
  })

  describe('changing the status', () => {
    const statuses = () => screen.getByRole('group', { name: 'Status' })
    const pill = (name) => within(statuses()).getByRole('button', { name })

    async function loaded(...answers) {
      const fetchStub = stubFetch(async () => json(ITEM), ...answers)
      renderPage()
      await screen.findByRole('heading', { level: 2, name: 'Outer Wilds' })
      return fetchStub
    }

    it('shows the current status as the pressed one', async () => {
      await loaded()
      expect(pill('In progress').getAttribute('aria-pressed')).toBe('true')
      expect(pill('Finished').getAttribute('aria-pressed')).toBe('false')
    })

    it('saves the new status and shows it', async () => {
      const changedAt = '2026-11-12T09:00:00+00:00'
      const fetchStub = await loaded(async () => json({ ...ITEM, status: 'Finished', statusChangedAt: changedAt }))

      fireEvent.click(pill('Finished'))

      const [url, options] = fetchStub.mock.calls[1]
      expect(url).toBe('/api/items/abc/status')
      expect(JSON.parse(options.body)).toEqual({ status: 'Finished' })
      expect(await screen.findByText('Outer Wilds moved to Finished')).toBeTruthy()
      expect(pill('Finished').getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('article').querySelector(`time[datetime="${changedAt}"]`)).toBeTruthy()
    })

    it('says which status it is moving to while it saves, and ignores other presses', async () => {
      const fetchStub = await loaded(neverAnswers)

      fireEvent.click(pill('Finished'))
      expect(pill('Moving to Finished…')).toBeTruthy()
      expect(statuses().getAttribute('aria-busy')).toBe('true')

      fireEvent.click(pill('Dropped'))
      expect(fetchStub).toHaveBeenCalledTimes(2)
    })

    it('sends nothing for the status it already has', async () => {
      const fetchStub = await loaded()
      fireEvent.click(pill('In progress'))
      expect(fetchStub).toHaveBeenCalledTimes(1)
    })

    it('keeps the old status when saving fails, and offers to try again', async () => {
      const fetchStub = await loaded(
        async () => new Response(null, { status: 500 }),
        async () => json({ ...ITEM, status: 'Finished' }),
      )

      fireEvent.click(pill('Finished'))
      await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toMatch("Couldn't change the status"))
      expect(pill('In progress').getAttribute('aria-pressed')).toBe('true')

      fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Outer Wilds moved to Finished')).toBeTruthy()
      expect(JSON.parse(fetchStub.mock.calls[2][1].body)).toEqual({ status: 'Finished' })
    })

    it('counts a server that cannot be reached as failing', async () => {
      await loaded(async () => {
        throw new TypeError('Failed to fetch')
      })
      fireEvent.click(pill('Finished'))
      await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toMatch("Couldn't change the status"))
    })

    it('says the item is gone if it was deleted meanwhile', async () => {
      await loaded(async () => new Response(null, { status: 404 }))
      fireEvent.click(pill('Finished'))
      expect(await screen.findByRole('heading', { name: "This item isn't in your library" })).toBeTruthy()
    })
  })

  describe('editing the details', () => {
    async function loaded(...answers) {
      const fetchStub = stubFetch(async () => json(ITEM), ...answers)
      renderPage()
      await screen.findByRole('heading', { level: 2, name: 'Outer Wilds' })
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      return fetchStub
    }

    const dialog = () => screen.getByRole('dialog', { name: 'Edit details' })
    const save = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

    it('opens the form with the item as it is', async () => {
      await loaded()
      expect(within(dialog()).getByLabelText('Title').value).toBe('Outer Wilds')
    })

    it('saves the changes and shows them', async () => {
      const fetchStub = await loaded(async () => json({ ...ITEM, title: 'Outer Wilds: Echoes of the Eye' }))
      fireEvent.change(within(dialog()).getByLabelText('Title'), { target: { value: 'Outer Wilds: Echoes of the Eye' } })
      save()

      expect(await screen.findByText('Changes saved')).toBeTruthy()
      const [url, options] = fetchStub.mock.calls[1]
      expect(url).toBe('/api/items/abc')
      expect(JSON.parse(options.body)).toEqual({
        medium: 'Game',
        title: 'Outer Wilds: Echoes of the Eye',
        creator: 'Mobius Digital',
      })
      expect(screen.getByRole('heading', { level: 2, name: 'Outer Wilds: Echoes of the Eye' })).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('keeps the form open when saving fails', async () => {
      await loaded(async () => new Response(null, { status: 500 }))
      save()
      await vi.waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toMatch("Couldn't save your changes"))
    })

    it('says the item is gone if it was deleted meanwhile', async () => {
      await loaded(async () => new Response(null, { status: 404 }))
      save()
      expect(await screen.findByRole('heading', { name: "This item isn't in your library" })).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('deleting it', () => {
    async function loaded(...answers) {
      const fetchStub = stubFetch(async () => json(ITEM), ...answers)
      renderPage()
      await screen.findByRole('heading', { level: 2, name: 'Outer Wilds' })
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      return fetchStub
    }

    const dialog = () => screen.getByRole('dialog', { name: 'Delete Outer Wilds?' })
    const confirm = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    it('asks first, and keeping it sends nothing', async () => {
      const fetchStub = await loaded()
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Keep it' }))

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(fetchStub).toHaveBeenCalledTimes(1)
    })

    it('deletes it and goes back to the library', async () => {
      const fetchStub = await loaded(async () => new Response(null, { status: 204 }))
      confirm()

      expect(await screen.findByText('The library')).toBeTruthy()
      expect(screen.getByText('Outer Wilds deleted')).toBeTruthy()
      const [url, options] = fetchStub.mock.calls[1]
      expect(url).toBe('/api/items/abc')
      expect(options.method).toBe('DELETE')
    })

    it('stays and says so when deleting fails', async () => {
      await loaded(async () => new Response(null, { status: 500 }))
      confirm()

      await vi.waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toMatch("Couldn't delete it"))
      expect(screen.getByRole('heading', { level: 2, name: 'Outer Wilds' })).toBeTruthy()
    })
  })
})
