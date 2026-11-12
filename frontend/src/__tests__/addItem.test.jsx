import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createItem } from '../api/items.js'
import { AddItemModal, DeleteItemModal, EditItemModal, validateItem } from '../components/index.js'

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

describe('EditItemModal', () => {
  const ITEM = { id: 'abc', medium: 'Game', title: 'Hades', creator: 'Supergiant Games', status: 'Finished' }
  const field = (label) => screen.getByLabelText(label)
  const type = (label, value) => fireEvent.change(field(label), { target: { value } })
  const submit = () => screen.getByRole('button', { name: /^Save changes|^Saving/ })

  function open(onSubmit = vi.fn(async () => ({ item: ITEM })), item = ITEM) {
    const utils = render(<EditItemModal open item={item} onClose={vi.fn()} onSubmit={onSubmit} />)
    return { onSubmit, ...utils }
  }

  it('starts from the item as it is, with the title ready to change', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Edit details' })).toBeTruthy()
    expect(field('Title').value).toBe('Hades')
    expect(field('Creator').value).toBe('Supergiant Games')
    expect(field('Type').value).toBe('Game')
    expect(document.activeElement).toBe(field('Title'))
  })

  it('starts with an empty creator for an item without one', () => {
    open(undefined, { ...ITEM, creator: null })
    expect(field('Creator').value).toBe('')
  })

  it('leaves out the status, which the item page changes by itself', () => {
    open()
    expect(screen.queryByLabelText('Status')).toBeNull()
  })

  it('sends the new details, trimmed, without a status', async () => {
    const { onSubmit } = open()
    type('Title', ' Hades II ')
    type('Creator', '  ')
    type('Type', 'Book')

    await act(async () => fireEvent.click(submit()))

    expect(onSubmit).toHaveBeenCalledWith({ medium: 'Book', title: 'Hades II', creator: null })
  })

  it('checks the same rules as adding', async () => {
    const { onSubmit } = open()
    type('Title', '   ')
    await act(async () => fireEvent.click(submit()))

    expect(screen.getByText('Enter a title.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('says when saving fails', async () => {
    open(vi.fn(async () => ({ error: 'failed' })))
    await act(async () => fireEvent.click(submit()))
    expect(screen.getByRole('alert').textContent).toMatch("Couldn't save your changes")
  })

  it('starts again from the item each time it opens', () => {
    const { rerender } = open()
    type('Title', 'Half typed')

    rerender(<EditItemModal open={false} item={ITEM} onClose={vi.fn()} onSubmit={vi.fn()} />)
    rerender(<EditItemModal open item={ITEM} onClose={vi.fn()} onSubmit={vi.fn()} />)

    expect(field('Title').value).toBe('Hades')
  })
})

describe('DeleteItemModal', () => {
  const remove = () => screen.getByRole('button', { name: /^Delet(e|ing…)$/ })

  function open(onConfirm = vi.fn(async () => ({ deleted: true }))) {
    const utils = render(<DeleteItemModal open title="Hades" onClose={vi.fn()} onConfirm={onConfirm} />)
    return { onConfirm, ...utils }
  }

  it('names the item, and says it cannot be undone', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Delete Hades?' })
    expect(dialog.textContent).toMatch("can't be undone")
  })

  it('shows that it is deleting, and ignores a second press', async () => {
    const { onConfirm } = open(vi.fn(() => new Promise(() => {})))
    fireEvent.click(remove())
    expect(remove().textContent).toBe('Deleting…')

    fireEvent.click(remove())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('says when deleting fails, including a server that cannot be reached', async () => {
    open(
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await act(async () => fireEvent.click(remove()))
    expect(screen.getByRole('alert').textContent).toMatch("Couldn't delete it")
  })

  it('starts without the last error each time it opens', async () => {
    const { rerender } = open(vi.fn(async () => ({ error: 'failed' })))
    await act(async () => fireEvent.click(remove()))

    rerender(<DeleteItemModal open={false} title="Hades" onClose={vi.fn()} onConfirm={vi.fn()} />)
    rerender(<DeleteItemModal open title="Hades" onClose={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
