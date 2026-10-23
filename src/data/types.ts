export type CategoryId = 'protein' | 'vegetable' | 'starch' | 'aromatic' | 'wildcard'

export type TagId =
  | 'pork' | 'shellfish' | 'dairy' | 'gluten'
  | 'nuts' | 'spicy' | 'meat' | 'animal'

export type UtensilId =
  | 'knife' | 'cleaver' | 'whisk' | 'pan'
  | 'wok' | 'rolling-pin' | 'tongs' | 'spoon'

export interface Ingredient {
  readonly id: string
  readonly name: string
  readonly category: CategoryId
  readonly icon: string
  readonly tags: readonly TagId[]
  readonly utensil?: UtensilId
}

export interface Category {
  readonly id: CategoryId
  readonly label: string
}

export interface Tag {
  readonly id: TagId
  readonly label: string
}

export type ShelfItem = Omit<Ingredient, 'category' | 'utensil'>
