# Data Model: Forgemagie privée

**Aucune migration, aucune nouvelle donnée.** Les tables existantes (specs/025, 027, 028, 029) portent
déjà tout ce qu'il faut ; seule la règle de lecture change.

## Règle de visibilité

| Donnée | Qui la voit (avant) | Qui la voit (après) |
|---|---|---|
| Séance (`fm_sessions`) : liste et détail | tout membre connecté | seulement `owner_discord_user_id = joueur connecté` ; personne si NULL |
| Profil (`fm_players` + dépenses) | tout membre si public ; soi-même | soi-même uniquement |
| Liste des joueurs | joueurs publics + soi | soi uniquement |
| Objet en FM (`fm_items`) et son récap | tout membre si propriétaire public ; soi | propriétaire uniquement |
| Salons FM (`fm_channels`) sur le profil | tout membre si public ; soi | propriétaire uniquement |
| Prix des runes | tous | tous (inchangé) |

## Droits d'action

| Action | Avant | Après |
|---|---|---|
| Rattacher une séance à un objet | avoir posté une capture dans la séance + posséder l'objet | posséder la séance **et** l'objet |
| Détacher | posséder l'objet | posséder la séance **et** l'objet |
| Arrêter / renvoyer une séance | propriétaire (403 sinon) | propriétaire (404 sinon) |
| Rattacher un salon à un objet | propriétaire du salon (403 sinon) | propriétaire du salon (404 sinon) |

## Champs conservés sans effet

- `fm_players.is_private` : toujours lu et écrit (`PATCH /fm/me`), sert encore au masquage « Joueur
  privé » d'un joueur qui a posté dans la séance d'un autre (specs/025 FR-015) ; réservé au futur
  affichage public.

## Champ ajouté dans une réponse (pas en base)

- Profil → `sessions[].canOpen: boolean` : vrai si le joueur connecté est propriétaire de la séance
  (research R5).
