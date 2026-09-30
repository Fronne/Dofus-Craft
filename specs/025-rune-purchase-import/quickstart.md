# Quickstart : valider la page Forgemagie

**Feature**: [spec.md](spec.md) | Contrats : [fm-bot-api.md](contracts/fm-bot-api.md),
[fm-site-api.md](contracts/fm-site-api.md), [rune-items-data.md](contracts/rune-items-data.md)

## Prérequis (une fois)

1. **Application Discord de connexion** (portail développeur Discord, application créée par le
   porteur du projet) : ajouter l'URL de redirection
   `{URL du Worker}/fm/auth/callback` (et `http://localhost:8787/fm/auth/callback` pour le
   développement). Noter l'identifiant et le secret du client.
2. **Identifiant du serveur Discord du groupe** : mode développeur de Discord → clic droit sur le
   serveur → « Copier l'identifiant ».
3. **Secrets du Worker** :
   ```bash
   wrangler secret put DISCORD_CLIENT_ID --config worker/wrangler.toml
   wrangler secret put DISCORD_CLIENT_SECRET --config worker/wrangler.toml
   wrangler secret put DISCORD_GUILD_ID --config worker/wrangler.toml
   wrangler secret put FM_BOT_API_KEY --config worker/wrangler.toml   # valeur aléatoire longue
   ```
   En local, les mêmes valeurs vont dans `worker/.dev.vars` (non commité).
4. **Base** : `npm run worker:db:migrate-forgemagie` (migration `0007`), **avant** de déployer le
   Worker.
5. **Données** : `node scripts/build-rune-items.mjs`, relire le résumé, commiter
   `src/data/rune-items.json` et `worker/src/fm/priceable-items.json`.

## Tests automatisés

```bash
npm run typecheck && npm run lint && npm test
npm run test:e2e -- forgemagie
```

Attendu : tous verts. Les tests couvrent notamment la lecture des lignes d'achat et l'arrondi du
prix unitaire, les quatre événements du bot et leur idempotence, les statuts de prix
(`unknown-item`, `no-server`, `outlier`…), le masquage des joueurs privés, la suppression du profil
et le parcours de connexion avec Discord simulé.

## Scénarios de validation manuelle

### 1. Connexion (US1)

1. `npm run worker:dev` et `npm run dev` (avec `VITE_COMMUNITY_API_URL` pointant sur le Worker
   local).
2. Ouvrir `/forgemagie` sans être connecté → explication et bouton « Se connecter avec Discord ».
   Les autres pages s'ouvrent sans connexion.
3. Se connecter avec un compte **membre** du serveur du groupe → retour sur `/forgemagie`, profil
   avec pseudo et avatar, serveur pré-rempli avec celui du sélecteur. L'adresse ne contient plus
   `#session=…`.
4. Se connecter avec un compte **non membre** → message « réservé aux membres du serveur Discord du
   groupe », aucun profil créé (vérifier `SELECT * FROM fm_players`).

### 2. Session du bot (US2), sans le bot

Simuler le bot avec `curl` (corps d'exemple dans [fm-bot-api.md](contracts/fm-bot-api.md)) :

```bash
curl -X POST "$API/fm/bot/events" -H "Authorization: Bearer $FM_BOT_API_KEY" \
  -H 'Content-Type: application/json' -d @session-start.json
curl -X POST "$API/fm/bot/events" -H "Authorization: Bearer $FM_BOT_API_KEY" \
  -H 'Content-Type: application/json' -d @capture.json
```

- La session apparaît « en cours » sur le site, avec le joueur et 63 472 kamas, et la ligne
  Rune Do Air : 40, 63 472 kamas, 1 587 kamas/u.
- Renvoyer `capture.json` → réponse `"duplicate": true`, totaux inchangés.
- Même envoi sans l'en-tête `Authorization` → `401`, rien d'enregistré.
- Envoyer `session-stop` → la session passe à « terminée ».

### 3. Prix des runes (US4)

- Joueur **avec** serveur : après la capture, l'onglet Runes (même serveur dans le sélecteur)
  affiche Rune Do Air à 1 587 kamas, avec la date et « Bot Discord ».
- Joueur **sans** serveur : la capture compte dans la dépense, mais ne crée pas de prix
  (`priceStatus: "no-server"`).
- Capture avec un prix à plus de 25 % de la médiane : la dépense est comptée, sans prix
  (`"outlier"`).

### 4. Visibilité et suppression (US3)

- Passer le profil A en privé. Avec le compte B : la ligne de A dans la session affiche
  « Joueur privé », le total est inchangé, et le profil de A répond « introuvable ».
- Supprimer le profil A (avec confirmation) : sa ligne disparaît des sessions et les totaux sont
  recalculés.

### 5. Import d'une capture (US5)

- Coller la capture d'exemple (`10 x [Rune Do Air] (15 868 kamas)`, quatre fois) → proposition :
  Rune Do Air, 10, 15 868, 1 587 kamas/u. Rien n'est enregistré avant « Valider ».
- Corriger le total → le prix unitaire se recalcule.
- Valider en Mode communautaire → la dépense apparaît sur le profil (hors session), et le prix
  dans l'onglet Runes avec l'origine « Capture ».

## Mise en production

1. Migration `0007` sur la base distante.
2. Secrets du Worker (prérequis 3) et URL de redirection de production dans l'application Discord.
3. `npm run worker:deploy`, puis déploiement du site.
4. Donner à l'auteur du bot l'URL du Worker, la clé `FM_BOT_API_KEY` (par message privé, jamais
   dans un dépôt) et [contracts/fm-bot-api.md](contracts/fm-bot-api.md).
