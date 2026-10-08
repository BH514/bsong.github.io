import { expect, test, type Page } from '@playwright/test';

async function setTemperature(page: Page, value: string) {
  await page.getByLabel('Temperature', { exact: true }).evaluate((element, next) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected a range input');
    element.value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('runs the same prompt through three visible, honestly labeled modes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Same input/ })).toBeVisible();
  await expect(page.getByText('Hand-authored toy model')).toBeVisible();
  await expect(page.locator('.lane')).toHaveCount(3);
  await expect(page.locator('#total-runs')).toHaveText('0');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  await expect(page.locator('#total-runs')).toHaveText('1');
  await expect(page.locator('#rules-output')).toContainText('hidden key beneath the city.');
  await expect(page.locator('#greedy-output')).toContainText('glowing garden beneath the city.');
  await expect(page.locator('#sample-output')).toContainText('The tiny robot');
});

test('fifty runs form identical deterministic mosaics and varied sampled results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  await expect(page.locator('#total-runs')).toHaveText('50');
  await expect(page.locator('#rules-unique')).toHaveText('1');
  await expect(page.locator('#greedy-unique')).toHaveText('1');
  expect(Number(await page.locator('#sample-unique').textContent())).toBeGreaterThan(1);
  await expect(page.locator('#sample-mosaic .mosaic-tile')).toHaveCount(50);
  await expect(page.locator('#rules-mosaic .mosaic-tile')).toHaveCount(50);
});

test('temperature reshapes odds and starts a clean comparison', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.probability-value').first()).toHaveText('55%');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  await setTemperature(page, '2');
  await expect(page.locator('#temperature-value')).toHaveText('2.0');
  await expect(page.locator('#total-runs')).toHaveText('0');
  await expect(page.locator('.probability-value').first()).toHaveText('44%');
  await expect(page.locator('#sample-output')).toContainText('Waiting for the first run');
});

test('locking the seed repeats single runs and replays a varied batch sequence', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Lock random seed').check();
  await page.getByLabel('Random seed', { exact: true }).fill('42');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  const first = await page.locator('#sample-output').textContent();
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  await expect(page.locator('#sample-output')).toHaveText(first!);
  await expect(page.locator('#sample-unique')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset experiment' }).click();
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  const sequence = await page.locator('#sample-mosaic .mosaic-tile')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('title')));
  expect(Number(await page.locator('#sample-unique').textContent())).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Reset experiment' }).click();
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  expect(await page.locator('#sample-mosaic .mosaic-tile')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('title')))).toEqual(sequence);
});

test('invalid seeds show an error and never produce a success-shaped result', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Lock random seed').check();
  await page.getByLabel('Random seed', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('whole-number seed');
  await expect(page.getByLabel('Random seed', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#total-runs')).toHaveText('0');
  await page.getByLabel('Random seed', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  await expect(page.locator('#total-runs')).toHaveText('1');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('step mode exposes decisions without automatically advancing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Step one decision' }).click();
  await expect(page.locator('#playback-status')).toContainText('Paused');
  await expect(page.locator('#sample-lane')).toHaveAttribute('data-revealed', '1');
  await page.waitForTimeout(150);
  await expect(page.locator('#sample-lane')).toHaveAttribute('data-revealed', '1');
  await page.getByRole('button', { name: 'Step one decision' }).click();
  await expect(page.locator('#sample-lane')).toHaveAttribute('data-revealed', '2');
  await page.getByRole('button', { name: 'Step one decision' }).click();
  await expect(page.locator('#total-runs')).toHaveText('1');
});

test('changing settings cancels an in-flight batch and clears its results', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  await expect(page.locator('#playback-status')).toContainText('Running');
  await setTemperature(page, '1.5');
  await page.waitForTimeout(400);
  await expect(page.locator('#total-runs')).toHaveText('0');
  await expect(page.locator('#playback-status')).toContainText('Ready');
  await expect(page.getByRole('button', { name: 'Run once', exact: true })).toBeEnabled();
});

test('a new curated prompt clears the old experiment and drives every lane', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  await page.getByLabel('Story prompt').selectOption('ocean');
  await expect(page.locator('#total-runs')).toHaveText('0');
  await page.getByRole('button', { name: 'Run once', exact: true }).click();
  for (const mode of ['rules', 'greedy', 'sample']) {
    await expect(page.locator(`#${mode}-output`)).toContainText('The diver stumbled upon a');
  }
});

test('the guided walkthrough can be navigated and dismissed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Walk me through' }).click();
  await expect(page.getByRole('region', { name: 'Guided walkthrough' })).toBeVisible();
  await expect(page.locator('#tour-progress')).toHaveText('01 / 05');
  await page.getByRole('button', { name: 'Next lesson' }).click();
  await expect(page.locator('#tour-progress')).toHaveText('02 / 05');
  await page.getByRole('button', { name: 'Close walkthrough' }).click();
  await expect(page.getByRole('region', { name: 'Guided walkthrough' })).toBeHidden();
});

test('mobile preserves the experiment without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  await expect(page.locator('#total-runs')).toHaveText('50');
  await expect(page.getByLabel('Temperature', { exact: true })).toBeVisible();
});

test('every playback control stays inside the mobile toolbar', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const clipped = await page.locator('.run-actions').evaluate((toolbar) => {
      const container = toolbar.getBoundingClientRect();
      return [...toolbar.querySelectorAll('button')].filter((button) => {
        const box = button.getBoundingClientRect();
        return box.left < container.left - 1 || box.right > container.right + 1;
      }).map((button) => button.id);
    });
    expect(clipped, `Clipped controls at ${width}px`).toEqual([]);
  }
});

test('the demo makes no third-party requests and has no runtime errors', async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') external.push(url.href);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  await expect(page.locator('#total-runs')).toHaveText('50');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
