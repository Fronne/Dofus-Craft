# Research: Captures d'une séance FM et rattachement d'objet par son nom

## R1 — Où lire les captures d'une séance

- **Decision**: dans `fm_captures` (une ligne par capture, `origin` = `bot` ou `capture`) et
  `fm_purchase_lines` (ses lignes), déjà écrites par le bot (`bot-events.ts`) et par l'import du site
  (`imports.ts`). Le détail de séance ajoute une lecture des captures (ordre `created_at, id`) et une
  lecture des lignes groupées par `capture_id, item_name`.
- **Rationale**: aucune donnée nouvelle n'est nécessaire ; un `/fmreset` supprime déjà captures et
  lignes, donc le détail reste cohérent (edge case de la spec).
- **Alternatives considered**: une route séparée `GET /fm/sessions/:id/captures` — écartée : une
  requête de plus pour un détail qui en a déjà besoin, et deux règles d'accès à tenir alignées.

## R2 — Récap d'une capture

- **Decision**: même regroupement que le récap global (`GROUP BY item_name`, somme des quantités et
  totaux, `itemSummaries` pour le prix moyen arrondi), trié par total décroissant puis nom.
- **Rationale**: FR-003/FR-004 — la somme des récaps des captures redonne le tableau « Achats ».
- **Alternatives considered**: afficher les lignes brutes (un lot par ligne) — écartée : la demande
  est un « récap des runes » ; deux lots d'une même rune doivent se lire comme une ligne.

## R3 — Auteur d'une capture

- **Decision**: `playerView` sur le joueur de la capture, comme « Dépense par joueur ».
- **Rationale**: un joueur privé reste masqué pour les autres (specs/025 FR-014).

## R4 — Créer l'objet et rattacher la séance en une action

- **Decision**: `PUT /fm/sessions/:id/item` accepte `{ item: { itemId, itemName, imageUrl } }` à la
  place de `{ fmItemId }`. Après les mêmes vérifications que le rattachement actuel (séance du
  joueur, pas déjà rattachée, pas de salon rattaché), le Worker exécute un lot D1 : insertion de
  l'objet, rattachement conditionnel (`WHERE fm_item_id IS NULL`), puis suppression de l'objet s'il
  n'est rattaché à aucune séance. Il relit la séance : si elle n'est pas rattachée au nouvel objet,
  il répond `409 already-attached`.
- **Rationale**: un lot D1 est exécuté dans une transaction ; FR-012 (pas d'objet orphelin) est
  garanti même en cas de clics simultanés, sans verrou.
- **Alternatives considered**: deux appels depuis le site (`POST /fm/items` puis `PUT …/item`) —
  écartée : un échec du second laisse un objet sans séance.

## R5 — Recherche dans le détail de séance

- **Decision**: un composant `SessionItemSearch` : à partir de 2 caractères, il filtre localement les
  objets en FM du joueur (nom affiché ou nom d'équipement contenant le texte, sans majuscules ni
  accents) et lance la recherche du catalogue d'`EquipmentPicker` (anti-rebond 300 ms, équipements
  seulement, 10 résultats), extraite dans un hook `useEquipmentSearch`.
- **Rationale**: même comportement que la création d'objet (specs/027) ; les objets du joueur sont
  déjà chargés par le détail (`getFmPlayer`).
- **Alternatives considered**: garder la liste déroulante à côté du champ — écartée : deux manières
  de faire la même chose ; le champ couvre les deux cas.
