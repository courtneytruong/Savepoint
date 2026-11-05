import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const API_UNREACHABLE = "Can't reach the API"

function stubFetch(implementation) {
  const fetchStub = vi.fn(implementation)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function statusText() {
  return screen.getByRole('status').textContent
}

// A request that never gets an answer, for looking at the page while it waits.
const neverAnswers = () => new Promise(() => {})

describe('App', () => {
  afterEach(cleanup)

  it.each([
    [200, 'Healthy', 'All systems connected'],
    [503, 'Unhealthy', "The API is up, but it can't reach the database"],
    // Right status, wrong body: an error page from a proxy, not the API.
    [200, '<html>proxy page</html>', API_UNREACHABLE],
    [502, 'Bad Gateway', API_UNREACHABLE],
  ])('for a %i response with body "%s", shows "%s"', async (status, body, message) => {
    stubFetch(async () => new Response(body, { status }))

    render(<App />)

    await vi.waitFor(() => expect(statusText()).toBe(message))
  })

  it('shows the API as unreachable when the request fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    render(<App />)

    await vi.waitFor(() => expect(statusText()).toBe(API_UNREACHABLE))
  })

  it('shows a checking message until the API answers', () => {
    stubFetch(neverAnswers)

    render(<App />)

    expect(statusText()).toBe('Checking...')
  })

  it('cancels the request when the page goes away', () => {
    const fetchStub = stubFetch(neverAnswers)

    const { unmount } = render(<App />)
    const { signal } = fetchStub.mock.calls[0][1]
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  // StrictMode cancels the first request during development, and that must not
  // show up as an error.
  it('does not treat a cancelled request as a failure', async () => {
    stubFetch(async () => {
      throw new DOMException('Aborted', 'AbortError')
    })

    render(<App />)
    await act(async () => {})

    expect(statusText()).toBe('Checking...')
  })
})
