export type ChefId = 'grill' | 'pastry' | 'stirfry' | 'saucier' | 'nonna' | 'punk'

export type HatStyle = 'toque' | 'tall-toque' | 'bandana' | 'headscarf' | 'cap'
export type HairStyle = 'none' | 'bun' | 'beard' | 'moustache' | 'undercut'

export interface Chef {
  readonly id: ChefId
  readonly name: string
  readonly skin: string
  readonly coat: string
  readonly accent: string
  readonly hat: HatStyle
  readonly hair: HairStyle
}

export const ROSTER: readonly Chef[] = [
  { id: 'grill', name: 'The Grill', skin: '#e8b48c', coat: '#f4f7fb', accent: '#19e3ff', hat: 'tall-toque', hair: 'moustache' },
  { id: 'pastry', name: 'The Pastry', skin: '#f0c9a6', coat: '#fdf3e3', accent: '#ff9ec4', hat: 'bandana', hair: 'bun' },
  { id: 'stirfry', name: 'The Wok', skin: '#8d5a3b', coat: '#1e2633', accent: '#ff6a4d', hat: 'bandana', hair: 'beard' },
  { id: 'saucier', name: 'The Saucier', skin: '#c98a5e', coat: '#ffffff', accent: '#ffd400', hat: 'toque', hair: 'beard' },
  { id: 'nonna', name: 'The Nonna', skin: '#d79a6e', coat: '#6b8f6e', accent: '#f2e3c6', hat: 'headscarf', hair: 'none' },
  { id: 'punk', name: 'The Punk', skin: '#6f4328', coat: '#15181f', accent: '#b9ff3d', hat: 'cap', hair: 'undercut' },
]

export const CHEF_IDS: readonly ChefId[] = ROSTER.map((chef) => chef.id)

export function chefById(id: ChefId): Chef | undefined {
  return ROSTER.find((chef) => chef.id === id)
}
