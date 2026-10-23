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
