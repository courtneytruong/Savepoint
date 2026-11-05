import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './Toast.module.css'
import { classNames } from './classNames.js'
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon } from './icons.js'
import { ToastContext } from './toastContext.js'

const DEFAULT_DURATION = 5000
const MAX_VISIBLE = 4

const ICONS = { success: SuccessIcon, info: InfoIcon, error: ErrorIcon }

function ToastItem({ toast, onDismiss }) {
  const { id, title, description, tone, action, duration } = toast
  const [paused, setPaused] = useState(false)
  const Icon = ICONS[tone]

  useEffect(() => {
    if (!duration || paused) return undefined
    const timer = setTimeout(() => onDismiss(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, paused, onDismiss])

  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={classNames(styles.toast, styles[tone])}
      // Stays open while it's being read or used, so it can't vanish mid-sentence.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.icon}>
        <Icon aria-hidden="true" />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onClick()
            onDismiss(id)
          }}
        >
          {action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" className={styles.dismiss} onClick={() => onDismiss(id)}>
        <CloseIcon aria-hidden="true" />
      </button>
    </div>
  )
}

/** Goes around the whole app, and makes useToast available inside it. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(({ tone = 'success', duration, ...toast }) => {
    const id = nextId.current++
    const lifetime = duration ?? (tone === 'error' ? null : DEFAULT_DURATION)
    setToasts((current) => [...current, { id, tone, duration: lifetime, ...toast }].slice(-MAX_VISIBLE))
    return id
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Always on the page, because screen readers only announce changes to a live
          region they already know about. */}
      <div role="region" aria-label="Notifications" aria-live="polite" className={styles.region}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
