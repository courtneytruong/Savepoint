import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Alert, AuthLayout, Button, PasswordField } from './index.js'

afterEach(cleanup)

describe('PasswordField', () => {
  const field = () => screen.getByLabelText('Password')
  const toggle = () => screen.getByRole('button', { name: 'Show password' })

  it('hides the password until shown', () => {
    render(<PasswordField label="Password" />)
    expect(field().getAttribute('type')).toBe('password')
    expect(toggle().getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle())
    expect(field().getAttribute('type')).toBe('text')
    expect(toggle().getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle())
    expect(field().getAttribute('type')).toBe('password')
  })

  it("doesn't submit the form when showing the password", () => {
    const onSubmit = vi.fn((event) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label="Password" />
      </form>,
    )
    fireEvent.click(toggle())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('tells password managers what it is', () => {
    render(
      <>
        <PasswordField label="Password" />
        <PasswordField label="New password" autoComplete="new-password" />
      </>,
    )
    expect(field().getAttribute('autocomplete')).toBe('current-password')
    expect(screen.getByLabelText('New password').getAttribute('autocomplete')).toBe('new-password')
  })

  it("keeps a shown password out of spell check and auto-capitals", () => {
    render(<PasswordField label="Password" />)
    fireEvent.click(toggle())
    expect(field().getAttribute('spellcheck')).toBe('false')
    expect(field().getAttribute('autocapitalize')).toBe('none')
  })

  it('shows its error like any field', () => {
    render(<PasswordField label="Password" error="That password is wrong." />)
    expect(field().getAttribute('aria-invalid')).toBe('true')
    const error = document.getElementById(field().getAttribute('aria-describedby'))
    expect(error.textContent).toBe('That password is wrong.')
  })

  it('points the button at the field it shows', () => {
    render(<PasswordField label="Password" />)
    expect(toggle().getAttribute('aria-controls')).toBe(field().id)
  })
})

describe('Alert', () => {
  it('announces an error straight away, and other tones politely', () => {
    render(
      <>
        <Alert tone="error" title="No account uses that email" />
        <Alert tone="success" title="Account created" />
      </>,
    )
    expect(screen.getByRole('alert').textContent).toBe('No account uses that email')
    expect(screen.getByRole('status').textContent).toBe('Account created')
  })

  it('shows a title and a body', () => {
    render(
      <Alert tone="warning" title="You're offline">
        Your changes will be saved later.
      </Alert>,
    )
    expect(screen.getByText("You're offline")).toBeTruthy()
    expect(screen.getByText('Your changes will be saved later.')).toBeTruthy()
  })

  it('can take focus, so a form can move to it after a failed submit', () => {
    const ref = createRef()
    render(<Alert ref={ref} tabIndex={-1} tone="error" title="That password is wrong." />)
    ref.current.focus()
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })
})

describe('Button loading', () => {
  it('ignores presses while loading, and says so', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Signing in…
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Signing in…' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("doesn't submit its form a second time while loading", () => {
    const onSubmit = vi.fn((event) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Signing in…
        </Button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('stays focusable, so keyboard users keep their place', () => {
    render(<Button loading>Signing in…</Button>)
    const button = screen.getByRole('button')
    expect(button.disabled).toBe(false)
    button.focus()
    expect(document.activeElement).toBe(button)
  })

  it('works normally when not loading', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Sign in</Button>)
    const button = screen.getByRole('button', { name: 'Sign in' })
    expect(button.getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('AuthLayout', () => {
  it('is the page’s main content, titled by its heading', () => {
    render(
      <AuthLayout title="Welcome back" description="Sign in to pick up where you left off.">
        <form aria-label="Sign in" />
      </AuthLayout>,
    )
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeTruthy()
    expect(screen.getByText('Sign in to pick up where you left off.')).toBeTruthy()
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeTruthy()
  })

  it('links the brand home', () => {
    render(<AuthLayout title="Welcome back" />)
    expect(screen.getByRole('link', { name: 'Savepoint' }).getAttribute('href')).toBe('/')
  })

  it('shows the line for switching pages only when given', () => {
    const { rerender } = render(<AuthLayout title="Welcome back" />)
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull()

    rerender(
      <AuthLayout
        title="Welcome back"
        switchTo={
          <>
            New to Savepoint? <a href="/create-account">Create an account</a>
          </>
        }
      />,
    )
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe('/create-account')
  })
})
