# Research: Dernier prix partagé pour les ressources

## 1. Où calculer le dernier prix d'une ressource

**Decision** : le Worker ajoute `latestAmountKamas` et `latestContributionAt` aux réponses de
`GET /community-price` et `GET /community-prices`, calculés sur les mêmes lignes que la médiane
(`kind = 'resource'`, même serveur, moins de 90 jours). `medianAmountKamas` et `sampleSize` restent
dans la réponse.

**Rationale** :
- Les lignes sont déjà lues pour la médiane : le dernier prix est la ligne au `created_at` le plus
  grand, sans requête supplémentaire.
- Le client a toujours besoin de la médiane pour la confirmation d'un prix aberrant (FR-009, option
  B), sans l'afficher : la garder dans la même réponse évite un second appel.
- Ajouter des champs ne casse pas les clients déjà ouverts sur l'ancienne version : ils continuent
  de lire `medianAmountKamas`. On peut donc déployer le Worker avant le site.

**Alternatives considered** :
- Nouvelle route `/latest-resource-prices` : un appel de plus par page, et deux sources à garder
  cohérentes pour la même ressource.
- Remplacer `medianAmountKamas` par le dernier prix : casse la confirmation (option B) et les
  clients déjà ouverts.
- Réutiliser `/latest-price` (objets) : ne lit que `kind = 'item'` et une seule ressource par appel.

## 2. Quel « dernier prix »

**Decision** : la contribution la plus récente, sans filtre des valeurs aberrantes ni regroupement
par appareil. En cas d'égalité de date, la dernière lue l'emporte (même règle que les objets,
specs/016). La fenêtre de 90 jours reste celle de la médiane (les lignes plus vieilles sont de toute
façon purgées).

**Rationale** : c'est la définition demandée (« le dernier prix relevé »), identique à celle des prix
HDV d'objets. La confirmation à la saisie protège contre les fautes de frappe.

**Alternatives considered** : dernier prix parmi les valeurs non aberrantes — plus robuste, mais ce
n'est plus « le dernier relevé » et le joueur ne comprendrait pas pourquoi son prix n'apparaît pas.

## 3. Remplacer le prix gardé sur l'appareil

**Decision** : règle pure `pickCommunityPrice(carnetEntry, latest)` dans `src/domain/` :
- pas de dernier prix → le prix gardé (ou rien) ;
- pas de prix gardé, ou `carnetEntry.updatedAt < latest.contributedAt` → le dernier prix ;
- sinon → le prix gardé.

Quand le dernier prix l'emporte, il est écrit dans le carnet **avec sa propre date**
(`updatedAt = latestContributionAt`), pas avec l'heure de l'appareil.

**Rationale** : si le carnet prenait l'heure de l'appareil, un prix partagé par quelqu'un d'autre
entre-temps (mais encore masqué par le cache de 60 s) aurait une date plus ancienne que le carnet et
ne le remplacerait jamais. Garder la date du relevé rend la comparaison exacte, et la date affichée
(FR-002) est celle du relevé.

Le prix que le joueur saisit lui-même est gardé avec l'heure de l'appareil, puis partagé ; le
service l'enregistre quelques millisecondes plus tard, donc la lecture suivante le « remplace » par
la même valeur, sans effet visible.

**Alternatives considered** :
- Ne plus rien écrire dans le carnet et toujours afficher le dernier prix : perd le fonctionnement
  hors ligne (FR-010) et l'égalité des calculs entre pages, qui lisent toutes le carnet.
- Comparer les valeurs plutôt que les dates : ne distingue pas un vieux prix d'un prix saisi hors
  ligne plus récent (FR-005).

## 4. Ne pas écraser une saisie en cours (FR-006)

**Decision** : `CommunityResourcePriceRow` reçoit séparément « a un prix gardé » et « est en cours
de saisie » (`input !== undefined`). La synchronisation ne s'applique pas pendant la saisie. Le
garde `prefilled` (une seule fois) est remplacé par la comparaison de dates, qui est idempotente.

## 5. Pages qui calculent sans afficher chaque ligne

**Decision** : `fillCommunityGaps` devient `syncCommunityPrices` : pour chaque ressource, lit le prix
partagé (même file groupée qu'aujourd'hui, `loadCommunityPrice`), applique `pickCommunityPrice` et
écrit le dernier prix quand il l'emporte. Utilisé par Recherche (lignes non affichées), Suivis et
Rentabilité (`useCraftProfits`).

**Rationale** : ces pages ne lisaient le prix partagé que pour les ressources sans prix gardé ; elles
doivent désormais le lire pour toutes, sinon elles gardent un vieux prix (FR-007). Les lectures du
même instant partent déjà groupées par 98 ressources, avec le cache de 60 s du Worker.

**Coût** : Rentabilité lit désormais le prix partagé de toutes les ressources des recettes du
serveur, et pas seulement de celles sans prix. Pour un petit groupe (10 à 20 joueurs) et quelques
centaines à quelques milliers de ressources, cela reste quelques dizaines de requêtes groupées au
préchargement.

## 6. Page XP Familier

**Decision** : `usePetFoodPrices` applique la même règle (`pickCommunityPrice`) pour toutes les
nourritures et écrit le dernier prix dans le carnet quand il l'emporte, comme les autres pages. La
mention « Médiane · » disparaît ; la ligne affiche seulement la date.

**Rationale** : FR-004 et FR-007 demandent la même règle partout. Amende specs/022 (research §4),
où la page ne faisait que consulter.

## 7. Confirmation d'un prix aberrant (FR-009, option B)

**Decision** : le calcul reste celui de specs/007 (écart à la médiane > 25 %). Pour une ressource,
`OutlierConfirmDialog` n'affiche plus la ligne « Prix habituel » : seulement le prix saisi et « Ce
prix semble très différent des relevés du groupe. L'enregistrer quand même ? ». Les objets (avec
`referenceLabel`) gardent leur affichage actuel (dernier prix et écart).

## 8. Cache local du prix partagé

**Decision** : l'entrée localStorage `craftcheck-community-price:*` stocke aussi `latestAmountKamas`
et `latestContributionAt`. Une entrée ancienne sans ces champs est ignorée (traitée comme absente),
jamais convertie depuis la médiane.

## 9. Ordre de déploiement

**Decision** : déployer le Worker (`npm run worker:deploy`) avant le site. Le nouveau site suppose
les nouveaux champs ; l'ancien site ignore les champs ajoutés.
