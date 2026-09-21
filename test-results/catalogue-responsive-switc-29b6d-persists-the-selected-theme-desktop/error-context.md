# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalogue-responsive.spec.ts >> switches and persists the selected theme
- Location: tests/e2e/catalogue-responsive.spec.ts:2:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Activer le thème clair' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Activer le thème clair' }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Activer le thème clair' })

```

```yaml
- main "Choisissez votre serveur":
  - heading "Choisissez votre serveur" [level=2]
  - paragraph: Sélectionnez votre serveur Dofus pour commencer à utiliser Dofus Craft.
  - heading "Mono-compte" [level=3]
  - list:
    - listitem:
      - button "Dakal"
    - listitem:
      - button "Draconiros"
    - listitem:
      - button "Kourial"
    - listitem:
      - button "Mikhal"
  - heading "Multi-compte" [level=3]
  - list:
    - listitem:
      - button "Brial"
    - listitem:
      - button "Hell Mina"
    - listitem:
      - button "Imagiro"
    - listitem:
      - button "Orukam"
    - listitem:
      - button "Rafal"
    - listitem:
      - button "Salar"
    - listitem:
      - button "Tal Kasha"
    - listitem:
      - button "Tylezia"
```

# Test source

```ts
  1 | import {test,expect} from '@playwright/test';test('compares a craft',async({page})=>{await page.goto('/');await expect(page.getByText('Craft ou Hôtel des ventes ?')).toBeVisible()});
> 2 | test('switches and persists the selected theme',async({page})=>{await page.addInitScript(()=>{if(!localStorage.getItem('craftcheck-theme'))localStorage.setItem('craftcheck-theme','dark');});await page.goto('/');const toggle=page.getByRole('button',{name:'Activer le thème clair'});await expect(toggle).toBeVisible();await toggle.click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.getByRole('button',{name:'Activer le thème sombre'})).toBeVisible();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');});
    |                                                                                                                                                                                                                                                                                                               ^ Error: expect(locator).toBeVisible() failed
  3 | 
```