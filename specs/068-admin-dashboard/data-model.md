# Modèle de données : Tableau de bord de l'administration

Aucune donnée persistée. Types en mémoire seulement (`admin/dashboard-summary.ts`).

## SectionId

`'pages' | 'bandeau' | 'compteurs' | 'cles' | 'correspondances' | 'cloudflare'` — ancre = identifiant. Ordre d'affichage des cartes = ordre ci-dessus.

## CardSummary

| Champ | Type | Règle |
|---|---|---|
| `state` | `'loading' \| 'ok' \| 'unavailable'` | `unavailable` si la lecture échoue |
| `text` | `string` | phrase de résumé ; vide pendant `loading` |
| `tone` | `'neutral' \| 'good' \| 'warning' \| 'over'` | `warning`/`over` seulement pour Cloudflare ; sert au style, jamais seul (le texte dit la même chose) |

## Règles de résumé

- **pages** : `n` pages activées sur 2 (`forgemagiePage`, `hdvPage`) → « 1 page active sur 2 ».
- **bandeau** : message `null` → « Aucun bandeau » ; sinon « Bandeau affiché ».
- **compteurs** : 0 → « Aucun compteur » ; 1 → « 1 compteur » ; n → « n compteurs ».
- **cles** : clés sans `revokedAt` → « n clé(s) active(s) », 0 → « Aucune clé active ».
- **correspondances** : total ; version active si présente (« 3 correspondances · actif : build X »), sinon « Aucune correspondance active ».
- **cloudflare** : état `ok` → métrique au pourcentage le plus haut, « Requêtes Workers : 42 % · Dans la limite » ; ton selon le pire `usageLevel`. `not-configured` → « Jeton non configuré » (neutre). `denied` / `unavailable` → `unavailable`.

## Ancre → vue

`parseSection(hash)` : `#compteurs` ou `compteurs` → `'compteurs'` ; vide ou inconnue → `undefined` (tableau de bord).
