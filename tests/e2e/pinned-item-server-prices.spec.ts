import { test, expect } from '@playwright/test';
import { activeServerButton, switchServer } from './helpers';

test('keeps a pinned item shared across servers while its market price stays per-server', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  await page.getByRole('button', { name: 'Épingler' }).click();
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();

  const marketInput = page.getByLabel('Prix HDV');
  await marketInput.fill('500000');
  await expect(marketInput).toHaveValue('500 000');

  await switchServer(page, 'Dakal');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('');

  await page.getByLabel('Prix HDV').fill('750000');
  await expect(page.getByLabel('Prix HDV')).toHaveValue('750 000');

  await switchServer(page, 'Mikhal');
  await expect(page.getByLabel('Prix HDV')).toHaveValue('500 000');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();

  await page.reload();
  await expect(activeServerButton(page)).toContainText('Mikhal');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('500 000');

  await switchServer(page, 'Dakal');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('750 000');
});

test('erasing an already-saved market price leaves the field empty for good, even after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByRole('button', { name: 'Épingler' }).click();

  const marketInput = page.getByLabel('Prix HDV');
  await marketInput.fill('3500');
  await expect(marketInput).toHaveValue('3 500');

  await marketInput.fill('');
  await expect(marketInput).toHaveValue('');
  // Each keystroke is written to IndexedDB asynchronously: wait for the removal to land before
  // reloading, as a real player would never reload within a few milliseconds of typing.
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('dofus-craft');
    request.onsuccess = () => {
      const count = request.result.transaction('pinned-item-prices-by-server').objectStore('pinned-item-prices-by-server').count();
      count.onsuccess = () => resolve(count.result);
    };
  }))).toBe(0);

  await page.reload();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('');
});
