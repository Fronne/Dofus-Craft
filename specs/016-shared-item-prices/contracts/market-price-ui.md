# Contrat d'interface : prix HDV en Mode communautaire

## Fiche d'objet — ligne « Prix HDV » du bloc de comparaison

| Élément | Mode communautaire | Mode personnel |
|---|---|---|
| Valeur | dernier prix partagé (objet, serveur actif) ; vide s'il n'y en a pas | inchangé (prix local) |
| Verrouillage | verrouillé dès qu'il y a une valeur, bouton « Modifier ce prix » (crayon) | aucun (inchangé) |
| Date | « Dernière mise à jour : <il y a …> » sous le champ, surlignée si ancienne (specs/008) | aucune (inchangé) |
| Nombre de contributions | jamais affiché | — |
| Validation | à la sortie du champ après une vraie édition : partage (confirmation si écart > 50 %) | enregistrement local (inchangé) |
| Confirmation | fenêtre existante de specs/007 avec « Dernier prix : X » (au lieu de « Prix habituel »), prix saisi et écart ; Annuler → valeur précédente | — |
| Service injoignable | dernier prix en cache (avec sa date) ou vide ; saisie utilisée localement, pas de message bloquant | — |

## Page Suivis

- Mode communautaire : « HDV : … » = dernier prix partagé de l'objet (cache puis réseau) ; la
  comparaison de la carte l'utilise.
- Mode personnel : inchangé.
