# Dofus Craft

Application web pour savoir, sur Dofus, s'il vaut mieux **fabriquer un objet ou l'acheter à l'hôtel
des ventes**. On choisit un objet, on renseigne le prix de ses ressources et son prix HDV : l'app
calcule le coût de craft et donne la réponse.

Elle est faite pour un petit groupe fermé de joueurs, qui partagent leurs prix entre eux.

**👉 [Ouvrir le site](https://dofus-craft.dofus-craft.workers.dev)**

> Projet personnel, non affilié à Ankama Games. Données d'objets : [DofusDB](https://dofusdb.fr).

## Fonctionnalités

- **Comparaison craft / achat** : recette de l'objet, coût total des ressources, prix HDV,
  différence en kamas et en pourcentage, recommandation « Fabriquer » ou « Acheter ».
- **Ressources intermédiaires** : un ingrédient qui se crafte lui-même (planche, alliage…) est
  compté au moins cher entre son prix d'achat et le coût de sa recette, sur toute la chaîne ; sa
  recette se déplie sur la fiche, et on peut forcer « acheter » ou « crafter ».
- **Recherche dans tout le catalogue** : par nom et par catégorie, avec les fiches d'objets et
  d'armes présentées comme dans le jeu. Le catalogue est gardé sur l'appareil, donc la page
  s'affiche instantanément aux visites suivantes.
- **Prix mémorisés par serveur** : un prix de ressource saisi une fois se retrouve dans toutes les
  recettes qui l'utilisent. Chaque serveur Dofus a ses propres prix.
- **Deux modes de prix** :
  - *Mode communautaire* (par défaut) : les prix saisis sont partagés anonymement avec le groupe.
    Chaque ressource affiche le dernier prix relevé par le groupe, avec sa date ; il remplace le prix
    gardé sur l'appareil dès qu'il est plus récent, sur toutes les pages. Une valeur très éloignée
    des relevés du groupe (plus de 25 % de leur médiane, qui n'est pas affichée) demande
    confirmation avant d'être enregistrée. Le prix HDV d'un objet est lui aussi partagé : c'est le
    dernier prix relevé par le groupe, avec sa date, et un prix très différent du dernier demande
    confirmation.
  - *Mode personnel* : les prix restent sur l'appareil, rien n'est envoyé.
- **Prix périmés signalés** : les ressources dont le prix date trop sont mises en évidence.
- **Page Prix** : les objets du serveur dont le prix HDV et le coût de craft sont connus, avec le
  bénéfice en kamas et en % si on les crafte, triés par bénéfice ou par marge.
- **Objets suivis** : suivre des objets et les ranger en listes.
- **Bandeau d'information** : un message (Info ou Important, avec une date de fin facultative)
  publié depuis la page d'administration, affiché en haut du site ; chaque joueur peut le fermer.
- **Page HDV** : relever les prix d'un hôtel des ventes en un seul passage, un onglet par HDV
  (Ressources, Consommables, Créatures, Runes), avec recherche, filtres et compteur de prix connus.
  L'onglet Runes filtre par stat et indique l'origine du dernier prix partagé (« Bot Discord »,
  « Capture », « Saisie manuelle »).
- **Page Forgemagie** : réservée aux membres du serveur Discord du groupe, qui s'y connectent avec
  leur compte Discord (le reste du site reste sans compte).
  - Les **sessions FM** du bot Discord du groupe y sont gardées : total, dépense de chaque joueur, et
    détail des runes achetées avec leur prix moyen, les mêmes chiffres que le résumé du bot. Le détail
    d'une session liste aussi chacune de ses **captures** lues (dans Discord ou sur le site), avec son
    auteur, son montant et le récap de ses runes.
  - Chaque joueur a ses **salons FM personnels**, créés par le bot (bouton « Nouvelle séance de FM » dans
    Discord, ou « Démarrer une séance » sur le site) : visibles par lui seul, 5 actifs au plus,
    archivés avec `/fmarchive`. Un salon peut être rattaché à un objet en FM : toutes ses sessions
    comptent alors pour cet objet.
  - On peut **démarrer et arrêter une session depuis le site**, dans un de ses salons : le bot l'ouvre
    ou la ferme aussi dans Discord en quelques secondes, et les captures collées sur le site peuvent y
    être ajoutées.
  - Chaque joueur déclare ses **objets en FM** (par exemple son Anneau Rtograf) et y rattache les
    sessions où il a dépensé : le **récap** d'un objet donne le total dépensé, ses sessions et le détail
    des runes. Une session se rattache en tapant le nom de l'objet dans son détail : un de ses objets
    en FM, ou un équipement du catalogue, qui crée alors l'objet.
  - Chaque joueur a un **profil** avec ses dépenses. Il est public par défaut ; un profil privé
    n'est visible que par son propriétaire, et son nom est masqué dans les sessions.
  - Les achats envoyés par le bot alimentent le **prix des runes**, affiché dans l'onglet Runes de la
    page HDV. Un prix trop éloigné des relevés du groupe compte dans les dépenses, mais pas dans les
    prix.
  - On peut aussi **coller une capture du chat** dans son Profil : elle est lue sur l'appareil (jamais
    envoyée), et les lignes lues sont vérifiées et corrigées avant d'être enregistrées.
- **Compteurs de joueurs** : des bulles humoristiques en haut à droite (« 150+ donjons sans
  drop »…), gérées depuis une page d'administration privée.
- **Personnalisation** : thème clair ou sombre, couleur d'accent, design « Nouveau » (par défaut),
  « Classique » ou « Cosmos » (inspiré de l'interface de Dofus 3).
- **Visite guidée** de la page Recherche à la première visite, et affichage adapté au mobile.

## Architecture

| Partie | Dossier | Rôle |
|---|---|---|
| Site | `src/` | React 19, TypeScript, Vite. Servi par le Worker Cloudflare `dofus-craft` (fichiers statiques de `dist/`). |
| API communautaire | `worker/` | Worker `dofus-craft-community-price-api` + base Cloudflare D1 : prix partagés, médianes, compteurs de joueurs (lecture), comptage anonyme des visites, et la page Forgemagie (connexion Discord, sessions du bot, profils — `worker/src/fm/`). |
| Administration | `admin/`, `admin-worker/` | Page et Worker `dofus-craft-admin`, protégés par Cloudflare Access, pour gérer les compteurs de joueurs. |
| Spécifications | `specs/`, `.specify/` | Une spec Speckit par fonctionnalité (spec, plan, tâches). |
| Tests | `tests/` | Unitaires et intégration (Vitest), bout en bout (Playwright). |

Sur l'appareil, le catalogue et les prix sont dans IndexedDB, les préférences dans le localStorage.
Il n'y a pas de compte joueur, sauf la connexion Discord de la page Forgemagie.

## Démarrer

Prérequis : Node.js et npm. Pour déployer, un compte Cloudflare (`npx wrangler login`).

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé de l'API communautaire
npm run dev                  # http://localhost:5173
```

⚠️ Si `.env.local` pointe vers l'API de production, les prix communautaires affichés et envoyés en
développement sont réels. Pour travailler sur une base locale : `npm run worker:dev`, puis mettre
l'URL qu'il affiche dans `VITE_COMMUNITY_API_URL`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement du site |
| `npm run test` | Tests unitaires et d'intégration |
| `npm run test:e2e` | Tests Playwright (serveur dédié, API communautaire coupée) |
| `npm run typecheck` · `npm run lint` · `npm run format` | Types, lint, formatage |
| `npm run build` puis `npx wrangler deploy` | Construire et déployer le site |
| `npm run worker:dev` · `npm run worker:deploy` | Lancer en local / déployer l'API communautaire |
| `npm run admin:dev` · `npm run admin:build` · `npm run admin:deploy` | Page d'administration |
| `npm run worker:db:*` | Création et migrations de la base D1 (voir `package.json`) |

La mise en place initiale de l'API est décrite dans [worker/README.md](worker/README.md), celle de
l'administration (Cloudflare Access, secret `OWNER_EMAIL`) dans
[specs/014-admin-counters](specs/014-admin-counters/quickstart.md).

## Confidentialité

- Rien n'est partagé en Mode personnel.
- En Mode communautaire, seul un identifiant d'appareil aléatoire accompagne les prix : aucun lien
  avec le joueur, aucune adresse IP stockée.
- Les contributions sont limitées (60 par minute et par IP, montant plafonné) et supprimées au bout
  de 90 jours.
- Les visites sont comptées une fois par appareil et par jour, sans donnée identifiante.
- Page Forgemagie : seuls l'identifiant, le pseudo et l'avatar Discord du joueur sont gardés, avec
  son serveur et ses achats. Jamais d'e-mail. Chaque joueur peut passer son profil en privé, ou le
  supprimer avec tous ses achats. Les prix tirés des achats restent anonymes.

## Contribuer

Le projet suit le workflow **Speckit** : toute nouvelle fonctionnalité passe par une spec dans
`specs/`, puis un plan et des tâches, avant d'être codée. Les règles du projet sont dans
`.specify/memory/constitution.md`.
