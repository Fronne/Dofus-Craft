# Spécification : Prix de l'objet sur la page Brisage (HDV ou craft)

**Branche**: `062-prix-objet-brisage`

**Créée le**: 2026-10-20

**Statut**: Brouillon

**Entrée**: « Page Brisage : remplacer le « Coût de l'objet » par le « Prix de l'objet », avec un sélecteur à deux choix : Prix HDV (comportement actuel : prix noté sur la page Recherche, saisie manuelle s'il n'y en a pas) ou Prix de craft (coût de la chaîne de craft complète, calculé comme sur la page Épingles : prix des ressources déjà notés, choix de recettes mémorisés, selon le mode de prix actif). Le choix est mémorisé avec la session Brisage. Si le craft est incomplet (prix de ressource manquant), l'indiquer et proposer la saisie manuelle sans rien deviner. Verdict, gains et cartes se basent sur le prix choisi. »

Cette spec prolonge `specs/061-simplification-page-brisage` (FR-002 : le coût de l'objet vient du prix HDV noté sur Recherche).

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Choisir entre le prix HDV et le prix de craft (Priorité : P1)

Sur la page Brisage, une fois un objet choisi, le joueur voit un champ « Prix de l'objet » avec un sélecteur à deux choix : « Prix HDV » et « Prix de craft ». Le montant affiché est celui du choix actif, et tout le reste de la page (verdict, gain, cartes des prochains brisages, total de l'objet) se base sur ce montant. Cela lui permet de savoir si briser un objet est rentable aussi bien quand il l'achète à l'HDV que quand il le fabrique lui-même.

**Pourquoi cette priorité** : c'est le cœur de la demande ; sans le choix, le joueur qui fabrique ses objets ne peut pas juger la rentabilité du brisage.

**Test indépendant** : ouvrir un objet qui a un prix HDV noté et une recette dont les ressources sont toutes chiffrées, basculer entre les deux choix, et vérifier que le montant, le verdict et les gains changent en conséquence.

**Scénarios d'acceptation** :

1. **Étant donné** un objet avec un prix HDV noté, **quand** la page s'ouvre, **alors** « Prix HDV » est sélectionné par défaut et le montant est le prix noté sur Recherche (comportement actuel inchangé).
2. **Étant donné** un objet dont la chaîne de craft est entièrement chiffrée, **quand** le joueur choisit « Prix de craft », **alors** le montant affiché est le coût total de la chaîne de craft et le verdict, les gains et les cartes se recalculent sur ce montant.
3. **Étant donné** que le joueur a choisi « Prix de craft », **quand** il revient en arrière puis rouvre la page ou recharge le site, **alors** son choix et la session Brisage sont restitués tels qu'ils étaient.
4. **Étant donné** le libellé de la page, **quand** elle s'affiche, **alors** le champ s'appelle « Prix de l'objet » (plus « Coût de l'objet ») et les textes du verdict qui parlaient du « coût de l'objet » sont cohérents avec ce vocabulaire.

---

### User Story 2 - Craft incomplet : le dire et laisser saisir (Priorité : P2)

Quand le joueur choisit « Prix de craft » mais que le coût ne peut pas être calculé en entier (le prix d'une ressource de la chaîne manque, ou l'objet n'a pas de recette), la page l'indique clairement, sans inventer de montant, et propose de saisir le prix à la main.

**Pourquoi cette priorité** : sans ce cas, le choix « Prix de craft » donnerait un résultat faux ou un écran vide pour beaucoup d'objets ; la constitution interdit de fabriquer des valeurs.

**Test indépendant** : choisir « Prix de craft » sur un objet dont une ressource n'a pas de prix noté, vérifier le message et la saisie manuelle, puis saisir un montant et vérifier que le verdict l'utilise.

**Scénarios d'acceptation** :

1. **Étant donné** un objet dont au moins un prix de ressource manque, **quand** le joueur choisit « Prix de craft », **alors** la page dit que le prix de craft est incomplet (sans afficher de total partiel présenté comme complet) et propose un champ de saisie manuelle du prix.
2. **Étant donné** un objet sans recette, **quand** le joueur choisit « Prix de craft », **alors** la page dit qu'aucun craft n'existe pour cet objet et propose la saisie manuelle.
3. **Étant donné** le même cas pour « Prix HDV » (aucun prix noté), **quand** la page s'affiche, **alors** le comportement actuel est conservé : message et saisie manuelle.
4. **Étant donné** un prix saisi à la main, **quand** le joueur change de choix puis revient, **alors** sa saisie n'est pas perdue.

---

### User Story 3 - Savoir d'où vient le prix (Priorité : P3)

Sous le montant, une courte mention précise la provenance du prix : prix noté sur Recherche, coût de la chaîne de craft selon le mode de prix actif (personnel ou communautaire), ou valeur saisie à la main.

**Pourquoi cette priorité** : la constitution demande de distinguer les valeurs saisies des valeurs dérivées ; c'est un confort, pas un blocage.

**Test indépendant** : vérifier la mention affichée dans chacun des trois cas (HDV, craft, saisie manuelle).

**Scénarios d'acceptation** :

1. **Étant donné** chaque source de prix possible, **quand** le montant s'affiche, **alors** la mention de provenance correspond à cette source.
2. **Étant donné** que le joueur change de mode de prix (personnel ou communautaire), **quand** la page se met à jour, **alors** le prix HDV et le prix de craft reflètent le mode actif.

---

### Cas limites

- Le prix de craft est nul (ressources toutes à 0) : il n'est pas accepté comme prix valide, comme un prix HDV nul aujourd'hui.
- Le chargement du prix de craft prend du temps (arbre de recettes, prix des ressources) : la page affiche un état d'attente et ne conclut rien tant que le calcul n'est pas fini.
- Le joueur change d'objet : le choix HDV/craft est conservé pour la session mais le prix est recalculé pour le nouvel objet.
- Le joueur change de serveur ou de mode de prix : le prix affiché est recalculé pour le serveur et le mode actifs.
- Le service de prix communautaire est indisponible : la page ne bloque pas, elle retombe sur « prix manquant » et la saisie manuelle.
- Ancienne session Brisage enregistrée sans le choix : elle est restituée avec « Prix HDV » (comportement d'avant).

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La page Brisage MUST appeler le montant de référence « Prix de l'objet » (et non plus « Coût de l'objet »), y compris dans les libellés d'aide, de verdict et d'accessibilité.
- **FR-002** : La page MUST proposer, pour un objet ouvert, un sélecteur à deux choix : « Prix HDV » et « Prix de craft ».
- **FR-003** : « Prix HDV » MUST conserver le comportement actuel : prix noté sur la page Recherche selon le mode de prix actif, avec saisie manuelle quand aucun prix n'existe.
- **FR-004** : « Prix de craft » MUST afficher le coût de la chaîne de craft complète de l'objet, calculé comme sur la page Épingles : mêmes prix de ressources déjà notés, mêmes choix de recettes mémorisés, selon le mode de prix actif.
- **FR-005** : Quand le coût de craft ne peut pas être calculé en entier (prix de ressource manquant, ou objet sans recette), la page MUST l'indiquer, MUST NOT afficher un total partiel comme s'il était complet, et MUST proposer la saisie manuelle du prix.
- **FR-006** : Le verdict, les gains, les cartes des prochains brisages et le total de l'objet MUST utiliser le prix du choix actif (ou la saisie manuelle quand elle s'applique).
- **FR-007** : Le choix HDV/craft MUST être mémorisé avec la session Brisage et restitué à la réouverture ; une session enregistrée avant cette fonctionnalité MUST se restituer avec « Prix HDV ».
- **FR-008** : Un prix nul ou négatif MUST NOT être accepté comme prix de l'objet, qu'il vienne de l'HDV, du craft ou de la saisie.
- **FR-009** : La page MUST indiquer la provenance du montant affiché (prix noté sur Recherche, coût de craft, ou valeur saisie).
- **FR-010** : La page MUST afficher un état d'attente pendant le calcul du prix de craft et MUST NOT présenter de verdict définitif tant qu'il n'est pas terminé.
- **FR-011** : Le calcul du prix de craft MUST être couvert par des tests automatisés : chaîne complète, ressource manquante, objet sans recette, prix nul, changement de mode de prix.

### Entités clés

- **Prix de l'objet** : montant servant de référence à toute la page Brisage ; il a une source (HDV, craft ou saisie manuelle) et peut être indisponible.
- **Choix de source** : « Prix HDV » ou « Prix de craft », mémorisé avec la session Brisage.
- **Coût de craft** : somme du coût de la chaîne de craft de l'objet ; complet ou incomplet selon la présence des prix de ressources.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Le joueur passe du prix HDV au prix de craft, et inversement, en un seul geste, et le verdict affiché se met à jour sans rechargement de la page.
- **SC-002** : Pour un objet dont la chaîne de craft est entièrement chiffrée, le prix de craft affiché sur Brisage est identique à celui affiché pour le même objet sur la page Épingles, dans le même mode de prix.
- **SC-003** : Dans 100 % des cas où le prix de craft est incomplet, la page le dit et propose la saisie ; aucun montant partiel n'est présenté comme complet.
- **SC-004** : Le choix HDV/craft survit à un rechargement du site dans 100 % des cas où la session Brisage est restituée.
- **SC-005** : Le comportement avec « Prix HDV » est strictement identique à celui d'avant la fonctionnalité pour les objets ayant un prix noté.

## Hypothèses

- « Prix de craft » désigne la chaîne de craft complète, comme sur la page Épingles, et non seulement les ingrédients de premier niveau.
- Le choix par défaut est « Prix HDV », ce qui préserve le comportement actuel pour tous les joueurs.
- Le prix de craft utilise les prix de ressources que le joueur a déjà notés (ou ceux du groupe en mode communautaire) ; la page Brisage n'ajoute aucun nouvel endroit où noter ces prix.
- Le choix est mémorisé par session Brisage (comme le coefficient et la saisie manuelle), pas par objet.
- Le prix saisi à la main reste un champ unique commun aux deux choix.
- La page Épingles et la page Recherche ne changent pas.
