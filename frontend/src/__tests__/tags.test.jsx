import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanTag, ReflectionForm, TagInput } from '../components/index.js'

afterEach(cleanup)

const SUGGESTIONS = ['ending', 'worldbuilding', 'world music', 'Éowyn']

function Controlled({ initial = [], onChange = () => {} }) {
  const [tags, setTags] = useState(initial)
  return (
    <TagInput
      value={tags}
      suggestions={SUGGESTIONS}
      onChange={(next) => {
        setTags(next)
        onChange(next)
      }}
    />
  )
}

const field = () => screen.getByRole('combobox', { name: 'Tags' })
const type = (text) => fireEvent.change(field(), { target: { value: text } })
const press = (key) => fireEvent.keyDown(field(), { key })
const options = () => screen.queryAllByRole('option').map((option) => option.textContent)
const chosen = () =>
  screen.queryAllByRole('listitem').map((item) => item.textContent)

describe('cleanTag', () => {
  it('trims the ends and collapses spaces inside', () => {
    expect(cleanTag('  quantum    moon ')).toBe('quantum moon')
  })
})

describe('TagInput', () => {
  it('suggests existing tags that match what was typed', () => {
    render(<Controlled />)
    type('world')
    expect(options()).toEqual(['worldbuilding', 'world music', 'New tag “world”'])
  })

  it('matches ignoring case and accents', () => {
    render(<Controlled />)
    type('EOW')
    expect(options()).toContain('Éowyn')
  })

  it('adds the highlighted suggestion on Enter', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    type('world')
    press('ArrowDown')
    press('Enter')
    expect(onChange).toHaveBeenLastCalledWith(['world music'])
    expect(field().value).toBe('')
  })

  it('adds exactly what was typed on a comma', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    type('world')
    press(',')
    expect(onChange).toHaveBeenLastCalledWith(['world'])
  })

  it('reuses the existing spelling of a tag typed differently', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    type('ENDING')
    press(',')
    expect(onChange).toHaveBeenLastCalledWith(['ending'])
  })

  it("only offers a new tag when one with that name doesn't exist", () => {
    render(<Controlled />)
    type('Ending')
    expect(options()).toEqual(['ending'])
  })

  it("doesn't suggest or add a tag that's already chosen", () => {
    const onChange = vi.fn()
    render(<Controlled initial={['ending']} onChange={onChange} />)
    type('end')
    expect(options()).toEqual(['New tag “end”'])
    type('ending')
    expect(screen.getByText('“ending” is already added')).toBeTruthy()
    press(',')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('ending is already added')
  })

  it('removes a tag with its button and keeps focus in the field', () => {
    const onChange = vi.fn()
    render(<Controlled initial={['ending', 'music']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove ending' }))
    expect(onChange).toHaveBeenLastCalledWith(['music'])
    expect(document.activeElement).toBe(field())
    expect(screen.getByRole('status').textContent).toBe('Removed ending')
  })

  it('removes the last tag on Backspace in the empty field', () => {
    const onChange = vi.fn()
    render(<Controlled initial={['ending', 'music']} onChange={onChange} />)
    press('Backspace')
    expect(onChange).toHaveBeenLastCalledWith(['ending'])
  })

  it("doesn't remove a tag on Backspace while there's text", () => {
    const onChange = vi.fn()
    render(<Controlled initial={['ending']} onChange={onChange} />)
    type('mu')
    press('Backspace')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds what was typed when leaving the field', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    type('  boss  fight ')
    fireEvent.blur(field())
    expect(onChange).toHaveBeenLastCalledWith(['boss fight'])
  })

  it('shows the chosen tags as a list', () => {
    render(<Controlled initial={['ending', 'music']} />)
    expect(screen.getByRole('list', { name: 'Chosen tags' })).toBeTruthy()
    expect(chosen()).toEqual(['ending', 'music'])
  })

  it('closes the list on Esc without letting a modal underneath close', () => {
    const onParentKeyDown = vi.fn()
    render(
      <div onKeyDown={onParentKeyDown}>
        <Controlled />
      </div>,
    )
    type('end')
    expect(field().getAttribute('aria-expanded')).toBe('true')
    press('Escape')
    expect(field().getAttribute('aria-expanded')).toBe('false')
    expect(onParentKeyDown).not.toHaveBeenCalled()
  })

  it("leaves Enter to submit the form when there's nothing to add", () => {
    const onSubmit = vi.fn((event) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Controlled />
      </form>,
    )
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    field().dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('ReflectionForm with tags', () => {
  it('submits the chosen tags', () => {
    const onSubmit = vi.fn()
    render(
      <ReflectionForm tagSuggestions={SUGGESTIONS} onSubmit={onSubmit}>
        <button type="submit">Save</button>
      </ReflectionForm>,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Curious' }))
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'a'.repeat(20) } })
    type('ending')
    press('Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith({ mood: 'Curious', notes: 'a'.repeat(20), tags: ['ending'] })
  })
})
