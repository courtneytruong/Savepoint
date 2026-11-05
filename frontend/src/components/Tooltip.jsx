import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import styles from './Tooltip.module.css'
import { classNames } from './classNames.js'

const SHOW_DELAY = 300
const HIDE_DELAY = 150
const GAP = 8
const EDGE = 8

/**
 * A short hint shown on hover or keyboard focus. The child element is described
 * by it, so screen readers read it too. An icon-only button still needs its own
 * aria-label. If the tooltip says the same as that label, it isn't repeated.
 *
 * placement: top (default) or bottom. It flips to the other side if there's no
 * room, and moves sideways to stay on screen.
 *
 * It sits in the browser's top layer, so it shows above modals and isn't cut
 * off by a panel's edges. Disabled buttons get no pointer events, so wrap one in
 * a span to give it a tooltip.
 */
export function Tooltip({ content, placement = 'top', children }) {
  const id = useId()
  const triggerRef = useRef(null)
  const tipRef = useRef(null)
  const timer = useRef(null)
  const [open, setOpen] = useState(false)

  const schedule = useCallback((nextOpen, delay) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(nextOpen), delay)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const position = useCallback(() => {
    const trigger = triggerRef.current.getBoundingClientRect()
    const tip = tipRef.current
    const { offsetWidth: width, offsetHeight: height } = tip

    const above = trigger.top - height - GAP
    const below = trigger.bottom + GAP
    const fitsAbove = above >= EDGE
    const fitsBelow = below + height <= window.innerHeight - EDGE
    const side = placement === 'bottom' ? (fitsBelow || !fitsAbove ? 'bottom' : 'top') : fitsAbove || !fitsBelow ? 'top' : 'bottom'

    const centre = trigger.left + trigger.width / 2
    const left = Math.min(Math.max(centre - width / 2, EDGE), window.innerWidth - width - EDGE)

    tip.dataset.side = side
    tip.style.left = `${left}px`
    tip.style.top = `${side === 'top' ? above : below}px`
    // Keeps the arrow pointing at the trigger after moving sideways to fit.
    tip.style.setProperty('--arrow-x', `${centre - left}px`)
  }, [placement])

  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!open) {
      // The test browser has no popover support, so check before using it.
      if (tip.hidePopover && tip.matches(':popover-open')) tip.hidePopover()
      return undefined
    }

    tip.showPopover?.()
    position()

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      // Only the tooltip closes. A modal underneath stays open until the next Esc.
      event.preventDefault()
      event.stopPropagation()
      clearTimeout(timer.current)
      setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', position, true)
      window.removeEventListener('resize', position)
    }
  }, [open, position])

  // A tooltip that repeats an icon button's label would be read out twice, so
  // it only becomes the description when it says something new.
  const repeatsLabel = content === children.props['aria-label']
  const describedBy = classNames(children.props['aria-describedby'], !repeatsLabel && id) || undefined

  return (
    <span
      ref={triggerRef}
      className={styles.trigger}
      onPointerEnter={() => schedule(true, SHOW_DELAY)}
      onPointerLeave={() => schedule(false, HIDE_DELAY)}
      onFocus={() => schedule(true, 0)}
      onBlur={() => schedule(false, 0)}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        popover="manual"
        data-open={open || undefined}
        className={classNames(styles.tooltip, placement === 'bottom' && styles.bottom)}
      >
        {content}
      </span>
    </span>
  )
}
