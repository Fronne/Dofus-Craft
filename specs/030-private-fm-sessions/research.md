# Research: Forgemagie privée

Aucune inconnue technique : la fonctionnalité restreint des lectures existantes. Chaque décision
ci-dessous part du code actuel (`worker/src/fm/`, `src/features/forgemagie/`) et de l'état de la base
de production, lu en lecture seule le 2026-09-30 :

| Mesure | Valeur |
|---|---|
| Séances | 5 |
| Séances sans propriétaire | 0 |
| Séances rattachées à un objet d'un autre joueur que leur propriétaire | 0 |
| Séances dans un salon d'un autre joueur que leur propriétaire | 0 |
| Joueurs / objets en FM | 2 / 0 |

## R1 — Où appliquer la règle : dans le Worker, pas dans la page

- **Decision**: toutes les restrictions sont faites par l'API (`worker/src/fm/`) ; la page se contente
  de ne plus proposer ce qui ne sert plus (liste des joueurs).
- **Rationale**: une règle appliquée seulement par la page laisserait les données lisibles par une
  simple adresse (SC-001).
- **Alternatives considered**: masquer dans la page — rejeté, ne protège rien.

## R2 — « Introuvable » plutôt que « interdit »

- **Decision**: toute lecture ou action sur une séance, un profil, un objet ou un salon d'un autre joueur
  répond **404 `{"error":"Not found"}`**, la même réponse qu'une ressource inexistante. Concerne aussi
  les réponses 403 actuelles : arrêt / renvoi d'une séance (`site-sessions.ts`), détachement
  (`items.ts`), rattachement d'un salon (`channels.ts`), et le 403 `not-participant` du rattachement.
- **Rationale**: SC-003 — rien ne doit permettre de savoir qu'une séance d'un autre existe.
- **Exception gardée**: le démarrage d'une séance dans un salon qui n'est pas le sien reste
  `403 not-your-channel` (specs/029, contrat et message de la page) : l'identifiant de salon vient de la
  liste de ses propres salons, la réponse ne révèle rien de plus.
- **Alternatives considered**: garder 403 — rejeté (révèle l'existence).

## R3 — Liste et détail des séances

- **Decision**: la liste (`GET /fm/sessions`) filtre `owner_discord_user_id = viewer` ; le détail
  (`GET /fm/sessions/{id}`) renvoie `undefined` → 404 si le propriétaire n'est pas le viewer (ou est
  NULL, FR-003). La pagination par `opened_at` ne change pas. Le cas `mine=open` filtrait déjà.
- **Rationale**: FR-001 à FR-003 avec le moins de changement ; pas d'index nécessaire (quelques
  dizaines de séances pour un groupe de 10 à 20 joueurs).

## R4 — Profils

- **Decision**: `GET /fm/players/{id}` renvoie 404 dès que `id ≠ viewer`, public ou privé.
  `GET /fm/players` ne renvoie plus que le viewer (la route est gardée pour ne pas casser une page
  encore ouverte avec l'ancienne version) ; la page ne l'appelle plus et le sélecteur « Voir le profil
  de » disparaît.
- **Rationale**: FR-005, FR-006.
- **Alternatives considered**: supprimer la route — rejeté, un onglet resté ouvert afficherait une
  erreur au lieu d'une liste vide.

## R5 — Séances listées sur son propre profil

- **Decision**: le profil continue de compter les dépenses du joueur à partir de **ses captures**
  (totaux inchangés, FR-012). Chaque séance listée gagne `canOpen` (vrai si le joueur en est
  propriétaire) ; la page n'en fait un lien que dans ce cas.
- **Rationale**: une capture postée dans la séance d'un autre (salon non personnel) reste une dépense
  du joueur, mais la séance ne lui appartient pas : le lien mènerait à « introuvable ». 0 cas en
  production, mais le cas reste possible.
- **Alternatives considered**: retirer ces séances du profil — rejeté, le total ne correspondrait plus
  à la somme affichée.

## R6 — Objets en FM et rattachement

- **Decision**:
  - récap d'objet (`GET /fm/items/{id}`) : seulement si l'objet appartient au viewer (la condition
    `p.is_private = 0 OR …` disparaît) ;
  - rattacher (`PUT /fm/sessions/{id}/item`) : la séance doit appartenir au viewer (remplace la règle
    « avoir posté une capture », specs/027 FR-005), sinon 404 ; `canAttach` suit la même règle ;
  - détacher (`DELETE /fm/sessions/{id}/item`) : la séance **et** l'objet doivent appartenir au viewer,
    sinon 404.
- **Rationale**: FR-004, FR-007. Le récap liste les séances rattachées à l'objet sans autre filtre :
  après ce changement, seules ses propres séances peuvent y être rattachées, et aucune séance d'un autre
  n'est rattachée en production.

## R7 — Salons

- **Decision**: les salons n'apparaissent plus que sur son propre profil (conséquence de R4) ;
  `PUT /fm/channels/{id}/item` sur le salon d'un autre répond 404 au lieu de 403 (R2).
- **Rationale**: FR-008.

## R8 — Réglage public / privé

- **Decision**: le réglage et son enregistrement (`PATCH /fm/me`) ne changent pas. Le texte sous le
  réglage devient, quel que soit le choix : « Pour l'instant, personne d'autre ne voit tes séances ni ton
  profil. Ce réglage servira quand un affichage public sera ajouté. » Le masquage du nom (« Joueur
  privé ») dans une séance où le joueur a posté chez un autre (specs/025 FR-015) reste tel quel.
- **Rationale**: FR-009, FR-010 : ne rien annoncer qui n'existe pas.
- **Alternatives considered**: deux textes selon le choix — rejeté, les deux diraient la même chose.

## R9 — Textes de la page

- **Decision**: « Profil introuvable » (plus de « a peut-être passé son profil en privé ») et « Objet
  introuvable — il a peut-être été supprimé » (plus de mention du profil privé) ; titre ou texte vide de
  l'onglet Sessions sans suggérer qu'on voit le groupe.
- **Rationale**: les anciens textes expliquent l'absence par le réglage privé, ce qui n'est plus vrai.
