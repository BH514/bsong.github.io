import type { CategoryId, Ingredient, ShelfItem, TagId, UtensilId } from './types.ts'

export type Row = readonly [
  id: string,
  name: string,
  icon: string,
  tags: readonly TagId[],
  utensil?: UtensilId,
]

/** Expands compact table rows into Ingredient records for one category. */
export function rows(category: CategoryId, table: readonly Row[]): readonly Ingredient[] {
  return table.map(([id, name, icon, tags, utensil]) =>
    utensil === undefined
      ? { id, name, category, icon, tags }
      : { id, name, category, icon, tags, utensil },
  )
}

export type ShelfRow = readonly [id: string, name: string, icon: string, tags: readonly TagId[]]

/** Shelf staples carry no category — they are never dealt into a slot. */
export function shelfRows(table: readonly ShelfRow[]): readonly ShelfItem[] {
  return table.map(([id, name, icon, tags]) => ({ id, name, icon, tags }))
}
