# Spécification : Coefficients de brisage partagés entre tous les joueurs

**Branche**: `claude/brisage-coefficients-partages-53ff73` (worktree ; le numéro 068 est pris par `068-admin-dashboard`, d'où 069)

**Créée le**: 2026-10-21

**Statut**: Brouillon

**Entrée**: « Partager entre tous les joueurs les coefficients de brisage notés sur la page Brisage. Table D1 partagée (serveur, objet, coefficient, date, identifiant anonyme du contributeur), routes dans le Worker public, historique 3 mois avec purge automatique, écriture ouverte à tous sans authentification, reprise unique des coefficients déjà notés dans les navigateurs, repli sur le localStorage si le serveur ne répond pas, aucune valeur inventée. »

Cette spec prolonge `specs/061-simplification-page-brisage` (FR-004 : le coefficient noté est gardé sur l'appareil) et suit le modèle du partage des prix en mode communautaire (`specs/004-community-price-sharing`).

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Retrouver le coefficient noté par un autre joueur (Priorité : P1)

Quand un joueur ouvre un objet sur la page Brisage, il voit le dernier coefficient noté par n'importe quel joueur pour cet objet sur son serveur, avec sa date, même s'il ne l'a jamais noté lui-même.

**Pourquoi cette priorité** : c'est le but de la demande ; un coefficient ne change qu'avec le brisage et sert à tous.

**Test indépendant** : un joueur A note 38 pour l'objet 777 sur Mikhal ; un joueur B (autre navigateur) ouvre l'objet 777 sur Mikhal et voit 38 et sa date, sans l'avoir saisi.

**Scénarios d'acceptation** :

1. **Étant donné** un coefficient noté par un autre joueur, **quand** j'ouvre cet objet sur le même serveur, **alors** ce coefficient et sa date sont affichés et servent aux calculs comme un coefficient noté par moi.
2. **Étant donné** des coefficients notés sur un autre serveur ou pour un autre objet, **quand** j'ouvre l'objet, **alors** ils ne sont pas utilisés.
3. **Étant donné** plusieurs coefficients notés pour le même objet et serveur, **quand** j'ouvre l'objet, **alors** c'est le plus récent qui est affiché.
4. **Étant donné** que la liste de résultats de recherche d'objets montre le coefficient noté, **quand** elle s'affiche, **alors** elle montre aussi les coefficients partagés.

---

### User Story 2 - Noter un coefficient pour tous (Priorité : P1)

Quand un joueur note un coefficient sur un objet, il est enregistré pour tous les joueurs de son serveur, sans compte ni connexion.

**Pourquoi cette priorité** : sans écriture partagée, rien à lire dans la story 1.

**Test indépendant** : noter 44 sur un objet, recharger dans un autre navigateur, voir 44.

**Scénarios d'acceptation** :

1. **Étant donné** un coefficient valide (entre 0 exclu et le maximum de la page), **quand** je le note, **alors** il est affiché tout de suite chez moi et envoyé au serveur avec le serveur de jeu, l'objet, la date et un identifiant anonyme de mon appareil.
2. **Étant donné** un coefficient invalide (zéro, négatif, trop grand), **quand** je tente de le noter, **alors** rien n'est enregistré ni envoyé.
3. **Étant donné** que le serveur ne répond pas, **quand** je note un coefficient, **alors** il reste enregistré sur mon appareil et la page fonctionne normalement.

---

### User Story 3 - Reprendre les coefficients déjà notés sur l'appareil (Priorité : P2)

Les coefficients que le joueur a déjà notés dans son navigateur avant cette fonctionnalité sont envoyés une seule fois au serveur, avec leur date d'origine, pour ne pas être perdus.

**Pourquoi cette priorité** : amorce la base partagée avec ce qui existe déjà, mais le site marche sans.

**Test indépendant** : avec deux coefficients en `localStorage`, ouvrir la page : ils partent au serveur une fois ; recharger : rien n'est renvoyé.

**Scénarios d'acceptation** :

1. **Étant donné** des coefficients notés en local avec leur date, **quand** la page Brisage s'ouvre, **alors** chacun est envoyé au serveur avec sa date d'origine (pas la date du jour).
2. **Étant donné** un coefficient dont la date est antérieure au 21/10/2026 à 17h30 heure de Paris (15h30 UTC), **quand** la reprise a lieu, **alors** il est ignoré, jamais envoyé.
3. **Étant donné** que la reprise a réussi, **quand** je rouvre le site, **alors** rien n'est renvoyé.
4. **Étant donné** que le serveur ne répond pas pendant la reprise, **quand** je rouvre la page plus tard, **alors** la reprise est retentée ; rien n'est perdu.

---

### User Story 4 - Historique de 3 mois (Priorité : P3)

Le serveur garde l'historique des coefficients 90 jours et supprime ensuite les plus anciens automatiquement.

**Pourquoi cette priorité** : borne la taille de la base ; l'affichage ne dépend que du dernier coefficient.

**Test indépendant** : tester la règle de purge avec des dates fictives (89 jours conservé, 91 jours supprimé).

**Scénarios d'acceptation** :

1. **Étant donné** des coefficients vieux de plus de 90 jours, **quand** la purge hebdomadaire s'exécute, **alors** ils sont supprimés.
2. **Étant donné** un coefficient vieux de plus de 90 jours mais pas encore purgé, **quand** un joueur ouvre l'objet, **alors** il n'est pas affiché.

---

### Cas limites

- Le serveur répond une erreur ou une réponse illisible : la page garde le coefficient local s'il existe, n'invente rien, n'affiche pas d'erreur bloquante.
- Aucun coefficient ni partagé ni local : l'objet est traité comme aujourd'hui (aucun coefficient connu).
- Le coefficient local est plus récent que le coefficient partagé (noté hors ligne) : le plus récent des deux est affiché.
- Un même appareil note plusieurs fois le même objet : chaque note est une entrée de l'historique.
- Ouverture d'un autre objet pendant qu'une réponse arrive : la réponse d'un objet précédent ne s'applique pas au nouvel objet.
- Sans serveur de jeu choisi : aucun envoi ni lecture.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Le système DOIT enregistrer chaque coefficient noté (serveur, objet, coefficient, date) dans une base partagée par tous les joueurs, avec un identifiant anonyme d'appareil, jamais renvoyé par la lecture.
- **FR-002** : Le système DOIT montrer, pour un objet et un serveur, le coefficient partagé le plus récent de moins de 90 jours, avec sa date.
- **FR-003** : Le système DOIT accepter les écritures de tous les joueurs sans connexion ni compte, avec la même clé d'application publique et la même limitation de débit que les prix communautaires.
- **FR-004** : Le système DOIT refuser (sans l'enregistrer) tout coefficient hors de ]0 ; maximum de la page], tout identifiant de serveur ou d'objet vide, et toute date invalide ou dans le futur.
- **FR-005** : Le système DOIT conserver l'historique 90 jours et supprimer automatiquement les entrées plus anciennes (purge hebdomadaire, comme les contributions de prix).
- **FR-006** : Le système DOIT envoyer une seule fois au serveur les coefficients déjà notés dans le navigateur, avec leur date d'origine, puis ne plus les renvoyer ; une reprise échouée DOIT être retentée plus tard.
- **FR-007** : La reprise DOIT ignorer tout coefficient local daté avant `2026-10-21T15:30:00Z` (21/10/2026 17h30 à Paris).
- **FR-008** : Le coefficient local DOIT rester enregistré sur l'appareil à chaque note ; il sert de repli si le serveur est indisponible, sans casser la page.
- **FR-009** : Quand le coefficient local et le coefficient partagé existent tous deux, le système DOIT afficher le plus récent des deux.
- **FR-010** : Le système NE DOIT PAS inventer de coefficient : sans donnée valide, l'objet n'a pas de coefficient.
- **FR-011** : Un envoi ou une lecture ayant échoué NE DOIT PAS bloquer ni afficher d'erreur sur la page Brisage.

### Entités clés

- **Coefficient noté** : serveur de jeu, objet, valeur du coefficient, date de la note, identifiant anonyme d'appareil (jamais exposé).
- **Coefficient affiché** : valeur et date du plus récent coefficient valide (partagé ou local) pour un objet sur un serveur.

## Critères de succès *(obligatoire)*

- **SC-001** : Un coefficient noté par un joueur est visible par un autre joueur sur le même objet et serveur à sa prochaine ouverture de l'objet (délai de cache inclus : moins de 2 minutes).
- **SC-002** : Avec le serveur arrêté, la page Brisage s'utilise comme avant : coefficient local lu, noté, aucun message d'erreur bloquant.
- **SC-003** : Aucune entrée de plus de 90 jours n'est affichée, et la purge les supprime.
- **SC-004** : Un coefficient local est envoyé une seule fois (0 renvoi aux ouvertures suivantes après un succès) et aucun coefficient antérieur à la limite du 21/10/2026 17h30 (Paris) n'est jamais envoyé.

## Hypothèses

- La lecture est publique et mise en cache 60 secondes, comme les prix communautaires.
- Le maximum de coefficient est celui déjà utilisé par la page (`MAX_COEFFICIENT`).
- Un identifiant d'appareil anonyme existe déjà (`getOrCreateDeviceId`), il est réutilisé.
- « Tous les joueurs peuvent écrire » : la clé d'application publique du bundle est la seule barrière, comme pour les prix, plus la limite de débit par IP.
- **À confirmer par l'utilisateur** : la demande « supprimer tous les coefficients enregistrés avant le 21/10/2026 17h30 » est interprétée comme « ne pas reprendre ceux des navigateurs datés d'avant cette limite » (FR-007). La base partagée étant neuve, rien n'est à supprimer côté serveur.
- Hors périmètre : modération, correction ou suppression d'un coefficient par un joueur, affichage de l'historique.
