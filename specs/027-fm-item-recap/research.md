# Research: Récap de forgemagie par objet

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-30

Sources lues : `worker/src/fm/` (router, reads, me, bot-events), `worker/schema.sql`,
`src/features/forgemagie/`, `src/data/catalogue-repository.ts` (`searchItems`).

## R1. Où ranger le rattachement

**Decision** : une table `fm_items` pour les objets en FM, et une colonne `fm_item_id` (NULL par
défaut) dans `fm_sessions`, ajoutées par la migration `0008`. Une session a donc au plus un objet
(FR-006) par construction.

**Rationale** : « un seul objet par session » se traduit directement par une colonne ; pas de table de
liaison. Les totaux restent calculés à la lecture à partir des captures (FR-013), comme dans specs/025.

**Alternatives considered** : une table de liaison `fm_item_sessions` (permettrait plusieurs objets par
session, refusé par le porteur du projet) ; stocker un total dans `fm_items` (se désynchroniserait des
remises à zéro et des suppressions de profil).

## R2. Rattachement sans course

**Decision** : `PUT /fm/sessions/{id}/item` fait un `UPDATE fm_sessions SET fm_item_id = ? WHERE id = ?
AND fm_item_id IS NULL`, après avoir vérifié que l'objet appartient au joueur connecté et que ce
joueur a au moins une capture dans la session (FR-005). Si aucune ligne n'est modifiée alors que la
session existe, la réponse est `409 already-attached`. Le détachement (`DELETE`) ne modifie que si
l'objet rattaché appartient au joueur connecté (FR-007).

**Rationale** : la condition `fm_item_id IS NULL` dans la même requête rend le « premier qui rattache
l'emporte » (cas limite de la spec) sûr, même si deux joueurs cliquent en même temps.

## R3. Données de l'équipement

**Decision** : le site envoie, à la création, l'identifiant, le nom et l'URL de l'icône de
l'équipement choisi dans le catalogue (`searchItems`, filtré sur `kind === 'Equipment'`). Le Worker les
enregistre tels quels après contrôle de forme : identifiant numérique, nom de 1 à 80 caractères, icône
vide ou en `https://api.dofusdb.fr/`. Nom libre : 1 à 40 caractères après suppression des espaces aux
bords, ou absent (FR-001, FR-003).

**Rationale** : le Worker n'a pas le catalogue des équipements (seul l'index des ressources y est). Ces
données ne servent qu'à l'affichage de l'objet de son propriétaire, et FR-003 demande justement de
garder ce qui a été choisi à la création. Le domaine de l'icône est restreint pour ne jamais afficher
une image d'un domaine arbitraire aux autres membres.

**Alternatives considered** : embarquer l'index des équipements dans le Worker (plusieurs milliers
d'objets, sans gain pour l'affichage).

## R4. Visibilité

**Decision** : même règle que specs/025 (R10) : les réponses sont filtrées **dans le Worker**. Pour un
autre membre, un objet d'un propriétaire privé n'existe pas (`404`), et une session rattachée à un tel
objet renvoie `fmItem: { private: true }` sans nom ni identifiant (FR-008, FR-014, SC-003).

## R5. Suppressions

**Decision** : `DELETE /fm/items/{id}` (propriétaire seulement) détache ses sessions puis supprime
l'objet, dans un `batch` (FR-004). `DELETE /fm/me` (specs/025) ajoute les mêmes deux opérations pour
tous les objets du joueur, avant la suppression du joueur (FR-015).

## R6. Où l'afficher sur le site

**Decision** :
- **Profil** : une section « Objets en FM » liste les objets du profil affiché, avec leur total ; sur
  son propre profil, un bouton « Ajouter un objet » (recherche d'équipement), et renommer ou supprimer
  chaque objet.
- **Récap** : ouvert depuis le profil, dans la page Forgemagie, comme le détail d'une session : total,
  sessions rattachées (qui ouvrent leur détail), détail par objet acheté.
- **Détail d'une session** : une ligne « Objet : … » ; si le joueur connecté peut la rattacher, une
  liste de ses objets et un bouton « Rattacher » ; si c'est son objet, « Détacher ». La liste des
  sessions montre le nom de l'objet sur chaque carte.
