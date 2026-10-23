# Guide de validation : Tableau de bord d'administration moderne et activation de toutes les pages

Contrats : [API](contracts/site-settings-api.md), [interface](contracts/admin-dashboard-ui.md). Modèle :
[data-model.md](data-model.md).

## 1. Tests automatiques

```bash
npm run typecheck
npm test
```

Attendu : les fichiers de la fonctionnalité passent (domaine des réglages à sept pages, route publique, schéma et
migration `0023`, éditeur, tableau de bord, site public). Les échecs liés à `tesseract.js` et à
`VITE_COMMUNITY_API_URL` existent sur `master` et ne concernent pas cette fonctionnalité.

## 2. Essai manuel de l'administration

```bash
npm run admin:dev
```

1. Le tableau de bord : rangée de quatre chiffres clés, quatre grandes cartes de graphiques, quatre cartes
   secondaires ; lueur et dégradés en thème sombre, version atténuée en thème clair.
2. Chaque chiffre clé mène à sa section ; « Visiteurs du jour » n'est pas un lien.
3. Couper une lecture : seule la carte concernée affiche « Indisponible ».
4. « Pages du site » : sept lignes ; désactiver une page, puis la réactiver ; désactiver toutes les pages une à
   une : la dernière demande une confirmation.
5. 375 px de large : une colonne, pas de défilement horizontal.

## 3. Essai manuel du site public

Pour chaque page désactivée : son lien a disparu, son adresse affiche « momentanément indisponible » avec un lien
vers une page active ; l'accueil mène à la première page active ; Paramètres reste accessible ; les données du
visiteur (suivis, séances, prix) sont intactes après réactivation.

## 4. Base de données (production)

La migration reconstruit `site_settings` ; elle s'applique **avant** de déployer les deux Workers :

```bash
npm run worker:db:migrate-site-pages
```

Attendu : sans erreur, rejouable ; les états `forgemagie_page` et `hdv_page` déjà enregistrés sont conservés
(`SELECT * FROM site_settings`). Ensuite seulement : déployer le Worker public, puis l'administration
(`npm run admin:deploy`).
