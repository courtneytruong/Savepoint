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
})
