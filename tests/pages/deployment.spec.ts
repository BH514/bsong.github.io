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
    /\brecipes?\s+(for|:)/i, /\bhow to (make|cook)\b/i,
    /\bpreheat\b/i, /\bsimmer\b/i, /\bserves \d/i,
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
