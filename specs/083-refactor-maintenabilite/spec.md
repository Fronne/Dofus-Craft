# Spécification : Code du site facilement maintenable

**Branche** : `083-refactor-maintenabilite`

**Créée le** : 2026-11-02

**Statut** : Brouillon

**Demande** : « Fais les modifications nécessaires pour que le code du site soit facilement maintenable » (périmètre choisi : tout le code du site — interface, domaine, données, worker, outillage).

## Scénarios utilisateur et tests *(obligatoire)*

Ici, « l'utilisateur » est la personne qui fait évoluer le site (le mainteneur). Les visiteurs du site ne doivent rien remarquer.

### Histoire 1 — Aucune régression visible (Priorité : P1)

Après le chantier, le site se comporte et s'affiche exactement comme avant : mêmes pages, mêmes calculs, mêmes prix, mêmes réponses du serveur communautaire.

**Pourquoi cette priorité** : un refactoring qui casse le site n'a aucune valeur. C'est la condition de toutes les autres histoires.

**Test indépendant** : lancer toute la suite de tests existante (unitaires, intégration, e2e) et comparer visuellement les pages principales avant/après.

**Scénarios d'acceptation** :

1. **Étant donné** la suite de tests actuelle, **quand** elle est lancée après chaque étape du chantier, **alors** tous les tests passent sans modification de leurs résultats attendus.
2. **Étant donné** une page du site (Brisage, Recherche, Épingles, Familier, Forgemagie, Prix…), **quand** on la compare à la version d'avant, **alors** son rendu, son thème et ses calculs sont identiques.

---

### Histoire 2 — Retrouver et modifier le style d'une fonctionnalité (Priorité : P2)

Le mainteneur veut changer l'apparence d'une fonctionnalité sans lire toute la feuille de style globale (aujourd'hui ~3 000 lignes dans un seul fichier).

**Pourquoi cette priorité** : c'est le plus gros fichier du dépôt et le plus risqué à modifier (effets de bord entre fonctionnalités).

**Test indépendant** : modifier un style propre à une fonctionnalité en n'ouvrant qu'un fichier de taille raisonnable, et vérifier que les autres pages ne bougent pas.

**Scénarios d'acceptation** :

1. **Étant donné** une fonctionnalité donnée, **quand** le mainteneur cherche son style, **alors** il le trouve dans un fichier dédié portant son nom.
2. **Étant donné** les styles communs (thème, mise en page, boutons), **quand** il les cherche, **alors** ils sont séparés des styles propres aux fonctionnalités.

---

### Histoire 3 — Comprendre et modifier une page sans lire des centaines de lignes (Priorité : P2)

Le mainteneur veut corriger ou étendre une page (Brisage, Recherche, Épingles, Familier, classement, coquille de l'application) en ne lisant que la partie concernée.

**Pourquoi cette priorité** : les plus gros composants dépassent 400 à 800 lignes en mêlant affichage, état et logique.

**Test indépendant** : pour chacun des composants listés, vérifier que le fichier principal est court et délègue à des parties nommées par rôle.

**Scénarios d'acceptation** :

1. **Étant donné** un gros composant de page, **quand** on l'ouvre, **alors** il reste lisible d'un coup (ordre de grandeur : moins de 250 lignes) et délègue à des sous-parties de responsabilité unique.
2. **Étant donné** une logique d'état réutilisable ou isolable, **quand** on la cherche, **alors** elle est séparée de l'affichage.

---

### Histoire 4 — Règles métier, données et serveur en modules cohérents (Priorité : P3)

Le mainteneur veut modifier une règle de calcul (brisage, forgemagie), le dépôt de données du catalogue, le client des prix communautaires ou le serveur communautaire sans naviguer dans de gros fichiers multi-sujets.

**Pourquoi cette priorité** : ces fichiers (de 300 à 500 lignes) portent des règles sensibles ; les rendre plus petits réduit le risque d'erreur, mais l'enjeu visible est plus faible que pour l'interface.

**Test indépendant** : pour chaque fichier concerné, vérifier qu'il est découpé par sujet et que ses tests existants passent inchangés.

**Scénarios d'acceptation** :

1. **Étant donné** les règles de brisage et de forgemagie, **quand** on cherche une règle précise, **alors** elle se trouve dans un module portant le nom de ce sujet.
2. **Étant donné** le serveur communautaire, **quand** on cherche le traitement d'une route ou d'une séance de forgemagie, **alors** il est dans un module dédié et non dans un fichier unique multi-sujets.

---

### Histoire 5 — Un seul gestionnaire de paquets (Priorité : P3)

Le dépôt contient deux fichiers de verrouillage de dépendances (npm et pnpm) qui peuvent diverger. Le mainteneur veut une seule source de vérité.

**Pourquoi cette priorité** : petit gain, mais supprime une confusion à chaque installation ou déploiement.

**Test indépendant** : installer les dépendances à partir de zéro avec le gestionnaire retenu, puis lancer le build et les tests.

**Scénarios d'acceptation** :

1. **Étant donné** un clone propre du dépôt, **quand** on installe les dépendances, **alors** une seule méthode est documentée et fonctionne.
2. **Étant donné** le déploiement actuel, **quand** il est lancé après le chantier, **alors** il fonctionne sans changement de comportement.

---

### Cas limites

- Un style dépendant de l'ordre de la cascade (une règle qui en écrase une autre) : l'ordre de chargement doit être conservé pour que le rendu reste identique.
- Un composant dont les tests dépendent de la structure interne : les tests peuvent être déplacés, pas leurs attentes.
- Des fichiers de données volumineux (catalogue, expérience des familiers) : ils ne sont pas découpés, ce sont des données et non du code.
- Le déploiement du site et du serveur communautaire s'appuie sur des scripts existants : leurs noms et leur usage ne doivent pas changer.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **EF-001** : Le comportement observable du site (affichage, calculs, prix, textes, thèmes) DOIT rester identique à celui d'avant le chantier.
- **EF-002** : Tous les tests existants DOIVENT passer à la fin de chaque étape, sans modifier leurs résultats attendus.
- **EF-003** : La feuille de style globale DOIT être découpée en fichiers par fonctionnalité plus un socle commun, en conservant l'ordre de cascade effectif.
- **EF-004** : Les composants de page BrisagePage, RecherchePage, EpinglesPage, FamilierPage, AppShell et RankingTab DOIVENT être scindés en sous-composants et en logique d'état isolée, chacun à responsabilité unique.
- **EF-005** : Les modules de règles (brisage, forgemagie), le dépôt de données du catalogue et le client des prix communautaires DOIVENT être découpés par sujet, sans changer leurs règles ni leurs résultats.
- **EF-006** : Le serveur communautaire (point d'entrée et séances de forgemagie) DOIT être découpé en modules par domaine, sans changer ses routes ni ses réponses.
- **EF-007** : Un seul gestionnaire de paquets DOIT rester documenté et utilisé ; le fichier de verrouillage de l'autre DOIT être supprimé, et le README et les scripts mis à jour.
- **EF-008** : Aucune dépendance, abstraction ou configuration nouvelle ne DOIT être ajoutée sans servir directement l'un des découpages ci-dessus.
- **EF-009** : Les noms de fichiers et de modules DOIVENT indiquer leur sujet en français ou en anglais de façon cohérente avec le code existant.

### Entités clés

- **Fonctionnalité** : un ensemble cohérent de pages, composants et styles (Brisage, Recherche, Épingles, Familier, Forgemagie, Prix, Compte…).
- **Socle commun** : thème, mise en page, composants partagés, utilisés par plusieurs fonctionnalités.
- **Module de règles** : calcul métier isolé de l'affichage (brisage, forgemagie).

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **CR-001** : 100 % des tests existants passent avant et après le chantier, sans résultat attendu modifié.
- **CR-002** : Aucun fichier de style ne dépasse 600 lignes (contre ~2 970 pour le plus gros aujourd'hui).
- **CR-003** : Les six composants ciblés passent chacun sous 300 lignes dans leur fichier principal (contre 331 à 839 aujourd'hui).
- **CR-004** : Aucun module de règles, de données ou de serveur ciblé ne dépasse 300 lignes (contre 324 à 509 aujourd'hui).
- **CR-005** : Le dépôt ne contient plus qu'un fichier de verrouillage de dépendances, et une installation à partir de zéro suivie du build réussit.
- **CR-006** : Un mainteneur trouve le fichier à modifier pour une fonctionnalité donnée en ouvrant un seul dossier ou fichier portant son nom.

## Hypothèses

- Le périmètre se limite à la réorganisation du code : aucune nouvelle fonctionnalité ni correction de bug fonctionnel n'est incluse.
- Le gestionnaire de paquets à conserver est celui utilisé par le déploiement actuel ; il sera confirmé pendant la planification.
- Les seuils de taille (250/300/600 lignes) sont des ordres de grandeur de lisibilité, pas des contraintes absolues si un découpage artificiel nuit à la clarté.
- Les fichiers de données volumineux (JSON du catalogue, expérience des familiers, scripts SQL de graines) ne sont pas concernés.
- Les spécifications existantes dans `specs/` restent inchangées.
