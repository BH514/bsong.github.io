import { test, expect } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = 'http://127.0.0.1:4173/cooking-battle/'

/**
 * Every file a visitor can actually read, not just the JS. index.html holds
 * the meta description and the noscript copy — the likeliest place a recipe
 * phrase would land — and a CSS `content:` string would be just as visible.
 */
async function servedFiles(): Promise<readonly string[]> {
  const entries = await readdir('dist', { recursive: true })
  return entries
    .map((entry) => String(entry))
    .filter((name) => /\.(js|css|html)$/i.test(name))
    .map((name) => join('dist', name))
}

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

test('the built document carries an enforced content security policy', async ({ page }) => {
  const html = await readFile(join('dist', 'index.html'), 'utf8')
  expect(html).toMatch(/http-equiv="Content-Security-Policy"/)

  await page.goto(BASE)
  const blocked = await page.evaluate(() => new Promise<readonly string[]>((resolve) => {
    const seen: string[] = []
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(event.violatedDirective)
    })
    const style = document.createElement('style')
    style.textContent = 'body { outline: 9px solid red }'
    document.head.append(style)
    const script = document.createElement('script')
    script.textContent = 'window.name = "pwned"'
    document.head.append(script)
    const image = document.createElement('img')
    image.src = 'https://example.com/pixel.png'
    document.body.append(image)
    setTimeout(() => resolve(seen), 500)
  }))
  expect(blocked).toContain('style-src-elem')
  expect(blocked).toContain('script-src-elem')
  expect(blocked).toContain('img-src')
})

test('the built app loads a favicon without a request', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => { requested.push(request.url()) })
  await page.goto(BASE)
  const icon = await page.evaluate(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    return link === null ? null : link.getAttribute('href')
  })
  expect(icon, 'index.html declares no favicon, so the tab is blank').not.toBeNull()
  expect(icon).toMatch(/^data:image\/svg\+xml,/)
  expect(requested.filter((url) => /favicon/i.test(url))).toEqual([])
})

test('the artifact ships no presentation files', async () => {
  const entries = await readdir('dist', { recursive: true })
  const banned = entries.filter((name) => /\.(pptx?|pptm|potx|ppsx)$/i.test(String(name)))
  expect(banned).toEqual([])
})

test('the artifact contains no recipe instructions', async () => {
  const bundles = await servedFiles()
  expect(bundles.length).toBeGreaterThan(0)

  const forbidden = [
    /\brecipes?\s+(for|:)/i, /\bhow to (make|cook)\b/i,
    /\bpreheat\b/i, /\bsimmer\b/i, /\bserves \d/i,
    /\bmarinate\b/i, /\bgarnish with\b/i, /\bmethod:/i, /\bstir[- ]fry\b/i,
    // Spec §1 forbids recommending pairings; §13 forbids dish names.
    /\bserve[sd]?\s+with\b/i,
    /\bpairs?\s+(well\s+)?with\b/i,
    /\bgoes well with\b/i,
    /\bserving suggestion/i,
  ]
  for (const bundle of bundles) {
    const source = await readFile(bundle, 'utf8')
    for (const pattern of forbidden) {
      expect(source, `${bundle} matched ${pattern}`).not.toMatch(pattern)
    }
  }
})

test('the artifact references no remote origins', async () => {
  const bundles = await servedFiles()
  expect(bundles.length).toBeGreaterThan(0)

  for (const bundle of bundles) {
    const source = await readFile(bundle, 'utf8')
    expect(source, `${bundle} references a remote origin`)
      .not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
  }
})
