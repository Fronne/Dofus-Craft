# Validation : Brisage sans coefficient connu

Prérequis : `npm install` ; prix de runes notés (ou jeu de test).

```bash
npm run test -- brisage
npm run dev
```

1. Page Brisage, choisir un objet jamais brisé (aucun coefficient mémorisé) : le tableau s'affiche, une ligne porte « Meilleur focus », la colonne « Sans focus » est étiquetée « à 100 % (référence) », le bloc « Conseil » donne un seuil en %.
2. Saisir un coefficient juste sous le seuil : le verdict recommande le focus sur la ligne indiquée ; juste au-dessus : « Rentable sans focus » (ou pas rentable).
3. Effacer le coefficient : retour à l'affichage sans coefficient.
4. Retirer un prix de rune : message « Prix manquant pour… », aucun conseil.
