# Quickstart: validation de la barre glissable

1. Lancer le site en local, ouvrir la page « XP Familier » avec un niveau visé de 100.
2. Souris : faire glisser le repère jusqu'à la bulle « Niveau 85 ». Attendu : « Niveau actuel » 85,
   « XP totale » 47 003, « XP à donner » 132 589, barre à 26,2 %.
3. Clavier : donner le focus à la barre, flèche droite : niveau 86 ; Début : niveau 0 ; Fin : niveau
   100.
4. Champs : taper 70 dans « Niveau actuel » : le repère se place au niveau 70.
5. Niveau visé : régler 60, glisser au-delà : le niveau visé reste 60, « Aucune XP à donner ».
6. Tactile (mode mobile du navigateur) : glisser du doigt ; la page ne défile pas.
7. Tests : `npx vitest run tests/unit/pet-xp.test.ts tests/integration/familier-page.test.tsx`.
