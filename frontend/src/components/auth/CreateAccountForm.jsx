import { useState } from 'react'
import { Alert } from '../feedback/Alert.jsx'
import { CREATE_ACCOUNT_ERRORS, MIN_PASSWORD_LENGTH, validateNewAccount } from '../../rules/authRules.js'
import styles from './AuthForm.module.css'
import { Button } from '../ui/Button.jsx'
import { classNames } from '../../utils/classNames.js'
import { Input, PasswordField } from '../forms/Field.jsx'
import { LengthCounter } from '../forms/LengthCounter.jsx'
import { useAuthSubmit } from '../../hooks/useAuthSubmit.js'

const FAILED = {
  title: "Couldn't create your account",
  body: "Savepoint's server didn't answer. Check that it's running, then try again.",
}

/**
 * Creating an account: a name, an email and a password, checked against the
 * rules in docs/data-model.md before anything is sent. The password counts
 * toward its minimum as you type, and there's no second box to repeat it in,
 * since its eye button shows what was typed.
 *
 * onSubmit receives { displayName, email, password }, with the name and email
 * trimmed, and returns a Promise. It resolves with nothing once the account
 * exists, or with { error }: emailTaken, shown on the email field, or failed,
 * shown above the form. If it throws, that counts as failed.
 *
 * signInHref: where "Sign in" goes, offered when the email already has an account.
 */
export function CreateAccountForm({ onSubmit, signInHref, className }) {
  const [values, setValues] = useState({ displayName: '', email: '', password: '' })
  const { errors, serverError, setServerError, loading, handleSubmit, formRef, alertRef } = useAuthSubmit({
    values,
    validate: validateNewAccount,
    send: () =>
      onSubmit({ displayName: values.displayName.trim(), email: values.email.trim(), password: values.password }),
    knownErrors: CREATE_ACCOUNT_ERRORS,
    formErrors: ['failed'],
  })

  if (serverError === 'emailTaken' && !errors.email) {
    errors.email = signInHref ? (
      <>
        That email already has an account. <a href={signInHref}>Sign in</a> instead?
      </>
    ) : (
      'That email already has an account.'
    )
  }

  const update = (field) => (event) => {
    setValues({ ...values, [field]: event.target.value })
    if (field === 'email' && serverError === 'emailTaken') setServerError(null)
  }

  return (
    // noValidate, so the browser's own popups don't replace these messages.
    <form ref={formRef} noValidate onSubmit={handleSubmit} className={classNames(styles.form, className)}>
      {serverError === 'failed' && (
        <Alert ref={alertRef} tabIndex={-1} tone="error" title={FAILED.title}>
          {FAILED.body}
        </Alert>
      )}
      <Input
        label="Your name"
        hint="What Savepoint calls you."
        autoComplete="name"
        value={values.displayName}
        onChange={update('displayName')}
        error={errors.displayName}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={values.email}
        onChange={update('email')}
        error={errors.email}
      />
      <PasswordField
        label="Password"
        autoComplete="new-password"
        hint={<LengthCounter length={values.password.length} min={MIN_PASSWORD_LENGTH} />}
        value={values.password}
        onChange={update('password')}
        error={errors.password}
      />
      <Button type="submit" loading={loading} className={styles.submit}>
        {loading ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  )
}
