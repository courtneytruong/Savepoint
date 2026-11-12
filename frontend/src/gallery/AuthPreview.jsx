import { useEffect, useState } from 'react'
import { Alert, AuthLayout, Button, CreateAccountForm, SignInForm } from '../components/index.js'
import { PreviousIcon } from '../components/icons.js'
import styles from './Gallery.module.css'

// A pretend API, so every answer can be tried without a server.
const DEMO_EMAIL = 'reader@example.com'
const DEMO_PASSWORD = 'tides-and-statues'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function demoSignIn({ email, password }) {
  await wait(800)
  if (email === 'offline@example.com') throw new Error('No answer')
  // Short, so the countdown can be watched to the end.
  if (email === 'locked@example.com') return { error: 'tooManyTries', retryAfterSeconds: 15 }
  if (email.toLowerCase() !== DEMO_EMAIL) return { error: 'unknownEmail' }
  if (password !== DEMO_PASSWORD) return { error: 'wrongPassword' }
  return undefined
}

async function demoCreateAccount({ email }) {
  await wait(800)
  if (email === 'offline@example.com') throw new Error('No answer')
  if (email.toLowerCase() === DEMO_EMAIL) return { error: 'emailTaken' }
  return undefined
}

const PAGES = {
  'sign-in': {
    title: 'Welcome back',
    description: 'Sign in to pick up where you left off.',
    switchTo: (
      <>
        New to Savepoint? <a href="#create-account">Create an account</a>
      </>
    ),
    demo: `Sign in as ${DEMO_EMAIL} with the password ${DEMO_PASSWORD}. Use locked@example.com to see too many tries, or offline@example.com to see the server not answering.`,
    done: { title: 'Signed in', body: 'In the app, this would open your library.' },
  },
  'create-account': {
    title: 'Start your journal',
    description: 'Keep track of what you read and play, and how you feel about it.',
    switchTo: (
      <>
        Already have an account? <a href="#sign-in">Sign in</a>
      </>
    ),
    demo: `${DEMO_EMAIL} already has an account. Use offline@example.com to see the server not answering, or any other email to create one.`,
    done: { title: 'Account created', body: 'In the app, this would open your empty library, with its hero.' },
  },
}

/**
 * The auth pages as whole pages, at /components#sign-in and #create-account,
 * with a pretend API.
 */
export function AuthPreview({ page = 'sign-in' }) {
  const [done, setDone] = useState(false)
  const { title, description, switchTo, demo, done: doneMessage } = PAGES[page]

  // Arriving from further down the gallery would otherwise keep that scroll position.
  // Braces, so the effect returns nothing: React would call a returned value as
  // its clean-up, and in some browsers scrollTo returns a Promise.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Shows the finished state once the pretend API says yes.
  const finish = (send) => async (details) => {
    const result = await send(details)
    if (!result) setDone(true)
    return result
  }

  return (
    <>
      <a href="#library" className={styles.backLink}>
        <PreviousIcon aria-hidden="true" />
        Back to the gallery
      </a>
      <AuthLayout brandHref="#library" title={title} description={description} switchTo={switchTo}>
        {done ? (
          <div className={styles.authForm}>
            <Alert tone="success" title={doneMessage.title}>
              {doneMessage.body}
            </Alert>
            <Button variant="outline" onClick={() => setDone(false)}>
              Try again
            </Button>
          </div>
        ) : (
          <div className={styles.authForm}>
            <Alert tone="info" title="Gallery demo">
              <p>{demo}</p>
            </Alert>
            {page === 'sign-in' ? (
              <SignInForm createAccountHref="#create-account" onSubmit={finish(demoSignIn)} />
            ) : (
              <CreateAccountForm signInHref="#sign-in" onSubmit={finish(demoCreateAccount)} />
            )}
          </div>
        )}
      </AuthLayout>
    </>
  )
}
