import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

/**
 * Shows notifications. Call it as `const toast = useToast()`, then:
 *
 * toast.show({ title, description, tone, action, duration })
 *
 * tone: success (default), info, or error.
 * action: { label, onClick }, such as an Undo button.
 * duration: milliseconds before it goes away. Errors stay until dismissed.
 *
 * While a modal is open, toasts sit behind it and can't be clicked, because the
 * browser blocks everything outside a modal. So close the modal before showing a
 * toast, and show a failed save as an error inside the modal, beside the form.
 */
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast needs a ToastProvider above it.')
  return toast
}
