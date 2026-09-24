# Contrat UI : page d'administration

- Adresse propre : `https://dofus-craft-admin.<sous-domaine>.workers.dev` ; aucun lien depuis le site.
- En-tête « Administration », adresse connectée (`/api/me`), sections (seule « Compteurs » livrée,
  FR-015).
- Section « Compteurs » : une carte par compteur (portrait, pseudo, classe, objet visé), champ
  « Chiffre » (entier ≥ 0), case « Au moins (affiche un +) », bouton « Enregistrer », bouton
  « Supprimer » → confirmation « Supprimer le compteur de <pseudo> (<libellé>) ? ».
- Formulaire « Nouveau compteur » : pseudo ; classe (liste) et sexe (Homme/Femme) avec aperçu du
  portrait ; libellés singulier et pluriel ; recherche d'objet (propositions avec icône, choix
  obligatoire) ; chiffre de départ ; « Au moins » ; bouton « Ajouter ».
- Messages : « Enregistré. », « Compteur ajouté. », « Compteur supprimé. », erreurs de validation
  nommant le champ, « Enregistrement impossible pour le moment. » (valeurs conservées).
- Mise en page utilisable en 375 px.
