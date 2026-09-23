# Recherche : Onboarding de la page Recherche

## 1. Bibliothèque de visite guidée ou composant maison

- **Décision** : composant maison `GuidedTour`, sans nouvelle dépendance.
- **Justification** : le projet n'a que React, React DOM et React Router en dépendances de production
  (principe IV de la constitution : pas de dépendance sans besoin démontré). Six étapes linéaires,
  sans branchement, tiennent dans un petit composant.
- **Alternatives écartées** : `react-joyride`, `driver.js`, `shepherd.js`. Elles apportent thèmes,
  positionnement avancé et API riche dont on n'a pas besoin, et un style à réaligner sur l'app.

## 2. Superposition, focus et touche Échap

- **Décision** : l'onboarding est un `<dialog>` natif ouvert avec `showModal()`, plein écran et
  transparent, comme `OutlierConfirmDialog` (specs/007).
- **Justification** : `showModal()` bloque les clics sur la page (FR-009 : rien ne peut être modifié
  pendant la visite), piège le focus dans la bulle et déclenche l'événement `cancel` sur Échap
  (FR-005, FR-011). Le polyfill jsdom existe déjà dans `src/test/setup.ts`.
- **Alternatives écartées** : un `div` en `position: fixed` avec gestion manuelle du focus et
  d'Échap, plus de code pour le même résultat.

## 3. Mise en surbrillance d'une zone

- **Décision** : un élément « découpe » en `position: fixed` placé sur le rectangle de la cible
  (`getBoundingClientRect()` + marge de 8 px), avec un `box-shadow: 0 0 0 100vmax` semi-opaque qui
  assombrit tout le reste. La bulle se place sous la cible, ou au-dessus si la place manque. Sur un
  écran étroit (< 640 px), la bulle est ancrée en bas de l'écran sur toute la largeur moins 16 px de
  chaque côté.
- **Justification** : une seule règle CSS, pas de SVG ni de calcul de masque. La cible est amenée à
  l'écran avec `scrollIntoView({ block: 'center' })` à chaque changement d'étape, et la position est
  recalculée sur `resize` et `scroll`.
- **Alternatives écartées** : masque SVG avec trou (plus de code), `z-index` relevé sur la cible
  (casse avec les contextes d'empilement et ne passe pas au-dessus du `<dialog>` en top layer).

## 4. Désignation des zones ciblées

- **Décision** : attribut `data-tour="<id>"` ajouté sur les éléments existants de la page ; la visite
  résout la cible avec `document.querySelector('[data-tour="<id>"]')` au moment d'afficher l'étape.
- **Justification** : pas de refs à faire remonter à travers `ItemSearch`, `ItemDetail`, etc. ;
  un élément absent (aucun objet sélectionné) donne simplement `null`, ce qui déclenche la bulle
  centrée de FR-008.
- **Alternatives écartées** : refs React passées aux composants enfants (modifie plusieurs
  signatures pour un besoin purement visuel).

## 5. Mémorisation « onboarding vu »

- **Décision** : clé `localStorage` `craftcheck-search-tour-seen` = `"1"`, lue et écrite dans
  `try/catch`, sur le modèle de `price-mode-preference.ts`.
- **Justification** : FR-010 (rien envoyé au serveur), cohérent avec les autres préférences
  (`craftcheck-theme`, `craftcheck-price-mode`). Stockage indisponible : lecture = « pas vu »,
  écriture ignorée, donc la visite peut réapparaître mais reste fermable (cas limite de la spec).
- **Quand l'écrire** : à la fin de la visite (« Terminer »), sur « Passer », sur Échap. Pas quand le
  joueur quitte la page Recherche pendant la visite : ce n'est pas une fermeture volontaire, la
  visite se relancera à la prochaine visite de la page.

## 6. Étape « mode de prix »

- **Décision** : pas de cible, bulle centrée. Le texte indique le mode actif (`priceMode`, déjà
  transmis à `RecherchePage`) et renvoie vers la page Paramètres pour le changer.
- **Justification** : le choix du mode vit dans Paramètres, pas sur la page Recherche. Mettre en
  surbrillance le lien de navigation « Paramètres » ne marche pas sur tous les écrans (la barre de
  navigation change de forme sur mobile).

## 7. Démarrage automatique

- **Décision** : au montage de `RecherchePage`, si la visite n'a pas été vue, elle démarre après le
  premier rendu. `RecherchePage` n'est rendue qu'une fois un serveur choisi (`App.tsx` affiche
  `ServerOnboarding` avant), donc les deux onboardings ne se superposent jamais.
- La visite ne dépend pas du chargement du catalogue : l'étape 1 cible le formulaire de recherche,
  toujours présent.
