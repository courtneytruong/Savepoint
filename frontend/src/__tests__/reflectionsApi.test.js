import { describe, expect, it, vi } from 'vitest'
import {
  deleteReflection,
  editReflection,
  getAllReflections,
  getReflections,
  writeReflection,
} from '../api/reflections.js'

function stubFetch(answer) {
  const fetchStub = vi.fn(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const json = (body, status) => new Response(JSON.stringify(body), { status })

const REFLECTION = {
  id: 'r1',
  mood: 'Moved',
  notes: 'A slow start, but the ending earned every page.',
  createdAt: '2026-11-20T20:00:00+00:00',
  updatedAt: '2026-11-20T20:00:00+00:00',
  tags: ['ending'],
}

// What ReflectionForm gives.
const FROM_FORM = { mood: 'Moved', notes: 'A slow start, but the ending earned every page.', tags: ['ending'] }

describe('getReflections', () => {
  it('asks for the item’s standalone reflections and answers with them', async () => {
    const fetchStub = stubFetch(async () => json([REFLECTION], 200))

    expect(await getReflections('abc')).toEqual([REFLECTION])
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc/reflections')
  })

  it('puts the item id safely into the address', async () => {
    const fetchStub = stubFetch(async () => json([], 200))
    await getReflections('a/b')
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/a%2Fb/reflections')
  })

  it('answers null when there is no such item', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await getReflections('abc')).toBeNull()
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getReflections('abc')).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => json([], 200))
    const controller = new AbortController()
    await getReflections('abc', { signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('writeReflection', () => {
  it('posts the reflection with its tags, and answers with what was saved', async () => {
    const fetchStub = stubFetch(async () => json(REFLECTION, 201))

    expect(await writeReflection('abc', FROM_FORM)).toEqual({ reflection: REFLECTION })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/reflections')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual(FROM_FORM)
  })

  it('sends no tags as an empty list', async () => {
    const fetchStub = stubFetch(async () => json(REFLECTION, 201))
    await writeReflection('abc', { mood: 'Moved', notes: FROM_FORM.notes })
    expect(JSON.parse(fetchStub.mock.calls[0][1].body).tags).toEqual([])
  })

  it('says when the item is no longer in the library', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await writeReflection('abc', FROM_FORM)).toEqual({ error: 'missing' })
  })

  it.each([400, 401, 500])('counts a %s as failed', async (status) => {
    stubFetch(async () => json({ status }, status))
    expect(await writeReflection('abc', FROM_FORM)).toEqual({ error: 'failed' })
  })

  it('throws when the server can’t be reached, so the form can count that as failed too', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(writeReflection('abc', FROM_FORM)).rejects.toThrow('Failed to fetch')
  })
})

describe('editReflection', () => {
  it('puts the whole reflection at its own address', async () => {
    const fetchStub = stubFetch(async () => json(REFLECTION, 200))

    expect(await editReflection('abc', 'r1', FROM_FORM)).toEqual({ reflection: REFLECTION })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/reflections/r1')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual(FROM_FORM)
  })

  it('says when the item or reflection is no longer there', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await editReflection('abc', 'r1', FROM_FORM)).toEqual({ error: 'missing' })
  })

  it.each([400, 500])('counts a %s as failed', async (status) => {
    stubFetch(async () => json({ status }, status))
    expect(await editReflection('abc', 'r1', FROM_FORM)).toEqual({ error: 'failed' })
  })
})

describe('deleteReflection', () => {
  it('deletes the reflection at its own address', async () => {
    const fetchStub = stubFetch(async () => new Response(null, { status: 204 }))

    expect(await deleteReflection('abc', 'r1')).toEqual({ deleted: true })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/reflections/r1')
    expect(options.method).toBe('DELETE')
  })

  it('counts one that was already gone as deleted', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await deleteReflection('abc', 'r1')).toEqual({ deleted: true })
  })

  it('counts any other answer as failed', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    expect(await deleteReflection('abc', 'r1')).toEqual({ error: 'failed' })
  })
})

describe('getAllReflections', () => {
  it('asks for every reflection in the library and answers with them', async () => {
    const all = [{ ...REFLECTION, item: { id: 'abc', title: 'Piranesi', medium: 'Book' }, session: null }]
    const fetchStub = stubFetch(async () => json(all, 200))

    expect(await getAllReflections()).toEqual(all)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/reflections')
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getAllReflections()).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => json([], 200))
    const controller = new AbortController()
    await getAllReflections({ signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})
