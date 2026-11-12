import { useEffect, useId, useRef, useState } from 'react'
import styles from './AccountMenu.module.css'
import { ExpandIcon, SettingsIcon, SignOutIcon } from '../icons.js'
import { useAnchoredPopup } from '../../hooks/useAnchoredPopup.js'
import { VisuallyHidden } from '../ui/VisuallyHidden.jsx'
import { Link } from '../ui/Link.jsx'

// The first letter of the name, for the circle. Array.from keeps a letter made of
// two UTF-16 units, such as many emoji, in one piece.
const initialOf = (name) => Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '?'

/**
 * The signed-in person's name in the header, opening a short list: who's signed
 * in, settings, and signing out.
 *
 * It's a disclosure, a button that shows and hides links, rather than an ARIA
 * menu, which would make screen readers expect arrow keys. Esc closes it and goes
 * back to the button; clicking outside, tabbing away or choosing closes it too.
 *
 * onSignOut: called when Sign out is chosen, after the list closes.
 */
export function AccountMenu({ name, email, settingsHref, onSignOut }) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  useAnchoredPopup(open, buttonRef, panelRef)

  // A click anywhere else closes it. The panel is drawn in the top layer, but it's
  // still inside the wrapper in the page, so one check covers both.
  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!wrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function close({ returnFocus = false } = {}) {
    setOpen(false)
    if (returnFocus) buttonRef.current.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && open) {
      // Only the list closes, not a modal or anything else underneath.
      event.stopPropagation()
      close({ returnFocus: true })
    }
  }

  // Tabbing past the last item, or anywhere else, closes the list behind you.
  function handleBlur(event) {
    const next = event.relatedTarget
    if (next && !wrapRef.current.contains(next)) close()
  }

  return (
    <div ref={wrapRef} className={styles.wrap} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initialOf(name)}
        </span>
        <VisuallyHidden>Account menu for </VisuallyHidden>
        <span className={styles.name}>{name}</span>
        <ExpandIcon aria-hidden="true" className={styles.chevron} />
      </button>

      {/* In the page after the button, so Tab moves into it next. Its contents only
          exist while open, so nothing in it can be reached while it's closed. */}
      <div ref={panelRef} id={panelId} popover="manual" data-open={open || undefined} className={styles.panel}>
        {open && (
          <>
            <div className={styles.who}>
              <span className={styles.whoName}>{name}</span>
              {email && <span className={styles.whoEmail}>{email}</span>}
            </div>
            <ul className={styles.items}>
              {settingsHref && (
                <li>
                  <Link href={settingsHref} className={styles.item} onClick={() => close()}>
                    <SettingsIcon aria-hidden="true" />
                    Settings
                  </Link>
                </li>
              )}
              <li>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => {
                    close()
                    onSignOut?.()
                  }}
                >
                  <SignOutIcon aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
