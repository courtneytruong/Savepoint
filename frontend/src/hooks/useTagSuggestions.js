import { useEffect, useState } from 'react'
import { getTags } from '../api/tags.js'

/**
 * The person's tag names, to suggest while they type, loaded afresh each time open
 * turns true, so tags made since the last save are there. Until they load, and if
 * they can't, it keeps what it had: tags can still be typed without suggestions,
 * so a failure isn't worth interrupting a reflection for.
 */
export function useTagSuggestions(open) {
  const [tags, setTags] = useState([])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    getTags({ signal: controller.signal }).then(setTags, () => {})
    return () => controller.abort()
  }, [open])

  return tags
}
