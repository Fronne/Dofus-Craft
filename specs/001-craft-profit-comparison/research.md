# Research: Comparaison rentabilité craft

## Client web et langage

**Decision**: Utiliser React 19 avec TypeScript, assemblé par Vite, dans une application web
monopage.

**Rationale**: Le produit est une interface interactive centrée sur la recherche, la saisie de prix
et le recalcul immédiat. React structure naturellement cette interface en composants et TypeScript
protège les contrats de recette, de prix et de calcul. React documente TypeScript comme un chemin
supporté, et son guide de démarrage recommande notamment un modèle React TypeScript avec Vite pour
partir d'une application depuis zéro.

**Alternatives considered**:

- Un framework avec rendu serveur : rejeté car le MVP ne nécessite ni compte, ni contenu dynamique
  serveur, ni référencement de pages publiques.
- JavaScript sans typage : rejeté car les quantités, identifiants stables et résultats partiels
  doivent rester cohérents lors des évolutions de données.
- Application native : rejetée car l'exigence porte d'abord sur une expérience web responsive.

## Persistance des prix personnels

**Decision**: Stocker les prix de ressources et leur date de modification dans IndexedDB, derrière
un dépôt `ResourcePriceRepository`.

**Rationale**: IndexedDB stocke de façon asynchrone des données structurées dans le navigateur,
avec clés et transactions. Il convient mieux qu'un stockage clé-valeur minimal pour des prix
identifiés par ressource et une évolution future vers favoris ou historique. Le dépôt isole ce
choix de la logique métier et prépare une synchronisation future sans exposer de détail de stockage
à l'interface.

**Alternatives considered**:

- Web Storage : rejeté car il est moins adapté à des données structurées et extensibles.
- Base de données et API distantes : rejetées pour le MVP sans compte ; elles augmenteraient les
  données collectées, la surface de sécurité et les coûts sans besoin actuel.
- État en mémoire seulement : rejeté car il ne respecte pas la persistance demandée.

## Calcul de rentabilité et données incomplètes

**Decision**: Centraliser le calcul dans une fonction pure qui retourne un résultat explicable,
incluant sous-totaux, ressources sans prix, statut de comparaison, écart et pourcentage éventuel.

**Rationale**: La constitution impose des règles explicitement testables et une recommandation
jamais définitive avec un coût incomplet. Un résultat structuré permet d'afficher les mêmes faits
sur tout écran et de tester chaque état sans dépendre de l'interface.

**Alternatives considered**:

- Calculer directement dans les composants : rejeté car la règle serait dupliquée, plus difficile
  à tester et moins explicable.
- Masquer les résultats partiels : rejeté car le joueur perdrait les informations déjà connues.
- Estimer les ressources sans prix : rejeté car cela fabriquerait des données contraires à la
  constitution.

## Qualité et tests

**Decision**: Employer Vitest pour les tests unitaires et d'intégration, React Testing Library pour
les interactions accessibles, et Playwright pour les parcours dans un navigateur réel.

**Rationale**: Vitest partage la configuration Vite et prend en charge TypeScript/JSX. Testing
Library favorise des tests proches de l'usage réel. Playwright attend automatiquement les éléments
prêts à être utilisés, ce qui rend les scénarios de saisie et de responsive plus représentatifs.

**Alternatives considered**:

- Tests manuels uniquement : rejetés car les calculs et la réutilisation de prix exigent une
  couverture de régression fiable.
- Un seul niveau de test : rejeté car les fonctions de calcul et les parcours mobile complet ont
  des besoins de vérification distincts.

## Données de catalogue et visuels

**Decision**: Livrer un catalogue versionné avec un manifeste de provenance ; traiter les visuels
comme facultatifs et afficher un repli textuel accessible lorsqu'ils sont absents.

**Rationale**: Le catalogue doit fonctionner sans dépendance externe au MVP, tout en respectant la
traçabilité. Un manifeste rend l'âge et la source des données vérifiables ; le repli permet de
continuer à identifier un objet en l'absence de visuel.

**Alternatives considered**:

- Télécharger le catalogue à chaque ouverture : rejeté pour éviter les résultats indisponibles ou
  silencieusement périmés sans mécanisme de fiabilité défini.
- Rendre un visuel obligatoire : rejeté car des données de visuel peuvent être incomplètes.
