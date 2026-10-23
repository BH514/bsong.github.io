# Cooking Battle — Design

**Date:** 2026-10-23
**Status:** Approved
**Target:** `https://bh514.github.io/bsong.github.io/` (repo `BH514/bsong.github.io`, project site)

## 1. Purpose

A static, single-screen web app that deals ingredients to two people cooking
together on one device. It assigns a balanced set of five ingredients to each
player, merges both hands into one shared counter of ten, and stops there.

**This is an ingredient-generation game, not a recipe generator.** The app never
assigns recipes, suggests dishes, proposes techniques, or recommends pairings.
Players invent their own dishes. This constraint is load-bearing and is enforced
by test, not just by convention.

### Non-goals

No scoring, judging, or verdicts. No timer. No rarity tiers. No two-device sync
or share links. No editable player names. No per-ingredient re-roll. No backend,
accounts, analytics, telemetry, AI, API keys, remote fonts, or runtime
dependencies. All state stays in the browser.

## 2. Game rules

### Slots

Each player receives exactly one ingredient in each of five slots:

| Order | Slot | Example |
|-------|------|---------|
| 1 | Protein | Chicken thigh |
| 2 | Vegetable | Fennel |
| 3 | Starch | Rice noodles |
| 4 | Aromatic | Ginger |
| 5 | Wildcard | Miso paste |

Balance is guaranteed by construction, not by probability.

### The shared counter

Both hands merge into a single pool of ten. **Both players cook from all ten.**
The counter therefore always holds exactly two ingredients per category.

All ten ingredients are distinct. This is achieved by drawing *two distinct
ingredients per category and assigning one to each player*, which makes
distinctness and balance the same operation rather than two competing
constraints.

### The free shelf

A fixed set of staples is always available to both players and never counted in
the ten: oil, butter, salt, pepper, flour, sugar, vinegar, eggs, water.

The shelf exists so that a hand is always actually cookable — the game is about
invention, not about whether you happened to draw a fat or a seasoning.

### Diet exclusions

Toggle chips exclude whole tag groups before dealing: `pork`, `shellfish`,
`dairy`, `gluten`, `nuts`, `spicy`, `meat`, `animal`. Exclusions apply to the
candidate pool, so balance and distinctness still hold afterwards.

Chips are phrased as exclusions rather than diets, so "vegetarian" is expressed
by excluding `meat` and "vegan" by excluding `animal`. One mechanism, no
overlapping modes to reconcile.

Chips live on the chef-select screen only. The stage HUD displays the active
exclusions as read-only text; changing them means returning to chef select. This
keeps the stage free of controls that could be knocked mid-cook.

## 3. Screens and flow

Two states in one page, not two routes.

1. **Chef select.** Six chefs; player one picks, then player two. Diet chips are
   available here. Both picks and the chip state persist to `localStorage`.
2. **Stage.** HUD (round number, pantry size, active filters), two cockpit
   panels flanked by figurines, chrome VS badge, counter strip, free-shelf line,
   and the Deal button.

On any later visit, saved picks send the player straight to the stage. Tapping
either figurine returns to chef select.

Deal may be pressed repeatedly; the round counter increments per session and
resets on reload.

## 4. Visual direction

Arcade fighter-select. Dark stage with two opposing light sources, clipped-corner
cockpit panels, heavy condensed display caps, a chrome-bevelled VS badge, and the
counter as a lit strip across the stage floor.

| Token | Value | Use |
|-------|-------|-----|
| `--p1` | `#19e3ff` | Player one, graphics and text |
| `--p2-graphic` | `#ff3b24` | Player two, graphics and borders only |
| `--p2-text` | `#ff6a4d` | Player two, all text |
| `--system` | `#ffd400` | HUD labels, Deal button |
| `--ground` | `#0a0d14` → `#04060a` | Stage background |

`#ff3b24` fails contrast for small text on the dark ground; `#ff6a4d` is used for
every P2 text run. This is a correction to the approved mockup, not a deviation
from it.

Display type uses a system stack (Arial Black / Helvetica Neue / Impact) and
labels use a system monospace stack. **No font files are shipped and no remote
fonts are requested.**

## 5. Figurines

Six chefs — the grill, the pastry, the wok, the saucier, the nonna, the punk —
each defined as data (`skin`, `coat`, `accent`, `hat`, `hair`) and assembled from
SVG parts at render time.

**The held utensil is derived from the player's dealt Starch**, so the figurine
changes every round even though the chef does not. Eight utensils, each authored
once: knife, cleaver, whisk, pan, wok, rolling pin, tongs, wooden spoon.

Figurines are built with `document.createElementNS`, never `innerHTML`.

Figurines are **purely cosmetic**. No perks, no stat differences, nothing that
influences draw odds. Chef choice must not be able to change what you are dealt.

## 6. Architecture

Vanilla TypeScript compiled by Vite, with `base: './'` so the same build works at
a domain root or a repository subpath. Zero runtime dependencies.

```
index.html
src/
  main.ts            state, wiring, event handling
  deal.ts            pure draw logic and pool validation
  rng.ts             mulberry32 + shuffle, injectable for deterministic tests
  filters.ts         tag exclusion
  storage.ts         localStorage read/write with validation
  data/
    categories.ts    slot definitions and order
    tags.ts          diet tag definitions
    proteins.ts      ~30 entries
    vegetables.ts    ~30 entries
    starches.ts      ~30 entries, each carrying a utensil hint
    aromatics.ts     ~30 entries
    wildcards.ts     ~30 entries
    shelf.ts         free staples
  chefs/
    roster.ts        six chef definitions
    utensils.ts      eight utensil path sets
    figurine.ts      SVG assembly from body + utensil
  ui/
    select.ts        chef select rendering
    stage.ts         panels, counter, HUD rendering
  styles/
    tokens.css       design tokens
    global.css       reset, base type, focus, reduced motion
    select.css
    stage.css
tests/
  deal.test.ts
  filters.test.ts
  figurine.test.ts
  browser/game.spec.ts
  pages/deployment.spec.ts
```

Each module answers: what it does, how it is used, what it depends on. `deal.ts`,
`filters.ts` and `rng.ts` are pure and depend on nothing but data types.

## 7. Data model

```ts
type CategoryId = 'protein' | 'vegetable' | 'starch' | 'aromatic' | 'wildcard'
type TagId = 'pork' | 'shellfish' | 'dairy' | 'gluten' | 'nuts' | 'spicy' | 'meat' | 'animal'
type UtensilId = 'knife' | 'cleaver' | 'whisk' | 'pan' | 'wok' | 'rolling-pin' | 'tongs' | 'spoon'
// 'stirfry' rather than 'wok' so a chef id can never be confused with the
// 'wok' utensil id at a call site.
type ChefId = 'grill' | 'pastry' | 'stirfry' | 'saucier' | 'nonna' | 'punk'

interface Chef {
  readonly id: ChefId
  readonly name: string         // 'The Grill'
  readonly skin: string
  readonly coat: string
  readonly accent: string
  readonly hat: 'toque' | 'tall-toque' | 'bandana' | 'headscarf' | 'cap' | 'none'
  readonly hair: 'none' | 'bun' | 'beard' | 'moustache' | 'undercut'
}

interface Ingredient {
  readonly id: string           // 'chicken-thigh'
  readonly name: string         // 'Chicken thigh'
  readonly category: CategoryId
  readonly icon: string         // emoji today; swappable for an SVG id later
  readonly tags: readonly TagId[]
  readonly utensil?: UtensilId  // starches only
}

interface Hand {
  readonly slots: readonly Ingredient[]   // length 5, in category order
  readonly utensil: UtensilId
}

interface Deal {
  readonly hands: readonly [Hand, Hand]
  readonly counter: readonly Ingredient[] // all 10, category order
}

interface GameState {
  readonly chefs: readonly [ChefId | null, ChefId | null]
  readonly excluded: readonly TagId[]
  readonly deal: Deal | null
  readonly round: number
}
```

All state is immutable; every transition returns a new object rather than
mutating in place.

The `icon` field is a deliberate seam. Icons are emoji in this version, which
costs nothing and requests nothing but renders inconsistently across platforms.
Replacing them with authored SVG icons later is a data edit, not a refactor.

## 8. Draw algorithm

```
dealCounter(pools, excluded, rng) -> Deal | DealFailure

for each of the five categories, in order:
  candidates = pools[category] filtered to exclude any ingredient
               carrying an excluded tag
  if candidates.length < 2: return failure naming that category
  pick two distinct candidates via shuffle-and-take-two using rng
  assign the first to player one, the second to player two

utensil(player) = player's starch ingredient's utensil, else 'knife'
counter = all ten, ordered by category then player
```

Randomness comes from an injectable mulberry32 generator so unit tests are
deterministic. A fresh seed is generated per deal; there is no seed UI.

## 9. Error handling

The meaningful failure is over-filtering. `dealCounter` validates its pools
*before* drawing and returns a typed failure rather than throwing:

```ts
interface DealFailure {
  readonly kind: 'insufficient-pool'
  readonly category: CategoryId
  readonly remaining: number
}
```

The UI disables Deal and names both the category and the responsible chips, for
example: *"Vegetable has only 1 ingredient left — turn off **nuts** or
**animal**."* Silent empty states and thrown exceptions are both unacceptable.

`storage.ts` validates everything it reads from `localStorage`; unknown chef ids
or tag ids are discarded rather than trusted, and corrupt JSON falls back to
defaults without surfacing an error.

**This path is unreachable with the shipped pantry.** Every category keeps at
least two ingredients carrying no tags at all, and `tests/deal.test.ts` asserts
exactly that — dealing still succeeds with all eight exclusions on. So the
failure panel, the live-region announcement and the disabled Deal button are
defensive only: no browser test can reach them, and the browser suite's silence
about them is not coverage. The sentence itself is covered directly, as a unit
test on `describeDealFailure`, which is the only way to test it at all. The path
stays in because a future pantry edit could narrow a category, and because a
silent empty state would be worse.

## 10. Accessibility

- Semantic landmarks (`header`, `main`, `section`), one `h1`, skip link.
- Chef pickers are genuine radiogroups (`role="radiogroup"`, `aria-checked`),
  keyboard navigable with arrow keys.
- Filter chips are toggle buttons with `aria-pressed`.
- Each deal is announced through a polite live region listing all ten
  ingredients, so the game is fully playable without seeing the stage.
- Figurines are `aria-hidden`; the chef's name is always present as text.
- Visible `:focus-visible` rings on every interactive element.
- Colour is never the only carrier of meaning: each panel is labelled "Player
  One" / "Player Two" in text, and every ingredient shows its category in text.

## 11. Motion

Motion is restricted to compositor-friendly and paint-only properties:
`transform`, `opacity` and `filter` for animation, plus cheap paint-only
properties such as `background` and `border-color` for the chip and button
hover transitions.

Layout-bound properties remain banned outright, because animating them forces
reflow: `width`, `height`, `top`, `left`, `margin`, `padding`, `border` width
and `font-size`.

- Figurines slide in from the outer edges and settle.
- Slot pips fill sequentially.
- VS badge slams with a shockwave ring.
- Counter tiles pop in on a 40 ms stagger.

The figurine entrance belongs to arriving on the stage, not to every deal —
re-flying them in would hide the newly dealt utensil. The badge slam, the pips
and the tiles play on each deal, which is each new round.

Under `prefers-reduced-motion: reduce`, every animation and transition is
removed and the deal renders instantly.

## 12. Performance budget

Microsite targets: **< 80 kb JS gzipped, < 15 kb CSS**. No images, no font
files, no third-party scripts. LCP < 2.5 s, CLS < 0.1.

Ingredient names vary in length, so the counter strip would otherwise reflow as
tiles wrap. The cockpit panels and the counter strip each reserve a `min-height`
sized to their worst case per breakpoint, so dealing swaps content without
moving anything below it.

Responsive at 320, 375, 768, 1024, 1440 and 1920 px with no overflow. Below the
tablet breakpoint the two cockpit panels stack and the figurines shrink to
nameplate scale rather than being removed.

## 13. Testing

**Unit** (`node --test`, TypeScript executed directly):

- every hand holds exactly one ingredient per category
- all ten dealt ingredients are distinct
- the counter holds exactly two per category
- excluded tags never appear in a deal
- a category with fewer than two candidates returns `insufficient-pool`
- a fixed seed reproduces an identical deal
- starch → utensil mapping, including the `knife` fallback
- chef choice does not affect the dealt ingredients

**Browser** (Playwright): dealing changes the counter, filters visibly exclude,
chef picks survive reload, the reduced-motion path renders instantly, no console
errors, and **no external network requests**.

**Content guard:** a test asserts the built bundle contains no recipe-shaped
strings (no instruction verbs paired with ingredients, no dish names), enforcing
section 1.

**Pages:** the built artifact served under a repository-style subpath, as the
reference app already does.

Coverage target 80% minimum, with the pure modules (`deal`, `filters`, `rng`)
near-complete.

## 14. Deployment

The existing `.github/workflows/pages.yml` is reused: install, unit test,
browser test, build-and-verify the artifact, upload `dist/` only, deploy to the
`github-pages` environment.

### Repo housekeeping

Development happens on `feat/cooking-battle` because the workflow deploys on
every push to `main`; building on `main` would publish a half-finished site.

Three changes land with the implementation:

1. Commit the removal of the Branching Futures app from the repository root (17
   files, already deleted in the working tree).
2. Add `vs_ai_demo_ref/` to `.gitignore` — the reference app stays local and
   unpublished.
3. Add `.superpowers/` to `.gitignore` — brainstorming mockups must never reach
   the published site.

### Publication boundary

Treat the site and its bundle as public. Everything in it is original synthetic
content: invented chef archetypes and a hand-authored ingredient list. No
personal information, no confidential material.

## 15. Decisions recorded

| Decision | Choice | Why |
|----------|--------|-----|
| Repo layout | App at root; reference kept local | One build, one artifact, minimal workflow change |
| Play model | One shared device, both hands visible | A phone on the counter; no sync, no passing a device with messy hands |
| Draw rules | Fixed five slots + free shelf | Balance guaranteed by construction; every hand cookable |
| Ten-ingredient model | Deal five each, merge into a shared counter | Same mise en place, two different dishes |
| Scoring | None | Explicitly not wanted |
| Timer | None | Explicitly not wanted |
| Ingredients | ~150, tagged, with diet filters | A real restriction shouldn't force endless re-deals |
| Visual direction | Arcade fighter select | The structure itself carries the two-player game |
| Figurines | Roster pick + deal-driven utensil | Identity from picking a chef, variety from the deal |
| Icons | Emoji behind an `icon` seam | Zero cost now, swappable later |
| Persistence | `localStorage` for chefs and filters | Skip setup on every later visit |
