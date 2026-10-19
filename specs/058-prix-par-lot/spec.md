# Spécification : prix par taille de lot (1 / 10 / 100 / 1000)

**Branche** : `claude/prix-par-lot-642b17` | **Date** : 2026-10-19 | **Dépend de** : 056-sniffer-batch-prices, 022/055 (XP familier)

## Contexte

L'outil sniffer envoie, par ressource, le prix de chaque taille de lot de l'HDV (1, 10, 100, 1000).
Le Worker les réduit aujourd'hui à **un seul prix unitaire** (`unitPrice`, spec 056) et jette le
reste. Or le prix réel d'achat dépend de la quantité : pour 250 unités, acheter des lots de 100 est
moins cher que 250 lots de 1. La page XP familier calcule un coût pour une quantité N de ressource ;
elle doit utiliser le prix du bon lot.

## Histoires

### H1 — Conserver le prix de chaque lot (P1)
Le Worker enregistre, pour chaque ressource et serveur, le **dernier prix vu pour chaque taille de
lot**. Test : un envoi sniffer `{1: 100, 10: 900, 100: 8000}` rend ces trois prix lisibles.

### H2 — Coût XP familier au prix du bon lot (P1)
Pour une quantité nécessaire N, la page prend le prix unitaire du lot choisi par la règle ci-dessous.
La ligne indique le lot utilisé (« lot ×100 »).

## Règle du choix du lot (validée par le propriétaire)

Pour N unités : prendre le **plus gros lot ≤ N** parmi {1, 10, 100, 1000} dont un prix est connu ;
sinon descendre au lot inférieur, jusqu'au lot 1 ; **jamais un lot > N**. Exemples : N=250 → lot 100 ;
N=5 → lot 1 ; N=1000 sans prix de lot 1000 → lot 100 s'il a un prix, sinon 10, sinon 1.
Le coût est `N × prix unitaire du lot` (prix du lot ÷ taille ; pas d'arrondi au lot entier).

## Exigences

- **FR-001** Chaque envoi sniffer enregistre le prix de **chaque lot en vente** (valeur du lot
  entier, comme reçue). Un lot absent de l'envoi (ou à 0) **supprime** le prix connu de ce lot : il
  n'est plus en vente.
- **FR-002** Le prix unitaire unique de 056 (`unitPrice`, médiane, contributions) est **inchangé** :
  médianes, historique, prix « le plus récent » du reste du site ne bougent pas.
- **FR-003** Les données existantes sont conservées sans perte et valent **prix du lot 1** : à la
  lecture, le lot 1 est le prix de lot 1 s'il existe, sinon le prix communautaire/carnet déjà utilisé.
- **FR-004** Une route de lecture publique donne, pour des ressources d'un serveur, les prix de lot
  connus et leur date (jamais d'identifiant de clé ou d'appareil).
- **FR-005** Page XP familier, mode communautaire : coût d'une ligne = `quantité × prix unitaire du lot
  choisi` ; mode personnel : inchangé (carnet = lot 1). Si le Worker est injoignable, comportement
  actuel (pas d'invention de valeur).
- **FR-006** Le plafond journalier compte toutes les lignes écrites (contribution + prix de lot).
- **FR-007** Rien n'est appliqué en remote ni déployé sans accord explicite du propriétaire.

## Hors périmètre

Autres pages (craft, Prix, historique) ; mode personnel ; saisie manuelle de prix par lot ; outil
sniffer lui-même (il envoie déjà tous les lots).

## Critères de réussite

- N=250 avec prix {1,10,100} → coût au prix unitaire du lot 100 ; N=5 → lot 1 ; lot 100 sans prix et
  N=250 → lot 10.
- Un envoi sniffer remplace les prix de lot, retire ceux qui ne sont plus en vente.
- La migration s'applique sur une base existante sans toucher aux contributions.
