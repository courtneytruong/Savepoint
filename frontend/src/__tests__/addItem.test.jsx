import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createItem } from '../api/items.js'
import { AddItemModal, validateItem } from '../components/index.js'

afterEach(cleanup)

describe('validateItem', () => {
  it('needs a title, trimmed, of 200 characters or fewer', () => {
    expect(validateItem({ title: '  ' }).title).toBe('Enter a title.')
    expect(validateItem({ title: ` ${'a'.repeat(200)} ` })).toEqual({})
    expect(validateItem({ title: 'a'.repeat(201) }).title).toBe('Use 200 characters or fewer.')
  })

  it('takes no creator, or one of 200 characters or fewer', () => {
    expect(validateItem({ title: 'Tetris', creator: '' })).toEqual({})
    expect(validateItem({ title: 'Tetris', creator: 'a'.repeat(200) })).toEqual({})
    expect(validateItem({ title: 'Tetris', creator: 'a'.repeat(201) }).creator).toBe('Use 200 characters or fewer.')
  })
})

describe('createItem', () => {
  const DETAILS = { medium: 'Game', title: 'Hades', creator: null, status: 'InProgress' }

  it('posts the item as JSON, and answers with what the API saved', async () => {
    const saved = { id: '1', ...DETAILS, statusChangedAt: 'x', createdAt: 'x' }
    const fetchStub = vi.fn(async () => new Response(JSON.stringify(saved), { status: 201 }))
    vi.stubGlobal('fetch', fetchStub)

    expect(await createItem(DETAILS)).toEqual({ item: saved })
    const [path, options] = fetchStub.mock.calls[0]
    expect(path).toBe('/api/items')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(DETAILS)
  })

  it.each([400, 401, 500])('counts a %i as failed', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })))
    expect(await createItem(DETAILS)).toEqual({ error: 'failed' })
  })
})

describe('AddItemModal', () => {
  const field = (label) => screen.getByLabelText(label)
  const type = (label, value) => fireEvent.change(field(label), { target: { value } })
  const submit = () => screen.getByRole('button', { name: /^Add(ing)? item|^Adding/ })

  function open(onSubmit = vi.fn(async () => ({ item: {} })), props = {}) {
    const utils = render(<AddItemModal open onClose={vi.fn()} onSubmit={onSubmit} {...props} />)
    return { onSubmit, ...utils }
  }

  it('starts in the backlog, as a book, with the title ready to type', () => {
    open()
    expect(field('Type').value).toBe('Book')
    expect(field('Status').value).toBe('Backlog')
    expect(document.activeElement).toBe(field('Title'))
  })

  it('offers every status', () => {
    open()
    const options = [...field('Status').options].map((option) => [option.value, option.textContent])
    expect(options).toEqual([
      ['Backlog', 'Backlog'],
      ['InProgress', 'In progress'],
      ['Finished', 'Finished'],
      ['Dropped', 'Dropped'],
    ])
  })

  it('sends the title and creator trimmed, with the chosen type and status', async () => {
    const { onSubmit } = open()
    type('Title', '  Hades ')
    type('Creator', ' Supergiant Games ')
    type('Type', 'Game')
    type('Status', 'InProgress')

    await act(async () => fireEvent.click(submit()))

    expect(onSubmit).toHaveBeenCalledWith({
      medium: 'Game',
      title: 'Hades',
      creator: 'Supergiant Games',
      status: 'InProgress',
    })
  })

  it('sends an empty creator as none', async () => {
    const { onSubmit } = open()
    type('Title', 'Tetris')
    type('Creator', '   ')

    await act(async () => fireEvent.click(submit()))

    expect(onSubmit.mock.calls[0][0].creator).toBeNull()
  })

  it('shows what needs fixing, moves there, and sends nothing', async () => {
    const { onSubmit } = open()

    await act(async () => fireEvent.click(submit()))

    expect(screen.getByText('Enter a title.')).toBeTruthy()
    expect(field('Title').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(field('Title'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('says something went wrong, above the form, when saving fails', async () => {
    open(vi.fn(async () => ({ error: 'failed' })))
    type('Title', 'Hades')

    await act(async () => fireEvent.click(submit()))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch("Couldn't add it")
    expect(alert.textContent).toMatch("Something went wrong on Savepoint's server. Try again.")
    expect(document.activeElement).toBe(alert)
  })

  it('shows that it’s saving', async () => {
    open(() => new Promise(() => {}))
    type('Title', 'Hades')

    await act(async () => fireEvent.click(submit()))

    expect(submit().textContent).toBe('Adding…')
  })

  it('starts empty each time it opens', async () => {
    const { rerender } = open()
    type('Title', 'Half typed')
    await act(async () => fireEvent.click(submit()))

    rerender(<AddItemModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />)
    rerender(<AddItemModal open onClose={vi.fn()} onSubmit={vi.fn()} />)

    expect(field('Title').value).toBe('')
  })
})
