# Quickstart: Valider l'affichage façon tooltip des armes

## Prérequis

- Dépendances installées (`npm install`), aucune nouvelle dépendance ajoutée par cette
  fonctionnalité.
- Le serveur de dev peut rester lancé d'une session à l'autre (`npm run dev`).

## Validation automatisée

```sh
npm run test -- catalogue-repository item-detail
```

Résultat attendu : les tests du mapping DofusDB → `ItemStat`/`WeaponInfo` (répartition
`isWeaponEffect`, portée fixe vs intervalle, absence de `weaponInfo` pour un objet non-arme) et
les tests du rendu `ItemDetail` (sections "Effets de l'arme" / "Effets" affichées ou masquées
selon leur contenu) passent tous.

```sh
npm run typecheck
```

## Validation manuelle (scénarios de la spec)

1. Lancer `npm run dev` et ouvrir la fiche d'une arme connue pour avoir à la fois des dommages
   élémentaires et des bonus de caractéristiques (ex. "Masse Étacée", niveau 200 — cf. capture
   fournie dans la spec).
   → Un bloc d'informations affiche le coût en PA, la portée, le nombre de lancers par tour, le
   taux de critique et le bonus critique, avant la liste des effets (US1).
2. Sur la même fiche, vérifier que les lignes de dommages/vol (avec l'icône élémentaire) sont
   regroupées sous "Effets de l'arme", et que les bonus de caractéristiques (Vitalité, Force,
   Chance, etc.) sont sous "Effets" (US2).
3. Ouvrir la fiche d'une arme à portée fixe (`minRange === range`, ex. une arme de mêlée à portée 1)
   → la portée s'affiche comme une valeur unique, pas comme un intervalle (US1 scénario 2).
4. Ouvrir la fiche d'une arme à portée variable (ex. un arc)
   → la portée s'affiche comme un intervalle (US1 scénario 3).
5. Ouvrir la fiche d'un objet qui n'est pas une arme (ressource ou équipement sans dommages)
   → l'affichage reste inchangé : une seule section "Effets" regroupant tout (US2 scénario 3,
   FR-005), aucun bloc d'informations de combat.
6. Ouvrir la fiche d'une arme dont une donnée de combat serait absente côté DofusDB (à défaut
   d'exemple réel, vérifier dans le code que le champ est bien omis et non remplacé par une
   valeur par défaut) → la ligne correspondante n'apparaît pas dans le bloc d'informations
   (FR-008).

## Référence

- Répartition des effets et origine des champs de combat : voir [data-model.md](./data-model.md)
- Décisions de conception (détection d'une arme, limites sur la zone d'effet) : voir
  [research.md](./research.md)
