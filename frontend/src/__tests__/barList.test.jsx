import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BarList } from '../components/index.js'

const ROWS = [
  { key: 'a', name: 'Hooked', value: 12, color: 'red', icon: <svg data-testid="icon" /> },
  { key: 'b', name: 'Curious', value: 3, color: 'blue' },
  { key: 'c', name: 'Bored', value: 0, color: 'gray' },
]

describe('BarList', () => {
  afterEach(cleanup)

  it('reads each row as its name and amount, in the order given', () => {
    render(<BarList label="Moods" rows={ROWS} />)
    const items = within(screen.getByRole('list', { name: 'Moods' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Hooked, 12', 'Curious, 3', 'Bored, 0'])
  })

  it('draws each bar as a share of the largest, and none for zero', () => {
    const { container } = render(<BarList label="Moods" rows={ROWS} />)
    const bars = [...container.querySelectorAll('[class*="bar"]')].filter((bar) => bar.style.width)
    expect(bars.map((bar) => bar.style.width)).toEqual(['100%', '25%'])
  })

  it('colors each row, and keeps the bars and icons from screen readers', () => {
    render(<BarList label="Moods" rows={ROWS} />)
    const [hooked] = within(screen.getByRole('list', { name: 'Moods' })).getAllByRole('listitem')
    expect(hooked.style.getPropertyValue('--bar-color')).toBe('red')
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).toBeTruthy()
  })
})
