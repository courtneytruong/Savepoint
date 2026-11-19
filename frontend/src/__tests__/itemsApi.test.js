import { describe, expect, it, vi } from 'vitest'
import {
  changeItemStatus,
  deleteItem,
  editItem,
  getItem,
  getItems,
  getRatingChanges,
  getStatusChanges,
  rateItem,
} from '../api/items.js'
import { itemPath } from '../paths.js'

function stubFetch(answer) {
  const fetchStub = vi.fn(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

describe('getItems', () => {
  it('asks for the library and answers with its items', async () => {
    const items = [{ id: '1', medium: 'Book', title: 'Piranesi', creator: null, status: 'Backlog' }]
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(items), { status: 200 }))

    expect(await getItems()).toEqual(items)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items')
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getItems()).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => new Response('[]', { status: 200 }))
    const controller = new AbortController()
    await getItems({ signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('getItem', () => {
  it('asks for the item and answers with it', async () => {
    const item = { id: 'abc', medium: 'Game', title: 'Outer Wilds', creator: null, status: 'InProgress' }
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(item), { status: 200 }))

    expect(await getItem('abc')).toEqual(item)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc')
  })

  it('answers null when there is no such item', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await getItem('abc')).toBeNull()
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getItem('abc')).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => new Response('{}', { status: 200 }))
    const controller = new AbortController()
    await getItem('abc', { signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('getStatusChanges', () => {
  const CHANGES = [
    { id: 'c1', status: 'Backlog', changedAt: '2026-11-01T09:00:00+00:00' },
    { id: 'c2', status: 'InProgress', changedAt: '2026-11-03T18:30:00+00:00' },
  ]

  it('asks for the item’s status changes and answers with them', async () => {
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(CHANGES), { status: 200 }))

    expect(await getStatusChanges('abc')).toEqual(CHANGES)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc/status-changes')
  })

  it('puts the item id safely into the address', async () => {
    const fetchStub = stubFetch(async () => new Response('[]', { status: 200 }))
    await getStatusChanges('a/b')
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/a%2Fb/status-changes')
  })

  it('answers null when there is no such item', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await getStatusChanges('abc')).toBeNull()
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getStatusChanges('abc')).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => new Response('[]', { status: 200 }))
    const controller = new AbortController()
    await getStatusChanges('abc', { signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('itemPath', () => {
  it('is the item page for that id', () => {
    expect(itemPath('abc')).toBe('/items/abc')
  })
})

describe('changeItemStatus', () => {
  it('sends the new status and answers with the item', async () => {
    const item = { id: 'abc', medium: 'Book', title: 'Piranesi', creator: null, status: 'Finished' }
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(item), { status: 200 }))

    expect(await changeItemStatus('abc', 'Finished')).toEqual({ item })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/status')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ status: 'Finished' })
  })

  it('says when the item is no longer there', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await changeItemStatus('abc', 'Finished')).toEqual({ error: 'missing' })
  })

  it('says it failed on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    expect(await changeItemStatus('abc', 'Finished')).toEqual({ error: 'failed' })
  })
})

describe('rateItem', () => {
  it('sends the rating and answers with the item', async () => {
    const item = { id: 'abc', medium: 'Book', title: 'Piranesi', rating: 4, ratingChangeId: 'r1' }
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(item), { status: 200 }))

    expect(await rateItem('abc', 4)).toEqual({ item })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc/rating')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ rating: 4 })
  })

  it('puts the item id safely into the address', async () => {
    const fetchStub = stubFetch(async () => new Response('{}', { status: 200 }))
    await rateItem('a/b', 4)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/a%2Fb/rating')
  })

  it('says when the item is no longer there', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await rateItem('abc', 4)).toEqual({ error: 'missing' })
  })

  it.each([400, 500])('says it failed on a %i', async (status) => {
    stubFetch(async () => new Response(null, { status }))
    expect(await rateItem('abc', 4)).toEqual({ error: 'failed' })
  })
})

describe('getRatingChanges', () => {
  const CHANGES = [
    { id: 'r1', rating: 3, changedAt: '2026-11-05T09:00:00+00:00' },
    { id: 'r2', rating: 5, changedAt: '2026-11-12T21:15:00+00:00' },
  ]

  it('asks for the item’s rating changes and answers with them', async () => {
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(CHANGES), { status: 200 }))

    expect(await getRatingChanges('abc')).toEqual(CHANGES)
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc/rating-changes')
  })

  it('answers an empty list for an item not rated yet', async () => {
    stubFetch(async () => new Response('[]', { status: 200 }))
    expect(await getRatingChanges('abc')).toEqual([])
  })

  it('puts the item id safely into the address', async () => {
    const fetchStub = stubFetch(async () => new Response('[]', { status: 200 }))
    await getRatingChanges('a/b')
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/a%2Fb/rating-changes')
  })

  it('answers null when there is no such item', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await getRatingChanges('abc')).toBeNull()
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getRatingChanges('abc')).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => new Response('[]', { status: 200 }))
    const controller = new AbortController()
    await getRatingChanges('abc', { signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('editItem', () => {
  it('replaces the details and answers with the item', async () => {
    const item = { id: 'abc', medium: 'Book', title: 'Piranesi', creator: null, status: 'Backlog' }
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(item), { status: 200 }))

    expect(await editItem('abc', { medium: 'Book', title: 'Piranesi', creator: null })).toEqual({ item })
    const [url, options] = fetchStub.mock.calls[0]
    expect(url).toBe('/api/items/abc')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ medium: 'Book', title: 'Piranesi', creator: null })
  })

  it('says when the item is no longer there', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await editItem('abc', { medium: 'Book', title: 'Piranesi', creator: null })).toEqual({ error: 'missing' })
  })

  it('says it failed on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 400 }))
    expect(await editItem('abc', { medium: 'Book', title: 'Piranesi', creator: null })).toEqual({ error: 'failed' })
  })

  it('says when a book with pages logged can’t become a game', async () => {
    stubFetch(async () => new Response(JSON.stringify({ status: 409, error: 'pagesLogged' }), { status: 409 }))
    expect(await editItem('abc', { medium: 'Game', title: 'Piranesi', creator: null })).toEqual({ error: 'pagesLogged' })
  })

  it.each([
    ['another code', JSON.stringify({ status: 409, error: 'somethingElse' })],
    ['no body', null],
  ])('counts a 409 with %s as failed', async (_, body) => {
    stubFetch(async () => new Response(body, { status: 409 }))
    expect(await editItem('abc', { medium: 'Game', title: 'Piranesi', creator: null })).toEqual({ error: 'failed' })
  })
})

describe('deleteItem', () => {
  it('deletes the item', async () => {
    const fetchStub = stubFetch(async () => new Response(null, { status: 204 }))

    expect(await deleteItem('abc')).toEqual({ deleted: true })
    expect(fetchStub.mock.calls[0][0]).toBe('/api/items/abc')
    expect(fetchStub.mock.calls[0][1].method).toBe('DELETE')
  })

  it('counts an item that was already gone as deleted', async () => {
    stubFetch(async () => new Response(null, { status: 404 }))
    expect(await deleteItem('abc')).toEqual({ deleted: true })
  })

  it('says it failed on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    expect(await deleteItem('abc')).toEqual({ error: 'failed' })
  })
})
