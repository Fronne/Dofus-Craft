# Quickstart: vérifier la Forgemagie privée

## Tests automatiques

```bash
npx vitest run tests/unit/fm-reads.test.ts tests/unit/fm-items.test.ts tests/unit/fm-site-sessions.test.ts \
  tests/unit/fm-channels.test.ts tests/integration/forgemagie-page.test.tsx
npx vitest run && npx tsc -b --noEmit && npx tsc -p worker --noEmit && npx eslint src tests
npx playwright test tests/e2e/forgemagie.spec.ts --project=chromium
```

Attendu : tout passe. Les tests couvrent deux joueurs, A et B, chacun avec une séance :

| Scénario | Attendu | Réf. |
|---|---|---|
| A liste les séances | seulement la sienne | FR-001 |
| A ouvre la séance de B | 404, même corps qu'un identifiant inventé | FR-002, SC-003 |
| Séance sans propriétaire | absente de toutes les listes, 404 en détail | FR-003 |
| A rattache la séance de B à son objet | 404 | FR-004 |
| A arrête / renvoie / détache la séance de B | 404 | R2 |
| A ouvre le profil de B, B **public** | 404 | FR-006 |
| A ouvre le récap d'un objet de B | 404 | FR-007 |
| A rattache le salon de B à un objet | 404 | FR-008 |
| Liste des joueurs vue par A | seulement A ; pas de sélecteur dans la page | FR-005 |
| A passe en privé, recharge | réglage conservé ; texte « personne d'autre ne voit… » | FR-009, FR-010 |
| Séance de A : montants et objets | identiques à avant | FR-012 |
| Onglet Runes de l'HDV | inchangé | FR-011 |

## Vérification manuelle (après déploiement)

1. Se connecter avec deux comptes Discord membres du serveur (ou demander à un membre).
2. Chacun ouvre Forgemagie → Sessions : il ne voit que ses séances.
3. La page n'a pas d'adresse par séance : l'accès direct à la séance d'un autre (par l'API) est
   couvert par les tests automatiques ci-dessus.
4. Onglet Profil : plus de sélecteur « Voir le profil de » ; le texte du réglage Visibilité dit que
   personne d'autre ne voit le profil pour l'instant.
