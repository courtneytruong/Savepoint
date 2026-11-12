import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Link, LinkProvider } from '../components/index.js'

afterEach(cleanup)

// Stands in for React Router's Link: it takes `to`, and marks itself so the test
// can tell which one rendered.
function FakeRouterLink({ to, ...props }) {
  return <a href={to} data-router="yes" {...props} />
}

const link = () => screen.getByRole('link')

describe('Link', () => {
  it('is a plain link without a provider', () => {
    render(
      <Link href="/items/1" className="card">
        Piranesi
      </Link>,
    )
    expect(link().getAttribute('href')).toBe('/items/1')
    expect(link().className).toBe('card')
    expect(link().dataset.router).toBeUndefined()
  })

  it('uses the provider’s link for a path in the app, passing the other props on', () => {
    render(
      <LinkProvider component={FakeRouterLink}>
        <Link href="/items/1" className="card" aria-current="page">
          Piranesi
        </Link>
      </LinkProvider>,
    )
    expect(link().dataset.router).toBe('yes')
    expect(link().getAttribute('href')).toBe('/items/1')
    expect(link().className).toBe('card')
    expect(link().getAttribute('aria-current')).toBe('page')
  })

  it.each([
    ['a #hash, as the gallery uses', '#sign-in'],
    ['another site', 'https://example.com/'],
    ['an address starting with //', '//example.com/'],
    ['an email', 'mailto:reader@example.com'],
  ])('stays a plain link for %s, even with a provider', (_, href) => {
    render(
      <LinkProvider component={FakeRouterLink}>
        <Link href={href}>Somewhere</Link>
      </LinkProvider>,
    )
    expect(link().dataset.router).toBeUndefined()
    expect(link().getAttribute('href')).toBe(href)
  })
})
