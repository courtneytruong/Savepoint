import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateAccountForm, validateNewAccount } from '../components/index.js'

afterEach(cleanup)

const VALID = { displayName: 'Courtney', email: 'reader@example.com', password: 'tides and statues' }
const check = (changes) => validateNewAccount({ ...VALID, ...changes })

describe('validateNewAccount', () => {
  it('accepts a name, an email and a long enough password', () => {
    expect(check({})).toEqual({})
  })

  it('needs a name, trimmed, of 50 characters or fewer', () => {
    expect(check({ displayName: '   ' }).displayName).toBe('Enter what Savepoint should call you.')
    expect(check({ displayName: `  ${'a'.repeat(50)}  ` })).toEqual({})
    expect(check({ displayName: 'a'.repeat(51) }).displayName).toBe('Use 50 characters or fewer.')
  })

  it('needs an email that looks like one', () => {
    expect(check({ email: '' }).email).toBe('Enter your email.')
    expect(check({ email: 'reader' }).email).toBe('Enter an email like name@example.com.')
  })

  it('needs an email, trimmed, of 256 characters or fewer, as the API does', () => {
    const ofLength = (n) => `${'a'.repeat(n - '@example.com'.length)}@example.com`
    expect(check({ email: ` ${ofLength(256)} ` })).toEqual({})
    expect(check({ email: ofLength(257) }).email).toBe('Use 256 characters or fewer.')
    // Too long is said first, like the API, even when it doesn't look like an email either.
    expect(check({ email: 'a'.repeat(257) }).email).toBe('Use 256 characters or fewer.')
  })

  it('needs a password of 12 to 128 characters, and says how many more', () => {
    expect(check({ password: '' }).password).toBe('Choose a password.')
    expect(check({ password: 'a'.repeat(11) }).password).toMatch('1 more to go')
    expect(check({ password: 'a'.repeat(12) })).toEqual({})
    expect(check({ password: 'a'.repeat(128) })).toEqual({})
    expect(check({ password: 'a'.repeat(129) }).password).toBe('Use 128 characters or fewer.')
  })

  it('has no rules about letters, digits or symbols', () => {
    expect(check({ password: 'all lowercase words' })).toEqual({})
    expect(check({ password: '123456789012' })).toEqual({})
  })

  it('counts spaces in a password, and never trims it', () => {
    expect(check({ password: `${'a'.repeat(10)}  ` })).toEqual({})
    expect(check({ password: ' '.repeat(12) })).toEqual({})
  })
})

const field = (label) => screen.getByLabelText(label)
const type = (label, value) => fireEvent.change(field(label), { target: { value } })
const submit = () => screen.getByRole('button', { name: /^Creat(e|ing)/ })

function fillIn(values = VALID) {
  type('Your name', values.displayName)
  type('Email', values.email)
  type('Password', values.password)
}

async function createWith(result, props = {}) {
  const onSubmit = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)))
  render(<CreateAccountForm onSubmit={onSubmit} {...props} />)
  fillIn()
  await act(async () => fireEvent.click(submit()))
  return onSubmit
}

describe('CreateAccountForm', () => {
  it('tells password managers to save a new password', () => {
    render(<CreateAccountForm onSubmit={vi.fn()} />)
    expect(field('Your name').getAttribute('autocomplete')).toBe('name')
    expect(field('Email').getAttribute('autocomplete')).toBe('email')
    expect(field('Password').getAttribute('autocomplete')).toBe('new-password')
  })

  it('has one password box, with no second box to repeat it in', () => {
    render(<CreateAccountForm onSubmit={vi.fn()} />)
    expect(screen.getAllByLabelText(/password/i).filter((element) => element.tagName === 'INPUT')).toHaveLength(1)
  })

  it('counts the password toward 12 characters as you type', () => {
    render(<CreateAccountForm onSubmit={vi.fn()} />)
    expect(screen.getByText('0 / 12 characters')).toBeTruthy()
    type('Password', 'tides ')
    expect(screen.getByText('6 / 12 characters')).toBeTruthy()
    type('Password', 'tides and statues')
    expect(screen.getByText('17 characters')).toBeTruthy()
  })

  it("doesn't send anything until every field is right, and moves to the first problem", () => {
    const onSubmit = vi.fn()
    render(<CreateAccountForm onSubmit={onSubmit} />)
    type('Email', 'reader@example.com')
    type('Password', 'short')
    fireEvent.click(submit())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter what Savepoint should call you.')).toBeTruthy()
    expect(screen.getByText(/7 more to go/)).toBeTruthy()
    expect(document.activeElement).toBe(field('Your name'))
  })

  it('sends the name and email trimmed, and the password as typed', async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<CreateAccountForm onSubmit={onSubmit} />)
    fillIn({ displayName: '  Courtney ', email: ' reader@example.com ', password: ' tides and statues ' })
    await act(async () => fireEvent.click(submit()))
    expect(onSubmit).toHaveBeenCalledWith({
      displayName: 'Courtney',
      email: 'reader@example.com',
      password: ' tides and statues ',
    })
  })

  it('shows that it is working', async () => {
    let finish
    const onSubmit = vi.fn(() => new Promise((resolve) => (finish = resolve)))
    render(<CreateAccountForm onSubmit={onSubmit} />)
    fillIn()
    fireEvent.click(submit())
    expect(submit().textContent).toBe('Creating your account…')
    expect(submit().getAttribute('aria-disabled')).toBe('true')
    await act(async () => finish())
    expect(submit().textContent).toBe('Create account')
  })

  it('says when the email already has an account, offers to sign in, and moves there', async () => {
    await createWith({ error: 'emailTaken' }, { signInHref: '/sign-in' })
    expect(screen.getByText(/That email already has an account/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    expect(field('Email').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(field('Email'))
  })

  it('clears that answer once the email is changed', async () => {
    await createWith({ error: 'emailTaken' })
    // Shown first, so its going away below means something.
    expect(screen.getByText('That email already has an account.')).toBeTruthy()
    type('Email', 'another@example.com')
    expect(screen.queryByText('That email already has an account.')).toBeNull()
  })

  it("says the server didn't answer, above the form, and moves there", async () => {
    await createWith(new Error('Network down'))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch("Couldn't create your account")
    expect(document.activeElement).toBe(alert)
  })

  it("treats an answer it doesn't recognise as a failure", async () => {
    await createWith({ error: 'wrongPassword' })
    expect(screen.getByRole('alert').textContent).toMatch("Couldn't create your account")
  })
})
