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

Les commandes Speckit déclenchent des actions git automatiques (`.specify/extensions.yml`) : une
branche `NNN-nom-court` est créée à partir de `master` avant `/speckit-specify`, et chaque étape
(specify, clarify, plan, tasks, implement, converge) est commitée sur cette branche. La fusion dans
`master`, d'où l'on déploie, est seulement proposée après `/speckit-implement` (`/speckit-git-merge`).

Respecter la constitution du projet (`.specify/memory/constitution.md`) et rester cohérent avec les
specs déjà existantes dans `specs/`. Pour un correctif ponctuel ou un bug qui ne touche pas une
fonctionnalité déjà spécifiée, ce workflow complet n'est pas obligatoire.