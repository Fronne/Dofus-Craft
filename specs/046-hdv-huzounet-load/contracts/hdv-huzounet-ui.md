# Contrat d'interface : bouton « Charger depuis Huzounet » de la page HDV

Emplacement : dans la barre `results-meta` de l'onglet, à droite du compteur « N objets sur M ont un
prix ». Présent dans les quatre onglets ; absent quand aucun serveur n'est choisi, pendant le chargement
de la liste des objets, ou quand elle est indisponible.

## Bouton

| Situation | Rendu |
|-----------|-------|
| Prêt | bouton actif « Charger depuis Huzounet (N objets) » ; si plus d'une tranche, texte d'aide à côté : « environ D » (ex. « environ 10 s », « environ 3 min ») |
| Mode personnel | bouton désactivé (`disabled`) + texte : « Les prix Huzounet se chargent en Mode communautaire. » |
| Serveur non relu | bouton désactivé + texte : « Les prix de ce serveur ne sont pas relus. » |
| Chargement en cours | le bouton devient « Arrêter » ; à côté, zone `role="status"` : « Chargement : X sur N objets » et une barre `<progress value={X} max={N}>` |

N est le nombre d'objets de l'onglet, jamais celui des filtres.

Durée annoncée : moins de 60 s → « environ D s » arrondi à 5 s ; au-delà → « environ D min » arrondi à
la minute supérieure.

## Message de fin (zone `role="status"`, remplacée au chargement suivant, effacée au changement d'onglet)

| État | Message |
|------|---------|
| terminé, `loaded > 0` | « P prix chargés depuis Huzounet. » (« 1 prix chargé depuis Huzounet. ») |
| terminé, `loaded = 0` | « Les prix sont déjà à jour. » |
| arrêté | « Chargement arrêté : P prix chargés. » |
| échec `hourly-limit` | « Cet onglet a déjà été chargé il y a moins d'une heure. Prochain chargement possible à 15 h 05. » (heure locale du joueur) |
| échec `too-soon` (après 3 redemandes) | « Réessaie dans quelques secondes. P prix chargés. » |
| échec `unavailable` | « Huzounet ne répond pas pour le moment. P prix chargés. » |
| échec `disabled` | « Le chargement depuis Huzounet est indisponible. » |
| échec `unknown-server` | « Les prix de ce serveur ne sont pas relus. » |
| échec `unreachable` | « Chargement impossible : l'API ne répond pas. P prix chargés. » |

« P prix chargés. » n'est ajouté que si P > 0 (« 1 prix chargé. » au singulier).

## Mention d'origine sur une ligne (Mode communautaire, tous les onglets)

Sous le champ de prix de la ligne (et non plus à la suite du type ou de la stat), dans le
`span.fm-origin` existant :

| Dernier prix connu de l'API | Mention |
|-----------------------------|---------|
| origine `external` | « Huzounet » |
| origine `external`, `latestFragile: 'provisional'` | « Huzounet · peu de relevés » |
| origine `external`, `latestFragile: 'stale'` | « Huzounet · relevé ancien » |
| origine `manual`, `capture`, `bot` | onglet Runes : libellé existant (inchangé) ; autres onglets : rien (inchangé) |

Condition commune pour « Huzounet » : la date du prix affiché (carnet) est celle du dernier prix connu de
l'API, et aucune saisie n'est en cours sur la ligne. Sinon, pas de mention.

## Comportements

- Un clic sur « Arrêter », un changement d'onglet, de serveur ou de mode, ou la sortie de la page : plus
  aucune demande ne part ; les prix déjà chargés restent.
- Pendant un chargement, les filtres, la recherche et la saisie de prix restent utilisables.
- Saisir un prix sur une ligne dont le prix n'est connu que de Huzounet n'ouvre pas la confirmation
  d'écart (il n'y a pas de médiane du groupe à laquelle comparer).
