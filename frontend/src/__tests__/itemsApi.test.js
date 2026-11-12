import { describe, expect, it, vi } from 'vitest'
import { getItems } from '../api/items.js'

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
