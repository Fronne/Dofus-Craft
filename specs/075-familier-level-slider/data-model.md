# Data Model: Barre de progression glissable du familier

Aucune donnée nouvelle, aucun stockage nouveau.

| Élément | Source | Règle |
|---------|--------|-------|
| Niveau actuel | `levelForTotalXp(totalXp).level` | de `PET_MIN_LEVEL` (0) à `PET_MAX_LEVEL` (100) |
| XP totale | `PET_XP_CURVE[niveau]` après un choix sur la barre | début exact du niveau, XP en plus remplacée |
| Niveau visé | saisie existante | inchangé par la barre |
| Position de la barre | `petXpProgress(totalXp).percent` | proportionnelle à l'XP, 0..100 % |

Nouvelle fonction pure : `levelAtProgress(fraction)` → niveau entier dont le début d'XP est ≤
`fraction × maxTotalXp()`, borné à 0..`PET_MAX_LEVEL` (fraction hors 0..1 ramenée aux bornes).
