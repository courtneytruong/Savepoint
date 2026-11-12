import { describe, expect, it, vi } from 'vitest'
import { createAccount, signIn } from '../api/auth.js'

const ACCOUNT = { id: '6f1c2c1e-0000-4000-8000-000000000000', displayName: 'Courtney', email: 'reader@example.com' }
const NEW_ACCOUNT = { displayName: 'Courtney', email: 'reader@example.com', password: 'tides and statues' }

function stubFetch(answer) {
  const fetchStub = vi.fn(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const problem = (status, extra = {}) =>
  new Response(JSON.stringify({ title: 'Something', status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })

describe('createAccount', () => {
  it('posts the name, email and password as JSON to the register endpoint', async () => {
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(ACCOUNT), { status: 201 }))
    await createAccount(NEW_ACCOUNT)

    const [path, options] = fetchStub.mock.calls[0]
    expect(path).toBe('/api/auth/register')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual(NEW_ACCOUNT)
  })

  it('answers with the new account', async () => {
    stubFetch(async () => new Response(JSON.stringify(ACCOUNT), { status: 201 }))
    expect(await createAccount(NEW_ACCOUNT)).toEqual({ account: ACCOUNT })
  })

  it('passes on the error code the API names', async () => {
    stubFetch(async () => problem(409, { error: 'emailTaken' }))
    expect(await createAccount(NEW_ACCOUNT)).toEqual({ error: 'emailTaken' })
  })

  it('counts field errors the form should have caught as failed', async () => {
    stubFetch(async () => problem(400, { errors: { email: ['invalid'] } }))
    expect(await createAccount(NEW_ACCOUNT)).toEqual({ error: 'failed' })
  })

  it('counts a server error as failed', async () => {
    stubFetch(async () => problem(500))
    expect(await createAccount(NEW_ACCOUNT)).toEqual({ error: 'failed' })
  })

  it('counts a page that isn’t JSON, such as nginx answering for a stopped API, as failed', async () => {
    stubFetch(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    expect(await createAccount(NEW_ACCOUNT)).toEqual({ error: 'failed' })
  })

  it('lets a network failure throw, which the form counts as failed', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(createAccount(NEW_ACCOUNT)).rejects.toThrow('Failed to fetch')
  })
})

describe('signIn', () => {
  const DETAILS = { email: 'reader@example.com', password: 'tides and statues' }

  it('posts the email and password as JSON to the sign-in endpoint, and answers with the account', async () => {
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(ACCOUNT), { status: 200 }))
    expect(await signIn(DETAILS)).toEqual({ account: ACCOUNT })

    const [path, options] = fetchStub.mock.calls[0]
    expect(path).toBe('/api/auth/sign-in')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(DETAILS)
  })

  it.each([
    [401, 'unknownEmail'],
    [401, 'wrongPassword'],
    [429, 'tooManyTries'],
  ])('passes on a %i with %s', async (status, error) => {
    stubFetch(async () => problem(status, { error }))
    expect(await signIn(DETAILS)).toEqual({ error })
  })
})
