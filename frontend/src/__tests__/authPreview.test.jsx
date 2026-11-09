import { cleanup, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthPreview } from '../gallery/AuthPreview.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Some browsers return a Promise from scrollTo. An effect that returned it would
// crash when React ran it as a clean-up, which StrictMode does straight away.
it('survives a scrollTo that returns a Promise', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => Promise.resolve())

  const { unmount } = render(
    <StrictMode>
      <AuthPreview />
    </StrictMode>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeTruthy()
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  expect(() => unmount()).not.toThrow()
})
