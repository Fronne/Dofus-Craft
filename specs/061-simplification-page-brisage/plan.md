# Implementation Plan: Simplification de la page Brisage

**Branch**: `061-simplification-page-brisage` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Constitution** : I (aucune valeur fabriquée), II (tests des fonctions pures), III (estimations visibles),
IV (changement cohésif : on retire de l'interface, on ne touche pas aux formules), V (données locales,
`localStorage` tolérant aux erreurs).

## Summary

Réécrire l'interface de `BrisagePage` : choix d'un objet → coût repris du prix épinglé en base
(page Recherche), niveau et jets moyens repris de l'objet, dernier coefficient mémorisé par objet.
Le résultat tient en quatre infos (verdict, nombre de brisages, coefficient minimal, meilleure rune).
Les formules de `src/domain/brisage.ts` (H1–H4) restent inchangées.

## Technical Context

**Language/Version** : TypeScript, React/Vite · **Testing** : vitest (unit + integration)
**Storage** : `localStorage` (dernier coefficient par serveur+objet) ; prix lus dans IndexedDB / API communautaire existants
**Target Platform** : web (mobile + desktop) · **Project Type** : web-app, pas de Worker ni de migration
**Constraints** : aucun nouveau réglage utilisateur ; données manquantes → message, jamais de valeur inventée

## Constitution Check

- I : coût et prix de runes absents → message explicite ; coefficient jamais présumé (champ vide tant que non saisi).
- II : jet moyen et mémoire du coefficient sont des fonctions pures testées ; formules existantes déjà testées.
- III : bandeau d'estimation conservé, raccourci.
- IV : pas de modification des formules ; réglages avancés retirés de l'UI et du stockage (code mort supprimé).
- V : mémoire du coefficient sur l'appareil, try/catch autour de `localStorage`.
Aucune violation, pas de Complexity Tracking.

## Project Structure

```text
specs/061-simplification-page-brisage/
├── plan.md · research.md · data-model.md · quickstart.md · tasks.md (étape suivante)
```

```text
src/domain/brisage.ts                      + averageRoll(from, to) ; + averageLines()
src/data/catalogue-repository.ts           + getItemEffectRanges(id) : { effectId, from, to }[]
src/persistence/brisage-coefficients.ts    NEW  dernier coefficient + date par (serveur, objet)
src/persistence/brisage-settings.ts        SUPPRIMÉ (réglages retirés de l'UI)
src/features/brisage/BrisagePage.tsx       réécrit : objet · coefficient · lignes · résultat
src/features/brisage/useItemCost.ts        NEW  prix épinglé de l'objet (carnet de la base)
src/styles/global.css                      retrait des styles inutilisés (.brisage-curve*, tables)
tests/unit/brisage.test.ts                 + jets moyens
tests/unit/brisage-coefficients.test.ts    NEW
tests/unit/brisage-settings-persistence.test.ts  SUPPRIMÉ
tests/integration/brisage-page.test.tsx    réécrit pour le nouveau parcours
```

**Structure Decision** : projet web unique existant ; aucune nouvelle dépendance.

## Parcours de la page

1. Recherche d'objet (réutilise `useEquipmentSearch`) → sélection.
2. Bloc **Objet** : nom, niveau (lecture seule), coût (prix épinglé ; champ de saisie seulement s'il manque).
3. Bloc **Coefficient** : « Dernier coefficient : X % (date) » + champ pour le mettre à jour ; sinon champ vide demandé.
4. Bloc **Lignes** : une ligne par stat avec son jet moyen en champ modifiable (placeholder = moyenne, « moyen » / « modifié »).
5. Bloc **Résultat** (visible dès que coût + coefficient + prix de runes sont connus) : 4 tuiles — verdict, brisages avant seuil, coefficient minimal, meilleure option de focus.
6. Prix de runes absents : liste des runes concernées, sans champ de saisie.
