# Instructions pour Claude Code

- Toujours répondre en français.
- Pour le plan fait le en français

## Utiliser Speckit correctement

Ce projet utilise Speckit (`.specify/`, specs dans `specs/`). Pour toute nouvelle fonctionnalité ou
tout changement non trivial, suivre le workflow Speckit plutôt que de coder directement :

1. `/speckit-specify` pour créer ou mettre à jour la spec de la fonctionnalité.
2. `/speckit-clarify` si la spec contient des zones ambiguës.
3. `/speckit-plan` pour produire le plan d'implémentation.
4. `/speckit-tasks` pour découper le plan en tâches.
5. `/speckit-analyze` pour vérifier la cohérence spec/plan/tasks avant d'implémenter.
6. `/speckit-implement` pour exécuter les tâches.

Respecter la constitution du projet (`.specify/memory/constitution.md`) et rester cohérent avec les
specs déjà existantes dans `specs/`. Pour un correctif ponctuel ou un bug qui ne touche pas une
fonctionnalité déjà spécifiée, ce workflow complet n'est pas obligatoire.