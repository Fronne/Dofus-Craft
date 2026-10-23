# Recherche : Nettoyage des données depuis la page d'administration

Aucun point « à clarifier » ne restait dans la spec ; ces décisions lèvent les choix techniques.

## R1 — Identifier une ligne

- **Décision** : une clé par table dans le registre : `id` pour `brisage_coefficients` (entier) et
  `community_price_contributions` (texte), `rowid` pour `external_prices` (clé primaire composite, sans `id`).
- **Raison** : `external_prices` n'a pas d'identifiant propre ; `rowid` SQLite est stable tant que la table
  n'est pas compactée, et la liste est relue avant chaque suppression.
- **Écarté** : suppression par clé composite (source, ressource, serveur) — plus lourde à transmettre et à valider.

## R2 — Colonne de date par table

- **Décision** : `created_at` (prix de la communauté), `noted_at` (coefficients), `fetched_at` (prix externes).
- **Raison** : c'est la date d'entrée de la ligne dans la base, donc ce que « récent » veut dire pour un lot
  à annuler. `observed_at` des prix externes vient de la source, pas de notre import.
- Les trois colonnes ont déjà un index ou sont lues sur de petites tables ; la liste `ORDER BY date DESC LIMIT 50`
  ne lit que les lignes renvoyées quand l'index existe (`idx_..._created_at`, `idx_brisage_coefficients_noted_at`).

## R3 — Limite de 100 paramètres liés de D1

- **Décision** : la suppression par sélection se fait par paquets de 90 identifiants dans un seul `db.batch`
  (atomique) ; la suppression par durée utilise `DELETE … WHERE clé IN (SELECT clé … LIMIT 500)`.
- **Raison** : 500 identifiants ne tiennent pas dans une requête. Le `LIMIT 500` du sous-select est un
  garde-fou même si des lignes arrivent entre l'aperçu et la suppression.

## R4 — Sécuriser la suppression par durée

- **Décision** : l'aperçu est un `COUNT(*)` (GET). La suppression renvoie le nombre attendu (`expectedCount`) ;
  si le nombre réel a changé, la requête est refusée (409) et rien n'est supprimé. Plus de 500 : refus (422).
- **Raison** : la confirmation de l'administrateur porte sur un nombre précis ; on ne supprime pas autre chose.

## R5 — Trace

- **Décision** : table `admin_cleanup_log` (id, date, table, mode, filtre texte, nombre) ; une ligne écrite
  après chaque suppression réussie ; lecture des 20 dernières. La spec supposait qu'aucun journal n'existait :
  `activity.ts` est un graphique, pas un journal.
- **Raison** : besoin de relire ce qui a été supprimé. Écriture après la suppression (nombre réel connu) ; un
  échec d'écriture de la trace ne annule pas la suppression et est signalé dans la réponse (`logged: false`).
- **Écarté** : écrire la trace dans le même `batch` — le nombre réel d'une suppression par durée n'est connu
  qu'après coup. Purge de la trace : hors périmètre (quelques lignes par semaine).

## R6 — Exposition de `device_id`

- **Décision** : le registre liste les colonnes renvoyées une à une ; `device_id` n'y figure jamais. Aucune
  requête `SELECT *`.

## R7 — Effet sur le site public

- **Décision** : rien à invalider. Les lectures publiques recalculent à chaque requête et sont mises en cache
  60 s (`worker/src/read-cache.ts`, `max-age=60`) : la donnée retirée disparaît donc au plus tard après une minute.
- **Conséquence** : FR-012 s'entend « dans la minute » ; à dire dans le quickstart.

## R8 — Tables et filtres

| Table | Clé | Date | Colonnes affichées | Filtres |
|-------|-----|------|--------------------|---------|
| `brisage_coefficients` | `id` | `noted_at` | serveur, objet, coefficient, date | serveur |
| `community_price_contributions` | `id` | `created_at` | serveur, ressource, montant, origine, type d'objet, date | serveur, origine |
| `external_prices` | `rowid` | `fetched_at` | source, serveur, ressource, prix unitaire, date | serveur |

Valeurs de filtre (serveur, origine) validées contre une expression simple (`[a-z0-9_-]{1,40}`) puis liées en
paramètres ; l'origine doit être l'une des quatre connues.

## R9 — Interface

- **Décision** : nouvelle section `donnees` (carte « Nettoyage des données » du tableau de bord), même schéma
  que `SnifferKeysEditor` : état local, `adminApi`, `failureMessage`. Confirmation par une zone en ligne
  (« Supprimer N lignes ? Confirmer / Annuler »), pas de `window.confirm` (non testable, non stylable).
