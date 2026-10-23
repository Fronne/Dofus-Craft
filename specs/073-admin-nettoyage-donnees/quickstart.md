# Guide de validation : Nettoyage des données

Contrats : [admin-data-api.md](contracts/admin-data-api.md). Modèle : [data-model.md](data-model.md).

## Prérequis

- Dépendances installées (`npm install`).
- Pour l'essai réel : la migration `worker/migrations/0026_add_admin_cleanup_log.sql` appliquée **avant**
  de déployer le Worker d'administration (`npm run worker:db:migrate-cleanup-log`), une seule fois.

## Validation automatique

```bash
npm run test -- admin-data-cleanup worker-schema
npm run typecheck
npm run lint
```

Attendu : liste ordonnée, filtres, suppression par sélection, par durée, plafond 500, `expectedCount`,
table inconnue refusée, accès non propriétaire refusé, `device_id` absent, trace écrite.

## Validation manuelle (admin en local)

1. Ouvrir la page d'administration, carte « Nettoyage des données ».
2. Choisir « Coefficients de brisage » : les 50 plus récents s'affichent, du plus récent au plus ancien.
3. Cocher deux lignes, « Supprimer la sélection » : la zone annonce « 2 lignes », Annuler ne supprime rien,
   Confirmer les retire et la liste se met à jour.
4. Choisir « Prix de la communauté », filtrer origine « sniffer », durée « 1 heure » : l'aperçu donne un nombre ;
   Confirmer supprime exactement ce nombre.
5. Une durée dépassant 500 lignes : message demandant d'affiner, rien supprimé.
6. La trace en bas de l'onglet liste les suppressions faites (heure, table, nombre, mode, filtre).
7. Sur le site public, le coefficient ou le prix retiré disparaît dans la minute (cache de lecture de 60 s).
