import { describe, expect, it, vi } from 'vitest'
import { getTags } from '../api/tags.js'

function stubFetch(answer) {
  const fetchStub = vi.fn(answer)
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

describe('getTags', () => {
  it('asks for the tags and answers with their names', async () => {
    const fetchStub = stubFetch(async () => new Response(JSON.stringify(['cozy', 'Space']), { status: 200 }))

    expect(await getTags()).toEqual(['cozy', 'Space'])
    expect(fetchStub.mock.calls[0][0]).toBe('/api/tags')
  })

  it('throws on any other answer', async () => {
    stubFetch(async () => new Response(null, { status: 500 }))
    await expect(getTags()).rejects.toThrow('500')
  })

  it('passes on a signal, so the request can be cancelled', async () => {
    const fetchStub = stubFetch(async () => new Response('[]', { status: 200 }))
    const controller = new AbortController()
    await getTags({ signal: controller.signal })
    expect(fetchStub.mock.calls[0][1].signal).toBe(controller.signal)
  })
})
