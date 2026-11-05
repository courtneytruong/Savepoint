/** Joins class names, skipping any that are empty or switched off. */
export function classNames(...names) {
  return names.filter(Boolean).join(' ')
}
