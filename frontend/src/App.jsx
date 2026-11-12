import { useEffect, useState } from 'react'
import { createAccount, getAccount, signIn } from './api/auth.js'
import {
  AccountMenu,
  AuthLayout,
  CreateAccountForm,
  Header,
  Heading,
  Section,
  SignInForm,
  Spinner,
} from './components/index.js'
import styles from './App.module.css'
import { HealthStatus } from './HealthStatus.jsx'

// Until there's real routing, each auth screen has its own path, and the links
// between them load the page again. nginx and Vite answer any path with the app.
export const SIGN_IN_PATH = '/sign-in'
export const CREATE_ACCOUNT_PATH = '/create-account'

function App() {
  // Whether the API has said who's signed in yet, and who, if anyone.
  const [checked, setChecked] = useState(false)
  const [account, setAccount] = useState(null)

  // Opens the app at its home address, rather than an auth screen's.
  const open = (found) => {
    window.history.replaceState(null, '', '/')
    setAccount(found)
    setChecked(true)
  }

  // On load, the auth cookie may already say who this is, so a reload doesn't
  // sign anyone out. If the API can't say, the sign-in screen shows, and the
  // form says so if signing in fails too.
  useEffect(() => {
    const controller = new AbortController()
    getAccount({ signal: controller.signal })
      .then((found) => (found ? open(found) : setChecked(true)))
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setChecked(true)
      })
    return () => controller.abort()
  }, [])

  // Once the API has signed someone in, opens the app. The answer goes back to
  // the form either way, so it can show any error.
  const thenOpen = (send) => async (details) => {
    const result = await send(details)
    if (result.account) open(result.account)
    return result
  }

  if (!checked) {
    return (
      <main className={styles.checking}>
        <Spinner size="large" label="Opening Savepoint" />
      </main>
    )
  }

  if (account) return <Home account={account} />

  if (window.location.pathname === CREATE_ACCOUNT_PATH) {
    return (
      <AuthLayout
        title="Start your journal"
        description="Keep track of what you read and play, and how you feel about it."
        switchTo={
          <>
            Already have an account? <a href={SIGN_IN_PATH}>Sign in</a>
          </>
        }
      >
        <CreateAccountForm signInHref={SIGN_IN_PATH} onSubmit={thenOpen(createAccount)} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to pick up where you left off."
      switchTo={
        <>
          New to Savepoint? <a href={CREATE_ACCOUNT_PATH}>Create an account</a>
        </>
      }
    >
      <SignInForm createAccountHref={CREATE_ACCOUNT_PATH} onSubmit={thenOpen(signIn)} />
    </AuthLayout>
  )
}

// A stand-in for the library, until that feature is built.
function Home({ account }) {
  return (
    <>
      <Header brand="Savepoint" actions={<AccountMenu name={account.displayName} email={account.email} />} />
      <Section as="main">
        <Heading as="h1" size="large">
          Welcome, {account.displayName}
        </Heading>
        <HealthStatus />
      </Section>
    </>
  )
}

export default App
