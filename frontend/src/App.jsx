import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Link as RouterLink, Route, Routes, useLocation } from 'react-router'
import { createAccount, getAccount, signIn } from './api/auth.js'
import { AuthLayout, CreateAccountForm, LinkProvider, SignInForm, Spinner } from './components/index.js'
import styles from './App.module.css'
import { LibraryPage } from './pages/LibraryPage.jsx'
import { CREATE_ACCOUNT_PATH, LIBRARY_PATH, SIGN_IN_PATH } from './paths.js'

// Every link in the components goes through React Router, so moving around the
// app doesn't reload the page. nginx and Vite answer any path with the app.
function App() {
  return (
    <BrowserRouter>
      <LinkProvider component={RouterLink}>
        <Session />
      </LinkProvider>
    </BrowserRouter>
  )
}

// Asks who's signed in, then shows the page for the address, sending signed-out
// people to sign in and signed-in people away from it.
function Session() {
  // Whether the API has said who's signed in yet, and who, if anyone.
  const [checked, setChecked] = useState(false)
  const [account, setAccount] = useState(null)

  // On load, the auth cookie may already say who this is, so a reload doesn't
  // sign anyone out. If the API can't say, the sign-in screen shows, and the
  // form says so if signing in fails too.
  useEffect(() => {
    const controller = new AbortController()
    getAccount({ signal: controller.signal })
      .then((found) => {
        setAccount(found)
        setChecked(true)
      })
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setChecked(true)
      })
    return () => controller.abort()
  }, [])

  if (!checked) {
    return (
      <main className={styles.checking}>
        <Spinner size="large" label="Opening Savepoint" />
      </main>
    )
  }

  return (
    <Routes>
      <Route element={<SignedOutOnly account={account} />}>
        <Route path={SIGN_IN_PATH} element={<SignInPage onSignedIn={setAccount} />} />
        <Route path={CREATE_ACCOUNT_PATH} element={<CreateAccountPage onSignedIn={setAccount} />} />
      </Route>
      <Route element={<SignedInOnly account={account} />}>
        <Route path={LIBRARY_PATH} element={<LibraryPage account={account} onSignedOut={() => setAccount(null)} />} />
      </Route>
      {/* No other pages yet, so any other address goes home. */}
      <Route path="*" element={<Navigate to={LIBRARY_PATH} replace />} />
    </Routes>
  )
}

// The pages for someone signed in. Anyone else goes to sign in, which remembers
// the page they wanted, so it can take them there afterwards.
function SignedInOnly({ account }) {
  const { pathname, search, hash } = useLocation()
  if (account) return <Outlet />
  return <Navigate to={SIGN_IN_PATH} replace state={{ from: pathname + search + hash }} />
}

// Signing in and creating an account. Someone signed in, including just now,
// goes to the page they wanted, or home.
function SignedOutOnly({ account }) {
  const { state } = useLocation()
  if (!account) return <Outlet />
  return <Navigate to={state?.from ?? '/'} replace />
}

// Passes the form's answer back to it either way, so it can show any error, and
// says who signed in when it worked.
const thenSignIn = (send, onSignedIn) => async (details) => {
  const result = await send(details)
  if (result.account) onSignedIn(result.account)
  return result
}

function SignInPage({ onSignedIn }) {
  // Kept when switching to creating an account, so either one returns to it.
  const { state } = useLocation()
  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to pick up where you left off."
      switchTo={
        <>
          New to Savepoint?{' '}
          <RouterLink to={CREATE_ACCOUNT_PATH} state={state}>
            Create an account
          </RouterLink>
        </>
      }
    >
      <SignInForm createAccountHref={CREATE_ACCOUNT_PATH} onSubmit={thenSignIn(signIn, onSignedIn)} />
    </AuthLayout>
  )
}

function CreateAccountPage({ onSignedIn }) {
  const { state } = useLocation()
  return (
    <AuthLayout
      title="Start your journal"
      description="Keep track of what you read and play, and how you feel about it."
      switchTo={
        <>
          Already have an account?{' '}
          <RouterLink to={SIGN_IN_PATH} state={state}>
            Sign in
          </RouterLink>
        </>
      }
    >
      <CreateAccountForm signInHref={SIGN_IN_PATH} onSubmit={thenSignIn(createAccount, onSignedIn)} />
    </AuthLayout>
  )
}

export default App
