# Research: Activer ou désactiver la page Forgemagie

## R1 — Où enregistrer le réglage

- **Decision**: une table `site_settings (key, value, updated_at)` dans la base D1 existante, avec la
  seule clé `forgemagie_page` (`'1'` activée, `'0'` désactivée).
- **Rationale**: changeable sans redéploiement, lisible par le Worker public et écrit par le Worker
  d'administration qui partagent déjà cette base (specs/014, specs/020). L'absence de ligne vaut
  « désactivée » (FR-002), donc aucune donnée initiale à insérer.
- **Alternatives considered**: variable d'environnement de build (redéploiement à chaque changement) ;
  colonne ajoutée à `info_message` (mélange deux sujets) ; table dédiée à une seule ligne (une
  migration de plus au prochain réglage de site).

## R2 — Comment le site lit le réglage

- **Decision**: `GET /site-settings` sur le Worker public, sans clé, réponse non mise en cache ; le
  site lit au montage, garde le dernier état lu dans `localStorage` et l'applique tout de suite au
  chargement suivant, puis s'ajuste quand la lecture aboutit.
- **Rationale**: FR-009 (dernier état connu, sinon désactivée) et le cas limite « pas d'affichage
  par erreur pendant la lecture » : partir du dernier état connu évite un clignotement, et partir de
  « désactivée » sur un appareil neuf ne montre jamais la page à tort.
- **Alternatives considered**: bloquer l'affichage du site jusqu'à la lecture (retarde toutes les
  pages) ; ne rien mémoriser (la page disparaît à chaque panne du service).

## R3 — Ce que voit le joueur sur l'adresse de la page

- **Decision**: la route `/forgemagie` reste déclarée et affiche un état vide « Forgemagie est
  momentanément indisponible » avec un lien vers la Recherche ; la page elle-même n'est pas montée.
- **Rationale**: FR-004 ; un message dédié est plus clair que « Page introuvable » pour un favori.
- **Alternatives considered**: redirection vers la Recherche (le joueur ne comprend pas pourquoi) ;
  page introuvable (laisse croire que l'adresse a changé).

## R4 — Écriture depuis l'administration

- **Decision**: `GET /api/settings` et `PUT /api/settings` (`{ forgemagiePage: boolean }`) dans le
  Worker d'administration, derrière `verifyOwner` comme le reste de `/api/*` ; l'interrupteur
  affiche l'état renvoyé par le serveur, jamais un état supposé.
- **Rationale**: FR-006 à FR-008 ; même protection et mêmes conventions que les compteurs et le
  message.
- **Alternatives considered**: écriture par le Worker public avec la clé applicative (la clé est
  dans le site, donc publique).
