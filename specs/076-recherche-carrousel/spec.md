# Spec 076 — Recherche : résultats en carrousel horizontal

## Besoin
Sur la page Recherche, les résultats s'affichent comme sur la page Brisage : une rangée de cartes qui
défile horizontalement (carrousel `ItemCarousel`, specs/065).

## Exigences
- **FR-001** Chaque carte montre l'image, le nom et le niveau de l'objet, rien d'autre.
- **FR-002** Flèches, molette, glisser à la souris et flèches du clavier font défiler, comme sur Brisage.
- **FR-003** Près de la fin de la rangée, les 12 résultats suivants (`RESULTS_MORE_STEP`) sont chargés
  automatiquement tant qu'il en reste ; la limite reste dans l'URL (`limit`).
- **FR-004** Les boutons « Afficher 12 de plus », « N sur total » et « Réduire » disparaissent ; le compteur
  « N objets trouvés » et l'indicateur de synchronisation restent.
- **FR-005** Cliquer une carte sélectionne l'objet (comportement inchangé).

## Fait
- `src/features/catalogue/ItemResults.tsx` utilise `ItemCarousel` ; styles `.brisage-*` réutilisés.
- `tests/unit/item-results.test.tsx` mis à jour.
