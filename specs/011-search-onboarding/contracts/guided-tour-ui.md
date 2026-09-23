# Contrat UI : visite guidée de la page Recherche

## Composant `GuidedTour`

Entrées :

- `steps` : liste ordonnée de `TourStep` (voir [data-model.md](../data-model.md)).
- `onClose(reason)` : appelé avec `'finished'` (dernière étape), `'skipped'` (« Passer ») ou
  `'escaped'` (Échap). Le parent marque la visite comme vue dans les trois cas.

Le composant n'est monté que pendant la visite (chaque ouverture repart de l'étape 1). Rendu :

- Un `<dialog>` modal, `aria-labelledby` pointant vers le titre de l'étape.
- Si la cible de l'étape existe dans la page : une découpe sur sa zone, le reste assombri, la bulle
  à côté. Sinon : pas de découpe, fond assombri, bulle centrée avec `absentHint` si défini.
- Dans la bulle : position « n / 6 », titre, texte, boutons « Passer », « Précédent » (masqué à
  l'étape 1), « Suivant » (libellé « Terminer » à la dernière étape).
- Le focus est placé sur « Suivant » / « Terminer » à chaque changement d'étape.

Garanties :

- Aucune interaction avec la page n'est possible pendant la visite (FR-009).
- Aucun appel réseau, aucune écriture hors de la clé `craftcheck-search-tour-seen` (FR-010).

## Attributs `data-tour` ajoutés à la page Recherche

| Valeur            | Élément |
|-------------------|---------|
| `search`          | Zone recherche + filtres (`ItemSearch`) |
| `item-detail`     | Carte de l'objet sélectionné (`ItemDetail`) |
| `resource-prices` | Carte « Prix des ressources » |
| `market-price`    | Champ « Prix HDV » (`MarketPriceInput`) |
| `recommendation`  | Bloc recommandation + coût de craft |

## Bouton d'aide

- Sur la page Recherche, toujours visible, icône `info`, `aria-label="Comment fonctionne cette page ?"`.
- Ouvre la visite à l'étape 1, que la visite ait déjà été vue ou non (FR-007).
