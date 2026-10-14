# Feature Specification: Page Rentabilité déjà prête à l'arrivée

**Feature Branch**: `054-rentabilite-prechargee`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: « Pour la page Rentabilité, j'aimerais que la recherche des résultats se
fasse avant qu'on arrive sur cette page. À l'ouverture du site, en arrière-plan, j'aimerais bien que
les données se chargent : comme ça, quand on arrive sur la page, le chargement ne commence pas, il est
déjà fait. » Constat : la préparation en fond existe déjà (specs 019 et 021) mais elle démarre tard
(attente du catalogue puis d'un moment d'inactivité, jusqu'à 5 s), avance lentement (2 requêtes à la
fois hors de la page) et n'est gardée qu'en mémoire, si bien qu'à chaque rechargement ou nouvelle
visite tout repart de zéro. Choix du porteur du projet parmi les pistes proposées : **A** démarrer
plus tôt et avancer plus vite ; **B** garder la dernière liste complète sur l'appareil et l'afficher
tout de suite, pendant qu'une version à jour se calcule en fond.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La liste de la visite précédente s'affiche tout de suite (Priority: P1)

Le joueur revient sur le site (rechargement, nouvel onglet, le lendemain) et ouvre la page
Rentabilité. La dernière liste complète calculée pour son serveur et son mode de prix s'affiche
immédiatement, avec une petite mention indiquant qu'elle date de sa visite précédente et qu'une mise à
jour est en cours. Quand le calcul à jour est terminé, la liste est remplacée d'un coup, sans se vider
ni clignoter, et la mention disparaît.

**Why this priority**: c'est le plus gros gain. Aujourd'hui, chaque nouvelle visite oblige à attendre
tout le calcul, même si rien n'a changé depuis la veille.

**Independent Test**: ouvrir la page Rentabilité et attendre la fin du calcul, recharger le site,
rouvrir aussitôt la page Rentabilité : la liste s'affiche en moins d'une seconde, avec la mention de
mise à jour, puis est remplacée par la liste à jour une fois le calcul terminé.

**Acceptance Scenarios**:

1. **Given** une liste complète obtenue lors d'une visite précédente pour le serveur et le mode
   actifs, **When** le joueur ouvre la page Rentabilité, **Then** cette liste s'affiche aussitôt, sans
   « Calcul en cours », accompagnée d'une mention du type « Liste du 13/10 à 21:40 — mise à jour en
   cours… ».
2. **Given** la liste gardée affichée, **When** le calcul à jour se termine, **Then** la liste est
   remplacée en une fois par la nouvelle, la mention disparaît, et les tris, filtres et la position de
   défilement choisis par le joueur sont conservés.
3. **Given** la liste gardée affichée, **When** le joueur trie, filtre ou fait défiler la liste avant
   la fin de la mise à jour, **Then** tout fonctionne normalement sur la liste gardée.
4. **Given** la liste gardée affichée, **When** le calcul à jour échoue (service partagé injoignable,
   réseau coupé), **Then** la liste gardée reste affichée et la mention indique que la mise à jour n'a
   pas pu se faire, avec la date de la liste affichée.
5. **Given** aucune liste gardée pour ce serveur et ce mode (première visite, nouveau serveur),
   **When** le joueur ouvre la page, **Then** le comportement est celui d'aujourd'hui (progression
   « Calcul en cours… (n / total) »), en reprenant le calcul déjà lancé en fond s'il existe.
6. **Given** le joueur qui change de serveur ou de mode de prix, **When** il ouvre la page
   Rentabilité, **Then** c'est la liste gardée de ce nouveau couple serveur + mode qui s'affiche (s'il y
   en a une), jamais celle d'un autre serveur ou d'un autre mode.

---

### User Story 2 - La préparation démarre dès l'ouverture et avance plus vite (Priority: P2)

Le joueur ouvre le site sur n'importe quelle page. La préparation de la liste Rentabilité commence dès
que le catalogue est prêt, sans attendre un moment d'inactivité, et avance plus vite qu'aujourd'hui,
sans que la recherche ou la saisie du joueur ne deviennent lentes. Quand il ouvre la page Rentabilité
quelques secondes plus tard, la liste à jour est déjà prête ou presque.

**Why this priority**: c'est ce qui rend la liste à jour (et pas seulement celle de la veille)
disponible à l'arrivée, y compris lors de la toute première visite.

**Independent Test**: ouvrir le site sur la page Recherche, attendre une dizaine de secondes, puis
ouvrir la page Rentabilité : la liste à jour est affichée sans progression visible (ou avec une
progression nettement plus avancée qu'avant la fonctionnalité, à durée d'attente égale).

**Acceptance Scenarios**:

1. **Given** le site qui vient de s'ouvrir, **When** le catalogue devient prêt, **Then** la
   préparation de la liste Rentabilité commence immédiatement, sans attendre que le navigateur soit
   inactif.
2. **Given** une préparation en fond en cours, **When** le joueur tape une recherche ou consulte un
   objet, **Then** l'affichage reste fluide et ses propres demandes passent avant celles de la
   préparation.
3. **Given** une préparation en fond en cours, **When** le joueur ouvre la page Rentabilité, **Then**
   la page reprend ce calcul en passant à pleine vitesse, sans en relancer un second.
4. **Given** une liste gardée de la visite précédente, **When** le site s'ouvre, **Then** la mise à
   jour de cette liste démarre elle aussi dès l'ouverture, de sorte que la liste à jour soit souvent
   déjà prête quand le joueur arrive sur la page.

### Edge Cases

- Liste gardée d'une ancienne version de l'application (format différent) : elle est ignorée, sans
  erreur, et la page se comporte comme lors d'une première visite.
- Liste gardée trop ancienne (plus de 7 jours) : elle n'est pas affichée ; la page se comporte comme
  lors d'une première visite.
- Stockage de l'appareil indisponible (navigation privée, stockage plein ou refusé) : le site
  fonctionne comme aujourd'hui, avec la liste gardée en mémoire pour la visite seulement.
- Calcul interrompu (fermeture de l'onglet, changement de serveur, perte de réseau) : rien de partiel
  n'est gardé ; seule une liste complète remplace la liste gardée.
- Un prix HDV a été saisi ou supprimé depuis la liste gardée : la liste gardée peut le montrer avec
  l'ancienne valeur pendant la mise à jour ; la mention indique bien qu'elle date de la visite
  précédente, et la liste à jour le prend en compte.
- Calcul à jour qui ne trouve plus aucun objet calculable : la liste gardée est remplacée par l'état
  vide habituel (« Aucun objet calculable »), et non conservée.
- Plusieurs onglets ouverts : chacun peut calculer et garder sa liste ; la dernière liste complète
  enregistrée fait foi.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le site DOIT garder sur l'appareil, d'une visite à l'autre, la dernière liste
  Rentabilité **complète** calculée pour chaque couple serveur + mode de prix, avec sa date de calcul
  et une version de format.
- **FR-002**: À l'ouverture de la page Rentabilité, s'il existe une liste gardée valide pour le
  serveur et le mode actifs et qu'aucune liste plus récente n'a été calculée pendant la visite, elle
  DOIT être affichée immédiatement, avant tout calcul.
- **FR-003**: Tant qu'une liste gardée d'une visite précédente est affichée, la page DOIT afficher une
  mention discrète donnant la date et l'heure de cette liste et indiquant qu'une mise à jour est en
  cours (ou qu'elle a échoué).
- **FR-004**: Une liste calculée pendant la visite DOIT remplacer la liste affichée en une seule fois,
  uniquement quand elle est complète ; la liste affichée ne DOIT jamais se vider ni se remplir
  progressivement par-dessus une liste gardée.
- **FR-005**: Les tris, filtres et la position de défilement choisis par le joueur DOIVENT être
  conservés quand la liste à jour remplace la liste gardée.
- **FR-006**: Une liste gardée dont la version de format est incompatible, ou dont la date de calcul
  dépasse 7 jours, NE DOIT PAS être affichée.
- **FR-007**: En l'absence de stockage utilisable, le site DOIT fonctionner comme aujourd'hui (liste
  gardée en mémoire pour la visite).
- **FR-008**: La préparation en fond de la liste du serveur et du mode actifs DOIT démarrer dès que le
  catalogue est prêt, sans attendre un moment d'inactivité du navigateur. Elle DOIT démarrer aussi
  lorsqu'une liste gardée existe (pour la mettre à jour).
- **FR-009**: Hors de la page Rentabilité, la préparation DOIT avancer plus vite qu'aujourd'hui (au
  plus 4 demandes simultanées au lieu de 2) tout en laissant passer en priorité les demandes faites
  par le joueur ; sur la page, elle passe à pleine vitesse comme aujourd'hui.
- **FR-010**: Les règles de calcul de la liste (objets candidats, coûts, bénéfices) NE DOIVENT PAS
  changer : la liste gardée puis mise à jour DOIT être identique à celle calculée à l'ouverture de la
  page (spec 019).
- **FR-011**: Un changement de serveur ou de mode de prix DOIT afficher la liste gardée de ce nouveau
  couple (s'il en existe une) et lancer sa mise à jour ; la liste d'un autre couple NE DOIT JAMAIS
  être affichée.
- **FR-012**: Seules la liste calculée et sa date sont gardées sur l'appareil ; elles NE DOIVENT PAS
  être envoyées au service partagé.

### Key Entities

- **Liste Rentabilité gardée**: dernière liste complète pour un couple (serveur, mode de prix) — les
  lignes telles qu'affichées (objet, coût de craft, prix HDV, bénéfice, date du prix HDV) — avec sa
  date de calcul et sa version de format. Remplace la « Liste Prix préparée » de la spec 021, qui
  n'était valable que pour la visite en cours.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dès la deuxième visite, en ouvrant la page Rentabilité, une liste complète est affichée
  en moins d'une seconde, sans indicateur « Calcul en cours ».
- **SC-002**: En ouvrant la page Rentabilité après au moins 10 secondes sur le site, la liste **à
  jour** est affichée en moins d'une seconde dans la grande majorité des cas (moins d'une centaine
  d'objets candidats).
- **SC-003**: Pendant la préparation en fond, une recherche d'objet sur la page Recherche s'affiche
  aussi vite qu'avant la fonctionnalité.
- **SC-004**: Aucune régression : une fois la mise à jour terminée, les valeurs affichées sont
  identiques à celles d'un calcul fait à l'ouverture de la page.
- **SC-005**: Une liste gardée n'est jamais affichée sans la mention de sa date tant que la liste à
  jour n'est pas arrivée.

## Assumptions

- Cette fonctionnalité **remplace** l'hypothèse des specs 019 et 021 selon laquelle la liste n'est
  pas gardée après un rechargement : le risque d'une liste ancienne trompeuse est couvert par la
  mention datée (FR-003) et par la mise à jour automatique dès l'ouverture.
- 7 jours est une limite raisonnable : au-delà, les prix HDV ont trop pu changer pour qu'une liste
  serve de première indication ; en deçà, la mention datée suffit.
- Le public est un petit groupe fermé (10 à 20 joueurs) : passer de 2 à 4 demandes simultanées en
  fond ne pose pas de problème de charge pour la source du catalogue ni pour le service partagé.
- Les autres pages, la saisie de prix et les règles de calcul ne changent pas.
- Le comportement actuel « à chaque ouverture de la page, une liste à jour est recalculée en fond »
  (spec 024, FR-013) est conservé.
