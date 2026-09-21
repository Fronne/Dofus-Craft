# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pinned-item-server-prices.spec.ts >> keeps a pinned item shared across servers while its market price stays per-server
- Location: tests/e2e/pinned-item-server-prices.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Serveur actif')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation "Navigation principale" [ref=e4]:
    - generic [ref=e5]:
      - generic [aria-hidden] [ref=e6]: DC
      - generic [ref=e7]: DofusCraft
    - button "Serveur actif Mikhal" [ref=e9] [cursor=pointer]:
      - generic [ref=e15]:
        - generic [ref=e16]: Serveur actif
        - generic [ref=e17]: Mikhal
    - list [ref=e20]:
      - listitem [ref=e21]:
        - link "Accueil" [ref=e22] [cursor=pointer]:
          - /url: /accueil
      - listitem [ref=e28]:
        - link "Recherche" [ref=e29] [cursor=pointer]:
          - /url: /
      - listitem [ref=e34]:
        - link "Épinglés" [ref=e35] [cursor=pointer]:
          - /url: /epingles
      - listitem [ref=e39]:
        - link "Prix" [ref=e40] [cursor=pointer]:
          - /url: /prix
      - listitem [ref=e47]:
        - link "Paramètres" [ref=e48] [cursor=pointer]:
          - /url: /parametres
    - generic [ref=e54]:
      - button "Activer le thème sombre" [pressed] [ref=e55] [cursor=pointer]
      - generic [ref=e58]: v0.1.0
  - main [ref=e60]:
    - generic [ref=e61]:
      - generic [ref=e62]:
        - generic [ref=e63]:
          - generic [ref=e64]: Rechercher un objet ou une panoplie
          - textbox "Rechercher un objet ou une panoplie" [ref=e66]:
            - /placeholder: Rechercher un objet ou une panoplie...
        - group "Filtres" [ref=e67]:
          - group "Catégorie" [ref=e69]:
            - list [ref=e71]:
              - button "Tous les équipements" [pressed] [ref=e72] [cursor=pointer]
              - button "Arme" [ref=e80] [cursor=pointer]
              - button "Amulette" [ref=e84] [cursor=pointer]
              - button "Anneau" [ref=e88] [cursor=pointer]
              - button "Ceinture" [ref=e92] [cursor=pointer]
              - button "Bottes" [ref=e96] [cursor=pointer]
              - button "Chapeau" [ref=e100] [cursor=pointer]
              - button "Cape" [ref=e104] [cursor=pointer]
              - button "Bouclier" [ref=e108] [cursor=pointer]
              - button "Trophée" [ref=e112] [cursor=pointer]
          - generic [ref=e117]:
            - generic [ref=e118]:
              - text: Niveau min
              - spinbutton "Niveau min" [ref=e119]
            - generic [ref=e120]:
              - text: Niveau max
              - spinbutton "Niveau max" [ref=e121]
      - generic [ref=e122]:
        - generic [ref=e123]:
          - generic [ref=e124]: 3152 objets trouvés
          - generic [ref=e125]:
            - text: "Afficher :"
            - combobox "Afficher :" [ref=e126]:
              - option "12" [selected]
              - option "24"
              - option "48"
              - option "96"
        - generic "Résultats de recherche" [ref=e127]:
          - button "Ailes en bois alourdies Niveau 1" [ref=e128] [cursor=pointer]:
            - generic [ref=e129]:
              - generic [ref=e130]: Ailes en bois alourdies
              - generic [ref=e131]: Niveau 1
          - button "Anneau de l'Audacieux Niveau 1" [ref=e132] [cursor=pointer]:
            - generic [ref=e133]:
              - generic [ref=e134]: Anneau de l'Audacieux
              - generic [ref=e135]: Niveau 1
          - button "Anneau Rexik Niveau 1" [ref=e136] [cursor=pointer]:
            - generic [ref=e137]:
              - generic [ref=e138]: Anneau Rexik
              - generic [ref=e139]: Niveau 1
          - button "Arc de Chasse Niveau 1" [ref=e140] [cursor=pointer]:
            - generic [ref=e141]:
              - generic [ref=e142]: Arc de Chasse
              - generic [ref=e143]: Niveau 1
          - button "Bottananas Niveau 1" [ref=e144] [cursor=pointer]:
            - generic [ref=e145]:
              - generic [ref=e146]: Bottananas
              - generic [ref=e147]: Niveau 1
          - button "Bottes de Force Niveau 1" [ref=e148] [cursor=pointer]:
            - generic [ref=e149]:
              - generic [ref=e150]: Bottes de Force
              - generic [ref=e151]: Niveau 1
          - button "Bouclier du Bûcheron Niveau 1" [ref=e152] [cursor=pointer]:
            - generic [ref=e153]:
              - generic [ref=e154]: Bouclier du Bûcheron
              - generic [ref=e155]: Niveau 1
          - button "Bounihimée Niveau 1" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]:
              - generic [ref=e158]: Bounihimée
              - generic [ref=e159]: Niveau 1
          - button "Cape Bontarienne Niveau 1" [ref=e160] [cursor=pointer]:
            - generic [ref=e161]:
              - generic [ref=e162]: Cape Bontarienne
              - generic [ref=e163]: Niveau 1
          - button "Cape Brâkmarienne Niveau 1" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]:
              - generic [ref=e166]: Cape Brâkmarienne
              - generic [ref=e167]: Niveau 1
          - button "Casque alourdi Niveau 1" [ref=e168] [cursor=pointer]:
            - generic [ref=e169]:
              - generic [ref=e170]: Casque alourdi
              - generic [ref=e171]: Niveau 1
          - button "Ceinture de Chance Niveau 1" [ref=e172] [cursor=pointer]:
            - generic [ref=e173]:
              - generic [ref=e174]: Ceinture de Chance
              - generic [ref=e175]: Niveau 1
    - generic [ref=e176]:
      - generic [ref=e177]: Prix HDV
      - generic [ref=e178]:
        - generic [ref=e180]:
          - textbox "Prix HDV" [active] [ref=e181]:
            - /placeholder: Prix en kamas
            - text: 500 000
          - img "kamas"
        - generic [ref=e182]:
          - generic [ref=e183]:
            - paragraph [ref=e184]: Comparaison incomplète
            - paragraph [ref=e188]: "Comparaison incomplète : 2 prix de ressources manquants."
          - paragraph [ref=e189]:
            - text: "Coût de craft :"
            - strong [ref=e190]: 0 kamas
            - text: (partiel)
    - generic [ref=e191]:
      - generic [ref=e192]:
        - button "Désépingler" [ref=e193] [cursor=pointer]
        - img "Anneau Rexik" [ref=e196]
        - heading "Anneau Rexik" [level=2] [ref=e197]
        - paragraph [ref=e198]: "Niveau : 1"
        - paragraph [ref=e199]: "Catégorie : Anneau"
        - region [ref=e201]:
          - heading "Effets" [level=3] [ref=e202]
          - list [ref=e203]:
            - listitem [ref=e204]: 4 à 5 Agilité
      - generic [ref=e205]:
        - heading "Prix des ressources" [level=2] [ref=e206]
        - generic [ref=e207]:
          - generic [ref=e208]: Peau de Gloot
          - generic [ref=e211]: × 3
          - textbox "Peau de Gloot × 3" [ref=e213]:
            - /placeholder: Prix unitaire
        - generic [ref=e214]:
          - generic [ref=e215]: Plume Chimérique
          - generic [ref=e218]: × 3
          - textbox "Plume Chimérique × 3" [ref=e220]:
            - /placeholder: Prix unitaire
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
> 14 |   await page.getByLabel('Serveur actif').selectOption('dakal');
     |                                          ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
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
  48 |   await expect(page.getByLabel('Prix HDV')).toHaveValue('');
  49 | });
  50 | 
```