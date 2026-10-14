# Quickstart: vérifier la refonte de la page XP Familier

## Prérequis

- `npm ci`
- `VITE_COMMUNITY_API_URL` défini (`.env.local`, ou l'adresse publique de l'API pour un aperçu).

## Tests automatiques

```bash
npx vitest run tests/unit/pet-xp.test.ts tests/integration/familier-page.test.tsx
npx tsc -b --noEmit
npx eslint src tests
```

## Vérification manuelle (`npm run dev`, page `/familier`, serveur Mikhal, Mode communautaire)

1. Niveau actuel 85, niveau visé 100 : barre à 26,2 %, « Niveau 85 · 47 003 XP », XP à donner
   132 589.
2. Le podium montre 3 cartes triées par coût total ; la 2e et la 3e indiquent « +N kamas » = écart avec
   la 1re.
3. Taper « kamat » dans « Viser une ressource précise », choisir Kamatrix : quantité, prix, coût,
   écart en %, « 1 unité = 0,019 % » (avec les prix du moment, les valeurs varient).
4. Activer l'Almanax : podium, fiche et tableau changent, l'XP à donner non.
5. Taper un nom dans le filtre du tableau : le podium ne bouge pas, les rangs des lignes non plus.
6. Trier le tableau par XP : l'ordre change, les rangs restent.
7. Niveau visé = niveau actuel : seul le bandeau reste, avec « Aucune XP à donner ».
8. Largeur 375 px : blocs empilés, pas de défilement horizontal de la page ; thème clair lisible.
