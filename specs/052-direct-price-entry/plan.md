# Implementation Plan: Champs de prix à saisie directe

**Branch**: `051-site-visual-refresh` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

## Summary

Les deux champs de prix du site (`ResourcePriceInput`, `MarketPriceInput`) perdent leur état
verrouillé et leur bouton « Modifier ». Ils partagent un même hook de saisie : sélection du contenu
au focus, enregistrement à la sortie si la valeur a changé, Échap pour annuler, et rattrapage quand
la page se décharge.

## Technical Context

**Language/Version**: TypeScript 5, React 19

**Primary Dependencies**: aucune nouvelle

**Storage**: inchangé (carnet IndexedDB en Mode personnel, API des prix partagés en Mode communautaire)

**Testing**: Vitest + Testing Library

**Constraints**: aucun changement de calcul ; aucun changement de l'API

## Constitution Check

- Transparence des calculs (principe III) : inchangée, les calculs suivent toujours le montant affiché.
- Données du joueur : rien de plus n'est envoyé ; un prix n'est partagé que s'il a changé, et jamais
  au déchargement s'il demanderait une confirmation.
- Pas de violation.

## Décisions

1. **Un hook `usePriceEntry`** (`src/features/comparison/usePriceEntry.ts`) porte la logique commune
   aux deux champs, aujourd'hui dupliquée : valeur de départ de la saisie, drapeau « tapé », Entrée,
   Échap, sortie, déchargement. *Alternative écartée* : corriger les deux composants séparément — la
   duplication existante avait déjà fait diverger les commentaires.
2. **Début de saisie** : la valeur de départ est prise à la première frappe (et non au focus), comme
   aujourd'hui, pour qu'un prix du groupe arrivé pendant que le champ a le focus ne passe pas pour une
   modification du joueur.
3. **Sélection au focus** : `select()` au focus ; le relâchement de souris qui suit est neutralisé une
   fois, sinon certains navigateurs retirent la sélection.
4. **Déchargement** : évènement `pagehide` seulement. Le passage en arrière-plan (`visibilitychange`)
   est écarté : le joueur passe souvent sur la fenêtre du jeu au milieu d'une saisie, et un montant
   incomplet serait partagé. Le partage part avec `keepalive` pour survivre au déchargement.
5. **Déchargement en Mode communautaire** : une prop `onUnloadCommit` distincte de `onCommit`, qui ne
   peut pas ouvrir de confirmation ; elle ne partage pas un prix qui en demanderait une.
6. **Prop `lockWhenFilled` supprimée** : la présence de `onCommit` suffit à dire que la sortie du champ
   partage le prix.

## Project Structure

```text
src/features/comparison/
├── usePriceEntry.ts               # nouveau : logique de saisie commune
├── ResourcePriceInput.tsx         # plus de verrou ni de bouton
├── MarketPriceInput.tsx           # idem
├── CommunityResourcePriceRow.tsx  # onUnloadCommit sans confirmation
src/features/search/RecherchePage.tsx   # prix HDV : onUnloadCommit
src/services/community-price-api.ts     # keepalive sur l'envoi d'un prix
src/styles/global.css                   # retrait du style du bouton Modifier
tests/unit/resource-price-input.test.tsx # cas de saisie directe et de déchargement
tests/unit/resource-price-input.test.tsx, tests/integration/* # adaptation (plus de bouton)
specs/004, specs/016                    # note de remplacement
DESIGN.md
```
