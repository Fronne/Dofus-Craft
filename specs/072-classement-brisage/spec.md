# Spécification : Classement des objets les plus rentables à briser

**Branche**: `072-classement-brisage`

**Créée le**: 2026-10-23

**Statut**: Brouillon

**Entrée**: « Onglet "Classement" dans la page Brisage, à côté de la fiche objet actuelle. Il liste les objets à briser du plus rentable au moins rentable (gain par objet, prix de l'objet déduit, meilleur choix sans focus ou avec focus, seuil de coefficient), avec les mêmes formules que le verdict existant. Tri par colonne : important. Indication de fraîcheur des prix (objet et runes) et des coefficients : souhaitée. Filtres : niveau, type d'objet, gain minimum, masquer les objets sans prix ou sans coefficient ; un objet sans coefficient connu est signalé. Un clic sur une ligne ouvre l'objet dans la fiche actuelle. Pas de gain par heure. Accès réservé au propriétaire : réglage simple "visible seulement pour moi" enregistré dans son navigateur ; l'onglet est masqué pour tous les autres jusqu'à ce que le propriétaire change ce réglage. »

Cette spec prolonge la fiche objet de `specs/061-simplification-page-brisage` et `specs/063-brisage-sans-coefficient` (mêmes formules, mêmes résultats), `specs/062-prix-objet-brisage` (prix de l'objet) et `specs/069-coefficients-brisage-partages` (coefficients partagés). Tous les montants affichés restent des **estimations** issues de formules non officielles (`specs/060-page-brisage`).

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Voir d'un coup d'œil les objets les plus rentables à briser (Priorité : P1)

Le propriétaire ouvre l'onglet Classement de la page Brisage et obtient la liste des objets dont le prix est connu, du plus rentable au moins rentable. Chaque ligne donne : l'objet, son niveau, le gain par objet (prix de l'objet déduit), le meilleur choix (sans focus ou focus sur une rune précise) et le coefficient jusqu'auquel le brisage reste rentable.

**Pourquoi cette priorité** : c'est la demande de départ ; aujourd'hui il faut ouvrir les objets un par un pour savoir lesquels valent la peine.

**Test indépendant** : avec trois objets dont le prix et le coefficient sont connus, le classement les affiche dans l'ordre décroissant du gain, et le gain de chaque ligne est identique à celui du verdict de la fiche de cet objet.

**Scénarios d'acceptation** :

1. **Étant donné** plusieurs objets au prix connu, **quand** j'ouvre le Classement, **alors** ils sont listés du gain le plus élevé au plus faible par défaut.
2. **Étant donné** un objet du classement sans ligne négative, **quand** je compare avec sa fiche (même serveur, même mode de prix, prix HDV, mêmes jets moyens), **alors** le gain, le meilleur choix et le seuil de coefficient sont les mêmes.
3. **Étant donné** un objet qui ne couvre pas son prix même avec le meilleur choix, **quand** il apparaît, **alors** son gain est négatif et affiché comme une perte, en bas du classement par défaut.
4. **Étant donné** que le serveur de jeu actif change, **quand** le classement se met à jour, **alors** il n'utilise que les prix et coefficients de ce serveur.

---

### User Story 2 - Trier par colonne (Priorité : P1)

Le propriétaire clique sur l'en-tête d'une colonne (gain, niveau, seuil de coefficient, nom…) pour trier le classement selon cette colonne ; un second clic inverse l'ordre.

**Pourquoi cette priorité** : demandé explicitement comme important ; le gain n'est pas le seul critère (par exemple chercher les objets de haut niveau ou ceux qui restent rentables à bas coefficient).

**Test indépendant** : cliquer sur « Niveau » trie par niveau croissant, cliquer à nouveau le trie par niveau décroissant ; l'en-tête actif indique le sens du tri.

**Scénarios d'acceptation** :

1. **Étant donné** le classement affiché, **quand** je clique sur l'en-tête d'une colonne triable, **alors** les lignes sont triées selon cette colonne et l'en-tête indique le sens.
2. **Étant donné** une colonne déjà triée, **quand** je clique à nouveau dessus, **alors** l'ordre est inversé.
3. **Étant donné** des lignes dont la valeur de la colonne triée est inconnue (par exemple un seuil non calculable), **quand** je trie, **alors** elles sont toujours placées à la fin, quel que soit le sens.
4. **Étant donné** un tri choisi, **quand** je change un filtre, **alors** le tri est conservé.

---

### User Story 3 - Savoir à quel point les chiffres sont frais et fiables (Priorité : P2)

Chaque ligne indique l'ancienneté du prix de l'objet, des prix de runes utilisés et du coefficient, pour que le propriétaire sache s'il peut se fier au gain affiché. Un objet sans coefficient connu est signalé comme tel : il est classé à part (voir l'histoire 7) et son gain n'est jamais présenté comme un résultat précis.

**Pourquoi cette priorité** : un classement trompeur coûte des kamas ; c'est le principe de données traçables et jamais inventées de la constitution du projet.

**Test indépendant** : un objet dont le coefficient date de plusieurs jours montre cette ancienneté ; un objet sans coefficient porte la mention « coefficient inconnu ».

**Scénarios d'acceptation** :

1. **Étant donné** une ligne, **quand** elle s'affiche, **alors** l'ancienneté du prix de l'objet, celle de la rune la plus ancienne utilisée et celle du coefficient y sont lisibles.
2. **Étant donné** un objet sans coefficient connu, **quand** il s'affiche, **alors** il est signalé « coefficient inconnu ».
3. **Étant donné** un objet dont une rune nécessaire n'a pas de prix, **quand** il s'affiche, **alors** son gain n'est pas inventé : la ligne indique « prix de rune manquant » et se classe à la fin.
4. **Étant donné** un prix ou un coefficient particulièrement ancien (au-delà d'un seuil de péremption défini en hypothèse), **quand** la ligne s'affiche, **alors** il est mis en évidence comme périmé.

---

### User Story 4 - Filtrer le classement (Priorité : P2)

Le propriétaire restreint la liste par niveau (minimum et maximum), par type d'objet, par gain minimum, et peut masquer les objets sans prix connu ou sans coefficient connu.

**Pourquoi cette priorité** : la liste complète est longue ; on veut surtout voir les objets utiles à son niveau de jeu et assez rentables.

**Test indépendant** : régler le gain minimum à 5 000 k retire tous les objets en dessous ; cocher « masquer les objets sans coefficient » retire ceux qui portent la mention « coefficient inconnu ».

**Scénarios d'acceptation** :

1. **Étant donné** un intervalle de niveaux, **quand** je l'applique, **alors** seuls les objets dans cet intervalle restent.
2. **Étant donné** un type d'objet choisi, **quand** je l'applique, **alors** seuls les objets de ce type restent.
3. **Étant donné** un gain minimum, **quand** je l'applique, **alors** seuls les objets dont le gain est supérieur ou égal restent.
4. **Étant donné** l'option « masquer les objets sans coefficient », **quand** elle est cochée, **alors** les objets au coefficient inconnu disparaissent ; de même pour « masquer les objets sans prix ».
5. **Étant donné** des filtres qui ne laissent aucun objet, **quand** le classement s'affiche, **alors** un message l'indique et propose de réinitialiser les filtres.

---

### User Story 5 - Ouvrir un objet depuis le classement (Priorité : P2)

Un clic sur une ligne ouvre l'objet dans la fiche actuelle de la page Brisage, avec son détail complet (lignes, jets, prix des runes, verdict).

**Pourquoi cette priorité** : le classement repère, la fiche vérifie et affine (jets réels, prix saisis).

**Test indépendant** : cliquer sur la ligne d'un objet affiche la fiche de cet objet, et revenir à l'onglet Classement retrouve la liste avec ses filtres et son tri.

**Scénarios d'acceptation** :

1. **Étant donné** une ligne du classement, **quand** je clique dessus, **alors** la fiche de cet objet s'ouvre.
2. **Étant donné** que j'ai ouvert une fiche depuis le classement, **quand** je reviens à l'onglet Classement, **alors** filtres et tri sont inchangés.

---

### User Story 6 - Classement réservé au propriétaire (Priorité : P1)

L'onglet Classement n'est visible que du propriétaire. Un réglage « visible seulement pour moi » est activé dans son navigateur ; tant qu'il l'est, tous les autres visiteurs ne voient ni l'onglet ni son contenu. Le propriétaire peut désactiver ce réglage plus tard pour ouvrir le Classement à tout le monde.

**Pourquoi cette priorité** : l'outil est en test ; il ne doit pas être exposé aux joueurs avant que le propriétaire l'ait décidé.

**Test indépendant** : sur le navigateur du propriétaire (réglage activé), l'onglet est présent ; dans un navigateur vierge, la page Brisage n'a pas d'onglet Classement et l'adresse directe n'affiche pas le classement.

**Scénarios d'acceptation** :

1. **Étant donné** un visiteur qui n'a pas activé le réglage, **quand** il ouvre la page Brisage, **alors** il ne voit pas l'onglet Classement et rien du classement n'est calculé ni affiché.
2. **Étant donné** le propriétaire, **quand** il active le réglage « visible seulement pour moi », **alors** l'onglet apparaît dans son navigateur.
3. **Étant donné** le propriétaire qui n'a pas encore activé l'outil sur un navigateur donné, **quand** il ouvre `/brisage?classement=1`, **alors** l'onglet apparaît, le paramètre disparaît de l'adresse et l'accès est conservé après rechargement ; `?classement=0` le retire.
4. *(phase optionnelle)* **Étant donné** le réglage partagé « visible pour tous » activé par le propriétaire, **quand** un visiteur ouvre la page Brisage, **alors** l'onglet est visible pour lui aussi.

---

### User Story 7 - Classer aussi les objets sans coefficient connu (Priorité : P2)

Les objets dont le coefficient est inconnu ne sont pas écartés : ils forment un groupe à part, classé selon le coefficient minimum requis pour que le brisage soit rentable, du plus bas au plus haut. Plus ce seuil est bas, plus l'objet est susceptible d'être rentable quel que soit son coefficient réel.

**Pourquoi cette priorité** : la plupart des coefficients ne sont pas connus ; sans cela, la majorité du catalogue serait absente du classement.

**Test indépendant** : deux objets sans coefficient, l'un rentable dès 35 %, l'autre dès 90 % : le premier est listé avant le second ; un objet qui exigerait plus de 100 % est marqué « jamais rentable » et placé en dernier.

**Scénarios d'acceptation** :

1. **Étant donné** des objets sans coefficient connu, **quand** je les consulte, **alors** ils sont dans un groupe distinct de ceux au coefficient connu, classés par coefficient minimum requis croissant.
2. **Étant donné** un objet dont le seuil dépasse 100 %, **quand** il s'affiche, **alors** il est marqué « jamais rentable » et placé en fin de groupe.
3. **Étant donné** ce groupe, **quand** je trie par une autre colonne, **alors** le tri s'applique aussi à ce groupe.
4. **Étant donné** un objet de ce groupe, **quand** il s'affiche, **alors** aucun gain en kamas précis n'est présenté : seul le seuil de coefficient est donné.

---

### User Story 8 - Prendre en compte un exo (Priorité : P3)

Le classement propose, pour chaque objet, le meilleur exo possible : une rune d'une stat que l'objet n'a pas, posée avant de briser. Le gain « avec exo » déduit le prix de cette rune, qu'il faut dépenser au minimum pour poser l'exo. Le meilleur exo et l'amélioration qu'il apporte sont indiqués.

**Pourquoi cette priorité** : un exo à rune chère peut augmenter nettement le profit, mais c'est un raffinement du classement de base.

**Test indépendant** : pour un objet sans une stat dont la rune est chère, le gain avec exo est égal au gain sans exo, plus la valeur des runes que l'exo rapporte au brisage, moins le prix d'une rune de cette stat ; si le résultat n'est pas meilleur que sans exo, aucun exo n'est recommandé.

**Scénarios d'acceptation** :

1. **Étant donné** un objet et les prix des runes, **quand** le classement le calcule, **alors** il teste les exos possibles (stats absentes de l'objet) et retient celui qui donne le meilleur gain, prix de la rune de l'exo déduit.
2. **Étant donné** que le meilleur exo ne dépasse pas le gain sans exo, **quand** la ligne s'affiche, **alors** aucun exo n'est recommandé.
3. **Étant donné** un objet recommandant un exo, **quand** la ligne s'affiche, **alors** la colonne « Gain avec exo » indique la stat de l'exo et son apport par rapport au gain sans exo.
4. **Étant donné** que le coût réel de la forgemagie (échecs, runes supplémentaires) n'est pas modélisé, **quand** la colonne s'affiche, **alors** elle précise que seul le prix d'une rune est déduit, comme minimum.
5. **Étant donné** que le prix de la rune de l'exo est inconnu, **quand** la ligne s'affiche, **alors** cet exo n'est pas proposé.
6. **Étant donné** un objet au coefficient inconnu, **quand** la ligne s'affiche, **alors** la colonne « Gain avec exo » montre le seuil de coefficient recalculé avec le prix d'une rune d'exo ajouté au prix de l'objet, et non un gain en kamas.

---

### Cas limites

- Aucun objet n'a de prix connu sur le serveur actif : le classement est vide avec un message explicatif, sans erreur.
- Les données du catalogue ne sont pas encore chargées : un état de chargement est affiché, puis la liste.
- Un objet n'a aucune ligne brisable (que des lignes inconnues ou négatives) : il n'apparaît pas.
- Le prix de l'objet est connu à la fois par l'HDV et par le coût de craft : le prix retenu suit la même règle que la fiche (le moins cher, sauf choix contraire) et la source est lisible.
- Prix en mode personnel ou communautaire : le classement suit le mode actif, comme le reste du site.
- Deux objets ont le même gain : leur ordre reste stable d'un affichage à l'autre.
- Des milliers d'objets sont candidats : le classement reste utilisable (voir SC-003).

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La page Brisage MUST proposer un onglet « Classement » à côté de la fiche objet actuelle, sans modifier le fonctionnement de celle-ci.
- **FR-002** : Le classement MUST lister les objets brisables du serveur de jeu actif, par défaut du gain par objet le plus élevé au plus faible. Par défaut seuls les objets dont le prix est connu sont montrés (« masquer les objets sans prix » est coché) ; décocher cette option ajoute les objets sans prix, sans gain, en fin de liste.
- **FR-003** : Pour chaque objet, le gain, le meilleur choix (sans focus ou focus sur une rune précise) et le seuil de coefficient MUST être calculés par les mêmes règles que le verdict de la fiche objet, avec les jets moyens des lignes.
- **FR-004** : Chaque ligne MUST afficher au minimum : l'objet (nom, image), son niveau, le prix retenu et sa source, le gain par objet, le meilleur choix, le seuil de coefficient, et les indications de fraîcheur.
- **FR-005** : Chaque colonne utile (au moins : nom, niveau, prix, gain, seuil de coefficient) MUST être triable en croissant et en décroissant par clic sur son en-tête, avec indication du sens ; les valeurs inconnues MUST toujours se placer à la fin.
- **FR-006** : Le classement MUST indiquer, pour chaque ligne, l'ancienneté du prix de l'objet, des prix de runes utilisés et du coefficient, et mettre en évidence ceux qui dépassent le seuil de péremption.
- **FR-007** : Un objet sans coefficient connu MUST être signalé « coefficient inconnu » et classé dans un groupe distinct, par coefficient minimum requis croissant ; un gain en kamas précis ne MUST pas lui être attribué. Un seuil supérieur à 100 % MUST être marqué « jamais rentable » et placé en fin de groupe.
- **FR-008** : Un objet dont une rune nécessaire n'a pas de prix MUST être signalé et placé à la fin ; aucune valeur ne MUST être inventée pour le combler.
- **FR-009** : Le classement MUST pouvoir être filtré par niveau (minimum et maximum), par catégorie d'équipement (type d'objet) et par gain minimum, et masquer au choix les objets sans prix ou sans coefficient connu.
- **FR-010** : Un clic sur une ligne MUST ouvrir l'objet dans la fiche actuelle ; le retour au classement MUST retrouver ses filtres et son tri.
- **FR-011** : L'onglet Classement, son contenu et ses calculs MUST être inaccessibles à tout visiteur pour lequel le réglage de visibilité n'est pas activé, y compris par l'adresse directe.
- **FR-012** : Le propriétaire MUST pouvoir activer l'accès dans son navigateur par un réglage simple « visible seulement pour moi » (adresse `/brisage?classement=1`, retirée par `?classement=0`, documentée dans le guide de validation). Dans une phase optionnelle, à lancer seulement sur sa confirmation, il pourra ouvrir le classement à tous en changeant un réglage partagé, sans nouvelle livraison de code.
- **FR-013** : Le classement MUST suivre le serveur de jeu et le mode de prix (personnel ou communautaire) actifs, et se mettre à jour quand ils changent.
- **FR-014** : Une indisponibilité de données (catalogue, prix, coefficients) MUST produire un classement incomplet clairement signalé, jamais des valeurs fabriquées.
- **FR-015** : Les montants du classement MUST être présentés comme des estimations, avec le même avertissement que la fiche objet.
- **FR-016** : Pour chaque objet, le classement MUST proposer une colonne « Gain avec exo » : le meilleur exo possible (stat absente de l'objet, rune au prix connu) est retenu, et le prix d'au moins une rune de cette stat MUST être déduit du gain. La stat de l'exo et son apport par rapport au gain sans exo MUST être indiqués ; si aucun exo n'améliore le gain, aucun n'est recommandé.
- **FR-017** : La colonne « Gain avec exo » MUST préciser que seul le prix d'une rune est déduit (coût minimum) et que les échecs ou runes supplémentaires de la forgemagie ne sont pas comptés ; elle MUST être triable.
- **FR-018** : Le gain avec exo MUST s'appliquer aux objets au coefficient connu ; pour le groupe au coefficient inconnu, la colonne « Gain avec exo » MUST afficher à la place le seuil de coefficient recalculé avec le prix de l'objet augmenté du prix d'une rune de l'exo, et le tri de cette colonne porte sur ce seuil.

### Entités clés

- **Ligne de classement** : un objet brisable avec son niveau, son type, le prix retenu et sa source, le gain par objet, le meilleur choix, le seuil de coefficient, l'état de ses données (coefficient connu ou non, rune sans prix) et leur fraîcheur.
- **Fraîcheur** : l'ancienneté d'une donnée (prix de l'objet, prix d'une rune, coefficient), comparée à un seuil de péremption.
- **Réglage de visibilité du Classement** : « seulement moi » ou « tout le monde », propre à l'outil, qui décide si l'onglet existe pour un visiteur.
- **Filtres et tri du classement** : niveau min/max, type d'objet, gain minimum, masquages, colonne et sens de tri, conservés tant que le propriétaire reste sur la page Brisage.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Le propriétaire trouve les 10 objets les plus rentables de son serveur en moins de 10 secondes après l'ouverture de l'onglet, sans ouvrir aucune fiche.
- **SC-002** : Pour 100 % des objets sans ligne négative d'un échantillon de contrôle, le gain, le meilleur choix et le seuil de coefficient du classement sont identiques à ceux de la fiche objet de ce même objet.
- **SC-003** : Le tri par colonne et l'application d'un filtre donnent leur résultat en moins d'une seconde, même avec plusieurs milliers d'objets listés.
- **SC-004** : 0 objet sans coefficient connu n'est présenté avec un gain en kamas précis : tous portent la mention « coefficient inconnu » et un seuil de coefficient.
- **SC-007** : Pour 100 % des objets d'un échantillon de contrôle, le gain avec exo est égal à celui de la fiche objet avec cet exo, diminué du prix d'une rune de l'exo.
- **SC-005** : Pour un visiteur qui n'a pas activé le réglage, 0 élément du Classement n'est visible (onglet, contenu, adresse directe).
- **SC-006** *(phase optionnelle)* : Une fois la phase d'ouverture à tous livrée, le propriétaire passe de « seulement moi » à « tout le monde » en moins d'une minute, sans livraison de code.

## Hypothèses

- Le classement ne couvre que les objets dont le prix en HDV est connu (prix noté sur la page Recherche, personnel ou communautaire selon le mode actif), car sans prix aucun gain ne peut être calculé. Le coût de la chaîne de craft n'est pas utilisé dans cette première version (il demande de lire les recettes de chaque objet) ; la fiche, elle, continue de le proposer.
- Les objets sans prix sont masqués par défaut ; décochée, l'option les ajoute en fin de liste, sans gain. Un objet sans catégorie connue (index plus ancien) est exclu dès qu'une catégorie est choisie dans les filtres.
- Les gains sont calculés avec les jets moyens des lignes positives et sans jet saisi à la main : le classement sert à repérer, la fiche à affiner. Les lignes négatives (malus) ne sont pas lues par le classement ; elles ne changent que très peu un focus, donc un écart minime avec la fiche est attendu et signalé.
- Pour un objet sans coefficient connu, le seuil de coefficient requis vient du calcul déjà présent dans la fiche sans coefficient (`specs/063-brisage-sans-coefficient`). Ce classement mesure la résistance à un mauvais coefficient, pas le gain réel.
- Un exo vaut une unité de la stat par défaut (une rune de base) ; ce réglage pourra évoluer plus tard. Le coût de pose retenu est le prix d'une rune de cette stat, au minimum.
- Le seuil de péremption d'une donnée « ancienne » est de 7 jours, valeur modifiable plus tard.
- Le réglage « visible seulement pour moi » est conservé dans le navigateur du propriétaire ; il ne remplace pas une vraie authentification (n'importe qui peut le contourner en connaissant la méthode). Ce compromis est accepté pour la phase de test, et le classement ne contient aucune donnée privée.
- « Ouvrir le classement à tous » demande une valeur partagée entre visiteurs (comme les autres pages activables du site) ; le choix du support exact est laissé au plan.
- Le gain par heure et l'export de la liste sont hors périmètre.
- L'outil est utilisé sur ordinateur en priorité ; l'affichage mobile doit rester lisible mais n'est pas optimisé en premier.
