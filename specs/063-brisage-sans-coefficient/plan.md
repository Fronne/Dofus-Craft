# Plan d'implémentation : Brisage sans coefficient connu (focus conseillé)

**Branche** : `063-brisage-sans-coefficient` | **Date** : 2026-10-20 | **Spec** : [spec.md](spec.md)

**Constitution** : I (aucune valeur fabriquée : la colonne « Sans focus » est étiquetée « à 100 % »),
II (calcul du meilleur focus et du seuil testé, dont la cohérence avec `analyzeBrisage`), III (valeur de
référence distinguée d'un résultat réel), IV (changement cohésif : une fonction de domaine en plus, les
formules existantes ne changent pas), V (rien de nouveau à stocker).

## Résumé

Aujourd'hui `BrisagePage` n'affiche le tableau qu'une fois le coefficient connu. Sans coefficient, on
affiche le tableau avec une analyse « sans coefficient » : la valeur du brisage normal est calculée à
100 % (référence), le focus de chaque ligne ne dépend pas du coefficient, et le **coefficient de
bascule** `100 × valeur du meilleur focus / valeur du brisage normal à 100 %` dit à partir de quel
coefficient il vaut mieux briser sans focus. Le prix de l'objet s'annule dans cette comparaison. Dès
qu'un coefficient est connu, l'affichage actuel est inchangé.

## Technical Context

**Langage** : TypeScript, React/Vite · **Tests** : vitest (unit + integration)
**Stockage** : aucun changement · **Plateforme** : web (mobile + desktop), pas de Worker, pas de migration
**Contraintes** : aucune valeur inventée ; prix de rune manquant → pas de conseil ; prix de l'objet
inconnu → conseil gardé, valeurs en runes à la place des gains

## Constitution Check

- I : sans coefficient, pas de verdict « Rentable / Pas rentable » ; la référence à 100 % est nommée comme telle.
- II : `analyzeFocusAdvice` testée à part (base, prix manquant, égalité, une ligne, cohérence autour du seuil).
- III : étiquette « à 100 % (référence) » sur la colonne, bloc « Conseil » distinct du verdict.
- IV : `analyzeBrisage` et `nextCoefficient` inchangés ; réutilise `buildOption`.
- V : rien de stocké en plus.
Aucune violation, pas de Complexity Tracking.

## Project Structure

```text
specs/063-brisage-sans-coefficient/
├── plan.md · research.md · data-model.md · quickstart.md · tasks.md (étape suivante)
```

```text
src/domain/brisage.ts                       + analyzeFocusAdvice (meilleur focus, référence à 100 %, coefficient de bascule)
src/features/brisage/BrisagePage.tsx        tableau et bloc « Conseil » affichés sans coefficient ; colonne « Sans focus » étiquetée
src/styles/global.css                       style du bloc « Conseil » (réutilise les classes verdict existantes si possible)
tests/unit/brisage-advice.test.ts           NEW  calcul pur
tests/integration/brisage-page.test.tsx     + sans coefficient : tableau, ligne conseillée, seuil, retour à l'affichage complet
```

**Structure Decision** : projet web unique existant ; aucune nouvelle dépendance.

## Parcours de la page

1. Objet choisi, pas de coefficient : le bloc d'entrée reste identique (saisie du coefficient).
2. Le tableau s'affiche : Rune, Jet, Prix unitaire, « Sans focus (à 100 %) » runes + valeur, « Avec focus » runes + gain (ou valeur si le prix de l'objet manque).
3. Le bloc « Conseil » remplace le verdict : « Focus {rune} tant que le coefficient est sous X % ; au-dessus, brisez sans focus. »
4. Le joueur saisit le coefficient : la page repasse au verdict, aux gains et aux cartes actuels.
