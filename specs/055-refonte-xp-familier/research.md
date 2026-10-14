# Research: Refonte de la page XP Familier

## 1. Classement commun au podium, au tableau et à la fiche

- **Decision**: un seul classement, `rankPetFoods`, calculé sur toutes les ressources avec prix :
  `planPetFood` (tri par coût total croissant, sans limite, Almanax compris) puis
  `capPetFoodQuantity` (plafond « Quantité max »). Le rang d'une ressource = sa position + 1 dans ce
  classement. Le podium en prend les 3 premiers ; le tableau et la fiche y lisent le rang.
- **Rationale**: un seul calcul garantit des rangs identiques partout et réutilise les règles 022
  sans les dupliquer (SC-002). Le filtre par nom et le tri du tableau ne touchent pas ce classement
  (spec FR-004, FR-009).
- **Alternatives considered**: calculer le podium depuis la liste filtrée du tableau (rejeté : le
  podium changerait en tapant dans le filtre, contraire à la spec) ; rang recalculé après tri
  (rejeté : le rang doit rester celui du coût total).

## 2. Tableau : pipeline existant + retrait du podium

- **Decision**: garder le pipeline actuel du tableau (filtre par nom → `planPetFood` avec le tri
  choisi → plafond → affichage par 25), puis retirer les lignes dont l'`itemId` est sur le podium et
  ajouter le rang lu dans le classement global.
- **Rationale**: messages actuels conservés tels quels (aucune ressource avec prix ne correspond,
  N ressources masquées, toutes au-dessus du plafond) ; changement minimal.
- **Alternatives considered**: reconstruire le tableau depuis le classement global (rejeté : il
  faudrait réécrire les compteurs du filtre et du plafond).

## 3. Liste de suggestions du bloc 3

- **Decision**: un champ `type="search"` et, à partir de 2 caractères, au plus 8 suggestions en
  boutons (`<button>` avec image et nom), dans l'ordre alphabétique, recherche insensible aux
  accents et à la casse via `normalizeSearchText`. Un clic ou Entrée sur un bouton choisit la
  ressource, vide la liste et remplace le texte du champ par le nom choisi.
- **Rationale**: utilisable au clavier (Tab + Entrée) sans composant combobox à écrire et tester ;
  même principe que la grille de résultats de la page Recherche (constitution IV).
- **Alternatives considered**: combobox ARIA complet avec flèches (rejeté pour l'instant : nouvelle
  abstraction non demandée) ; `<datalist>` (rejeté : pas d'image, rendu inégal selon les
  navigateurs, pas de choix sûr d'un `itemId`).

## 4. Part de l'objectif par unité

- **Decision**: `share = xpPerUnit (Almanax compris) ÷ XP à donner × 100`, affichée avec 2 chiffres
  significatifs (`Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 2 })`) : 0,019 %. Au-delà
  de 100 % (une unité suffit), afficher « 100 % ».
- **Rationale**: lisible sur des valeurs très petites (0,0036 %) comme grandes.
- **Alternatives considered**: nombre fixe de décimales (rejeté : 0,00 % pour les petites valeurs).

## 5. Barre de progression

- **Decision**: `percent = XP totale ÷ XP du niveau 100 × 100`, une décimale ; élément
  `role="progressbar"` avec `aria-valuenow` (arrondi), `aria-valuetext` (« 26,2 %, niveau 85 ») ;
  repère en losange (motif du site) positionné à ce pourcentage, borné visuellement aux extrémités.
- **Rationale**: correspond à la maquette ; accessible.
- **Alternatives considered**: progression vers le niveau visé (rejeté : la spec demande vers le
  niveau 100).

## 6. Écarts

- **Decision**: podium : écart en kamas = coût total − coût total de la 1re, affiché « +N k » avec le
  composant `Kamas` existant ; fiche : écart en % = (coût − coût de la 1re) ÷ coût de la 1re × 100,
  une décimale, « 0 % » pour la 1re.
- **Rationale**: spec FR-005, FR-007.
