# Research: Bandeau d'information

## §1 Stockage

- **Décision** : table D1 `info_message` avec une clé fixe `id = 'current'` : `text`, `tone`
  (`info` | `important`), `ends_at` (ISO ou NULL), `updated_at`. Publier = `INSERT … ON CONFLICT
  DO UPDATE` ; retirer = `DELETE`.
- **Raison** : même base et même chemin d'écriture que les compteurs ; un seul message (spec).
- **Alternatives** : KV — nouvelle liaison à configurer pour une seule valeur ; fichier dans le
  code — refusé par le porteur du projet (redéploiement).

## §2 Version et fermeture

- **Décision** : `version` = `updated_at` du message. La croix enregistre cette version dans
  `localStorage` (`craftcheck-info-banner-dismissed`). Le bandeau s'affiche si la version reçue diffère
  de la version enregistrée.
- **Raison** : FR-005 ; toute republication (même texte corrigé) change `updated_at`. Changer
  seulement la date de fin republie aussi : le bandeau réapparaît, ce qui reste acceptable (le
  propriétaire republie rarement).
- **Alternatives** : hachage du texte et du style — ne réafficherait pas une republication
  volontaire à l'identique.

## §3 Expiration

- **Décision** : le Worker public ne renvoie pas un message dont `ends_at` est passé (200 `null`) ;
  l'application revérifie `ends_at` à l'affichage (au cas où la page reste ouverte).
- **Raison** : FR-006 sans tâche planifiée ; la ligne expirée reste en base jusqu'au prochain
  retrait ou à la prochaine publication (sans importance).

## §4 Chargement côté application

- **Décision** : `getInfoMessage()` au montage de `AppShell`, puis à chaque changement de page si le
  dernier chargement date de plus de 5 minutes ; jamais d'exception ; échec → pas de bandeau.
- **Raison** : FR-007 (« au plus tard au prochain chargement ») et SC-005 ; évite une requête à
  chaque clic.

## §5 Affichage

- **Décision** : bandeau au-dessus du contenu de la page (dans `.app-shell-main`), `role="status"`
  pour Info et `role="alert"` pour Important, texte en `{text}` React (échappé), bouton « Fermer »
  avec icône `close`. Couleurs : fond accent doux pour Info, fond d'avertissement (`--danger` doux)
  pour Important.

## §6 Administration

- **Décision** : section « Bandeau d'information » en tête de la page d'administration : zone de texte
  (compteur 0 / 280), choix Info / Important, date et heure de fin optionnelles (`datetime-local`,
  heure de Paris convertie en ISO), aperçu du bandeau, boutons « Publier » et « Retirer ». Validation
  partagée (`validateInfoMessageInput`) côté page et côté Worker d'administration.
