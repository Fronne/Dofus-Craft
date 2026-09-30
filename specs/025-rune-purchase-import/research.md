# Research: Page Forgemagie — profils Discord, sessions FM et prix des runes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-30

Sources lues : le Worker `worker/src/` (routes, contributions, rétention, écart), le site
(`src/services/community-price-api.ts`, `src/features/comparison/`, `src/features/hdv/`,
`scripts/build-hdv-items.mjs`), le Worker d'administration (`admin-worker/src/access.ts`) et le bot
Botomoux (`main.py`, dépôt `jamingaetan1-blip/Botomouxv2`, commit `1432996`).

---

## R1. Où vivent les nouvelles routes

**Decision** : dans le Worker existant `dofus-craft-community-price-api` (`worker/`), avec la même
base D1. Nouveaux modules : `worker/src/fm/` (auth Discord, événements du bot, lectures FM, import
depuis le site).

**Rationale** : les prix tirés des achats sont des contributions de la table
`community_price_contributions` ; les écrire depuis le même Worker réutilise `insertContribution`,
le calcul d'écart et le cache de lecture sans duplication (principe IV). Un Worker de plus
demanderait un second accès à la même base.

**Alternatives considered** : un Worker dédié `fm-api` (séparation plus nette, mais deux Workers
sur une base et du code d'écriture des prix dupliqué) ; le Worker du site statique (`wrangler.toml`
racine), qui ne sert que des fichiers.

---

## R2. Connexion Discord : quelle application, quelles permissions

**Decision** : OAuth2 Discord (flux « authorization code ») avec une **application Discord dédiée à
la connexion**, créée par le porteur du projet, distincte de celle du bot. Permissions demandées :
`identify` et `guilds.members.read`. L'appartenance au serveur du groupe est vérifiée par
`GET /users/@me/guilds/{DISCORD_GUILD_ID}/member` avec le jeton de l'utilisateur : une réponse 404
signifie « pas membre » et la connexion est refusée (FR-002).

**Rationale** :
- Les identifiants Discord des utilisateurs sont les mêmes quelle que soit l'application : le bot
  (qui voit `message.author.id`) et le site (qui voit `/users/@me`) désignent la même personne, sans
  liaison manuelle (spec, Contexte).
- Une application à part évite de dépendre du secret de l'application du bot, qui appartient à
  l'ami du groupe.
- `guilds.members.read` ne donne accès qu'au profil de membre dans **ce** serveur. La permission
  `guilds` renverrait la liste de tous les serveurs du joueur, plus que nécessaire (principe V,
  FR-004). `email` n'est pas demandé.
- Le jeton d'accès Discord sert une seule fois, pendant le callback, et n'est **jamais stocké**.

**Alternatives considered** : vérifier l'appartenance avec le jeton du bot (`GET
/guilds/{id}/members/{user}`), ce qui demande l'intent privilégié « Server Members » et le secret du
bot ; demander `guilds`, écarté pour la raison ci-dessus.

**Secrets du Worker** (jamais dans le code) : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`DISCORD_GUILD_ID`, `FM_BOT_API_KEY`. Variable publique : `SITE_URL` (redirection après
connexion).

---

## R3. Session du site : jeton porteur, pas de cookie

**Decision** : à la fin du callback OAuth, le Worker crée une session (jeton aléatoire de 32 octets)
et redirige vers `SITE_URL/forgemagie#session=<jeton>`. Le site lit le fragment, l'enlève
immédiatement de l'adresse (`history.replaceState`), garde le jeton dans `localStorage` et l'envoie
dans l'en-tête `Authorization: Bearer <jeton>` pour les routes FM. Le Worker ne garde que le
**SHA-256 du jeton**, avec une date d'expiration de 30 jours. La déconnexion supprime la ligne.

**Rationale** :
- Le site (`dofus-craft.dofus-craft.workers.dev`) et l'API
  (`dofus-craft-community-price-api.….workers.dev`) sont sur des origines différentes : un cookie de
  l'API serait un cookie tiers, bloqué par Safari et de plus en plus par Chrome. Un jeton porteur
  fonctionne partout, sans changer la configuration CORS (`Access-Control-Allow-Origin: *`,
  `Authorization` déjà autorisé).
- Le fragment `#…` n'est jamais envoyé à un serveur ni dans l'en-tête `Referer`.
- Une session stockée en base (et non un JWT signé) peut être révoquée : déconnexion, suppression du
  profil (FR-007).
- Un paramètre `state` aléatoire, gardé en base 10 minutes, protège le callback contre la
  falsification de requête (CSRF OAuth).

**Alternatives considered** : cookie `SameSite=None` (bloqué comme cookie tiers) ; proxy des routes
de l'API derrière le Worker du site pour un cookie de même origine (change le déploiement du site,
disproportionné) ; JWT signé avec `jose` (non révocable sans liste noire).

**Conflit d'en-tête** : les routes d'écriture existantes attendent `Authorization: Bearer
<COMMUNITY_API_KEY>`. Les routes `/fm/*` sont traitées **avant** ce contrôle, chacune avec sa propre
authentification (jeton de session ou clé du bot). Les routes existantes ne changent pas.

**Membre qui quitte le serveur Discord** : sa session en cours reste valable jusqu'à expiration
(30 jours au plus) ; la connexion suivante est refusée. Acceptable pour un groupe fermé de 10 à 20
joueurs (spec, Edge Cases).

---

## R4. Envois du bot : événements, clé, idempotence

**Decision** : une route `POST /fm/bot/events`, protégée par `Authorization: Bearer
<FM_BOT_API_KEY>` (secret distinct de `COMMUNITY_API_KEY`, qui est public dans le bundle du site).
Le bot envoie un événement par action : `session-start` (`/fmstart`), `capture` (message avec
captures traité), `session-reset` (`/fmreset`), `session-stop` (`/fmstop`). Chaque événement porte
un `eventId` : l'identifiant Discord du message ou de l'interaction. Une table
`fm_processed_events` avec cet identifiant en clé primaire rend tout renvoi sans effet (FR-020).
Contrat complet : [contracts/fm-bot-api.md](contracts/fm-bot-api.md).

**Rationale** :
- Le bot identifie une session par son salon (`channel_id`) et n'a pas d'identifiant de session.
  Le Worker fait de même : **une seule session ouverte par salon**. `session-start` ferme la
  session ouverte du salon s'il y en a une, puis en ouvre une nouvelle, comme `empty_session()`
  dans le bot.
- Si une `capture` arrive sans session ouverte dans ce salon (le Worker était injoignable pendant
  `/fmstart`, ou la session a commencé avant la mise à jour du bot), le Worker ouvre la session
  à la date de la capture. Rien n'est perdu, et le site montre ce que le bot a compté.
- **Dépense = ce que compte le bot** (FR-011) : le bot additionne toutes les valeurs « N kamas »
  supérieures à 1 000 (`extract_kamas`), ce qui n'est pas toujours la somme des totaux des lignes
  d'achat (`extract_runes`). L'événement `capture` transmet donc les deux : `spentKamas` (la valeur
  `added_total` du bot) et `lines` (les lignes d'achat). La dépense affichée utilise `spentKamas` ;
  le détail par rune utilise `lines`, comme les embeds du bot.
- **Traitement ligne par ligne** : une ligne invalide est rejetée avec sa raison, sans bloquer les
  autres. La réponse liste chaque ligne avec son statut, pour que le bot puisse le signaler.

**Alternatives considered** : un seul envoi du résumé final à `/fmstop` (plus simple, mais le site
ne montrerait rien pendant la session, contraire à US2 scénario 1, et une session jamais fermée
serait perdue) ; un identifiant de session créé par le bot (demande de changer la structure de
`data.json` du bot).

**Modifications attendues du bot** (faites par son auteur, hors de ce dépôt) : un appel HTTP dans
`fmstart`, `fmreset`, `fmstop` et `on_message`, avec les champs déjà disponibles
(`interaction.id` ou `message.id`, `channel.id`, `channel.name`, `author.id`,
`author.display_name`, `author.display_avatar.url`, `added_total`, liste des lignes lues). Un échec
d'envoi ne doit jamais bloquer le bot dans Discord ; le bot peut renvoyer plus tard, sans double
comptage.

---

## R5. Reconnaître l'objet d'une ligne d'achat

**Decision** : correspondance **exacte** du nom (après normalisation des espaces multiples et de la
casse, sans correction des accents ni des lettres) avec un index des objets qui ont un prix dans
l'app : les ressources de `src/data/hdv-items.json` plus les runes de `src/data/rune-items.json`
(R6). Le script de génération produit aussi `worker/src/fm/priceable-items.json` (nom normalisé →
identifiant), importé par le Worker.

**Rationale** :
- FR-019 : seule une ressource du catalogue au nom exact crée un prix, jamais un équipement. Les
  objets de `hdv-items.json` sont exactement les ressources dont l'app se sert (ingrédients de
  recettes, nourritures de familier) et n'incluent ni équipement, ni certificat de dragodinde.
- Un index statique évite un appel à DofusDB à chaque capture ; le catalogue change très rarement.
- Taille estimée : environ 5 000 entrées de nom court, soit 150 à 200 Ko, largement sous la limite
  d'un Worker.
- Deux objets de même nom (rare) : l'entrée est marquée ambiguë et aucune ligne ne crée de prix
  pour ce nom ; la dépense reste comptée.

**Alternatives considered** : recherche dans DofusDB à chaque ligne (dépendance réseau à chaque
capture) ; correspondance approximative (distance d'édition), refusée par la spec pour le bot.

---

## R6. Liste des runes et leur stat

**Decision** : un script `scripts/build-rune-items.mjs`, sur le modèle de
`scripts/build-hdv-items.mjs`, lit dans DofusDB les objets du type 78 (« Rune de forgemagie »,
105 objets le 2026-09-30) et génère `src/data/rune-items.json` : identifiant, nom, icône, niveau,
effet (`possibleEffects[0].effectId`) et caractéristique associée (via `GET /effects`,
champ `characteristic`), avec le nom français de la stat. Le fichier est relu et commité à la main.

**Rationale** : même démarche que la page HDV (specs/023) et que les données du familier ; le
filtre « par stat » (FR-017) et l'icône de la caractéristique
(`src/domain/characteristic-icons.ts`) en découlent directement. Une rune sans effet reconnu est
classée « Autre » plutôt qu'écartée.

**Alternatives considered** : charger les runes en direct depuis DofusDB à l'ouverture de la page
(latence et dépendance réseau pour des données presque figées) ; déduire la stat du nom de la rune
(fragile : « Ra », « Pa », « Ga », noms irréguliers).

---

## R7. Origine d'un prix

**Decision** : nouvelle colonne `origin` dans `community_price_contributions` (`'manual'` par
défaut, `'capture'`, `'bot'`), ajoutée par une migration `0007`. Les lectures groupées
`GET /community-prices` et `GET /community-price` ajoutent `latestOrigin` (la valeur de la
contribution la plus récente). Ce champ est **optionnel** pour le site : absent, il vaut
« Saisie manuelle ».

**Rationale** : FR-011 et FR-017 demandent l'origine du dernier prix ; toutes les lignes existantes
sont des saisies manuelles, d'où la valeur par défaut. L'ajout d'un champ garde l'API compatible
avec le site déjà en ligne (même démarche que specs/024).

**Alternatives considered** : retrouver l'origine par jointure avec les achats FM (plus coûteux à
chaque lecture, et sans réponse pour les prix saisis à la main).

---

## R8. Prix créés par un achat : règles et anonymat

**Decision** :
- Un achat du bot crée une contribution de ressource (`kind = 'resource'`, `origin = 'bot'`) si et
  seulement si : le nom est reconnu (R5), le joueur a un serveur Dofus sur son profil, et l'écart
  avec la médiane du groupe ne dépasse pas 25 % (FR-019). Sans médiane connue, la contribution est
  créée. Le calcul de l'écart réutilise `fetchCurrentMedian` et `computeDeviationPercent`.
- Un achat importé sur le site crée une contribution `origin = 'capture'`, seulement si le joueur
  est en Mode communautaire. Le site demande la confirmation existante (specs/007) pour un prix
  aberrant **avant** l'envoi. En Mode personnel, le site enregistre le prix sur l'appareil, comme
  une saisie manuelle.
- Le prix unitaire est `Math.round(total / quantité)` (FR-022).
- `device_id` de la contribution = `fm:` suivi des 16 premiers caractères hexadécimaux du SHA-256
  de l'identifiant Discord du joueur.

**Rationale** : le `device_id` sert à ne compter qu'une fois un même contributeur dans la médiane
(`latestPerDevice`). Un pseudonyme stable par joueur garde cette règle, sans écrire l'identifiant
Discord dans la table des prix, qui reste une table sans donnée de joueur (specs/004, FR-010). Le
lien entre un achat et sa contribution reste dans la table des achats FM, accessible au seul
Worker.

**Alternatives considered** : `device_id` vide (chaque achat compterait comme un contributeur
différent dans la médiane) ; un `device_id` unique partagé par tous les achats du bot (tous les
joueurs n'en feraient qu'un).

---

## R9. Lecture des captures sur le site (OCR)

**Decision** : Tesseract.js (dépendance npm `tesseract.js`), chargé **à la demande** au premier
import (import dynamique), avec le modèle de langue `fra`. Le même prétraitement que le bot est
appliqué dans un `<canvas>` : niveaux de gris, agrandissement ×3, contraste, seuil à 150. La même
expression régulière que le bot extrait les lignes d'achat. Les fichiers du moteur et du modèle sont
chargés depuis le CDN jsDelivr (comportement par défaut de Tesseract.js). S'ils ne se chargent pas,
un message clair s'affiche et rien n'est enregistré.

**Rationale** :
- FR-025 : l'image ne quitte jamais l'appareil.
- Même moteur et même prétraitement que le bot : le site et Discord lisent les captures de la même
  façon, et les réglages éprouvés du bot sont repris.
- Le chargement à la demande ne pèse pas sur les autres pages (plusieurs Mo, seulement au premier
  import).
- Nouvelle dépendance justifiée par un besoin actuel (principe IV) ; aucune alternative ne lit du
  texte dans une image dans le navigateur sans modèle.

**Alternatives considered** : envoyer l'image au Worker (contraire à FR-025, et les Workers n'ont pas
d'OCR) ; l'API `TextDetector` du navigateur (expérimentale, absente de Firefox et Safari) ; héberger
le modèle dans `public/` (possible plus tard si le CDN pose problème).

---

## R10. Visibilité, suppression, conservation

**Decision** :
- Table `fm_players` : une ligne par joueur Discord vu par le bot ou connecté (pseudo, avatar,
  serveur Dofus, visibilité, date de première connexion). Un joueur jamais connecté est **public**
  par défaut (FR-006) et apparaît sous son pseudo Discord.
- Le filtrage des joueurs privés se fait **dans le Worker** (FR-014, FR-015, SC-004) : les réponses
  destinées aux autres membres remplacent pseudo, avatar et identifiant par `null` et
  `private: true`. Un profil privé demandé par un autre membre répond 404.
- La suppression du profil (FR-007) supprime, dans une transaction D1 (`batch`) : les sessions de
  connexion, les achats et captures du joueur, ses imports, puis sa ligne `fm_players`. Les totaux
  de session sont calculés à la lecture, donc ils se recalculent d'eux-mêmes. Les **contributions
  de prix** déjà créées restent : elles sont anonymes (R8) et disparaissent au bout de 90 jours
  (FR-012).
- Aucune purge automatique des sessions ni des achats (FR-012). La purge hebdomadaire des prix ne
  change pas.
- Un joueur qui supprime son profil puis poste de nouveau dans Discord réapparaît comme joueur
  public jamais connecté ; c'est le comportement attendu d'un bot qui ne sait rien de ce choix.

**Rationale** : les totaux calculés à la lecture évitent tout écart entre la somme affichée et les
lignes (FR-011) et rendent la suppression simple.

---

## R11. Serveur Dofus d'un achat

**Decision** : le serveur est figé **au moment de l'enregistrement** de l'achat, à partir du profil
du joueur (`fm_players.server_id`). Un joueur sans serveur a ses achats comptés sans prix. Changer
de serveur ne modifie pas les achats passés (spec, Edge Cases). À la première connexion, le site
envoie le serveur actif de son sélecteur, qui devient le serveur du profil (FR-005).

---

## R12. Page et navigation

**Decision** : route `/forgemagie`, entrée « Forgemagie » dans la navigation principale
(`src/app/AppShell.tsx`, `ROUTES` de `src/app/router.tsx`). La page a trois onglets : **Sessions**
(historique, par défaut), **Profil** (le mien, ou celui d'un membre public), **Runes** (liste des
prix, avec l'import de capture). Sans connexion, la page montre seulement l'explication et le bouton
« Se connecter avec Discord » (FR-001). La liste des runes réutilise les lignes de prix existantes
(`CommunityResourcePriceRow`, historique, prix périmés), comme la page HDV.

**Rationale** : l'historique des sessions est la raison d'être de la connexion (US2, P1).
