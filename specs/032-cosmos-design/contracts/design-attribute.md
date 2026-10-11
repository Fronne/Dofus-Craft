# Contrat UI : attribut de design

| Préférence | `<html data-design>` | Feuille active |
|------------|----------------------|----------------|
| `classic`  | absent               | aucune (global.css seul) |
| `modern`   | `modern`             | `src/styles/design-modern.css` |
| `cosmos`   | `cosmos`             | `src/styles/design-cosmos.css` |

- Toute règle de `design-cosmos.css` est limitée à `:root[data-design="cosmos"]` (vérifié par
  `tests/unit/design-cosmos-css-scope.test.ts`).
- Cosmos combine librement `data-theme` (`light`/absent) et `data-accent` (couleurs existantes).
- Cosmos ne redéfinit jamais `--slot-bg`, `--slot-border`, `--slot-glyph` ni `--image-bg`.
