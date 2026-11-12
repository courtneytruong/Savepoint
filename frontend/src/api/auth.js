// Calls to the API's /api/auth endpoints, answering in the shape the auth forms
// expect: { account } on success, or { error } with the same codes the forms use.
//
// Every unsuccessful answer from the API is Problem Details, with an "error"
// field where the forms need to tell answers apart. Anything without one comes
// back as failed: a 400 the forms' own checks should have prevented, a 500, or
// an error page from nginx when the API is down. If the server can't be reached
// at all, fetch throws, which the forms also count as failed.

async function post(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const answer = await readJson(response)
  if (response.ok) return { account: answer }
  return { error: typeof answer?.error === 'string' ? answer.error : 'failed' }
}

// null when the body isn't JSON, such as an HTML error page.
async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Creates an account and signs it in: the API sets the auth cookie. Resolves
 * with { account } ({ id, displayName, email }), or { error: 'emailTaken' } or
 * { error: 'failed' }.
 */
export const createAccount = ({ displayName, email, password }) =>
  post('/api/auth/register', { displayName, email, password })

/**
 * Signs in: the API sets the auth cookie. Resolves with { account }, or with
 * { error }: unknownEmail, wrongPassword, tooManyTries or failed.
 */
export const signIn = ({ email, password }) => post('/api/auth/sign-in', { email, password })
