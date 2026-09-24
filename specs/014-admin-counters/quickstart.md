# Quickstart : valider l'administration des compteurs

## Mise en place (une fois)

1. `npm run worker:db:migrate-player-counters` (table + deux compteurs actuels).
2. `npm run worker:deploy` (lecture publique `GET /player-counters`).
3. `npm run admin:build && npm run admin:deploy` (Worker `dofus-craft-admin`).
4. Tableau de bord Cloudflare → Workers & Pages → `dofus-craft-admin` → **Access** → « Protect this
   Worker behind Access » : production, autoriser uniquement votre adresse e-mail. Dans Zero Trust →
   Access → Applications → cette application : durée de session 1 mois ; noter l'**AUD tag** et le
   **domaine d'équipe**.
5. Renseigner `POLICY_AUD` et `TEAM_DOMAIN` dans `admin-worker/wrangler.toml`, puis
   `npx wrangler secret put OWNER_EMAIL --config admin-worker/wrangler.toml` (vous tapez l'adresse),
   et redéployer l'admin.
6. `npm run build && npx wrangler deploy` (site public lisant les compteurs).

## Automatique

```bash
npm test && npm run typecheck && npm run lint
npx playwright test --project=desktop
```

## Manuel

1. Fenêtre privée → adresse admin : connexion par e-mail demandée ; une autre adresse est refusée
   (US2).
2. Connecté : les deux compteurs apparaissent ; changer 150 → 162, décocher « au moins »,
   enregistrer ; recharger le site public : 162 (US1, SC-002).
3. `curl -X PATCH https://dofus-craft-admin…/api/counters/<id>` sans session : redirection vers la
   connexion ou 403, rien ne change (FR-007, SC-003).
4. Ajouter un compteur (classe, sexe, recherche « Strigide », libellés, chiffre) : nouvelle bulle
   sur le site (US3). Champ manquant : refus nommant le champ.
5. Supprimer ce compteur, confirmer : la bulle disparaît ; annuler : rien ne change (US4).
6. Couper le réseau sur le site public : derniers compteurs connus affichés (FR-004).
