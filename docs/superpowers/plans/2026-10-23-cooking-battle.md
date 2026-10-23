# Cooking Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static two-player ingredient-generation game that deals two balanced hands of five into one shared counter of ten, styled as an arcade fighter-select screen with chef figurines.

**Architecture:** Pure logic modules (`rng`, `filters`, `deal`, `storage`, `figurine`) with no DOM dependency, unit-tested with `node --test`. A thin DOM layer (`ui/select`, `ui/stage`, `ui/svg`) renders them, covered by Playwright. `main.ts` owns immutable state and wires the two together. Data lives in small per-category files.

**Tech Stack:** TypeScript 5.9, Vite 7, Node 22.18+ (24 in CI), Playwright 1.56, `node --test`. **Zero runtime dependencies.**

**Spec:** `docs/superpowers/specs/2026-10-23-cooking-battle-design.md`

**Branch:** `feat/cooking-battle` (already created; do not work on `main` — `pages.yml` deploys on every push to `main`)

**Design reference:** the approved visual mockup lives at `.superpowers/brainstorm/83128-1792769259/content/figurines.html`. It is gitignored and local-only. Tasks 6–8 trace geometry and panel treatments from it.

## Global Constraints

- **Never generate recipes.** No dish names, no techniques, no pairings, no instruction text. Enforced by the content-guard test in Task 10.
- **Zero runtime dependencies.** `package.json` carries `devDependencies` only.
- **No network at runtime.** No remote fonts, images, analytics, or API calls. Enforced by Playwright in Task 9 and by artifact inspection in Task 10.
- Node `>=22.18.0`; CI uses Node 24.
- `vite.config.ts` must set `base: './'` so the build works at a repository subpath.
- All state immutable — every transition returns a new object. Never mutate a parameter.
- All exported functions get explicit parameter and return types. No `any`; use `unknown` and narrow.
- Motion only on `transform`, `opacity`, `filter`. Everything disabled under `prefers-reduced-motion: reduce`.
- Player-two **text** uses `#ff6a4d`. `#ff3b24` is for graphics and borders only (contrast).
- Build DOM and SVG with `createElement` / `createElementNS`. Never `innerHTML`.
- No file in `src/` exceeds 400 lines.
- Tag invariant: anything tagged `meat` or `dairy` must also carry `animal`. Excluding `meat` = vegetarian; excluding `animal` = vegan.

---

### Task 1: Scaffold, housekeeping, and the RNG

**Files:**
- Delete (commit existing working-tree deletions): `README.md`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `playwright.pages.config.ts`, `public/favicon.svg`, `src/main.ts`, `src/model.ts`, `src/scenarios.ts`, `src/style.css`, `src/visualization.ts`, `tests/model.test.ts`, `tests/browser/demo.spec.ts`, `tests/pages/deployment.spec.ts`
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `playwright.pages.config.ts`, `index.html`, `src/main.ts`, `src/rng.ts`
- Test: `tests/rng.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Rng = () => number`, `createRng(seed: number): Rng`, `shuffle<T>(items: readonly T[], rng: Rng): T[]`, `randomSeed(): number`

- [ ] **Step 1: Commit the removal of the old app**

The working tree already has 17 files deleted — Branching Futures was moved to `vs_ai_demo_ref/`, which is gitignored. Record that removal:

```bash
git rm -r --cached --quiet README.md index.html package.json package-lock.json tsconfig.json vite.config.ts playwright.config.ts playwright.pages.config.ts public src tests
git commit -m "chore: remove Branching Futures from the repository root

The app is kept locally in vs_ai_demo_ref/ as a design reference and is
gitignored. Cooking Battle takes over the published root."
```

- [ ] **Step 2: Write the failing RNG test**

Create `tests/rng.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRng, shuffle, randomSeed } from '../src/rng.ts'

test('the same seed produces the same sequence', () => {
  const a = createRng(42)
  const b = createRng(42)
  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
})

test('different seeds produce different sequences', () => {
  assert.notEqual(createRng(1)(), createRng(2)())
})

test('generated values stay in the unit interval', () => {
  const rng = createRng(7)
  for (let i = 0; i < 200; i += 1) {
    const value = rng()
    assert.ok(value >= 0 && value < 1, `out of range: ${value}`)
  }
})

test('shuffle returns a new array and leaves the input untouched', () => {
  const input = Object.freeze(['a', 'b', 'c', 'd'])
  const result = shuffle(input, createRng(3))
  assert.notEqual(result, input)
  assert.deepEqual([...input], ['a', 'b', 'c', 'd'])
  assert.deepEqual([...result].sort(), ['a', 'b', 'c', 'd'])
})

test('shuffle is deterministic for a given seed', () => {
  const input = ['a', 'b', 'c', 'd', 'e', 'f']
  assert.deepEqual(shuffle(input, createRng(9)), shuffle(input, createRng(9)))
})

test('randomSeed returns a non-negative integer', () => {
  const seed = randomSeed()
  assert.ok(Number.isInteger(seed) && seed >= 0)
})
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --test tests/rng.test.ts`
Expected: FAIL — cannot find module `../src/rng.ts`

- [ ] **Step 4: Write the scaffold and the RNG**

`package.json`:

```json
{
  "name": "cooking-battle",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.18.0" },
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "node --test tests/*.test.ts",
    "test:e2e": "playwright test",
    "test:pages": "npm run build && playwright test --config playwright.pages.config.ts"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "@types/node": "^22.18.0",
    "typescript": "~5.9.3",
    "vite": "^7.1.3"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
})
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
```

`playwright.pages.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/pages',
  fullyParallel: false,
  workers: 1,
})
```

`src/rng.ts`:

```ts
/** A seeded pseudo-random source returning values in [0, 1). */
export type Rng = () => number

/** Mulberry32. Small, fast, and good enough for dealing cards. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates on a copy. The input is never mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const a = result[i] as T
    const b = result[j] as T
    result[i] = b
    result[j] = a
  }
  return result
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0d14" />
    <meta name="description" content="A two-player ingredient game. Ten ingredients, two cooks, no recipes." />
    <title>Cooking Battle</title>
  </head>
  <body>
    <a class="skip-link" href="#app">Skip to the game</a>
    <main id="app" tabindex="-1"></main>
    <noscript>Cooking Battle needs JavaScript. Everything runs locally in your browser.</noscript>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts` (stub — Task 7 and Task 9 replace it):

```ts
const app = document.querySelector<HTMLElement>('#app')
if (app) {
  app.textContent = 'Cooking Battle'
}
```

- [ ] **Step 5: Install, test, and build**

Run: `npm install && node --test tests/rng.test.ts && npm run build`
Expected: all 6 RNG tests PASS; `tsc --noEmit` clean; `dist/` produced.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts playwright.config.ts playwright.pages.config.ts index.html src/rng.ts src/main.ts tests/rng.test.ts
git commit -m "feat: scaffold Cooking Battle with a seeded RNG"
```

---

### Task 2: Types and the ingredient pantry

**Files:**
- Create: `src/data/types.ts`, `src/data/row.ts`, `src/data/tags.ts`, `src/data/categories.ts`, `src/data/proteins.ts`, `src/data/vegetables.ts`, `src/data/starches.ts`, `src/data/aromatics.ts`, `src/data/wildcards.ts`, `src/data/shelf.ts`, `src/data/pantry.ts`
- Test: `tests/data.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type CategoryId`, `type TagId`, `type UtensilId`, `interface Ingredient`, `interface Category`, `interface Tag`, `CATEGORIES: readonly Category[]`, `TAGS: readonly Tag[]`, `ALL_TAG_IDS: readonly TagId[]`, `PANTRY: Readonly<Record<CategoryId, readonly Ingredient[]>>`, `ALL_INGREDIENTS: readonly Ingredient[]`, `SHELF: readonly Ingredient[]`

- [ ] **Step 1: Write the failing data test**

Create `tests/data.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, TAGS, ALL_TAG_IDS } from '../src/data/categories.ts'
import { PANTRY, SHELF, ALL_INGREDIENTS } from '../src/data/pantry.ts'

test('there are exactly five categories in slot order', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.id),
    ['protein', 'vegetable', 'starch', 'aromatic', 'wildcard'],
  )
})

test('every category holds at least thirty ingredients', () => {
  for (const category of CATEGORIES) {
    const pool = PANTRY[category.id]
    assert.ok(pool.length >= 30, `${category.id} has only ${pool.length}`)
  }
})

test('ingredient ids are unique across the whole pantry', () => {
  const ids = ALL_INGREDIENTS.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('every ingredient sits in the category pool it declares', () => {
  for (const category of CATEGORIES) {
    for (const ingredient of PANTRY[category.id]) {
      assert.equal(ingredient.category, category.id, `${ingredient.id} is misfiled`)
    }
  }
})

test('every ingredient has a name and an icon', () => {
  for (const ingredient of [...ALL_INGREDIENTS, ...SHELF]) {
    assert.ok(ingredient.name.length > 0, `${ingredient.id} has no name`)
    assert.ok(ingredient.icon.length > 0, `${ingredient.id} has no icon`)
  }
})

test('every ingredient uses only known tags', () => {
  for (const ingredient of [...ALL_INGREDIENTS, ...SHELF]) {
    for (const tag of ingredient.tags) {
      assert.ok(ALL_TAG_IDS.includes(tag), `${ingredient.id} has unknown tag ${tag}`)
    }
  }
})

test('anything tagged meat or dairy is also tagged animal', () => {
  for (const ingredient of [...ALL_INGREDIENTS, ...SHELF]) {
    if (ingredient.tags.includes('meat') || ingredient.tags.includes('dairy')) {
      assert.ok(ingredient.tags.includes('animal'), `${ingredient.id} is missing the animal tag`)
    }
  }
})

test('every starch declares a utensil and nothing else does', () => {
  for (const ingredient of PANTRY.starch) {
    assert.ok(ingredient.utensil, `${ingredient.id} has no utensil`)
  }
  const others = CATEGORIES.filter((c) => c.id !== 'starch').flatMap((c) => PANTRY[c.id])
  for (const ingredient of others) {
    assert.equal(ingredient.utensil, undefined, `${ingredient.id} should not declare a utensil`)
  }
})

test('all eight utensils are reachable from the starch pool', () => {
  const used = new Set(PANTRY.starch.map((i) => i.utensil))
  assert.deepEqual(
    [...used].sort(),
    ['cleaver', 'knife', 'pan', 'rolling-pin', 'spoon', 'tongs', 'whisk', 'wok'],
  )
})

test('every category still has two candidates with every tag excluded', () => {
  for (const category of CATEGORIES) {
    const survivors = PANTRY[category.id].filter((i) => i.tags.length === 0)
    assert.ok(survivors.length >= 2, `${category.id} would only leave ${survivors.length}`)
  }
})

test('each tag is used by at least one ingredient', () => {
  for (const tag of TAGS) {
    assert.ok(
      ALL_INGREDIENTS.some((i) => i.tags.includes(tag.id)),
      `tag ${tag.id} is never used`,
    )
  }
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/data.test.ts`
Expected: FAIL — cannot find module `../src/data/categories.ts`

- [ ] **Step 3: Write the types, row helper, tags, and categories**

`src/data/types.ts`:

```ts
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
```

`src/data/row.ts`:

```ts
import type { CategoryId, Ingredient, TagId, UtensilId } from './types.ts'

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
```

`src/data/tags.ts`:

```ts
import type { Tag } from './types.ts'

/** Phrased as exclusions: vegetarian excludes `meat`, vegan excludes `animal`. */
export const TAGS: readonly Tag[] = [
  { id: 'meat', label: 'Meat & fish' },
  { id: 'animal', label: 'Animal products' },
  { id: 'pork', label: 'Pork' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'nuts', label: 'Nuts & seeds' },
  { id: 'spicy', label: 'Spicy' },
]
```

`src/data/categories.ts`:

```ts
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
```

- [ ] **Step 4: Write the five ingredient tables and the shelf**

`src/data/proteins.ts`:

```ts
import { rows } from './row.ts'

export const PROTEINS = rows('protein', [
  ['chicken-thigh', 'Chicken thigh', '🍗', ['meat', 'animal']],
  ['chicken-breast', 'Chicken breast', '🍗', ['meat', 'animal']],
  ['duck-breast', 'Duck breast', '🦆', ['meat', 'animal']],
  ['turkey-mince', 'Turkey mince', '🦃', ['meat', 'animal']],
  ['pork-belly', 'Pork belly', '🥓', ['meat', 'pork', 'animal']],
  ['pork-shoulder', 'Pork shoulder', '🐖', ['meat', 'pork', 'animal']],
  ['bacon', 'Bacon', '🥓', ['meat', 'pork', 'animal']],
  ['chorizo', 'Chorizo', '🌭', ['meat', 'pork', 'animal', 'spicy']],
  ['beef-chuck', 'Beef chuck', '🥩', ['meat', 'animal']],
  ['beef-mince', 'Beef mince', '🥩', ['meat', 'animal']],
  ['lamb-shoulder', 'Lamb shoulder', '🍖', ['meat', 'animal']],
  ['cod-fillet', 'Cod fillet', '🐟', ['meat', 'animal']],
  ['salmon-fillet', 'Salmon fillet', '🐟', ['meat', 'animal']],
  ['mackerel', 'Mackerel', '🐟', ['meat', 'animal']],
  ['anchovies', 'Anchovies', '🐟', ['meat', 'animal']],
  ['prawns', 'Prawns', '🦐', ['meat', 'shellfish', 'animal']],
  ['mussels', 'Mussels', '🦪', ['meat', 'shellfish', 'animal']],
  ['scallops', 'Scallops', '🦪', ['meat', 'shellfish', 'animal']],
  ['crab', 'Crab', '🦀', ['meat', 'shellfish', 'animal']],
  ['squid', 'Squid', '🦑', ['meat', 'animal']],
  ['halloumi', 'Halloumi', '🧆', ['dairy', 'animal']],
  ['paneer', 'Paneer', '🧈', ['dairy', 'animal']],
  ['feta', 'Feta', '🧀', ['dairy', 'animal']],
  ['ricotta', 'Ricotta', '🧀', ['dairy', 'animal']],
  ['seitan', 'Seitan', '🍞', ['gluten']],
  ['firm-tofu', 'Firm tofu', '🟨', []],
  ['silken-tofu', 'Silken tofu', '⬜', []],
  ['tempeh', 'Tempeh', '🟫', []],
  ['chickpeas', 'Chickpeas', '🫘', []],
  ['black-beans', 'Black beans', '🫘', []],
  ['red-lentils', 'Red lentils', '🫘', []],
])
```

`src/data/vegetables.ts`:

```ts
import { rows } from './row.ts'

export const VEGETABLES = rows('vegetable', [
  ['fennel', 'Fennel', '🌿', []],
  ['napa-cabbage', 'Napa cabbage', '🥬', []],
  ['savoy-cabbage', 'Savoy cabbage', '🥬', []],
  ['bok-choy', 'Bok choy', '🥬', []],
  ['spinach', 'Spinach', '🥬', []],
  ['kale', 'Kale', '🥬', []],
  ['chard', 'Rainbow chard', '🥬', []],
  ['broccoli', 'Broccoli', '🥦', []],
  ['cauliflower', 'Cauliflower', '🥦', []],
  ['aubergine', 'Aubergine', '🍆', []],
  ['courgette', 'Courgette', '🥒', []],
  ['cucumber', 'Cucumber', '🥒', []],
  ['red-pepper', 'Red pepper', '🫑', []],
  ['green-beans', 'Green beans', '🫛', []],
  ['sugar-snap-peas', 'Sugar snap peas', '🫛', []],
  ['peas', 'Garden peas', '🫛', []],
  ['asparagus', 'Asparagus', '🌱', []],
  ['artichoke', 'Artichoke', '🪻', []],
  ['okra', 'Okra', '🌿', []],
  ['carrot', 'Carrot', '🥕', []],
  ['parsnip', 'Parsnip', '🥕', []],
  ['beetroot', 'Beetroot', '🟣', []],
  ['celeriac', 'Celeriac', '⚪', []],
  ['radish', 'Radish', '🔴', []],
  ['tomato', 'Beef tomato', '🍅', []],
  ['cherry-tomatoes', 'Cherry tomatoes', '🍅', []],
  ['sweetcorn', 'Sweetcorn', '🌽', []],
  ['mushrooms', 'Chestnut mushrooms', '🍄', []],
  ['oyster-mushrooms', 'Oyster mushrooms', '🍄', []],
  ['butternut-squash', 'Butternut squash', '🎃', []],
  ['pumpkin', 'Pumpkin', '🎃', []],
])
```

`src/data/starches.ts`:

```ts
import { rows } from './row.ts'

export const STARCHES = rows('starch', [
  ['rice-noodles', 'Rice noodles', '🍜', [], 'wok'],
  ['udon', 'Udon noodles', '🍜', ['gluten'], 'wok'],
  ['egg-noodles', 'Egg noodles', '🍜', ['gluten', 'animal'], 'wok'],
  ['spaghetti', 'Spaghetti', '🍝', ['gluten'], 'tongs'],
  ['soba', 'Soba noodles', '🍜', ['gluten'], 'tongs'],
  ['orzo', 'Orzo', '🍝', ['gluten'], 'spoon'],
  ['couscous', 'Couscous', '🌾', ['gluten'], 'spoon'],
  ['bulgur', 'Bulgur wheat', '🌾', ['gluten'], 'spoon'],
  ['basmati-rice', 'Basmati rice', '🍚', [], 'spoon'],
  ['jasmine-rice', 'Jasmine rice', '🍚', [], 'spoon'],
  ['sushi-rice', 'Sushi rice', '🍚', [], 'spoon'],
  ['wild-rice', 'Wild rice', '🍚', [], 'spoon'],
  ['quinoa', 'Quinoa', '🌾', [], 'spoon'],
  ['arborio-rice', 'Arborio rice', '🍚', [], 'pan'],
  ['gnocchi', 'Gnocchi', '🥟', ['gluten'], 'pan'],
  ['polenta', 'Polenta', '🌽', [], 'whisk'],
  ['semolina', 'Semolina', '🌾', ['gluten'], 'whisk'],
  ['potato', 'Floury potatoes', '🥔', [], 'knife'],
  ['new-potatoes', 'New potatoes', '🥔', [], 'knife'],
  ['sweet-potato', 'Sweet potato', '🍠', [], 'knife'],
  ['sourdough-bread', 'Sourdough loaf', '🍞', ['gluten'], 'knife'],
  ['yam', 'Yam', '🍠', [], 'cleaver'],
  ['taro', 'Taro', '🥔', [], 'cleaver'],
  ['cassava', 'Cassava', '🥔', [], 'cleaver'],
  ['plantain', 'Plantain', '🍌', [], 'cleaver'],
  ['flatbread', 'Flatbread dough', '🫓', ['gluten'], 'rolling-pin'],
  ['tortillas', 'Corn tortillas', '🫓', [], 'rolling-pin'],
  ['filo-pastry', 'Filo pastry', '🥟', ['gluten'], 'rolling-pin'],
  ['puff-pastry', 'Puff pastry', '🥐', ['gluten'], 'rolling-pin'],
  ['wonton-wrappers', 'Wonton wrappers', '🥟', ['gluten'], 'rolling-pin'],
  ['rice-paper', 'Rice paper', '🫓', [], 'rolling-pin'],
])
```

`src/data/aromatics.ts`:

```ts
import { rows } from './row.ts'

export const AROMATICS = rows('aromatic', [
  ['garlic', 'Garlic', '🧄', []],
  ['ginger', 'Ginger', '🫚', []],
  ['spring-onion', 'Spring onion', '🧅', []],
  ['shallot', 'Banana shallot', '🧅', []],
  ['red-onion', 'Red onion', '🧅', []],
  ['white-onion', 'White onion', '🧅', []],
  ['leek', 'Leek', '🧅', []],
  ['lemongrass', 'Lemongrass', '🌾', []],
  ['kaffir-lime-leaves', 'Lime leaves', '🍃', []],
  ['curry-leaves', 'Curry leaves', '🍃', []],
  ['thai-basil', 'Thai basil', '🌿', []],
  ['basil', 'Basil', '🌿', []],
  ['coriander', 'Coriander', '🌿', []],
  ['flat-parsley', 'Flat-leaf parsley', '🌿', []],
  ['mint', 'Mint', '🌿', []],
  ['dill', 'Dill', '🌿', []],
  ['tarragon', 'Tarragon', '🌿', []],
  ['rosemary', 'Rosemary', '🌿', []],
  ['thyme', 'Thyme', '🌿', []],
  ['sage', 'Sage', '🌿', []],
  ['bay-leaves', 'Bay leaves', '🍃', []],
  ['cumin-seeds', 'Cumin seeds', '🟤', []],
  ['coriander-seeds', 'Coriander seeds', '🟤', []],
  ['fennel-seeds', 'Fennel seeds', '🟤', []],
  ['cardamom', 'Cardamom pods', '🟤', []],
  ['cinnamon-stick', 'Cinnamon stick', '🟤', []],
  ['star-anise', 'Star anise', '⭐', []],
  ['smoked-paprika', 'Smoked paprika', '🟥', []],
  ['turmeric', 'Fresh turmeric', '🟡', []],
  ['dried-chilli', 'Dried chillies', '🌶️', ['spicy']],
  ['sichuan-pepper', 'Sichuan pepper', '🌶️', ['spicy']],
])
```

`src/data/wildcards.ts`:

```ts
import { rows } from './row.ts'

export const WILDCARDS = rows('wildcard', [
  ['miso-paste', 'Miso paste', '🍲', []],
  ['gochujang', 'Gochujang', '🌶️', ['spicy']],
  ['harissa', 'Harissa', '🌶️', ['spicy']],
  ['sriracha', 'Sriracha', '🌶️', ['spicy']],
  ['chipotle-in-adobo', 'Chipotle in adobo', '🌶️', ['spicy']],
  ['curry-paste', 'Red curry paste', '🌶️', ['spicy']],
  ['kimchi', 'Kimchi', '🥬', ['spicy']],
  ['tahini', 'Tahini', '🥜', ['nuts']],
  ['peanut-butter', 'Peanut butter', '🥜', ['nuts']],
  ['almonds', 'Flaked almonds', '🌰', ['nuts']],
  ['pistachios', 'Pistachios', '🌰', ['nuts']],
  ['walnuts', 'Walnuts', '🌰', ['nuts']],
  ['anchovy-paste', 'Anchovy paste', '🐟', ['meat', 'animal']],
  ['fish-sauce', 'Fish sauce', '🧴', ['meat', 'animal']],
  ['oyster-sauce', 'Oyster sauce', '🦪', ['meat', 'shellfish', 'animal']],
  ['honey', 'Honey', '🍯', ['animal']],
  ['yoghurt', 'Thick yoghurt', '🥛', ['dairy', 'animal']],
  ['soy-sauce', 'Soy sauce', '🧴', ['gluten']],
  ['pomegranate', 'Pomegranate', '🍎', []],
  ['preserved-lemon', 'Preserved lemon', '🍋', []],
  ['capers', 'Capers', '🫒', []],
  ['olives', 'Black olives', '🫒', []],
  ['coconut-milk', 'Coconut milk', '🥥', []],
  ['dijon-mustard', 'Dijon mustard', '🟡', []],
  ['maple-syrup', 'Maple syrup', '🍁', []],
  ['pickled-ginger', 'Pickled ginger', '🫚', []],
  ['sauerkraut', 'Sauerkraut', '🥬', []],
  ['dried-mushrooms', 'Dried porcini', '🍄', []],
  ['sun-dried-tomatoes', 'Sun-dried tomatoes', '🍅', []],
  ['nori', 'Nori sheets', '🌊', []],
  ['tamarind-paste', 'Tamarind paste', '🟤', []],
])
```

`src/data/shelf.ts`:

```ts
import { rows } from './row.ts'

/**
 * Always available to both players and never counted in the ten — but still
 * filtered, because butter is dairy and flour is gluten.
 */
export const SHELF = rows('wildcard', [
  ['shelf-oil', 'Oil', '🫗', []],
  ['shelf-salt', 'Salt', '🧂', []],
  ['shelf-pepper', 'Black pepper', '⚫', []],
  ['shelf-sugar', 'Sugar', '🍬', []],
  ['shelf-vinegar', 'Vinegar', '🧴', []],
  ['shelf-water', 'Water', '💧', []],
  ['shelf-butter', 'Butter', '🧈', ['dairy', 'animal']],
  ['shelf-flour', 'Plain flour', '🌾', ['gluten']],
  ['shelf-eggs', 'Eggs', '🥚', ['animal']],
])
```

`src/data/pantry.ts`:

```ts
import type { CategoryId, Ingredient } from './types.ts'
import { PROTEINS } from './proteins.ts'
import { VEGETABLES } from './vegetables.ts'
import { STARCHES } from './starches.ts'
import { AROMATICS } from './aromatics.ts'
import { WILDCARDS } from './wildcards.ts'
import { SHELF } from './shelf.ts'

export const PANTRY: Readonly<Record<CategoryId, readonly Ingredient[]>> = {
  protein: PROTEINS,
  vegetable: VEGETABLES,
  starch: STARCHES,
  aromatic: AROMATICS,
  wildcard: WILDCARDS,
}

export const ALL_INGREDIENTS: readonly Ingredient[] = [
  ...PROTEINS, ...VEGETABLES, ...STARCHES, ...AROMATICS, ...WILDCARDS,
]

export { SHELF }
```

- [ ] **Step 5: Run the test and the type check**

Run: `node --test tests/data.test.ts && npx tsc --noEmit`
Expected: all 11 data tests PASS, type check clean.

- [ ] **Step 6: Commit**

```bash
git add src/data tests/data.test.ts
git commit -m "feat: add the tagged ingredient pantry and free shelf"
```

---

### Task 3: Tag filtering

**Files:**
- Create: `src/filters.ts`
- Test: `tests/filters.test.ts`

**Interfaces:**
- Consumes: `Ingredient`, `TagId`, `CategoryId`, `CATEGORIES`, `PANTRY`, `ALL_TAG_IDS`
- Produces: `excludeTags(pool: readonly Ingredient[], excluded: readonly TagId[]): readonly Ingredient[]`, `filterPantry(pantry: Pantry, excluded: readonly TagId[]): Pantry` where `type Pantry = Readonly<Record<CategoryId, readonly Ingredient[]>>`

- [ ] **Step 1: Write the failing test**

Create `tests/filters.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { excludeTags, filterPantry } from '../src/filters.ts'
import { PANTRY } from '../src/data/pantry.ts'
import { CATEGORIES, ALL_TAG_IDS } from '../src/data/categories.ts'
import type { Ingredient } from '../src/data/types.ts'

const sample: readonly Ingredient[] = [
  { id: 'a', name: 'A', category: 'protein', icon: '1', tags: [] },
  { id: 'b', name: 'B', category: 'protein', icon: '2', tags: ['meat', 'animal'] },
  { id: 'c', name: 'C', category: 'protein', icon: '3', tags: ['nuts'] },
]

test('an empty exclusion list returns every ingredient', () => {
  assert.deepEqual(excludeTags(sample, []), sample)
})

test('excluding a tag removes exactly the ingredients carrying it', () => {
  assert.deepEqual(excludeTags(sample, ['nuts']).map((i) => i.id), ['a', 'b'])
})

test('excluding several tags removes the union', () => {
  assert.deepEqual(excludeTags(sample, ['nuts', 'meat']).map((i) => i.id), ['a'])
})

test('an unrelated tag removes nothing', () => {
  assert.deepEqual(excludeTags(sample, ['gluten']).map((i) => i.id), ['a', 'b', 'c'])
})

test('filtering never mutates the input pool', () => {
  const frozen = Object.freeze([...sample])
  excludeTags(frozen, ['meat'])
  assert.equal(frozen.length, 3)
})

test('filterPantry applies exclusions to every category', () => {
  const filtered = filterPantry(PANTRY, ['meat'])
  for (const category of CATEGORIES) {
    const leaked = filtered[category.id].filter((i) => i.tags.includes('meat'))
    assert.deepEqual(leaked, [], `${category.id} leaked a meat ingredient`)
  }
})

test('excluding every tag still leaves two per category', () => {
  const filtered = filterPantry(PANTRY, ALL_TAG_IDS)
  for (const category of CATEGORIES) {
    assert.ok(
      filtered[category.id].length >= 2,
      `${category.id} dropped to ${filtered[category.id].length}`,
    )
  }
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/filters.test.ts`
Expected: FAIL — cannot find module `../src/filters.ts`

- [ ] **Step 3: Implement the filters**

`src/filters.ts`:

```ts
import type { CategoryId, Ingredient, TagId } from './data/types.ts'
import { CATEGORIES } from './data/categories.ts'

export type Pantry = Readonly<Record<CategoryId, readonly Ingredient[]>>

/** Drops every ingredient carrying at least one excluded tag. */
export function excludeTags(
  pool: readonly Ingredient[],
  excluded: readonly TagId[],
): readonly Ingredient[] {
  if (excluded.length === 0) return pool
  const blocked = new Set(excluded)
  return pool.filter((ingredient) => !ingredient.tags.some((tag) => blocked.has(tag)))
}

export function filterPantry(pantry: Pantry, excluded: readonly TagId[]): Pantry {
  const entries = CATEGORIES.map(
    (category) => [category.id, excludeTags(pantry[category.id], excluded)] as const,
  )
  return Object.fromEntries(entries) as Pantry
}
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/filters.test.ts && npx tsc --noEmit`
Expected: all 7 tests PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src/filters.ts tests/filters.test.ts
git commit -m "feat: add tag-based ingredient filtering"
```

---

### Task 4: The deal

**Files:**
- Create: `src/deal.ts`
- Test: `tests/deal.test.ts`

**Interfaces:**
- Consumes: `Rng`, `shuffle`, `Pantry`, `filterPantry`, `Ingredient`, `CategoryId`, `TagId`, `UtensilId`, `CATEGORIES`
- Produces: `interface Hand { slots: readonly Ingredient[]; utensil: UtensilId }`, `interface Deal { hands: readonly [Hand, Hand]; counter: readonly Ingredient[] }`, `interface DealFailure { kind: 'insufficient-pool'; category: CategoryId; remaining: number }`, `type DealResult = Deal | DealFailure`, `isFailure(result: DealResult): result is DealFailure`, `dealCounter(pantry: Pantry, excluded: readonly TagId[], rng: Rng): DealResult`

- [ ] **Step 1: Write the failing test**

Create `tests/deal.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dealCounter, isFailure } from '../src/deal.ts'
import { PANTRY } from '../src/data/pantry.ts'
import { CATEGORIES, ALL_TAG_IDS } from '../src/data/categories.ts'
import { createRng } from '../src/rng.ts'
import type { Ingredient, TagId } from '../src/data/types.ts'

function dealOrThrow(excluded: readonly TagId[] = [], seed = 1) {
  const result = dealCounter(PANTRY, excluded, createRng(seed))
  assert.ok(!isFailure(result), 'expected a successful deal')
  return result
}

test('each hand holds exactly one ingredient per category, in slot order', () => {
  const deal = dealOrThrow()
  for (const hand of deal.hands) {
    assert.deepEqual(hand.slots.map((s) => s.category), CATEGORIES.map((c) => c.id))
  }
})

test('all ten dealt ingredients are distinct', () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const ids = dealOrThrow([], seed).counter.map((i) => i.id)
    assert.equal(new Set(ids).size, 10, `seed ${seed} dealt a duplicate`)
  }
})

test('the counter holds exactly two ingredients per category', () => {
  const deal = dealOrThrow()
  assert.equal(deal.counter.length, 10)
  for (const category of CATEGORIES) {
    const count = deal.counter.filter((i) => i.category === category.id).length
    assert.equal(count, 2, `${category.id} appeared ${count} times`)
  }
})

test('the counter is exactly both hands combined', () => {
  const deal = dealOrThrow()
  const fromHands = [...deal.hands[0].slots, ...deal.hands[1].slots].map((i) => i.id).sort()
  assert.deepEqual([...deal.counter].map((i) => i.id).sort(), fromHands)
})

test('excluded tags never appear in a deal', () => {
  for (let seed = 0; seed < 25; seed += 1) {
    for (const ingredient of dealOrThrow(['nuts', 'meat'], seed).counter) {
      assert.ok(!ingredient.tags.includes('nuts'), `${ingredient.id} leaked nuts`)
      assert.ok(!ingredient.tags.includes('meat'), `${ingredient.id} leaked meat`)
    }
  }
})

test('dealing still succeeds with every tag excluded', () => {
  const result = dealCounter(PANTRY, ALL_TAG_IDS, createRng(5))
  assert.ok(!isFailure(result), 'the shipped pantry must survive every exclusion')
})

test('a fixed seed reproduces an identical deal', () => {
  assert.deepEqual(
    dealOrThrow([], 1234).counter.map((i) => i.id),
    dealOrThrow([], 1234).counter.map((i) => i.id),
  )
})

test('different seeds generally produce different deals', () => {
  assert.notEqual(
    dealOrThrow([], 1).counter.map((i) => i.id).join(),
    dealOrThrow([], 2).counter.map((i) => i.id).join(),
  )
})

test('a hand takes its utensil from its starch', () => {
  for (const hand of dealOrThrow().hands) {
    const starch = hand.slots.find((s) => s.category === 'starch')
    assert.ok(starch)
    assert.equal(hand.utensil, starch.utensil)
  }
})

test('a starch with no utensil falls back to the knife', () => {
  const stub: Ingredient = { id: 'x', name: 'X', category: 'starch', icon: '?', tags: [] }
  const pantry = { ...PANTRY, starch: [stub, { ...stub, id: 'y' }] }
  const result = dealCounter(pantry, [], createRng(1))
  assert.ok(!isFailure(result))
  assert.equal(result.hands[0].utensil, 'knife')
})

test('a category with fewer than two candidates returns a typed failure', () => {
  const only: Ingredient = { id: 'solo', name: 'Solo', category: 'vegetable', icon: '?', tags: [] }
  const result = dealCounter({ ...PANTRY, vegetable: [only] }, [], createRng(1))
  assert.ok(isFailure(result))
  assert.equal(result.kind, 'insufficient-pool')
  assert.equal(result.category, 'vegetable')
  assert.equal(result.remaining, 1)
})

test('an empty category also fails rather than throwing', () => {
  const result = dealCounter({ ...PANTRY, aromatic: [] }, [], createRng(1))
  assert.ok(isFailure(result))
  assert.equal(result.category, 'aromatic')
  assert.equal(result.remaining, 0)
})

test('dealing does not mutate the pantry', () => {
  const before = CATEGORIES.map((c) => PANTRY[c.id].length)
  dealOrThrow()
  assert.deepEqual(CATEGORIES.map((c) => PANTRY[c.id].length), before)
})
```

**Note on "chef choice must not affect the deal" (spec §5, §13):** this is satisfied by
construction, not by assertion — `dealCounter` takes no chef parameter, so a chef
cannot reach the draw. Do not add a test for it; a test that passes a value the
function cannot accept proves nothing. If a future change adds a chef argument to
`dealCounter`, that is the moment to write the test.

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/deal.test.ts`
Expected: FAIL — cannot find module `../src/deal.ts`

- [ ] **Step 3: Implement the deal**

`src/deal.ts`:

```ts
import type { CategoryId, Ingredient, TagId, UtensilId } from './data/types.ts'
import { CATEGORIES } from './data/categories.ts'
import { filterPantry, type Pantry } from './filters.ts'
import { shuffle, type Rng } from './rng.ts'

export interface Hand {
  readonly slots: readonly Ingredient[]
  readonly utensil: UtensilId
}

export interface Deal {
  readonly hands: readonly [Hand, Hand]
  readonly counter: readonly Ingredient[]
}

export interface DealFailure {
  readonly kind: 'insufficient-pool'
  readonly category: CategoryId
  readonly remaining: number
}

export type DealResult = Deal | DealFailure

export function isFailure(result: DealResult): result is DealFailure {
  return 'kind' in result
}

const FALLBACK_UTENSIL: UtensilId = 'knife'
const PLAYERS_PER_GAME = 2

/**
 * Draws two distinct ingredients per category and gives one to each player.
 * Making distinctness and balance the same operation means neither can fail
 * independently of the other.
 */
export function dealCounter(
  pantry: Pantry,
  excluded: readonly TagId[],
  rng: Rng,
): DealResult {
  const available = filterPantry(pantry, excluded)

  for (const category of CATEGORIES) {
    const remaining = available[category.id].length
    if (remaining < PLAYERS_PER_GAME) {
      return { kind: 'insufficient-pool', category: category.id, remaining }
    }
  }

  const first: Ingredient[] = []
  const second: Ingredient[] = []
  for (const category of CATEGORIES) {
    const drawn = shuffle(available[category.id], rng)
    first.push(drawn[0] as Ingredient)
    second.push(drawn[1] as Ingredient)
  }

  const hands: readonly [Hand, Hand] = [toHand(first), toHand(second)]
  return { hands, counter: [...hands[0].slots, ...hands[1].slots] }
}

function toHand(slots: readonly Ingredient[]): Hand {
  const starch = slots.find((slot) => slot.category === 'starch')
  return { slots, utensil: starch?.utensil ?? FALLBACK_UTENSIL }
}
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/deal.test.ts && npx tsc --noEmit`
Expected: all 13 tests PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src/deal.ts tests/deal.test.ts
git commit -m "feat: deal two balanced hands into a shared counter of ten"
```

---

### Task 5: Chefs, utensils, and figurine assembly

**Files:**
- Create: `src/chefs/roster.ts`, `src/chefs/svg-part.ts`, `src/chefs/utensils.ts`, `src/chefs/figurine.ts`
- Test: `tests/figurine.test.ts`

**Interfaces:**
- Consumes: `UtensilId`
- Produces: `type ChefId = 'grill' | 'pastry' | 'stirfry' | 'saucier' | 'nonna' | 'punk'`, `type HatStyle`, `type HairStyle`, `interface Chef { id, name, skin, coat, accent, hat, hair }`, `ROSTER: readonly Chef[]`, `CHEF_IDS: readonly ChefId[]`, `chefById(id: ChefId): Chef | undefined`, `interface SvgPart { tag, attrs }`, `UTENSIL_PARTS: Readonly<Record<UtensilId, readonly SvgPart[]>>`, `figurineParts(chef: Chef, utensil: UtensilId): readonly SvgPart[]`, `FIGURINE_VIEWBOX: string`

**Design note:** `figurineParts` returns a *declarative* part list rather than DOM nodes. That keeps it pure and unit-testable under `node --test`, and confines DOM work to `ui/svg.ts` in Task 7. The chef id is `stirfry`, not `wok`, so it can never be confused with the `wok` utensil id at a call site.

`SvgPart` lives in its own module (`src/chefs/svg-part.ts`) rather than in `figurine.ts`. Otherwise `utensils.ts` would import the type from `figurine.ts` while `figurine.ts` imports `UTENSIL_PARTS` from `utensils.ts` — harmless at runtime because `import type` is erased, but a cycle a reader has to reason about. One extra file removes the question.

- [ ] **Step 1: Write the failing test**

Create `tests/figurine.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROSTER, CHEF_IDS, chefById } from '../src/chefs/roster.ts'
import { UTENSIL_PARTS } from '../src/chefs/utensils.ts'
import { figurineParts, FIGURINE_VIEWBOX } from '../src/chefs/figurine.ts'
import type { UtensilId } from '../src/data/types.ts'

const UTENSILS: readonly UtensilId[] = [
  'knife', 'cleaver', 'whisk', 'pan', 'wok', 'rolling-pin', 'tongs', 'spoon',
]

test('the roster holds six chefs with unique ids', () => {
  assert.equal(ROSTER.length, 6)
  assert.equal(new Set(ROSTER.map((c) => c.id)).size, 6)
})

test('CHEF_IDS matches the roster order', () => {
  assert.deepEqual(CHEF_IDS, ROSTER.map((c) => c.id))
})

test('no chef id collides with a utensil id', () => {
  for (const id of CHEF_IDS) {
    assert.ok(!(UTENSILS as readonly string[]).includes(id), `${id} collides with a utensil`)
  }
})

test('every chef has a display name and three well-formed colours', () => {
  for (const chef of ROSTER) {
    assert.ok(chef.name.length > 0, `${chef.id} has no name`)
    for (const colour of [chef.skin, chef.coat, chef.accent]) {
      assert.match(colour, /^#[0-9a-f]{6}$/i, `${chef.id} has a malformed colour`)
    }
  }
})

test('chefById finds a chef and returns undefined for a stranger', () => {
  assert.equal(chefById('grill')?.id, 'grill')
  assert.equal(chefById('nobody' as never), undefined)
})

test('all eight utensils have at least one drawable part', () => {
  for (const utensil of UTENSILS) {
    assert.ok(UTENSIL_PARTS[utensil].length > 0, `${utensil} has no parts`)
  }
})

test('figurineParts produces parts for every chef and utensil pairing', () => {
  for (const chef of ROSTER) {
    for (const utensil of UTENSILS) {
      const parts = figurineParts(chef, utensil)
      assert.ok(parts.length >= 6, `${chef.id}/${utensil} produced only ${parts.length} parts`)
    }
  }
})

test('every part names a real SVG shape element', () => {
  const allowed = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'g'])
  for (const chef of ROSTER) {
    for (const part of figurineParts(chef, 'knife')) {
      assert.ok(allowed.has(part.tag), `unexpected tag ${part.tag}`)
    }
  }
})

test('changing only the utensil leaves the body parts identical', () => {
  const chef = ROSTER[0] as (typeof ROSTER)[number]
  const withKnife = figurineParts(chef, 'knife')
  const withWok = figurineParts(chef, 'wok')
  const bodyLength = withKnife.length - UTENSIL_PARTS.knife.length
  assert.deepEqual(withKnife.slice(0, bodyLength), withWok.slice(0, bodyLength))
})

test('the chef colours actually reach the part attributes', () => {
  const chef = ROSTER[0] as (typeof ROSTER)[number]
  const fills = figurineParts(chef, 'knife').map((p) => p.attrs['fill'] ?? '')
  assert.ok(fills.includes(chef.coat), 'the coat colour never appears')
  assert.ok(fills.includes(chef.skin), 'the skin colour never appears')
})

test('the viewBox is a valid four-number string', () => {
  assert.match(FIGURINE_VIEWBOX, /^-?\d+ -?\d+ \d+ \d+$/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/figurine.test.ts`
Expected: FAIL — cannot find module `../src/chefs/roster.ts`

- [ ] **Step 3: Write the roster**

`src/chefs/roster.ts`:

```ts
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
```

- [ ] **Step 4: Write the part type and the utensils**

`src/chefs/svg-part.ts`:

```ts
/** A declarative SVG element: a tag name plus attributes. No DOM involved. */
export interface SvgPart {
  readonly tag: 'path' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'g'
  readonly attrs: Readonly<Record<string, string>>
}
```

`src/chefs/utensils.ts`:

```ts
import type { UtensilId } from '../data/types.ts'
import type { SvgPart } from './svg-part.ts'

const STEEL = '#cfd8e3'
const HANDLE = '#2b3240'
const WOOD = '#b98a5a'

/**
 * Each utensil is drawn in the raised hand, around x 1..37 / y 20..60 in the
 * 100x150 figurine viewBox. Geometry traced from the approved mockup.
 */
export const UTENSIL_PARTS: Readonly<Record<UtensilId, readonly SvgPart[]>> = {
  knife: [
    { tag: 'rect', attrs: { x: '6', y: '22', width: '4', height: '30', rx: '2', fill: STEEL } },
    { tag: 'rect', attrs: { x: '4', y: '50', width: '9', height: '8', rx: '2', fill: HANDLE } },
  ],
  cleaver: [
    { tag: 'rect', attrs: { x: '3', y: '24', width: '14', height: '20', rx: '2', fill: STEEL } },
    { tag: 'rect', attrs: { x: '8', y: '44', width: '5', height: '14', rx: '2', fill: HANDLE } },
  ],
  whisk: [
    { tag: 'path', attrs: { d: 'M10 24q-7 12 0 22q7-10 0-22', fill: 'none', stroke: STEEL, 'stroke-width': '2' } },
    { tag: 'path', attrs: { d: 'M10 24v22', stroke: STEEL, 'stroke-width': '2' } },
    { tag: 'rect', attrs: { x: '7', y: '46', width: '6', height: '12', rx: '3', fill: HANDLE } },
  ],
  pan: [
    { tag: 'ellipse', attrs: { cx: '12', cy: '40', rx: '11', ry: '5', fill: STEEL } },
    { tag: 'rect', attrs: { x: '21', y: '38', width: '16', height: '3', rx: '1.5', fill: HANDLE } },
  ],
  wok: [
    { tag: 'path', attrs: { d: 'M1 36h22a11 11 0 0 1-22 0', fill: '#3c4756' } },
    { tag: 'ellipse', attrs: { cx: '12', cy: '36', rx: '11', ry: '3', fill: '#59667a' } },
    { tag: 'rect', attrs: { x: '21', y: '34', width: '15', height: '3', rx: '1.5', fill: HANDLE } },
  ],
  'rolling-pin': [
    { tag: 'rect', attrs: { x: '2', y: '32', width: '24', height: '8', rx: '4', fill: WOOD } },
    { tag: 'rect', attrs: { x: '26', y: '34', width: '7', height: '4', rx: '2', fill: HANDLE } },
  ],
  tongs: [
    { tag: 'path', attrs: { d: 'M8 24l6 18m6-18l-6 18', stroke: STEEL, 'stroke-width': '2.6', fill: 'none', 'stroke-linecap': 'round' } },
    { tag: 'rect', attrs: { x: '11', y: '42', width: '6', height: '12', rx: '3', fill: HANDLE } },
  ],
  spoon: [
    { tag: 'ellipse', attrs: { cx: '12', cy: '28', rx: '6', ry: '8', fill: WOOD } },
    { tag: 'rect', attrs: { x: '10', y: '34', width: '4', height: '24', rx: '2', fill: WOOD } },
  ],
}
```

- [ ] **Step 5: Write the figurine assembly**

`src/chefs/figurine.ts`:

```ts
import type { UtensilId } from '../data/types.ts'
import type { Chef, HairStyle, HatStyle } from './roster.ts'
import type { SvgPart } from './svg-part.ts'
import { UTENSIL_PARTS } from './utensils.ts'

export const FIGURINE_VIEWBOX = '0 0 100 150'

const INK = '#17202b'
const TROUSERS = '#2b3240'

export type { SvgPart }

function hatParts(hat: HatStyle, accent: string): readonly SvgPart[] {
  switch (hat) {
    case 'tall-toque':
      return [
        { tag: 'ellipse', attrs: { cx: '50', cy: '20', rx: '21', ry: '14', fill: '#ffffff' } },
        { tag: 'circle', attrs: { cx: '34', cy: '26', r: '10', fill: '#ffffff' } },
        { tag: 'circle', attrs: { cx: '66', cy: '26', r: '10', fill: '#ffffff' } },
        { tag: 'rect', attrs: { x: '31', y: '34', width: '38', height: '9', rx: '3', fill: '#dde6ef' } },
      ]
    case 'toque':
      return [
        { tag: 'ellipse', attrs: { cx: '50', cy: '22', rx: '19', ry: '14', fill: '#ffffff' } },
        { tag: 'rect', attrs: { x: '31', y: '32', width: '38', height: '10', rx: '3', fill: '#e6ecf3' } },
      ]
    case 'bandana':
      return [
        { tag: 'path', attrs: { d: 'M30 31q20-12 40 0', stroke: accent, 'stroke-width': '9', fill: 'none', 'stroke-linecap': 'round' } },
      ]
    case 'headscarf':
      return [
        { tag: 'path', attrs: { d: 'M31 40q19-20 38 0q2-16-19-16t-19 16z', fill: accent } },
      ]
    case 'cap':
      return [
        { tag: 'path', attrs: { d: 'M32 34q18-12 36 0l2-6q-20-10-40 0z', fill: accent } },
        { tag: 'rect', attrs: { x: '68', y: '30', width: '12', height: '6', fill: accent } },
      ]
  }
}

function hairParts(hair: HairStyle): readonly SvgPart[] {
  switch (hair) {
    case 'none':
      return []
    case 'bun':
      return [{ tag: 'circle', attrs: { cx: '50', cy: '16', r: '8', fill: '#2b2320' } }]
    case 'beard':
      return [{ tag: 'path', attrs: { d: 'M36 64q14 12 29 0v8q-15 9-29 0z', fill: INK, opacity: '0.55' } }]
    case 'moustache':
      return [{ tag: 'path', attrs: { d: 'M42 65q8 6 17 0', stroke: INK, 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' } }]
    case 'undercut':
      return [{ tag: 'path', attrs: { d: 'M44 61h13', stroke: INK, 'stroke-width': '2.6', 'stroke-linecap': 'round' } }]
  }
}

/**
 * Body parts come first and the utensil last, so a re-deal can swap the
 * utensil without rebuilding the chef.
 */
export function figurineParts(chef: Chef, utensil: UtensilId): readonly SvgPart[] {
  return [
    ...hatParts(chef.hat, chef.accent),
    { tag: 'rect', attrs: { x: '35', y: '42', width: '30', height: '30', rx: '13', fill: chef.skin } },
    { tag: 'circle', attrs: { cx: '44', cy: '54', r: '2.3', fill: INK } },
    { tag: 'circle', attrs: { cx: '57', cy: '54', r: '2.3', fill: INK } },
    ...hairParts(chef.hair),
    { tag: 'path', attrs: { d: 'M38 72h25l-12.5 12z', fill: chef.accent } },
    { tag: 'path', attrs: { d: 'M30 75q20-7 41 0v46H30z', fill: chef.coat } },
    { tag: 'path', attrs: { d: 'M50 77v44', stroke: 'rgba(0,0,0,0.16)', 'stroke-width': '2' } },
    { tag: 'path', attrs: { d: 'M30 79 16 59', stroke: chef.coat, 'stroke-width': '11', 'stroke-linecap': 'round' } },
    { tag: 'circle', attrs: { cx: '15', cy: '57', r: '5', fill: chef.skin } },
    { tag: 'path', attrs: { d: 'M71 79l13 22', stroke: chef.coat, 'stroke-width': '11', 'stroke-linecap': 'round' } },
    { tag: 'circle', attrs: { cx: '85', cy: '103', r: '5', fill: chef.skin } },
    { tag: 'rect', attrs: { x: '33', y: '120', width: '13', height: '22', rx: '2', fill: TROUSERS } },
    { tag: 'rect', attrs: { x: '55', y: '120', width: '13', height: '22', rx: '2', fill: TROUSERS } },
    ...UTENSIL_PARTS[utensil],
  ]
}
```

- [ ] **Step 6: Run the test**

Run: `node --test tests/figurine.test.ts && npx tsc --noEmit`
Expected: all 11 tests PASS, type check clean.

- [ ] **Step 7: Commit**

```bash
git add src/chefs tests/figurine.test.ts
git commit -m "feat: add the chef roster and declarative figurine assembly"
```

---

### Task 6: Persistence

**Files:**
- Create: `src/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `TagId`, `ALL_TAG_IDS`, `ChefId`, `CHEF_IDS` (Task 5)
- Produces: `interface Saved { chefs: readonly [ChefId | null, ChefId | null]; excluded: readonly TagId[] }`, `interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }`, `parseSaved(raw: string | null): Saved`, `serialiseSaved(saved: Saved): string`, `loadSaved(store: StorageLike): Saved`, `saveSaved(store: StorageLike, saved: Saved): void`

- [ ] **Step 1: Write the failing test**

Create `tests/storage.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSaved, serialiseSaved, loadSaved, saveSaved } from '../src/storage.ts'
import type { Saved, StorageLike } from '../src/storage.ts'

const EMPTY: Saved = { chefs: [null, null], excluded: [] }

function memoryStore(initial: string | null = null) {
  return {
    value: initial,
    getItem(): string | null { return this.value },
    setItem(_key: string, next: string): void { this.value = next },
  }
}

test('missing storage yields empty defaults', () => {
  assert.deepEqual(parseSaved(null), EMPTY)
})

test('corrupt JSON falls back to defaults instead of throwing', () => {
  assert.deepEqual(parseSaved('{not json'), EMPTY)
})

test('a non-object payload falls back to defaults', () => {
  assert.deepEqual(parseSaved('42'), EMPTY)
})

test('valid chef ids and tags round-trip', () => {
  const saved: Saved = { chefs: ['grill', 'punk'], excluded: ['nuts'] }
  assert.deepEqual(parseSaved(serialiseSaved(saved)), saved)
})

test('unknown chef ids are discarded, not trusted', () => {
  const parsed = parseSaved(JSON.stringify({ chefs: ['grill', 'sabotage'], excluded: [] }))
  assert.deepEqual(parsed.chefs, ['grill', null])
})

test('unknown tag ids are dropped', () => {
  const parsed = parseSaved(JSON.stringify({ chefs: [null, null], excluded: ['nuts', 'evil'] }))
  assert.deepEqual(parsed.excluded, ['nuts'])
})

test('a non-array chefs field falls back to empty picks', () => {
  assert.deepEqual(parseSaved(JSON.stringify({ chefs: 'grill', excluded: [] })).chefs, [null, null])
})

test('loadSaved reads through a storage-like object', () => {
  const store = memoryStore(JSON.stringify({ chefs: ['nonna', null], excluded: [] }))
  assert.deepEqual(loadSaved(store).chefs, ['nonna', null])
})

test('saveSaved writes a parseable payload', () => {
  const store = memoryStore()
  saveSaved(store, { chefs: ['stirfry', null], excluded: ['dairy'] })
  assert.deepEqual(parseSaved(store.value).excluded, ['dairy'])
  assert.deepEqual(parseSaved(store.value).chefs, ['stirfry', null])
})

test('a throwing storage never breaks the caller', () => {
  const hostile: StorageLike = {
    getItem(): string | null { throw new Error('blocked') },
    setItem(): void { throw new Error('blocked') },
  }
  assert.deepEqual(loadSaved(hostile), EMPTY)
  assert.doesNotThrow(() => saveSaved(hostile, EMPTY))
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/storage.test.ts`
Expected: FAIL — cannot find module `../src/storage.ts`

- [ ] **Step 3: Implement storage**

`src/storage.ts`:

```ts
import type { TagId } from './data/types.ts'
import { ALL_TAG_IDS } from './data/categories.ts'
import { CHEF_IDS, type ChefId } from './chefs/roster.ts'

const KEY = 'cooking-battle:v1'

export interface Saved {
  readonly chefs: readonly [ChefId | null, ChefId | null]
  readonly excluded: readonly TagId[]
}

/** The slice of the Storage API we use, so tests need no browser. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const DEFAULTS: Saved = { chefs: [null, null], excluded: [] }

function asChefId(value: unknown): ChefId | null {
  return typeof value === 'string' && (CHEF_IDS as readonly string[]).includes(value)
    ? (value as ChefId)
    : null
}

/** Never trusts what it reads — stored ids may be stale or hand-edited. */
export function parseSaved(raw: string | null): Saved {
  if (raw === null) return DEFAULTS

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return DEFAULTS
  }
  if (typeof payload !== 'object' || payload === null) return DEFAULTS

  const record = payload as Record<string, unknown>
  const rawChefs = Array.isArray(record['chefs']) ? record['chefs'] : []
  const rawExcluded = Array.isArray(record['excluded']) ? record['excluded'] : []

  return {
    chefs: [asChefId(rawChefs[0]), asChefId(rawChefs[1])],
    excluded: rawExcluded.filter(
      (tag): tag is TagId =>
        typeof tag === 'string' && (ALL_TAG_IDS as readonly string[]).includes(tag),
    ),
  }
}

export function serialiseSaved(saved: Saved): string {
  return JSON.stringify({ chefs: saved.chefs, excluded: saved.excluded })
}

/** Private browsing and blocked storage must degrade, not crash. */
export function loadSaved(store: StorageLike): Saved {
  try {
    return parseSaved(store.getItem(KEY))
  } catch {
    return DEFAULTS
  }
}

export function saveSaved(store: StorageLike, saved: Saved): void {
  try {
    store.setItem(KEY, serialiseSaved(saved))
  } catch {
    // Storage being unavailable is not worth interrupting a game over.
  }
}
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/storage.test.ts && npx tsc --noEmit`
Expected: all 10 tests PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/storage.test.ts
git commit -m "feat: persist chef picks and diet filters with validation"
```

---

### Task 7: Design tokens, global styles, and the chef-select screen

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/select.css`, `src/ui/svg.ts`, `src/ui/select.ts`
- Modify: `src/main.ts` (replace the stub)
- Test: `tests/browser/select.spec.ts`

**Interfaces:**
- Consumes: `ROSTER`, `Chef`, `ChefId`, `figurineParts`, `FIGURINE_VIEWBOX`, `SvgPart`, `TAGS`, `TagId`, `loadSaved`, `saveSaved`, `Saved`
- Produces: `renderSvgParts(parts: readonly SvgPart[], viewBox: string): SVGSVGElement`, `interface SelectOptions { chefs, excluded, onPickChef, onToggleTag, onStart }`, `renderSelect(options: SelectOptions): HTMLElement`

**Style source:** port the `.roster`, `.rcell`, `.rcur` and `.rname` treatments from `.superpowers/brainstorm/83128-1792769259/content/figurines.html`, replacing hard-coded hex values with the tokens defined below.

- [ ] **Step 1: Write the failing browser test**

Create `tests/browser/select.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('the select screen offers all six chefs to both players', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cooking battle/i)
  const groups = page.getByRole('radiogroup')
  await expect(groups).toHaveCount(2)
  await expect(groups.first().getByRole('radio')).toHaveCount(6)
})

test('picking a chef for each player enables the start control', async ({ page }) => {
  await page.goto('/')
  const start = page.getByRole('button', { name: /to the kitchen/i })
  await expect(start).toBeDisabled()
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await expect(start).toBeEnabled()
})

test('a picked chef is marked selected for assistive technology', async ({ page }) => {
  await page.goto('/')
  const option = page.getByRole('radiogroup').first().getByRole('radio').nth(1)
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
})

test('arrow keys move the selection within a radiogroup', async ({ page }) => {
  await page.goto('/')
  const group = page.getByRole('radiogroup').first()
  await group.getByRole('radio').first().click()
  await group.getByRole('radio').first().press('ArrowRight')
  await expect(group.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true')
})

test('diet chips toggle their pressed state', async ({ page }) => {
  await page.goto('/')
  const chip = page.getByRole('button', { name: /^dairy$/i })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
})

test('chef picks and chips survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('button', { name: /^nuts & seeds$/i }).click()
  await page.reload()
  await expect(page.getByRole('radiogroup').first().getByRole('radio').first())
    .toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: /^nuts & seeds$/i }))
    .toHaveAttribute('aria-pressed', 'true')
})

test('the select screen logs no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run `npx playwright install --with-deps --only-shell chromium` once, then:
Run: `npm run test:e2e -- select.spec.ts`
Expected: FAIL — no `h1`, no radiogroups.

- [ ] **Step 3: Write the tokens**

`src/styles/tokens.css`:

```css
:root {
  color-scheme: dark;

  --p1: #19e3ff;
  --p2-graphic: #ff3b24;
  --p2-text: #ff6a4d;
  --system: #ffd400;

  --ground-top: #0a0d14;
  --ground-bottom: #04060a;
  --panel: #111823;
  --panel-raised: #1b2432;
  --hairline: rgba(255, 255, 255, 0.12);
  --text: #e8f4ff;
  --text-dim: #8fb3c9;

  --display: "Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif;
  --body: "Avenir Next", Avenir, system-ui, -apple-system, sans-serif;
  --mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --step-0: 0.7rem;
  --step-1: clamp(0.8rem, 0.76rem + 0.2vw, 0.95rem);
  --step-2: clamp(1rem, 0.9rem + 0.5vw, 1.35rem);
  --step-3: clamp(1.5rem, 1.1rem + 2vw, 2.75rem);

  --gap: clamp(0.5rem, 0.3rem + 0.8vw, 1rem);
  --pad: clamp(0.75rem, 0.5rem + 1vw, 1.25rem);

  --fast: 140ms;
  --normal: 280ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 4: Write the global styles**

`src/styles/global.css`:

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  min-width: 320px;
  min-height: 100dvh;
  font-family: var(--body);
  color: var(--text);
  background: linear-gradient(180deg, var(--ground-top), var(--ground-bottom));
  background-attachment: fixed;
}

h1, h2, h3, p { margin: 0; }
button { font: inherit; color: inherit; cursor: pointer; }
button:disabled { cursor: default; opacity: 0.4; }
svg { display: block; }
[hidden] { display: none !important; }

:focus-visible { outline: 2px solid var(--system); outline-offset: 3px; }
button:focus:not(:focus-visible) { outline: none; }

.eyebrow {
  font: 700 var(--step-0) / 1.4 var(--mono);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.skip-link {
  position: absolute;
  inset-block-start: 0.75rem;
  inset-inline-start: 0.75rem;
  z-index: 10;
  padding: 0.75rem 1.1rem;
  background: var(--system);
  color: var(--ground-bottom);
  text-decoration: none;
  transform: translateY(-200%);
}
.skip-link:focus { transform: translateY(0); }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.shell {
  width: min(1400px, 100% - 2 * var(--pad));
  margin-inline: auto;
  padding-block: var(--pad);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 5: Write the select styles**

`src/styles/select.css`:

```css
.select { display: grid; gap: calc(var(--gap) * 2); }

.select-head h1 {
  font: 400 var(--step-3) / 0.95 var(--display);
  letter-spacing: -0.03em;
  text-transform: uppercase;
  margin-top: 0.4rem;
}
.select-head h1 span { color: var(--system); }

.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
.chip {
  padding: 0.45rem 0.6rem;
  font: 700 var(--step-0) / 1 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  color: var(--text-dim);
  transition: background var(--fast), color var(--fast), border-color var(--fast);
}
.chip:hover { border-color: var(--system); color: var(--text); }
.chip[aria-pressed="true"] {
  background: var(--system);
  border-color: var(--system);
  color: var(--ground-bottom);
  text-decoration: line-through;
}

.picker { display: grid; gap: var(--gap); }
.picker-label {
  font: 700 var(--step-0) / 1 var(--mono);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.picker[data-player="1"] .picker-label { color: var(--p1); }
.picker[data-player="2"] .picker-label { color: var(--p2-text); }

.roster { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--gap); }

.chef-option {
  padding: 0.5rem 0.3rem;
  background: linear-gradient(180deg, var(--panel-raised), var(--panel));
  border: 1px solid var(--hairline);
  transition: transform var(--fast) var(--ease-out-expo), border-color var(--fast);
}
.chef-option:hover { transform: translateY(-3px); border-color: var(--text-dim); }
.chef-option svg { width: 100%; height: auto; }
.chef-name {
  display: block;
  margin-top: 0.3rem;
  font: 700 var(--step-0) / 1.3 var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  color: var(--text-dim);
}

.picker[data-player="1"] .chef-option[aria-checked="true"] {
  border-color: var(--p1);
  box-shadow: 0 0 0 2px var(--p1), 0 0 24px rgba(25, 227, 255, 0.35);
}
.picker[data-player="2"] .chef-option[aria-checked="true"] {
  border-color: var(--p2-graphic);
  box-shadow: 0 0 0 2px var(--p2-graphic), 0 0 24px rgba(255, 59, 36, 0.35);
}
.picker[data-player="1"] .chef-option[aria-checked="true"] .chef-name { color: var(--p1); }
.picker[data-player="2"] .chef-option[aria-checked="true"] .chef-name { color: var(--p2-text); }

.start {
  justify-self: start;
  padding: 0.9rem 1.4rem;
  font: 400 var(--step-2) / 1 var(--display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1a1200;
  background: linear-gradient(180deg, #ffe066, #e0a800);
  border: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition: transform var(--fast);
}
.start:not(:disabled):hover { transform: translateY(-2px); }

@media (max-width: 900px) {
  .roster { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .roster { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 6: Write the SVG renderer**

`src/ui/svg.ts`:

```ts
import type { SvgPart } from '../chefs/figurine.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Builds an SVG tree from declarative parts. Never uses innerHTML. */
export function renderSvgParts(parts: readonly SvgPart[], viewBox: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  for (const part of parts) {
    const node = document.createElementNS(SVG_NS, part.tag)
    for (const [name, value] of Object.entries(part.attrs)) {
      node.setAttribute(name, value)
    }
    svg.append(node)
  }
  return svg
}
```

- [ ] **Step 7: Write the select screen**

`src/ui/select.ts`:

```ts
import { ROSTER, type Chef, type ChefId } from '../chefs/roster.ts'
import { figurineParts, FIGURINE_VIEWBOX } from '../chefs/figurine.ts'
import { TAGS } from '../data/tags.ts'
import type { TagId } from '../data/types.ts'
import { renderSvgParts } from './svg.ts'

export interface SelectOptions {
  readonly chefs: readonly [ChefId | null, ChefId | null]
  readonly excluded: readonly TagId[]
  readonly onPickChef: (player: 0 | 1, chef: ChefId) => void
  readonly onToggleTag: (tag: TagId) => void
  readonly onStart: () => void
}

export function renderSelect(options: SelectOptions): HTMLElement {
  const section = document.createElement('section')
  section.className = 'select shell'

  section.append(
    renderHead(),
    renderChips(options),
    renderPicker(0, options),
    renderPicker(1, options),
    renderStart(options),
  )
  return section
}

function renderHead(): HTMLElement {
  const head = document.createElement('div')
  head.className = 'select-head'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = 'Ten ingredients / two cooks / no recipes'

  const title = document.createElement('h1')
  title.append(document.createTextNode('Cooking '))
  const emphasis = document.createElement('span')
  emphasis.textContent = 'Battle'
  title.append(emphasis)

  head.append(eyebrow, title)
  return head
}

function renderChips(options: SelectOptions): HTMLElement {
  const group = document.createElement('div')

  const label = document.createElement('p')
  label.className = 'eyebrow'
  label.id = 'chips-label'
  label.textContent = 'Leave out'

  const chips = document.createElement('div')
  chips.className = 'chips'
  chips.setAttribute('role', 'group')
  chips.setAttribute('aria-labelledby', label.id)

  for (const tag of TAGS) {
    const chip = document.createElement('button')
    chip.className = 'chip'
    chip.type = 'button'
    chip.textContent = tag.label
    chip.setAttribute('aria-pressed', String(options.excluded.includes(tag.id)))
    chip.addEventListener('click', () => options.onToggleTag(tag.id))
    chips.append(chip)
  }

  group.append(label, chips)
  return group
}

function renderPicker(player: 0 | 1, options: SelectOptions): HTMLElement {
  const picker = document.createElement('div')
  picker.className = 'picker'
  picker.dataset['player'] = String(player + 1)

  const label = document.createElement('p')
  label.className = 'picker-label'
  label.id = `picker-label-${player}`
  label.textContent = player === 0
    ? 'Player one — pick your chef'
    : 'Player two — pick your chef'

  const group = document.createElement('div')
  group.className = 'roster'
  group.setAttribute('role', 'radiogroup')
  group.setAttribute('aria-labelledby', label.id)

  ROSTER.forEach((chef, index) => {
    group.append(renderChefOption(chef, index, player, options))
  })

  picker.append(label, group)
  return picker
}

function renderChefOption(
  chef: Chef,
  index: number,
  player: 0 | 1,
  options: SelectOptions,
): HTMLElement {
  const selected = options.chefs[player] === chef.id
  const unpicked = options.chefs[player] === null

  const option = document.createElement('button')
  option.className = 'chef-option'
  option.type = 'button'
  option.setAttribute('role', 'radio')
  option.setAttribute('aria-checked', String(selected))
  option.tabIndex = selected || (unpicked && index === 0) ? 0 : -1

  option.append(renderSvgParts(figurineParts(chef, 'knife'), FIGURINE_VIEWBOX))

  const name = document.createElement('span')
  name.className = 'chef-name'
  name.textContent = chef.name
  option.append(name)

  option.addEventListener('click', () => options.onPickChef(player, chef.id))
  option.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = ROSTER[(index + step + ROSTER.length) % ROSTER.length]
    if (next) options.onPickChef(player, next.id)
  })

  return option
}

function renderStart(options: SelectOptions): HTMLElement {
  const start = document.createElement('button')
  start.className = 'start'
  start.type = 'button'
  start.textContent = 'To the kitchen'
  start.disabled = options.chefs[0] === null || options.chefs[1] === null
  start.addEventListener('click', options.onStart)
  return start
}
```

- [ ] **Step 8: Replace the main.ts stub**

`src/main.ts`:

```ts
import './styles/tokens.css'
import './styles/global.css'
import './styles/select.css'

import { renderSelect } from './ui/select.ts'
import { loadSaved, saveSaved, type Saved } from './storage.ts'
import type { ChefId } from './chefs/roster.ts'
import type { TagId } from './data/types.ts'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app is missing from index.html')

let saved: Saved = loadSaved(window.localStorage)

function update(next: Saved): void {
  saved = next
  saveSaved(window.localStorage, saved)
  draw()
}

function draw(): void {
  root.replaceChildren(
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
```

- [ ] **Step 9: Run the browser test**

Run: `npm run test:e2e -- select.spec.ts && npx tsc --noEmit`
Expected: all 7 select tests PASS, type check clean.

- [ ] **Step 10: Commit**

```bash
git add src/styles src/ui/svg.ts src/ui/select.ts src/main.ts tests/browser/select.spec.ts
git commit -m "feat: add design tokens and the chef-select screen"
```

---

### Task 8: The stage

**Files:**
- Create: `src/styles/stage.css`, `src/ui/stage.ts`
- Test: `tests/browser/stage.spec.ts` (will not fully pass until Task 9 — see Step 5)

**Interfaces:**
- Consumes: `Deal`, `DealFailure`, `Hand`, `chefById`, `ChefId`, `figurineParts`, `FIGURINE_VIEWBOX`, `renderSvgParts`, `CATEGORIES`, `SHELF`, `excludeTags`, `Ingredient`, `TagId`
- Produces: `interface StageOptions { chefs, deal, failure, excluded, round, pantrySize, onDeal, onChangeChef }`, `renderStage(options: StageOptions): HTMLElement`

**Style source:** port `.stage`, `.st-hud`, `.pan`, `.slot`, `.pips`, `.vs-badge`, `.st-counter` and `.ctile` from `.superpowers/brainstorm/83128-1792769259/content/figurines.html`, swapping hex values for Task 7 tokens. Every player-two text run uses `--p2-text`, never `--p2-graphic`.

- [ ] **Step 1: Write the failing browser test**

Create `tests/browser/stage.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

async function enterKitchen(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
}

test('the stage shows two panels of five slots and a counter of ten', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.pan')).toHaveCount(2)
  await expect(page.locator('.pan').first().locator('.slot')).toHaveCount(5)
  await expect(page.locator('.ctile')).toHaveCount(10)
})

test('both figurines are present and hidden from assistive technology', async ({ page }) => {
  await enterKitchen(page)
  const figurines = page.locator('.figurine svg')
  await expect(figurines).toHaveCount(2)
  await expect(figurines.first()).toHaveAttribute('aria-hidden', 'true')
})

test('each chef name appears as text, not only as colour', async ({ page }) => {
  await enterKitchen(page)
  await expect(page.locator('.figurine').first()).toContainText(/the grill/i)
})

test('dealing again changes the counter', async ({ page }) => {
  await enterKitchen(page)
  const deal = page.getByRole('button', { name: /^deal$/i })
  await deal.click()
  const first = (await page.locator('.ctile').allInnerTexts()).join()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await deal.click()
    if ((await page.locator('.ctile').allInnerTexts()).join() !== first) return
  }
  throw new Error('five deals produced an identical counter')
})

test('every slot shows its category in text', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const panel = page.locator('.pan').first()
  for (const label of ['Protein', 'Vegetable', 'Starch', 'Aromatic', 'Wildcard']) {
    await expect(panel).toContainText(label)
  }
})

test('the HUD reports the round and the pantry size', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.st-hud')).toContainText(/round/i)
  await expect(page.locator('.st-hud')).toContainText(/\d{2,}/)
})

test('the free shelf is listed on the stage', async ({ page }) => {
  await enterKitchen(page)
  await expect(page.locator('.shelf')).toContainText(/oil/i)
  await expect(page.locator('.shelf')).toContainText(/salt/i)
})

test('excluding dairy removes butter from the shelf', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^dairy$/i }).click()
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
  await expect(page.locator('.shelf')).not.toContainText(/butter/i)
})

test('tapping a figurine returns to chef select', async ({ page }) => {
  await enterKitchen(page)
  await page.locator('.figurine button').first().click()
  await expect(page.getByRole('radiogroup')).toHaveCount(2)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:e2e -- stage.spec.ts`
Expected: FAIL — "To the kitchen" does nothing yet, so `.pan` never appears.

- [ ] **Step 3: Write the stage styles**

`src/styles/stage.css`:

```css
.stage {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(60% 110% at 12% 0%, #0b3350 0%, transparent 62%),
    radial-gradient(60% 110% at 88% 0%, #4f1016 0%, transparent 62%);
}

.st-hud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap);
  align-items: center;
  justify-content: space-between;
  font: 700 var(--step-0) / 1.4 var(--mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.st-hud b { color: var(--system); }
.st-logo {
  font: 400 var(--step-2) / 1 var(--display);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text);
}

.board {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) 4rem minmax(0, 1fr) 7rem;
  gap: var(--gap);
  align-items: end;
  margin-top: calc(var(--gap) * 2);
}

.figurine { display: grid; justify-items: center; }
.figurine button { padding: 0; background: none; border: 0; }
.figurine svg { width: 100%; height: auto; }
.figurine[data-player="1"] svg { filter: drop-shadow(0 0 14px rgba(25, 227, 255, 0.45)); }
.figurine[data-player="2"] svg { filter: drop-shadow(0 0 14px rgba(255, 59, 36, 0.45)); }
.figurine-name {
  display: block;
  margin-top: 0.4rem;
  font: 700 var(--step-0) / 1.3 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.figurine[data-player="1"] .figurine-name { color: var(--p1); }
.figurine[data-player="2"] .figurine-name { color: var(--p2-text); }

.pan {
  min-height: 19rem;
  padding: var(--pad);
  background: linear-gradient(180deg, rgba(25, 227, 255, 0.15), rgba(25, 227, 255, 0.03));
  border: 1px solid rgba(25, 227, 255, 0.35);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
}
.pan[data-player="2"] {
  background: linear-gradient(180deg, rgba(255, 59, 36, 0.15), rgba(255, 59, 36, 0.03));
  border-color: rgba(255, 90, 60, 0.4);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px));
}
.pan-name {
  font: 400 var(--step-2) / 1 var(--display);
  text-transform: uppercase;
  color: var(--p1);
}
.pan[data-player="2"] .pan-name { color: var(--p2-text); }

.pips { display: flex; gap: 3px; margin-top: 0.5rem; }
.pips i { flex: 1; height: 4px; background: var(--p1); }
.pan[data-player="2"] .pips i { background: var(--p2-graphic); }

.slot {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.4rem;
  padding: 0.4rem 0.55rem;
  background: rgba(255, 255, 255, 0.045);
  border-inline-start: 2px solid var(--p1);
}
.pan[data-player="2"] .slot { border-inline-start-color: var(--p2-graphic); }
.slot-icon { flex: 0 0 1.5rem; font-size: var(--step-1); text-align: center; }
.slot-name { display: block; font: 400 var(--step-1) / 1.15 var(--display); text-transform: uppercase; }
.slot-category {
  display: block;
  font: 700 var(--step-0) / 1.4 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.vs {
  display: grid;
  place-items: center;
  padding-bottom: 2rem;
  font: 400 var(--step-3) / 1 var(--display);
  letter-spacing: -0.06em;
  color: var(--system);
  text-shadow: 0 3px 0 #000;
}

.st-counter {
  margin-top: calc(var(--gap) * 2);
  padding-top: var(--pad);
  border-top: 1px solid var(--hairline);
}
.ctiles { display: flex; flex-wrap: wrap; gap: 0.3rem; min-height: 4.5rem; margin-top: 0.5rem; }
.ctile {
  padding: 0.35rem 0.5rem;
  font: 400 var(--step-1) / 1 var(--display);
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--hairline);
}
.shelf {
  margin-top: var(--gap);
  font: 700 var(--step-0) / 1.8 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.deal {
  padding: 0.8rem 1.2rem;
  font: 400 var(--step-2) / 1 var(--display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1a1200;
  background: linear-gradient(180deg, #ffe066, #e0a800);
  border: 0;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}

.deal-error {
  margin-top: var(--gap);
  padding: 0.7rem 0.9rem;
  font-size: var(--step-1);
  color: var(--p2-text);
  border: 1px solid var(--p2-graphic);
  background: rgba(255, 59, 36, 0.08);
}

@media (prefers-reduced-motion: no-preference) {
  .ctile { animation: pop var(--normal) var(--ease-out-expo) backwards; }
  @keyframes pop {
    from { opacity: 0; transform: translateY(6px) scale(0.96); }
    to { opacity: 1; transform: none; }
  }
}

@media (max-width: 900px) {
  .board { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .vs { grid-column: 1 / -1; grid-row: 1; padding-bottom: 0; }
  .figurine { grid-row: 3; max-width: 7rem; }
  .pan { min-height: 0; }
}
```

- [ ] **Step 4: Write the stage renderer**

`src/ui/stage.ts`:

```ts
import type { Deal, DealFailure, Hand } from '../deal.ts'
import { chefById, type ChefId } from '../chefs/roster.ts'
import { figurineParts, FIGURINE_VIEWBOX } from '../chefs/figurine.ts'
import { CATEGORIES } from '../data/categories.ts'
import { SHELF } from '../data/pantry.ts'
import { excludeTags } from '../filters.ts'
import type { Ingredient, TagId } from '../data/types.ts'
import { renderSvgParts } from './svg.ts'

export interface StageOptions {
  readonly chefs: readonly [ChefId, ChefId]
  readonly deal: Deal | null
  readonly failure: DealFailure | null
  readonly excluded: readonly TagId[]
  readonly round: number
  readonly pantrySize: number
  readonly onDeal: () => void
  readonly onChangeChef: (player: 0 | 1) => void
}

const CATEGORY_LABELS = new Map(CATEGORIES.map((category) => [category.id, category.label]))

export function renderStage(options: StageOptions): HTMLElement {
  const section = document.createElement('section')
  section.className = 'stage shell'

  const board = document.createElement('div')
  board.className = 'board'
  board.append(
    renderFigurine(0, options),
    renderPanel(0, options),
    renderVs(),
    renderPanel(1, options),
    renderFigurine(1, options),
  )

  section.append(renderHud(options), board, renderCounter(options))
  return section
}

function renderHud(options: StageOptions): HTMLElement {
  const hud = document.createElement('div')
  hud.className = 'st-hud'

  const meta = document.createElement('span')
  const round = document.createElement('b')
  round.textContent = String(options.round).padStart(2, '0')
  const pantry = document.createElement('b')
  pantry.textContent = String(options.pantrySize)
  meta.append('Round ', round, ' / Pantry ', pantry)
  if (options.excluded.length > 0) {
    meta.append(` / Without ${options.excluded.join(', ')}`)
  }

  const logo = document.createElement('h1')
  logo.className = 'st-logo'
  logo.textContent = 'Cooking Battle'

  const deal = document.createElement('button')
  deal.className = 'deal'
  deal.type = 'button'
  deal.textContent = 'Deal'
  deal.disabled = options.failure !== null
  deal.addEventListener('click', options.onDeal)

  hud.append(meta, logo, deal)
  return hud
}

function renderFigurine(player: 0 | 1, options: StageOptions): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'figurine'
  wrapper.dataset['player'] = String(player + 1)

  const chef = chefById(options.chefs[player])
  if (!chef) return wrapper

  const utensil = options.deal?.hands[player].utensil ?? 'knife'
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', `${chef.name} — change chef`)
  button.append(renderSvgParts(figurineParts(chef, utensil), FIGURINE_VIEWBOX))

  const name = document.createElement('span')
  name.className = 'figurine-name'
  name.textContent = chef.name
  button.append(name)
  button.addEventListener('click', () => options.onChangeChef(player))

  wrapper.append(button)
  return wrapper
}

function renderPanel(player: 0 | 1, options: StageOptions): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'pan'
  panel.dataset['player'] = String(player + 1)

  const name = document.createElement('h2')
  name.className = 'pan-name'
  name.textContent = player === 0 ? 'Player One' : 'Player Two'
  panel.append(name)

  const hand: Hand | undefined = options.deal?.hands[player]

  const pips = document.createElement('div')
  pips.className = 'pips'
  const filled = hand ? hand.slots.length : 0
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const pip = document.createElement('i')
    pip.style.opacity = index < filled ? '1' : '0.25'
    pips.append(pip)
  }
  panel.append(pips)

  if (!hand) {
    const waiting = document.createElement('p')
    waiting.className = 'slot-category'
    waiting.textContent = 'Press deal to start'
    panel.append(waiting)
    return panel
  }

  for (const ingredient of hand.slots) {
    panel.append(renderSlot(ingredient))
  }
  return panel
}

function renderSlot(ingredient: Ingredient): HTMLElement {
  const slot = document.createElement('div')
  slot.className = 'slot'

  const icon = document.createElement('span')
  icon.className = 'slot-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = ingredient.icon

  const text = document.createElement('span')
  const name = document.createElement('span')
  name.className = 'slot-name'
  name.textContent = ingredient.name
  const category = document.createElement('span')
  category.className = 'slot-category'
  category.textContent = CATEGORY_LABELS.get(ingredient.category) ?? ingredient.category
  text.append(name, category)

  slot.append(icon, text)
  return slot
}

function renderVs(): HTMLElement {
  const vs = document.createElement('div')
  vs.className = 'vs'
  vs.setAttribute('aria-hidden', 'true')
  vs.textContent = 'VS'
  return vs
}

function renderCounter(options: StageOptions): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'st-counter'

  const heading = document.createElement('h2')
  heading.className = 'eyebrow'
  heading.textContent = 'The counter — all ten, both cooks'
  wrapper.append(heading)

  const tiles = document.createElement('div')
  tiles.className = 'ctiles'
  options.deal?.counter.forEach((ingredient, index) => {
    const tile = document.createElement('span')
    tile.className = 'ctile'
    tile.style.animationDelay = `${index * 40}ms`
    tile.textContent = ingredient.name
    tiles.append(tile)
  })
  wrapper.append(tiles)

  const shelf = document.createElement('p')
  shelf.className = 'shelf'
  const staples = excludeTags(SHELF, options.excluded).map((item) => item.name)
  shelf.textContent = `Shelf, free and unlimited — ${staples.join(' / ')}`
  wrapper.append(shelf)

  if (options.failure) {
    const error = document.createElement('p')
    error.className = 'deal-error'
    error.setAttribute('role', 'alert')
    const label = CATEGORY_LABELS.get(options.failure.category) ?? options.failure.category
    error.textContent =
      `${label} has only ${options.failure.remaining} ingredient(s) left. ` +
      `Turn one of these back on: ${options.excluded.join(', ')}.`
    wrapper.append(error)
  }

  return wrapper
}
```

- [ ] **Step 5: Confirm the remaining failures are only the missing wiring**

Run: `npm run test:e2e -- stage.spec.ts && npx tsc --noEmit`
Expected: the type check is clean, and every stage test still fails at the `To the kitchen` click because `onStart` is a no-op. Read the failure messages and confirm none of them is a render error. Task 9 turns these green.

- [ ] **Step 6: Commit**

```bash
git add src/styles/stage.css src/ui/stage.ts tests/browser/stage.spec.ts
git commit -m "feat: add the fighter-select stage renderer"
```

---

### Task 9: Wire the state machine

**Files:**
- Modify: `src/main.ts` (full rewrite)
- Test: `tests/browser/game.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–8
- Produces: a working application

- [ ] **Step 1: Write the failing test**

Create `tests/browser/game.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

async function enterKitchen(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
}

test('the whole flow runs from select to a dealt counter', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.ctile')).toHaveCount(10)
})

test('the deal is announced to assistive technology', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const live = page.locator('[aria-live="polite"]')
  await expect(live).toContainText(/ten ingredients on the counter/i)
})

test('an excluded tag never reaches the counter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^meat & fish$/i }).click()
  await page.getByRole('button', { name: /^animal products$/i }).click()
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
  await page.getByRole('button', { name: /^deal$/i }).click()

  const names = (await page.locator('.ctile').allInnerTexts()).join(' ').toLowerCase()
  for (const banned of ['chicken', 'pork', 'cod', 'prawns', 'bacon', 'honey', 'yoghurt']) {
    expect(names, `${banned} leaked onto the counter`).not.toContain(banned)
  }
})

test('the round counter advances with each deal', async ({ page }) => {
  await enterKitchen(page)
  const deal = page.getByRole('button', { name: /^deal$/i })
  await deal.click()
  await expect(page.locator('.st-hud')).toContainText(/round 01/i)
  await deal.click()
  await expect(page.locator('.st-hud')).toContainText(/round 02/i)
})

test('the stage is reachable directly on a return visit', async ({ page }) => {
  await enterKitchen(page)
  await page.reload()
  await expect(page.getByRole('button', { name: /^deal$/i })).toBeVisible()
})

test('reduced motion renders the counter with no animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const animation = await page.locator('.ctile').first()
    .evaluate((node) => getComputedStyle(node).animationName)
  expect(animation).toBe('none')
})

test('the app makes no external network requests', async ({ page }) => {
  const external: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    const local = url.startsWith('http://127.0.0.1')
      || url.startsWith('http://localhost')
      || url.startsWith('data:')
    if (!local) external.push(url)
  })
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  expect(external).toEqual([])
})

test('the app logs no console errors during a full round', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await page.getByRole('button', { name: /^deal$/i }).click()
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:e2e -- game.spec.ts`
Expected: FAIL — clicking "To the kitchen" leaves the select screen in place.

- [ ] **Step 3: Rewrite main.ts**

`src/main.ts`:

```ts
import './styles/tokens.css'
import './styles/global.css'
import './styles/select.css'
import './styles/stage.css'

import { renderSelect } from './ui/select.ts'
import { renderStage } from './ui/stage.ts'
import { loadSaved, saveSaved, type Saved } from './storage.ts'
import { dealCounter, isFailure, type Deal, type DealFailure } from './deal.ts'
import { createRng, randomSeed } from './rng.ts'
import { filterPantry } from './filters.ts'
import { PANTRY } from './data/pantry.ts'
import { CATEGORIES } from './data/categories.ts'
import type { ChefId } from './chefs/roster.ts'
import type { TagId } from './data/types.ts'

type Screen = 'select' | 'stage'

interface State {
  readonly screen: Screen
  readonly saved: Saved
  readonly deal: Deal | null
  readonly failure: DealFailure | null
  readonly round: number
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app is missing from index.html')

const announcer = document.createElement('p')
announcer.className = 'sr-only'
announcer.setAttribute('role', 'status')
announcer.setAttribute('aria-live', 'polite')
document.body.append(announcer)

const initial = loadSaved(window.localStorage)
const bothPicked = initial.chefs[0] !== null && initial.chefs[1] !== null

let state: State = {
  screen: bothPicked ? 'stage' : 'select',
  saved: initial,
  deal: null,
  failure: null,
  round: 0,
}

function setState(next: Partial<State>): void {
  state = { ...state, ...next }
  if (next.saved) saveSaved(window.localStorage, next.saved)
  render()
}

function pantrySize(): number {
  const available = filterPantry(PANTRY, state.saved.excluded)
  return CATEGORIES.reduce((total, category) => total + available[category.id].length, 0)
}

function deal(): void {
  const result = dealCounter(PANTRY, state.saved.excluded, createRng(randomSeed()))
  if (isFailure(result)) {
    setState({ failure: result, deal: null })
    return
  }
  setState({ deal: result, failure: null, round: state.round + 1 })
  announcer.textContent =
    `Ten ingredients on the counter: ${result.counter.map((i) => i.name).join(', ')}.`
}

function renderSelectScreen(): void {
  root.replaceChildren(
    renderSelect({
      chefs: state.saved.chefs,
      excluded: state.saved.excluded,
      onPickChef: (player, chef: ChefId) => {
        const chefs: [ChefId | null, ChefId | null] = [state.saved.chefs[0], state.saved.chefs[1]]
        chefs[player] = chef
        setState({ saved: { ...state.saved, chefs } })
      },
      onToggleTag: (tag: TagId) => {
        const excluded = state.saved.excluded.includes(tag)
          ? state.saved.excluded.filter((item) => item !== tag)
          : [...state.saved.excluded, tag]
        setState({ saved: { ...state.saved, excluded }, deal: null, failure: null })
      },
      onStart: () => setState({ screen: 'stage' }),
    }),
  )
}

function render(): void {
  if (state.screen === 'select') {
    renderSelectScreen()
    return
  }

  const [first, second] = state.saved.chefs
  if (first === null || second === null) {
    setState({ screen: 'select' })
    return
  }

  root.replaceChildren(
    renderStage({
      chefs: [first, second],
      deal: state.deal,
      failure: state.failure,
      excluded: state.saved.excluded,
      round: state.round,
      pantrySize: pantrySize(),
      onDeal: deal,
      onChangeChef: () => setState({ screen: 'select' }),
    }),
  )
}

render()
```

- [ ] **Step 4: Run every suite**

Run: `npm test && npm run test:e2e && npx tsc --noEmit`
Expected: all unit suites PASS; `select.spec.ts`, `stage.spec.ts` and `game.spec.ts` all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts tests/browser/game.spec.ts
git commit -m "feat: wire chef select, dealing, persistence and announcements"
```

---

### Task 10: Artifact guards, CI, and the README

**Files:**
- Create: `tests/pages/deployment.spec.ts`, `README.md`
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: the built `dist/`
- Produces: a verified, deployable artifact

- [ ] **Step 1: Write the failing Pages and content-guard test**

Create `tests/pages/deployment.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = 'http://127.0.0.1:4173/cooking-battle/'
let server: ChildProcess

test.beforeAll(async () => {
  server = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--base', '/cooking-battle/'],
    { stdio: 'ignore' },
  )
  await new Promise((resolve) => setTimeout(resolve, 3000))
})

test.afterAll(() => { server?.kill() })

test('the built app loads and deals under a repository subpath', async ({ page }) => {
  const failures: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(BASE)
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.ctile')).toHaveCount(10)
  expect(failures).toEqual([])
})

test('the artifact ships no presentation files', async () => {
  const entries = await readdir('dist', { recursive: true })
  const banned = entries.filter((name) => /\.(pptx?|pptm|potx|ppsx)$/i.test(String(name)))
  expect(banned).toEqual([])
})

test('the artifact contains no recipe instructions', async () => {
  const assets = await readdir(join('dist', 'assets'))
  const bundles = assets.filter((name) => name.endsWith('.js'))
  expect(bundles.length).toBeGreaterThan(0)

  const forbidden = [
    /\brecipe\b/i, /\bpreheat\b/i, /\bsimmer\b/i, /\bserves \d/i,
    /\bmarinate\b/i, /\bgarnish with\b/i, /\bmethod:/i, /\bstir[- ]fry\b/i,
  ]
  for (const bundle of bundles) {
    const source = await readFile(join('dist', 'assets', bundle), 'utf8')
    for (const pattern of forbidden) {
      expect(source, `${bundle} matched ${pattern}`).not.toMatch(pattern)
    }
  }
})

test('the artifact references no remote origins', async () => {
  const assets = await readdir(join('dist', 'assets'))
  for (const asset of assets) {
    const source = await readFile(join('dist', 'assets', asset), 'utf8')
    expect(source, `${asset} references a remote origin`).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
  }
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:pages`
Expected: FAIL — on a clean tree `dist/assets` does not exist until the build step inside `test:pages` runs, and the subpath load or a guard will trip.

- [ ] **Step 3: Fix whatever the guards catch**

Known and expected: the `/\bstir[- ]fry\b/i` pattern is why the chef id is `stirfry` and its display name is "The Wok" — neither string matches. If a guard trips, rename the offending copy rather than weakening the pattern. The only permitted remote-looking string is the SVG namespace `http://www.w3.org/2000/svg`, which the pattern already excludes.

- [ ] **Step 4: Update the workflow**

In `.github/workflows/pages.yml`, replace the step named `Test the probability model` with:

```yaml
      - name: Test the game logic
        run: npm test
```

Leave the remaining steps (`Install the test browser`, `Test the interactive app`, `Build and verify the Pages artifact`, `Upload the built site only`) and the whole `deploy` job unchanged — they already run `npm run test:e2e`, `npm run test:pages`, and upload only `dist/`.

- [ ] **Step 5: Write the README**

Create `README.md`:

````markdown
# Cooking Battle

A two-player ingredient game for cooking together. Each player is dealt a
balanced set of five ingredients — protein, vegetable, starch, aromatic,
wildcard — and both hands combine into one shared counter of ten that you both
cook from.

**This is an ingredient generator, not a recipe generator.** The app never tells
you what to make. That part is yours.

No AI, backend, API keys, analytics, remote fonts, or runtime dependencies.
Everything runs in your browser and nothing leaves it.

## How to play

1. Each player picks a chef. Tap any chip to leave ingredients out —
   "Meat & fish" makes it vegetarian, "Animal products" makes it vegan.
2. Press **Deal**. Ten ingredients land on the counter, two in every category,
   and no two the same.
3. Invent a dish each from whatever is on the counter. Everything on the free
   shelf — oil, salt, butter, flour, eggs and the rest — is unlimited and does
   not count toward the ten.
4. Press **Deal** again whenever you want a new counter.

Your chef picks and chips are remembered in your browser. Tap either chef on
the stage to change them.

## Run locally

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

For a production build:

```sh
npm run build
npm run preview
```

Serve `dist/` over HTTP rather than opening the HTML as a `file:` URL.

## Validate

```sh
npm test                                        # game logic
npx playwright install chromium --only-shell    # once
npm run test:e2e                                # browser
npm run test:pages                              # built artifact
```

Unit tests cover slot balance, the ten-distinct guarantee, tag filtering,
seeded replay, utensil mapping, and storage validation. Browser tests exercise
chef select, dealing, persistence, reduced motion, and the absence of external
requests. The Pages suite checks the built artifact under a repository subpath
and asserts it ships no recipe text and no remote origins.

## Deploy

The app is static. Push to `main` and the **Deploy GitHub Pages** workflow
installs, tests, builds, verifies and publishes `dist/` only.

Treat the site and its JavaScript bundle as public.

## Source map

- [Ingredient pantry](./src/data/) — tagged ingredients, one file per category
- [Deal](./src/deal.ts) — the draw, with balance and distinctness guarantees
- [Filters](./src/filters.ts) — diet tag exclusion
- [Chefs](./src/chefs/) — roster, utensils, figurine assembly
- [Interface](./src/ui/) — chef select and the stage
- [Styles](./src/styles/) — tokens and per-screen CSS
````

- [ ] **Step 6: Run everything**

Run: `npm test && npm run test:e2e && npm run test:pages && npx tsc --noEmit`
Expected: every suite PASS.

- [ ] **Step 7: Check unit coverage against the 80% floor**

Add the script to `package.json`:

```json
    "test:coverage": "node --test --experimental-test-coverage tests/*.test.ts"
```

Run: `npm run test:coverage`
Expected: the summary table reports **≥ 80% line coverage** overall, and `src/deal.ts`,
`src/filters.ts` and `src/rng.ts` at or near 100%. `src/ui/*` and `src/main.ts` are
exercised by Playwright, not by `node --test`, so they will show low numbers here —
that is expected and is not a coverage failure. If a *pure* module falls below 80%,
add the missing case rather than lowering the bar.

- [ ] **Step 8: Check the performance budget**

Run: `npm run build && ls -l dist/assets && gzip -c dist/assets/*.js | wc -c`
Expected: JS under 80 kb gzipped and CSS under 15 kb. Both should land far below. If JS exceeds the budget, the ingredient data is the only plausible cause — report the number rather than silently accepting it.

- [ ] **Step 9: Commit**

```bash
git add tests/pages/deployment.spec.ts README.md package.json .github/workflows/pages.yml
git commit -m "feat: guard the artifact against recipe text and remote origins"
```

---

## Final verification

- [ ] `npm test` — every unit suite passes
- [ ] `npm run test:coverage` — ≥ 80% overall; pure modules at or near 100%
- [ ] `npm run test:e2e` — select, stage and game suites pass
- [ ] `npm run test:pages` — artifact verified at a repository subpath
- [ ] `npx tsc --noEmit` — clean
- [ ] `git status` — clean tree
- [ ] Resize to 320, 375, 768, 1024, 1440 and 1920 px; confirm no horizontal overflow at any of them (spec §12)
- [ ] Tab through select and stage; confirm every control is reachable with a visible focus ring
- [ ] Toggle OS reduced-motion on and confirm the counter appears instantly
- [ ] Confirm no file in `src/` exceeds 400 lines
- [ ] **Do not merge to `main` or push until the user asks** — `main` deploys on push
