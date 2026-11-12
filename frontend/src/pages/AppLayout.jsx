import { startTransition } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '../api/auth.js'
import {
  AccountMenu,
  GlowFrame,
  Header,
  Heading,
  Hero,
  Link,
  Sidebar,
  SidebarGroup,
  SidebarLayout,
  SidebarLink,
  Text,
  useToast,
} from '../components/index.js'
import { LibraryIcon } from '../components/icons.js'
import { SIGN_IN_PATH } from '../paths.js'
import styles from './AppLayout.module.css'

/**
 * The frame around every signed-in page, as in the /components gallery: the
 * header, the intro, and a glowing panel with the sidebar beside the page. The
 * header and sidebar list only pages that exist; more join as they're built.
 *
 * libraryCount: how many items the library has, shown in the sidebar once known.
 */
export function AppLayout({ account, onSignedOut, libraryCount, children }) {
  const toast = useToast()
  const navigate = useNavigate()

  // Sign-in shows only once the API has deleted the cookie. Otherwise the next
  // reload would sign them straight back in, so they stay here and can retry.
  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      toast.show({
        tone: 'error',
        title: "Couldn't sign out",
        description: "Something went wrong on Savepoint's server. Try again.",
        action: { label: 'Try again', onClick: handleSignOut },
      })
      return
    }
    // Straight to sign-in, without remembering this page: whoever signs in next
    // may not be the same person. One transition for both, because React Router
    // makes every navigation a transition, which waits behind ordinary updates.
    // Alone, signing out would show first, still at this page, and the redirect
    // for signed-out people would remember it.
    startTransition(() => {
      navigate(SIGN_IN_PATH, { replace: true })
      onSignedOut()
    })
  }

  return (
    <>
      <Header
        brand="Savepoint"
        actions={<AccountMenu name={account.displayName} email={account.email} onSignOut={handleSignOut} />}
      >
        <Link href="/" aria-current="page">
          Library
        </Link>
      </Header>

      <main>
        <Hero
          panel={
            <GlowFrame flush>
              <SidebarLayout
                sidebar={
                  <Sidebar>
                    <SidebarGroup>
                      <SidebarLink href="/" icon={<LibraryIcon />} count={libraryCount} active>
                        Library
                      </SidebarLink>
                    </SidebarGroup>
                  </Sidebar>
                }
              >
                {children}
              </SidebarLayout>
            </GlowFrame>
          }
        >
          <Heading as="h1" size="display">
            Every thought, in order
          </Heading>
          <Text size="subheading" className={styles.lead}>
            A journal for the books you read and the games you play, and how your thinking changes along the way.
          </Text>
        </Hero>
      </main>
    </>
  )
}
