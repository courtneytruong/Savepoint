import { useEffect, useRef } from 'react'
import styles from './Sidebar.module.css'
import { classNames } from './classNames.js'

/** Puts a sidebar beside the main content. On small screens it moves above it. */
export function SidebarLayout({ sidebar, className, children, ...props }) {
  return (
    <div className={classNames(styles.layout, className)} {...props}>
      {sidebar}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

/** Side navigation. The label tells it apart from the header's navigation. */
export function Sidebar({ label = 'Sections', className, children, ...props }) {
  const navRef = useRef(null)

  // On small screens the links scroll sideways, so bring the current page's link
  // into view. Only the strip scrolls, never the page itself.
  useEffect(() => {
    const nav = navRef.current
    const current = nav.querySelector('[aria-current="page"]')
    if (!current || nav.scrollWidth <= nav.clientWidth) return
    const start = current.offsetLeft - nav.offsetLeft
    const end = start + current.offsetWidth
    if (start < nav.scrollLeft) nav.scrollLeft = start - 12
    else if (end > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = end - nav.clientWidth + 12
  })

  return (
    <nav ref={navRef} aria-label={label} className={classNames(styles.sidebar, className)} {...props}>
      {children}
    </nav>
  )
}

/** A titled set of links in the sidebar. */
export function SidebarGroup({ title, children }) {
  return (
    <div className={styles.group}>
      {title && <p className={styles.title}>{title}</p>}
      <ul className={styles.links}>{children}</ul>
    </div>
  )
}

/** One link. Mark the page you're on with active. */
export function SidebarLink({ icon, count, active = false, className, children, ...props }) {
  return (
    <li>
      <a
        aria-current={active ? 'page' : undefined}
        className={classNames(styles.link, active && styles.active, className)}
        {...props}
      >
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.name}>{children}</span>
        {count !== undefined && <span className={styles.count}>{count}</span>}
      </a>
    </li>
  )
}
