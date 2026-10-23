# Modèle de données : Tableau de bord d'administration moderne et activation de toutes les pages

## Pages du site (`src/domain/site-settings.ts`)

`SITE_PAGES`, dans l'ordre de la navigation :

| Champ | Clé D1 | Libellé | Adresse | Défaut |
|---|---|---|---|---|
| `searchPage` | `search_page` | Recherche | `ROUTES.search` | activée |
| `pinnedPage` | `pinned_page` | Suivis | `ROUTES.pinned` | activée |
| `pricesPage` | `prices_page` | Rentabilité | `ROUTES.prices` | activée |
| `hdvPage` | `hdv_page` | HDV | `ROUTES.hdv` | activée |
| `petsPage` | `pets_page` | XP Familier | `ROUTES.pets` | activée |
| `forgemagiePage` | `forgemagie_page` | Forgemagie | `ROUTES.forgemagie` | **désactivée** |
| `brisagePage` | `brisage_page` | Brisage | `ROUTES.brisage` | activée |

- `SiteSettings` : `Record<champ, boolean>` sur ces sept champs. `SiteSettingsChange` : `Partial<SiteSettings>`.
- `DEFAULT_SITE_SETTINGS` : les défauts du tableau.
- `parseSiteSettings(valeur)` : objet requis ; `forgemagiePage` booléen requis (compatibilité) ; champ absent →
  défaut ; champ présent non booléen → `undefined`.
- `validateSiteSettingsChange(entrée)` : chaque champ présent doit être booléen (« Valeur attendue : activée ou
  désactivée. ») ; au moins un champ ; un champ inconnu est ignoré.
- `enabledPageCount(settings)` : nombre de pages activées (0 à 7).
- `firstEnabledPage(settings)` : première entrée de `SITE_PAGES` activée, ou `undefined`.
- `isLastEnabledPage(settings, champ)` : vrai si `champ` est activée et la seule.

## Stockage (`site_settings`, migration `0023_widen_site_settings_keys.sql`)

| Colonne | Contrainte |
|---|---|
| `key` | clé primaire, `CHECK (key IN ('forgemagie_page', 'hdv_page', 'search_page', 'pinned_page', 'prices_page', 'pets_page', 'brisage_page'))` |
| `value` | `CHECK (value IN ('0', '1'))` |
| `updated_at` | texte, non nul |

Un état jamais enregistré n'a pas de ligne : le défaut s'applique. Les deux lignes existantes sont copiées.

## Chiffres clés (`admin/KeyFigures.tsx`)

`KeyFigure` : `{ id, title, value, tone, target? }` ; `tone` ∈ normal / avertissement / dépassé /
indisponible ; `target` : ancre de section ou absence de lien. Aucune donnée stockée.
