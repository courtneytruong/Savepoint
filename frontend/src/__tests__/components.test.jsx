import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  FilterGroup,
  FilterPill,
  Footer,
  formatDuration,
  GlowFrame,
  Header,
  Heading,
  Hero,
  Input,
  ItemCard,
  ItemGrid,
  Modal,
  monthWeeks,
  MoodBadge,
  MoodPicker,
  MOODS,
  moodFor,
  nextSort,
  pageAfterResize,
  pageRange,
  paginate,
  Pagination,
  parseDateKey,
  Rating,
  sortRows,
  Select,
  SessionCalendar,
  Sidebar,
  SidebarGroup,
  SidebarLink,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Spinner,
  StatGroup,
  StatTile,
  StatusBadge,
  Table,
  Textarea,
  toDateKey,
  ToastProvider,
  Tooltip,
  useStoredChoice,
  useStoredView,
  useToast,
  ViewToggle,
  weekdayNames,
} from '../components/index.js'

afterEach(cleanup)

describe('Table', () => {
  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'rating', header: 'Rating', render: (row) => `${row.rating}/10` },
  ]
  const rows = [{ id: 1, title: 'Dune', rating: 7 }]

  it('shows headers, plain values and rendered values', () => {
    render(<Table caption="Library" columns={columns} rows={rows} />)

    expect(screen.getByRole('table', { name: 'Library' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Rating' }).getAttribute('scope')).toBe('col')
    expect(screen.getByRole('cell', { name: 'Dune' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '7/10' })).toBeTruthy()
  })

  it('shows the empty state instead of a table with no rows', () => {
    render(<Table columns={columns} rows={[]} empty={<p>Nothing here</p>} />)

    expect(screen.getByText('Nothing here')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('announces loading and shows placeholder rows, not the empty state', () => {
    render(<Table caption="items" columns={columns} rows={[]} loading loadingRows={2} empty={<p>Nothing here</p>} />)

    expect(screen.getByRole('status').textContent).toBe('Loading items')
    expect(screen.getByRole('table', { busy: true })).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.queryByText('Nothing here')).toBeNull()
  })
})

describe('Button', () => {
  it('styles danger differently from primary', () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="danger">Remove</Button>
      </>,
    )

    expect(screen.getByRole('button', { name: 'Remove' }).className).not.toBe(
      screen.getByRole('button', { name: 'Save' }).className,
    )
  })
})

describe('sortRows', () => {
  const columns = [
    { key: 'title' },
    { key: 'rating' },
    { key: 'status', sortValue: (row) => ['Backlog', 'Finished'].indexOf(row.status) },
  ]
  const rows = [
    { title: 'item 10', rating: 7, status: 'Finished' },
    { title: 'Item 2', rating: undefined, status: 'Backlog' },
    { title: 'apple', rating: 10, status: 'Finished' },
  ]
  const titles = (sorted) => sorted.map((row) => row.title)

  it('sorts text ignoring case, and numbers within text by value', () => {
    expect(titles(sortRows(rows, columns, { key: 'title', direction: 'ascending' }))).toEqual([
      'apple',
      'Item 2',
      'item 10',
    ])
  })

  it('sorts numbers by value, both ways, with missing values last either way', () => {
    expect(titles(sortRows(rows, columns, { key: 'rating', direction: 'ascending' }))).toEqual([
      'item 10',
      'apple',
      'Item 2',
    ])
    expect(titles(sortRows(rows, columns, { key: 'rating', direction: 'descending' }))).toEqual([
      'apple',
      'item 10',
      'Item 2',
    ])
  })

  it('uses a column’s sortValue, and keeps the original order for ties', () => {
    expect(titles(sortRows(rows, columns, { key: 'status', direction: 'ascending' }))).toEqual([
      'Item 2',
      'item 10',
      'apple',
    ])
  })

  it('leaves the rows alone with no sort, and never changes the original list', () => {
    const copy = [...rows]
    sortRows(rows, columns, { key: 'title', direction: 'descending' })

    expect(sortRows(rows, columns, null)).toBe(rows)
    expect(rows).toEqual(copy)
  })
})

describe('nextSort', () => {
  it('starts a column in its first direction, and reverses on the next click', () => {
    const title = { key: 'title' }
    const rating = { key: 'rating', sortFirst: 'descending' }

    expect(nextSort(null, title)).toEqual({ key: 'title', direction: 'ascending' })
    expect(nextSort({ key: 'title', direction: 'ascending' }, title)).toEqual({ key: 'title', direction: 'descending' })
    expect(nextSort({ key: 'title', direction: 'ascending' }, rating)).toEqual({
      key: 'rating',
      direction: 'descending',
    })
  })
})

describe('Table sorting', () => {
  const columns = [
    { key: 'title', header: 'Title', sortable: true },
    { key: 'creator', header: 'Creator' },
  ]
  const rows = [
    { id: 1, title: 'Dune', creator: 'Frank Herbert' },
    { id: 2, title: 'Piranesi', creator: 'Susanna Clarke' },
    { id: 3, title: 'Celeste', creator: 'Maddy Makes Games' },
  ]
  const firstColumn = () => screen.getAllByRole('row').slice(1).map((row) => row.firstChild.textContent)

  it('sorts by a header click, and tells screen readers the direction', () => {
    render(<Table columns={columns} rows={rows} />)
    const header = screen.getByRole('columnheader', { name: 'Title' })
    expect(header.getAttribute('aria-sort')).toBeNull()
    expect(firstColumn()).toEqual(['Dune', 'Piranesi', 'Celeste'])

    fireEvent.click(screen.getByRole('button', { name: 'Title' }))
    expect(header.getAttribute('aria-sort')).toBe('ascending')
    expect(firstColumn()).toEqual(['Celeste', 'Dune', 'Piranesi'])

    fireEvent.click(screen.getByRole('button', { name: 'Title' }))
    expect(header.getAttribute('aria-sort')).toBe('descending')
    expect(firstColumn()).toEqual(['Piranesi', 'Dune', 'Celeste'])
  })

  it('only gives sortable columns a button', () => {
    render(<Table columns={columns} rows={rows} />)

    expect(screen.queryByRole('button', { name: 'Creator' })).toBeNull()
  })

  it('lets the page control the sort, and shows rows in the order given', () => {
    const onSortChange = vi.fn()
    render(
      <Table
        columns={columns}
        rows={rows}
        sort={{ key: 'title', direction: 'descending' }}
        onSortChange={onSortChange}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Title' }).getAttribute('aria-sort')).toBe('descending')
    expect(firstColumn()).toEqual(['Dune', 'Piranesi', 'Celeste'])

    fireEvent.click(screen.getByRole('button', { name: 'Title' }))

    expect(onSortChange).toHaveBeenCalledWith({ key: 'title', direction: 'ascending' })
  })
})

describe('paginate', () => {
  const rows = Array.from({ length: 11 }, (_, index) => index + 1)

  it('gives the rows and range for a page', () => {
    expect(paginate(rows, 2, 5)).toEqual({ pageRows: [6, 7, 8, 9, 10], page: 2, pageCount: 3, first: 6, last: 10, total: 11 })
    expect(paginate(rows, 3, 5)).toMatchObject({ pageRows: [11], first: 11, last: 11 })
  })

  it('moves back into range when the rows shrink', () => {
    expect(paginate(rows.slice(0, 4), 3, 5)).toMatchObject({ page: 1, pageCount: 1, pageRows: [1, 2, 3, 4] })
  })

  it('has one empty page for no rows', () => {
    expect(paginate([], 1, 5)).toEqual({ pageRows: [], page: 1, pageCount: 1, first: 0, last: 0, total: 0 })
  })
})

describe('pageRange', () => {
  it.each([
    [1, 1, [1]],
    [3, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 24, [1, 2, 3, 4, 5, 'gap', 24]],
    [7, 24, [1, 'gap', 6, 7, 8, 'gap', 24]],
    [4, 24, [1, 2, 3, 4, 5, 'gap', 24]],
    [24, 24, [1, 'gap', 20, 21, 22, 23, 24]],
  ])('on page %i of %i, shows %j', (page, pageCount, expected) => {
    expect(pageRange(page, pageCount)).toEqual(expected)
  })
})

describe('Pagination', () => {
  it('shows nothing when everything fits on one page', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />)

    expect(container.innerHTML).toBe('')
  })

  it('marks the current page, describes the range, and changes page', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} pageCount={3} first={6} last={10} total={11} onPageChange={onPageChange} />)

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('6–10 of 11').getAttribute('aria-live')).toBe('polite')
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(onPageChange.mock.calls).toEqual([[3], [1], [3]])
  })

  it('turns off previous on the first page and next on the last', () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(false)

    rerender(<Pagination page={3} pageCount={3} onPageChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true)
  })
})

describe('Tooltip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const renderTooltip = (props) =>
    render(
      <Tooltip content="Grid view" {...props}>
        <button type="button" aria-describedby="existing">
          Grid
        </button>
      </Tooltip>,
    )
  const tooltip = () => screen.getByRole('tooltip', { hidden: true })

  it('describes its trigger, keeping any existing description', () => {
    renderTooltip()

    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(`existing ${tooltip().id}`)
    expect(tooltip().textContent).toBe('Grid view')
  })

  it('is not read out twice when it repeats an icon button’s label', () => {
    render(
      <Tooltip content="Settings">
        <button type="button" aria-label="Settings" />
      </Tooltip>,
    )

    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-describedby')).toBeNull()
  })

  it('opens on focus straight away, and closes on blur', () => {
    renderTooltip()

    act(() => {
      fireEvent.focus(screen.getByRole('button'))
      vi.runAllTimers()
    })
    expect(tooltip().dataset.open).toBe('true')

    act(() => {
      fireEvent.blur(screen.getByRole('button'))
      vi.runAllTimers()
    })
    expect(tooltip().dataset.open).toBeUndefined()
  })

  it('waits before opening on hover, so passing over it does nothing', () => {
    renderTooltip()
    const trigger = screen.getByRole('button').parentElement

    act(() => {
      fireEvent.pointerEnter(trigger)
      vi.advanceTimersByTime(299)
    })
    expect(tooltip().dataset.open).toBeUndefined()

    act(() => vi.advanceTimersByTime(1))
    expect(tooltip().dataset.open).toBe('true')
  })

  it('stays open while the pointer crosses the gap onto it', () => {
    renderTooltip()
    const trigger = screen.getByRole('button').parentElement
    act(() => {
      fireEvent.pointerEnter(trigger)
      vi.advanceTimersByTime(300)
    })

    act(() => {
      fireEvent.pointerLeave(trigger)
      vi.advanceTimersByTime(100)
    })
    expect(tooltip().dataset.open).toBe('true')

    act(() => {
      fireEvent.pointerEnter(trigger)
      vi.runAllTimers()
    })
    expect(tooltip().dataset.open).toBe('true')
  })

  it('closes after the pointer has been away a moment', () => {
    renderTooltip()
    const trigger = screen.getByRole('button').parentElement
    act(() => {
      fireEvent.pointerEnter(trigger)
      vi.advanceTimersByTime(300)
      fireEvent.pointerLeave(trigger)
      vi.advanceTimersByTime(150)
    })

    expect(tooltip().dataset.open).toBeUndefined()
  })

  it('closes on Esc without letting the key reach anything else', () => {
    const onKeyDown = vi.fn()
    document.addEventListener('keydown', onKeyDown)
    renderTooltip()
    act(() => {
      fireEvent.focus(screen.getByRole('button'))
      vi.runAllTimers()
    })

    act(() => {
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' })
    })

    expect(tooltip().dataset.open).toBeUndefined()
    expect(onKeyDown).not.toHaveBeenCalled()
    document.removeEventListener('keydown', onKeyDown)
  })
})

describe('calendar dates', () => {
  const days = (week) => week.map((date) => date && date.getDate())

  it('lays out a month in weeks, starting on the chosen weekday', () => {
    // 1 November 2026 is a Sunday.
    const sundayStart = monthWeeks(new Date(2026, 10, 1), 0)
    expect(days(sundayStart[0])).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(sundayStart).toHaveLength(5)
    expect(days(sundayStart[4])).toEqual([29, 30, null, null, null, null, null])

    const mondayStart = monthWeeks(new Date(2026, 10, 1), 1)
    expect(days(mondayStart[0])).toEqual([null, null, null, null, null, null, 1])
    expect(mondayStart).toHaveLength(6)
  })

  it('fits February 2026 into exactly four weeks', () => {
    const weeks = monthWeeks(new Date(2026, 1, 1), 0)

    expect(weeks).toHaveLength(4)
    expect(weeks.flat().every(Boolean)).toBe(true)
  })

  it('reads and writes dates as local days, with no time zone shift', () => {
    const date = parseDateKey('2026-03-01')

    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 1])
    expect(toDateKey(date)).toBe('2026-03-01')
  })

  it('names the weekdays from the chosen start', () => {
    expect(weekdayNames(1)[0]).toBe(weekdayNames(0)[1])
    expect(weekdayNames(1)).toHaveLength(7)
  })

  it.each([
    [45, '45m'],
    [60, '1h'],
    [90, '1h 30m'],
    [125, '2h 5m'],
  ])('writes %i minutes as %s', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })
})

describe('SessionCalendar', () => {
  const today = new Date(2026, 10, 15)
  const session = (id, date, itemTitle, durationMinutes, mood) => ({
    id,
    date,
    itemTitle,
    medium: 'Book',
    durationMinutes,
    mood,
    notes: `Notes for ${itemTitle}`,
  })
  const sessions = [
    session(1, '2026-11-15', 'Dune', 60, 'Curious'),
    session(2, '2026-11-15', 'Piranesi', 30, 'Moved'),
    session(3, '2026-11-03', 'Middlemarch', 45, 'Bored'),
    session(4, '2026-10-30', 'Hyperion', 20, 'Hooked'),
    session(5, '2026-11-20', 'Future', 20, 'Hooked'),
  ]
  const renderCalendar = () => render(<SessionCalendar sessions={sessions} today={today} weekStartsOn={0} />)
  const dayButtons = () => screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.hasAttribute('aria-pressed'))

  it('makes only days with sessions into buttons, each describing the day', () => {
    renderCalendar()

    expect(dayButtons()).toHaveLength(3)
    const fifteenth = dayButtons().find((button) => button.textContent.startsWith('15'))
    expect(fifteenth.getAttribute('aria-label')).toContain('2 sessions, 1h 30m. Curious, Moved')
  })

  it('marks today, whether or not it has sessions', () => {
    renderCalendar()

    expect(document.querySelector('[aria-current="date"]').textContent).toMatch(/^15/)
  })

  it('opens on the latest day up to today, not a later one', () => {
    renderCalendar()

    expect(screen.getByText('Dune')).toBeTruthy()
    expect(screen.getByText('Piranesi')).toBeTruthy()
    expect(screen.queryByText('Future')).toBeNull()
  })

  it('lists a chosen day’s sessions with their mood, length and notes', () => {
    renderCalendar()

    fireEvent.click(dayButtons().find((button) => button.textContent.startsWith('3')))
    const detail = within(screen.getByRole('region', { name: 'Selected day' }))

    expect(detail.getByText('Middlemarch')).toBeTruthy()
    expect(detail.getByText('45m')).toBeTruthy()
    expect(detail.getByText('Bored')).toBeTruthy()
    expect(detail.getByText('Notes for Middlemarch')).toBeTruthy()
    expect(detail.queryByText('Dune')).toBeNull()
  })

  it('moves between months', () => {
    renderCalendar()
    const title = () => screen.getByRole('heading', { level: 3 }).textContent

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(title()).toBe(new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(2026, 9, 1)))
    expect(screen.getByText('Hyperion')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'Nothing logged this month' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('Dune')).toBeTruthy()
  })
})

describe('Moods', () => {
  it('gives every mood its own color', () => {
    expect(new Set(MOODS.map((mood) => mood.color)).size).toBe(MOODS.length)
  })

  it('shows a mood badge in its color, with a hidden icon', () => {
    render(<MoodBadge mood="Moved" />)
    const badge = screen.getByText('Moved')

    expect(badge.style.getPropertyValue('--mood-color')).toBe(moodFor('Moved').color)
    expect(badge.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })

  it('offers each mood as a radio button in a labelled group', () => {
    render(<MoodPicker defaultValue="Curious" />)

    expect(screen.getByRole('group', { name: 'Mood' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(screen.getByRole('radio', { name: 'Curious' }).checked).toBe(true)
  })

  it('reports the chosen mood when controlled', () => {
    const onChange = vi.fn()
    render(<MoodPicker value="Bored" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Hooked' }))

    expect(onChange).toHaveBeenCalledWith('Hooked')
  })

  it('colors a filter pill when given a color', () => {
    render(<FilterPill color="var(--color-mood-moved)">Moved</FilterPill>)

    expect(screen.getByRole('button').style.getPropertyValue('--pill-color')).toBe('var(--color-mood-moved)')
  })
})

describe('Footer', () => {
  it('is the page’s footer, with its own labelled navigation', () => {
    render(
      <Footer brand="Savepoint" note="A journal." bottom="Version 0.1">
        <a href="#library">Library</a>
      </Footer>,
    )

    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Footer' })).toBeTruthy()
    expect(screen.getByText('Version 0.1')).toBeTruthy()
  })
})

describe('Pagination page size', () => {
  const props = { page: 1, onPageChange: () => {}, first: 1, last: 6, pageSize: 12, pageSizeOptions: [6, 12, 24] }

  it('lets people choose how many show, as numbers', () => {
    const onPageSizeChange = vi.fn()
    render(<Pagination {...props} pageCount={2} total={20} onPageSizeChange={onPageSizeChange} />)

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: '24' } })

    expect(onPageSizeChange).toHaveBeenCalledWith(24)
  })

  it('stays when everything fits on one page but a smaller size would split it', () => {
    render(<Pagination {...props} pageCount={1} total={10} onPageSizeChange={() => {}} />)

    expect(screen.getByLabelText('Show')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
  })

  it('goes away when even the smallest size fits everything', () => {
    const { container } = render(<Pagination {...props} pageCount={1} total={5} onPageSizeChange={() => {}} />)

    expect(container.innerHTML).toBe('')
  })

  it('keeps the first item in view after resizing', () => {
    expect(pageAfterResize(13, 6)).toBe(3)
    expect(pageAfterResize(13, 12)).toBe(2)
    expect(pageAfterResize(13, 24)).toBe(1)
    expect(pageAfterResize(0, 6)).toBe(1)
  })
})

describe('useStoredChoice', () => {
  beforeEach(() => window.localStorage.clear())

  it('remembers a number and gives it back as a number', () => {
    const { result, unmount } = renderHook(() => useStoredChoice('test.size', [6, 12], 6))
    act(() => result.current[1](12))
    unmount()

    const { result: nextVisit } = renderHook(() => useStoredChoice('test.size', [6, 12], 6))

    expect(nextVisit.current[0]).toBe(12)
  })
})

describe('Sidebar', () => {
  it('marks only the active link as the current page', () => {
    render(
      <Sidebar>
        <SidebarGroup title="Browse">
          <SidebarLink href="#library" active count={7}>
            Library
          </SidebarLink>
          <SidebarLink href="#timeline">Timeline</SidebarLink>
        </SidebarGroup>
      </Sidebar>,
    )

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Library/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Timeline' }).getAttribute('aria-current')).toBeNull()
  })

  it('keeps a link and its count apart for screen readers', () => {
    render(
      <SidebarLink href="#library" count={11}>
        Library
      </SidebarLink>,
    )

    expect(screen.getByRole('link', { name: /^Library\s*,\s*11$/ })).toBeTruthy()
  })
})

describe('FilterPill', () => {
  it('reports whether it is on, and responds to clicks', () => {
    const onClick = vi.fn()
    render(
      <FilterGroup label="Filter by status">
        <FilterPill selected>Finished</FilterPill>
        <FilterPill onClick={onClick}>Dropped</FilterPill>
      </FilterGroup>,
    )

    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finished' }).getAttribute('aria-pressed')).toBe('true')
    const off = screen.getByRole('button', { name: 'Dropped' })
    expect(off.getAttribute('aria-pressed')).toBe('false')
    expect(off.getAttribute('type')).toBe('button')
    fireEvent.click(off)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows a count of zero as a count', () => {
    render(<FilterPill count={0}>Dropped</FilterPill>)

    expect(screen.getByText('0').tagName).toBe('SPAN')
  })

  // The exact spacing around the comma varies between browsers; the pause is what matters.
  it('keeps the label and count apart for screen readers', () => {
    render(<FilterPill count={5}>Moved</FilterPill>)

    expect(screen.getByRole('button', { name: /^Moved\s*,\s*5$/ })).toBeTruthy()
  })

  it('adds nothing to the name without a count', () => {
    render(<FilterPill>Moved</FilterPill>)

    expect(screen.getByRole('button', { name: 'Moved' })).toBeTruthy()
  })
})

describe('StatTile', () => {
  it('ties each label to its value', () => {
    const { container } = render(
      <StatGroup>
        <StatTile label="Reflections" value="96" hint="Most often: Curious" />
      </StatGroup>,
    )

    expect(container.querySelector('dl dt').textContent).toBe('Reflections')
    expect(container.querySelector('dl dd').textContent).toBe('96')
  })
})

describe('Divider', () => {
  it('is a separator, and says when it is vertical', () => {
    render(
      <>
        <Divider />
        <Divider orientation="vertical" />
      </>,
    )
    const [horizontal, vertical] = screen.getAllByRole('separator')

    expect(horizontal.getAttribute('aria-orientation')).toBeNull()
    expect(vertical.getAttribute('aria-orientation')).toBe('vertical')
  })
})

describe('StatusBadge colors', () => {
  it('gives Dropped its own color, not the warning one', () => {
    render(
      <>
        <StatusBadge status="Dropped" />
        <Badge tone="warning">Warning</Badge>
      </>,
    )

    expect(screen.getByText('Dropped').className).not.toBe(screen.getByText('Warning').className)
  })
})

describe('StatusBadge', () => {
  it.each([
    ['Backlog', 'Backlog'],
    ['InProgress', 'In progress'],
    ['Finished', 'Finished'],
    ['Dropped', 'Dropped'],
  ])('shows %s as "%s"', (status, label) => {
    render(<StatusBadge status={status} />)

    expect(screen.getByText(label)).toBeTruthy()
  })
})

describe('ItemCard', () => {
  it('shows the item, with its title as the link to it', () => {
    render(
      <ItemGrid>
        <ItemCard
          href="/items/1"
          title="Piranesi"
          creator="Susanna Clarke"
          medium="Book"
          status="Finished"
          mood="Curious"
          rating={8}
          excerpt="I had no idea what was going on."
        />
      </ItemGrid>,
    )

    expect(screen.getByRole('listitem')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Piranesi' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Piranesi' }).getAttribute('href')).toBe('/items/1')
    expect(screen.getByText('Susanna Clarke')).toBeTruthy()
    expect(screen.getByText('Curious')).toBeTruthy()
    expect(screen.getByText('I had no idea what was going on.')).toBeTruthy()
  })

  it('works for an item with no mood, rating or reflection yet', () => {
    render(<ItemCard href="/items/2" title="Disco Elysium" medium="Game" status="Backlog" />)

    expect(screen.getByRole('link', { name: 'Disco Elysium' })).toBeTruthy()
    expect(screen.queryByText('/10')).toBeNull()
  })

  it('shows a rating out of 10', () => {
    const { container } = render(<Rating value={9} />)

    expect(container.textContent).toBe('9/10')
  })
})

describe('ViewToggle', () => {
  it('labels its icon buttons, marks the current view, and reports changes', () => {
    const onChange = vi.fn()
    render(<ViewToggle value="list" onChange={onChange} />)
    const list = screen.getByRole('button', { name: 'List view' })
    const grid = screen.getByRole('button', { name: 'Grid view' })

    expect(list.getAttribute('aria-pressed')).toBe('true')
    expect(grid.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(grid)
    expect(onChange).toHaveBeenCalledWith('grid')
  })
})

describe('useStoredView', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('starts on the list view', () => {
    const { result } = renderHook(() => useStoredView())

    expect(result.current[0]).toBe('list')
  })

  it('remembers the choice for the next visit', () => {
    const { result, unmount } = renderHook(() => useStoredView())
    act(() => result.current[1]('grid'))
    expect(result.current[0]).toBe('grid')
    unmount()

    const { result: nextVisit } = renderHook(() => useStoredView())

    expect(nextVisit.current[0]).toBe('grid')
  })

  it('ignores a stored value it does not recognise', () => {
    window.localStorage.setItem('savepoint.library.view', 'carousel')
    const { result } = renderHook(() => useStoredView())

    expect(result.current[0]).toBe('list')
  })

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useStoredView())
    expect(result.current[0]).toBe('list')

    act(() => result.current[1]('grid'))

    expect(result.current[0]).toBe('grid')
  })
})

describe('Modal', () => {
  const dialog = () => document.querySelector('dialog')

  it('is named by its title and described by its description when open', () => {
    render(
      <Modal open onClose={() => {}} title="Add item" description="Add a book or game.">
        <p>Form</p>
      </Modal>,
    )

    expect(document.getElementById(dialog().getAttribute('aria-labelledby')).textContent).toBe('Add item')
    expect(document.getElementById(dialog().getAttribute('aria-describedby')).textContent).toBe('Add a book or game.')
    expect(dialog().open).toBe(true)
    expect(screen.getByText('Form')).toBeTruthy()
  })

  it('has no content while closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Add item">
        <p>Form</p>
      </Modal>,
    )

    expect(dialog().open).toBe(false)
    expect(screen.queryByText('Form')).toBeNull()
  })

  it('closes when the open prop turns off', () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="Add item" />)
    expect(dialog().open).toBe(true)

    rerender(<Modal open={false} onClose={() => {}} title="Add item" />)

    expect(dialog().open).toBe(false)
  })

  it('asks to close from the X, Esc, and a click on the backdrop', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Add item" />)

    fireEvent.click(screen.getByText('Add item').closest('div').parentElement.querySelector('button'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent(dialog(), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.mouseDown(dialog())
    fireEvent.click(dialog())
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays open when a text selection drag ends on the backdrop', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Add item" />)

    fireEvent.mouseDown(screen.getByText('Add item'))
    fireEvent.click(dialog())

    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open on a click inside it', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Add item" />)

    fireEvent.mouseDown(screen.getByText('Add item'))
    fireEvent.click(screen.getByText('Add item'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('cannot be closed by accident when not dismissible', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Write a reflection" dismissible={false} />)

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    const esc = new Event('cancel', { cancelable: true })
    fireEvent(dialog(), esc)
    fireEvent.mouseDown(dialog())
    fireEvent.click(dialog())

    expect(esc.defaultPrevented).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('focuses the requested element on opening', () => {
    const ref = { current: null }
    render(
      <Modal open onClose={() => {}} title="Add item" initialFocusRef={ref}>
        <input ref={ref} aria-label="Title" />
      </Modal>,
    )

    expect(document.activeElement).toBe(screen.getByLabelText('Title'))
  })
})

describe('Toast', () => {
  let toast

  function Capture() {
    toast = useToast()
    return null
  }

  function renderProvider() {
    render(
      <ToastProvider>
        <Capture />
      </ToastProvider>,
    )
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('has a live region on the page before any toast appears', () => {
    renderProvider()

    expect(screen.getByRole('region', { name: 'Notifications' }).getAttribute('aria-live')).toBe('polite')
  })

  it('shows a toast, then removes it after its time', () => {
    renderProvider()
    act(() => {
      toast.show({ title: 'Saved', description: 'Added to the timeline.' })
    })
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.getByText('Added to the timeline.')).toBeTruthy()

    act(() => vi.advanceTimersByTime(4999))
    expect(screen.queryByText('Saved')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('keeps errors until dismissed, and announces them right away', () => {
    renderProvider()
    act(() => {
      toast.show({ tone: 'error', title: "Couldn't save" })
    })
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.getByRole('alert').textContent).toContain("Couldn't save")

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('waits while hovered, and starts again afterwards', () => {
    renderProvider()
    act(() => {
      toast.show({ title: 'Saved' })
    })
    const item = screen.getByText('Saved').closest('div').parentElement

    fireEvent.mouseEnter(item)
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.queryByText('Saved')).toBeTruthy()

    fireEvent.mouseLeave(item)
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('runs its action, then goes away', () => {
    const undo = vi.fn()
    renderProvider()
    act(() => {
      toast.show({ title: 'Removed', action: { label: 'Undo', onClick: undo } })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(undo).toHaveBeenCalledOnce()
    expect(screen.queryByText('Removed')).toBeNull()
  })

  it('shows the four newest at most', () => {
    renderProvider()
    act(() => {
      for (const title of ['One', 'Two', 'Three', 'Four', 'Five']) toast.show({ title })
    })

    expect(screen.queryByText('One')).toBeNull()
    expect(screen.getByText('Five')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(4)
  })

  it('explains the problem when used without a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useToast())).toThrow('useToast needs a ToastProvider')

    vi.restoreAllMocks()
  })
})

describe('Button', () => {
  it('does not submit a form unless asked to', () => {
    render(<Button>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button')
  })

  it('can be a submit button', () => {
    render(<Button type="submit">Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit')
  })

  it('renders a link when given an href', () => {
    render(<Button href="/library">Library</Button>)

    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('href')).toBe('/library')
  })
})

describe.each([
  ['Input', Input],
  ['Textarea', Textarea],
  ['Select', Select],
])('%s', (_name, Control) => {
  it('is connected to its label', () => {
    render(<Control label="Title" />)

    expect(screen.getByLabelText('Title')).toBeTruthy()
  })

  it('is not marked as invalid or described without a hint or error', () => {
    render(<Control label="Title" />)
    const control = screen.getByLabelText('Title')

    expect(control.getAttribute('aria-invalid')).toBeNull()
    expect(control.getAttribute('aria-describedby')).toBeNull()
  })

  it('is described by its hint and error, and marked as invalid', () => {
    render(<Control label="Title" hint="Use the full title" error="Title is required" />)
    const control = screen.getByLabelText('Title')
    const describedBy = control
      .getAttribute('aria-describedby')
      .split(' ')
      .map((id) => document.getElementById(id).textContent)

    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(describedBy).toEqual(['Use the full title', 'Title is required'])
  })
})

describe('Field', () => {
  it('gives each control its own connection when labels repeat', () => {
    render(
      <>
        <Input label="Title" />
        <Input label="Title" />
      </>,
    )
    const [first, second] = screen.getAllByLabelText('Title')

    expect(first.id).not.toBe(second.id)
  })

  it('passes attributes on to the control', () => {
    render(<Input label="Title" name="title" required />)
    const control = screen.getByLabelText('Title')

    expect(control.getAttribute('name')).toBe('title')
    expect(control.required).toBe(true)
  })
})

describe('Heading', () => {
  it('keeps its level separate from its size', () => {
    render(
      <Heading as="h1" size="small">
        Library
      </Heading>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeTruthy()
  })
})

describe('Card', () => {
  it('can render as another element', () => {
    render(<Card as="article">Review</Card>)

    expect(screen.getByRole('article').textContent).toBe('Review')
  })
})

describe('Badge', () => {
  it('uses a different style for each tone', () => {
    render(
      <>
        <Badge>Accent</Badge>
        <Badge tone="success">Success</Badge>
      </>,
    )

    expect(screen.getByText('Accent').className).not.toBe(screen.getByText('Success').className)
  })
})

describe('Skeleton', () => {
  it('is hidden from screen readers', () => {
    render(<Skeleton data-testid="shape" />)

    expect(screen.getByTestId('shape').getAttribute('aria-hidden')).toBe('true')
  })

  it('takes a size', () => {
    render(<Skeleton data-testid="shape" width="40%" height="24px" />)

    expect(screen.getByTestId('shape').style.width).toBe('40%')
    expect(screen.getByTestId('shape').style.height).toBe('24px')
  })

  it('announces what is loading through its group', () => {
    render(
      <SkeletonGroup label="Loading items">
        <Skeleton />
      </SkeletonGroup>,
    )
    const group = screen.getByRole('status', { name: 'Loading items' })

    expect(group.getAttribute('aria-busy')).toBe('true')
  })

  it('draws the requested number of text lines', () => {
    const { container } = render(<SkeletonText lines={4} />)

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4)
  })
})

describe('Spinner', () => {
  it('announces its label', () => {
    render(<Spinner label="Loading your library" />)

    expect(screen.getByRole('status').textContent).toBe('Loading your library')
  })

  it('says loading by default', () => {
    render(<Spinner />)

    expect(screen.getByRole('status').textContent).toBe('Loading')
  })
})

describe('EmptyState', () => {
  it('shows its title, description and action', () => {
    render(
      <EmptyState title="Your library is empty" action={<Button>Add item</Button>}>
        Add a book or game.
      </EmptyState>,
    )

    expect(screen.getByRole('heading', { name: 'Your library is empty' })).toBeTruthy()
    expect(screen.getByText('Add a book or game.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add item' })).toBeTruthy()
  })

  it('can set the level of its title', () => {
    render(<EmptyState title="No reflections yet" headingAs="h3" />)

    expect(screen.getByRole('heading', { level: 3, name: 'No reflections yet' })).toBeTruthy()
  })

  it('hides its decorative icon from screen readers', () => {
    render(<EmptyState title="Empty" icon={<svg data-testid="icon" />} />)

    expect(screen.getByTestId('icon').parentElement.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('GlowFrame', () => {
  it('hides its decorative light from screen readers', () => {
    const { container } = render(<GlowFrame>Library</GlowFrame>)

    expect(container.querySelector('svg').closest('[aria-hidden="true"]')).toBeTruthy()
  })

  it('shows its content', () => {
    render(<GlowFrame>Library</GlowFrame>)

    expect(screen.getByText('Library')).toBeTruthy()
  })
})

describe('Hero', () => {
  it('shows its intro and panel', () => {
    render(<Hero panel={<p>Panel</p>}>Intro</Hero>)

    expect(screen.getByText('Intro')).toBeTruthy()
    expect(screen.getByText('Panel')).toBeTruthy()
  })
})

describe('Header', () => {
  it('only has navigation when given links', () => {
    render(<Header brand="Savepoint" />)

    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('labels its navigation', () => {
    render(
      <Header brand="Savepoint">
        <a href="/library">Library</a>
      </Header>,
    )

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
  })
})
