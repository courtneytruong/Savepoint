import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { matchesSearch, SearchField } from './index.js'

afterEach(cleanup)

describe('matchesSearch', () => {
  it('matches any field, ignoring case and accents', () => {
    expect(matchesSearch(['Piranesi', 'Susanna Clarke'], 'clarke')).toBe(true)
    expect(matchesSearch(['Les Misérables', 'Victor Hugo'], 'MISERA')).toBe(true)
    expect(matchesSearch(['Dune', 'Frank Herbert'], 'hades')).toBe(false)
  })

  it('matches everything when the query is empty or blank', () => {
    expect(matchesSearch(['Dune'], '')).toBe(true)
    expect(matchesSearch(['Dune'], '  ')).toBe(true)
  })

  it('skips missing fields', () => {
    expect(matchesSearch(['Hyperion', undefined], 'hyp')).toBe(true)
    expect(matchesSearch([undefined], 'hyp')).toBe(false)
  })
})

function Controlled({ onChange = () => {}, initial = '' }) {
  const [value, setValue] = useState(initial)
  return (
    <SearchField
      label="Search your library"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('SearchField', () => {
  const input = () => screen.getByRole('searchbox', { name: 'Search your library' })

  it('is a labelled search box inside a search landmark', () => {
    render(<Controlled />)

    expect(screen.getByRole('search').contains(input())).toBe(true)
  })

  it('reports what is typed', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    fireEvent.change(input(), { target: { value: 'dune' } })

    expect(onChange).toHaveBeenCalledWith('dune')
  })

  it('shows a clear button only when there is text, and clearing puts focus back', () => {
    render(<Controlled />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()

    fireEvent.change(input(), { target: { value: 'dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(input().value).toBe('')
    expect(document.activeElement).toBe(input())
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('clears with Esc, and only keeps Esc from a modal when there was text', () => {
    const onKeyDown = vi.fn()
    render(
      <div onKeyDown={onKeyDown}>
        <Controlled initial="dune" />
      </div>,
    )

    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(input().value).toBe('')
    expect(onKeyDown).not.toHaveBeenCalled()

    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})
