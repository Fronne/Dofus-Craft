import { expect, test } from '@playwright/test';
import { chooseServer } from './helpers';

// The Recherche page selects the first result by default: its comparison panel is always there.
test('compares a craft', async ({ page }) => {
  await chooseServer(page);
  await expect(page.getByLabel('Prix HDV')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Coût de craft/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prix des ressources' })).toBeVisible();
});
