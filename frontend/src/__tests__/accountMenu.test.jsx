import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from '../components/index.js'

afterEach(cleanup)

const button = () => screen.getByRole('button', { name: /Account menu for/ })
const signOut = () => screen.queryByRole('button', { name: 'Sign out' })

function renderMenu(props = {}) {
  const onSignOut = vi.fn()
  render(
    <>
      <AccountMenu name="Robin Reader" email="reader@example.com" settingsHref="/settings" onSignOut={onSignOut} {...props} />
      <button type="button">Elsewhere</button>
    </>,
  )
  return onSignOut
}

describe('AccountMenu', () => {
  it("names the button for whose account it is, and shows the initial", () => {
    renderMenu()
    expect(button().textContent).toMatch(/^RAccount menu for Robin Reader/)
    expect(button().getAttribute('aria-expanded')).toBe('false')
  })

  it('takes the first whole letter of the name, even one made of two code units', () => {
    renderMenu({ name: '  émile' })
    expect(button().textContent.startsWith('É')).toBe(true)
    cleanup()
    renderMenu({ name: '🐙 Octo' })
    expect(button().textContent.startsWith('🐙')).toBe(true)
  })

  it('opens to show who is signed in, settings and sign out', () => {
    renderMenu()
    expect(signOut()).toBeNull()
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('reader@example.com')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings')
    expect(signOut()).toBeTruthy()
  })

  it('points the button at the panel it opens', () => {
    renderMenu()
    fireEvent.click(button())
    const panel = document.getElementById(button().getAttribute('aria-controls'))
    expect(panel.contains(signOut())).toBe(true)
  })

  it('closes on a second press', () => {
    renderMenu()
    fireEvent.click(button())
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(signOut()).toBeNull()
  })

  it('closes on Esc, going back to the button, without closing anything underneath', () => {
    const onParentKeyDown = vi.fn()
    render(
      <div onKeyDown={onParentKeyDown}>
        <AccountMenu name="Robin Reader" onSignOut={vi.fn()} />
      </div>,
    )
    fireEvent.click(button())
    signOut().focus()
    fireEvent.keyDown(signOut(), { key: 'Escape' })
    expect(signOut()).toBeNull()
    expect(document.activeElement).toBe(button())
    expect(onParentKeyDown).not.toHaveBeenCalled()
  })

  it('closes on a click outside, but not inside', () => {
    renderMenu()
    fireEvent.click(button())
    fireEvent.mouseDown(screen.getByText('reader@example.com'))
    expect(signOut()).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(signOut()).toBeNull()
  })

  it('closes when focus moves somewhere else', () => {
    renderMenu()
    fireEvent.click(button())
    fireEvent.blur(signOut(), { relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }) })
    expect(signOut()).toBeNull()
  })

  it('stays open while focus moves within it', () => {
    renderMenu()
    fireEvent.click(button())
    fireEvent.blur(button(), { relatedTarget: screen.getByRole('link', { name: 'Settings' }) })
    expect(signOut()).toBeTruthy()
  })

  it('signs out and closes', () => {
    const onSignOut = renderMenu()
    fireEvent.click(button())
    fireEvent.click(signOut())
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(signOut()).toBeNull()
  })

  it('leaves out settings and the email when not given', () => {
    render(<AccountMenu name="Robin Reader" onSignOut={vi.fn()} />)
    fireEvent.click(button())
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull()
    expect(signOut()).toBeTruthy()
  })
})
