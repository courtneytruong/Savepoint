import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notesLength, ReflectionForm, validateReflection } from '../components/index.js'
import { wasEdited } from '../rules/reflectionRules.js'

afterEach(cleanup)

const TWENTY = 'a'.repeat(20)

describe('validateReflection', () => {
  it('accepts a mood with at least 20 characters of notes', () => {
    expect(validateReflection({ mood: 'Curious', notes: TWENTY })).toEqual({})
  })

  it('requires a mood', () => {
    expect(validateReflection({ mood: null, notes: TWENTY })).toHaveProperty('mood')
  })

  it('asks for notes when there are none', () => {
    expect(validateReflection({ mood: 'Moved', notes: '   ' }).notes).toBe('Write a sentence or two about it.')
  })

  it('says how many characters are still needed', () => {
    expect(validateReflection({ mood: 'Moved', notes: 'a'.repeat(19) }).notes).toMatch('1 more character to go')
    expect(validateReflection({ mood: 'Moved', notes: 'a'.repeat(15) }).notes).toMatch('5 more characters to go')
  })

  it("doesn't count spaces at either end toward the minimum", () => {
    expect(notesLength(`  ${'a'.repeat(19)}  `)).toBe(19)
    expect(validateReflection({ mood: 'Moved', notes: `  ${'a'.repeat(19)}  ` })).toHaveProperty('notes')
  })

  it('counts spaces inside the notes', () => {
    expect(notesLength('a b')).toBe(3)
  })

  // As the API and the database count, or notes could pass here and fail there.
  it('counts an emoji as one character', () => {
    expect(notesLength('🌊')).toBe(1)
    expect(validateReflection({ mood: 'Moved', notes: `${'a'.repeat(19)}🌊` })).toEqual({})
    expect(validateReflection({ mood: 'Moved', notes: `${'a'.repeat(18)}🌊` }).notes).toMatch('1 more character to go')
  })

  it('accepts notes up to 10,000 characters, and says how far over they are', () => {
    expect(validateReflection({ mood: 'Moved', notes: 'a'.repeat(10_000) })).toEqual({})
    expect(validateReflection({ mood: 'Moved', notes: 'a'.repeat(10_001) }).notes).toBe(
      'Keep it to 10,000 characters: 1 character over.',
    )
    expect(validateReflection({ mood: 'Moved', notes: 'a'.repeat(10_250) }).notes).toMatch('250 characters over')
  })

  it('passes on what is wrong with the tags', () => {
    expect(validateReflection({ mood: 'Moved', notes: TWENTY, tags: ['cozy'] })).toEqual({})
    expect(validateReflection({ mood: 'Moved', notes: TWENTY, tags: ['a'.repeat(41)] }).tags).toBe(
      'Keep a tag to 40 characters: 1 over.',
    )
  })
})

function renderForm(onSubmit = vi.fn()) {
  render(
    <ReflectionForm id="form" onSubmit={onSubmit}>
      <button type="submit">Save</button>
    </ReflectionForm>,
  )
  return onSubmit
}

const notes = () => screen.getByLabelText('Notes')
const type = (text) => fireEvent.change(notes(), { target: { value: text } })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('wasEdited', () => {
  it('is false for a reflection as it was written', () => {
    expect(wasEdited({ createdAt: '2026-11-14T20:00:00+00:00', updatedAt: '2026-11-14T20:00:00+00:00' })).toBe(false)
  })

  it('is true once it changed afterwards', () => {
    expect(wasEdited({ createdAt: '2026-11-14T20:00:00+00:00', updatedAt: '2026-11-15T08:30:00+00:00' })).toBe(true)
  })

  it('compares times, not text, so time zones don’t fool it', () => {
    expect(wasEdited({ createdAt: '2026-11-14T20:00:00+00:00', updatedAt: '2026-11-14T21:00:00+01:00' })).toBe(false)
  })

  it('is false when either time is missing', () => {
    expect(wasEdited({ createdAt: '2026-11-14T20:00:00+00:00' })).toBe(false)
    expect(wasEdited()).toBe(false)
  })
})

describe('ReflectionForm', () => {
  it('counts toward the minimum as you type', () => {
    renderForm()
    expect(screen.getByText('0 / 20 characters')).toBeTruthy()
    type('  Twelve chars  ')
    expect(screen.getByText('12 / 20 characters')).toBeTruthy()
  })

  it('confirms once there are enough characters', () => {
    renderForm()
    type(TWENTY)
    expect(screen.getByText('20 characters')).toBeTruthy()
  })

  it('counts against the maximum, without the tick, once past it', () => {
    renderForm()
    type('a'.repeat(10_012))
    expect(screen.getByText('10,012 / 10,000 characters')).toBeTruthy()
  })

  it('shows no errors before the first save', () => {
    renderForm()
    type('short')
    expect(notes().getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText(/more characters to go/)).toBeNull()
  })

  it("doesn't submit, and shows each problem, when saved too soon", () => {
    const onSubmit = renderForm()
    type('short')
    save()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Choose the mood that fits best.')).toBeTruthy()
    expect(screen.getByText('Write a little more: 15 more characters to go.')).toBeTruthy()
    expect(notes().getAttribute('aria-invalid')).toBe('true')
  })

  it('moves focus to the first problem', () => {
    renderForm()
    save()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Hooked' }))

    fireEvent.click(screen.getByRole('radio', { name: 'Curious' }))
    save()
    expect(document.activeElement).toBe(notes())
  })

  it('links the mood error to the group, so it is read out with it', () => {
    renderForm()
    save()
    const group = screen.getByRole('group', { name: 'Mood' })
    const error = document.getElementById(group.getAttribute('aria-describedby'))
    expect(error.textContent).toBe('Choose the mood that fits best.')
  })

  it('clears an error as soon as it is fixed', () => {
    renderForm()
    save()
    fireEvent.click(screen.getByRole('radio', { name: 'Curious' }))
    expect(screen.queryByText('Choose the mood that fits best.')).toBeNull()
    type(TWENTY)
    expect(notes().getAttribute('aria-invalid')).toBeNull()
  })

  it('submits the mood and trimmed notes once valid', () => {
    const onSubmit = renderForm()
    fireEvent.click(screen.getByRole('radio', { name: 'Delighted' }))
    type(`  ${TWENTY}\n`)
    save()
    expect(onSubmit).toHaveBeenCalledWith({ mood: 'Delighted', notes: TWENTY, tags: [] })
  })

  it('can start from an existing reflection, for editing', () => {
    render(<ReflectionForm defaultValue={{ mood: 'Bored', notes: 'Already written' }} />)
    expect(screen.getByRole('radio', { name: 'Bored' }).checked).toBe(true)
    expect(notes().value).toBe('Already written')
  })
})
