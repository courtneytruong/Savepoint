import { describe, expect, it } from 'vitest'
import { countMoods, filterReflections } from './index.js'

const book = { medium: 'Book' }
const game = { medium: 'Game' }
const REFLECTIONS = [
  { id: 1, item: book, mood: 'Curious', tags: ['theory', 'Worldbuilding'] },
  { id: 2, item: game, mood: 'Curious', tags: ['boss'] },
  { id: 3, item: game, mood: 'Moved', tags: ['ending'] },
  { id: 4, item: book, mood: 'Moved' },
]
const ids = (reflections) => reflections.map((reflection) => reflection.id)

describe('filterReflections', () => {
  it('keeps everything with no filters', () => {
    expect(ids(filterReflections(REFLECTIONS))).toEqual([1, 2, 3, 4])
  })

  it('filters by medium, mood and tag', () => {
    expect(ids(filterReflections(REFLECTIONS, { medium: 'Game' }))).toEqual([2, 3])
    expect(ids(filterReflections(REFLECTIONS, { mood: 'Moved' }))).toEqual([3, 4])
    expect(ids(filterReflections(REFLECTIONS, { tag: 'boss' }))).toEqual([2])
  })

  it('needs every filter to match', () => {
    expect(ids(filterReflections(REFLECTIONS, { medium: 'Book', mood: 'Curious' }))).toEqual([1])
    expect(ids(filterReflections(REFLECTIONS, { medium: 'Book', tag: 'boss' }))).toEqual([])
  })

  it('matches tags ignoring case and accents', () => {
    expect(ids(filterReflections(REFLECTIONS, { tag: 'worldbuilding' }))).toEqual([1])
    expect(ids(filterReflections(REFLECTIONS, { tag: 'Théory' }))).toEqual([1])
  })

  it('skips reflections without tags when filtering by one', () => {
    expect(ids(filterReflections(REFLECTIONS, { tag: 'ending' }))).toEqual([3])
  })
})

describe('countMoods', () => {
  it('counts each mood, leaving out moods with none', () => {
    expect(countMoods(REFLECTIONS)).toEqual({ Curious: 2, Moved: 2 })
    expect(countMoods([])).toEqual({})
  })
})
