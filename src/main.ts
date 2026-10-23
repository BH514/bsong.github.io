import './styles/tokens.css'
import './styles/global.css'
import './styles/select.css'

import { renderSelect } from './ui/select.ts'
import { loadSaved, saveSaved, type Saved } from './storage.ts'
import type { ChefId } from './chefs/roster.ts'
import type { TagId } from './data/types.ts'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app is missing from index.html')
const app: HTMLElement = root

let saved: Saved = loadSaved(window.localStorage)

function update(next: Saved): void {
  saved = next
  saveSaved(window.localStorage, saved)
  draw()
}

function draw(): void {
  const active = document.activeElement
  const focusKey = active instanceof HTMLElement ? active.dataset['focusKey'] : undefined

  app.replaceChildren(
    renderSelect({
      chefs: saved.chefs,
      excluded: saved.excluded,
      onPickChef: (player, chef: ChefId) => {
        const chefs: [ChefId | null, ChefId | null] = [saved.chefs[0], saved.chefs[1]]
        chefs[player] = chef
        update({ ...saved, chefs })
      },
      onToggleTag: (tag: TagId) => {
        const excluded = saved.excluded.includes(tag)
          ? saved.excluded.filter((item) => item !== tag)
          : [...saved.excluded, tag]
        update({ ...saved, excluded })
      },
      onStart: () => {
        // Task 9 wires the stage.
      },
    }),
  )

  if (focusKey !== undefined) {
    const chefMatch = focusKey.match(/^chef-(\d+)-/)
    if (chefMatch && chefMatch[1]) {
      const player = parseInt(chefMatch[1], 10) as 0 | 1
      const selectedChefId = saved.chefs[player]
      if (selectedChefId !== null) {
        const restored = app.querySelector<HTMLElement>(`[data-focus-key="chef-${player}-${selectedChefId}"]`)
        restored?.focus()
      }
    } else {
      const restored = app.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)
      restored?.focus()
    }
  }
}

draw()
