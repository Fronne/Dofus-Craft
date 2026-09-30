# Feature Specification: Prix des runes dans la page HDV

**Feature Branch**: `026-hdv-rune-prices`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: « Pour les prix des runes, je veux mettre l'affichage dans la page HDV. »
Précisions données par le porteur du projet : l'onglet Runes de la page Forgemagie est retiré (la
liste n'existe plus qu'à un endroit) ; l'import de capture du chat reste sur la page Forgemagie.

## Contexte

La page Forgemagie (specs/025) a un onglet **Runes** : les 105 runes avec leur prix, une recherche
par nom, un filtre par stat, l'origine du dernier prix partagé (« Bot Discord », « Capture »,
« Saisie manuelle »), et au-dessus l'import d'une capture du chat. Cette page est réservée aux membres
du serveur Discord du groupe, qui doivent se connecter.

Or relever et consulter des prix, c'est le rôle de la page **HDV** (specs/023), qui a un onglet par
hôtel des ventes du jeu (Ressources, Consommables, Créatures) et reste accessible sans connexion. Les
runes s'achètent à l'HDV Runes : leur liste de prix y a sa place, à côté des autres HDV, et devient
visible sans se connecter, comme tous les autres prix du site.

L'import de capture, lui, enregistre des dépenses sur le profil Discord du joueur : il reste sur la
page Forgemagie, où l'on est connecté.

Cette spec **amende** specs/023 (FR-002 : quatre onglets au lieu de trois) et specs/025 (US4 et
FR-017 : la liste des runes quitte la page Forgemagie ; US5 : l'import change d'onglet).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulter et relever le prix des runes dans la page HDV (Priority: P1)

Un joueur ouvre la page HDV, sans être connecté, et choisit l'onglet **Runes**. Il voit les 105 runes
avec leur icône, leur stat et leur prix sur le serveur actif. Il peut chercher une rune par son nom,
filtrer par stat, filtrer par prix (« Tous », « Sans prix », « Prix ancien ») et saisir un prix comme
dans les autres onglets. En Mode communautaire, chaque prix partagé indique son origine.

**Why this priority**: c'est toute la demande ; la page HDV est l'endroit où l'on relève les prix d'un
hôtel des ventes.

**Independent Test**: sans être connecté, ouvrir HDV puis l'onglet Runes, chercher « Do Air » : la
Rune Do Air apparaît avec son prix partagé, sa date et son origine ; saisir un prix pour la Rune Fo :
il est enregistré comme dans les autres onglets.

**Acceptance Scenarios**:

1. **Given** un joueur non connecté, **When** il ouvre la page HDV, **Then** il voit un onglet
   « Runes » après « Créatures », sans aucune demande de connexion.
2. **Given** l'onglet Runes ouvert, **When** le joueur tape « Do Air », **Then** seules les runes dont
   le nom contient ce texte restent listées.
3. **Given** l'onglet Runes ouvert, **When** le joueur choisit la stat « Force », **Then** seules les
   runes de Force restent listées.
4. **Given** une rune dont le dernier prix partagé vient du bot, **When** le joueur ouvre l'onglet en
   Mode communautaire, **Then** la ligne affiche le prix, sa date et « Bot Discord ».
5. **Given** l'onglet Runes, **When** le joueur saisit un prix, **Then** il est enregistré exactement
   comme dans les autres onglets HDV (même carnet, même partage, même confirmation d'un prix
   aberrant), et le compteur « N objets sur M ont un prix » est mis à jour.
6. **Given** le filtre « Sans prix », **When** le joueur l'active, **Then** seules les runes sans prix
   sur le serveur actif restent listées.
7. **Given** le joueur a quitté la page sur l'onglet Runes, **When** il revient sur la page HDV,
   **Then** l'onglet Runes est rouvert, comme pour les autres onglets.

---

### User Story 2 - La page Forgemagie sans liste des runes (Priority: P2)

Un joueur connecté ouvre la page Forgemagie. Il n'y a plus d'onglet Runes : il reste **Sessions** et
**Profil**. L'import d'une capture du chat se trouve dans l'onglet **Profil**, avec ses dépenses, et
fonctionne comme avant.

**Why this priority**: évite d'avoir la même liste à deux endroits, et garde l'import là où la
connexion est disponible ; secondaire par rapport à la nouvelle liste dans l'HDV.

**Independent Test**: se connecter à la page Forgemagie : seuls les onglets Sessions et Profil
existent ; dans Profil, coller une capture et valider : l'achat apparaît dans les dépenses.

**Acceptance Scenarios**:

1. **Given** un joueur connecté, **When** il ouvre la page Forgemagie, **Then** il voit les onglets
   Sessions et Profil, et aucun onglet Runes.
2. **Given** l'onglet Profil de son propre profil, **When** le joueur colle une capture du chat,
   **Then** l'import se déroule comme avant (lecture sur l'appareil, correction, validation), et
   l'achat validé apparaît dans ses dépenses sans recharger la page.
3. **Given** l'onglet Profil d'un autre membre, **When** le joueur le consulte, **Then** l'import n'y
   est pas proposé.
4. **Given** une capture validée en Mode communautaire, **When** le joueur ouvre ensuite l'onglet
   Runes de la page HDV, **Then** les prix importés y apparaissent avec l'origine « Capture ».

---

### Edge Cases

- **Aucun serveur choisi** : l'onglet Runes l'indique, comme les autres onglets HDV.
- **Mode personnel** : l'onglet Runes montre et enregistre les prix de l'appareil ; aucune origine
  n'est affichée, puisque rien n'est partagé.
- **Service communautaire injoignable** : les prix déjà connus sur l'appareil restent affichés, sans
  origine ; la saisie reste possible (specs/004, FR-011).
- **Une rune dont le prix partagé n'a pas d'origine connue** : elle est affichée comme « Saisie
  manuelle », comme sur la page Forgemagie jusqu'ici.
- **Lien ou favori vers l'ancien onglet Runes de Forgemagie** : la page Forgemagie s'ouvre sur
  Sessions ; il n'y a pas d'adresse propre à un onglet à conserver.
- **Joueur sans serveur de profil qui importe une capture** : message inchangé, qui l'invite
  maintenant à choisir son serveur juste au-dessus, dans le même onglet Profil.

## Requirements *(mandatory)*

### Functional Requirements

**Page HDV**

- **FR-001**: La page HDV MUST proposer un quatrième onglet « Runes », après « Créatures ».
  *(amende specs/023 FR-002)*
- **FR-002**: L'onglet Runes MUST lister toutes les runes de forgemagie du catalogue, avec l'icône du
  jeu, le nom et la stat de chaque rune, triées comme la liste générée (par stat puis par niveau).
- **FR-003**: L'onglet Runes MUST permettre de chercher par nom (sans tenir compte des accents ni de
  la casse, comme les autres onglets) et de filtrer par stat, à la place du filtre par type des
  autres onglets.
- **FR-004**: L'onglet Runes MUST offrir les mêmes filtres de prix (« Tous », « Sans prix », « Prix
  ancien ») et le même compteur « N objets sur M ont un prix » que les autres onglets.
- **FR-005**: Le champ de prix de chaque rune MUST se comporter exactement comme celui des autres
  onglets HDV (specs/023 FR-006) : serveur actif, date, prix périmés, historique, Mode personnel ou
  communautaire, confirmation d'un prix aberrant.
- **FR-006**: En Mode communautaire, chaque rune qui a un prix partagé MUST afficher l'origine de ce
  dernier prix (« Bot Discord », « Capture » ou « Saisie manuelle »). En Mode personnel, aucune
  origine n'est affichée.
- **FR-007**: L'onglet Runes MUST être accessible sans connexion, comme le reste de la page HDV.
- **FR-008**: Le choix de l'onglet Runes MUST être retenu comme celui des autres onglets.

**Page Forgemagie**

- **FR-009**: La page Forgemagie MUST NOT avoir d'onglet Runes ; elle garde les onglets Sessions et
  Profil. *(amende specs/025 US4, FR-017)*
- **FR-010**: L'import de capture du chat MUST être proposé dans l'onglet Profil, seulement sur le
  profil du joueur connecté, avec le même comportement que dans specs/025 (US5, FR-022 à FR-025).
  *(amende specs/025 US5)*
- **FR-011**: Après un import validé, les dépenses affichées dans l'onglet Profil MUST inclure les
  achats importés, sans rechargement de la page.

### Key Entities

- **Rune** : inchangée (specs/025) — nom, icône, niveau, stat.
- **Onglet HDV** : un des hôtels des ventes du jeu listés par la page HDV ; les Runes s'ajoutent à
  Ressources, Consommables et Créatures, avec leur propre liste (celle des runes, et non celle des
  objets des trois autres HDV).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur non connecté trouve le prix d'une rune donnée en moins de 15 secondes depuis
  la page HDV.
- **SC-002**: Les 105 runes sont trouvables dans l'onglet Runes, et aucune n'est plus listée sur la
  page Forgemagie.
- **SC-003**: Un prix de rune saisi dans l'onglet Runes est identique, pour le même serveur et le
  même mode, à celui que les autres pages utilisent pour cette rune (100 % des cas).
- **SC-004**: Un import de capture validé depuis l'onglet Profil apparaît dans les dépenses du joueur
  et, en Mode communautaire, dans l'onglet Runes de la page HDV, sans autre action.

## Assumptions

- La liste des runes reste celle de `src/data/rune-items.json` (specs/025), sans nouvelle donnée.
- L'import va dans l'onglet **Profil** plutôt que Sessions : il enregistre des dépenses personnelles,
  qui s'affichent dans ce même onglet, et c'est là que se choisit le serveur de profil qu'il utilise.
- Les onglets de la page Forgemagie n'ont pas d'adresse propre : retirer l'onglet Runes ne casse aucun
  lien.
- Aucun changement du Worker ni de la base : seules les pages HDV et Forgemagie changent.
- L'entrée « Forgemagie » reste dans la navigation principale.
