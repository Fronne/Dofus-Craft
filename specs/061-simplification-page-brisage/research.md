# Research — Simplification de la page Brisage

## Coût de l'objet
- **Décision** : lire le prix épinglé de l'objet (`pinnedItemPrices.get(serverId, item.id)`, valeur `marketPriceKamas`), saisi sur la page Recherche ; saisie manuelle du coût seulement s'il manque.
- **Pourquoi** : c'est le « coût d'objet déjà enregistré » dont parle le porteur ; une seule source.
- **Écarté** : prix communautaire d'objet (n'existe pas pour les équipements dans l'API actuelle).

## Jet moyen
- **Décision** : `floor((from + to) / 2)` ; `from === to` → la valeur. `getItemEffectLines` ne renvoie que le maximum : ajouter `getItemEffectRanges` (même filtrage, garde `from` et `to`).
- **Vérifié** : 1–50 → 25, 5–10 → 7 (exemples du porteur).
- **Écarté** : ajuster `getItemEffectLines` (utilisé ailleurs, risque de régression).

## Mémoire du coefficient
- **Décision** : `localStorage`, clé `craftcheck-brisage-coefficients`, objet JSON `{ "<serveur>:<objet>": { coefficient, savedAt } }`, try/catch, entrées invalides ignorées.
- **Pourquoi** : même mécanisme que les réglages actuels ; pas de Worker ni de migration D1 (hors périmètre : pas de partage entre joueurs).
- **Écarté** : table communautaire D1 (coût de déploiement et de modération non demandés).

## Réglages avancés
- **Décision** : retirer l'UI et la persistance (`brisage-settings.ts`) ; la page utilise `defaultBrisageSettings()`.
- **Pourquoi** : demande de simplicité ; les valeurs par défaut sont les hypothèses H2–H4 déjà validées.

## Verdict
- **Décision** : « Rentable » si le gain de la meilleure option est ≥ 0, sinon « Pas rentable ». Nombre de brisages et coefficient minimal : brisage normal (déjà calculés par `analyzeBrisage`).
