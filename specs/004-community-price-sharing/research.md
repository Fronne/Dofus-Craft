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

## Révision : deux carnets de prix indépendants, pré-remplissage direct et partage groupé

Cette section documente les décisions de la révision du 2026-09-16 de la spec (pré-remplissage du
champ de prix par la communauté, étanchéité stricte entre modes, partage groupé). Le backend
(Worker + D1, décisions ci-dessus) n'est pas rouvert par cette révision.

### Isolation des deux carnets de prix

**Decision**: Le carnet Mode communautaire est un second store IndexedDB physiquement distinct
(`community-mode-prices-by-server`), créé par une seconde instance de la factory déjà existante
`createServerScopedPriceStore` (une entrée de plus dans `REGISTERED_STORES`), plutôt qu'un champ
« mode » ajouté au store `resource-prices-by-server` existant.

**Rationale**: FR-005 exige une étanchéité stricte, dans les deux sens, entre les deux carnets.
Deux stores séparés rendent cette garantie structurelle (une requête sur l'un ne peut littéralement
pas retourner une ligne de l'autre) plutôt que dépendante d'un filtre applicatif systématiquement
correct partout où le store est lu — le même raisonnement que celui qui a mené, dans la première
itération, à ne jamais exposer une contribution individuelle côté Worker plutôt que de compter sur
une politique de lecture. Le repository qui l'expose
(`indexeddb-community-mode-price-repository.ts`) suit exactement la forme de
`indexeddb-resource-price-repository.ts`, permettant à `useResourcePrices` de rester un seul hook
générique paramétré par le repository plutôt que dupliqué.

**Alternatives considered**:

- Un champ `mode` dans la clé composite du store existant : rejeté — aurait exigé une migration de
  schéma/clé du store `resource-prices-by-server` déjà en production, et un filtre `mode` à ajouter
  correctement à chaque site de lecture existant ; plus fragile que deux stores distincts pour la
  garantie exacte demandée.
- Garder un seul carnet et simplement changer l'affichage selon le mode : rejeté explicitement par
  l'utilisateur lors de la clarification de la spec (risque qu'un prix communautaire modifié en
  Mode communautaire écrase silencieusement un prix personnel vérifié, ou inversement).

### Pré-remplissage = sauvegarde immédiate dans le carnet Mode communautaire

**Decision**: Dès qu'une ressource est consultée en Mode communautaire sans valeur déjà présente
dans son carnet Mode communautaire, et qu'un prix communautaire (médiane) est disponible, ce prix
est immédiatement écrit dans ce carnet (pas seulement affiché en mémoire) via le même repository
que pour toute autre saisie.

**Rationale**: Traduit FR-001/FR-004 tels que demandés par l'utilisateur (« le champ... directement
remplie... avec possibilité de le modifier »). Cette persistance immédiate rend la règle
anti-écrasement (FR-006) triviale à implémenter et à tester : un rafraîchissement automatique n'a
qu'à vérifier si une entrée existe déjà dans le carnet avant de (ne pas) l'écrire, exactement la
même logique de garde que le carnet Mode personnel applique déjà implicitement en ne préremplissant
jamais un champ que le joueur a modifié.

**Alternatives considered**:

- Garder la valeur uniquement en état React local jusqu'à une action explicite de confirmation :
  rejeté — aurait exigé un mécanisme séparé de distinction « suggestion vue » / « valeur confirmée »
  persistant à travers une navigation ou un rechargement, dupliquant ce que le store fournit déjà
  gratuitement une fois la valeur écrite.

### Partage groupé plutôt que contribution par ressource

**Decision**: Le bouton de contribution par ressource est retiré. Un bouton unique dans les
Paramètres (`ParametresPage.tsx`, section « Partage communautaire » déjà existante) lit
`prices.listAllForServer(serverId)` — méthode déjà présente sur `ResourcePriceRepository` mais
jusqu'ici inutilisée — affiche une confirmation indiquant combien de prix seront transmis (même
pattern `window.confirm` que `handleWithdrawAll` déjà présent dans ce fichier), puis appelle
`submitCommunityPrice` pour chacun et enregistre chaque `id` renvoyé via `addLocalContribution`,
exactement comme le faisait l'ancien bouton par ressource.

**Rationale**: Réduit la friction (un partage en une action plutôt que ressource par ressource) et
réutilise une capacité de lecture déjà écrite plutôt que d'en ajouter une. Le contrat serveur
(`POST /community-price`) reste inchangé : c'est une boucle côté client sur un endpoint existant, à
une échelle (dizaines de prix au plus) où un endpoint de soumission en lot n'apporterait aucun
bénéfice mesurable (principe IV).

**Alternatives considered**:

- Endpoint de soumission en lot côté Worker : rejeté — complexité serveur supplémentaire non
  justifiée à cette échelle, le Worker actuel (une route POST simple) suffit appelé en boucle.
- Garder aussi le bouton par ressource en plus du bouton global : explicitement écarté par
  l'utilisateur lors de la clarification (un seul bouton global).

### Réutilisation de la logique de récupération/cache du prix communautaire

**Decision**: La logique de récupération, de cache `sessionStorage` et de rafraîchissement toutes
les 5 minutes déjà présente dans `CommunityPriceDisplay.tsx` est extraite dans un hook
`useCommunityPrice(resourceId, serverId)`, réutilisé à la fois pour déclencher le pré-remplissage
(ci-dessus) et pour l'indicatif compact de nombre de contributions/caractère daté rendu par
`ResourcePriceInput.tsx`. `CommunityPriceDisplay.tsx` en tant que composant de bloc séparé est
retiré.

**Rationale**: FR-011/FR-014 (comportement hors-ligne, fréquence de rafraîchissement) ne changent
pas de comportement dans cette révision, seulement de consommateur et d'habillage visuel ; extraire
cette logique déjà correcte évite de la dupliquer ou de la réécrire.

**Alternatives considered**: Dupliquer une version simplifiée du fetch dans `ResourcePriceInput.tsx`
et une autre dans la logique de pré-remplissage de `RecherchePage.tsx` : rejeté, dupliquerait une
logique de cache/rafraîchissement déjà écrite et testée sans raison.

## Révision 2 : retrait du consentement explicite et du retrait rétroactif

Cette section documente les décisions de la seconde révision (le partage devient la valeur par
défaut du Mode communautaire). Le backend n'est concerné que par la suppression de la route
`DELETE /community-price/:id` ; les décisions précédentes (choix du backend, agrégation, deux
carnets indépendants, pré-remplissage) ne sont pas rouvertes.

### Retirer `ShareConsent` plutôt que le neutraliser

**Decision**: `src/persistence/community-consent-preference.ts` (le module entier, sa clé
`localStorage`, et le type `ShareConsent` dans `domain/types.ts`) est supprimé, plutôt que gardé
avec une valeur figée à `true`.

**Rationale**: Une valeur figée aurait laissé un état mort — une préférence stockée mais plus jamais
lue avec effet variable — contrairement au principe IV (pas d'abstraction sans besoin actuel
démontré). Aucun code ne doit plus dépendre de ce concept une fois le consentement retiré du
produit ; le garder « au cas où » referait le même compromis que celui déjà tranché pour
`CommunityPriceDisplay.tsx` lors de la révision précédente.

**Alternatives considered**: Conserver le module mais ne plus l'appeler nulle part : rejeté, ce
serait du code mort immédiat sans plan de réutilisation concret.

### Retirer le retrait rétroactif plutôt que le garder « juste au cas où »

**Decision**: `src/persistence/community-contributions.ts` (`LocalContributionRecord`), l'appel à
`withdrawCommunityContribution` dans `community-price-api.ts`, le bloc « retirer mes contributions »
de `ParametresPage.tsx`, et la route Worker `DELETE /community-price/:id` sont tous supprimés
ensemble — le retrait rétroactif n'existait que pour donner un sens à un consentement qu'il est
désormais possible de retirer ; sans consentement à retirer, cette fonctionnalité perd sa
justification produit d'origine (research.md, itération initiale, § « Retrait rétroactif d'une
contribution sans compte »).

**Rationale**: Le joueur a explicitement demandé de retirer les deux ensemble plutôt que de garder
un retrait rétroactif sans notion de consentement à retirer — cohérent avec l'échelle réelle du
public visé (spec.md/Assumptions, ~10-20 joueurs qui se connaissent) où une contribution erronée se
corrige par une nouvelle observation de marché, pas par une suppression technique ; la fenêtre de
rétention de 90 jours (FR-013) reste le mécanisme par lequel une contribution ancienne cesse de
compter.

**Alternatives considered**: Garder uniquement le retrait rétroactif sans réglage de consentement
préalable (un joueur pourrait encore demander la suppression d'un prix qu'il a partagé, même si plus
personne ne « consent » explicitement avant l'envoi) : explicitement écarté par l'utilisateur lors
de la clarification — la question posée nommait les deux mécanismes ensemble et la réponse a été de
les retirer tous les deux.

### La route `DELETE` du Worker devient injoignable : la retirer, pas la laisser en place

**Decision**: `worker/src/index.ts` ne conserve que `GET`/`POST /community-price` ; la route
`DELETE /community-price/:id` est retirée du code source, à redéployer manuellement
(`npm run worker:deploy`) comme tout changement de ce composant.

**Rationale**: Une fois qu'aucun client ne l'appelle plus, garder cette route ne fait qu'élargir la
surface d'attaque/maintenance du Worker sans bénéfice (principe IV) ; le schéma D1 lui-même n'a pas
besoin de changer (`id` reste une clé primaire de ligne ordinaire, utile indépendamment de tout
usage de suppression cliente).

**Alternatives considered**: Garder la route pour un usage manuel/administratif futur (purge d'une
contribution manifestement erronée par l'opérateur du Worker, hors produit) : jugé hors périmètre —
rien dans la demande du joueur ne motive un accès d'administration séparé ; à reconsidérer
explicitement si ce besoin apparaît plus tard, plutôt que provisionné par anticipation.

## Révision 4 : transmission automatique par ressource, à la perte de focus

Cette section documente les décisions de la quatrième révision (le bouton de partage groupé des
Paramètres est retiré ; chaque champ de prix en Mode communautaire transmet lui-même sa valeur dès
que le joueur termine une modification). Le backend (Worker + D1, décisions ci-dessus) n'est pas
rouvert par cette révision : `submitCommunityPrice`/`getCommunityPrice` gardent exactement les mêmes
signatures et le même contrat HTTP, seul change leur point d'appel côté client.

### Détecter un « vrai » changement plutôt que transmettre à chaque blur

**Decision**: `ResourcePriceInput` capture, dans une ref, la valeur du champ au moment précis où
l'édition commence (clic sur le bouton de déverrouillage, ou première frappe dans un champ vide) —
pas à chaque frappe suivante. À la perte de focus, la valeur actuelle n'est comparée qu'à cette
valeur capturée : `onCommit` n'est appelé que si elles diffèrent.

**Rationale**: Traduit directement FR-020 (« perdre le focus d'un champ dont la valeur n'a pas
changé... NE DOIT déclencher ni nouvelle transmission ni nouvelle incrémentation ») sans dépendre
d'un état externe au composant : un joueur qui clique sur le bouton de déverrouillage puis ressort
du champ sans rien taper (par exemple parce qu'il change d'avis, ou clique ailleurs par erreur) ne
doit produire aucune contribution. Garder cette détection à l'intérieur de `ResourcePriceInput`
plutôt que dans `CommunityResourcePriceRow` évite de dupliquer la logique de suivi de `editing` déjà
présente (révision 3) pour une décision qui lui est intimement liée.

**Alternatives considered**:

- Transmettre à chaque blur, y compris sans changement, et laisser le Worker/la médiane absorber les
  doublons : rejeté — gonflerait artificiellement `sampleSize` (FR-007) sans qu'aucune nouvelle
  observation de prix n'ait réellement eu lieu, trompant la lecture du nombre de contributions.
- Comparer les valeurs dans `CommunityResourcePriceRow` (le composant parent) plutôt que dans
  `ResourcePriceInput` : rejeté — dupliquerait le suivi de l'état `editing` déjà interne au
  composant, pour une vérification qui n'a de sens qu'au moment exact où ce composant détecte lui-même
  la perte de focus.

### Enchaîner soumission puis rafraîchissement dans le même hook

**Decision**: `useCommunityPrice` expose désormais un tuple `[state, commit]` plutôt que le seul
`state` : `commit(amountKamas)` appelle `submitCommunityPrice`, puis, seulement en cas de succès,
ré-exécute exactement la même fonction de chargement que celle utilisée au montage et au
rafraîchissement périodique de 5 minutes (déjà en place) — plutôt que d'écrire une deuxième copie de
cette logique de fetch/cache. En cas d'échec de l'envoi, `commit` ne déclenche aucun rechargement et
retourne l'état courant inchangé (FR-020 : aucune erreur bloquante, aucune tentative supplémentaire
avant la prochaine modification confirmée).

**Rationale**: FR-018 (réafficher la médiane recalculée après un envoi réussi) est littéralement un
rafraîchissement du prix communautaire — la seule différence avec le rafraîchissement périodique
déjà existant est ce qui le déclenche. Réutiliser la même fonction de chargement interne évite
d'introduire un second chemin de code pour aller chercher le même résultat (`GET /community-price`),
et garantit que le cache `sessionStorage` (US4/FR-011) reste cohérent quelle que soit la cause du
rafraîchissement.

**Alternatives considered**:

- Un second hook dédié uniquement à la soumission, séparé de `useCommunityPrice` : rejeté — aurait
  nécessité de dupliquer ou d'exposer différemment la logique de chargement déjà interne au hook
  existant, pour un gain de séparation non démontré à cette échelle (principe IV).
- Faire porter la soumission et le rafraîchissement par `CommunityResourcePriceRow` directement
  (appel direct à `submitCommunityPrice` puis `getCommunityPrice`, sans passer par le hook) : rejeté
  — dupliquerait la gestion du cache `sessionStorage` et de l'état `loading`/`found`/`unavailable`
  déjà écrite et testée dans `useCommunityPrice`.

### Écrire la médiane recalculée dans le carnet, au-delà de la garde anti-écrasement

**Decision**: Quand `commit` réussit et renvoie un état `found` avec une nouvelle médiane,
`CommunityResourcePriceRow` écrit explicitement cette valeur dans le carnet Mode communautaire (via
le même `onChange` que la saisie normale), même si une entrée existe déjà pour cette ressource — ce
qui, en apparence, entre en tension avec la garde anti-écrasement de FR-006.

**Rationale**: FR-006 protège contre un rafraîchissement *automatique et non sollicité* qui
écraserait silencieusement une valeur du joueur pendant qu'il ne fait rien de particulier sur ce
champ. Ce n'est pas le cas ici : cette écriture est la conséquence *directe et immédiate* de l'action
que le joueur vient lui-même de terminer sur ce champ précis (FR-018) — elle ne « surprend » jamais
le joueur puisqu'elle se produit à l'endroit exact où il vient d'agir, contrairement au
rafraîchissement périodique de 5 minutes qui peut survenir pendant que le joueur regarde autre chose.
Sans cette écriture, le champ reviendrait afficher la valeur brute tapée par le joueur à chaque
remontage du composant (changement de page, rechargement), ce qui contredirait la description de
FR-018/US1 (« le champ affiche alors la médiane communautaire recalculée ») en la réduisant à un
état visuel transitoire plutôt qu'à une valeur réellement conservée.

**Alternatives considered**:

- Afficher la médiane recalculée uniquement le temps de la session React en cours, sans l'écrire
  dans le carnet : rejeté — reviendrait à afficher la valeur brute du joueur après tout remontage du
  composant (nouvelle recherche, rechargement de page), contredisant la description de FR-018 comme
  un état durable plutôt que transitoire.
- Étendre FR-006 pour distinguer explicitement les deux cas dans le texte de la spec plutôt que de le
  documenter ici : jugé inutile — FR-006 mentionne déjà spécifiquement « un rafraîchissement
  automatique ultérieur », ce qui, à la lecture, ne couvre pas une écriture volontaire déclenchée par
  l'action du joueur lui-même ; cette section de research.md suffit à lever toute ambiguïté
  d'implémentation sans rouvrir le texte normatif de la spec.

### Validité de la valeur avant transmission

**Decision**: `commit` (et donc toute transmission automatique) n'est appelé que pour une valeur qui
satisfait déjà `isValidKamas` (le même contrôle que celui utilisé pour le calcul de coût de craft,
001) ; une valeur invalide ou vide n'est jamais transmise, même si elle a techniquement changé depuis
le déverrouillage.

**Rationale**: Une contribution communautaire est par nature un prix en kamas ; transmettre une
valeur invalide n'aurait aucun sens pour le calcul de la médiane et pourrait fausser `sampleSize`
sans qu'aucune observation de prix réelle n'ait eu lieu. `normalizeKamasInput` (déjà utilisé par
`onChange`) filtre déjà la plupart des caractères non numériques à la frappe ; ce contrôle
supplémentaire au moment du commit reste une garde de cohérence bon marché, cohérente avec la
validation déjà appliquée ailleurs dans le projet (001, FR-005 de 001-craft-profit-comparison).

**Alternatives considered**: Transmettre la valeur brute telle quelle et laisser le Worker/`median.ts`
filtrer les valeurs aberrantes après coup (FR-012) : rejeté — FR-012 filtre des valeurs *valides mais
statistiquement extrêmes*, pas des valeurs syntaxiquement invalides ou vides, qui n'ont pas leur
place dans la table `community_price_contributions` du tout.

## Révision 5 : identifiant d'appareil anonyme

### Génération : UUID aléatoire en localStorage, plutôt qu'un fingerprint d'appareil

**Decision**: L'identifiant d'appareil est un UUID v4 généré par `crypto.randomUUID()` (déjà utilisé
côté Worker pour l'`id` de chaque contribution — API standard, sans dépendance), écrit dans
`localStorage` au premier envoi et relu ensuite. Aucune technique de « fingerprinting » (User-Agent,
résolution d'écran, fuseau horaire, canvas fingerprinting, etc.) n'est utilisée.

**Rationale**: Un identifiant aléatoire stocké localement remplit exactement le besoin exprimé
(reconnaître des contributions d'un même appareil) sans introduire de risque de ré-identification :
il ne dépend d'aucune caractéristique réelle de l'appareil ou du navigateur, ne survit pas à un
effacement des données du site, et ne peut donc jamais être utilisé pour pister un joueur au-delà de
ce que `localStorage` permet déjà pour toutes les autres préférences de l'application (serveur actif,
mode de prix, objets épinglés). C'est aussi l'option la plus simple à implémenter et à tester
(principe IV) : pas de nouvelle dépendance, pas de calcul de hash, un seul accès `localStorage`
supplémentaire.

**Alternatives considered**:

- Fingerprinting technique (caractéristiques du navigateur/appareil combinées) : rejeté — nettement
  plus intrusif que nécessaire pour ce besoin, plus difficile à faire fonctionner de façon fiable
  (les caractéristiques changent avec les mises à jour du navigateur), et en tension avec l'esprit de
  FR-010 (minimiser ce qui pourrait, même indirectement, identifier un joueur).
- Cookie plutôt que `localStorage` : rejeté — le projet n'utilise déjà aucun cookie ailleurs ; un UUID
  en `localStorage` suit exactement le même pattern que toutes les autres préférences locales de
  l'application (server-preference, price-mode-preference, pinned-items), pour une cohérence
  d'implémentation (principe IV) sans bénéfice supplémentaire côté cookie (pas de besoin d'envoi
  automatique par le navigateur, l'app contrôle déjà chaque appel `fetch`).
- Générer un nouvel identifiant à chaque contribution plutôt que le persister : rejeté — reviendrait
  à ne jamais pouvoir reconnaître deux contributions du même appareil, ce qui est précisément le
  besoin exprimé par le joueur (spec.md, Input, révision 5).

### Résolution interne à `submitCommunityPrice`, plutôt qu'un paramètre exposé

**Decision**: `submitCommunityPrice` appelle `getOrCreateDeviceId()` elle-même, en interne ; ni sa
signature ni celle de `useCommunityPrice`/`commit` ne changent.

**Rationale**: Aucun appelant existant n'a besoin de connaître ou de transmettre le `deviceId` — c'est
un détail d'implémentation de la transmission, pas une donnée que `RecherchePage.tsx` ou
`useCommunityPrice.ts` manipulent par ailleurs. Résoudre l'identifiant à l'intérieur du service
évite de propager un nouveau paramètre à travers plusieurs couches pour une valeur que chaque site
d'appel aurait de toute façon dû résoudre de la même manière (principe IV, changements cohésifs).

**Alternatives considered**: Résoudre le `deviceId` dans `useCommunityPrice.ts` et le passer en
paramètre à `submitCommunityPrice` : rejeté — ajoute un paramètre à deux fonctions
(`commit`/`submitCommunityPrice`) pour une valeur que le service peut résoudre lui-même sans aucune
information supplémentaire venant de l'appelant, ce qui n'apporte aucun bénéfice de testabilité ou de
clarté en échange de la surface d'API supplémentaire.

### Migration D1 plutôt que colonne calculée ou table séparée

**Decision**: Une seule migration `ALTER TABLE community_price_contributions ADD COLUMN device_id
TEXT NOT NULL DEFAULT ''`, appliquée une fois manuellement contre la base de production (déjà
peuplée), en plus de la même colonne ajoutée à `schema.sql` pour toute base future créée depuis zéro.

**Rationale**: La table contient déjà des contributions réelles (voir quickstart.md, vérifications
manuelles précédentes) : `CREATE TABLE IF NOT EXISTS` ne modifierait pas une table déjà existante, une
migration séparée et explicite est donc nécessaire. Une valeur par défaut vide (plutôt que NULL ou un
UUID placeholder) garde la colonne `NOT NULL` (cohérent avec le reste du schéma, `resource_id`/
`server_id`/`amount_kamas` sont tous `NOT NULL`) tout en distinguant sans ambiguïté les lignes
antérieures à cette révision (`device_id = ''`) de toute contribution réelle postérieure (un UUID
généré par `crypto.randomUUID()` n'est jamais une chaîne vide).

**Alternatives considered**:

- Table séparée `device_contributions` reliant `device_id` à `contribution_id` : rejeté — sur-ingénierie
  pour un champ scalaire simple ; introduirait une jointure là où une colonne suffit, sans bénéfice
  puisque `device_id` n'est jamais utilisé pour une requête complexe dans cette révision (FR-023).
- Ne pas migrer la base de production, seulement appliquer le nouveau schéma aux futures bases : rejeté
  — laisserait le Worker en production échouer (contrainte `NOT NULL` sur une colonne absente) dès la
  première contribution envoyée par un client mis à jour, avant même que la migration soit rejouée.
