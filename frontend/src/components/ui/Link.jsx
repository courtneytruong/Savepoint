import { createContext, createElement, useContext } from 'react'

const LinkContext = createContext(null)

/**
 * A link that components render in place of a plain <a>, so they take an href
 * and never depend on a router.
 *
 * Under a LinkProvider, such as the app's React Router one, a link to a path in
 * the app (starting with "/") changes the page without reloading it. Any other
 * link stays a plain <a>: a #hash, which moves within the page as the
 * /components gallery's pages do, or an address on another site. Without a
 * provider, every link is a plain <a>.
 */
export function Link({ href, ...props }) {
  const RouterLink = useContext(LinkContext)
  // "//" starts an address on another site, so only a single slash is in the app.
  const inApp = typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')
  // createElement, because JSX with a component held in a variable looks to the
  // linter like one made during render, which would lose its state each time.
  // This one comes from the provider, and is the same on every render.
  if (RouterLink && inApp) return createElement(RouterLink, { to: href, ...props })
  return <a href={href} {...props} />
}

/**
 * Makes every Link inside it use component for paths in the app. component
 * receives `to` and the link's other props, as React Router's Link does.
 */
export function LinkProvider({ component, children }) {
  return <LinkContext value={component}>{children}</LinkContext>
}
