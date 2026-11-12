import { useState } from 'react'
import { Alert } from '../feedback/Alert.jsx'
import { SIGN_IN_ERRORS, validateSignIn } from '../../rules/authRules.js'
import styles from './AuthForm.module.css'
import { Button } from '../ui/Button.jsx'
import { classNames } from '../../utils/classNames.js'
import { Input, PasswordField } from '../forms/Field.jsx'
import { useAuthSubmit } from '../../hooks/useAuthSubmit.js'

// Problems with the whole sign-in, rather than one field, shown above the form.
const FORM_ERRORS = {
  tooManyTries: {
    title: 'Too many tries',
    body: 'To keep your account safe, signing in is paused for a few minutes. Wait, then try again.',
  },
  failed: {
    title: "Couldn't sign in",
    body: "Something went wrong on Savepoint's server. Try again.",
  },
}

/**
 * Signing in with an email and password. Mistakes the form can spot, such as an
 * empty password, show before anything is sent. What only the API knows shows
 * after: an unknown email or a wrong password on its field, anything else above
 * the form. Focus moves to the first problem either way.
 *
 * onSubmit receives { email, password }, with the email trimmed, and returns a
 * Promise. It resolves with nothing when signed in, or with { error } naming what
 * went wrong: unknownEmail, wrongPassword, tooManyTries or failed. If it throws,
 * as when the server can't be reached, that counts as failed.
 *
 * createAccountHref: where "Create an account" goes, offered with an unknown email.
 */
export function SignInForm({ onSubmit, createAccountHref, className }) {
  const [values, setValues] = useState({ email: '', password: '' })
  const { errors: checkErrors, serverError, setServerError, loading, handleSubmit, formRef, alertRef } = useAuthSubmit({
    values,
    validate: validateSignIn,
    send: () => onSubmit({ email: values.email.trim(), password: values.password }),
    knownErrors: SIGN_IN_ERRORS,
    formErrors: Object.keys(FORM_ERRORS),
  })

  // A copy, because what a hook returns mustn't be changed.
  const errors = { ...checkErrors }
  if (serverError === 'unknownEmail' && !errors.email) {
    errors.email = createAccountHref ? (
      <>
        No account uses that email. <a href={createAccountHref}>Create an account</a>?
      </>
    ) : (
      'No account uses that email.'
    )
  }
  if (serverError === 'wrongPassword' && !errors.password) errors.password = 'That password is wrong.'
  const formError = FORM_ERRORS[serverError]

  const update = (field) => (event) => {
    setValues({ ...values, [field]: event.target.value })
    // An answer about this field no longer applies once it's changed.
    if ((field === 'email' && serverError === 'unknownEmail') || (field === 'password' && serverError === 'wrongPassword')) {
      setServerError(null)
    }
  }

  return (
    // noValidate, so the browser's own popups don't replace these messages.
    <form ref={formRef} noValidate onSubmit={handleSubmit} className={classNames(styles.form, className)}>
      {formError && (
        <Alert ref={alertRef} tabIndex={-1} tone="error" title={formError.title}>
          {formError.body}
        </Alert>
      )}
      <Input
        label="Email"
        type="email"
        // "username" is what password managers look for beside a current password.
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={values.email}
        onChange={update('email')}
        error={errors.email}
      />
      <PasswordField
        label="Password"
        autoComplete="current-password"
        value={values.password}
        onChange={update('password')}
        error={errors.password}
      />
      <Button type="submit" loading={loading} className={styles.submit}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
