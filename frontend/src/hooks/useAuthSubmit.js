import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { showErrorsAndFocus } from '../utils/focusFirstProblem.js'

/**
 * How the auth forms submit: check the fields, send, show that it's working,
 * then show the API's answer and move focus to it.
 *
 * values: the form's fields. validate: returns an error message per field.
 * send: calls the API with what it should receive, and returns a Promise of
 * nothing on success or { error } naming what went wrong. If it throws, as when
 * the server can't be reached, that counts as failed, as does any error not in
 * knownErrors.
 * formErrors: the errors about the whole form, shown in an alert. The rest are
 * about a field, which the form shows on it.
 *
 * Returns the field errors to show, the server's answer, whether it's sending,
 * the submit handler, and refs for the form and its alert.
 */
export function useAuthSubmit({ values, validate, send, knownErrors, formErrors }) {
  const [triedToSave, setTriedToSave] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)
  const alertRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return

    if (Object.keys(validate(values)).length > 0) {
      showErrorsAndFocus(formRef.current, () => {
        setTriedToSave(true)
        setServerError(null)
      })
      return
    }

    setServerError(null)
    setLoading(true)
    let result
    try {
      result = await send()
    } catch {
      result = { error: 'failed' }
    }
    setLoading(false)

    const error = result?.error
    if (!error) return
    // An answer the form doesn't recognise still needs saying, so it counts as failed.
    const kind = knownErrors.includes(error) ? error : 'failed'
    if (formErrors.includes(kind)) {
      flushSync(() => setServerError(kind))
      alertRef.current?.focus()
    } else {
      showErrorsAndFocus(formRef.current, () => setServerError(kind))
    }
  }

  return {
    errors: triedToSave ? validate(values) : {},
    serverError,
    setServerError,
    loading,
    handleSubmit,
    formRef,
    alertRef,
  }
}
