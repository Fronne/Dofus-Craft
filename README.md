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
  - *Mode communautaire* (par défaut) : les prix saisis sont partagés anonymement avec le groupe,
    et chaque ressource est pré-remplie avec le prix médian du groupe. Une valeur très éloignée de
    la médiane demande confirmation avant d'être enregistrée. Le prix HDV d'un objet est lui aussi
    partagé : c'est le dernier prix relevé par le groupe, avec sa date, et un prix très différent du
    dernier demande confirmation.
  - *Mode personnel* : les prix restent sur l'appareil, rien n'est envoyé.
- **Prix périmés signalés** : les ressources dont le prix date trop sont mises en évidence.
- **Page Prix** : les objets du serveur dont le prix HDV et le coût de craft sont connus, avec le
  bénéfice en kamas et en % si on les crafte, triés par bénéfice ou par marge.
- **Objets suivis** : suivre des objets et les ranger en listes.
- **Bandeau d'information** : un message (Info ou Important, avec une date de fin facultative)
  publié depuis la page d'administration, affiché en haut du site ; chaque joueur peut le fermer.
- **Compteurs de joueurs** : des bulles humoristiques en haut à droite (« 150+ donjons sans
  drop »…), gérées depuis une page d'administration privée.
- **Personnalisation** : thème clair ou sombre, couleur d'accent, design « Nouveau » (par défaut)
  ou « Classique ».
- **Visite guidée** de la page Recherche à la première visite, et affichage adapté au mobile.

## Architecture

| Partie | Dossier | Rôle |
|---|---|---|
| Site | `src/` | React 19, TypeScript, Vite. Servi par le Worker Cloudflare `dofus-craft` (fichiers statiques de `dist/`). |
| API communautaire | `worker/` | Worker `dofus-craft-community-price-api` + base Cloudflare D1 : prix partagés, médianes, compteurs de joueurs (lecture), comptage anonyme des visites. |
| Administration | `admin/`, `admin-worker/` | Page et Worker `dofus-craft-admin`, protégés par Cloudflare Access, pour gérer les compteurs de joueurs. |
| Spécifications | `specs/`, `.specify/` | Une spec Speckit par fonctionnalité (spec, plan, tâches). |
| Tests | `tests/` | Unitaires et intégration (Vitest), bout en bout (Playwright). |

Sur l'appareil, le catalogue et les prix sont dans IndexedDB, les préférences dans le localStorage.
Il n'y a pas de compte joueur.

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

## Contribuer

Le projet suit le workflow **Speckit** : toute nouvelle fonctionnalité passe par une spec dans
`specs/`, puis un plan et des tâches, avant d'être codée. Les règles du projet sont dans
`.specify/memory/constitution.md`.
