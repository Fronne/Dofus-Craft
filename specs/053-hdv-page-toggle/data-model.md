# Data Model: Activer ou désactiver la page HDV

## Table `site_settings` (D1) — après la migration 0017

| Colonne      | Type | Règle                                                    |
|--------------|------|----------------------------------------------------------|
| `key`        | TEXT | clé primaire, `CHECK (key IN ('forgemagie_page', 'hdv_page'))` |
| `value`      | TEXT | `CHECK (value IN ('0', '1'))` — `'1'` activée            |
| `updated_at` | TEXT | date ISO du dernier changement                           |

Une ligne par réglage enregistré. Absence de ligne : valeur par défaut du réglage.

## Objet `SiteSettings` (partagé site, administration, Workers)

| Champ            | Type    | Défaut  | Clé D1            |
|------------------|---------|---------|-------------------|
| `forgemagiePage` | boolean | `false` | `forgemagie_page` |
| `hdvPage`        | boolean | `true`  | `hdv_page`        |

- **Lecture tolérante** (`parseSiteSettings`) : objet avec `forgemagiePage` booléen ; `hdvPage`
  absent → `true` ; `hdvPage` présent mais non booléen → invalide.
- **Changement partiel** (`SiteSettingsChange`) : `{ forgemagiePage?: boolean; hdvPage?: boolean }`,
  au moins un champ ; tout champ présent doit être booléen, sinon erreur sur ce champ
  (« Valeur attendue : activée ou désactivée. »).

## Mémoire de l'appareil

`localStorage['craftcheck-site-settings']` : dernier `SiteSettings` lu, relu par `parseSiteSettings`
(un ancien `{ forgemagiePage }` donne `hdvPage: true`).
