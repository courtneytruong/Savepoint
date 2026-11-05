import { useEffect, useId, useRef } from 'react'
import styles from './Modal.module.css'
import { classNames } from './classNames.js'
import { CloseIcon } from './icons.js'

/**
 * A dialog over the page. It uses the browser's own dialog element, which keeps
 * keyboard focus inside and returns it to where it was on closing.
 *
 * actions: the buttons at the bottom.
 * dismissible: set to false when closing by accident would lose work, such as a
 * half-written reflection. Esc, clicking outside and the X then do nothing, so
 * give the modal its own way out in actions.
 * initialFocusRef: what to focus on opening. Defaults to the first focusable item.
 *
 * The content only exists while open, so a form starts fresh each time.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  actions,
  dismissible = true,
  initialFocusRef,
  className,
  children,
  ...props
}) {
  const dialogRef = useRef(null)
  const pressedOnBackdrop = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      initialFocusRef?.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocusRef])

  function handleCancel(event) {
    // Esc would close the dialog directly. Whether it closes is decided by the
    // open prop, so the page's state and the dialog can't disagree.
    event.preventDefault()
    if (dismissible) onClose()
  }

  function handleBrowserClose() {
    if (!open) return
    // Some browsers force a dialog closed if Esc is pressed twice.
    if (dismissible) onClose()
    else dialogRef.current.showModal()
  }

  // Both the press and the release must be on the backdrop. Otherwise, dragging to
  // select text and letting go outside the modal would close it.
  function handleMouseDown(event) {
    pressedOnBackdrop.current = event.target === dialogRef.current
  }

  function handleClick(event) {
    if (dismissible && pressedOnBackdrop.current && event.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={classNames(styles.modal, className)}
      onCancel={handleCancel}
      onClose={handleBrowserClose}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      {...props}
    >
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button type="button" aria-label="Close" className={styles.close} onClick={onClose}>
                <CloseIcon aria-hidden="true" />
              </button>
            )}
          </div>
          {children && <div className={styles.body}>{children}</div>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
    </dialog>
  )
}
