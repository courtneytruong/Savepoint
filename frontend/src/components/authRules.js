// What the auth forms check before sending anything. The API checks again, and
// only it knows whether an account exists or a password is right.

// Something, an @, then something, with no spaces. Stricter checks turn away
// real addresses, and the API is the one that has to accept it.
const EMAIL = /^[^\s@]+@[^\s@]+$/

export const looksLikeEmail = (text = '') => EMAIL.test(text.trim())

// The same email messages on every form.
function emailError(email) {
  if (email.trim() === '') return 'Enter your email.'
  if (!looksLikeEmail(email)) return 'Enter an email like name@example.com.'
  return undefined
}

/** Returns a message for each field that needs fixing before signing in, or an empty object. */
export function validateSignIn({ email = '', password = '' }) {
  const errors = {}
  const emailProblem = emailError(email)
  if (emailProblem) errors.email = emailProblem
  if (password === '') errors.password = 'Enter your password.'
  return errors
}

/**
 * What the API can say went wrong when signing in. SignInForm shows each one in
 * its own words: unknownEmail and wrongPassword on their fields, the others
 * above the form.
 */
export const SIGN_IN_ERRORS = ['unknownEmail', 'wrongPassword', 'tooManyTries', 'failed']

// The account rules in docs/data-model.md.
export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 128
export const MAX_DISPLAY_NAME_LENGTH = 50

/**
 * Returns a message for each field that breaks a rule for a new account, or an
 * empty object. The password isn't trimmed, since spaces count. Its length is
 * string length, which .NET counts the same way.
 */
export function validateNewAccount({ displayName = '', email = '', password = '' }) {
  const errors = {}

  const name = displayName.trim()
  if (name === '') errors.displayName = 'Enter what Savepoint should call you.'
  else if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    errors.displayName = `Use ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`
  }

  const emailProblem = emailError(email)
  if (emailProblem) errors.email = emailProblem

  if (password === '') errors.password = 'Choose a password.'
  else if (password.length < MIN_PASSWORD_LENGTH) {
    const short = MIN_PASSWORD_LENGTH - password.length
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters: ${short} more to go. A few words together work well.`
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`
  }

  return errors
}

/** What the API can say went wrong creating an account: emailTaken on its field, failed above the form. */
export const CREATE_ACCOUNT_ERRORS = ['emailTaken', 'failed']
