# Recherche : bulle « donjons sans drop »

## 1. Portrait du Féca

- **Décision** : portrait `Head_10` (Féca homme) extrait du paquet
  `Content/Picto/UI/class_assets_.bundle` du client Dofus 3 installé (UnityPy, version Unity de
  repli `6000.3.16f1`), 101 × 108 px, copié en PNG dans `public/dungeon-counter/feca.png`.
- **Justification** : c'est le portrait officiel utilisé par le jeu pour la classe. DofusDB confirme
  la correspondance (`/breeds/1` : Féca, têtes `Head_10` homme et `Head_11` femme). Le fichier
  local évite toute dépendance réseau pour un élément affiché sur toutes les pages.
- Confirmé par le joueur : Le-Lanceurdeglyphe est un Féca homme, donc `Head_10`.
- **Alternatives** : `Head_11` (Féca femme) ; `LevelUp1` (grande illustration 1980 × 1024, trop détaillée pour un rond de 56 px) ;
  `symbol_1` (emblème de classe, moins parlant qu'un visage).

## 2. Nom et icône de la ressource

- **Décision** : « Parangon de puissance », DofusDB id 21189, icône
  `https://api.dofusdb.fr/img/items/50733.png` copiée dans `public/dungeon-counter/parangon.png`.
  Le nom est affiché tel quel dans la bulle.
- **Justification** : source officielle et traçable (principe I). Copie locale pour la même raison
  que le portrait.

## 3. Stockage du compteur (révisé)

- **Décision** : une constante `DUNGEONS_WITHOUT_DROP` dans
  `src/features/dungeon-counter/dungeon-counter.ts`. Pas de base, pas de route du Worker, pas de
  code secret.
- **Justification** : choix du propriétaire ; le chiffre change rarement, un redéploiement suffit.
  Rien n'est stocké ni envoyé (principe V).
- **Écarté** : la première version (table D1, routes `GET`/`POST /dungeon-counter`, code du
  propriétaire vérifié par le Worker) a été implémentée puis retirée à la demande du propriétaire.

## 6. Placement

- **Décision** : bouton rond fixe en bas à droite (16 px des bords) sur ordinateur ; sur ≤ 960 px,
  remonté de 86 px pour rester au-dessus de la barre d'onglets, flottante (« Nouveau ») ou non
  (« Classique »). `z-index` inférieur à celui de la barre d'onglets ; la visite guidée et les
  dialogues sont dans la couche supérieure du navigateur, donc toujours au-dessus (FR-012).
- La bulle ouverte est un panneau non modal ancré au-dessus du bouton, fermé par Échap, clic
  extérieur ou bouton de fermeture.
