# Data Model: Activer ou désactiver la page Forgemagie

## Table `site_settings` (D1, nouvelle)

| Colonne | Type | Règle |
| --- | --- | --- |
| `key` | TEXT, clé primaire | seule valeur admise : `forgemagie_page` |
| `value` | TEXT, non nul | `'1'` (activée) ou `'0'` (désactivée) |
| `updated_at` | TEXT, non nul | date ISO du dernier changement |

- Aucune ligne ⇒ page désactivée (FR-002).
- Lue par le Worker public ; écrite seulement par le Worker d'administration.

## Type partagé `SiteSettings` (`src/domain/site-settings.ts`)

```text
SiteSettings = { forgemagiePage: boolean }
DEFAULT_SITE_SETTINGS = { forgemagiePage: false }
```

- `isSiteSettings(value)` : garde de type des réponses.
- `validateSiteSettingsInput(input)` : `forgemagiePage` doit être un booléen, sinon erreur sur le
  champ `forgemagiePage`.

## Dernier état connu sur l'appareil

- Clé `localStorage` `craftcheck-site-settings`, contenu : le `SiteSettings` de la dernière lecture
  réussie. Illisible ou absent ⇒ `DEFAULT_SITE_SETTINGS`.

## Transitions

`désactivée` ⇄ `activée`, sur action du propriétaire uniquement. Aucune donnée Forgemagie n'est
touchée par une transition (FR-010).
