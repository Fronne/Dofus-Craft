# Quickstart : valider la page Prix

## Automatique

```bash
npm run typecheck
npx vitest run tests/unit/item-prices* tests/unit/craft-profit.test.ts tests/integration/prices-page.test.tsx
npm run test:e2e -- prices-page
```

## Manuel

1. Déployer ou lancer le Worker (`npm run worker:dev`) puis le site en dev.
2. Mode communautaire, Mikhal, ouvrir « Prix » : les objets avec prix HDV partagé et ressources
   connues apparaissent, triés par bénéfice.
3. Ouvrir un objet de la liste : la page Recherche, en « Auto », affiche le même coût de craft et le
   même écart.
4. Trier par « Marge (%) », filtrer « amul », changer la limite.
5. Passer en Mode personnel : la liste reflète le carnet local et les prix HDV saisis.
