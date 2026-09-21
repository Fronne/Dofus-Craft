# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: resource-price-persistence.spec.ts >> isolates resource prices between servers and persists them after a reload
- Location: tests/e2e/resource-price-persistence.spec.ts:3:1

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
        - textbox "Prix HDV" [ref=e181]:
          - /placeholder: Prix en kamas
        - generic [ref=e182]:
          - generic [ref=e183]:
            - paragraph [ref=e184]: Comparaison incomplète
            - paragraph [ref=e188]: "Comparaison incomplète : 1 prix de ressource manquant et le prix HDV n’est pas renseigné."
          - paragraph [ref=e189]:
            - text: "Coût de craft :"
            - strong [ref=e190]: 3 000 kamas
            - text: (partiel)
    - generic [ref=e191]:
      - generic [ref=e192]:
        - button "Épingler" [ref=e193] [cursor=pointer]
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
          - generic [ref=e212]:
            - textbox "Peau de Gloot × 3 kamas 3 000 kamas" [active] [ref=e213]:
              - /placeholder: Prix unitaire
              - text: 1 000
            - img "kamas"
          - generic [ref=e214]: 3 000 kamas
        - generic [ref=e215]:
          - generic [ref=e216]: Plume Chimérique
          - generic [ref=e219]: × 3
          - textbox "Plume Chimérique × 3" [ref=e221]:
            - /placeholder: Prix unitaire
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('isolates resource prices between servers and persists them after a reload', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await page.getByRole('button', { name: 'Mikhal' }).click();
  6  | 
  7  |   const priceInput = page.getByPlaceholder('Prix unitaire').first();
  8  |   await expect(priceInput).toBeVisible();
  9  | 
  10 |   await priceInput.fill('1000');
  11 |   await expect(priceInput).toHaveValue('1 000');
  12 | 
> 13 |   await page.getByLabel('Serveur actif').selectOption('dakal');
     |                                          ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  14 |   await expect(priceInput).toHaveValue('');
  15 | 
  16 |   await priceInput.fill('2000');
  17 |   await expect(priceInput).toHaveValue('2 000');
  18 | 
  19 |   await page.getByLabel('Serveur actif').selectOption('mikhal');
  20 |   await expect(priceInput).toHaveValue('1 000');
  21 | 
  22 |   await page.reload();
  23 |   await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');
  24 |   await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('1 000');
  25 | 
  26 |   await page.getByLabel('Serveur actif').selectOption('dakal');
  27 |   await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('2 000');
  28 | });
  29 | 
```