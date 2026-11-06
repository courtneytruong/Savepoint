import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionForm, sessionMinutes, validateSession } from './index.js'

afterEach(cleanup)

const TODAY = new Date(2026, 10, 6)
const VALID = { itemId: 1, date: '2026-11-06', hours: '1', minutes: '30', pagesRead: '' }
const check = (changes, medium = 'Book') => validateSession({ ...VALID, ...changes }, { medium, today: TODAY })

describe('sessionMinutes', () => {
  it('adds the hours and minutes, counting an empty field as 0', () => {
    expect(sessionMinutes({ hours: '1', minutes: '30' })).toBe(90)
    expect(sessionMinutes({ hours: '', minutes: '45' })).toBe(45)
    expect(sessionMinutes({ hours: '2', minutes: '' })).toBe(120)
  })

  it("isn't a number unless both are whole numbers", () => {
    expect(sessionMinutes({ hours: '1.5', minutes: '' })).toBeNaN()
    expect(sessionMinutes({ hours: '', minutes: '-5' })).toBeNaN()
  })
})

describe('validateSession', () => {
  it('accepts a complete session', () => {
    expect(check({})).toEqual({})
  })

  it('requires an item and a date', () => {
    expect(check({ itemId: null })).toHaveProperty('itemId')
    expect(check({ date: '' })).toHaveProperty('date')
  })

  it("accepts today and earlier, but not a day that hasn't happened", () => {
    expect(check({ date: '2026-10-31' })).toEqual({})
    expect(check({ date: '2026-11-07' }).date).toBe("A session can't be in the future.")
  })

  it('requires some time spent', () => {
    expect(check({ hours: '', minutes: '' }).duration).toBe('Enter how long the session was.')
    expect(check({ hours: '0', minutes: '0' })).toHaveProperty('duration')
  })

  it('accepts minutes over 60 without hours', () => {
    expect(check({ hours: '', minutes: '90' })).toEqual({})
  })

  it('only accepts whole numbers of time', () => {
    expect(check({ hours: '1.5' }).duration).toBe('Use whole numbers for hours and minutes.')
    expect(check({ minutes: '-10' })).toHaveProperty('duration')
  })

  it('allows up to a whole day', () => {
    expect(check({ hours: '24', minutes: '0' })).toEqual({})
    expect(check({ hours: '24', minutes: '1' }).duration).toBe("A session can't be longer than 24 hours.")
  })

  it('accepts no pages, or a whole number above 0, for a book', () => {
    expect(check({ pagesRead: '' })).toEqual({})
    expect(check({ pagesRead: '42' })).toEqual({})
    expect(check({ pagesRead: '0' })).toHaveProperty('pagesRead')
    expect(check({ pagesRead: '4.5' })).toHaveProperty('pagesRead')
  })

  it('ignores pages for a game', () => {
    expect(check({ pagesRead: 'abc' }, 'Game')).toEqual({})
  })
})

const ITEMS = [
  { id: 1, title: 'Piranesi', creator: 'Susanna Clarke', medium: 'Book' },
  { id: 2, title: 'Hades', creator: 'Supergiant Games', medium: 'Game' },
]

function renderForm(props = {}) {
  const onSubmit = vi.fn()
  render(
    <SessionForm items={ITEMS} today={TODAY} onSubmit={onSubmit} {...props}>
      <button type="submit">Save</button>
    </SessionForm>,
  )
  return onSubmit
}

const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))
const itemField = () => screen.getByRole('combobox', { name: 'Book or game' })

function writeReflection() {
  fireEvent.click(screen.getByRole('radio', { name: 'Hooked' }))
  set('Notes', 'Couldn’t stop after the first hall.')
}

describe('SessionForm', () => {
  it('starts on today, and stops the date picker there', () => {
    renderForm()
    const date = screen.getByLabelText('Date')
    expect(date.value).toBe('2026-11-06')
    expect(date.getAttribute('max')).toBe('2026-11-06')
  })

  it('can start with an item chosen', () => {
    renderForm({ defaultItemId: 2 })
    expect(itemField().value).toBe('Hades')
  })

  it('only asks for pages read for a book', () => {
    renderForm({ defaultItemId: 2 })
    expect(screen.queryByLabelText('Pages read')).toBeNull()

    fireEvent.change(itemField(), { target: { value: 'Piranesi' } })
    fireEvent.click(screen.getByRole('option', { name: /Piranesi/ }))
    expect(screen.getByLabelText('Pages read')).toBeTruthy()
  })

  it('submits the session with its reflection, once everything is valid', () => {
    const onSubmit = renderForm({ defaultItemId: 1 })
    set('Hours', '1')
    set('Minutes', '15')
    set('Pages read', '40')
    writeReflection()
    save()
    expect(onSubmit).toHaveBeenCalledWith({
      itemId: 1,
      date: '2026-11-06',
      durationMinutes: 75,
      pagesRead: 40,
      reflection: { mood: 'Hooked', notes: 'Couldn’t stop after the first hall.', tags: [] },
    })
  })

  it('sends no pages when they were left empty', () => {
    const onSubmit = renderForm({ defaultItemId: 1 })
    set('Minutes', '30')
    writeReflection()
    save()
    expect(onSubmit.mock.calls[0][0].pagesRead).toBeNull()
  })

  it("doesn't send pages typed for a book after switching to a game", () => {
    const onSubmit = renderForm({ defaultItemId: 1 })
    set('Pages read', '12')
    fireEvent.change(itemField(), { target: { value: 'Hades' } })
    fireEvent.click(screen.getByRole('option', { name: /Hades/ }))
    set('Minutes', '30')
    writeReflection()
    save()
    expect(onSubmit.mock.calls[0][0].pagesRead).toBeNull()
  })

  it('shows the session and reflection problems together, and saves neither', () => {
    const onSubmit = renderForm()
    save()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Choose what you read or played.')).toBeTruthy()
    expect(screen.getByText('Enter how long the session was.')).toBeTruthy()
    expect(screen.getByText('Choose the mood that fits best.')).toBeTruthy()
    expect(screen.getByText('Write a sentence or two about it.')).toBeTruthy()
  })

  it('moves focus to the first problem, in the order of the form', () => {
    renderForm()
    save()
    expect(document.activeElement).toBe(itemField())

    fireEvent.change(itemField(), { target: { value: 'Hades' } })
    fireEvent.click(screen.getByRole('option', { name: /Hades/ }))
    save()
    expect(document.activeElement).toBe(screen.getByLabelText('Hours'))
  })

  it('links the time spent error to the group and both of its fields', () => {
    renderForm({ defaultItemId: 2 })
    save()
    const group = screen.getByRole('group', { name: 'Time spent' })
    const errorId = group.getAttribute('aria-describedby')
    expect(document.getElementById(errorId).textContent).toBe('Enter how long the session was.')
    for (const label of ['Hours', 'Minutes']) {
      const input = screen.getByLabelText(label)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(input.getAttribute('aria-describedby')).toBe(errorId)
    }
  })
})
