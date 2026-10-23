import type { CategoryId, Ingredient, TagId } from './data/types.ts'
import { CATEGORIES } from './data/categories.ts'

export type Pantry = Readonly<Record<CategoryId, readonly Ingredient[]>>

/** Drops every item carrying at least one excluded tag. */
export function excludeTags<T extends { readonly tags: readonly TagId[] }>(
  pool: readonly T[],
  excluded: readonly TagId[],
): readonly T[] {
  if (excluded.length === 0) return pool
  const blocked = new Set(excluded)
  return pool.filter((item) => !item.tags.some((tag) => blocked.has(tag)))
}

export function filterPantry(pantry: Pantry, excluded: readonly TagId[]): Pantry {
  const entries = CATEGORIES.map(
    (category) => [category.id, excludeTags(pantry[category.id], excluded)] as const,
  )
  return Object.fromEntries(entries) as Pantry
}
