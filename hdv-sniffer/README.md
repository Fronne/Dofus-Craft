# HDV Sniffer — lecteur de prix HDV Dofus 3

Outil **autonome** (à côté de l'app Dofus Craft) qui lit les prix de l'hôtel des ventes de
Dofus 3 en **lecture passive** du réseau. Il n'envoie **rien** au serveur : il ne fait que lire
une copie des paquets qui transitent déjà quand tu joues.

> ⚠️ Lire les données du jeu avec un outil tiers sort du cadre des conditions d'Ankama, même en
> lecture passive. À utiliser en connaissance de cause, pour un usage perso.

## Comment ça marche

Le trafic de jeu de Dofus 3 passe **en clair** sur **TCP 5555** (du protobuf encapsulé dans
`google.protobuf.Any`). Le message `jzs` porte l'échelle de prix d'un objet
(x1 / x10 / x100 / x1000), envoyée quand on consulte l'objet à l'HDV.

L'outil repère ce message par sa **forme** (un GID d'objet suivi de 2 à 4 prix croissants) et
**pas** par sa clé 3 lettres, car cette clé change à chaque mise à jour du client. Voir
[`PROTOCOLE.md`](PROTOCOLE.md) pour le détail du reverse engineering.

## Prérequis

- **Python 3** (déjà installé, ou depuis python.org).
- Mode live uniquement : **scapy** (`pip install scapy`) + **Npcap** (installé avec Wireshark)
  + lancer en **administrateur**.

## Utilisation

### Mode hors-ligne (le plus simple, sans droits admin)

Tu enregistres une capture avec Wireshark (filtre `tcp port 5555`) en consultant des objets à
l'HDV, puis :

```bash
python hdv_sniffer.py ma-capture.pcapng
```

### Mode live (écoute en direct)

```bash
pip install scapy          # une fois
python hdv_sniffer.py --live                 # toutes interfaces
python hdv_sniffer.py --live --iface "Wi-Fi" # interface précise
```

Lance-le (en admin), ouvre l'HDV en jeu et consulte des objets : les prix s'affichent au fur et
à mesure.

## Sortie

- Affichage console lisible.
- Fichier **`hdv-prices.jsonl`** (une ligne JSON par relevé) — non committé.

Exemple de ligne :

```json
{"ts": 1791746426, "gid": 304, "category": 56, "prices": {"x1": 1196, "x10": 13796, "x100": 169984, "x1000": 1699999}, "source": "live:jzs"}
```

## Noms d'objets (optionnel)

Par défaut l'outil affiche le GID. Pour afficher les noms, copie `names.example.json` en
`names.json` et complète-le (`{"304": "Cuir de Scélérat Strubien", ...}`). Les GID sont les
identifiants d'objets Ankama (les mêmes que DofusDB).

## Limites connues

- Les prix n'arrivent que pour les objets **effectivement consultés** en jeu (message `jzs`).
  Le jeu n'envoie pas tous les prix d'une catégorie d'un seul coup.
- Les clés/numéros de champ du protocole **changent à chaque patch** ; la détection par forme
  limite la casse, mais une grosse refonte du protocole peut demander une nouvelle analyse.
