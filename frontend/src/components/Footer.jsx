import styles from './Footer.module.css'
import { classNames } from '../utils/classNames.js'

/**
 * The bottom of every page. Children are links, and note is a short line under
 * the brand. bottom is for small print, such as the version.
 */
export function Footer({ brand, note, bottom, className, children, ...props }) {
  return (
    <footer className={classNames(styles.footer, className)} {...props}>
      <div className={styles.inner}>
        <div className={styles.about}>
          {brand && <div className={styles.brand}>{brand}</div>}
          {note && <p className={styles.note}>{note}</p>}
        </div>
        {children && (
          <nav aria-label="Footer" className={styles.links}>
            {children}
          </nav>
        )}
      </div>
      {bottom && <div className={styles.bottom}>{bottom}</div>}
    </footer>
  )
}
