# Spécification : prix de tous les HDV envoyés par l'outil des amis

**Branche** : `071-sniffer-tous-hdv`

**Créée** : 2026-10-22

**Statut** : Draft

**Entrée** : évolution de la 056 (`specs/056-sniffer-batch-prices`). Contrat côté outil rédigé par la
session SniffSniffSquared (`contrat-tous-hdv.md`, 2026-10-22) ; décisions du propriétaire : un seul
prix par équipement (l'exemplaire le moins cher), étiquette dans une nouvelle colonne `item_type`,
`kind` inchangé ; hors équipements, accepter tout objet d'après sa catégorie (pas seulement le
catalogue de ressources du site).

## Contexte

Aujourd'hui l'outil des amis n'envoie que des ressources, et l'API refuse tout identifiant hors du
catalogue de ressources du site. À partir de sa version 0.4.0, l'outil envoie les prix de tous les
HDV : équipements, ressources, runes, consommables, chaque observation portant la catégorie (type
DofusDB) que l'HDV donne pour l'objet. L'API étiquette chaque prix enregistré selon sa nature.

## Scénarios utilisateur et tests *(obligatoire)*

### Histoire 1 — Un équipement vu à l'HDV devient le prix partagé de l'objet (Priorité : P1)

L'outil envoie, pour un équipement, le prix de l'exemplaire le moins cher en vente. L'API
l'enregistre comme prix partagé de l'objet (le même que celui qu'un joueur saisit à la main pour un
objet), étiqueté « équipement ».

**Test indépendant** : envoyer une observation de catégorie 9 (anneau) avec un seul lot ; vérifier
une contribution d'objet, d'origine « sniffer », étiquetée `equipment`, au prix envoyé.

**Scénarios d'acceptation** :

1. **Étant donné** une observation d'équipement avec un prix au lot 1, **alors** elle est enregistrée
   comme prix d'objet, au prix envoyé, avec l'écart au dernier prix connu de l'objet mesuré comme
   pour une saisie d'objet.
2. **Étant donné** une observation d'équipement portant d'autres lots que le lot 1, **alors** elle est
   refusée (`invalid`).
3. **Étant donné** un équipement absent du catalogue de ressources, **alors** il est accepté quand
   même (le catalogue ne s'applique pas aux équipements).

### Histoire 2 — Ressources, runes et consommables étiquetés (Priorité : P1)

Une observation de ressource, de rune ou de consommable suit la règle du prix unitaire et les prix
par lot comme aujourd'hui, et reçoit l'étiquette de sa nature. Un consommable ou une ressource hors
du catalogue du site est accepté d'après sa catégorie.

**Test indépendant** : envoyer une rune (catégorie 78), une potion (12) hors catalogue et un minerai
(39) ; vérifier trois contributions de ressource étiquetées `rune`, `consumable`, `resource`.

**Scénarios d'acceptation** :

1. **Étant donné** une observation de catégorie connue, **alors** l'étiquette enregistrée est celle de
   cette catégorie.
2. **Étant donné** une catégorie inconnue ou qui ne correspond à aucune des quatre natures (objet de
   quête, cosmétique de compte…), **alors** l'observation est refusée (`unknown_category`).
3. **Étant donné** une catégorie qui n'est pas un entier positif, **alors** `invalid`.

### Histoire 3 — Un outil plus ancien continue de fonctionner (Priorité : P1)

Une observation sans catégorie (outil antérieur à 0.4.0) est traitée exactement comme aujourd'hui :
ressources du catalogue seulement, sans étiquette.

**Test indépendant** : rejouer les cas actuels de la route ; mêmes réponses et mêmes lignes, étiquette
vide.

### Cas limites

- Un lot mélangeant observations avec et sans catégorie : chacune est traitée selon la sienne.
- Le plafond journalier compte une ligne par observation acceptée, équipement compris ; les prix par
  lot ne comptent pas (inchangé).
- Le même équipement deux fois dans un lot : deux contributions, la référence étant le dernier prix
  connu avant le lot.
- La version minimale de l'outil n'est pas relevée : les outils 0.3.x continuent d'envoyer.
- Les saisies manuelles et les lignes existantes gardent une étiquette vide.

## Exigences *(obligatoire)*

- **FR-001** : Chaque contribution DOIT pouvoir porter une étiquette parmi `equipment`, `resource`,
  `rune`, `consumable`, ou aucune ; aucune ligne existante n'est réécrite.
- **FR-002** : L'étiquette DOIT être déduite de la catégorie envoyée, par une table versionnée
  générée depuis DofusDB (type → nature).
- **FR-003** : Une observation d'équipement DOIT être enregistrée comme prix d'objet (même nature
  que la saisie manuelle d'un objet), au prix de son lot 1, sans prix par lot.
- **FR-004** : Une observation de ressource, rune ou consommable DOIT être enregistrée comme
  aujourd'hui (prix unitaire, prix par lot), sans contrôle du catalogue de ressources quand elle porte
  une catégorie.
- **FR-005** : Une observation sans catégorie DOIT suivre le comportement de la 056 sans changement.
- **FR-006** : Une catégorie inconnue ou hors des quatre natures DOIT être refusée avec la raison
  `unknown_category` ; une catégorie mal formée avec `invalid`.
- **FR-007** : Le contrat de l'API sniffer DOIT être mis à jour.

### Entités clés

- **Contribution communautaire** (existante) : gagne l'étiquette de nature.
- **Table des catégories** : type DofusDB → nature, générée par un script et versionnée.

## Critères de succès *(obligatoire)*

- **SC-001** : 100 % des observations des quatre natures envoyées par un outil 0.4.0 sont enregistrées
  avec la bonne étiquette.
- **SC-002** : Les tests actuels de la route d'envoi passent sans modification de leur résultat.
- **SC-003** : L'ajout de l'étiquette ne réécrit aucune ligne existante de la base.

## Hypothèses

- La catégorie de l'HDV est le type DofusDB de l'objet (vérifié côté outil sur 4 objets).
- Natures (types DofusDB, `superTypeId`) : rune = type 78 ; ressource = super-type 9 hors 78 ;
  consommable = super-types 6, 16, 70 ; équipement = super-types 1, 2, 3, 4, 5, 7, 10, 11, 12, 13, 22,
  23, 25, 69. Les autres super-types (quêtes, mutations, bénédictions, suiveurs, certificats) ne se
  vendent pas comme tels à l'HDV et sont refusés.
- Le site ne lit pas encore l'étiquette ; elle sert au tri et au suivi.
- Rien n'est appliqué en remote ni déployé sans l'accord du propriétaire.
