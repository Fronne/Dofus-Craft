# Data Model: Design « Cosmos »

## Préférence de design (existante, étendue)

- **Valeurs**: `classic` (« Classique »), `modern` (« Nouveau »), `cosmos` (« Cosmos »).
- **Stockage**: localStorage `craftcheck-design-choice` sur l'appareil ; jamais envoyée au serveur.
- **Défaut**: `modern` quand rien n'est mémorisé, que la valeur est inconnue ou que le stockage est
  indisponible.
- **Transitions**: n'importe quelle valeur vers n'importe quelle autre, par un clic dans
  Paramètres ; effet immédiat (attribut `data-design` sur `<html>`).
