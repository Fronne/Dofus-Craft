# Feature Specification: Aide du calibrage et accès réservé aux bons plans

**Feature Branch**: `081-bons-plans-aide-acces`
**Created**: 2026-11-02
**Status**: Draft
**Input**: Expliquer le panneau « Calibrer le calcul » (colonnes, niveaux d'importance, écart accepté) et réserver la page Bons plans au propriétaire du site. Suite de specs/078, specs/079 et specs/080.

## User Scenarios & Testing

### User Story 1 - Comprendre le calibrage (Priority: P1)

Le joueur ouvre « Calibrer le calcul » et comprend, sans aide extérieure, à quoi sert chaque colonne et ce que vaut chaque niveau d'importance.

**Independent Test**: ouvrir le panneau et lire le titre des colonnes, l'explication du calcul et le sens de chaque niveau.

**Acceptance Scenarios**:

1. **Given** le panneau ouvert, **When** le joueur le lit, **Then** il voit le principe du bon plan, le sens de chaque niveau d'importance et le sens de l'écart accepté, avec un exemple.
2. **Given** la liste des stats, **When** le joueur la parcourt, **Then** les colonnes Stat, Importance et Écart accepté restent titrées, y compris pendant le défilement de la liste.
3. **Given** un champ d'écart affichant « Auto » ou vide, **When** le joueur lit l'explication, **Then** il sait ce que signifie chacun de ces deux états.

### User Story 2 - Réserver la page au propriétaire (Priority: P1)

Le propriétaire coupe la page Bons plans pour tout le monde dans l'administration et la garde pour lui, en l'activant une fois sur chacun de ses navigateurs avec une adresse connue de lui seul.

**Independent Test**: page coupée dans l'administration, ouvrir l'adresse d'activation, vérifier le lien du menu et la page ; ouvrir l'adresse de désactivation, vérifier qu'ils disparaissent.

**Acceptance Scenarios**:

1. **Given** la page coupée, **When** un visiteur ouvre le site, **Then** il ne voit pas le lien et l'adresse de la page indique qu'elle est indisponible.
2. **Given** la page coupée, **When** le propriétaire ouvre le site avec le paramètre d'activation, **Then** le lien et la page sont disponibles, et le restent aux visites suivantes dans ce navigateur.
3. **Given** l'accès activé, **When** le propriétaire ouvre le site avec le paramètre de désactivation, **Then** la page redevient indisponible dans ce navigateur.
4. **Given** le paramètre présent dans l'adresse, **When** il a été lu, **Then** il disparaît de l'adresse affichée.
5. **Given** la page allumée dans l'administration, **When** un visiteur ouvre le site, **Then** elle reste ouverte à tous, comme aujourd'hui.

### Edge Cases

- Stockage du navigateur indisponible : pas d'accès, la page reste indisponible.
- Paramètre avec une autre valeur que `1` ou `0` : ignoré, et laissé dans l'adresse.
- Accès activé sur une autre page que Bons plans : le lien apparaît dans le menu quand même.

## Requirements

### Functional Requirements

- **FR-001**: Le panneau DOIT expliquer quand une annonce devient un bon plan, en citant la comparaison aux exemplaires de jet proche, le prix médian et le seuil.
- **FR-002**: Le panneau DOIT dire ce que compte chaque niveau d'importance : Primordiale 1,5 fois, Très importante 1 fois, Moyenne 0,5 fois, Faible 0,25 fois, Aucune ignorée.
- **FR-003**: Le panneau DOIT définir l'écart accepté, dire que seules les annonces aux mêmes défauts sont comparées, et donner l'exemple de la Force.
- **FR-004**: Le panneau DOIT expliquer les états « Auto » et vide du champ d'écart.
- **FR-005**: La liste des stats DOIT montrer des titres de colonnes qui restent visibles et alignés quand elle défile.
- **FR-012**: L'explication (FR-001 à FR-004) DOIT rester repliée derrière un petit bouton d'information en haut à droite du panneau, qui se ferme avec Échap ou un clic à côté.
- **FR-013**: Toutes les stats DOIVENT défiler dans une seule zone, à lignes compactes et alternées, sur un fond opaque, pour rester lisibles.
- **FR-006**: Le site DOIT accorder l'accès à la page dans un navigateur quand l'adresse porte `bonsplans=1`, et le retirer avec `bonsplans=0`.
- **FR-007**: Cet accès DOIT survivre aux visites suivantes dans le même navigateur.
- **FR-008**: Avec cet accès, le lien de menu et la page DOIVENT se comporter comme si la page était allumée.
- **FR-009**: Sans cet accès, le réglage de l'administration DOIT continuer de décider seul.
- **FR-010**: Le paramètre lu DOIT être retiré de l'adresse affichée.
- **FR-011**: Le calcul, le Worker et l'outil de prix NE DOIVENT PAS changer.

### Key Entities

- **Accès local** : réglage du navigateur, activé ou non. Il n'est ni partagé, ni envoyé au serveur.

## Success Criteria

- **SC-001**: Un joueur peut dire ce que signifient les trois colonnes et les cinq niveaux à la seule lecture du panneau.
- **SC-002**: Page coupée, un visiteur sans accès ne trouve aucun lien vers elle.
- **SC-003**: Le propriétaire active l'accès d'un navigateur en une seule visite.

## Assumptions

- L'accès local n'est pas une authentification : qui connaît le paramètre peut l'utiliser, et les annonces restent lisibles par l'API publique. C'est accepté (choix du propriétaire, option A), comme pour le classement Brisage de specs/072 : ces annonces sont des données publiques de l'HDV.
- Le propriétaire coupe lui-même la page dans l'administration.
