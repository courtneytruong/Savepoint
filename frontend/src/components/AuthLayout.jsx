import styles from './AuthLayout.module.css'
import { GlowFrame } from './Card.jsx'
import { classNames } from './classNames.js'
import { Heading, Text } from './Typography.jsx'

/**
 * The page around signing in or creating an account: the brand, then a glowing
 * panel with the title and form, then a line for switching to the other one.
 * There's no header or sidebar, since none of their links work signed out.
 *
 * brand: links to the app's home, which sends a signed-out person back here.
 * switchTo: the line under the panel, such as "New here? Create an account".
 */
export function AuthLayout({ brand = 'Savepoint', brandHref = '/', title, description, switchTo, className, children }) {
  return (
    <main className={classNames(styles.page, className)}>
      <a href={brandHref} className={styles.brand}>
        {brand}
      </a>

      <GlowFrame className={styles.panel}>
        <div className={styles.intro}>
          <Heading as="h1" size="large" className={styles.title}>
            {title}
          </Heading>
          {description && <Text className={styles.description}>{description}</Text>}
        </div>
        {children}
      </GlowFrame>

      {switchTo && <p className={styles.switch}>{switchTo}</p>}
    </main>
  )
}
