# Research: Barre de progression glissable du familier

## 1. Échelle de la barre

- **Decision**: garder la barre proportionnelle à l'XP et convertir la position du pointeur en XP,
  puis en niveau avec `levelForTotalXp`.
- **Rationale**: la barre et son pourcentage (spec 055) sont déjà proportionnels à l'XP ; une échelle
  par niveau ferait mentir le pourcentage affiché. Le repère reste sous le pointeur.
- **Alternatives**: échelle linéaire par niveau (rejetée : le remplissage ne correspondrait plus au
  pourcentage) ; barre déformée (rejetée : hors périmètre).
- **Limite connue**: les premiers niveaux sont serrés (le niveau 85 est à 26,2 %). Atténuée par la
  bulle « Niveau N », les flèches (±1 niveau), Début/Fin et les champs de saisie.

## 2. Gestes souris, tactile et clavier

- **Decision**: événements pointeur (`pointerdown/move/up`) avec capture du pointeur, un seul code
  pour souris et doigt ; `touch-action: none` sur la piste ; `role="slider"` focusable avec
  flèches, Début et Fin.
- **Rationale**: aucune dépendance, comportement identique partout.
- **Alternatives**: `<input type="range">` natif (rejeté : l'échelle XP et la bulle exigent un style
  que le natif ne permet pas, et la valeur est un niveau, pas une position).

## 3. Alignement de l'XP

- **Decision**: réutiliser `withField(text, 'currentLevel', niveau)` : il met déjà l'XP totale au début
  exact du niveau (`PET_XP_CURVE[niveau]`), comme la saisie dans « Niveau actuel ».
- **Rationale**: une seule règle de liaison niveau ↔ XP, déjà testée.
