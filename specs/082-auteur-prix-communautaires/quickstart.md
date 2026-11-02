# Guide de validation : Auteur et date des prix communautaires

## Prérequis

- Worker local : `npm run worker:dev`, base locale avec la migration appliquée :
  `npx wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/migrations/0031_add_price_author.sql`
- Site : `npm run dev` avec `VITE_COMMUNITY_API_URL` et `VITE_COMMUNITY_API_KEY` dans `.env.local`.
- Un compte Discord pour la connexion (spec 075).

## Tests automatiques

```bash
npm run test
```

Couverture attendue :

- Worker : jeton valide / absent / expiré à la saisie ; `latestAuthor` et `author` présents pour un
  profil public, absents pour un profil privé, sans auteur, supprimé ou ancien ; l'identifiant
  Discord n'apparaît dans aucune réponse ; `GET /fm/me/contributions` (total, ordre, limite 20, 401) ;
  suppression du profil qui met l'auteur à NULL ; prix inchangés (médiane, valeurs aberrantes).
- Site : `formatPriceUpdate` (avec / sans auteur, quelques instants, heures, jours) ; la mention dans
  les lignes de prix ; la saisie qui envoie `X-Fm-Session` si un jeton existe et pas sinon ; la page
  Mon profil (confidentialité, contributions, état vide).

## Scénarios à la main

1. **Connecté, public** : se connecter, saisir un prix de ressource dans la recherche ; la ligne
   affiche « par <pseudo> · il y a quelques instants ». Ouvrir la même ressource depuis un autre
   navigateur non connecté : même mention.
2. **Visiteur anonyme** : se déconnecter, saisir un autre prix : la ligne n'affiche que la durée.
3. **Profil privé** : Mon profil, passer en privé ; le premier prix n'affiche plus de nom (au plus
   60 s plus tard ailleurs). Repasser en public : le pseudo revient.
4. **Mes contributions** : le nombre et la liste des prix saisis, du plus récent au plus ancien ;
   état vide pour un compte neuf.
5. **Suppression** : supprimer le profil ; les prix restent affichés, sans nom ; se reconnecter avec
   le même compte ne les rattache pas.
6. **Mobile** : ouvrir la recherche à 375 px : la mention ne fait pas déborder la ligne.

## Déploiement

1. `npm run worker:db:migrate-price-author` (migration `0031`, après sauvegarde de la base).
2. `npm run worker:deploy`.
3. Construire et déployer le site depuis le dossier qui contient `.env.local`.
