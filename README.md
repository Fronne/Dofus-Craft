# 🎮 Dofus Craft - Profit Comparison Tool

Une application web conçue pour les joueurs de Dofus qui veulent optimiser la rentabilité de leurs crafts. Comparez le coût de fabrication d'un objet à son prix à l'hôtel des ventes et décidez rapidement s'il est plus intéressant de fabriquer ou d'acheter.

**Public**: petit groupe fermé de joueurs  
**Version**: 0.1.0  
**Type**: React + TypeScript + Vite

---

## 🎯 Fonctionnalités principales

### 1. **Comparaison de Rentabilité** (Comparaison)
- Recherchez un objet Dofus dans le catalogue complet
- Consultez la recette de fabrication avec les ingrédients requis
- Saisissez les prix de vos ressources et le prix actuel à l'HDV
- Obtenez instantanément le coût de craft et la recommandation (Fabriquer vs Acheter)
- Visualisez l'économie réalisée en kamas et en pourcentage

### 2. **Catalogue Intelligent** (Recherche)
- Parcourez tous les objets Dofus par catégorie (amulettes, anneaux, capes, armes, etc.)
- Recherche rapide par nom d'objet avec filtres par catégorie
- Affichage des visuels des objets quand disponibles
- État explicite pour les objets sans recette

### 3. **Mémorisation des Prix** (Épinglees)
- Vos prix de ressources sont automatiquement mémorisés
- Retrouvez les mêmes prix quand vous consultez d'autres recettes
- Consultez vos objets épinglés et leurs prix serveur actuels
- Historique des prix avec dates de dernière mise à jour

### 4. **Partage Communautaire** (Community Prices)
- En Mode communautaire, les prix saisis sont partagés automatiquement et anonymement
- Chaque ressource est pré-remplie avec le prix médian du groupe (une contribution par appareil)
- « Dernière mise à jour » indique la date de la dernière contribution retenue
- Le Mode personnel ne partage rien : les prix restent sur l'appareil

### 5. **Multi-serveur**
- Basculez entre les différents serveurs Dofus
- Les prix et préférences sont isolés par serveur
- Paramétrage du serveur actif au premier lancement

---

## 🏗️ Architecture

### Structure du Projet

```
dofus-craft/
├── src/
│   ├── app/                 # Configuration de l'app React + contextes globaux
│   ├── components/          # Composants réutilisables (Icon, CategoryIcon, etc.)
│   ├── data/                # Accès aux données (catalogue, repositories)
│   ├── domain/              # Logique métier (types, calculs)
│   ├── features/            # Pages et fonctionnalités principales
│   │   ├── catalogue/       # Recherche et filtrage d'objets
│   │   ├── comparison/      # Écran de comparaison de rentabilité
│   │   ├── prices/          # Gestion des prix personnels
│   │   ├── home/            # Accueil
│   │   └── server/          # Sélection et gestion des serveurs
│   ├── persistence/         # Stockage IndexedDB et localStorage
│   ├── services/            # APIs externes (DofusDB, Community prices)
│   └── styles/              # CSS global et thème
├── tests/
│   ├── unit/                # Tests unitaires
│   ├── integration/         # Tests d'intégration
│   └── e2e/                 # Tests Playwright
├── worker/                  # Cloudflare Workers (backend communautaire)
├── specs/                   # Spécifications Speckit (design & architecture)
└── public/                  # Assets statiques (icônes)
```

### Technologies Clés

- **Frontend**: React 19 + React Router 7
- **Langage**: TypeScript 5.7
- **Build**: Vite 5
- **Testing**: Vitest + Playwright
- **Storage**: IndexedDB (données locales) + LocalStorage (prefs)
- **Backend**: Cloudflare Workers + D1 Database (prix communautaires)
- **Data source**: DofusDB API (catalogue Dofus)

---

## 🚀 Démarrage

### Installation

```bash
# Installer les dépendances
npm install

# (Optionnel) Installer les dépendances de la worker
cd worker && npm install && cd ..
```

### Développement

```bash
# Démarrer le serveur dev Vite
npm run dev

# L'app est disponible à http://localhost:5173
```

Le serveur de dev lit `.env.local`, qui pointe vers le Worker de **production** : les prix
communautaires affichés et les contributions envoyées en dev sont réels. Seul le comptage des
visites est coupé en dev. Pour travailler sur une base locale, lancer `npm run worker:dev` et faire
pointer `VITE_COMMUNITY_API_URL` vers l'URL qu'il affiche.

### Build & Déploiement

```bash
# Vérifier les types TypeScript
npm run typecheck

# Linter et formater
npm run lint
npm run format

# Build production
npm run build

# Déployer le front (Cloudflare Workers, assets statiques de dist/)
npx wrangler deploy

# Déployer le Worker des prix communautaires
npm run worker:deploy
```

---

## 🧪 Tests

```bash
# Tests unitaires + intégration
npm run test

# Tests e2e (Playwright) : serveur dédié sur le port 5174, API communautaire coupée
npm run test:e2e

# Voir les résultats
npx playwright show-report
```

---

## 📊 Flux de Données

### Catalogue (Global)
```
DofusDB API → Catalogue Cache (IndexedDB) → Recherche & Détails
```

### Prices (Par Serveur)
```
Utilisateur → IndexedDB (prices) + LocalStorage (server) → Comparaison
             ↓
        Community API (Cloudflare Worker) ← Contributions utilisateur
```

### Persistance
- **Catalogues & Items**: IndexedDB (`catalogue-db` + `pinned-items-db`)
- **Serveur actif & Prefs**: LocalStorage (`server-preference`, `community-consent`)
- **Prix personnels & communautaires**: IndexedDB + API distante

---

## 🔄 Flux Utilisateur

### Scénario 1 : Comparer un craft
1. ✅ Utilisateur lance l'app → sélectionne son serveur
2. ✅ Va à **Recherche** → cherche son objet (ex: "Amulette du Tyran")
3. ✅ Sélectionne l'objet → affichage de la recette
4. ✅ Saisit les prix de ressources (mémorisés si déjà entrés)
5. ✅ Saisit le prix HDV observé
6. ✅ Voit instantanément : coût de craft, différence, recommandation
7. ✅ Peut épingler l'objet pour suivi rapide

### Scénario 2 : Consulter les prix communautaires
1. ✅ Utilisateur va à **Paramètres** → accepte le partage communautaire (optionnel)
2. ✅ À la comparaison, les prix communautaires comblent les prix manquants
3. ✅ Les prix perso ont toujours priorité sur les prix communautaires
4. ✅ Peut partager ses prix via le bouton "Partager les prix"

### Scénario 3 : Changer de serveur
1. ✅ Utilisateur clique sur le nom du serveur (en haut)
2. ✅ Sélectionne un autre serveur Dofus
3. ✅ Les prix sont réinitialisés (isolation par serveur)
4. ✅ Retour au catalogue avec le nouveau serveur

---

## 📈 États et Recommandations

Quand l'utilisateur saisit des prix, l'app affiche une recommandation:

| État | Affichage |
|------|-----------|
| **Craft plus rentable** | ✅ "Fabriquer" en vert + économie en kamas/% |
| **Achat plus rentable** | ❌ "Acheter" en rouge + économie en kamas/% |
| **Égalité** | ⚠️ "Aucune différence" en gris |
| **Prix manquants** | 🔄 "En attente..." + indication des champs vides |

---

## 🗄️ Base de Données DofusDB

L'app récupère le catalogue complet depuis [DofusDB API](https://dofusdb.fr/api):
- Tous les objets Dofus (items, équipements, etc.)
- Recettes de fabrication associées
- Visuels et métadonnées

**Note**: Ces données changent très rarement (nouv. items/balance ~1x/patch), d'où un cache agressif.

---

## 👥 Community Pricing (Backend)

### Architecture
- **Worker**: Cloudflare Workers (edge computing, basse latence)
- **DB**: D1 Database (SQLite sur Cloudflare)
- **Schéma**: Table `contributions` + calcul médiane temps réel

### Flux
1. En Mode communautaire, chaque prix saisi est envoyé automatiquement
2. Worker reçoit et valide les contributions
3. Calcul de la médiane par (serveur, item_id, ressource_id)
4. Frontend récupère les prix médians via API REST

### Confidentialité
- Aucun lien entre contributeur et joueur : seul un identifiant d'appareil aléatoire est stocké
- Rien n'est envoyé en Mode personnel
- Contributions limitées à 60 par minute et par IP (IP jamais stockée), montant plafonné à 2 milliards

---

## 🛠️ Administration des compteurs (specs/014-admin-counters)

Les bulles de compteurs (en bas à droite du site) se gèrent depuis une page d'administration
séparée, servie par le Worker `dofus-craft-admin` (`admin/` pour la page, `admin-worker/` pour le
Worker). Le site public n'y fait aucun lien : gardez son adresse en favori.

- **Protection** : Cloudflare Access protège tout le Worker (connexion par code reçu par e-mail,
  seule l'adresse du propriétaire est autorisée). L'API revérifie en plus le jeton Access et
  l'adresse à chaque appel ; tant que la configuration est incomplète, elle refuse tout.
- **Mise en place** (une fois, dans cet ordre) :
  1. `npm run worker:db:migrate-player-counters` puis `npm run worker:deploy` ;
  2. `npm run admin:build && npm run admin:deploy` ;
  3. tableau de bord Cloudflare → Workers & Pages → `dofus-craft-admin` → **Access** →
     « Protect this Worker behind Access », production, autoriser votre adresse e-mail ; dans
     Zero Trust → Access → Applications, régler la durée de session (1 mois) et noter l'**AUD tag**
     et le **domaine d'équipe** ;
  4. renseigner `TEAM_DOMAIN` et `POLICY_AUD` dans `admin-worker/wrangler.toml`, puis
     `npx wrangler secret put OWNER_EMAIL --config admin-worker/wrangler.toml` et
     `npm run admin:deploy` ;
  5. `npm run build && npx wrangler deploy` (site public).
- **Développement** : `npm run admin:dev` (page seule, API à simuler).

## 🔐 Sécurité & Confidentialité

✅ **Données locales**: Tout est stocké localement (IndexedDB)  
✅ **Partage choisi**: le partage n'a lieu qu'en Mode communautaire, choisi dans Paramètres  
✅ **Comptage anonyme**: une visite par appareil et par jour, sans donnée identifiante  
✅ **Pas de compte**: Aucune authentification requise  
✅ **HTTPS**: Worker Cloudflare sécurisé par défaut  

---

## 📱 Responsivité

L'app est conçue **mobile-first** et fonctionne sur :
- ✅ Desktop (> 1200px)
- ✅ Tablette (768px - 1199px)
- ✅ Mobile (< 768px)

Tous les champs, boutons et résultats restent accessibles sans scroll horizontal.

---

## 🎨 Thème et Couleurs

L'app applique un thème inspiré du jeu Dofus avec une palette adaptée à la lisibilité web :
- Couleurs d'accent par rareté d'équipement (commun, rare, rare, épique, légendaire)
- Icônes de catégories et caractéristiques tirées du jeu
- Support du dark mode (suit la préférence système)

---

## 🐛 Signaler un Bug / Proposer une Amélioration

Le projet utilise **Speckit** pour gérer les specs et tâches:
- Nouvelles features → spec → plan → tasks → implémentation
- Voir `.specify/` et `specs/` pour les détails

---

## 📋 Roadmap Envisagée

- [ ] Multi-language (i18n) pour anglais/autres serveurs Dofus
- [ ] Export/import de prices (CSV, JSON)
- [ ] Stats personnelles (objets crafted, profit total, etc.)
- [ ] Notifications (prix du marché change, nouvelle recette découverte)
- [ ] Intégration lecteur DofusDB pour customs items (rares, événementiels)

---

## 📄 Licence

Propriétaire - Projet personnel  
**Note**: Ce projet n'est pas affilié à Dofus ou Ankama Games.

---

## 🙏 Remerciements

- 🎮 **Dofus**: Jeu et univers de référence
- 📦 **DofusDB**: Source de données sur les objets et recettes
- ☁️ **Cloudflare**: Infrastructure Worker + D1 Database

---

## 📞 Contact

Pour questions ou suggestions, contactez via GitHub Issues.

---

**Happy Crafting!** 🛠️✨
