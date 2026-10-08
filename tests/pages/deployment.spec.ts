import { readdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('the production app loads, runs, and reloads beneath a repository path', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('The Pages test needs a repository-style base URL.');
  const mount = new URL(baseURL);
  const escapedRequests: string[] = [];
  const failedResponses: string[] = [];
  const runtimeErrors: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== mount.origin || !url.pathname.startsWith(mount.pathname)) {
      escapedRequests.push(url.href);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('./');
  expect(escapedRequests, 'Every asset must stay beneath the repository path').toEqual([]);
  await expect(page).toHaveURL(baseURL);
  await expect(page.locator('.lane')).toHaveCount(3);
  await expect(page.locator('#lanes')).toHaveCSS('display', 'grid');

  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  if (!icon) throw new Error('The built page is missing its favicon.');
  const iconURL = new URL(icon, page.url());
  expect(iconURL.pathname.startsWith(mount.pathname)).toBe(true);
  expect((await page.request.get(iconURL.href)).ok()).toBe(true);

  await page.getByLabel('Lock random seed').check();
  await page.getByLabel('Random seed', { exact: true }).fill('42');
  await page.getByRole('button', { name: 'Run 50', exact: true }).click();
  await expect(page.locator('#total-runs')).toHaveText('50');
  await expect(page.locator('#rules-unique')).toHaveText('1');
  await expect(page.locator('#greedy-unique')).toHaveText('1');
  expect(Number(await page.locator('#sample-unique').textContent())).toBeGreaterThan(1);
  await expect(page.locator('#sample-mosaic .mosaic-tile')).toHaveCount(50);

  const skipLink = page.getByRole('link', { name: 'Skip to the experiment' });
  await skipLink.focus();
  await skipLink.press('Enter');
  await expect(page).toHaveURL(`${baseURL}#experiment`);
  await page.reload();
  await expect(page.locator('.lane')).toHaveCount(3);
  await expect(page.locator('#total-runs')).toHaveText('0');
  expect(escapedRequests).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('the deployment artifact excludes source presentations', async () => {
  const files = await readdir(new URL('../../dist/', import.meta.url), { recursive: true });
  expect(files).toContain('index.html');
  expect(files.some((file) => file.endsWith('.js'))).toBe(true);
  expect(files.filter((file) => /\.(pptx?|pptm|potx|ppsx)$/i.test(file))).toEqual([]);
});
