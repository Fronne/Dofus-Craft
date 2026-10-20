# Spécification : Refonte de la page Brisage, la recherche d'objet en premier

**Branche**: `065-refonte-page-brisage`

**Créée le**: 2026-10-20

**Statut**: Brouillon

**Entrée**: « Page Brisage plus simple : la recherche d'objet est le champ central et arrive en premier, avec un filtre repliable à la manière de la page Recherche (catégories d'équipement, niveau min/max, stats regroupées par Caractéristiques / Dommages / Résistances). Dessous, de petites cartes d'objets ; selon l'objet choisi, le tableau des runes se met à jour. On y choisit le prix de l'objet en Achat, Craft ou Auto, et le coefficient (déjà rempli si l'objet a déjà été brisé). Les informations annexes passent tout en bas. » Maquette de référence : planche « Brisage v2 » du canevas de design (`project/Brisage-recherche-v2.dc.html`).

Cette spec prolonge `specs/060-page-brisage` (modèle de calcul), `specs/061-simplification-page-brisage`, `specs/062-prix-objet-brisage`, `specs/063-brisage-sans-coefficient` et `specs/064-recherche-objets-par-stats`. Elle ne change **aucune règle de calcul** : elle réorganise la page et fusionne la recherche par nom et la recherche par stats en un seul endroit.

## Principe

Aujourd'hui la page Brisage empile beaucoup de champs et de blocs : le joueur ne sait pas par où commencer. La page doit se lire de haut en bas, dans l'ordre où l'on s'en sert :

1. **Trouver l'objet** : un champ de recherche par nom, et un panneau de filtres repliable.
2. **Choisir l'objet** : une rangée de petites cartes.
3. **Lire le brisage de cet objet** : prix de l'objet, coefficient, puis le tableau des runes par ligne.
4. **Aller plus loin** : les informations secondaires, sur une ligne, tout en bas.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Trouver un objet par son nom, en premier sur la page (Priorité : P1)

En ouvrant la page Brisage, le joueur voit en haut un champ de recherche d'objet, sans titre redondant au-dessus. Il tape le nom d'un objet et une rangée de cartes apparaît. Chaque carte montre l'icône, le nom, le niveau et le coefficient de l'objet (ou « à saisir » s'il n'a jamais été brisé). Les cartes sont limitées en nombre (environ 6 à la fois) ; un bouton « Afficher plus » en montre davantage, et le nombre total d'objets trouvés est indiqué.

**Pourquoi cette priorité** : c'est le point d'entrée de la page ; tout le reste en dépend.

**Test indépendant** : ouvrir la page, taper le début d'un nom d'objet connu, vérifier que sa carte apparaît parmi les premières, avec son nom, son niveau et son icône.

**Scénarios d'acceptation** :

1. **Étant donné** la page Brisage ouverte, **quand** elle s'affiche, **alors** le champ de recherche est le premier élément de contenu, sans autre titre ni bloc au-dessus.
2. **Étant donné** un nom saisi, **quand** des objets correspondent, **alors** une rangée d'environ 6 cartes s'affiche, avec « N objets trouvés » et « Afficher plus » s'il en reste.
3. **Étant donné** un objet déjà brisé par le joueur, **quand** sa carte s'affiche, **alors** elle montre son coefficient enregistré ; sinon elle indique « à saisir ».
4. **Étant donné** un nom qui ne correspond à aucun objet, **quand** la recherche aboutit, **alors** un message l'explique, sans carte ni tableau vide.

---

### User Story 2 - Choisir un objet et voir son brisage (Priorité : P1)

Le joueur clique une carte. La carte est mise en évidence et, dessous, l'objet choisi apparaît avec son icône, son nom et son niveau, puis le tableau de brisage existant : une ligne par effet de l'objet, avec le jet, la rune, son prix, les runes obtenues sans focus et avec focus, le sélecteur Min / Moyen / Max pour le jet et le total. Changer de carte met tout à jour.

**Pourquoi cette priorité** : c'est le résultat que le joueur vient chercher.

**Test indépendant** : cliquer deux cartes de suite et vérifier que le tableau correspond à chaque fois à l'objet de la carte active.

**Scénarios d'acceptation** :

1. **Étant donné** une rangée de cartes, **quand** le joueur en choisit une, **alors** elle est mise en évidence et le tableau affiche les lignes de cet objet.
2. **Étant donné** un objet choisi, **quand** le joueur choisit une autre carte, **alors** l'en-tête et le tableau passent à ce nouvel objet sans recharger la page.
3. **Étant donné** le tableau, **quand** il s'affiche, **alors** le jet de chaque ligne se règle uniquement en tapant un nombre (avec le minimum et le maximum de la ligne affichés de chaque côté) ou avec le sélecteur Min / Moyen / Max ; il n'y a pas de curseur à glisser.
4. **Étant donné** une ligne dont le jet est fixe, **quand** elle s'affiche, **alors** elle est indiquée comme fixe et n'offre pas de saisie.
5. **Étant donné** aucun objet choisi, **quand** la page s'affiche, **alors** ni tableau ni informations annexes ne sont affichés et une invitation à choisir un objet est visible.

---

### User Story 3 - Régler le prix de l'objet et le coefficient d'un coup d'œil (Priorité : P1)

Dans l'en-tête de l'objet choisi, le joueur choisit comment le prix de l'objet est pris : **Achat**, **Craft** ou **Auto** (le moins cher des deux). Le prix retenu est affiché, avec les deux prix d'origine en petit. À côté, le coefficient de brisage : pré-rempli avec la dernière valeur enregistrée si l'objet a déjà été brisé, sinon vide et à saisir.

**Pourquoi cette priorité** : ces deux réglages conditionnent tous les chiffres du tableau ; ils doivent être visibles sans chercher.

**Test indépendant** : sur un objet dont l'achat est plus cher que le craft, vérifier que « Auto » retient le craft et l'indique ; saisir un coefficient et vérifier que le tableau se met à jour.

**Scénarios d'acceptation** :

1. **Étant donné** « Auto » et deux prix connus, **quand** l'en-tête s'affiche, **alors** le plus bas est retenu et sa provenance (Achat ou Craft) est indiquée.
2. **Étant donné** « Auto » et un seul des deux prix connu, **quand** l'en-tête s'affiche, **alors** ce prix est retenu et l'autre est indiqué comme inconnu (jamais 0).
3. **Étant donné** un objet déjà brisé, **quand** il est choisi, **alors** le coefficient enregistré est pré-rempli et signalé comme tel ; sinon la case est vide et visuellement marquée « à saisir ».
4. **Étant donné** que le joueur change de mode de prix ou de coefficient, **quand** il valide, **alors** les valeurs du tableau sont recalculées et le choix est conservé à la prochaine visite.
5. **Étant donné** aucun coefficient saisi, **quand** le tableau s'affiche, **alors** il reste utilisable avec ce que le modèle existant permet sans coefficient (`specs/063`), sans inventer de valeur.

---

### User Story 4 - Filtrer par catégorie, niveau et stats, comme sur la page Recherche (Priorité : P2)

À droite du champ de recherche, un bouton « Filtres » ouvre ou replie un panneau, avec le nombre de filtres actifs. Le panneau contient :

- les **catégories** d'équipement en pastilles compactes : tous les équipements, arme, amulette, anneau, ceinture, bottes, chapeau, cape, bouclier, trophée ;
- le **niveau** minimum et maximum ;
- les **stats présentes sur l'objet**, en trois colonnes : **Caractéristiques** (dont tacle, fuite, esquive PA / PM, retrait PA / PM), **Dommages** et **Résistances**, avec devant chaque stat un emplacement pour son icône.

Les filtres actifs restent visibles sous forme de pastilles retirables d'un clic, même panneau replié, avec un bouton pour tout réinitialiser. Les cartes ne montrent que les objets qui répondent à tous les filtres (et au nom saisi, s'il y en a un).

**Pourquoi cette priorité** : la recherche par nom suffit pour commencer ; les filtres permettent de partir d'une envie (« une cape niveau 150-200 avec de la Sagesse »), ce que couvrait la recherche par stats de `specs/064`.

**Test indépendant** : cocher « Cape » et « Sagesse », fixer un niveau 150-200, et vérifier que toutes les cartes sont des capes de ce niveau avec un jet positif en Sagesse.

**Scénarios d'acceptation** :

1. **Étant donné** le panneau replié, **quand** des filtres sont actifs, **alors** ils restent visibles en pastilles et le bouton Filtres affiche leur nombre.
2. **Étant donné** une catégorie, un niveau et une ou plusieurs stats choisis, **quand** les cartes s'affichent, **alors** chaque objet respecte tous les filtres (plusieurs stats : l'objet les porte toutes, règle de `specs/064`).
3. **Étant donné** une pastille de filtre, **quand** le joueur la retire, **alors** le filtre disparaît et les cartes sont mises à jour.
4. **Étant donné** les stats proposées, **quand** le panneau s'ouvre, **alors** seules les stats ciblables de `specs/064` y figurent, regroupées dans les trois colonnes.
5. **Étant donné** une plage de niveaux inversée, **quand** elle est saisie, **alors** elle est corrigée ou refusée avec un message, sans planter.
6. **Étant donné** des filtres sans nom saisi, **quand** les cartes s'affichent, **alors** elles sont triées comme dans `specs/064` (runes ciblées estimées), et sans stat choisie, par niveau décroissant.

---

### User Story 5 - Les informations secondaires en bas de page (Priorité : P3)

Sous le tableau, sur une ligne compacte, le joueur trouve les informations annexes : le coefficient actuel de l'objet puis celui prévu après 1, 2 et 3 brisages s'il continue à le briser. Ces informations ne prennent pas le pas sur le reste de la page.

**Pourquoi cette priorité** : utile, mais secondaire pour la décision.

**Test indépendant** : choisir un objet avec un coefficient et vérifier que les quatre valeurs s'affichent en une ligne sous le tableau, identiques à celles que la page affichait avant la refonte.

**Scénarios d'acceptation** :

1. **Étant donné** un objet et un coefficient connus, **quand** le bas de page s'affiche, **alors** les coefficients actuel, après 1, 2 et 3 brisages sont affichés sur une seule ligne.
2. **Étant donné** aucun coefficient connu, **quand** le bas de page s'affiche, **alors** cette ligne est absente ou explique ce qu'il faut saisir, sans valeur inventée.

---

### Cas limites

- Aucun objet ne correspond aux filtres : message explicatif avec proposition de retirer un filtre, pas de zone vide muette.
- Données d'objets indisponibles ou partielles : la page le dit et affiche ce qu'elle a, sans présenter une liste incomplète comme complète (comme `specs/064`).
- Objet choisi puis filtres modifiés de sorte qu'il n'est plus listé : l'objet choisi reste affiché tant que le joueur n'en choisit pas un autre.
- Prix d'achat ou de craft manquant : jamais traité comme 0 ; le mode « Auto » se rabat sur l'autre prix s'il existe.
- Écran étroit (téléphone) : les cartes, le panneau de filtres (colonnes de stats l'une sous l'autre) et le tableau (défilement horizontal) restent utilisables, sans débordement de la page.
- Retour sur la page ou rechargement : l'objet choisi, le mode de prix, les coefficients, les filtres et l'état replié/déplié du panneau sont retrouvés comme avant la refonte.
- Objets de même nom (versions ou doublons) : restent distincts.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La page Brisage MUST afficher en premier contenu un champ de recherche d'objet par nom, avec à sa droite un bouton « Filtres » indiquant le nombre de filtres actifs, et MUST NOT afficher de titre de page redondant.
- **FR-002** : Le panneau de filtres MUST pouvoir être replié et déplié, et MUST proposer les catégories d'équipement de la page Recherche (dont les trophées), un niveau minimum et maximum, et les stats ciblables regroupées en trois colonnes (Caractéristiques, Dommages, Résistances) avec un emplacement d'icône par stat.
- **FR-003** : Les tacle, fuite, esquive PA/PM et retrait PA/PM MUST figurer dans la colonne Caractéristiques.
- **FR-004** : Les filtres actifs MUST rester visibles panneau replié, être retirables un par un et réinitialisables ensemble.
- **FR-005** : La page MUST afficher les objets correspondant au nom et aux filtres sous forme de cartes (icône, nom, niveau, coefficient ou « à saisir »), environ 6 à la fois, avec le nombre total trouvé et un moyen d'en afficher davantage.
- **FR-006** : Plusieurs stats choisies MUST ne garder que les objets qui les portent toutes ; les règles d'éligibilité des stats, de combinaison et de tri de `specs/064` MUST rester inchangées.
- **FR-007** : Choisir une carte MUST la mettre en évidence et afficher, dessous, l'en-tête et le tableau de brisage de cet objet ; en changer MUST mettre à jour tout ce qui en dépend.
- **FR-008** : L'en-tête de l'objet MUST permettre de choisir le mode de prix Achat / Craft / Auto, afficher le prix retenu avec sa provenance et les deux prix d'origine, et MUST traiter un prix manquant comme inconnu, jamais comme 0.
- **FR-009** : L'en-tête MUST afficher le coefficient de l'objet, pré-rempli s'il a déjà été brisé, sinon vide et signalé « à saisir », en distinguant la valeur saisie ou enregistrée d'une valeur dérivée.
- **FR-010** : Le tableau de brisage existant MUST être conservé (jet, rune, prix de la rune, runes et valeur sans focus, runes et gain avec focus, sélecteur Min/Moyen/Max, total), à l'exception des curseurs de jet, qui MUST NOT être présents : le jet se règle en saisissant un nombre, le minimum et le maximum de la ligne étant affichés.
- **FR-011** : Les informations annexes (coefficient actuel puis après 1, 2 et 3 brisages) MUST être regroupées sur une ligne compacte en bas de page.
- **FR-012** : Les calculs (runes, valeurs, gains, total, projection des coefficients) MUST rester identiques à ceux d'avant la refonte pour les mêmes entrées (constitution II) ; la refonte ne modifie que l'organisation et la présentation.
- **FR-013** : Les données enregistrées du joueur (coefficients, mode de prix, séances, préférences de recherche) MUST rester lues et écrites sans perte ni migration visible ; l'état des filtres et l'objet choisi MUST être retrouvés au retour sur la page.
- **FR-014** : La page MUST rester utilisable au clavier et sur écran étroit, avec des libellés explicites sur les boutons d'icône, les cartes et les pastilles.
- **FR-015** : La page MUST indiquer clairement les données indisponibles ou incomplètes (objets, prix, effets) et MUST NOT fabriquer de valeur (constitution I, III).

### Entités clés

- **Filtre de recherche** : nom saisi, catégorie, plage de niveaux, stats choisies ; état replié ou déplié du panneau.
- **Carte d'objet** : un résultat de recherche (identifiant stable, nom, niveau, icône) avec le coefficient enregistré de l'objet, s'il existe.
- **Objet choisi** : la carte active, avec son mode de prix (Achat / Craft / Auto), son prix retenu et son coefficient.
- **Ligne de brisage** : un effet de l'objet avec son jet, sa rune et les résultats sans focus et avec focus.
- **Projection de coefficient** : coefficient actuel et coefficients après 1, 2 et 3 brisages.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Un joueur qui connaît le nom de l'objet affiche son tableau de brisage en 3 actions ou moins (taper le nom, cliquer la carte, lire le tableau).
- **SC-002** : Le champ de recherche est visible sans défiler sur un écran d'ordinateur courant, et le tableau de brisage de l'objet choisi commence dans la première hauteur et demie d'écran.
- **SC-003** : Pour les mêmes entrées, 100 % des valeurs du tableau et de la projection de coefficients sont identiques à celles d'avant la refonte.
- **SC-004** : Le mode de prix et le coefficient se règlent sans quitter l'en-tête de l'objet, et chaque changement met à jour le tableau en moins de 1 seconde.
- **SC-005** : Les mêmes critères que `specs/064` (catégorie, niveau, stats) donnent exactement les mêmes objets qu'avant, et 0 objet listé ne manque à une règle de filtrage.
- **SC-006** : Aucun prix inconnu n'est présenté comme 0 et aucun coefficient absent n'est présenté comme une valeur.
- **SC-007** : La page est utilisable sans défilement horizontal de la page à 390 px de large (seul le tableau peut défiler dans son cadre).

## Hypothèses

- Le périmètre est la page Brisage ; les autres pages ne changent pas.
- La recherche par nom et la recherche par stats de `specs/064` sont fusionnées en une seule : le nom, les catégories, le niveau et les stats se combinent dans la même liste de cartes. Le tri par valeur en kamas ou par jet maximal de `specs/064` reste disponible dans le panneau de filtres.
- Les catégories d'équipement sont celles de la page Recherche ; si une catégorie n'a pas d'équivalent dans les données d'objets, elle est signalée plutôt qu'inventée.
- Le calcul du brisage, des poids de runes, du coefficient et des prix (`specs/060` à `specs/064`) est réutilisé tel quel.
- Le mode « Auto » retient le prix le plus bas parmi les prix connus (achat et craft) ; son comportement existant (`specs/062`) est conservé.
- Les icônes des stats seront fournies par le propriétaire du projet ; en attendant, un emplacement réservé neutre est affiché.
- L'icône des objets est celle déjà utilisée par le site ; en son absence, un visuel de remplacement est affiché.
- Le design suit la planche « Brisage v2 » du canevas et la charte retenue pour la page Recherche (version 3) ; le détail visuel peut être ajusté à la réalisation sans changer les exigences.
- Les préférences (filtres, mode de prix, objet choisi) sont propres au navigateur du joueur ; aucune donnée personnelle supplémentaire n'est collectée (constitution V).
