import { flushSync } from 'react-dom'

/**
 * Shows a form's errors, then moves focus to the first field with one, in the
 * order they appear. A group of choices, such as the moods, gets focus on its
 * first option.
 *
 * flushSync draws the errors first, so the fields are already marked invalid
 * when we look for them.
 */
export function showErrorsAndFocus(form, showErrors) {
  flushSync(showErrors)
  form.querySelector('[aria-invalid="true"], [data-invalid] input')?.focus()
}
