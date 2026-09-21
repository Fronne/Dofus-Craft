# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalogue-search.spec.ts >> shows aligned resource images and formats price input
- Location: tests/e2e/catalogue-search.spec.ts:17:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Rechercher un objet')

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [aria-hidden] [ref=e5]: DofusCraft
    - heading "Choisissez votre serveur" [level=2] [ref=e6]
    - paragraph [ref=e7]: Sélectionnez votre serveur Dofus pour commencer à utiliser Dofus Craft.
    - generic [ref=e8]:
      - heading "Mono-compte" [level=3] [ref=e9]
      - list [ref=e10]:
        - listitem [ref=e11]:
          - button "Dakal" [ref=e12] [cursor=pointer]
        - listitem [ref=e13]:
          - button "Draconiros" [ref=e14] [cursor=pointer]
        - listitem [ref=e15]:
          - button "Kourial" [ref=e16] [cursor=pointer]
        - listitem [ref=e17]:
          - button "Mikhal" [ref=e18] [cursor=pointer]
    - generic [ref=e19]:
      - heading "Multi-compte" [level=3] [ref=e20]
      - list [ref=e21]:
        - listitem [ref=e22]:
          - button "Brial" [ref=e23] [cursor=pointer]
        - listitem [ref=e24]:
          - button "Hell Mina" [ref=e25] [cursor=pointer]
        - listitem [ref=e26]:
          - button "Imagiro" [ref=e27] [cursor=pointer]
        - listitem [ref=e28]:
          - button "Orukam" [ref=e29] [cursor=pointer]
        - listitem [ref=e30]:
          - button "Rafal" [ref=e31] [cursor=pointer]
        - listitem [ref=e32]:
          - button "Salar" [ref=e33] [cursor=pointer]
        - listitem [ref=e34]:
          - button "Tal Kasha" [ref=e35] [cursor=pointer]
        - listitem [ref=e36]:
          - button "Tylezia" [ref=e37] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('finds Strigide and Volkorne items in the real catalogue flow', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   const search = page.getByLabel('Rechercher un objet');
  6  | 
  7  |   await search.fill('Amulette du Strigide');
  8  |   await expect(page.getByRole('button', { name: /Amulette du Strigide/ })).toBeVisible({ timeout: 30_000 });
  9  | 
  10 |   await search.fill('Strigide');
  11 |   await expect(page.getByRole('button', { name: /Strigide/ }).first()).toBeVisible({ timeout: 30_000 });
  12 | 
  13 |   await search.fill('Volkorne');
  14 |   await expect(page.getByRole('button', { name: /Volkorne/ }).first()).toBeVisible({ timeout: 30_000 });
  15 | });
  16 | 
  17 | test('shows aligned resource images and formats price input', async ({ page }) => {
  18 |   await page.goto('/');
  19 |   const search = page.getByLabel('Rechercher un objet');
> 20 |   await search.fill('Amulette du Strigide');
     |                ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  21 | 
  22 |   const item = page.getByRole('button', { name: /Amulette du Strigide/ });
  23 |   await expect(item).toBeVisible({ timeout: 30_000 });
  24 |   await item.click();
  25 | 
  26 |   await expect(page.getByRole('heading', { name: 'Vos prix' })).toBeVisible({ timeout: 30_000 });
  27 |   const rows = page.locator('.price-line');
  28 |   await expect(rows).toHaveCount(8);
  29 |   const images = rows.locator('.resource-display img');
  30 |   await expect(images).toHaveCount(8);
  31 | 
  32 |   const firstImage = await images.first().boundingBox();
  33 |   expect(firstImage).not.toBeNull();
  34 |   for (let index = 1; index < await images.count(); index += 1) {
  35 |     const image = await images.nth(index).boundingBox();
  36 |     expect(image).not.toBeNull();
  37 |     expect(image?.width).toBe(firstImage?.width);
  38 |     expect(image?.height).toBe(firstImage?.height);
  39 |   }
  40 | 
  41 |   const price = rows.first().locator('input');
  42 |   await price.fill('1000');
  43 |   await expect(price).toHaveValue('1 000');
  44 |   await expect(page.getByRole('heading', { name: 'Prix des ressources' })).toBeVisible();
  45 | });
  46 | 
```