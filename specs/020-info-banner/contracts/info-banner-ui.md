# Contrat : bandeau et éditeur

## Bandeau (site)

- En haut de la zone de contenu, sur toutes les pages ; absent sans message actif ou s'il est fermé.
- Classe `info-banner info-banner--info` ou `info-banner--important` ; `role="status"` (Info) ou
  `role="alert"` (Important) ; icône `info` ; texte brut sur plusieurs lignes si besoin ; bouton
  icône « Fermer » (`aria-label="Fermer le message"`).
- Fermer → disparaît, version enregistrée ; une autre version → réapparaît.

## Éditeur (administration)

- Section « Bandeau d'information » : texte (compteur « n / 280 »), boutons radio « Info » /
  « Important », date et heure de fin (vide = sans fin), aperçu, « Publier », « Retirer » (si un
  message existe), erreurs de validation affichées sous le champ concerné, confirmation
  « Message publié » / « Message retiré ».
- Un message expiré est signalé « Expiré le … » dans l'éditeur.
