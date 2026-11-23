import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link as RouterLink, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
import { ReflectionsPage } from '../pages/ReflectionsPage.jsx'

const ACCOUNT = { id: 'a1', displayName: 'Courtney', email: 'reader@example.com' }

const BOOK = { id: 'b1', title: 'Piranesi', medium: 'Book' }
const GAME = { id: 'g1', title: 'Outer Wilds', medium: 'Game' }

// As the API sends them: newest written first, times in the reader's own zone.
const REFLECTIONS = [
  {
    id: 'r3',
    mood: 'Moved',
    notes: 'Nothing else has made me feel this small.',
    createdAt: '2026-11-15T12:00:00',
    updatedAt: '2026-11-15T12:00:00',
    tags: ['awe', 'Space'],
    item: GAME,
    session: null,
  },
  {
    id: 'r2',
    mood: 'Curious',
    notes: 'The quantum moon keeps slipping away.',
    createdAt: '2026-11-14T20:00:00',
    updatedAt: '2026-11-14T20:00:00',
    tags: ['Space'],
    item: GAME,
    session: { id: 's2', date: '2026-11-14', durationMinutes: 90, pagesRead: null, createdAt: '2026-11-14T20:00:00', updatedAt: '2026-11-14T20:00:00' },
  },
  {
    id: 'r1',
    mood: 'Curious',
    notes: 'The house has its own tides.',
    createdAt: '2026-11-12T20:00:00',
    updatedAt: '2026-11-12T20:00:00',
    tags: ['house'],
    item: BOOK,
    session: { id: 's1', date: '2026-11-12', durationMinutes: 45, pagesRead: 30, createdAt: '2026-11-12T20:00:00', updatedAt: '2026-11-12T20:00:00' },
  },
]

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
    <MemoryRouter initialEntries={['/reflections']}>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <Routes>
            <Route path="/reflections" element={<ReflectionsPage account={ACCOUNT} onSignedOut={vi.fn()} />} />
            <Route path="/items/:id" element={<p>An item’s page</p>} />
          </Routes>
        </ToastProvider>
      </LinkProvider>
    </MemoryRouter>,
  )
}

const list = () => screen.getByRole('list', { name: 'Reflections' })
// Each card's notes, found by text, since a card has other paragraphs too.
const NOTES = REFLECTIONS.map((reflection) => reflection.notes)
const cardNotes = () =>
  within(list())
    .getAllByRole('article')
    .map((card) => NOTES.find((notes) => card.textContent.includes(notes)))
const pressFilter = (group, name) =>
  fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name: new RegExp(`^${name}`) }))

describe('ReflectionsPage', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('asks the API for every reflection and says it is loading until they arrive', () => {
    const fetchStub = stubFetch(neverAnswers)
    renderPage()
    expect(fetchStub.mock.calls[0][0]).toBe('/api/reflections')
    expect(screen.getByRole('status', { name: 'Loading your reflections' })).toBeTruthy()
  })

  it('shows each reflection newest first, naming its book or game', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()

    expect(await screen.findAllByRole('heading', { level: 2, name: 'Outer Wilds' })).toHaveLength(2)
    expect(cardNotes()).toEqual([
      'Nothing else has made me feel this small.',
      'The quantum moon keeps slipping away.',
      'The house has its own tides.',
    ])
    const [standalone, , session] = within(list()).getAllByRole('article')
    expect(standalone.textContent).toMatch('Reflection')
    expect(standalone.textContent).toMatch('#awe')
    expect(session.textContent).toMatch('Read for 45m')
    expect(session.textContent).toMatch('30 pages')
  })

  it('links each card to its item’s page', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()

    const [, , bookCard] = await within(await screen.findByRole('list', { name: 'Reflections' })).findAllByRole('article')
    fireEvent.click(within(bookCard).getByRole('link', { name: 'Piranesi' }))

    expect(await screen.findByText('An item’s page')).toBeTruthy()
  })

  it('marks itself in the sidebar, with how many reflections there are', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()
    await screen.findByRole('list', { name: 'Reflections' })

    const link = screen.getByRole('link', { name: /^Reflections\s*,\s*3$/ })
    expect(link.getAttribute('aria-current')).toBe('page')
    // Both the header's Library link and the sidebar's.
    for (const library of screen.getAllByRole('link', { name: /^Library/ })) {
      expect(library.getAttribute('aria-current')).toBeNull()
    }
  })

  it('filters by type', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()
    await screen.findByRole('list', { name: 'Reflections' })

    pressFilter('Filter by type', 'Books')

    expect(cardNotes()).toEqual(['The house has its own tides.'])
  })

  it('filters by mood, counting each among what the other filters show', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()
    await screen.findByRole('list', { name: 'Reflections' })

    pressFilter('Filter by mood', 'Curious')
    expect(cardNotes()).toEqual(['The quantum moon keeps slipping away.', 'The house has its own tides.'])

    pressFilter('Filter by type', 'Games')
    expect(cardNotes()).toEqual(['The quantum moon keeps slipping away.'])
    const moods = screen.getByRole('group', { name: 'Filter by mood' })
    expect(within(moods).getByRole('button', { name: /^Moved/ }).textContent).toMatch('1')
  })

  it('filters by tag, from the tags its reflections have', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()
    await screen.findByRole('list', { name: 'Reflections' })

    const tag = screen.getByRole('combobox', { name: 'Tag' })
    fireEvent.change(tag, { target: { value: 'spa' } })
    fireEvent.keyDown(tag, { key: 'Enter' })

    expect(cardNotes()).toEqual(['Nothing else has made me feel this small.', 'The quantum moon keeps slipping away.'])
  })

  it('says when nothing matches, and clears the filters', async () => {
    stubFetch(async () => json(REFLECTIONS))
    renderPage()
    await screen.findByRole('list', { name: 'Reflections' })

    pressFilter('Filter by type', 'Books')
    pressFilter('Filter by mood', 'Moved')
    expect(screen.getByRole('heading', { name: 'No reflections match those filters' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(cardNotes()).toHaveLength(3)
  })

  it('says when there are none yet, without filters', async () => {
    stubFetch(async () => json([]))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No reflections yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to your library' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Filter by mood' })).toBeNull()
  })

  it('says when they can’t load, and tries again', async () => {
    stubFetch(async () => json({ status: 500 }, 500), async () => json(REFLECTIONS))
    renderPage()

    expect(await screen.findByRole('heading', { name: "Couldn't load your reflections" })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('list', { name: 'Reflections' })).toBeTruthy()
  })
})
