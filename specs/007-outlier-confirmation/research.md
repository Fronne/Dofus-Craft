# Research: Confirmation des valeurs de coût de craft aberrantes

## Mécanisme de confirmation côté client : `<dialog>` natif plutôt qu'une bibliothèque de modales

**Decision**: Utiliser l'élément HTML natif `<dialog>` (`showModal()`/`close()`) dans un nouveau
composant `OutlierConfirmDialog.tsx`, exposé via un hook `useOutlierConfirm()` qui retourne
`[dialogElement, confirmOutlier]`, où `confirmOutlier(details)` renvoie une `Promise<boolean>`
résolue quand le joueur répond.

**Rationale**: Le projet n'a aucun composant de modale existant (recherche dans `src/components/` et
dans le CSS global : aucune trace de `role="dialog"`, de `window.confirm`, ni de bibliothèque de
modales). `<dialog>` fournit gratuitement le blocage d'interaction (`showModal()` empêche toute
interaction avec le reste de la page), la fermeture au clavier (Échap déclenche `onCancel`, traité
comme une annulation) et un focus géré par le navigateur, sans ajouter de dépendance ni construire un
piège à focus maison — cohérent avec le principe IV (changements cohésifs, pas d'abstraction
non nécessaire) et avec le public restreint du produit (mémoire : petite audience fermée, pas besoin
d'une bibliothèque de composants généraliste).

**Alternatives considered**:
- Une bibliothèque de modales (Radix, Headless UI, etc.) : rejetée, nouvelle dépendance pour un
  besoin d'un seul écran de confirmation.
- Un composant "maison" en `position: fixed` avec overlay : rejeté, réimplémenterait le blocage
  d'interaction et la gestion du focus déjà fournis nativement par `<dialog>`.
- `window.confirm()` : rejeté, ne permet pas d'afficher les trois valeurs (médiane, saisie, écart)
  avec une mise en forme lisible ni de style cohérent avec le reste de l'application.

## Annulation de la confirmation : faire revenir le champ à sa valeur précédente

**Decision**: Changer le contrat de la prop `onCommit` de `ResourcePriceInput` : `(value: string) =>
Promise<'accepted' | 'rejected'> | void`. Sur `'rejected'`, `ResourcePriceInput` appelle lui-même
`onChange(lastCommittedValueRef.current)` — la référence à la valeur d'avant édition qu'il suit déjà
en interne (voir `src/features/comparison/ResourcePriceInput.tsx`, utilisée pour décider si un blur
correspond à un changement réel, FR-020 de specs/004).

**Rationale**: Le composant parent (`CommunityResourcePriceRow`) ne connaît, au moment du commit, que
la valeur déjà tapée par le joueur (le carnet est mis à jour à chaque frappe via `onChange`, avant
même le blur) — il ne peut pas reconstruire seul « la valeur d'avant saisie ». `ResourcePriceInput`
est le seul endroit qui la connaît déjà (`lastCommittedValueRef`), donc c'est lui qui doit effectuer
le retour en arrière, sur simple signal du parent. Cela évite de dupliquer ce suivi d'état dans
`CommunityResourcePriceRow` ou dans `RecherchePage`.

**Alternatives considered**:
- Retarder l'écriture dans le carnet jusqu'au commit (au lieu d'écrire à chaque frappe) : rejeté,
  changerait un comportement existant sans rapport avec cette fonctionnalité (l'écriture immédiate
  sert à d'autres usages du carnet, ex. reprise après rechargement de page).
- Faire remonter `lastCommittedValueRef` au parent : rejeté, romprait l'encapsulation actuelle de
  `ResourcePriceInput` pour un besoin qu'il peut satisfaire lui-même avec l'information qu'il a déjà.

## Calcul de l'écart : dupliqué entre client et Worker plutôt que partagé

**Decision**: Deux implémentations séparées de la même formule (`|valeur − médiane| / médiane ×
100`) : `src/domain/outlier-threshold.ts` côté client, `worker/src/outlier.ts` côté Worker. Chacune
testée indépendamment.

**Rationale**: Le frontend (`src/`) et le Worker (`worker/`) sont déjà deux projets TypeScript
séparés, avec des `tsconfig.json` et des cibles de build distincts, et aucun mécanisme de partage de
code n'existe entre eux à ce jour (`worker/src/median.ts` n'a par exemple aucun équivalent ni import
côté client). Le même choix a déjà été fait pour la formule de médiane elle-même. Introduire un
paquet partagé pour une formule d'une ligne serait une nouvelle abstraction disproportionnée par
rapport au bénéfice (principe IV). Les deux usages sont par ailleurs différents dans leur portée :
côté client, la comparaison décide seulement s'il faut afficher une confirmation, sur la base de la
médiane déjà en cache (potentiellement âgée de quelques minutes, cf. `REFRESH_INTERVAL_MS`) ; côté
serveur, elle produit la valeur faisant foi pour la trace de modération, calculée juste avant
l'insertion à partir des données les plus fraîches. Les garder distinctes rend cette différence
explicite plutôt que de la masquer derrière une fonction partagée qui laisserait croire à un calcul
unique et toujours cohérent entre les deux contextes.

**Alternatives considered**:
- Un paquet npm local partagé (workspace) : rejeté, ajouterait une étape de build/configuration pour
  une fonction triviale, sans précédent dans ce dépôt.
- Faire confiance uniquement au calcul client (le Worker se contente de stocker ce que le client lui
  envoie) : rejeté, contredirait le principe II (calculs corrects et testables avec une source de
  vérité unique) — un client pourrait envoyer une médiane obsolète ou incohérente ; le Worker
  recalcule donc lui-même à partir des données qu'il possède déjà pour ses propres lectures
  (`handleGetCommunityPrice`), sans rien ajouter au contrat HTTP.

## Stockage de la trace : deux colonnes nullables sur la table existante, pas de nouvelle table

**Decision**: Ajouter `median_at_submission_kamas` (entier, nullable) et `deviation_percent` (réel,
nullable) à `community_price_contributions`, calculées et écrites pour **chaque** contribution
(pas seulement les valeurs aberrantes confirmées). La « trace des valeurs aberrantes » (FR-009) est
alors simplement `SELECT ... WHERE deviation_percent > 25`.

**Rationale**: Calculer ces deux valeurs est un sous-produit direct du calcul de médiane déjà
nécessaire pour ce couple ressource/serveur (le Worker doit de toute façon lire les contributions
existantes pour connaître la médiane avant d'insérer la nouvelle ligne). Les stocker pour toutes les
lignes, plutôt que conditionnellement, évite une branche supplémentaire dans `handlePostContribution`
et rend la requête de modération triviale (un simple filtre), sans risque d'incohérence entre « ce qui
a été jugé aberrant » et « ce qui a été stocké comme tel ». Une nouvelle table dédiée aurait dupliqué
`resource_id`/`server_id`/`amount_kamas`/`device_id`/`created_at`, déjà présents sur la ligne de
contribution elle-même — un ajout de colonnes est le changement le plus petit qui satisfasse FR-009.

**Alternatives considered**:
- Une table séparée `community_price_outliers` (une ligne par confirmation aberrante) : rejetée,
  duplique des colonnes déjà présentes sur `community_price_contributions` pour un bénéfice nul (la
  jointure resterait 1-pour-1 avec la ligne de contribution).
- Ne stocker `median_at_submission_kamas`/`deviation_percent` que lorsque l'écart dépasse le seuil
  (NULL sinon) : rejetée après réflexion — stocker systématiquement est le même travail (le calcul a
  déjà eu lieu pour décider s'il fallait écrire la valeur) et donne une donnée plus riche pour une
  éventuelle analyse future, sans coût supplémentaire.

## Affichage après transmission réussie : garder la saisie du joueur plutôt que la médiane recalculée

**Decision** *(révision 2026-09-21 bis, suite au retour du joueur)* : dans `CommunityResourcePriceRow.
handleCommit` (`src/features/search/RecherchePage.tsx`), supprimer la réécriture du champ par la
médiane recalculée après un `commit(amount)` réussi (chemin direct comme chemin confirmé par
`OutlierConfirmDialog`). `commit(amount)` continue d'être appelé pour transmettre la contribution et
rafraîchir le nombre de contributions affiché (FR-019, specs/004) ; seul son usage pour réécrire la
valeur du champ (`onChange(String(refreshed.price.medianAmountKamas))`) est retiré.

**Rationale**: Un joueur modifie un prix de ressource précisément parce qu'il vient de constater ce
montant exact en jeu ; c'est cette valeur, pas un consensus communautaire recalculé après coup, qui
doit rester affichée et alimenter son propre calcul de craft (principe III de la constitution :
distinguer valeurs saisies par l'utilisateur et valeurs dérivées, et ne jamais masquer la première
derrière la seconde). Ce changement corrige spec.004/FR-018 à sa source plutôt que d'ajouter un
contournement local à cette feature — le mécanisme de confirmation d'écart (FR-001 à FR-005) n'a besoin
d'aucune modification pour en bénéficier, puisqu'il ne fait que décider *si* une confirmation est
nécessaire avant transmission, jamais ce qui s'affiche après.

**Alternatives considered**:
- Ne changer l'affichage que pour les commits ayant déclenché une confirmation (garder l'écrasement par
  la médiane pour les commits sous le seuil) : rejeté — incohérent, un joueur dont l'écart est de 10 %
  perdrait quand même de vue sa propre saisie, alors que le problème signalé ne dépend pas du seuil.
- Introduire un champ distinct « dernière valeur saisie » séparé du carnet Mode communautaire existant :
  rejeté, le carnet (`ResourcePrice.unitPriceKamas`) sert déjà exactement ce rôle dès qu'on arrête de le
  réécrire avec la médiane — aucune nouvelle structure de données n'est nécessaire.

## Interface de consultation de la trace : hors périmètre, requête SQL directe

**Decision**: Aucune route HTTP ni écran dédié pour consulter `deviation_percent > 25` dans cette
révision. Un membre du groupe interroge directement la base via `wrangler d1 execute
dofus-craft-community-prices --command "SELECT resource_id, server_id, amount_kamas,
median_at_submission_kamas, deviation_percent, created_at FROM community_price_contributions WHERE
deviation_percent > 25 ORDER BY created_at DESC"`.

**Rationale**: Déjà acté dans spec.md/Assumptions : le public visé est restreint (une dizaine de
joueurs) et une revue occasionnelle suffit ; construire une route et un écran dédiés pour un besoin de
consultation occasionnelle par un seul mainteneur serait disproportionné (principe IV). `wrangler` est
déjà une dépendance de développement du projet (utilisée pour les migrations, cf. `quickstart.md` de
specs/004).

**Alternatives considered**:
- Une route `GET /community-price/outliers` protégée par la même clé applicative : rejetée pour cette
  révision faute de besoin démontré ; pourra être ajoutée dans une révision ultérieure si la
  consultation manuelle devient un point de friction réel (spec.md/Assumptions).
