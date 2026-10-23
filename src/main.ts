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
}

draw()
