import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { CREATE_ACCOUNT_PATH, SIGN_IN_PATH } from '../App.jsx'
import { ToastProvider } from '../components/index.js'

const ACCOUNT = { id: '6f1c2c1e-0000-4000-8000-000000000000', displayName: 'Courtney', email: 'reader@example.com' }

const json = (body, status) => new Response(JSON.stringify(body), { status })
const signedOut = async () => json({ status: 401 }, 401)
const neverAnswers = () => new Promise(() => {})

// Answers each path the way the API would: me says who's signed in, and auth
// answers registering or signing in.
function stubApi({ me = signedOut, auth = neverAnswers } = {}) {
  const fetchStub = vi.fn(async (path, options) => {
    if (path === '/health') return new Response('Healthy')
    if (path === '/api/auth/me') return me(options)
    return auth()
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const openAt = (path) => window.history.replaceState(null, '', path)
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const heading = () => screen.getByRole('heading', { level: 1 }).textContent

// Renders, then waits for the answer about who's signed in.
async function renderApp() {
  render(<App />, { wrapper: ToastProvider })
  await vi.waitFor(() => expect(screen.queryByText('Opening Savepoint')).toBeNull())
}

describe('App', () => {
  afterEach(() => {
    cleanup()
    openAt('/')
  })

  describe('on load', () => {
    it('shows a spinner while asking who’s signed in', () => {
      stubApi({ me: neverAnswers })
      render(<App />, { wrapper: ToastProvider })
      expect(screen.getByRole('status').textContent).toBe('Opening Savepoint')
      expect(screen.queryByRole('heading')).toBeNull()
    })

    it('opens the app when the cookie says who this is', async () => {
      stubApi({ me: async () => json(ACCOUNT, 200) })
      await renderApp()
      expect(heading()).toBe('Welcome, Courtney')
    })

    it('opens the app at home when signed in at an auth screen’s address', async () => {
      stubApi({ me: async () => json(ACCOUNT, 200) })
      openAt(SIGN_IN_PATH)
      await renderApp()
      expect(heading()).toBe('Welcome, Courtney')
      expect(window.location.pathname).toBe('/')
    })

    it('shows sign-in when no one is signed in', async () => {
      stubApi()
      await renderApp()
      expect(heading()).toBe('Welcome back')
    })

    it.each([
      ['a server error', async () => json({ status: 500 }, 500)],
      [
        'no answer',
        async () => {
          throw new TypeError('Failed to fetch')
        },
      ],
    ])('shows sign-in after %s', async (_, me) => {
      stubApi({ me })
      await renderApp()
      expect(heading()).toBe('Welcome back')
    })

    // StrictMode cancels the first request during development, and that must not
    // count as an answer.
    it('keeps waiting when the request is cancelled', async () => {
      stubApi({
        me: async () => {
          throw new DOMException('Aborted', 'AbortError')
        },
      })
      render(<App />, { wrapper: ToastProvider })
      await act(async () => {})
      expect(screen.getByRole('status').textContent).toBe('Opening Savepoint')
    })

    it('cancels the request when the page goes away', () => {
      const fetchStub = stubApi({ me: neverAnswers })
      const { unmount } = render(<App />, { wrapper: ToastProvider })
      const { signal } = fetchStub.mock.calls[0][1]
      unmount()
      expect(signal.aborted).toBe(true)
    })
  })

  it('shows sign-in at the home address while signed out', async () => {
    stubApi()
    await renderApp()
    expect(heading()).toBe('Welcome back')
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(CREATE_ACCOUNT_PATH)
  })

  it('shows creating an account at its own path', async () => {
    stubApi()
    openAt(CREATE_ACCOUNT_PATH)
    await renderApp()
    expect(heading()).toBe('Start your journal')
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(SIGN_IN_PATH)
  })

  it('opens the app at home once an account is created', async () => {
    const fetchStub = stubApi({ auth: async () => json(ACCOUNT, 201) })
    openAt(CREATE_ACCOUNT_PATH)
    await renderApp()

    type('Your name', 'Courtney')
    type('Email', 'reader@example.com')
    type('Password', 'tides and statues')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() => expect(heading()).toBe('Welcome, Courtney'))
    expect(fetchStub.mock.calls.map(([path]) => path)).toContain('/api/auth/register')
    expect(window.location.pathname).toBe('/')
    expect(screen.getByRole('button', { name: /Courtney/ })).toBeTruthy()
  })

  it('opens the app once signed in', async () => {
    const fetchStub = stubApi({ auth: async () => json(ACCOUNT, 200) })
    openAt(SIGN_IN_PATH)
    await renderApp()

    type('Email', 'reader@example.com')
    type('Password', 'tides and statues')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() => expect(heading()).toBe('Welcome, Courtney'))
    expect(fetchStub.mock.calls.map(([path]) => path)).toContain('/api/auth/sign-in')
    expect(window.location.pathname).toBe('/')
  })

  describe('signing out', () => {
    // Signed in, with the account menu open, ready to choose Sign out.
    async function openAccountMenu(signOutAnswer) {
      const fetchStub = vi.fn(async (path) => {
        if (path === '/health') return new Response('Healthy')
        if (path === '/api/auth/me') return json(ACCOUNT, 200)
        return signOutAnswer()
      })
      vi.stubGlobal('fetch', fetchStub)
      await renderApp()
      fireEvent.click(screen.getByRole('button', { name: /Courtney/ }))
      return fetchStub
    }

    it('asks the API to sign out, then shows sign-in', async () => {
      const fetchStub = await openAccountMenu(async () => new Response(null, { status: 204 }))
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

      await vi.waitFor(() => expect(heading()).toBe('Welcome back'))
      const call = fetchStub.mock.calls.find(([path]) => path === '/api/auth/sign-out')
      expect(call[1].method).toBe('POST')
    })

    it('stays signed in, and says so, when the API can’t sign out', async () => {
      await openAccountMenu(async () => new Response(null, { status: 500 }))
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

      await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toMatch("Couldn't sign out"))
      expect(heading()).toBe('Welcome, Courtney')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    })
  })

  it('stays on the form, showing the answer, when the API says no', async () => {
    stubApi({ auth: async () => json({ status: 401, error: 'wrongPassword' }, 401) })
    await renderApp()

    type('Email', 'reader@example.com')
    type('Password', 'not it')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() => expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true'))
    expect(heading()).toBe('Welcome back')
  })
})
