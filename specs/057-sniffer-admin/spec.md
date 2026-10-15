# Spécification : administration des clés sniffer et du mapping

**Branche** : `057-sniffer-admin` (partie de `056-sniffer-batch-prices`, non fusionnée)

**Créée** : 2026-10-15

**Statut** : Draft

**Entrée** : phase 3 du plan « Envoi des prix par les amis »
(`SniffSniffSquared/docs/superpowers/plans/2026-10-15-friends-price-upload.md`, sections Décisions
et Phase 3). La phase 2 (`specs/056-sniffer-batch-prices`) a créé les tables des clés, des mappings
et du compteur journalier, et les routes que l'outil des amis appelle. Cette spec ajoute les
sections d'administration qui les remplissent.

## Contexte

Chaque ami qui envoie des prix de l'HDV a sa propre clé ; l'API ne garde que l'empreinte (SHA-256)
de la clé, jamais la clé elle-même. Pour décoder les paquets de l'HDV, l'outil a besoin d'un
« mapping » (deux documents JSON, `keymap.json` et `schema.json`) qui change à chaque mise à jour du
client Dofus. Aujourd'hui, rien ne permet au propriétaire de créer une clé ni de publier un mapping
sans écrire en base à la main. Cette spec ajoute deux sections à la page d'administration existante,
réservée au propriétaire par Cloudflare Access.

## Scénarios utilisateur et tests *(obligatoire)*

### Histoire 1 — Le propriétaire donne une clé à un ami (Priorité : P1)

Le propriétaire saisit le nom de l'ami et crée une clé. La page affiche la clé en clair une seule
fois, avec un bouton pour la copier et l'avertissement qu'elle ne sera plus jamais affichée. Le
propriétaire la transmet à l'ami, qui la colle dans son outil.

**Pourquoi P1** : sans clé, aucun ami ne peut envoyer de prix.

**Test indépendant** : créer une clé « Alice » ; appeler la route de configuration de l'API avec
cette clé : elle répond 200. Recharger la page : la clé en clair n'est plus visible nulle part.

**Scénarios d'acceptation** :

1. **Étant donné** un libellé non vide, **quand** le propriétaire crée une clé, **alors** la clé en
   clair est affichée une fois, et seule son empreinte est enregistrée.
2. **Étant donné** une clé créée, **quand** l'outil de l'ami appelle l'API avec elle, **alors**
   l'appel est authentifié.
3. **Étant donné** une clé créée, **quand** le propriétaire recharge la page ou relit la liste,
   **alors** la clé en clair n'apparaît plus (seuls le libellé et les dates).
4. **Étant donné** un libellé vide ou trop long, **quand** le propriétaire crée la clé, **alors** la
   création est refusée avec un message sur le champ.

---

### Histoire 2 — Le propriétaire révoque une clé et suit l'activité (Priorité : P1)

La section liste toutes les clés : libellé, date de création, date de révocation, dernier envoi et
nombre de prix enregistrés aujourd'hui (UTC). Le propriétaire révoque la clé d'un ami qui ne doit
plus envoyer, après confirmation.

**Pourquoi P1** : une clé fuitée doit pouvoir être coupée immédiatement.

**Test indépendant** : révoquer la clé « Alice » ; l'API refuse ensuite cette clé (401). La liste
montre la date de révocation.

**Scénarios d'acceptation** :

1. **Étant donné** une clé active, **quand** le propriétaire la révoque, **alors** l'API la refuse
   dès l'appel suivant et la liste affiche sa date de révocation.
2. **Étant donné** une clé déjà révoquée, **quand** elle est révoquée de nouveau, **alors** sa date
   de révocation d'origine est conservée.
3. **Étant donné** une clé qui a envoyé 120 prix aujourd'hui, **quand** le propriétaire ouvre la
   liste, **alors** il voit « 120 » pour aujourd'hui et la date de son dernier appel.
4. **Étant donné** une clé jamais utilisée, **alors** la liste affiche « jamais » et 0.

---

### Histoire 3 — Le propriétaire publie le mapping d'une nouvelle version du client (Priorité : P1)

Après une mise à jour de Dofus, le propriétaire choisit `keymap.json` et `schema.json`, saisit le
build couvert (ex. `3.7.10.10`) et dépose. Si les deux documents sont valides, le nouveau mapping
devient l'actif de ce build, et l'outil des amis le reçoit dans sa configuration.

**Pourquoi P1** : sans mapping actif pour son build, l'outil reste en pause.

**Test indépendant** : déposer un mapping pour `3.7.10.10` ; la configuration de l'API pour ce
build renvoie ce mapping (même identifiant, mêmes documents).

**Scénarios d'acceptation** :

1. **Étant donné** deux documents valides et un build, **quand** le propriétaire dépose, **alors**
   le mapping est enregistré, devient l'actif du build, et l'ancien actif du même build ne l'est
   plus.
2. **Étant donné** un document qui n'est pas du JSON valide, **quand** le propriétaire dépose,
   **alors** le dépôt est refusé avec le nom du document en cause, et rien n'est enregistré.
3. **Étant donné** un keymap sans entrée `price_list`, ou un schema sans définition `price_list`,
   **quand** le propriétaire dépose, **alors** le dépôt est refusé et rien n'est enregistré.
4. **Étant donné** un schema dont `price_list` renvoie (par `of`) à une définition absente,
   **quand** le propriétaire dépose, **alors** le dépôt est refusé en nommant la définition
   manquante.
5. **Étant donné** un mapping actif pour `3.7.10.10`, **quand** un mapping est déposé pour
   `3.7.11.0`, **alors** celui de `3.7.10.10` reste actif (un actif par build, pas un seul en tout).

---

### Histoire 4 — Le propriétaire revient à un ancien mapping (Priorité : P2)

La section montre l'historique des mappings par build (identifiant, date de dépôt, actif ou non).
Si le dernier mapping déposé est faux, le propriétaire réactive un ancien mapping du même build :
c'est le retour arrière.

**Pourquoi P2** : utile seulement après une erreur de dépôt, mais sans lui une erreur bloque tous les
amis jusqu'au prochain dépôt correct.

**Test indépendant** : déposer A puis B pour un build ; réactiver A ; la configuration de l'API
renvoie A, et un envoi de prix fait avec l'identifiant de B est refusé comme mapping inactif (409).

**Scénarios d'acceptation** :

1. **Étant donné** deux mappings A (ancien) et B (actif) d'un même build, **quand** le propriétaire
   réactive A, **alors** A est l'actif et B ne l'est plus, en une seule opération.
2. **Étant donné** un mapping déjà actif, **quand** il est réactivé, **alors** rien ne change.
3. **Étant donné** un identifiant de mapping inconnu, **quand** il est réactivé, **alors** la page
   dit qu'il n'existe pas.

---

### Cas limites

- Deux dépôts du même build presque simultanés : à la fin, exactement un mapping est actif pour ce
  build (le dernier enregistré).
- Un document vide, un tableau JSON, ou `null` au lieu d'un objet : refusé (le document doit être un
  objet JSON).
- Les clés qui commencent par `_` sont des notes : `"_price_list"` ne compte pas comme entrée
  `price_list`, et une définition dont le nom commence par `_` ne peut pas résoudre un `of`.
- Un document trop gros (au-delà de 256 Ko) : refusé.
- Un build mal formé (lettres, vide, `3.7`, `1.2.3.4.5`) : refusé ; le build doit avoir la forme que l'outil lit
  dans le fichier `version` du client (nombres séparés par des points, ex. `3.7.10.10`).
- Les compteurs du jour se remettent à zéro à minuit UTC, comme le plafond de la phase 2.
- Une clé révoquée n'est jamais réactivée : pour rendre l'accès à un ami, on lui crée une nouvelle
  clé.
- Toute action par quelqu'un d'autre que le propriétaire est refusée comme les sections existantes.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Toutes les actions de ces deux sections DOIVENT être réservées au propriétaire, avec la
  même vérification Cloudflare Access que les sections existantes de l'administration.
- **FR-002** : La création d'une clé DOIT demander un libellé (1 à 60 caractères après suppression
  des espaces autour) et produire une clé aléatoire d'au moins 128 bits d'entropie.
- **FR-003** : La clé en clair DOIT être renvoyée uniquement dans la réponse de création ; seule son
  empreinte DOIT être enregistrée, calculée exactement comme l'API la vérifie (SHA-256, hexadécimal
  minuscule).
- **FR-004** : L'identifiant de la clé DOIT être celui que l'API utilise comme `device_id` des
  contributions (le schéma de la phase 2, sans le modifier).
- **FR-005** : La liste des clés DOIT montrer, pour chacune : libellé, création, révocation (ou
  rien), dernier appel authentifié (ou « jamais »), et prix enregistrés le jour UTC en cours (0 sans
  ligne de compteur). Elle ne DOIT jamais contenir la clé ni son empreinte.
- **FR-006** : La révocation DOIT être confirmée par le propriétaire dans la page, DOIT être
  immédiate pour l'API, et DOIT conserver la date de révocation d'origine si elle est répétée.
- **FR-007** : Le dépôt d'un mapping DOIT demander un build de la forme « nombres séparés par des
  points » (3 ou 4 nombres : `X.Y.Z` ou `X.Y.Z.W`, 32 caractères au plus), un keymap et un schema.
- **FR-008** : Le dépôt DOIT être refusé, sans rien enregistrer, si : un document n'est pas du JSON
  valide ; un document n'est pas un objet JSON ; un document dépasse 256 Ko ; le keymap n'a pas
  d'entrée `price_list` dont la valeur est une chaîne non vide ; le schema n'a pas de définition
  `price_list` qui est un objet ; une définition citée par `of` depuis `price_list` (directement ou
  par une définition elle-même citée) est absente ou commence par `_`. Le message DOIT nommer le
  document et la raison.
- **FR-009** : Un mapping accepté DOIT devenir l'actif de son build et l'ancien actif du même build
  DOIT cesser de l'être, en une seule opération ; les mappings des autres builds ne changent pas.
- **FR-010** : Les documents DOIVENT être enregistrés tels que déposés (le texte du fichier), de
  sorte que la configuration de l'API renvoie exactement leur contenu.
- **FR-011** : L'historique DOIT lister tous les mappings, groupés par build (le plus récent build
  déposé en premier), avec identifiant, date de dépôt, taille des documents et état actif.
- **FR-012** : Réactiver un mapping DOIT en faire l'actif de son build et désactiver l'ancien actif
  du build, en une seule opération ; aucune autre donnée ne change.
- **FR-013** : Aucune table ni colonne ne DOIT être ajoutée : ces sections utilisent `sniffer_keys`,
  `sniffer_mappings` et `sniffer_daily_usage` de la phase 2 telles quelles.

### Entités clés

- **Clé sniffer** : une par ami ; libellé, empreinte, dates de création, de révocation et du dernier
  appel. Son identifiant marque les prix qu'elle envoie.
- **Mapping** : un keymap et un schema pour un build du client ; date de dépôt ; actif ou non. Au
  plus un actif par build.
- **Compteur journalier** : prix enregistrés par une clé sur un jour UTC (écrit par l'API, seulement
  lu ici).

## Critères de succès *(obligatoire)*

- **SC-001** : Une clé créée dans la page est acceptée par l'API au premier appel, sans autre
  manipulation.
- **SC-002** : Après sa création, la clé en clair n'est lisible nulle part : ni dans la base, ni dans
  la liste, ni après un rechargement.
- **SC-003** : Une clé révoquée est refusée par l'API dès l'appel suivant.
- **SC-004** : Un mapping déposé est, à l'octet près, celui que la configuration de l'API renvoie
  pour son build.
- **SC-005** : 100 % des dépôts invalides décrits en FR-008 sont refusés sans rien enregistrer.
- **SC-006** : À tout moment, chaque build a au plus un mapping actif.
- **SC-007** : Revenir à un ancien mapping prend une seule action et moins de 10 secondes.

## Hypothèses

- Le propriétaire est le seul utilisateur de l'administration ; aucune notion de rôle.
- La clé en clair n'est jamais récupérable : une clé perdue se remplace par une nouvelle clé.
- Pas de suppression de clé ni de mapping : la révocation et l'historique suffisent, et l'identifiant
  d'une clé reste sur les contributions qu'elle a envoyées.
- Pas de désactivation d'un build sans remplaçant : pour mettre l'outil en pause sur un build, on
  réactive un ancien mapping ou on en dépose un autre.
- 256 Ko par document laisse une large marge (les documents actuels font environ 1 Ko et 6 Ko).
- Rien n'est appliqué en remote ni déployé par cette spec sans accord explicite du propriétaire.
