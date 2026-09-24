# Recherche : administration des compteurs de joueurs

## 1. Qui protège la page d'administration

- **Décision** : un Worker dédié `dofus-craft-admin` (page d'administration + API d'administration),
  protégé en entier par Cloudflare Access au niveau du Worker (onglet **Access** du Worker :
  « Protect this Worker behind Access »). Politique : seule l'adresse e-mail du propriétaire, connexion
  par code à usage unique reçu par e-mail ; durée de session d'application réglée à 1 mois.
- **Justification** : la protection au niveau du Worker couvre toutes ses adresses (`workers.dev`,
  aperçus) sans domaine personnalisé. Le site public et l'API publique restent sur leurs Workers
  actuels, non protégés. Aucune adresse d'administration n'apparaît sur le site (FR-008).
- **Écarté** : protéger une route `/admin` du site public (impossible par chemin sur `workers.dev`
  sans domaine personnalisé) ; protéger le Worker de l'API publique (le site ne pourrait plus lire
  les prix ni les compteurs).

## 2. Vérification côté serveur

- **Décision** : l'API d'administration vérifie elle-même le jeton `Cf-Access-Jwt-Assertion` avec la
  bibliothèque `jose` (émetteur `TEAM_DOMAIN`, audience `POLICY_AUD`, clés publiques de
  `TEAM_DOMAIN/cdn-cgi/access/certs`), puis exige que l'adresse du jeton soit `OWNER_EMAIL`. Tout
  manque de configuration refuse la requête (403).
- **Justification** : c'est la vérification recommandée par Cloudflare en complément d'Access
  (défense en profondeur si Access était désactivé par erreur). `ctx.access` n'est pas utilisable ici :
  un Worker qui sert des fichiers statiques ne le reçoit pas (documentation Cloudflare,
  « ctx.access limitations »).
- `OWNER_EMAIL` est un secret Cloudflare (adresse personnelle, jamais dans le dépôt, principe V) ;
  `TEAM_DOMAIN` et `POLICY_AUD` sont des variables non sensibles.
- **Dépendance** : `jose` (6.x), bibliothèque de référence citée par la documentation Cloudflare,
  utilisée seulement par le Worker d'administration.

## 3. Page d'administration

- **Décision** : une seconde entrée Vite (`admin/index.html`, `admin/main.tsx`) construite dans
  `dist-admin/`, qui réutilise les styles, composants et services de l'application ; servie par le
  Worker d'administration en fichiers statiques, avec `run_worker_first = ["/api/*"]` pour l'API.
- **Justification** : même apparence que le site, sans dupliquer le code ; l'API est sur la même
  origine que la page, donc le cookie de session Access s'applique sans configuration CORS.

## 4. Stockage des compteurs

- **Décision** : table D1 `player_counters` dans la base existante, migration
  `worker/migrations/0004_add_player_counters.sql` qui crée la table et y insère les deux compteurs
  actuels. Lecture publique `GET /player-counters` sur le Worker des prix communautaires ; écriture
  uniquement par le Worker d'administration (même base liée).
- **Justification** : base et Worker public déjà en place ; un seul endroit de vérité (FR-001).

## 5. Portraits de classe

- **Décision** : extraire `Head_{classe}{0|1}` (homme 0, femme 1) des 19 classes du paquet
  `class_assets_.bundle` (même méthode que specs/013) vers `public/class-heads/`. Liste des classes
  (identifiant et nom, DofusDB `/breeds`) dans `src/domain/breeds.ts`. Un compteur stocke
  l'identifiant de classe et le sexe ; le portrait en découle.
- Classes : 1 Féca, 2 Osamodas, 3 Enutrof, 4 Sram, 5 Xélor, 6 Ecaflip, 7 Eniripsa, 8 Iop, 9 Crâ,
  10 Sadida, 11 Sacrieur, 12 Pandawa, 13 Roublard, 14 Zobal, 15 Steamer, 16 Eliotrope,
  17 Huppermage, 18 Ouginak, 20 Forgelance.

## 6. Objet visé

- **Décision** : recherche par nom dans tout le catalogue DofusDB (`/items?name.fr[$regex]=…`, via
  le client DofusDB existant) ; le compteur stocke l'identifiant, le nom et l'URL de l'icône DofusDB.
  Les deux compteurs actuels passent aux icônes DofusDB (50733 et 1235) ; les copies locales de
  specs/013 sont retirées.

## 7. Affichage côté joueurs

- **Décision** : `PlayerCounters` lit `GET /player-counters` au chargement, garde la dernière liste
  en `localStorage` et l'affiche si le service est injoignable ; sans liste connue, aucune bulle
  (FR-004, jamais de compteur inventé).
