# Research: Partage communautaire des prix

## Choix de la plateforme backend

**Decision**: Utiliser Cloudflare Workers + D1 (SQLite managé) comme infrastructure serveur pour
cette fonctionnalité : un unique Worker expose trois routes HTTP (`GET`/`POST /community-price`,
`DELETE /community-price/:id`) devant une base D1, avec un secret d'application partagé
(`COMMUNITY_API_KEY`) exigé pour écrire.

**Rationale**: C'est la première fonctionnalité de Dofus Craft à introduire un vrai backend —
l'application est aujourd'hui 100 % cliente. Avec un public restreint (~10-20 joueurs,
cf. spec.md/Assumptions), Supabase avait initialement été retenu (voir décision révisée
ci-dessous), mais l'utilisateur a explicitement demandé un outil dont le palier gratuit ne bascule
jamais vers une facturation, même en cas de dépassement — Supabase facture au-delà de son quota
gratuit, tandis que Cloudflare Workers + D1 ont un palier gratuit qui ne peut pas être dépassé sans
action explicite de l'utilisateur (pas de carte bancaire requise, aucune bascule automatique vers
un plan payant). Les plafonds gratuits (5 Go D1, 100 000 écritures/jour, 5 millions de
lectures/jour) sont très largement suffisants pour dix à vingt joueurs. Le compromis assumé : D1
(SQLite) n'a ni API REST auto-générée ni Row Level Security comme Supabase/PostgREST, donc le
Worker est du code applicatif à écrire et maintenir — mais celui-ci reste minimal (trois routes,
aucune dépendance de framework) et, en pratique, offre un contrôle d'accès *plus* strict que
l'approche précédente : il n'existe littéralement aucune route qui expose une contribution
individuelle, alors qu'avec PostgREST l'absence de politique de lecture était une configuration à
maintenir correctement plutôt qu'une impossibilité structurelle.

**Alternatives considered**:

- Supabase (PostgreSQL managé, API REST PostgREST, Row Level Security) : décision initiale de
  cette recherche, **révisée** après retour explicite de l'utilisateur sur le risque de
  facturation au-delà du quota gratuit — inacceptable pour ce projet même si peu probable à cette
  échelle réelle. PostgREST restait plus rapide à mettre en place (API générée depuis le schéma),
  mais ce gain ne compense pas la contrainte exprimée.
- Firebase/Firestore (palier gratuit Spark) : palier gratuit qui bloque l'usage plutôt que de
  facturer, ce qui aurait aussi satisfait la contrainte — rejeté malgré tout, base NoSQL sans
  calcul de médiane natif, aurait nécessité une Cloud Function dédiée pour l'agrégation, complexité
  équivalente au Worker Cloudflare pour un gain nul.
- Serveur applicatif dédié (Node/Express ou équivalent) sur un hébergeur classique : rejeté —
  introduirait un déploiement, une surface de maintenance et un risque de coût d'infrastructure
  sans justification face à l'échelle réelle du projet (principe IV).

## Client HTTP pour parler au backend

**Decision**: Appeler les routes du Worker avec `fetch` natif, exactement comme
`src/services/dofusdb-api.ts` appelle déjà l'API DofusDB, sans framework ni SDK côté client.

**Rationale**: Le Worker expose une API REST HTTP classique (en-tête `Authorization: Bearer`,
requêtes/réponses JSON) ; le projet a déjà un pattern établi et testé pour ce type d'appel
(`dofusdb-api.ts`, mocké en test via `vi.stubGlobal('fetch', ...)`). Aucune bibliothèque cliente
n'apporte de bénéfice pour trois opérations HTTP simples — contraire au principe IV sans besoin
démontré.

**Alternatives considered**: Aucune retenue — ce choix ne dépend pas du fournisseur backend et
n'a pas été rouvert par le changement de plateforme.

## Modélisation de la contribution et de l'agrégation

**Decision**: Une seule table D1 `community_price_contributions` (identifiant généré, ressource,
serveur, montant en kamas, horodatage), sans aucune colonne identifiant un contributeur. Aucune
route du Worker ne renvoie jamais une contribution individuelle : la seule route de lecture
(`GET /community-price`) calcule, dans le code du Worker (`worker/src/median.ts`), la médiane des
contributions valides pour une ressource et un serveur donnés : (1) ne considère que les
contributions des 90 derniers jours glissants (FR-011), (2) écarte statistiquement les valeurs
aberrantes par la méthode de l'écart interquartile avant de calculer la médiane (FR-010), en
reproduisant exactement l'interpolation linéaire de `percentile_cont` (formule identique, pour
que le changement de backend ne change silencieusement aucun résultat déjà spécifié), (3) renvoie
la médiane ainsi que le nombre de contributions retenues (pour distinguer une médiane issue d'une
seule contribution — cf. Edge Cases de spec.md).

**Rationale**: Traduit directement FR-003, FR-010 et FR-011 sans exposer les contributions brutes
(FR-007) ; D1/SQLite n'a pas d'équivalent natif à `percentile_cont`, donc ce calcul doit être fait
en JavaScript côté Worker plutôt qu'en SQL pur — c'est le principal changement d'implémentation
face à la décision Supabase précédente, mais le résultat produit reste identique par construction
(même formule, mêmes règles de fenêtrage et de filtrage).

**Alternatives considered**:

- Recalculer la médiane côté client à partir des contributions brutes : rejeté — contredirait
  FR-007/l'anonymat (il faudrait exposer les contributions individuelles en lecture) et
  déplacerait vers chaque client une logique que le Worker peut faire une fois, de façon fiable.
- Stocker une médiane pré-calculée mise à jour à chaque écriture : rejeté pour cette itération —
  complexité de maintenance pour un gain de performance non démontré à cette échelle (dizaines de
  lectures/écritures, pas des milliers) ; calculer à la lecture reste largement suffisant.

## Fréquence de rafraîchissement du prix communautaire

**Decision**: Récupérer le prix communautaire à chaque consultation d'une ressource (montage du
composant d'affichage, changement de ressource ou de serveur actif), puis le rafraîchir
automatiquement toutes les 5 minutes tant que le joueur reste sur la même ressource.

**Rationale**: Traduit FR-013 en un chiffre concret plutôt qu'une notion vague de « fréquence
suffisante ». À l'échelle du public visé (~10-20 joueurs, contributions peu fréquentes), un
rafraîchissement toutes les 5 minutes reste largement suffisant pour rester représentatif sans
produire de charge réseau perceptible, et évite qu'une session longue sur la même ressource
affiche un prix communautaire silencieusement obsolète. Sans rapport avec le choix de backend, non
rouverte par le changement de plateforme.

**Alternatives considered**:

- Flux temps réel (ex. Durable Objects + WebSockets) : rejeté — complexité et dépendance
  supplémentaire non justifiées par le besoin réel à cette échelle (principe IV).
- Rafraîchissement uniquement manuel (à la demande du joueur) : rejeté — risquerait de laisser un
  prix obsolète affiché pendant une session longue sans qu'aucun signal ne le indique.

## Retrait rétroactif d'une contribution sans compte

**Decision**: Chaque contribution insérée renvoie son identifiant généré par le Worker
(`crypto.randomUUID()`) ; le client le conserve localement (voir section suivante) et peut
demander sa suppression en le fournissant — la connaissance de cet identifiant fait office de
preuve de propriété, sans qu'aucune identité ne soit jamais associée à la contribution.

**Rationale**: C'est la traduction directe de FR-012, tel que tranché avec l'utilisateur
(Question 3, option B) : le retrait porte sur les contributions déjà envoyées, sans réintroduire
de traçabilité. La route `DELETE /community-price/:id` du Worker supprime la ligne correspondante
sans vérifier d'autre identité que la connaissance de l'identifiant lui-même — même principe
qu'une politique RLS `USING (true)` aurait appliqué avec Supabase, appliqué ici directement dans
le code du Worker plutôt que dans une politique déclarative.

**Alternatives considered**: Aucune retenue — l'option A (pas de retrait rétroactif possible) et
l'option C (compte utilisateur) avaient déjà été écartées par l'utilisateur lors de la
clarification de la spec ; ce choix ne dépend pas du fournisseur backend.

## Persistance côté client des identifiants de contribution et du consentement

**Decision**: Un nouveau module `persistence/community-contributions.ts` mémorise, dans
`localStorage`, la liste des contributions envoyées par ce joueur (identifiant, ressource,
serveur), suivant le même pattern que `persistence/pinned-items.ts` (une petite liste sérialisée,
pas de volume justifiant IndexedDB à cette échelle). Le consentement de partage est mémorisé
séparément dans un nouveau `persistence/community-consent-preference.ts`, au même pattern que
`persistence/price-mode-preference.ts` (préférence binaire simple, lue de façon synchrone).

**Rationale**: Réutilise strictement les patterns de persistance déjà établis dans le projet
(principe IV) ; sépare le consentement de partage du mode de gestion des prix existant
(003-community-price-mode), conformément à FR-004/FR-005 qui exigent un consentement distinct de
la simple activation du mode communautaire. Sans rapport avec le choix de backend.

**Alternatives considered**:

- Étendre le store IndexedDB scopé par serveur existant (`server-scoped-price-store.ts`) : rejeté
  — les identifiants de contribution ne sont pas un prix et n'ont pas besoin des opérations de ce
  store (get/save/remove par ressource) ; une petite liste `localStorage` est plus simple et
  suffisante au volume attendu (un joueur ne contribuera pas des milliers de prix).

## Comportement hors-ligne / service indisponible

**Decision**: Le prix communautaire déjà récupéré pour une ressource/serveur pendant la session en
cours est conservé en mémoire (et dans `sessionStorage` pour survivre à une navigation dans l'app
sans rechargement) et réaffiché avec une indication « peut-être daté » si une nouvelle requête
échoue ; aucune tentative de cache persistant longue durée (IndexedDB) n'est introduite dans cette
itération.

**Rationale**: Couvre l'hypothèse actée dans spec.md (dernier prix connu affiché plutôt que rien)
sans ajouter la complexité d'invalidation d'un cache persistant à travers les rechargements de
page, complexité non démontrée comme nécessaire à cette échelle (principe IV). `sessionStorage`
suffit à couvrir le cas réel visé (perte de connexion temporaire pendant l'usage de l'app). Sans
rapport avec le choix de backend.

**Alternatives considered**:

- Cache persistant en IndexedDB avec expiration : rejeté pour cette itération, complexité
  d'invalidation non justifiée par un besoin démontré ; à reconsidérer si l'usage réel montre que
  la perte du cache au rechargement de page pose un problème concret.

## Qualité et tests

**Decision**: Réutiliser Vitest + React Testing Library pour le client (`fetch` mocké via
`vi.stubGlobal`, même pattern que `dofusdb-api.test.ts`) et pour la logique pure d'agrégation du
Worker (`worker/src/median.ts`, testée directement en Vitest sans runtime Workers — c'est une
fonction JavaScript pure) ; Playwright pour les parcours complets, backend simulé par interception
réseau. Le déploiement réel du Worker et la création de la base D1 sont vérifiés manuellement
(`wrangler d1 execute` en local/à distance, voir `quickstart.md`) plutôt que par un environnement
Workers complet en CI, disproportionné pour trois routes au regard du principe IV.

**Rationale**: Cohérent avec l'outillage déjà en place pour 001/002/003. Tester `median.ts`
directement en Vitest (plutôt que via une invocation HTTP du Worker) est plus simple et plus
rapide, et suffit à garantir FR-010/FR-011 puisque c'est là que vit toute la logique statistique —
les routes elles-mêmes ne font que lire/écrire en base et appeler cette fonction.

**Alternatives considered**:

- Tests d'intégration contre `wrangler dev` (Worker + D1 local) en CI : rejeté pour cette
  itération, jugé disproportionné pour trois routes aussi simples ; à reconsidérer si le Worker
  grandit significativement en complexité.
