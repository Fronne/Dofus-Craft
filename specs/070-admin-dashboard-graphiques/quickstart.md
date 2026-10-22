# Guide de validation : Graphiques sur le tableau de bord de l'administration

Contrats : [API](contracts/admin-dashboard-api.md), [interface](contracts/admin-dashboard-ui.md).
Modèle : [data-model.md](data-model.md).

## Prérequis

- `npm install` fait ; la base D1 locale initialisée (`npm run worker:db:init`) pour l'essai manuel.
- Pour l'étape 1 et la validation réelle de Cloudflare : `CLOUDFLARE_API_TOKEN` et
  `CLOUDFLARE_ACCOUNT_ID` configurés (jeton lisant les statistiques du compte).

## 1. Lever l'inconnue Cloudflare (avant d'écrire la requête)

Vérifier que le jeu D1 accepte une dimension horaire : interroger le schéma GraphQL de Cloudflare
(introspection du type de `d1AnalyticsAdaptiveGroups`, ou le terrain de jeu GraphQL du tableau de bord
Cloudflare) et confirmer la présence de `datetimeHour` dans ses dimensions.

- Présente : poursuivre avec la requête de [research.md](research.md) R1.
- Absente : prendre `datetimeFiveMinutes` ou `datetime` et regrouper par heure dans le code ; noter le
  choix dans research R1.
- Aucune : la courbe répondra « indisponible » et la carte gardera son pourcentage ; le signaler au
  propriétaire.

## 2. Tests automatiques

```bash
npm run typecheck
npm run lint
npm test
```

Attendu : tout passe, dont les nouveaux fichiers de tests :
- `cloudflare-usage-today` : heures manquantes à 0, cumul, pourcentage non plafonné (112 %), franchissements
  à 80 % / 100 %, minuit (journée vide), réponses `not-configured` / `denied` / `unavailable`.
- `admin-sniffer-contributions` : total et répartition, clé à 0, clé révoquée comptée et signalée, mois
  vide, mois passé, mois invalide ou futur refusé, aucun champ secret dans la sortie.
- `admin-activity` : 30 jours complétés à 0, ventilation par origine, aucun identifiant d'appareil en sortie.
- `admin-dashboard-insights` : ancienneté d'une correspondance (29 / 30 / 31 jours), clés jamais utilisée /
  endormie / récente, tri des compteurs, temps restant du bandeau (sans fin, expiré, heures, jours).
- `admin-dashboard` (intégration) : chaque carte garde son résumé ; visuel « indisponible » sans bloquer
  les autres ; tableaux de valeurs présents ; carte « Pages du site » sans visuel ; les deux cartes
  nouvelles ne sont pas des liens.

## 3. Essai manuel

```bash
npm run admin:dev
```

Ouvrir la page d'administration et vérifier :

1. Carte Cloudflare : courbe de 00:00 UTC à l'heure actuelle ; le dernier point est « partiel » ; le
   pourcentage de la carte égale le dernier point ; ouvrir le tableau de valeurs au clavier.
2. Carte Clés : total du mois = somme des lignes par clé ; changer de mois met tout à jour sans recharger ;
   une clé révoquée avec des lignes est comptée et signalée ; une clé sans envoi est « jamais utilisée ».
3. Cartes Prix communautaires et Visites : 30 colonnes, aujourd'hui à droite ; totaux égaux au tableau.
4. Couper le réseau vers une route (ou retirer le jeton Cloudflare) : seule la carte concernée affiche
   « Indisponible » ; les autres restent affichées et les liens fonctionnent.
5. Téléphone (largeur 375 px) : pas de défilement horizontal de la page ; thème sombre lisible.
6. Sections : ouvrir chacune et vérifier qu'elles fonctionnent comme avant (non-régression, spec 068).

## 4. Base de données

La migration d'index suit la convention du projet (un script npm par migration, avec `--remote` : elle
s'applique directement à la base de production, donc après relecture du fichier) :

```bash
npm run worker:db:migrate-dashboard-indexes
```

Attendu : exécution sans erreur, rejouable (`CREATE INDEX IF NOT EXISTS`). Contrôler ensuite dans le
tableau de bord Cloudflare que la consommation de lectures D1 ne bondit pas après l'ouverture de la page.
