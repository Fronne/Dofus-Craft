# Modèle de données : Onboarding de la page Recherche

Aucune donnée serveur. Deux éléments côté client.

## Étape de visite (`TourStep`)

Données statiques, définies dans le code.

| Champ    | Type               | Règle |
|----------|--------------------|-------|
| `id`     | string             | Unique dans la visite. |
| `target` | string \| absent   | Valeur de l'attribut `data-tour` de la zone à mettre en surbrillance. Absent = bulle centrée. |
| `title`  | string             | Titre court, en français. |
| `body`   | string             | Une seule phrase courte (FR-004), libellés identiques à la page (FR-012). |
| `points` | liste de `{ term, text }` \| absent | Au plus trois puces : `term` = libellé de la page, `text` = explication de quelques mots (FR-004). |
| `absentHint` | string \| absent | Phrase ajoutée quand la cible n'est pas affichée (FR-008), ex. « Cette zone apparaît après avoir choisi un objet. » |

Séquence (FR-003) :

| # | `id`            | `target`          | Zone de la page |
|---|-----------------|-------------------|-----------------|
| 1 | `search`          | `search`          | Formulaire de recherche et filtres |
| 2 | `market-price`    | `market-price`    | Champ « Prix HDV » |
| 3 | `recommendation`  | `recommendation`  | Recommandation et coût de craft |
| 4 | `recipe`          | `item-detail`     | Fiche de l'objet et sa recette |
| 5 | `resource-prices` | `resource-prices` | Carte « Prix des ressources » |
| 6 | `price-mode`    | —                 | Bulle centrée, mode actif + renvoi vers Paramètres |

## État « visite vue »

| Clé `localStorage`             | Valeur | Écrite quand |
|--------------------------------|--------|--------------|
| `craftcheck-search-tour-seen`  | `"1"`  | « Terminer », « Passer » ou Échap |

Absente ou illisible = pas vue.

## Transitions de la visite

```text
fermée ──(montage, pas vue)──────────────▶ étape 1
fermée ──(bouton d'aide)─────────────────▶ étape 1
étape n ──(Suivant, n < 6)───────────────▶ étape n+1
étape n ──(Précédent, n > 1)─────────────▶ étape n-1
étape 6 ──(Terminer)─────────────────────▶ fermée + vue
étape n ──(Passer / Échap)───────────────▶ fermée + vue
étape n ──(départ de la page Recherche)──▶ fermée (non marquée vue)
```
