import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link as RouterLink } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkProvider, ToastProvider } from '../components/index.js'
import { ItemPage } from '../pages/ItemPage.jsx'
import { ITEM_PATH } from '../paths.js'
import { toDateKey } from '../utils/calendarDates.js'

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

// The page loads an item's sessions by itself once the item arrives. That request
// gets its own answer, no sessions unless a test says otherwise, so the answers
// given here, and the calls the returned stub records, are only the item's.
let sessionsAnswer
const stubSessions = (answer) => {
  sessionsAnswer = answer
}
const isSessionList = (url, options) => url.endsWith('/sessions') && !options?.method

function stubFetch(...answers) {
  const fetchStub = vi.fn()
  for (const answer of answers) fetchStub.mockImplementationOnce(answer)
  const sessionsStub = vi.fn((url, options) => (sessionsAnswer ?? (async () => json([])))(url, options))
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => (isSessionList(url, options) ? sessionsStub(url, options) : fetchStub(url, options))),
  )
  fetchStub.sessions = sessionsStub
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
  afterEach(() => {
    cleanup()
    sessionsAnswer = undefined
  })

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

    expect(await screen.findByRole('heading', { level: 1, name: 'Outer Wilds' })).toBeTruthy()
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
    await screen.findByRole('heading', { level: 1, name: 'Outer Wilds' })
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
    expect(await screen.findByRole('heading', { level: 1, name: 'Outer Wilds' })).toBeTruthy()
  })

  describe('changing the status', () => {
    const statuses = () => screen.getByRole('group', { name: 'Status' })
    const pill = (name) => within(statuses()).getByRole('button', { name })

    async function loaded(...answers) {
      const fetchStub = stubFetch(async () => json(ITEM), ...answers)
      renderPage()
      await screen.findByRole('heading', { level: 1, name: 'Outer Wilds' })
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
      await screen.findByRole('heading', { level: 1, name: 'Outer Wilds' })
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
      expect(screen.getByRole('heading', { level: 1, name: 'Outer Wilds: Echoes of the Eye' })).toBeTruthy()
      // The toast can show a moment before the dialog finishes closing.
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
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
      await screen.findByRole('heading', { level: 1, name: 'Outer Wilds' })
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
      expect(screen.getByRole('heading', { level: 1, name: 'Outer Wilds' })).toBeTruthy()
    })
  })

  describe('logging a session', () => {
    const SESSION = {
      id: 's1',
      itemId: 'abc',
      date: '2026-11-14',
      durationMinutes: 90,
      pagesRead: null,
      createdAt: '2026-11-14T20:00:00+00:00',
      reflection: {
        id: 'r1',
        mood: 'Hooked',
        notes: 'Couldn’t stop after the first loop.',
        createdAt: '2026-11-14T20:00:00+00:00',
        updatedAt: '2026-11-14T20:00:00+00:00',
      },
    }

    async function opened(item = ITEM, ...answers) {
      const fetchStub = stubFetch(async () => json(item), ...answers)
      renderPage()
      await screen.findByRole('heading', { level: 1, name: item.title })
      fireEvent.click(screen.getByRole('button', { name: 'Log session' }))
      return fetchStub
    }

    const dialog = () => screen.getByRole('dialog', { name: 'Log a session' })
    const set = (label, value) => fireEvent.change(within(dialog()).getByLabelText(label), { target: { value } })
    const submit = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Log session' }))

    function fillIn() {
      set('Hours', '1')
      set('Minutes', '30')
      fireEvent.click(within(dialog()).getByRole('radio', { name: 'Hooked' }))
      set('Notes', '  Couldn’t stop after the first loop.  ')
    }

    it('opens for this item, with no item picker and no tags', async () => {
      await opened()
      expect(within(dialog()).getByText('Outer Wilds: how long, and what you thought.')).toBeTruthy()
      expect(within(dialog()).queryByRole('combobox', { name: 'Book or game' })).toBeNull()
      expect(within(dialog()).queryByLabelText('Tags')).toBeNull()
      expect(within(dialog()).getByLabelText('Date').value).toBe(toDateKey(new Date()))
    })

    it('asks for pages only for a book', async () => {
      await opened()
      expect(within(dialog()).queryByLabelText('Pages read')).toBeNull()
      cleanup()

      await opened({ ...ITEM, medium: 'Book', title: 'Piranesi' })
      expect(within(dialog()).getByLabelText('Pages read')).toBeTruthy()
    })

    it('logs it for this item, then closes and says so', async () => {
      const fetchStub = await opened(ITEM, async () => json(SESSION, 201))
      fillIn()
      submit()

      expect(await screen.findByText('Session logged')).toBeTruthy()
      const [url, options] = fetchStub.mock.calls[1]
      expect(url).toBe('/api/items/abc/sessions')
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({
        date: toDateKey(new Date()),
        durationMinutes: 90,
        pagesRead: null,
        reflection: { mood: 'Hooked', notes: 'Couldn’t stop after the first loop.' },
      })
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('sends nothing until the form is valid', async () => {
      const fetchStub = await opened()
      submit()

      expect(within(dialog()).getByText('Choose the mood that fits best.')).toBeTruthy()
      expect(fetchStub).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['the server fails', async () => json({ status: 500 }, 500)],
      [
        'the server can’t be reached',
        async () => {
          throw new TypeError('Failed to fetch')
        },
      ],
    ])('stays open with what was written when %s, so it can be sent again', async (_, answer) => {
      await opened(ITEM, answer)
      fillIn()
      submit()

      await vi.waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toMatch("Couldn't log the session"))
      expect(within(dialog()).getByLabelText('Notes').value).toBe('  Couldn’t stop after the first loop.  ')
      expect(within(dialog()).getByRole('button', { name: 'Log session' }).disabled).toBe(false)
    })

    it('shows the item as not found when it was deleted meanwhile', async () => {
      await opened(ITEM, async () => new Response(null, { status: 404 }))
      fillIn()
      submit()

      expect(await screen.findByRole('heading', { name: "This item isn't in your library" })).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('closes only from Cancel, so a half-written reflection isn’t lost by accident', async () => {
      await opened()
      set('Notes', 'Half a thought about the')

      fireEvent(dialog(), new Event('cancel', { cancelable: true }))
      expect(within(dialog()).getByLabelText('Notes').value).toBe('Half a thought about the')

      fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('starts empty each time it opens', async () => {
      await opened()
      set('Notes', 'Something from before')
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

      fireEvent.click(screen.getByRole('button', { name: 'Log session' }))
      expect(within(dialog()).getByLabelText('Notes').value).toBe('')
    })
  })

  describe('its sessions', () => {
    // A session as the API gives it, logged on the day it happened unless told otherwise.
    const session = (id, date, notes, { loggedAt = `${date}T20:00:00`, pagesRead = null, mood = 'Curious' } = {}) => ({
      id,
      itemId: 'abc',
      date,
      durationMinutes: 90,
      pagesRead,
      createdAt: loggedAt,
      reflection: { id: `r-${id}`, mood, notes, createdAt: loggedAt, updatedAt: loggedAt },
    })

    const region = () => screen.getByRole('region', { name: 'Sessions' })

    async function loaded(sessions, item = ITEM) {
      stubSessions(async () => json(sessions))
      const fetchStub = stubFetch(async () => json(item))
      renderPage()
      await screen.findByRole('heading', { level: 1, name: item.title })
      return fetchStub
    }

    it('asks for this item’s sessions once the item has loaded', async () => {
      const fetchStub = await loaded([])
      expect(fetchStub.sessions.mock.calls[0][0]).toBe('/api/items/abc/sessions')
    })

    it('says it is loading the sessions until they arrive', async () => {
      stubSessions(neverAnswers)
      stubFetch(async () => json(ITEM))
      renderPage()
      expect(await screen.findByRole('status', { name: 'Loading sessions' })).toBeTruthy()
    })

    it('says when there are none yet', async () => {
      await loaded([])
      expect(await within(region()).findByText('No sessions yet. Each one you log shows here, with its reflection.')).toBeTruthy()
    })

    it('shows each session with its reflection, newest day first', async () => {
      await loaded([
        session('s2', '2026-11-14', 'The quantum moon finally made sense.', { mood: 'Moved' }),
        session('s1', '2026-11-12', 'Burned to death by the sun, twice.', { mood: 'Frustrated' }),
      ])

      const cards = await within(region()).findAllByRole('article')
      expect(cards).toHaveLength(2)
      expect(cards[0].textContent).toMatch('The quantum moon finally made sense.')
      expect(cards[0].textContent).toMatch('Played for 1h 30m')
      expect(cards[0].textContent).toMatch('Moved')
      expect(cards[0].querySelector('time').getAttribute('dateTime')).toBe('2026-11-14')
      expect(cards[1].textContent).toMatch('Burned to death by the sun, twice.')
    })

    it('shows a book’s pages', async () => {
      await loaded([session('s1', '2026-11-12', 'The house has its own tides.', { pagesRead: 40 })], {
        ...ITEM,
        medium: 'Book',
        title: 'Piranesi',
      })
      expect((await within(region()).findByRole('article')).textContent).toMatch('Read for 1h 30m · 40 pages')
    })

    it('says when a session was logged on a later day than it happened', async () => {
      await loaded([
        session('s2', '2026-11-14', 'Logged the same evening, as it happened.'),
        session('s1', '2026-11-10', 'Caught up on this one days afterwards.', { loggedAt: '2026-11-13T09:00:00' }),
      ])
      const cards = await within(region()).findAllByRole('article')
      expect(cards[0].textContent).not.toMatch('Logged on')
      expect(cards[1].textContent).toMatch('Logged on')
    })

    it('offers to try again when they can’t be loaded', async () => {
      let tries = 0
      stubSessions(async () => (++tries === 1 ? json({ status: 500 }, 500) : json([session('s1', '2026-11-12', 'Second time lucky.')])))
      stubFetch(async () => json(ITEM))
      renderPage()

      const alert = await within(await screen.findByRole('region', { name: 'Sessions' })).findByRole('alert')
      expect(alert.textContent).toMatch("Couldn't load the sessions")
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

      expect(await within(region()).findByText('Second time lucky.')).toBeTruthy()
    })

    it('shows the item as not found when the sessions say it’s gone', async () => {
      stubSessions(async () => new Response(null, { status: 404 }))
      stubFetch(async () => json(ITEM))
      renderPage()
      expect(await screen.findByRole('heading', { name: "This item isn't in your library" })).toBeTruthy()
    })

    it('adds a newly logged session where it belongs by day, without reloading', async () => {
      const fetchStub = await loaded([
        session('s3', '2026-11-14', 'The newest of the ones already logged.'),
        session('s1', '2026-11-10', 'The oldest of the ones already logged.'),
      ])
      await within(region()).findAllByRole('article')
      fetchStub.mockImplementationOnce(async () => json(session('s2', '2026-11-12', 'Logged now, about two days ago.'), 201))

      fireEvent.click(screen.getByRole('button', { name: 'Log session' }))
      const dialog = screen.getByRole('dialog', { name: 'Log a session' })
      fireEvent.change(within(dialog).getByLabelText('Minutes'), { target: { value: '90' } })
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Curious' }))
      fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'Logged now, about two days ago.' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Log session' }))

      await screen.findByText('Session logged')
      const cards = within(region()).getAllByRole('article').map((card) => card.textContent)
      expect(cards).toHaveLength(3)
      expect(cards[0]).toMatch('The newest of the ones already logged.')
      expect(cards[1]).toMatch('Logged now, about two days ago.')
      expect(cards[2]).toMatch('The oldest of the ones already logged.')
      expect(fetchStub.sessions).toHaveBeenCalledTimes(1)
    })

    describe('editing one', () => {
      const day = (key) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${key}T00:00`))
      const editButton = (key) => screen.getByRole('button', { name: `Edit the session from ${day(key)}` })
      const dialog = () => screen.getByRole('dialog', { name: 'Edit session' })
      const set = (label, value) => fireEvent.change(within(dialog()).getByLabelText(label), { target: { value } })
      const save = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))

      const NEWER = session('s2', '2026-11-14', 'The quantum moon finally made sense.', { mood: 'Moved' })
      const OLDER = session('s1', '2026-11-12', 'Burned to death by the sun, twice.', { mood: 'Frustrated' })

      async function editing(target, ...answers) {
        const fetchStub = await loaded([NEWER, OLDER])
        await within(region()).findAllByRole('article')
        for (const answer of answers) fetchStub.mockImplementationOnce(answer)
        fireEvent.click(editButton(target.date))
        return fetchStub
      }

      it('gives each session its own Edit button, named by its day', async () => {
        await loaded([NEWER, OLDER])
        await within(region()).findAllByRole('article')
        expect(editButton('2026-11-14')).toBeTruthy()
        expect(editButton('2026-11-12')).toBeTruthy()
      })

      it('opens the form filled in with the session as it is', async () => {
        await editing(OLDER)
        expect(within(dialog()).getByText('Outer Wilds: change when, how long, or what you thought.')).toBeTruthy()
        expect(within(dialog()).getByLabelText('Date').value).toBe('2026-11-12')
        expect(within(dialog()).getByLabelText('Hours').value).toBe('1')
        expect(within(dialog()).getByLabelText('Minutes').value).toBe('30')
        expect(within(dialog()).getByRole('radio', { name: 'Frustrated' }).checked).toBe(true)
        expect(within(dialog()).getByLabelText('Notes').value).toBe('Burned to death by the sun, twice.')
        expect(within(dialog()).queryByLabelText('Tags')).toBeNull()
      })

      it('saves the changes and shows them, moving the session if its day changed', async () => {
        const edited = {
          ...OLDER,
          date: '2026-11-15',
          reflection: { ...OLDER.reflection, notes: 'Third try, and I finally escaped.' },
        }
        const fetchStub = await editing(OLDER, async () => json(edited))
        set('Date', '2026-11-15')
        set('Notes', 'Third try, and I finally escaped.')
        save()

        expect(await screen.findByText('Changes saved')).toBeTruthy()
        const [url, options] = fetchStub.mock.calls[1]
        expect(url).toBe('/api/items/abc/sessions/s1')
        expect(options.method).toBe('PUT')
        expect(JSON.parse(options.body)).toEqual({
          date: '2026-11-15',
          durationMinutes: 90,
          pagesRead: null,
          reflection: { mood: 'Frustrated', notes: 'Third try, and I finally escaped.' },
        })
        const cards = within(region()).getAllByRole('article').map((card) => card.textContent)
        expect(cards[0]).toMatch('Third try, and I finally escaped.')
        expect(cards[1]).toMatch('The quantum moon finally made sense.')
        await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      })

      it('stays open with the changes when saving fails', async () => {
        await editing(OLDER, async () => json({ status: 500 }, 500))
        set('Notes', 'A change that will not save yet.')
        save()

        await vi.waitFor(() =>
          expect(within(dialog()).getByRole('alert').textContent).toMatch("Couldn't save your changes"),
        )
        expect(within(dialog()).getByLabelText('Notes').value).toBe('A change that will not save yet.')
      })

      it('loads the sessions afresh when the session was deleted meanwhile', async () => {
        const fetchStub = await editing(OLDER, async () => new Response(null, { status: 404 }))
        stubSessions(async () => json([NEWER]))
        save()

        await vi.waitFor(() => expect(within(region()).getAllByRole('article')).toHaveLength(1))
        expect(fetchStub.sessions).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('dialog')).toBeNull()
      })
    })

    describe('deleting one', () => {
      const day = (key) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${key}T00:00`))
      const deleteButton = (key) => screen.getByRole('button', { name: `Delete the session from ${day(key)}` })
      const dialog = () => screen.getByRole('dialog', { name: 'Delete this session?' })
      const confirm = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

      const NEWER = session('s2', '2026-11-14', 'The quantum moon finally made sense.')
      const OLDER = session('s1', '2026-11-12', 'Burned to death by the sun, twice.')

      async function asking(target, ...answers) {
        const fetchStub = await loaded([NEWER, OLDER])
        await within(region()).findAllByRole('article')
        for (const answer of answers) fetchStub.mockImplementationOnce(answer)
        fireEvent.click(deleteButton(target.date))
        return fetchStub
      }

      it('asks first, naming the session, and keeping it sends nothing', async () => {
        const fetchStub = await asking(OLDER)
        expect(within(dialog()).getByText(`The session from ${day('2026-11-12')} and its reflection. This can't be undone.`)).toBeTruthy()

        fireEvent.click(within(dialog()).getByRole('button', { name: 'Keep it' }))

        expect(screen.queryByRole('dialog')).toBeNull()
        expect(fetchStub).toHaveBeenCalledTimes(1)
        expect(within(region()).getAllByRole('article')).toHaveLength(2)
      })

      it('deletes it, takes it off the list and says so', async () => {
        const fetchStub = await asking(OLDER, async () => new Response(null, { status: 204 }))
        confirm()

        expect(await screen.findByText('Session deleted')).toBeTruthy()
        const [url, options] = fetchStub.mock.calls[1]
        expect(url).toBe('/api/items/abc/sessions/s1')
        expect(options.method).toBe('DELETE')
        const cards = within(region()).getAllByRole('article')
        expect(cards).toHaveLength(1)
        expect(cards[0].textContent).toMatch('The quantum moon finally made sense.')
        await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      })

      it('says there are none left after deleting the last one', async () => {
        stubSessions(async () => json([OLDER]))
        const fetchStub = stubFetch(async () => json(ITEM), async () => new Response(null, { status: 204 }))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: `Delete the session from ${day('2026-11-12')}` }))
        confirm()

        expect(await within(region()).findByText('No sessions yet. Each one you log shows here, with its reflection.')).toBeTruthy()
        expect(fetchStub).toHaveBeenCalledTimes(2)
      })

      it('keeps it, and says so in the modal, when deleting fails', async () => {
        await asking(OLDER, async () => new Response(null, { status: 500 }))
        confirm()

        await vi.waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toMatch("Couldn't delete it"))
        expect(within(region()).getAllByRole('article')).toHaveLength(2)
      })
    })
  })
})
