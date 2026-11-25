import { createContext, useContext, useEffect, useRef } from 'react'
import styles from './Sidebar.module.css'
import { classNames } from '../../utils/classNames.js'
import { CollapseSidebarIcon, ExpandSidebarIcon } from '../icons.js'
import { VisuallyHidden } from '../ui/VisuallyHidden.jsx'
import { Link } from '../ui/Link.jsx'
import { Tooltip } from '../ui/Tooltip.jsx'

// Whether the sidebar is collapsed, so its links know to show only their icons.
const CollapsedContext = createContext(false)

/** Puts a sidebar beside the main content. On small screens it moves above it. */
export function SidebarLayout({ sidebar, className, children, ...props }) {
  return (
    <div className={classNames(styles.layout, className)} {...props}>
      {sidebar}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

/**
 * Side navigation. The label tells it apart from the header's navigation.
 *
 * collapsed: shrinks it to a rail of icons on wide screens. Each link keeps its
 * name for screen readers and shows it as a tooltip. Small screens always show
 * the strip of links, which has nothing to collapse.
 * onCollapsedChange: called with the new value when the toggle is pressed.
 * Without it there's no toggle.
 */
export function Sidebar({ label = 'Sections', collapsed = false, onCollapsedChange, className, children, ...props }) {
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
    <nav
      ref={navRef}
      aria-label={label}
      className={classNames(styles.sidebar, collapsed && styles.collapsed, className)}
      {...props}
    >
      {onCollapsedChange && <CollapseToggle collapsed={collapsed} onChange={onCollapsedChange} />}
      <CollapsedContext value={collapsed}>{children}</CollapsedContext>
    </nav>
  )
}

// The label says what pressing it does, so there's no separate on or off state
// for screen readers to announce as well.
function CollapseToggle({ collapsed, onChange }) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  const Icon = collapsed ? ExpandSidebarIcon : CollapseSidebarIcon
  return (
    <div className={styles.toggleRow}>
      <Tooltip content={label}>
        <button type="button" aria-label={label} className={styles.toggle} onClick={() => onChange(!collapsed)}>
          <Icon aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
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
  const collapsed = useContext(CollapsedContext)
  const link = (
    <Link
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
      {count !== undefined && (
        <>
          {/* Without it, screen readers run the label and count together, as "Library11". */}
          <VisuallyHidden>, </VisuallyHidden>
          <span className={styles.count}>{count}</span>
        </>
      )}
    </Link>
  )

  // Collapsed, the name is only visually hidden, so the link's name stays the
  // same and the tooltip is just for people who can see the icons.
  return (
    <li>
      {collapsed ? (
        <Tooltip content={children} describes={false}>
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  )
}
