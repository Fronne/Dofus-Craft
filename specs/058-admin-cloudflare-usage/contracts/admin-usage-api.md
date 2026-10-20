# Contrat : API d'utilisation Cloudflare (Worker `dofus-craft-admin`)

Toutes les routes passent par `verifyOwner` ; hors propriétaire : `403 { "error": "Accès réservé au propriétaire." }`.
Réponses `Cache-Control: no-store`.

## `GET /api/usage?days=7|30`

`days` : `7` (défaut si absent) ou `30`. Autre valeur : `400 { "error": "…", "field": "days" }`.

### 200 — lecture réussie

```json
{
  "state": "ok",
  "days": 7,
  "readAt": "2026-10-19T14:03:11.000Z",
  "history": [
    { "date": "2026-10-13", "workersRequests": 1200, "d1RowsRead": 54000, "d1RowsWritten": 310 }
  ]
}
```

`history` : exactement `days` éléments, du plus ancien au plus récent, le dernier étant le jour UTC
en cours ; jours sans donnée à 0 ; entiers ≥ 0.

### 200 — source non configurée

```json
{ "state": "not-configured", "missing": ["CLOUDFLARE_API_TOKEN"] }
```

Aucun appel à Cloudflare n'a lieu.

### 200 — jeton refusé

```json
{ "state": "denied" }
```

### 200 — Cloudflare indisponible ou réponse inattendue

```json
{ "state": "unavailable" }
```

Jamais de jeton, d'identifiant de compte ni de message brut de Cloudflare dans aucune réponse.

## Interface (page)

Section « Utilisation Cloudflare » : 3 lignes (libellé, `consommé / limite`, `N %`, barre,
niveau en texte) ; boutons radio / segmentés « 7 jours » · « 30 jours » ; graphique ; « Actualiser » ;
« Dernière lecture : HH:MM UTC ». États `not-configured` / `denied` / `unavailable` : message avec
marche à suivre ou « Réessayer ».
