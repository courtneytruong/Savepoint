import styles from './Header.module.css'
import { classNames } from '../../utils/classNames.js'

/** The top bar. Children are the navigation links; actions sit on the right. */
export function Header({ brand, actions, className, children, ...props }) {
  return (
    <header className={classNames(styles.header, className)} {...props}>
      <div className={styles.inner}>
        {brand && <div className={styles.brand}>{brand}</div>}
        {children && (
          <nav className={styles.nav} aria-label="Main">
            {children}
          </nav>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  )
}
