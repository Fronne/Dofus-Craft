# Quickstart: Validation de la gestion multi-serveurs des prix

## Prérequis

- Node.js 24 LTS et npm disponibles.
- Un navigateur moderne avec IndexedDB et `localStorage` activés (pas de navigation privée pour
  les parcours de persistance).
- Au moins deux serveurs distincts disponibles dans la liste prédéfinie, et une recette avec au
  moins une ressource, pour exécuter les parcours ci-dessous.

## Démarrage attendu après implémentation

```bash
npm install
npm run dev
```

Ouvrir l'URL locale fournie par le serveur de développement dans une fenêtre de navigation
normale (pas privée), pour que `localStorage` et IndexedDB persistent entre rechargements.

## Contrôles automatisés attendus

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Ces commandes doivent couvrir les règles de [data-model.md](./data-model.md) et les interactions
exposées dans [contracts/server-scoped-storage.md](./contracts/server-scoped-storage.md), en plus
du contrat existant de la fonctionnalité 001.

## Parcours de validation

### 1. Choix du serveur à la première visite (US1)

1. Vider `localStorage` et les bases IndexedDB du site (ou ouvrir un profil navigateur neuf).
2. Charger l'application.
3. Vérifier qu'un sélecteur de serveur s'affiche et qu'aucune autre fonctionnalité (recherche,
   comparaison) n'est accessible.
4. Choisir un serveur dans la liste.

**Résultat attendu**: le sélecteur disparaît, le nom du serveur choisi est visible en permanence,
et le reste de l'application devient utilisable.

5. Recharger la page.

**Résultat attendu**: le sélecteur de première visite ne réapparaît pas ; le même serveur reste
actif.

### 2. Isolation des prix de ressources entre serveurs (US2)

1. Sur le serveur A, rechercher une recette et saisir un prix pour chaque ressource.
2. Changer pour le serveur B via le sélecteur de changement de serveur.
3. Vérifier que les champs de prix de cette même recette sont vides (aucune valeur du serveur A
   n'apparaît).
4. Saisir des prix différents pour cette recette sur le serveur B.
5. Revenir sur le serveur A.

**Résultat attendu**: les prix affichés sur A sont exactement ceux saisis à l'étape 1, inchangés
par la saisie faite sur B.

6. Recharger la page alors que le serveur A est actif.

**Résultat attendu**: le serveur A reste actif et ses prix de ressources sont restitués à
l'identique.

### 3. Item épinglé suivi sur plusieurs serveurs (US3)

1. Sur le serveur Mikhal, épingler un item et saisir un prix de marché de 500 000 kamas.
2. Changer pour le serveur Dakal.

**Résultat attendu**: l'item reste présent dans la liste des items épinglés ; son champ de prix
de marché est vide (aucun prix encore saisi sur Dakal).

3. Saisir un prix de marché de 750 000 kamas pour cet item sur Dakal.
4. Revenir sur Mikhal.

**Résultat attendu**: le prix affiché redevient 500 000 kamas ; la liste des items épinglés est
identique à celle vue sur Dakal (mêmes items).

5. Désépingler l'item depuis n'importe quel serveur, puis vérifier sur l'autre serveur.

**Résultat attendu**: l'item n'apparaît plus dans la liste des items épinglés d'aucun serveur.

6. Recharger la page.

**Résultat attendu**: la liste des items épinglés et les prix de marché par serveur précédemment
saisis sont restitués à l'identique.

### 4. Ajout d'un nouveau serveur sans impact sur l'existant

1. Avec des prix déjà enregistrés sur plusieurs serveurs existants, ajouter un nouveau serveur à
   la liste prédéfinie (changement de code/configuration, hors interface joueur).
2. Recharger l'application.

**Résultat attendu**: les serveurs existants et leurs prix restent inchangés ; le nouveau serveur
est sélectionnable et démarre sans aucun prix pré-rempli.

### 5. Migration des anciennes données (utilisateur déjà présent avant la fonctionnalité)

1. Simuler un état antérieur : un item épinglé possédant un prix de marché enregistré selon
   l'ancien format (non rattaché à un serveur).
2. Charger l'application mise à jour et choisir un serveur.

**Résultat attendu**: une notification informe le joueur que son ancien prix de marché a été
abandonné et doit être ressaisi ; l'item reste épinglé, mais son champ de prix de marché est vide
sur tous les serveurs.
