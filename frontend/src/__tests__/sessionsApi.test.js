import { describe, expect, it, vi } from 'vitest'
import { deleteSession, editSession, getSessions, logSession } from '../api/sessions.js'

function stubFetch(answer) {
  const fetchStub = vi.fn(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const json = (body, status) => new Response(JSON.stringify(body), { status })

const SESSION = {
  id: 's1',
  itemId: 'abc',
  date: '2026-11-14',
  durationMinutes: 45,
  pagesRead: 30,
  createdAt: '2026-11-14T20:00:00+00:00',
  reflection: {
    id: 'r1',
    mood: 'Moved',
    notes: 'The crossing of the ice stayed with me.',
    createdAt: '2026-11-14T20:00:00+00:00',
    updatedAt: '2026-11-14T20:00:00+00:00',
  },
}

// What SessionForm gives, tags and all.
const FROM_FORM = {
  itemId: 'abc',
  date: '2026-11-14',
  durationMinutes: 45,
  pagesRead: 30,
  reflection: { mood: 'Moved', notes: 'The crossing of the ice stayed with me.', tags: ['ice'] },
}

describe('getSessions', () => {
  it('asks for the item’s sessions and answers with them', async () => {
    const fetchStub = stubFetch(async () => json([SESSION], 200))

    expect(await getSessions('abc')).toEqual([SESSION])
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc/sessions')
  })

  it('puts the item id safely into the address', async () => {
    const fetchStub = stubFetch(async () => json([], 200))
    await getSessions('a/b')
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/a%2Fb/sessions')
  })

  it('answers null when there is no such item', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await getSessions('abc')).toBeNull()
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getSessions('abc')).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => json([], 200))
    const controller = new AbortController()
    await getSessions('abc', { signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('logSession', () => {
  it('posts the session and its reflection, and answers with what was saved', async () => {
    const fetchStub = stubFetch(async () => json(SESSION, 201))

    expect(await logSession('abc', FROM_FORM)).toEqual({ session: SESSION })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/sessions')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('sends neither the item id, which is in the address, nor tags, which wait for their feature', async () => {
    const fetchStub = stubFetch(async () => json(SESSION, 201))

    await logSession('abc', FROM_FORM)

    expect(JSON.parse(fetchStub.mock.calls[0][1].body)).toEqual({
      date: '2026-11-14',
      durationMinutes: 45,
      pagesRead: 30,
      reflection: { mood: 'Moved', notes: 'The crossing of the ice stayed with me.' },
    })
  })

  it('sends no page count as null', async () => {
    const fetchStub = stubFetch(async () => json(SESSION, 201))
    await logSession('abc', { ...FROM_FORM, pagesRead: null })
    expect(JSON.parse(fetchStub.mock.calls[0][1].body).pagesRead).toBeNull()
  })

  it('says when the item is no longer in the library', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await logSession('abc', FROM_FORM)).toEqual({ error: 'missing' })
  })

  it.each([400, 401, 500])('counts a %s as failed', async (status) => {
    stubFetch(async () => json({ status }, status))
    expect(await logSession('abc', FROM_FORM)).toEqual({ error: 'failed' })
  })

  it('throws when the server can’t be reached, so the form can count that as failed too', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(logSession('abc', FROM_FORM)).rejects.toThrow('Failed to fetch')
  })
})

describe('editSession', () => {
  it('puts the whole session at its own address, without the item id or tags', async () => {
    const fetchStub = stubFetch(async () => json(SESSION, 200))

    expect(await editSession('abc', 's1', FROM_FORM)).toEqual({ session: SESSION })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/sessions/s1')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({
      date: '2026-11-14',
      durationMinutes: 45,
      pagesRead: 30,
      reflection: { mood: 'Moved', notes: 'The crossing of the ice stayed with me.' },
    })
  })

  it('says when the item or session is no longer there', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await editSession('abc', 's1', FROM_FORM)).toEqual({ error: 'missing' })
  })

  it.each([400, 500])('counts a %s as failed', async (status) => {
    stubFetch(async () => json({ status }, status))
    expect(await editSession('abc', 's1', FROM_FORM)).toEqual({ error: 'failed' })
  })
})

describe('deleteSession', () => {
  it('deletes the session at its own address', async () => {
    const fetchStub = stubFetch(async () => new Response(null, { status: 204 }))

    expect(await deleteSession('abc', 's1')).toEqual({ deleted: true })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/sessions/s1')
    expect(options.method).toBe('DELETE')
  })

  it('counts one that was already gone as deleted', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await deleteSession('abc', 's1')).toEqual({ deleted: true })
  })

  it('counts any other answer as failed', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    expect(await deleteSession('abc', 's1')).toEqual({ error: 'failed' })
  })
})
