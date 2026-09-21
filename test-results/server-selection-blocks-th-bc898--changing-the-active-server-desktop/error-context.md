# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: server-selection.spec.ts >> blocks the app then remembers and allows changing the active server
- Location: tests/e2e/server-selection.spec.ts:3:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: getByLabel('Serveur actif')
Expected: "mikhal"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" getByLabel('Serveur actif') with timeout 5000ms
  - waiting for getByLabel('Serveur actif')

```

```yaml
- navigation "Navigation principale":
  - text: DofusCraft
  - button "Serveur actif Mikhal"
  - list:
    - listitem:
      - link "Accueil":
        - /url: /accueil
    - listitem:
      - link "Recherche":
        - /url: /
    - listitem:
      - link "Épinglés":
        - /url: /epingles
    - listitem:
      - link "Prix":
        - /url: /prix
    - listitem:
      - link "Paramètres":
        - /url: /parametres
  - button "Activer le thème sombre" [pressed]
  - text: v0.1.0
- main:
  - text: Rechercher un objet ou une panoplie
  - textbox "Rechercher un objet ou une panoplie":
    - /placeholder: Rechercher un objet ou une panoplie...
  - group "Filtres":
    - text: Filtres
    - group "Catégorie":
      - text: Catégorie
      - list:
        - button "Tous les équipements" [pressed]
        - button "Arme"
        - button "Amulette"
        - button "Anneau"
        - button "Ceinture"
        - button "Bottes"
        - button "Chapeau"
        - button "Cape"
        - button "Bouclier"
        - button "Trophée"
    - text: Niveau min
    - spinbutton "Niveau min"
    - text: Niveau max
    - spinbutton "Niveau max"
  - text: "Calcul du nombre total… Afficher :"
  - combobox "Afficher :":
    - option "12" [selected]
    - option "24"
    - option "48"
    - option "96"
  - button "Anneau Rexik Niveau 1"
  - button "Arc de Chasse Niveau 1"
  - button "Bottananas Niveau 1"
  - button "Bottes de Force Niveau 1"
  - button "Cape Bontarienne Niveau 1"
  - button "Cape Brâkmarienne Niveau 1"
  - button "Ceinture de Chance Niveau 1"
  - button "Couteau de Chasse Niveau 1"
  - button "Demi-Baguette Niveau 1"
  - button "Hache Hémal Niveau 1"
  - button "Hachette de Bûcheron Niveau 1"
  - button "Koliet Aclou Niveau 1"
  - text: Prix HDV
  - textbox "Prix HDV":
    - /placeholder: Prix en kamas
  - paragraph: Comparaison incomplète
  - paragraph: "Comparaison incomplète : 2 prix de ressources manquants et le prix HDV n’est pas renseigné."
  - paragraph:
    - text: "Coût de craft :"
    - strong: 0 kamas
    - text: (partiel)
  - button "Épingler"
  - img "Anneau Rexik"
  - heading "Anneau Rexik" [level=2]
  - paragraph: "Niveau : 1"
  - paragraph: "Catégorie : Anneau"
  - region "Effets":
    - heading "Effets" [level=3]
    - list:
      - listitem: 4 à 5 Agilité
  - heading "Prix des ressources" [level=2]
  - text: Peau de Gloot × 3
  - textbox "Peau de Gloot × 3":
    - /placeholder: Prix unitaire
  - text: Plume Chimérique × 3
  - textbox "Plume Chimérique × 3":
    - /placeholder: Prix unitaire
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('blocks the app then remembers and allows changing the active server', async ({ page }) => {
  4  |   await page.goto('/');
  5  | 
  6  |   await expect(page.getByRole('heading', { name: 'Choisissez votre serveur' })).toBeVisible();
  7  |   await expect(page.getByPlaceholder('Rechercher un objet ou une panoplie...')).toHaveCount(0);
  8  | 
  9  |   await page.getByRole('button', { name: 'Mikhal' }).click();
  10 | 
  11 |   await expect(page.getByRole('heading', { name: 'Choisissez votre serveur' })).toHaveCount(0);
> 12 |   await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');
     |                                                  ^ Error: expect(locator).toHaveValue(expected) failed
  13 | 
  14 |   await page.reload();
  15 | 
  16 |   await expect(page.getByRole('heading', { name: 'Choisissez votre serveur' })).toHaveCount(0);
  17 |   await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');
  18 | 
  19 |   await page.getByLabel('Serveur actif').selectOption('dakal');
  20 |   await expect(page.getByLabel('Serveur actif')).toHaveValue('dakal');
  21 | });
  22 | 
```