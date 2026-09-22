# Phase 0 Research: Affichage instantané du cache local sur la page Recherche

Aucun `NEEDS CLARIFICATION` n'a été laissé dans le Technical Context du plan : les points ci-dessous
documentent les décisions techniques prises pour lever les ambiguïtés d'implémentation identifiées
pendant la lecture du code existant (voir aussi la section Assumptions de `spec.md`).

## 1. Où persister le cache du catalogue DofusDB

**Decision**: Une nouvelle base IndexedDB dédiée, `dofus-craft-catalogue-cache` (un seul store
générique `entries`, clé texte, valeur `{ key, value: JSON, savedAt: string }`), plutôt que
d'ajouter un store dans la base `dofus-craft` existante (`server-scoped-price-store.ts`).

**Rationale**: La base `dofus-craft` existante est scoped par serveur de jeu
(`[serverId, entryId]`) et sert exclusivement les carnets de prix (constitution IV : garder les
sources de données séparément maintenables). Le catalogue DofusDB n'est pas scoped par serveur
(c'est une donnée de jeu globale, déjà traitée comme telle dans `App.tsx`) et ses entrées ont une
forme différente (clé texte libre, ex. `search:...`, `detail:...`, `categories`). Une base séparée
évite tout risque de migration/`onupgradeneeded` sur la base des prix (aucun risque de régression
sur des données financières déjà enregistrées par l'utilisateur) et garde le changement localisé
(constitution IV).

**Alternatives considered**:
- Étendre `REGISTERED_STORES` dans `server-scoped-price-store.ts` : rejeté, mélange deux
  responsabilités distinctes (prix scoped-serveur vs catalogue global) et couple un bump de version
  de la base de prix à cette fonctionnalité.
- `localStorage` pour le catalogue : rejeté, le volume potentiel (résultats de recherche, recettes
  avec ingrédients, catégories) peut dépasser confortablement les ~5 Mo de quota de `localStorage`
  utilisés ailleurs pour des petites préférences ; IndexedDB n'a pas cette limite pratique.

## 2. Où et comment persister le cache de la médiane communautaire

**Decision**: Remplacer la lecture/écriture `sessionStorage` de `useCommunityPrice.ts` par
`localStorage`, avec la même forme de clé (`craftcheck-community-price:{serverId}:{resourceId}`),
et la lire **en premier** (cache-first) plutôt qu'en secours uniquement après un échec réseau.

**Rationale**: `sessionStorage` survit déjà à un rechargement de page dans le même onglet, mais pas
à la fermeture/réouverture de l'onglet — `localStorage` couvre les deux cas avec la même API
synchrone, sans dépendance supplémentaire. Le changement de politique de lecture (cache-first) est
ce qui manque réellement aujourd'hui : le hook démarre toujours à `{ kind: 'loading' }` et n'utilise
le cache qu'après un échec réseau (`readCache` n'est appelée que dans la branche d'erreur de
`fetchState`).

**Alternatives considered**:
- Garder `sessionStorage` : rejeté, ne satisfait pas complètement "après un premier chargement"
  (specs/010, US1) si l'utilisateur ferme puis rouvre l'onglet plus tard, sans gain de simplicité.
- IndexedDB pour cette médiane : rejeté, volume minuscule (un nombre + une taille d'échantillon par
  ressource/serveur), `localStorage` reste plus simple et suffisant, cohérent avec le composant
  existant.

## 3. Garantir l'absence de condition de course (FR-009/FR-010)

**Decision**: Un compteur de génération par clé de requête (`query`/`selectedId`/`ids+serverId`/
`resourceId+serverId` selon le consommateur), incrémenté à chaque changement de clé. Toute
résolution (lecture cache ou réponse réseau) dont la génération ne correspond plus à la génération
courante est ignorée. De plus, une résolution de cache n'est appliquée que si **aucune réponse
réseau plus fraîche n'est déjà arrivée** pour cette génération (drapeau `networkArrived` par
génération) — ce qui couvre le cas où la lecture IndexedDB locale, bien que rapide, résout après un
réseau exceptionnellement rapide.

**Rationale**: C'est le pattern déjà utilisé de façon ad hoc dans le code existant (les drapeaux
`cancelled` dans `useCatalogue.ts`, `useResourcePrices.ts`, `useCommunityPrice.ts`), généralisé et
centralisé dans un seul hook testé une fois plutôt que dupliqué et re-vérifié à chaque site
d'appel. Un compteur de génération est plus robuste qu'un simple booléen `cancelled` lorsque deux
sources asynchrones concurrentes (cache local + réseau) peuvent résoudre dans un ordre
imprévisible pour la **même** génération.

**Alternatives considered**:
- `AbortController` seul : ne couvre que l'annulation du fetch réseau, pas la garde "cache après
  réseau plus frais" ni la comparaison de génération pour une lecture IndexedDB (qui n'est pas
  annulable une fois lancée).
- Comparer les timestamps de résolution plutôt qu'un numéro de génération : rejeté, plus fragile
  (horloges/`Date.now()` avec résolution insuffisante en cas de résolutions quasi simultanées) que
  la comparaison stricte d'un compteur incrémental.

## 4. Péremption du cache affiché

**Decision**: Aucun TTL ne conditionne l'affichage immédiat : le cache local est toujours montré
dès qu'il existe, quel que soit son âge (voir spec.md, Assumptions). La fraîcheur n'est communiquée
que via l'indicateur discret (FR-008/FR-012/FR-013), jamais en forçant un état de chargement à la
place d'une donnée locale existante.

**Rationale**: Le TTL mémoire de 24h existant dans `catalogue-cache.ts` sert un objectif différent
(éviter des appels réseau redondants au sein d'un même onglet) et reste inchangé ; il ne doit pas
être confondu avec la politique d'affichage de ce cache persistant, dont le rôle est justement de
combler l'absence totale de persistance disque aujourd'hui.

## 5. Détection de "quelque chose a changé" avant de mettre à jour l'affichage (FR-004)

**Decision**: Comparaison par égalité structurelle simple (`JSON.stringify` des deux valeurs) comme
comportement par défaut du hook générique, avec possibilité pour un appelant de fournir un
comparateur dédié si nécessaire.

**Rationale**: Les données concernées (résultats de recherche, détail de recette, maps de prix par
identifiant de ressource) sont de petits objets sérialisables sans référence circulaire ni fonction,
pour lesquels `JSON.stringify` est un comparateur simple, suffisant et déjà dans l'esprit du code
existant (`useCommunityPrice.ts` sérialise déjà ses valeurs en cache de la même façon). Évite
d'introduire une dépendance de deep-equal supplémentaire pour un besoin aussi borné (constitution
IV).

## 6. Préserver la position de défilement, la recherche, les filtres et l'objet sélectionné

**Decision**: Aucun mécanisme de sauvegarde de scroll supplémentaire n'est nécessaire. La recherche,
les filtres et l'objet sélectionné sont déjà portés par l'URL (`useSearchParams`) et
`sessionStorage` (`SEARCH_CONTEXT_STORAGE_KEY`) dans `RecherchePage.tsx`, inchangés par cette
fonctionnalité. La position de défilement est un effet naturel de ne **pas** démonter/remonter la
liste de résultats pendant une revalidation : le vrai problème actuel est qu'`ItemResults.tsx`
remplace toute la liste par un skeleton dès que `loading` est vrai (voir `ItemResults.tsx:24`),
même quand des données sont déjà affichées. Corriger cette confusion loading/revalidating suffit à
préserver le scroll sans code dédié.

**Rationale**: Évite d'ajouter un état ou un stockage superflu pour un problème déjà résolu par une
distinction d'état plus précise (constitution IV : pas d'abstraction non requise par un besoin
démontré).

## 7. Périmètre laissé inchangé : `catalogue-repository.ts` et `catalogue-cache.ts`

**Decision**: Ni `catalogue-repository.ts` ni le cache mémoire `catalogue-cache.ts` ne sont modifiés.
Le nouveau cache persistant se branche uniquement dans `useCatalogue.ts`, en enveloppant les mêmes
appels (`searchItems`, `getItemDetail`, `getCategories`) déjà exposés par le repository, comme
fonction "réseau" du hook générique.

**Rationale**: Ces fonctions concentrent une logique de recherche/filtrage déjà complexe et
correcte ; les toucher pour y injecter une couche de persistance aurait un rayon d'impact plus
large que nécessaire pour ce que demande la spec (afficher immédiatement ce que **l'utilisateur a
déjà vu** sur cette page), et irait à l'encontre de la constitution IV (changement étroit et
documenté). Le cache mémoire interne (`catalogue-cache.ts`) continue de servir son propre objectif
(éviter des appels DofusDB redondants au sein d'un même onglet) sans changement.
