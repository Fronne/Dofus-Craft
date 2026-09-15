# Data Model: Modes personnel et communautaire de gestion des prix

## PriceModePreference (nouvelle entité)

Préférence individuelle mémorisée pour le joueur sur son navigateur/appareil, indépendante du
serveur actif (002-server-scoped-prices), du thème et de la couleur d'accent.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `mode` | `'personal'` \| `'community'`, jamais une autre valeur | Détermine le texte affiché dans les paramètres et si le bandeau « à venir » (FR-011) est affiché. |

**Transitions**:

1. Valeur absente ou invalide en stockage (première visite, stockage vidé/indisponible) → résolue
   par défaut à `'personal'`, sans jamais bloquer l'accès au reste de l'application (contrairement
   à `ActiveServerPreference` en 002, qui bloque tant qu'aucun choix n'est fait) : le mode personnel
   est un état pleinement fonctionnel par défaut (FR-001, Assumptions).
2. `'personal'` → `'community'` par action explicite du joueur dans les paramètres (FR-004) ;
   cette transition seule ne modifie, ne lit ni ne transmet aucun prix personnel (FR-007, FR-010).
3. `'community'` → `'personal'` par action explicite du joueur, à tout moment, sans condition ni
   confirmation (FR-013) ; cette transition restitue l'usage exclusif des prix personnels déjà en
   vigueur (FR-008, FR-009).
4. La valeur est relue à l'identique après un rechargement complet de la page (cohérence avec le
   pattern déjà établi pour le thème, l'accent et le serveur actif).

**Invariants** (garantis par construction, pas par une règle de fusion) :

- Aucune transition de `PriceModePreference` ne lit, n'écrit, ne supprime ni ne modifie une entrée
  de `ResourcePrice` ou `PinnedItemPrice` (voir rappel ci-dessous) : les deux entités n'ont, dans
  cette itération, aucune dépendance de données l'une envers l'autre, seulement une dépendance
  d'affichage (le mode détermine ce qui est montré autour des prix, jamais les prix eux-mêmes).

## PriceModeNotice (état d'affichage, non persisté)

État dérivé, recalculé à chaque rendu, jamais stocké : `visible = (mode === 'community')`.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `visible` | booléen dérivé de `PriceModePreference.mode` | Affiche le bandeau « consultation et contribution communautaires à venir » (FR-011) tant que le mode communautaire est sélectionné. |

**Comportement** : contrairement à `PinnedPriceMigrationNotice` (002), ce bandeau n'est pas
fermable de façon permanente : il reflète un état durable du mode actif plutôt qu'un événement
ponctuel de migration, et doit donc réapparaître tant que `mode === 'community'`, y compris après
une fermeture manuelle et un nouveau rendu (ex. changement de recette consultée).

## Rappel — Prix personnel (001/002, schéma inchangé)

Cette fonctionnalité ne modifie ni le schéma, ni le dépôt, ni la clé de stockage de
`ResourcePrice` et `PinnedItemPrice` tels que définis dans
[001-craft-profit-comparison](../001-craft-profit-comparison/data-model.md) et
[002-server-scoped-prices](../002-server-scoped-prices/data-model.md). C'est une garantie
structurelle de FR-006/FR-007/FR-008 : en ne touchant pas à ces entités, aucun changement de mode
ne peut techniquement les altérer.

## Relationships

```text
PriceModePreference (préférence locale, indépendante du serveur actif)
   └── détermine ──> PriceModeNotice.visible (affichage uniquement)

ResourcePrice / PinnedItemPrice (001/002, scoped par serveur)
   aucune relation de données avec PriceModePreference dans cette itération
   (dépendance d'affichage uniquement : les deux modes lisent la même source)
```
