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
