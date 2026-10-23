import type { Category, CategoryId, TagId } from './types.ts'
import { TAGS } from './tags.ts'

export const CATEGORIES: readonly Category[] = [
  { id: 'protein', label: 'Protein' },
  { id: 'vegetable', label: 'Vegetable' },
  { id: 'starch', label: 'Starch' },
  { id: 'aromatic', label: 'Aromatic' },
  { id: 'wildcard', label: 'Wildcard' },
]

export const CATEGORY_LABELS: ReadonlyMap<CategoryId, string> = new Map(
  CATEGORIES.map((category) => [category.id, category.label]),
)

/** Tag ids are internal; user-visible copy always goes through these labels. */
export const TAG_LABELS: ReadonlyMap<TagId, string> = new Map(
  TAGS.map((tag) => [tag.id, tag.label]),
)

export const ALL_TAG_IDS: readonly TagId[] = TAGS.map((tag) => tag.id)

export { TAGS }
