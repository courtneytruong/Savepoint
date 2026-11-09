import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReflectionCard } from '../components/index.js'

afterEach(cleanup)

const NOTES = 'The house has tides, and I have questions.'

describe('ReflectionCard', () => {
  it("says how long a session's reflection was for, by medium", () => {
    render(<ReflectionCard medium="Book" session={{ durationMinutes: 90, pagesRead: 40 }} mood="Curious" notes={NOTES} />)
    expect(screen.getByText(/Read for 1h 30m/)).toBeTruthy()
    expect(screen.getByText(/40 pages/)).toBeTruthy()
    cleanup()

    render(<ReflectionCard medium="Game" session={{ durationMinutes: 45 }} mood="Hooked" notes={NOTES} />)
    expect(screen.getByText(/Played for 45m/)).toBeTruthy()
    expect(screen.queryByText(/pages/)).toBeNull()
  })

  it('calls a reflection without a session just that', () => {
    render(<ReflectionCard mood="Moved" notes={NOTES} />)
    expect(screen.getByText('Reflection')).toBeTruthy()
  })

  it('looks the same whatever the mood, with or without a session', () => {
    const { container } = render(
      <>
        <ReflectionCard mood="Moved" notes={NOTES} />
        <ReflectionCard mood="Delighted" session={{ durationMinutes: 30 }} notes={NOTES} />
      </>,
    )
    const [standalone, withSession] = container.querySelectorAll('article')
    expect(standalone.className).toBe(withSession.className)
    expect(standalone.getAttribute('style')).toBeNull()
  })

  it('shows the mood, notes and tags', () => {
    render(<ReflectionCard mood="Curious" notes={NOTES} tags={['worldbuilding', 'statues']} />)
    expect(screen.getByText('Curious')).toBeTruthy()
    expect(screen.getByText(NOTES)).toBeTruthy()
    const tags = screen.getByRole('list', { name: 'Tags' })
    expect(tags.textContent).toBe('#worldbuilding#statues')
  })

  it('leaves out the tags list when there are none', () => {
    render(<ReflectionCard mood="Curious" notes={NOTES} tags={[]} />)
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull()
  })

  it('names the item as a heading, linked to it, with its type and the session', () => {
    render(
      <ReflectionCard
        item={{ title: 'Outer Wilds', medium: 'Game', href: '/items/7' }}
        session={{ durationMinutes: 60 }}
        mood="Moved"
        notes={NOTES}
      />,
    )
    const heading = screen.getByRole('heading', { level: 3, name: 'Outer Wilds' })
    expect(heading.querySelector('a').getAttribute('href')).toBe('/items/7')
    expect(screen.getByText('Game')).toBeTruthy()
    expect(screen.getByText(/Played for 1h/)).toBeTruthy()
  })

  it('can use another heading level, to fit the page', () => {
    render(<ReflectionCard item={{ title: 'Dune', medium: 'Book' }} headingAs="h2" mood="Bored" notes={NOTES} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Dune' })).toBeTruthy()
  })

  it('shows the date as a machine-readable day', () => {
    render(<ReflectionCard date="2026-11-04" mood="Curious" notes={NOTES} />)
    expect(document.querySelector('time').getAttribute('datetime')).toBe('2026-11-04')
  })

  it('says when a session was logged late', () => {
    render(
      <ReflectionCard
        session={{ durationMinutes: 30 }}
        loggedOn="2026-11-05T09:00:00"
        mood="Curious"
        notes={NOTES}
      />,
    )
    expect(screen.getByText(/^Logged on/)).toBeTruthy()
  })
})
