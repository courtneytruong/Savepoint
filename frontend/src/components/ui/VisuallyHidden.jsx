import styles from './VisuallyHidden.module.css'

/** Text only for screen readers, such as a pause between a label and its count. */
export function VisuallyHidden({ as: Element = 'span', ...props }) {
  return <Element className={styles.hidden} {...props} />
}
