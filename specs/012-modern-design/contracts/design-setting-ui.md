# Contrat UI : réglage « Design »

## Paramètres

- Nouvelle section `panel settings-section`, titre « Design », placée avant « Thème ».
- Description : « Essayez le nouveau design, ou revenez au design classique à tout moment. »
- Deux boutons `settings-choice` : « Classique » et « Nouveau », `aria-pressed` sur le choix actif,
  même présentation que le choix du thème.

## Racine du document

- `<html data-design="modern">` quand « Nouveau » est actif ; attribut absent sinon.
- Posé avant le premier rendu (`src/main.tsx`), puis mis à jour par `AppShell`.

## Feuille de style

- `src/styles/design-modern.css`, importée après les autres feuilles.
- Invariant vérifié par un test : chaque sélecteur du fichier commence par
  `:root[data-design="modern"]` (ou se trouve dans un `@media` / `@keyframes` dont les règles le
  respectent). C'est ce qui garantit un « Classique » inchangé (FR-005).
