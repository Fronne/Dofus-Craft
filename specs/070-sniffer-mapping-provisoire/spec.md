# Spécification : mapping sniffer provisoire après une mise à jour du client

**Branche** : `070-sniffer-mapping-provisoire` (évolution de `056-sniffer-batch-prices`)

**Créée** : 2026-10-22

**Statut** : Draft

**Entrée** : l'outil d'envoi des prix des amis (`dofus-craft-prices.exe`, `SniffSniffSquared
--upload`) se met en pause à chaque mise à jour de Dofus tant qu'aucun mapping n'est publié pour le
nouveau build. Or une mise à jour ne fait pas toujours tourner les clés de prix : le client 3.7.12.12
(19/10/2026) a gardé `jzs` et ses numéros de champ. Le propriétaire veut que l'outil reprenne seul
dans ce cas.

## Contexte

Le Worker sert déjà, par build, le mapping actif que le propriétaire a déposé dans l'admin (056, 057).
Cette spec ajoute un repli : quand le build du client n'a aucun mapping actif, le Worker peut servir le
dernier mapping actif déposé, tous builds confondus, marqué « provisoire ». L'outil ne l'adopte qu'après
avoir vérifié sur le fil que les messages de prix décodés avec lui sont cohérents ; sinon il se remet
en pause. Cette vérification est faite côté outil (repo SniffSniffSquared), hors de cette spec.

Un mapping périmé qui se décode encore écrirait des prix faux dans la base partagée. D'où deux gardes
côté Worker : le repli n'est servi qu'à un outil qui le demande explicitement (`provisional=1`), car
un ancien outil l'utiliserait sans vérifier ; et un lot décodé avec le repli n'est accepté que tant
qu'aucun vrai mapping n'est publié pour le build.

## Scénarios utilisateur et tests *(obligatoire)*

### Histoire 1 — L'outil reprend seul après une mise à jour sans rotation (Priorité : P1)

Le client passe en 3.7.12.12. Aucun mapping n'est publié pour ce build. L'outil demande sa
configuration avec `provisional=1` et reçoit le mapping de 3.7.10.10, marqué provisoire. Il vérifie
les messages de prix décodés puis envoie ses lots en les marquant provisoires ; le Worker les accepte.

**Test indépendant** : avec un mapping actif pour 3.7.10.10 seulement,
`GET /sniffer/config?build=3.7.12.12&provisional=1` renvoie ce mapping avec `provisional: true`, et un
lot `{build: "3.7.12.12", mappingId: <son id>, provisional: true}` est accepté.

1. **Étant donné** aucun mapping actif pour le build X et au moins un mapping actif ailleurs,
   **quand** l'outil demande sa configuration avec `provisional=1`, **alors** il reçoit le mapping
   actif le plus récemment déposé, avec son propre build d'origine et `provisional: true`.
2. **Étant donné** ce même état, **quand** la demande ne porte pas `provisional=1`, **alors**
   `mapping` vaut `null`, comme avant.
3. **Étant donné** un mapping actif pour X, **quand** l'outil demande sa configuration (avec ou
   sans `provisional=1`), **alors** il reçoit ce mapping avec `provisional: false`.

### Histoire 2 — Un vrai mapping publié remplace le repli (Priorité : P1)

Le propriétaire publie ensuite un mapping pour 3.7.12.12. Le prochain lot provisoire de l'outil est
refusé en 409 ; l'outil recharge sa configuration et reçoit le vrai mapping.

1. **Étant donné** un mapping actif pour X, **quand** un lot de X arrive avec `provisional: true` et
   l'id du repli, **alors** il est refusé `409 mapping_not_active` avec `activeMappingId` = l'id du
   mapping de X, et rien n'est écrit.
2. **Étant donné** aucun mapping actif pour X, **quand** un lot de X arrive sans `provisional: true`,
   **alors** il est refusé `409 mapping_not_active` avec `activeMappingId: null`, comme avant.

### Cas limites

- Aucun mapping actif nulle part : il n'y a pas de repli, `mapping` vaut `null`, tout lot de X reçoit 409.
- Le propriétaire dépose un mapping pour un autre build : le repli devient ce dernier dépôt actif ; les
  lots décodés avec l'ancien repli reçoivent 409 (avec l'id du nouveau repli) et l'outil recharge.
- Deux mappings déposés au même instant : l'id le plus grand l'emporte.
- Un repli dont le JSON stocké est illisible est servi comme `null` (comportement de 056) ; l'outil
  reste en pause.

## Exigences *(obligatoire)*

- **FR-001** : `GET /sniffer/config` DOIT ajouter `provisional: false` à un mapping propre au build.
- **FR-002** : sans mapping actif pour le build et avec `provisional=1`, `GET /sniffer/config` DOIT
  servir le mapping actif le plus récemment déposé (`uploaded_at` puis `id` décroissants), sous la
  forme `{id, build, keymap, schema, provisional: true}` où `build` est son build d'origine.
- **FR-003** : sans `provisional=1`, la réponse DOIT rester celle de 056 (`mapping: null` sans mapping
  actif pour le build).
- **FR-004** : `POST /community-price/batch` DOIT accepter un champ facultatif `provisional`. Le mapping
  attendu est l'actif du build ; s'il n'y en a aucun et que `provisional === true`, c'est le repli de
  FR-002. Un `mappingId` différent DOIT répondre `409 mapping_not_active` avec `activeMappingId` = l'id
  attendu, ou `null` s'il n'y en a aucun.
- **FR-005** : aucune route publique NE DOIT écrire dans `sniffer_mappings`. Pas d'adoption
  automatique : une clé d'ami ne peut pas publier un mapping.
- **FR-006** : aucune migration.

## Critères de succès

- **SC-001** : après une mise à jour du client qui ne fait pas tourner les clés de prix, un outil à jour
  reprend l'envoi sans action du propriétaire.
- **SC-002** : aucun lot décodé avec le repli n'est accepté pour un build qui a son propre mapping actif.
- **SC-003** : un outil qui ne connaît pas `provisional` ne reçoit jamais de mapping provisoire.
