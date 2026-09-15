import {test,expect} from '@playwright/test';test('compares a craft',async({page})=>{await page.goto('/');await expect(page.getByText('Craft ou Hôtel des ventes ?')).toBeVisible()});
