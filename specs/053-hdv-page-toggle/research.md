# Research: Activer ou désactiver la page HDV

## R1 — Enregistrer le réglage

- **Decision**: une clé `hdv_page` dans la table `site_settings` existante (`'1'` activée, `'0'`
  désactivée). La contrainte `CHECK (key IN ('forgemagie_page'))` interdit cette clé et SQLite ne
  sait pas modifier une contrainte : la migration 0017 crée `site_settings_new` avec
  `CHECK (key IN ('forgemagie_page', 'hdv_page'))`, y copie les lignes existantes, supprime
  l'ancienne table et renomme la nouvelle. Aucune ligne `hdv_page` n'est insérée : l'absence vaut
  « activée » (FR-002).
- **Rationale**: réutilise le mécanisme de specs/050 ; la copie conserve le réglage Forgemagie déjà
  enregistré (FR-010).
- **Alternatives considered**: retirer la contrainte (perd la protection contre une clé mal écrite) ;
  une seconde table (inutile pour une clé de plus).

## R2 — Valeur par défaut et anciens formats

- **Decision**: `DEFAULT_SITE_SETTINGS = { forgemagiePage: false, hdvPage: true }`. Une fonction
  `parseSiteSettings(value)` accepte tout objet dont `forgemagiePage` est un booléen et complète
  `hdvPage` absent par sa valeur par défaut ; elle sert au service public, au cache de l'appareil et
  à l'administration.
- **Rationale**: un appareil qui a mémorisé `{ forgemagiePage }` avant cette fonctionnalité, ou un
  Worker public déployé après le site, ne doivent pas masquer la page HDV (cas limite de la spec,
  SC-004).
- **Alternatives considered**: exiger les deux champs (l'ancien cache serait jeté et la réponse d'un
  Worker pas encore redéployé ignorée — acceptable pour la Forgemagie, mais on perdrait le dernier
  état connu sans raison).

## R3 — Écriture sans écraser l'autre réglage

- **Decision**: `PUT /api/settings` accepte un changement partiel `{ forgemagiePage?, hdvPage? }`
  (au moins un champ, chacun booléen s'il est présent) ; seules les clés envoyées sont écrites, et la
  réponse est l'objet complet relu. L'administration envoie seulement le réglage cliqué.
- **Rationale**: FR-010 ; envoyer l'objet complet tel qu'affiché pourrait réécrire un état devenu
  périmé de l'autre réglage.
- **Alternatives considered**: une route par réglage (duplique la validation et l'accès) ; envoyer
  l'objet complet (risque ci-dessus).

## R4 — Côté site

- **Decision**: `useForgemagiePageEnabled` devient `useSiteSettings`, qui renvoie
  `{ settings, reading }` (même logique : dernier état connu, puis valeur lue, mémorisée). AppShell
  filtre les liens de navigation selon les deux réglages et remplace la route `/hdv` par
  `HdvUnavailablePage` (« HDV est momentanément indisponible », lien « Aller à la recherche ») quand
  elle est désactivée ; pendant une lecture en cours d'une page connue comme désactivée, il affiche
  « Chargement… », comme pour la Forgemagie.
- **Rationale**: un seul appel réseau et un seul cache pour tous les réglages ; FR-003, FR-004, FR-009.
- **Alternatives considered**: un second hook dédié à l'HDV (deux lectures du même service).
