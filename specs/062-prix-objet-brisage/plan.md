# Plan d'implémentation : Prix de l'objet sur la page Brisage (HDV ou craft)

**Branche** : `062-prix-objet-brisage` | **Date** : 2026-10-20 | **Spec** : [spec.md](spec.md)

**Constitution** : I (aucune valeur fabriquée, provenance du prix), II (calcul du prix de craft testé :
normal, bornes, incomplet), III (provenance visible, saisie distinguée du dérivé), IV (changement
cohésif : une source de prix en plus, pas de refonte), V (choix gardé sur l'appareil, `localStorage`
tolérant aux erreurs).

## Résumé

Sur `BrisagePage`, le « Coût de l'objet » devient « Prix de l'objet ». Un sélecteur à deux choix
choisit la source : **Prix HDV** (comportement actuel, `useItemCost`) ou **Prix de craft** (nouveau
hook `useItemCraftCost`, qui calcule la chaîne de craft complète avec les mêmes briques que la page
Épingles). Le choix est mémorisé dans `BrisageSession`. Les formules de `src/domain/brisage.ts` ne
changent pas : seul le montant passé à `analyzeBrisage` change de source.

## Technical Context

**Langage** : TypeScript, React/Vite · **Tests** : vitest (unit + integration)
**Stockage** : `localStorage` (`craftcheck-brisage-session`, un champ `priceSource` ajouté, valeur
absente = `hdv`) ; prix lus dans IndexedDB / API communautaire existants
**Plateforme** : web (mobile + desktop) · **Type** : web-app, pas de Worker, pas de migration
**Contraintes** : aucune valeur inventée ; craft incomplet → message + saisie manuelle ; aucun nouvel
endroit pour noter les prix de ressources

## Constitution Check

- I : craft incomplet ou sans recette → aucun total partiel présenté comme complet ; mention de provenance.
- II : le calcul pur (arbre + carnet → coût complet/incomplet) est une fonction testée à part ; réutilise `compare` et `effectiveIngredientPrices` déjà testés.
- III : la provenance (« Prix noté sur Recherche » / « Coût de la chaîne de craft » / « Saisi à la main ») est affichée sous le montant.
- IV : pas de modification des formules de brisage ni des pages Épingles/Recherche ; le calcul de la chaîne est factorisé seulement si l'extraction est mécanique (voir research.md, D2).
- V : un seul champ ajouté à la session locale, lecture tolérante.
Aucune violation, pas de Complexity Tracking.

## Project Structure

```text
specs/062-prix-objet-brisage/
├── plan.md · research.md · data-model.md · quickstart.md · tasks.md (étape suivante)
```

```text
src/features/brisage/useItemCraftCost.ts      NEW  coût de la chaîne de craft d'un objet (serveur, objet, mode de prix)
src/features/brisage/useItemCost.ts           inchangé (prix HDV)
src/features/brisage/BrisagePage.tsx          libellés « Prix de l'objet », sélecteur HDV/craft, prix retenu
src/persistence/brisage-session.ts            + priceSource ('hdv' | 'craft'), défaut 'hdv'
src/styles/global.css                         style du sélecteur à deux choix
tests/unit/brisage-session.test.ts            + priceSource (valeur absente, valeur invalide)
tests/unit/item-craft-cost.test.ts            NEW  chaîne complète, ressource manquante, sans recette, prix nul
tests/integration/brisage-page.test.tsx       + bascule HDV/craft, craft incomplet, saisie manuelle, rechargement
```

**Structure Decision** : projet web unique existant ; aucune nouvelle dépendance.

## Parcours de la page

1. Objet choisi → bloc « Prix de l'objet » avec sélecteur **Prix HDV | Prix de craft** (HDV par défaut).
2. HDV : prix noté sur Recherche ; sinon message + champ de saisie (comportement actuel).
3. Craft : état d'attente, puis coût complet de la chaîne ; sinon « prix de craft incomplet » (ou « pas de recette ») + champ de saisie.
4. La saisie manuelle est un champ unique, commun aux deux choix, conservé quand on bascule.
5. Verdict, gains, cartes et total de l'objet utilisent le prix retenu ; le choix est mémorisé dans la session.
