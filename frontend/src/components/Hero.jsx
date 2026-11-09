import styles from './Hero.module.css'
import { classNames } from '../utils/classNames.js'

/**
 * The top of a main page: centred intro text, with a panel underneath. The panel
 * is usually a GlowFrame, and its light rises behind the intro text.
 */
export function Hero({ panel, className, children, ...props }) {
  return (
    <section className={classNames(styles.hero, className)} {...props}>
      <div className={styles.inner}>
        <div className={styles.intro}>{children}</div>
        {panel && <div className={styles.panel}>{panel}</div>}
      </div>
    </section>
  )
}
