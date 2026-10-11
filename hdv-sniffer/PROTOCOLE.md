# Protocole HDV Dofus 3 — prix des objets (reverse engineering)

Analyse d'une capture réseau passive (Wireshark, `tcp port 5555`), build Dofus 3 d'octobre 2026.
Trafic **non chiffré** (clair), protobuf encapsulé dans `google.protobuf.Any`
(`type.ankama.com/<clé 3 lettres>`).

## Transport
- TCP, port serveur de jeu **5555** (les connexions 443 sont le CDN/auth, chiffrées, à ignorer).
- Chaque message : trame préfixée par sa longueur → `Frame` → `Any{ type_url, value }`.

## Message des prix : clé `jzs`
Envoyé par le serveur quand on consulte le prix d'un objet à l'HDV.

```
jzs
└─ #1 (sous-message)
   ├─ #1  varint  = GID de l'objet (id Ankama / DofusDB)
   ├─ #2  bytes   = 4 varints concaténés = [prix_x1, prix_x10, prix_x100, prix_x1000]
   ├─ #3  varint  = id interne
   └─ #4  varint  = catégorie HDV (104 = ressources, 56 = autre onglet…)
```

Déclencheur côté client : message **`kcy`** avec `#1 = GID` (`#2 = 1` optionnel).

### Vérifié sur relevés manuels
| GID  | Objet                       | x1   | x10   | x100   | x1000   |
|------|-----------------------------|------|-------|--------|---------|
| 304  | Cuir de Scélérat Strubien   | 1196 | 13796 | 169984 | 1699999 |
| 8161 | Ailes du Scarabosse Doré    | 529  | 5500  | 58990  | 589900  |
| 1455 | (3e objet)                  | 339  | 782   | 7600   | 75600   |

Décodage brut == chiffres lus en jeu → mapping confirmé.

## Marché complet : clé `irl`
Gros message (18–38 Ko, ~1260 entrées) = toutes les ventes en cours de la catégorie ouverte.
Chaque entrée : `#1{ #3=GID, #4=UID de vente, #5=…, #7=offres{quantité, prix} }`.
Plus lourd à exploiter que `jzs` ; utile seulement pour tout relever d'un coup.

## Fragilité (important)
Les clés 3 lettres (`jzs`, `kcy`, `irl`…) ET les numéros de champ **changent à chaque
mise à jour du client**. Un lecteur robuste doit **ré-identifier** le message des prix par sa
**forme** (sous-message avec un GID puis un champ de 4 varints croissants ≈ x1/x10/x100/x1000),
et non par la clé codée en dur.

## Méthode (reproductible après un patch)
1. Capturer `tcp port 5555` en consultant 2–3 objets, noter leurs prix.
2. Chercher les prix (en varint) dans le flux serveur → ils tombent en 4 varints collés.
3. Remonter au message `Any` qui les contient → clé + chemin du champ.
