# Spec 077 — Admin : graphiques plus visuels, sans valeurs à 0

## Besoin
Les graphes de la page admin sont peu lisibles (barres fines, nombreux jours à 0). Ils doivent être plus visuels (UX/UI)
et ne plus montrer les valeurs à 0. Rendu validé sur maquette (2026-10-26).

## Exigences
- **FR-001** Colonnes jour par jour (prix, visites, contributions) : colonnes larges et arrondies, première série en
  dégradé de l'accent, repères horizontaux, dates sous les colonnes (au plus 8 libellés).
- **FR-002** La valeur d'un jour s'affiche au survol ou au focus ; le meilleur jour est toujours écrit.
- **FR-003** Les jours sans aucune valeur ne sont ni dessinés ni listés dans « Voir les valeurs jour par jour ».
- **FR-004** Barres horizontales (clés, compteurs) : arrondies, en dégradé. Celles à 0 ne sont pas dessinées : une ligne
  les compte (« N clés sans envoi ce mois-ci », « N compteurs à 0 »).
- **FR-005** Courbes Cloudflare (jour en cours et historique) : lissées, aire dégradée, pastille au bout de chaque courbe
  (« Requêtes 62 % »), dimensionnée d'après son texte pour ne jamais être rognée.
- **FR-006** Les hachures et points des séries restent, pour ne pas dépendre de la couleur seule ; les valeurs restent
  aussi dans des tableaux.

## Fait
`admin/DailyColumns.tsx`, `BarList.tsx`, `DayUsageChart.tsx`, `UsageChart.tsx`, `chart-paths.ts` (courbes lissées, pastilles),
`usage-style.ts`, `admin.css` ; `tests/integration/admin-dashboard.test.tsx` adapté (jours et clés à 0).
