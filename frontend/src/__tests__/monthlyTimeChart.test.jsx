import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MonthlyTimeChart } from '../components/index.js'

const MONTHS = [
  { month: '2026-01', Book: 0, Game: 0 },
  { month: '2026-02', Book: 40, Game: 90 },
  { month: '2026-03', Book: 15, Game: 0 },
]

const renderChart = (months = MONTHS) => render(<MonthlyTimeChart months={months} label="Time logged each month" />)
const columns = () => within(screen.getByRole('list', { name: 'Time logged each month' })).getAllByRole('img')

describe('MonthlyTimeChart', () => {
  afterEach(cleanup)

  it('names each month with its amounts, so screen readers needn’t see the bars', () => {
    renderChart()

    expect(columns().map((column) => column.getAttribute('aria-label'))).toEqual([
      'January 2026: no time logged',
      'February 2026: 2h 10m, 40m reading and 1h 30m playing',
      'March 2026: 15m reading',
    ])
  })

  it('has a legend for books and games', () => {
    renderChart()
    const legend = screen.getAllByRole('list')[0]
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Books', 'Games'])
  })

  it('labels only the busiest month with its total', () => {
    const { container } = renderChart()
    // The axis has its own labels, so look in the columns.
    const list = screen.getByRole('list', { name: 'Time logged each month' })
    expect(within(list).getAllByText('2h 10m')).toHaveLength(1)
    expect(within(list).queryByText('15m')).toBeNull()
    expect(container.querySelectorAll('[class*="segment"]')).toHaveLength(3)
  })

  it('shows a month’s amounts while it’s focused or hovered, and hides them after', () => {
    const { container } = renderChart()
    const february = columns()[1]

    fireEvent.focus(february)
    const tip = container.querySelector('[class*="tooltip"]')
    expect(tip.textContent).toBe('February 20262h 10m40m reading1h 30m playing')
    // Screen readers hear the column's name, so the tooltip isn't read again.
    expect(tip.getAttribute('aria-hidden')).toBe('true')

    fireEvent.blur(february)
    expect(container.querySelector('[class*="tooltip"]')).toBeNull()

    fireEvent.pointerEnter(columns()[2])
    expect(container.querySelector('[class*="tooltip"]').textContent).toMatch(/^March 2026/)
  })

  it('shows every value as a table on request', () => {
    renderChart()
    const toggle = screen.getByRole('button', { name: 'Show as table' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('table')).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Hide table' }).getAttribute('aria-expanded')).toBe('true')
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows.map((row) => row.textContent)).toEqual([
      'MonthReadingPlayingTotal',
      'January 20260m0m0m',
      'February 202640m1h 30m2h 10m',
      'March 202615m0m15m',
    ])
  })

  it('labels only Januaries and the first month past a year of columns', () => {
    const months = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(2025, 10 + index, 1)
      return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, Book: 30, Game: 0 }
    })
    const { container } = renderChart(months)

    const labels = [...container.querySelectorAll('[class*="month"]')].map((label) => label.textContent).filter(Boolean)
    // November 2025 to December 2026: the first month, then the one January.
    expect(labels).toEqual(['Nov2025', 'Jan2026'])
  })
})
