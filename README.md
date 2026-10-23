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
   "Meat & fish" for vegetarian, "Animal products" for vegan.
2. Press **Deal**. Ten ingredients land on the counter, two in every category,
   and no two the same.
3. Invent a dish each from whatever is on the counter. Everything on the free
   shelf — oil, salt, butter, flour, eggs and the rest — is unlimited and does
   not count toward the ten.
4. Press **Deal** again whenever you want a new counter.

Your chef picks and chips are remembered in your browser. Tap either chef on
the stage to change them.

The chips work on generic ingredient names, and commercial versions of some
condiments vary: jarred kimchi and curry paste often contain fish sauce or
shrimp paste, and gochujang usually contains wheat. If a filter matters to you,
check the label on the jar.

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

Unit tests cover slot balance, the ten-distinct guarantee, counter order, tag
filtering, seeded replay, utensil mapping, and storage validation. Browser
tests exercise chef select, dealing, persistence, focus handling, motion and
reduced motion, layout stability, and the absence of external requests. The
Pages suite checks the built artifact under a repository subpath and asserts it
ships no recipe text and no remote origins, carries an enforced CSP, and needs
no request for its favicon.

`npm run test:coverage` reports only the modules the unit tests import. The UI
layer — `src/main.ts`, `src/ui/` and the stylesheets — is covered by the
browser suites instead, which `node --test` cannot see, so a high figure there
is not whole-codebase coverage.

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
