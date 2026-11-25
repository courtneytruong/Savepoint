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
  useStoredChoice,
  useToast,
} from '../components/index.js'
import {
  BookIcon,
  CalendarIcon,
  GameIcon,
  LibraryIcon,
  ReflectionIcon,
  StatsIcon,
  TimelineIcon,
} from '../components/icons.js'
import { CALENDAR_PATH, LIBRARY_PATH, libraryPath, REFLECTIONS_PATH, STATS_PATH, TIMELINE_PATH } from '../paths.js'
import styles from './AppLayout.module.css'

/**
 * The frame around every signed-in page: the header, then a glowing panel with
 * the sidebar beside the page. The intro text lives on the landing page. The
 * header and sidebar list only pages that exist; more join as they're built.
 *
 * current: the page you're on, library (the default, for item pages too),
 * reflections, timeline, calendar or stats, marked in the header and the sidebar. counts: how many items the
 * library has, how many are a Book or a Game, and how many reflections there are,
 * each shown in the sidebar once known. medium: the library's type filter, if any,
 * which marks its shortcut in the sidebar as the page you're on.
 */
export function AppLayout({ account, onSignedOut, current = 'library', counts = {}, medium = null, children }) {
  const onLibrary = current === 'library'
  const onReflections = current === 'reflections'
  const onTimeline = current === 'timeline'
  const onCalendar = current === 'calendar'
  const onStats = current === 'stats'

  const toast = useToast()
  const navigate = useNavigate()
  // Remembered in this browser, so it stays as they left it on every page.
  const [sidebar, setSidebar] = useStoredChoice('savepoint.sidebar', ['open', 'collapsed'], 'open')

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
        <Link href={LIBRARY_PATH} aria-current={onLibrary ? 'page' : undefined}>
          Library
        </Link>
        <Link href={REFLECTIONS_PATH} aria-current={onReflections ? 'page' : undefined}>
          Reflections
        </Link>
        <Link href={TIMELINE_PATH} aria-current={onTimeline ? 'page' : undefined}>
          Timeline
        </Link>
        <Link href={CALENDAR_PATH} aria-current={onCalendar ? 'page' : undefined}>
          Calendar
        </Link>
        <Link href={STATS_PATH} aria-current={onStats ? 'page' : undefined}>
          Stats
        </Link>
      </Header>

      <main className={styles.main}>
        <div className={styles.inner}>
          <GlowFrame flush>
            <SidebarLayout
              sidebar={
                <Sidebar
                  collapsed={sidebar === 'collapsed'}
                  onCollapsedChange={(collapsed) => setSidebar(collapsed ? 'collapsed' : 'open')}
                >
                  <SidebarGroup>
                    <SidebarLink
                      href={LIBRARY_PATH}
                      icon={<LibraryIcon />}
                      count={counts.library}
                      active={onLibrary && !medium}
                    >
                      Library
                    </SidebarLink>
                    <SidebarLink
                      href={REFLECTIONS_PATH}
                      icon={<ReflectionIcon />}
                      count={counts.reflections}
                      active={onReflections}
                    >
                      Reflections
                    </SidebarLink>
                    <SidebarLink href={TIMELINE_PATH} icon={<TimelineIcon />} active={onTimeline}>
                      Timeline
                    </SidebarLink>
                    <SidebarLink href={CALENDAR_PATH} icon={<CalendarIcon />} active={onCalendar}>
                      Calendar
                    </SidebarLink>
                    <SidebarLink href={STATS_PATH} icon={<StatsIcon />} active={onStats}>
                      Stats
                    </SidebarLink>
                  </SidebarGroup>
                  {/* Shortcuts to the library's type filter. */}
                  <SidebarGroup title="Browse">
                    <SidebarLink
                      href={libraryPath({ medium: 'Book' })}
                      icon={<BookIcon />}
                      count={counts.Book}
                      active={onLibrary && medium === 'Book'}
                    >
                      Books
                    </SidebarLink>
                    <SidebarLink
                      href={libraryPath({ medium: 'Game' })}
                      icon={<GameIcon />}
                      count={counts.Game}
                      active={onLibrary && medium === 'Game'}
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
