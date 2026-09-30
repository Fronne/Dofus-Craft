# Quickstart : valider le récap FM par objet

**Feature**: [spec.md](spec.md) | Contrat : [contracts/fm-items-api.md](contracts/fm-items-api.md)

## Prérequis

- Migration `0008` sur la base locale (tests) puis distante :
  `npm run worker:db:migrate-fm-items`, **avant** de déployer le Worker.

## Tests automatisés

```bash
npm run typecheck && npm run lint && npm test
npx playwright test forgemagie --project=desktop
```

Attendu : tous verts. Couvre notamment : création, renommage et suppression d'un objet ; rattachement
refusé à un non-participant (`403`) ou sur une session déjà rattachée (`409`) ; détachement par le seul
propriétaire ; total du récap = somme des totaux des sessions ; masquage des objets d'un joueur privé ;
suppression du profil qui détache les sessions.

## Scénario manuel (site connecté au Worker)

1. Dans **Profil**, « Ajouter un objet » : chercher « Anneau Rtograf », le choisir, le nommer
   « Rtograf PA ».
2. Ouvrir une session où l'on a posté une capture : « Rattacher à… » → « Rtograf PA ». Le détail indique
   « Objet : Rtograf PA (Cyril) », et la carte de la session aussi.
3. Rattacher une deuxième session. Dans Profil, « Rtograf PA » affiche la somme des deux ; son récap
   liste les deux sessions et les runes des deux.
4. Détacher une session : le total du récap baisse d'autant.
5. Avec un autre compte : sur une session de Cyril, pas de bouton « Rattacher » ; si Cyril est privé,
   « Rattachée à l'objet d'un joueur privé ».
6. Supprimer l'objet (avec confirmation) : les sessions restent, non rattachées.
