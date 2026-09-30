# Quickstart: Captures d'une séance FM et rattachement d'objet par son nom

## Vérifications automatiques

```bash
npm test -- fm-reads fm-items forgemagie
npm run typecheck && npm run lint
npx playwright test tests/e2e/forgemagie.spec.ts
```

## Scénarios attendus

1. **Captures (US1)** — une séance avec deux captures (bot : `10 x [Rune Do Air] (15 868 kamas)` ;
   site : `5 x [Rune Pa Ga] (40 000 kamas)`) : le détail affiche « Captures (2) », chacune avec sa
   date, son auteur, « Discord » ou « Site », son montant et sa ligne ; les montants font le total de
   la séance. Voir [contracts/fm-session-captures-api.md](contracts/fm-session-captures-api.md).
2. **Repli** — une séance de 6 captures ou plus les affiche repliées ; un clic en déplie une.
3. **Rattacher un objet existant (US2)** — taper « rtog » : « Rtograf PA » est proposé avant
   « Anneau Rtograf » (catalogue) ; le choisir rattache la séance.
4. **Rattacher un nouvel équipement** — sans objet en FM, taper « Coiffe Bouftou » et choisir
   l'équipement : la séance indique « Objet : Coiffe Bouftou », et le profil liste l'objet avec
   1 séance.
5. **Conflit** — rattacher une séance déjà rattachée entre-temps : message d'erreur, et aucun nouvel
   objet sur le profil.

## Déploiement

Pas de migration. Déployer le Worker (`npm run worker:deploy`) avant ou avec le site : le site tolère
un Worker sans `captures`, mais la création depuis la séance exige le nouveau Worker.
