# Modèle de données : nouveau design au choix

## Préférence de design

| Élément | Valeur |
|---------|--------|
| Clé `localStorage` | `craftcheck-design` |
| Valeurs | `classic` (« Classique »), `modern` (« Nouveau ») |
| Défaut | `classic` : clé absente, valeur inconnue ou stockage indisponible (FR-004) |
| Portée | appareil ; jamais envoyée au serveur (FR-012) |

Traduction dans la page : `modern` pose `data-design="modern"` sur `<html>` ; `classic` retire
l'attribut.

Liste des designs (`src/domain/designs.ts`), sur le modèle de `accent-colors.ts` :
`[{ id: 'classic', label: 'Classique' }, { id: 'modern', label: 'Nouveau' }]`.
