import type { Category, TagId } from './types.ts'
import { TAGS } from './tags.ts'

export const CATEGORIES: readonly Category[] = [
  { id: 'protein', label: 'Protein' },
  { id: 'vegetable', label: 'Vegetable' },
  { id: 'starch', label: 'Starch' },
  { id: 'aromatic', label: 'Aromatic' },
  { id: 'wildcard', label: 'Wildcard' },
]

export const ALL_TAG_IDS: readonly TagId[] = TAGS.map((tag) => tag.id)

export { TAGS }
