# Recherche : Recherche d'objets par stats ciblées

## R1 – D'où viennent les effets de tous les équipements ?
**Décision** : index statique `src/data/brisage-items.json`, généré par `scripts/build-brisage-items.mjs`
(même modèle que `build-rune-items.mjs` : lancé à la main, résumé relu, rien écrit si DofusDB échoue),
contenant par équipement : `id`, `name`, `level`, `imageUrl`, `effects: [{effectId, from, to}]`.
**Raison** : filtrer sur plusieurs stats (ET) et trier exige les effets de tous les objets ; la source ne les
donne qu'objet par objet à l'usage, des milliers d'appels sont inacceptables au clic. Un index suit la
constitution I (source et date tracées) et le schéma déjà utilisé pour `rune-items.json`.
**Alternatives** : requêtes DofusDB filtrées par effet à la volée (pas de ET fiable, lent, dépend de la
source en direct) ; Worker/D1 (backend, hors périmètre, constitution IV).
**À vérifier à l'exécution** : nombre d'équipements et poids du JSON (cible < 2 Mo, import dynamique).
Le test réseau n'a pas pu être fait pendant cette session ; le script affiche un résumé à relire.

## R2 – Quels objets inclure ?
**Décision** : équipements (armes comprises) selon les mêmes super-types que `getDofusDbItemKind` → `Equipment`,
**sans** exiger `hasRecipe` (un objet sans recette se brise aussi ; la recherche par nom actuelle filtre sur `hasRecipe`).
**Raison** : « quels objets briser » inclut les objets droppés ou achetés.
**Alternative** : même périmètre que la recherche par nom — écarte des objets brisables utiles.

## R3 – Quelles lignes d'effet compter ?
**Décision** : mêmes règles que `getItemEffectRanges` (jet positif, `category !== 2`, `to: 0` = valeur fixe),
puis ne garder que les `effectId` présents dans `BRISAGE_STATS`, hors 696969.
**Raison** : cohérence exacte avec la page de l'objet ; l'estimation de la liste = celle de la page.
La règle est extraite en une fonction partagée (script et `getItemEffectRanges`) pour éviter la dérive.

## R4 – Estimation « à 100 % »
**Décision** : par stat choisie, `runesForLine(lineWeight(averageRoll(from,to), poids, niveau, settings), 1, poidsRune)`
en brisage normal, arrondi `wholeRunes` comme la page ; somme pour le tri multi-stats ; réglages = ceux déjà
chargés par la page.
**Raison** : même formule, aucun nouveau modèle (constitution IV).

## R5 – Tri par valeur en kamas
**Décision** : runes estimées × prix de la rune du serveur actif (`useRunePrices`) ; un prix manquant sur
une stat choisie rend la valeur inconnue → objet classé en dernier, affiché « — ».
**Raison** : constitution III (jamais 0).

## R6 – Affichage de longues listes
**Décision** : tri/filtre en mémoire (quelques milliers de lignes), affichage par pages de 50 avec
« Afficher plus » ; compteur total.
**Alternative** : virtualisation (dépendance en plus, non justifiée).

## R7 – Où vit la fonctionnalité ?
**Décision** : un mode de `BrisagePage`, pas une nouvelle route ; le clic appelle `pick` (déjà utilisé par
la recherche par nom), donc session, coefficient et prix fonctionnent sans changement.
