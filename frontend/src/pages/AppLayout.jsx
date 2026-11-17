import { startTransition } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '../api/auth.js'
import {
  AccountMenu,
  GlowFrame,
  Header,
  Link,
  Sidebar,
  SidebarGroup,
  SidebarLayout,
  SidebarLink,
  useToast,
} from '../components/index.js'
import { BookIcon, GameIcon, LibraryIcon } from '../components/icons.js'
import { LIBRARY_PATH, libraryPath } from '../paths.js'
import styles from './AppLayout.module.css'

/**
 * The frame around every signed-in page: the header, then a glowing panel with
 * the sidebar beside the page. The intro text lives on the landing page. The
 * header and sidebar list only pages that exist; more join as they're built.
 *
 * counts: how many items the library has, and how many are a Book or a Game,
 * shown in the sidebar once known. medium: the library's type filter, if any,
 * which marks its shortcut in the sidebar as the page you're on.
 */
export function AppLayout({ account, onSignedOut, counts = {}, medium = null, children }) {
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
    // Straight to the landing page, without remembering this page: whoever signs
    // in next may not be the same person. One transition for both, because React
    // Router makes every navigation a transition, which waits behind ordinary
    // updates. Alone, signing out would show first, still at this page, and the
    // redirect for signed-out people would remember it.
    startTransition(() => {
      navigate(LIBRARY_PATH, { replace: true })
      onSignedOut()
    })
  }

  return (
    <>
      <Header
        brand="Savepoint"
        actions={<AccountMenu name={account.displayName} email={account.email} onSignOut={handleSignOut} />}
      >
        <Link href={LIBRARY_PATH} aria-current="page">
          Library
        </Link>
      </Header>

      <main className={styles.main}>
        <div className={styles.inner}>
          <GlowFrame flush>
            <SidebarLayout
              sidebar={
                <Sidebar>
                  <SidebarGroup>
                    <SidebarLink href={LIBRARY_PATH} icon={<LibraryIcon />} count={counts.library} active={!medium}>
                      Library
                    </SidebarLink>
                  </SidebarGroup>
                  {/* Shortcuts to the library's type filter. */}
                  <SidebarGroup title="Browse">
                    <SidebarLink
                      href={libraryPath({ medium: 'Book' })}
                      icon={<BookIcon />}
                      count={counts.Book}
                      active={medium === 'Book'}
                    >
                      Books
                    </SidebarLink>
                    <SidebarLink
                      href={libraryPath({ medium: 'Game' })}
                      icon={<GameIcon />}
                      count={counts.Game}
                      active={medium === 'Game'}
                    >
                      Games
                    </SidebarLink>
                  </SidebarGroup>
                </Sidebar>
              }
            >
              {children}
            </SidebarLayout>
          </GlowFrame>
        </div>
      </main>
    </>
  )
}
