import { expect, test, type Page } from '@playwright/test';

test('keeps the learning lab without the branded header, comparison essay, or site footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Not simply/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'A small model. A clear window.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Same input/ })).toBeVisible();
});

test('uses the supplied brand colors consistently without merging distinct sampled outputs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#run-once')).toHaveCSS('background-color', 'rgb(1, 82, 148)');
  await expect(page.locator('#rules-plot .plot-root')).toHaveCSS('fill', 'rgb(187, 222, 225)');
  await expect(page.locator('#greedy-plot .plot-root')).toHaveCSS('fill', 'rgb(161, 211, 234)');
  await expect(page.locator('#sample-plot .plot-root')).toHaveCSS('fill', 'rgb(250, 200, 50)');
  await page.getByLabel('Lock random seed').check();
  await page.getByLabel('Random seed', { exact: true }).fill('42');
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  const mapping = await page.locator('#sample-mosaic .mosaic-tile').evaluateAll((tiles) => {
    const pairs = tiles.map((tile) => ({
      story: tile.getAttribute('title')?.replace(/^Run \d+: /, ''),
      color: getComputedStyle(tile).backgroundColor,
    }));
    return pairs;
  });
  const byStory = new Map<string, string>();
  const approved = new Set([
    '#47b4bc', '#fac832', '#78a5d1', '#8cc342', '#00a6d7', '#f8d08a',
    '#c3db6a', '#0199a6', '#b9d4e9', '#c0cf30', '#84a9bf', '#a4b638',
    '#e99625', '#bbdee1', '#b6d890', '#3273af', '#bed2e0', '#0090c7',
    '#318040', '#899d3b', '#e4f4f4', '#a1d3ea', '#fcefdf', '#dfe7ec',
    '#5e88a1', '#d67921', '#037cb7',
  ].map((hex) => {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
  }));
  for (const { story, color } of mapping) {
    if (!story) throw new Error('A sampled tile must describe its outcome.');
    expect(approved.has(color), `Unapproved outcome color ${color}`).toBe(true);
    const previous = byStory.get(story);
    if (previous) expect(color).toBe(previous);
    byStory.set(story, color);
  }
  expect(new Set(byStory.values()).size).toBe(byStory.size);
  await page.getByRole('button', { name: /Show all \d+ outcomes/ }).click();
  const cards = await page.locator('.outcome-card').evaluateAll((elements) => elements.map((card) => ({
    story: card.querySelector('p')?.textContent,
    color: getComputedStyle(card.querySelector('.outcome-dot')!).backgroundColor,
  })));
  for (const card of cards) expect(card.color).toBe(byStory.get(card.story ?? ''));
});

test('keeps small text and diagram labels readable on the brand surfaces', async ({ page }) => {
  await page.goto('/');
  const contrasts = await page.locator(
    '.lane-heading > p, .plot-label, .fine-print, .control-explanation, .settings-note, '
    + '.probability-label, .probability-value, .output-text.is-waiting, #run-once',
  ).evaluateAll((elements) => {
    function channels(color: string): number[] {
      const values = color.match(/[\d.]+/g);
      if (!values) throw new Error(`Cannot measure color: ${color}`);
      return values.map(Number);
    }
    function luminance(rgb: number[]): number {
      return rgb.slice(0, 3).reduce((total, value, index) => {
        const scaled = value / 255;
        const linear = scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
        return total + linear * [0.2126, 0.7152, 0.0722][index]!;
      }, 0);
    }
    return elements.map((element) => {
      const style = getComputedStyle(element);
      const foreground = channels(element instanceof SVGElement ? style.fill : style.color);
      let opacity = 1;
      let background: number[] | undefined;
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent);
        opacity *= Number(parentStyle.opacity);
        const color = channels(parentStyle.backgroundColor);
        if (color.length === 3 || color[3] === 1) {
          background = color;
          break;
        }
      }
      if (!background) throw new Error('Readable text needs a known background.');
      const effective = foreground.map((value, index) => value * opacity + background[index]! * (1 - opacity));
      const light = luminance(effective);
      const dark = luminance(background);
      return {
        element: element.id || element.className.toString(),
        ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
      };
    });
  });
  expect(contrasts.length).toBeGreaterThan(15);
  for (const { element, ratio } of contrasts) {
    expect(ratio, `${element} must meet 4.5:1 text contrast`).toBeGreaterThanOrEqual(4.5);
  }
});

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
