import { useCallback, useLayoutEffect } from 'react'

const GAP = 4
const EDGE = 8
const MAX_HEIGHT = 320
const MIN_WIDTH = 280

/**
 * Shows a suggestion list under its field while open, or above it when there's
 * more room there, and keeps it in place as the page scrolls or resizes.
 *
 * The popup should be a popover="manual" element, so it sits in the browser's
 * top layer, like a tooltip, and a panel's edges can't cut it off.
 */
export function useAnchoredPopup(open, anchorRef, popupRef) {
  const position = useCallback(() => {
    const field = anchorRef.current.getBoundingClientRect()
    const popup = popupRef.current
    const below = window.innerHeight - field.bottom - GAP - EDGE
    const above = field.top - GAP - EDGE
    const side = below >= 200 || below >= above ? 'bottom' : 'top'
    const width = Math.min(Math.max(field.width, MIN_WIDTH), window.innerWidth - EDGE * 2)
    const left = Math.min(Math.max(field.right - width, EDGE), window.innerWidth - width - EDGE)

    popup.style.left = `${left}px`
    popup.style.width = `${width}px`
    popup.style.maxHeight = `${Math.min(MAX_HEIGHT, side === 'bottom' ? below : above)}px`
    if (side === 'bottom') {
      popup.style.top = `${field.bottom + GAP}px`
      popup.style.bottom = 'auto'
    } else {
      popup.style.top = 'auto'
      popup.style.bottom = `${window.innerHeight - field.top + GAP}px`
    }
  }, [anchorRef, popupRef])

  useLayoutEffect(() => {
    const popup = popupRef.current
    if (!open) {
      // The test browser has no popover support, so check before using it.
      if (popup.hidePopover && popup.matches(':popover-open')) popup.hidePopover()
      return undefined
    }

    popup.showPopover?.()
    position()
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    return () => {
      window.removeEventListener('scroll', position, true)
      window.removeEventListener('resize', position)
    }
  }, [open, position, popupRef])
}
