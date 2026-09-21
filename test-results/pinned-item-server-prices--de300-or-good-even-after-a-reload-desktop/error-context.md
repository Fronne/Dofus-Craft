# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pinned-item-server-prices.spec.ts >> erasing an already-saved market price leaves the field empty for good, even after a reload
- Location: tests/e2e/pinned-item-server-prices.spec.ts:35:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  getByLabel('Prix HDV')
Expected: ""
Received: "3 500"
Timeout:  5000ms

Call log:
  - Expect "toHaveValue" getByLabel('Prix HDV') with timeout 5000ms
  - waiting for getByLabel('Prix HDV')
    11 × locator resolved to <input value="3 500" inputmode="numeric" aria-invalid="false" id="market-price-input" placeholder="Prix en kamas"/>
       - unexpected value "3 500"

```

```yaml
- textbox "Prix HDV":
  - /placeholder: Prix en kamas
  - text: 3 500
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('keeps a pinned item shared across servers while its market price stays per-server', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await page.getByRole('button', { name: 'Mikhal' }).click();
  6  | 
  7  |   await page.getByRole('button', { name: 'Épingler' }).click();
  8  |   await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  9  | 
  10 |   const marketInput = page.getByLabel('Prix HDV');
  11 |   await marketInput.fill('500000');
  12 |   await expect(marketInput).toHaveValue('500 000');
  13 | 
  14 |   await page.getByLabel('Serveur actif').selectOption('dakal');
  15 |   await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  16 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('');
  17 | 
  18 |   await page.getByLabel('Prix HDV').fill('750000');
  19 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('750 000');
  20 | 
  21 |   await page.getByLabel('Serveur actif').selectOption('mikhal');
  22 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('500 000');
  23 |   await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  24 | 
  25 |   await page.reload();
  26 |   await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');
  27 |   await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  28 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('500 000');
  29 | 
  30 |   await page.getByLabel('Serveur actif').selectOption('dakal');
  31 |   await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  32 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('750 000');
  33 | });
  34 | 
  35 | test('erasing an already-saved market price leaves the field empty for good, even after a reload', async ({ page }) => {
  36 |   await page.goto('/');
  37 |   await page.getByRole('button', { name: 'Mikhal' }).click();
  38 |   await page.getByRole('button', { name: 'Épingler' }).click();
  39 | 
  40 |   const marketInput = page.getByLabel('Prix HDV');
  41 |   await marketInput.fill('3500');
  42 |   await expect(marketInput).toHaveValue('3 500');
  43 | 
  44 |   await marketInput.fill('');
  45 |   await expect(marketInput).toHaveValue('');
  46 | 
  47 |   await page.reload();
> 48 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('');
     |                                             ^ Error: expect(locator).toHaveValue(expected) failed
  49 | });
  50 | 
```