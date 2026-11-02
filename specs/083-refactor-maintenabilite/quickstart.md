# Guide de validation

À lancer depuis la racine du worktree, après chaque étape et à la fin.

## Prérequis

```bash
npm install
```

## Contrôles automatiques

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Résultat attendu : tout passe, comme avant le chantier (CR-001).

## Contrôles de structure

- `src/styles/` : aucun fichier de plus de 600 lignes (CR-002).
- Composants ciblés : fichier principal de moins de 300 lignes (CR-003).
- Modules de règles, données, API et Worker ciblés : moins de 300 lignes (CR-004).
- Un seul fichier de verrouillage à la racine : `package-lock.json` (CR-005).

## Contrôle visuel du CSS

Construire le site avant (sur `master`) et après, puis comparer le CSS compilé : même contenu, même
ordre des règles.

Pages à regarder en dernier : Accueil, Recherche, Épinglés, Brisage, Familier, Forgemagie, Prix,
Réglages, en clair et en sombre, sur écran large et étroit.
