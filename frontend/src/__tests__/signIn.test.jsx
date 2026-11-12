import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { looksLikeEmail, SignInForm, validateSignIn } from '../components/index.js'

afterEach(cleanup)

describe('validateSignIn', () => {
  it('accepts an email and any password', () => {
    expect(validateSignIn({ email: 'reader@example.com', password: 'x' })).toEqual({})
  })

  it('asks for each missing field', () => {
    expect(validateSignIn({ email: ' ', password: '' })).toEqual({
      email: 'Enter your email.',
      password: 'Enter your password.',
    })
  })

  it('asks for an email that looks like one', () => {
    expect(validateSignIn({ email: 'reader', password: 'x' }).email).toBe('Enter an email like name@example.com.')
  })

  it('turns away an email too long for any account to have', () => {
    const email = `${'a'.repeat(257 - '@example.com'.length)}@example.com`
    expect(validateSignIn({ email, password: 'x' }).email).toBe('Use 256 characters or fewer.')
  })

  it("doesn't trim the password, since spaces can be part of it", () => {
    expect(validateSignIn({ email: 'a@b', password: '  ' })).toEqual({})
  })
})

describe('looksLikeEmail', () => {
  it('needs something either side of an @, and no spaces', () => {
    expect(looksLikeEmail('reader@example.com')).toBe(true)
    expect(looksLikeEmail('  reader@example.com  ')).toBe(true)
    expect(looksLikeEmail('élodie+books@例え.jp')).toBe(true)
    expect(looksLikeEmail('reader@')).toBe(false)
    expect(looksLikeEmail('re ader@example.com')).toBe(false)
  })
})

// A promise the test resolves when it's ready, to see the form while it waits.
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const email = () => screen.getByLabelText('Email')
const password = () => screen.getByLabelText('Password')
const submit = () => screen.getByRole('button', { name: /^Sign(ing)? in/ })

function fillIn(emailText = 'reader@example.com', passwordText = 'tides-and-statues') {
  fireEvent.change(email(), { target: { value: emailText } })
  fireEvent.change(password(), { target: { value: passwordText } })
}

// Signs in, then waits for the answer to arrive and be shown.
async function signInWith(result, props = {}) {
  const onSubmit = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)))
  render(<SignInForm onSubmit={onSubmit} {...props} />)
  fillIn()
  await act(async () => fireEvent.click(submit()))
  return onSubmit
}

describe('SignInForm', () => {
  it('tells password managers what each field is', () => {
    render(<SignInForm onSubmit={vi.fn()} />)
    expect(email().getAttribute('autocomplete')).toBe('username')
    expect(email().getAttribute('type')).toBe('email')
    expect(password().getAttribute('autocomplete')).toBe('current-password')
  })

  it("doesn't send anything until both fields are filled in", () => {
    const onSubmit = vi.fn()
    render(<SignInForm onSubmit={onSubmit} />)
    fireEvent.click(submit())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your email.')).toBeTruthy()
    expect(screen.getByText('Enter your password.')).toBeTruthy()
    expect(document.activeElement).toBe(email())
  })

  it('sends the email trimmed and the password as typed', async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<SignInForm onSubmit={onSubmit} />)
    fillIn('  reader@example.com ', ' spaced ')
    await act(async () => fireEvent.click(submit()))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'reader@example.com', password: ' spaced ' })
  })

  it('shows that it is signing in, and ignores a second press', async () => {
    const answer = deferred()
    const onSubmit = vi.fn(() => answer.promise)
    render(<SignInForm onSubmit={onSubmit} />)
    fillIn()
    fireEvent.click(submit())

    expect(submit().textContent).toBe('Signing in…')
    expect(submit().getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledOnce()

    await act(async () => answer.resolve())
    expect(submit().textContent).toBe('Sign in')
  })

  it('says when no account uses the email, offers to create one, and moves there', async () => {
    await signInWith({ error: 'unknownEmail' }, { createAccountHref: '/create-account' })
    expect(email().getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/No account uses that email/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe('/create-account')
    expect(document.activeElement).toBe(email())
  })

  it('says when the password is wrong, keeps the email, and moves to the password', async () => {
    await signInWith({ error: 'wrongPassword' })
    expect(screen.getByText('That password is wrong.')).toBeTruthy()
    expect(password().getAttribute('aria-invalid')).toBe('true')
    expect(email().value).toBe('reader@example.com')
    expect(document.activeElement).toBe(password())
  })

  it("clears an answer about a field once it's changed", async () => {
    await signInWith({ error: 'wrongPassword' })
    // Shown first, so its going away below means something.
    expect(screen.getByText('That password is wrong.')).toBeTruthy()
    fireEvent.change(password(), { target: { value: 'another try' } })
    expect(screen.queryByText('That password is wrong.')).toBeNull()
    expect(password().getAttribute('aria-invalid')).toBeNull()
  })

  it('explains a pause after too many tries, above the form, and moves there', async () => {
    await signInWith({ error: 'tooManyTries' })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch('Too many tries')
    expect(document.activeElement).toBe(alert)
    expect(email().getAttribute('aria-invalid')).toBeNull()
  })

  it('says something went wrong when sending fails', async () => {
    await signInWith(new Error('Network down'))
    expect(screen.getByRole('alert').textContent).toMatch("Couldn't sign in")
    expect(screen.getByRole('alert').textContent).toMatch("Something went wrong on Savepoint's server. Try again.")
    expect(submit().textContent).toBe('Sign in')
  })

  it("treats an answer it doesn't recognise as a failure", async () => {
    await signInWith({ error: 'somethingNew' })
    expect(screen.getByRole('alert').textContent).toMatch("Couldn't sign in")
  })

  it('shows nothing extra once signed in', async () => {
    await signInWith(undefined)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(email().getAttribute('aria-invalid')).toBeNull()
  })
})
