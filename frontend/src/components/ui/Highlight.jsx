import styles from '../forms/Combobox.module.css'

/** Marks the part of a suggestion that matches what was typed. */
export function Highlight({ text, query }) {
  const wanted = query.trim().toLocaleLowerCase()
  const start = wanted ? text.toLocaleLowerCase().indexOf(wanted) : -1
  if (start === -1) return text
  return (
    <>
      {text.slice(0, start)}
      <mark className={styles.match}>{text.slice(start, start + wanted.length)}</mark>
      {text.slice(start + wanted.length)}
    </>
  )
}
