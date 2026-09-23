import { expect, type Page } from '@playwright/test';

// The active-server switcher is a button opening a listbox (ServerSwitcher.tsx), not a <select>.
export function activeServerButton(page: Page) {
  return page.getByRole('button', { name: /Serveur actif/ });
}

export async function switchServer(page: Page, name: string) {
  await activeServerButton(page).click();
  await page.getByRole('option', { name }).click();
  await expect(activeServerButton(page)).toContainText(name);
}

export async function chooseServer(page: Page, name = 'Mikhal') {
  await page.goto('/');
  await page.getByRole('button', { name }).click();
}

export function searchInput(page: Page) {
  return page.getByPlaceholder('Rechercher un objet ou une panoplie...');
}
