import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { CREATE_ACCOUNT_PATH, SIGN_IN_PATH } from '../App.jsx'

const ACCOUNT = { id: '6f1c2c1e-0000-4000-8000-000000000000', displayName: 'Courtney', email: 'reader@example.com' }

const json = (body, status) => new Response(JSON.stringify(body), { status })

// Answers each path the way the API would, given an answer for the auth call.
function stubApi(authAnswer) {
  const fetchStub = vi.fn(async (path) => (path === '/health' ? new Response('Healthy') : authAnswer()))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const openAt = (path) => window.history.replaceState(null, '', path)
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const heading = () => screen.getByRole('heading', { level: 1 }).textContent

describe('App', () => {
  afterEach(() => {
    cleanup()
    openAt('/')
  })

  it('shows sign-in at the home address while signed out', () => {
    render(<App />)
    expect(heading()).toBe('Welcome back')
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(CREATE_ACCOUNT_PATH)
  })

  it('shows creating an account at its own path', () => {
    openAt(CREATE_ACCOUNT_PATH)
    render(<App />)
    expect(heading()).toBe('Start your journal')
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(SIGN_IN_PATH)
  })

  it('opens the app at home once an account is created', async () => {
    const fetchStub = stubApi(async () => json(ACCOUNT, 201))
    openAt(CREATE_ACCOUNT_PATH)
    render(<App />)

    type('Your name', 'Courtney')
    type('Email', 'reader@example.com')
    type('Password', 'tides and statues')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() => expect(heading()).toBe('Welcome, Courtney'))
    expect(fetchStub.mock.calls[0][0]).toBe('/api/auth/register')
    expect(window.location.pathname).toBe('/')
    expect(screen.getByRole('button', { name: /Courtney/ })).toBeTruthy()
  })

  it('opens the app once signed in', async () => {
    const fetchStub = stubApi(async () => json(ACCOUNT, 200))
    openAt(SIGN_IN_PATH)
    render(<App />)

    type('Email', 'reader@example.com')
    type('Password', 'tides and statues')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() => expect(heading()).toBe('Welcome, Courtney'))
    expect(fetchStub.mock.calls[0][0]).toBe('/api/auth/sign-in')
    expect(window.location.pathname).toBe('/')
  })

  it('stays on the form, showing the answer, when the API says no', async () => {
    stubApi(async () => json({ status: 401, error: 'wrongPassword' }, 401))
    render(<App />)

    type('Email', 'reader@example.com')
    type('Password', 'not it')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() => expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true'))
    expect(heading()).toBe('Welcome back')
  })
})
