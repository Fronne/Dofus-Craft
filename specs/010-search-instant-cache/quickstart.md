# Quickstart: valider l'affichage instantané du cache local sur la page Recherche

## Prérequis

- Dépendances installées (`npm install`) — pas de nouvelle dépendance ajoutée par cette
  fonctionnalité.
- Serveur de dev lancé : `npm run dev` (garder le serveur existant si déjà en cours, voir mémoire
  projet "keep-dev-server-running").
- Navigateur avec outils de développement (onglet Application/Stockage pour inspecter IndexedDB /
  localStorage, onglet Réseau pour simuler une coupure).

## Automated checks (à exécuter avant toute validation manuelle)

```bash
npm run typecheck
npm test              # tests/unit + tests/integration (Vitest)
npm run lint
```

Ciblé sur cette fonctionnalité une fois les fichiers créés (voir `plan.md` → Project Structure) :

```bash
npx vitest run tests/unit/use-stale-while-revalidate.test.ts
npx vitest run tests/unit/catalogue-cache-store.test.ts
npx vitest run tests/integration/recherche-instant-cache.test.tsx
```

Ces trois suites doivent couvrir, à minima, les critères de succès mesurables de `spec.md` :

- SC-005 / FR-009 / FR-010 : une réponse réseau obsolète (résolue après une réponse plus récente ou
  après un changement de clé) n'écrase jamais l'affichage courant ; une lecture de cache ne
  remplace jamais une donnée réseau déjà affichée.
- FR-004 : une réponse réseau identique au contenu déjà affiché ne déclenche aucune mise à jour
  visible (vérifiable par un compteur de rendus ou l'absence de nouvel objet retourné par le hook).
- FR-006 : sans donnée locale, le hook démarre bien en `loading: true`, comme le comportement
  actuel.

## Manual validation scenarios

### 1. Premier chargement (aucun cache local)

1. Ouvrir les outils de développement → Application → effacer IndexedDB (`dofus-craft`,
   `dofus-craft-catalogue-cache`) et le stockage local du site.
2. Ouvrir la page Recherche, faire une recherche.
3. **Attendu** : comportement actuel inchangé — un état de chargement (skeleton) s'affiche jusqu'à
   la réponse réseau, puis les résultats apparaissent (US3, FR-006, SC-004).

### 2. Rechargement avec cache déjà présent (Mode personnel)

1. Sur la page Recherche en Mode personnel, chercher un objet, le sélectionner, saisir un prix pour
   au moins une ressource.
2. Recharger la page (F5).
3. **Attendu** : la liste d'objets, la recette de l'objet sélectionné et le prix saisi s'affichent
   immédiatement, sans skeleton ni écran vide perceptible (US1, SC-001).

### 3. Rechargement avec cache déjà présent (Mode communautaire)

1. Basculer en Mode communautaire, chercher le même (ou un autre) objet pour que sa recette et ses
   prix communautaires soient chargés au moins une fois.
2. Recharger la page.
3. **Attendu** : même résultat qu'au scénario 2, y compris pour les prix communautaires et le badge
   d'information (nombre de contributions) affichés immédiatement depuis le cache local, avant toute
   réponse du service Cloudflare (US1, FR-011).

### 4. Rechargement hors ligne

1. Avec un cache déjà constitué (scénarios 2 ou 3), couper le réseau (outils de développement →
   Réseau → "Offline", ou désactiver le Wi-Fi).
2. Recharger la page.
3. **Attendu** : les données précédemment affichées (liste, recette, prix) restent visibles à
   l'identique ; aucun message d'erreur bloquant n'apparaît ; un indicateur discret signale l'état
   hors ligne (par ex. « données hors ligne » ou « dernière mise à jour : il y a X ») sans empêcher
   la saisie d'un prix (US2, FR-007, FR-008, SC-002).
4. Réactiver le réseau, attendre la revalidation périodique ou recharger : l'indicateur doit
   redevenir normal / refléter une synchronisation réussie (US2, acceptance scenario 3).

### 5. Changement de mode Perso ↔ Communautaire

1. Avec un objet déjà consulté dans les deux modes (voir scénarios 2 et 3), basculer de Mode
   personnel à Mode communautaire puis inversement plusieurs fois, sans recharger la page.
2. **Attendu** : à chaque bascule, les prix affichés correspondent immédiatement au carnet du mode
   nouvellement actif (pas de mélange, pas de flash vide), conformément à l'isolation déjà exigée
   par specs/004-community-price-sharing (edge case dédié de spec.md).

### 6. Pas de perte de contexte pendant une revalidation

1. Charger une recherche avec plusieurs résultats (assez pour faire défiler la liste), sélectionner
   un objet en bas de liste, faire défiler pour le garder visible.
2. Recharger la page puis, sans interagir, attendre la fin de la revalidation réseau en arrière-plan
   (elle doit se terminer en quelques secondes si le réseau est disponible).
3. **Attendu** : la recherche, les filtres, la position de défilement et l'objet sélectionné restent
   inchangés après la fin de la revalidation, même si son contenu diffère légèrement de ce qui était
   affiché (US1 acceptance scenario 4, FR-005).

## Où vérifier techniquement (pour le développeur, pas pour la validation fonctionnelle)

- Outils de développement → Application → IndexedDB → `dofus-craft-catalogue-cache` → `entries` :
  une entrée par recherche/détail/catégories déjà consultés, avec un champ `savedAt` qui avance à
  chaque revalidation réussie.
- Outils de développement → Application → Stockage local → clés
  `craftcheck-community-price:<serverId>:<resourceId>` : présentes après une première consultation
  réussie en Mode communautaire, lues immédiatement au rechargement suivant.
