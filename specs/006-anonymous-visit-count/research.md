# Research: Comptage anonyme des visites

## Déduplication par jour : contrainte SQL plutôt que logique applicative

**Decision**: La table `app_visits` a une clé primaire composite `(device_id, day)`. Le Worker
insère avec `INSERT OR IGNORE INTO app_visits (device_id, day) VALUES (?, ?)` — si la ligne existe
déjà pour cet appareil et ce jour, l'insertion ne fait rien, sans erreur. Aucune vérification côté
client (pas de « ai-je déjà envoyé aujourd'hui ? » stocké en `localStorage`) : le client envoie à
chaque montage de `AppShell`, systématiquement.

**Rationale**: Une contrainte de clé primaire est atomique et correcte même si le client envoie
plusieurs fois le même jour (plusieurs onglets ouverts, rechargements multiples) — un
« ai-je déjà envoyé aujourd'hui » côté client serait une source d'état supplémentaire à synchroniser
sans bénéfice réel : le signal étant minuscule (deux champs), envoyer une requête redondante de temps
à autre est négligeable comparé à la complexité d'un suivi côté client. Cohérent avec le principe IV
(pas d'abstraction pour un problème que la base résout déjà nativement).

**Alternatives considered**:

- Table `(id, device_id, created_at)` sans contrainte d'unicité, dédupliquée à la lecture (`SELECT
  COUNT(DISTINCT device_id)` sur une plage de dates) : rejeté — fonctionnellement équivalent pour
  compter les visiteurs uniques sur une période, mais accumule une ligne par chargement de page au
  lieu d'une ligne par appareil et par jour, sans bénéfice correspondant (FR-005 demande
  explicitement d'éviter les doublons quotidiens, pas seulement de pouvoir les filtrer après coup).
- Suivi côté client (`localStorage` d'une date de dernier envoi) pour n'envoyer qu'une requête par
  jour : rejeté — ajoute un état local à maintenir pour un bénéfice réseau marginal à cette échelle
  (quelques dizaines de requêtes par jour au plus), alors que la base garantit déjà la même propriété
  finale sans cet état supplémentaire.

## Date du jour : calculée côté client ou côté serveur ?

**Decision**: Le jour (`YYYY-MM-DD`) est calculé côté serveur, dans le Worker
(`new Date().toISOString().slice(0, 10)`), à la réception de la requête — pas envoyé par le client.

**Rationale**: Le Worker a déjà `created_at` généré côté base pour les contributions de prix
(`strftime(...)`, `worker/schema.sql`) ; calculer le jour côté serveur garantit une source de vérité
unique et évite qu'un client avec une horloge locale incorrecte (ou un fuseau horaire différent)
crée des jours incohérents entre appareils. Le corps de la requête `POST /visit` ne contient donc
que `{ deviceId }` — encore plus minimal que ce que décrivait l'intention initiale.

**Alternatives considered**: Calculer le jour côté client et l'envoyer dans le corps de la requête :
rejeté — introduirait une dépendance à l'horloge/au fuseau du navigateur du joueur pour une donnée
qui n'a de sens que du point de vue du serveur qui agrège les visiteurs uniques ; le Worker peut
calculer cette valeur lui-même sans aucune information supplémentaire du client.

## Extraction d'un helper générique de génération d'identifiant d'appareil

**Decision**: `src/persistence/device-id.ts` exporte une fonction générique paramétrée par la clé de
stockage (ex. `createDeviceId(storageKey: string): string`), avec la même logique try/catch déjà
écrite dans `community-device-id.ts` (révision 5 de specs/004). `community-device-id.ts` et le
nouveau `visit-device-id.ts` deviennent chacun un fichier de quelques lignes qui appelle ce helper
avec leur propre clé (`craftcheck-community-device-id` / `craftcheck-visit-device-id`).

**Rationale**: Sans cette extraction, la même logique (lire, générer si absent, écrire, dégrader
sans exception) serait dupliquée mot pour mot entre deux fichiers. C'est un cas concret de doublon
immédiat (deux appelants dès ce plan, pas un troisième hypothétique) — l'extraction reste donc
justifiée par le principe IV plutôt qu'être une anticipation.

**Alternatives considered**: Dupliquer le code tel quel dans `visit-device-id.ts` : rejeté — la
duplication mot pour mot d'une fonction de ~15 lignes entre deux fichiers, avec le même risque de
divergence future (un correctif appliqué à l'un sans l'autre), est précisément ce que le principe IV
décourage une fois qu'un second appelant réel existe.

## Deux identifiants d'appareil distincts plutôt qu'un seul partagé

**Decision**: L'identifiant d'appareil du signal de présence (`craftcheck-visit-device-id`) reste
entièrement distinct de celui des contributions de prix communautaires
(`craftcheck-community-device-id`, specs/004) — deux valeurs différentes, deux clés `localStorage`
différentes, aucune table ne les relie.

**Rationale**: Réutiliser le même identifiant pour les deux usages permettrait, en théorie, de
recouper une présence quotidienne avec des contributions de prix précises pour le même appareil —
un couplage que ni l'une ni l'autre spec n'a besoin d'introduire, et qui affaiblirait la garantie
d'anonymat déjà actée pour les contributions de prix (specs/004, FR-010/FR-023 : le `deviceId` des
prix ne doit jamais servir à autre chose qu'à reconnaître des contributions de prix entre elles).
Garder les deux identifiants séparés maintient chaque fonctionnalité indépendante et son
périmètre d'anonymat strictement borné à son propre usage.

**Alternatives considered**: Un seul identifiant d'appareil partagé entre les deux usages : rejeté
pour la raison de couplage/anonymat ci-dessus, malgré la légère économie de code qu'il aurait permise
(déjà largement compensée par l'extraction du helper générique ci-dessus).
