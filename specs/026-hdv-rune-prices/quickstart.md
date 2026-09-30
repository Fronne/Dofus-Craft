# Quickstart : valider les prix des runes dans la page HDV

**Feature**: [spec.md](spec.md)

## Tests automatisés

```bash
npm run typecheck && npm run lint && npm test
npm run test:e2e -- hdv-price-entry forgemagie
```

Attendu : tous verts. Couvre notamment `filterRunes`, les filtres de prix génériques, l'onglet Runes
de la page HDV (recherche, stat, compteur, origine, onglet retenu) et la page Forgemagie à deux onglets
avec l'import dans Profil.

## Scénarios manuels (`npm run dev`)

1. **Sans connexion**, ouvrir **HDV** : quatre onglets, « Runes » en dernier. L'ouvrir : les runes
   s'affichent avec icône, stat et champ de prix ; le compteur indique « N objets sur 105 ».
2. Taper « Do Air » : deux runes (Rune Do Air, Rune Pa Do Air). Choisir la stat « Force » : seulement
   les runes de Force. Filtre « Sans prix » : seulement les runes sans prix.
3. Saisir un prix pour la Rune Fo : « Dernière mise à jour » apparaît et le compteur augmente. Le même
   prix est utilisé ailleurs pour cette rune (même carnet).
4. En Mode communautaire, une rune avec un prix partagé par le bot affiche « Bot Discord ».
5. Recharger la page HDV : l'onglet Runes est rouvert.
6. **Connecté**, ouvrir **Forgemagie** : onglets Sessions et Profil seulement. Dans Profil, coller une
   capture et valider : l'achat apparaît dans « Total dépensé » sans recharger ; sur le profil d'un
   autre membre, aucun import proposé.
