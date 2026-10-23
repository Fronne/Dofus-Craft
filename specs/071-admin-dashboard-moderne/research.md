# Recherche : Tableau de bord d'administration moderne et activation de toutes les pages

Aucun « NEEDS CLARIFICATION » dans le contexte technique.

## R1 — Généraliser le réglage des pages

**Décision** : `SiteSettings` garde `forgemagiePage` et `hdvPage` et gagne `searchPage`, `pinnedPage`,
`pricesPage`, `petsPage`, `brisagePage`. Une liste `SITE_PAGES` (champ, clé D1, libellé, adresse, défaut) est
l'unique source ; types, validation, lecture, écriture, éditeur et navigation en dérivent.

**Défauts** : Forgemagie désactivée, les six autres activées (`DEFAULT_SITE_SETTINGS`). Un réglage jamais
enregistré prend son défaut, comme aujourd'hui.

**Compatibilité** : `parseSiteSettings` exige toujours `forgemagiePage` booléen (comportement actuel) ; tout
champ absent prend son défaut, tout champ présent non booléen invalide la réponse. Ainsi un cache local
d'avant cette fonctionnalité, ou une API plus ancienne, ne désactive aucune page.

**Alternatives écartées** : une liste de pages désactivées (`disabledPages: string[]`) : change le format
public et casse le cache local ; un champ JSON unique en base : perd la contrainte par clé.

## R2 — Contrainte `CHECK` de `site_settings`

`site_settings.key` est limité par `CHECK (key IN ('forgemagie_page', 'hdv_page'))`. SQLite ne modifie pas une
contrainte : la migration `0023` reconstruit la table (copie, suppression, renommage) avec la liste élargie aux
cinq nouvelles clés, en copiant les deux états déjà enregistrés, exactement comme `0017`. Elle est rejouable
(`DROP TABLE IF EXISTS` de la copie) et reportée dans `schema.sql`. Elle s'applique à la production **avant** le
déploiement des Workers : sinon l'écriture d'une nouvelle clé serait refusée par la contrainte.

## R3 — Pages indisponibles sur le site public

Les deux pages indisponibles actuelles (`ForgemagieUnavailablePage`, `HdvUnavailablePage`) sont identiques à
l'icône et au texte près : elles deviennent un seul composant `PageUnavailable` (titre, icône, message).
Chaque route d'une page désactivable passe par le même garde : activée → page ; lecture en cours → « Chargement… »
(pour ne pas dire « indisponible » d'une page qui est activée) ; désactivée → `PageUnavailable`.

**Entrée du site** : l'adresse d'accueil, le logo et le bouton de repli pointent vers la première page encore
active dans l'ordre de la navigation (`firstEnabledPage`) ; si aucune ne l'est, un message « Aucune page n'est
disponible » s'affiche (la page Paramètres reste accessible, elle n'est pas désactivable).

**Anciennes adresses** (`legacyPinned`, `legacyPrices`) : elles redirigent vers la page actuelle, qui applique
alors son propre garde.

## R3bis — Dernière page active

Désactiver la dernière page active demande une confirmation dans l'éditeur (un second clic explicite sur
« Confirmer la désactivation »), sans fenêtre du navigateur (inaccessible à tester et à lire). Le serveur
n'interdit rien : le propriétaire a le dernier mot.

## R4 — Habillage « Vision UI »

**Décision** : CSS seul, sur les variables existantes de `admin.css` / `theme.css` : fond à dégradés
bleu-vert, cartes à grand rayon avec bordure fine et lueur (`box-shadow` colorée), rangée de chiffres clés en
tête, deux colonnes de grandes cartes de graphiques à partir de 1100 px, une colonne en dessous. Le thème clair
reçoit un habillage plus doux (mêmes formes, lueur atténuée). Pas de bibliothèque.

**Accessibilité** : la lueur et les dégradés sont décoratifs ; les états restent en texte (FR-012) ; le contraste
des textes sur fond dégradé est contrôlé en thème sombre et clair.

## R5 — Chiffres clés

Quatre cartes, toutes tirées de lectures déjà faites par le tableau de bord (aucune route nouvelle) :

| Chiffre | Source | Lien |
|---|---|---|
| Pages actives (x sur 7) | réglage des pages | `#pages` |
| Lignes ce mois-ci | total de `getKeyContributions` | `#cles` |
| Visiteurs aujourd'hui | `getActivity().visitorsToday` | aucun (pas de section) |
| Limite du jour | pire niveau Cloudflare (`getUsage`) | `#cloudflare` |

Chaque chiffre est `Indisponible` si sa lecture échoue. Les chiffres clés sont des liens ; pour ne pas
dupliquer les noms accessibles des cartes de section, leurs titres sont distincts (« Pages actives »,
« Lignes ce mois-ci », « Visiteurs du jour », « Limite du jour »).
