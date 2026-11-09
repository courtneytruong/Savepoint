import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Combobox, filterOptions } from '../components/index.js'

afterEach(cleanup)

const OPTIONS = [
  { value: 1, label: 'Dune', description: 'Frank Herbert' },
  { value: 2, label: 'Hades', description: 'Supergiant Games' },
  { value: 3, label: 'Piranesi', description: 'Susanna Clarke' },
  { value: 4, label: 'The Left Hand of Darkness', description: 'Ursula K. Le Guin' },
  { value: 5, label: 'Les Misérables', description: 'Victor Hugo' },
]

const labels = (options) => options.map((option) => option.label)

describe('filterOptions', () => {
  it('returns everything for an empty or blank query', () => {
    expect(filterOptions(OPTIONS, '')).toBe(OPTIONS)
    expect(filterOptions(OPTIONS, '   ')).toBe(OPTIONS)
  })

  it('puts titles that start with the text first, then word starts, then anywhere, then descriptions', () => {
    const extra = [...OPTIONS, { value: 6, label: 'Galeforce', description: 'Someone' }]

    expect(labels(filterOptions(extra, 'le'))).toEqual([
      'Les Misérables',
      'The Left Hand of Darkness',
      'Galeforce',
    ])
    expect(labels(filterOptions(OPTIONS, 'herbert'))).toEqual(['Dune'])
  })

  it('ignores case and accents', () => {
    expect(labels(filterOptions(OPTIONS, 'MISERABLES'))).toEqual(['Les Misérables'])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterOptions(OPTIONS, 'zzz')).toEqual([])
  })
})

function Controlled({ onChange = () => {}, initial = 3 }) {
  const [value, setValue] = useState(initial)
  return (
    <Combobox
      label="Item"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('Combobox', () => {
  const input = () => screen.getByRole('combobox', { name: 'Item' })
  // Just the titles. Each option also contains its description.
  const shown = () =>
    screen.queryAllByRole('option').map((option) => OPTIONS.find((o) => option.textContent.startsWith(o.label)).label)
  // By text, because the test browser splits a name around a <mark> where real browsers don't.
  const option = (title) => screen.getAllByRole('option').find((element) => element.textContent.includes(title))

  it('shows the current choice and starts closed', () => {
    render(<Controlled />)

    expect(input().value).toBe('Piranesi')
    expect(input().getAttribute('aria-expanded')).toBe('false')
    expect(shown()).toEqual([])
  })

  it('narrows the list as you type, and picks with the arrow keys and Enter', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    fireEvent.change(input(), { target: { value: 'ha' } })
    expect(input().getAttribute('aria-expanded')).toBe('true')
    expect(shown()).toEqual(['Hades', 'The Left Hand of Darkness'])
    expect(screen.getByRole('status').textContent).toBe('2 matches')

    // The first match is highlighted, and the arrow moves to the next.
    const first = screen.getAllByRole('option')[0]
    expect(input().getAttribute('aria-activedescendant')).toBe(first.id)
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(4)
    expect(input().value).toBe('The Left Hand of Darkness')
    expect(input().getAttribute('aria-expanded')).toBe('false')
  })

  it('stops the arrow keys at either end of the list', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    fireEvent.change(input(), { target: { value: 'ha' } })
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(2)

    fireEvent.change(input(), { target: { value: 'ha' } })
    for (let press = 0; press < 5; press++) fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('opens the whole list with the down arrow, starting at the current choice', () => {
    render(<Controlled />)

    fireEvent.keyDown(input(), { key: 'ArrowDown' })

    expect(shown()).toHaveLength(OPTIONS.length)
    const active = document.getElementById(input().getAttribute('aria-activedescendant'))
    expect(active.textContent).toContain('Piranesi')
    expect(screen.getByRole('img', { name: 'Current choice' })).toBeTruthy()
  })

  it('picks an option with a click', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    fireEvent.click(input())
    fireEvent.click(option('Dune'))

    expect(onChange).toHaveBeenCalledWith(1)
    expect(input().value).toBe('Dune')
  })

  it('keeps the last choice on Esc or when leaving the field', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    fireEvent.change(input(), { target: { value: 'dun' } })
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(input().value).toBe('Piranesi')
    expect(shown()).toEqual([])

    fireEvent.change(input(), { target: { value: 'dun' } })
    fireEvent.blur(input())
    expect(input().value).toBe('Piranesi')
    expect(onChange).not.toHaveBeenCalled()
  })

  it("doesn't let Esc reach a modal underneath while the list is open", () => {
    const onKeyDown = vi.fn()
    render(
      <div onKeyDown={onKeyDown}>
        <Controlled />
      </div>,
    )

    fireEvent.change(input(), { target: { value: 'dun' } })
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(onKeyDown).not.toHaveBeenCalled()

    // Closed and unchanged, Esc is left for whatever is underneath.
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })

  it('says so when nothing matches, and Enter does nothing', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    fireEvent.change(input(), { target: { value: 'zzz' } })
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(screen.getByText('No matches')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('0 matches')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks the matching part of each title', () => {
    render(<Controlled />)

    fireEvent.change(input(), { target: { value: 'ran' } })

    expect(option('Piranesi').querySelector('mark').textContent).toBe('ran')
  })
})
