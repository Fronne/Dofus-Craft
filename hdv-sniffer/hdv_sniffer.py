#!/usr/bin/env python3
"""
Sniffer de prix HDV pour Dofus 3 (lecture passive, trafic en clair sur TCP 5555).

Deux modes :
  - Hors-ligne :  python hdv_sniffer.py capture.pcapng
                  (décode un fichier .pcap/.pcapng enregistré avec Wireshark ; aucun droit admin)
  - Live :        python hdv_sniffer.py --live [--iface "Wi-Fi"]
                  (écoute le réseau en direct ; nécessite scapy + Npcap + droits administrateur)

Il n'envoie RIEN au serveur : il ne fait que lire une copie des paquets qui passent déjà.

Le message des prix est repéré par sa FORME (un GID d'objet suivi de 2 à 4 prix croissants
= x1 / x10 / x100 / x1000), et non par sa clé 3 lettres, qui change à chaque patch Ankama.

Sortie : affichage console + ajout dans hdv-prices.jsonl (une ligne JSON par relevé).
Un fichier names.json optionnel ({"304": "Cuir de Scélérat Strubien", ...}) donne les noms.
"""
import sys, os, struct, json, time, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JSONL = os.path.join(HERE, "hdv-prices.jsonl")
NAMES_PATH = os.path.join(HERE, "names.json")

# ----------------------------------------------------------------------------
# Décodage protobuf minimal
# ----------------------------------------------------------------------------
def read_varint(b, i):
    shift = 0; val = 0
    while i < len(b):
        x = b[i]; i += 1
        val |= (x & 0x7F) << shift
        if not (x & 0x80):
            return val, i
        shift += 7
    return None, i

def decode_fields(b):
    out = []; i = 0
    while i < len(b):
        tag, i = read_varint(b, i)
        if tag is None: break
        field = tag >> 3; wt = tag & 7
        if wt == 0:
            v, i = read_varint(b, i)
            if v is None: break
            out.append((field, 0, v))
        elif wt == 2:
            ln, i = read_varint(b, i)
            if ln is None or i + ln > len(b): break
            out.append((field, 2, b[i:i+ln])); i += ln
        elif wt == 5:
            if i + 4 > len(b): break
            out.append((field, 5, struct.unpack_from("<I", b, i)[0])); i += 4
        elif wt == 1:
            if i + 8 > len(b): break
            out.append((field, 1, struct.unpack_from("<Q", b, i)[0])); i += 8
        else:
            break
    return out

def field_val(fields, num, wt):
    return next((v for f, w, v in fields if f == num and w == wt), None)

def split_varints(b):
    vals = []; i = 0
    while i < len(b):
        v, i = read_varint(b, i)
        if v is None: return None
        vals.append(v)
    return vals

# ----------------------------------------------------------------------------
# Détection du message de prix HDV par sa forme
# ----------------------------------------------------------------------------
def extract_price(body):
    """Renvoie (gid, [prix...], categorie) si body est un message de prix HDV, sinon None."""
    top = decode_fields(body)
    inner = field_val(top, 1, 2)
    if inner is None:
        return None
    fin = decode_fields(inner)
    gid = field_val(fin, 1, 0)
    pbytes = field_val(fin, 2, 2)
    cat = field_val(fin, 4, 0)
    if gid is None or pbytes is None:
        return None
    # Un GID d'objet Dofus est petit ; une vraie réponse de prix porte une catégorie HDV.
    # Ces deux garde-fous éliminent les messages d'une autre nature (guilde, chat…)
    # qui prendraient la forme par hasard.
    if not (0 < gid < 2_000_000):
        return None
    if cat is None or not (0 < cat < 100_000):
        return None
    prices = split_varints(pbytes)
    if not prices or not (2 <= len(prices) <= 4):
        return None
    if any(p <= 0 for p in prices):
        return None
    if prices != sorted(prices) or len(set(prices)) != len(prices):
        return None  # doit être strictement croissant (x1 < x10 < x100 < x1000)
    return gid, prices, cat

ANY_NEEDLE = b"type.ankama.com/"

def scan_stream(buf, start=0):
    """Génère (end_offset, key, body) pour chaque Any complet trouvé à partir de `start`.
    Renvoie aussi, via l'attribut .last_incomplete, l'offset du dernier Any incomplet."""
    i = start
    n = len(buf)
    results = []
    last_incomplete = n
    while True:
        j = buf.find(ANY_NEEDLE, i)
        if j < 0:
            break
        k = j + len(ANY_NEEDLE)
        while k < n and 33 <= buf[k] < 127 and buf[k] not in (0x0A, 0x12):
            k += 1
        key = buf[j+len(ANY_NEEDLE):k].decode("latin1")
        if k >= n:  # clé incomplète, attendre plus de données
            last_incomplete = j; break
        body = b""; end = k
        if buf[k] == 0x12:
            ln, p = read_varint(buf, k + 1)
            if ln is None:
                last_incomplete = j; break
            if p + ln > n:  # corps pas encore entièrement reçu
                last_incomplete = j; break
            body = buf[p:p+ln]; end = p + ln
        results.append((end, key, body))
        i = k if not body else end
    return results, last_incomplete

# ----------------------------------------------------------------------------
# Sortie
# ----------------------------------------------------------------------------
def load_names():
    try:
        with open(NAMES_PATH, encoding="utf-8") as f:
            return {int(k): v for k, v in json.load(f).items()}
    except Exception:
        return {}

NAMES = load_names()
_seen = {}  # (gid, tuple(prices)) -> last_ts, pour éviter les doublons rapprochés

def emit(gid, prices, cat, source):
    k = (gid, tuple(prices))
    now = time.time()
    if _seen.get(k, 0) > now - 3:  # même relevé < 3 s : on ignore
        return
    _seen[k] = now
    name = NAMES.get(gid, f"GID {gid}")
    lots = ["x1", "x10", "x100", "x1000"]
    ladder = "  ".join(f"{lots[i]}={p}" for i, p in enumerate(prices))
    print(f"[{time.strftime('%H:%M:%S')}] {name:<32} {ladder}  (cat {cat})")
    rec = {"ts": int(now), "gid": gid, "category": cat,
           "prices": {lots[i]: p for i, p in enumerate(prices)}, "source": source}
    try:
        with open(OUT_JSONL, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception as e:
        print("  (impossible d'écrire hdv-prices.jsonl:", e, ")", file=sys.stderr)

# ----------------------------------------------------------------------------
# Mode hors-ligne : lecture d'un .pcap/.pcapng
# ----------------------------------------------------------------------------
def parse_pcapng(path):
    data = open(path, "rb").read()
    # pcapng ?
    if data[:4] == b"\x0a\x0d\x0d\x0a":
        return parse_pcapng_blocks(data)
    # pcap classique ?
    magic = data[:4]
    if magic in (b"\xd4\xc3\xb2\xa1", b"\xa1\xb2\xc3\xd4", b"\x4d\x3c\xb2\xa1", b"\xa1\xb2\x3c\x4d"):
        return parse_pcap_classic(data)
    raise SystemExit("Format non reconnu (ni pcap ni pcapng).")

def parse_pcapng_blocks(data):
    off = 0; endian = "<"; linktype = 1; pkts = []
    while off + 8 <= len(data):
        btype = struct.unpack_from(endian + "I", data, off)[0]
        if btype == 0x0A0D0D0A:
            bom = struct.unpack_from("<I", data, off + 8)[0]
            endian = "<" if bom == 0x1A2B3C4D else ">"
        blen = struct.unpack_from(endian + "I", data, off + 4)[0]
        if blen < 12 or off + blen > len(data): break
        body = data[off + 8: off + blen - 4]
        if btype == 0x00000001:
            linktype = struct.unpack_from(endian + "H", body, 0)[0]
        elif btype == 0x00000006:
            caplen = struct.unpack_from(endian + "I", body, 12)[0]
            pkts.append(body[20:20 + caplen])
        elif btype == 0x00000003:
            pkts.append(body[4:])
        off += blen
    return linktype, pkts

def parse_pcap_classic(data):
    endian = "<" if data[:4] in (b"\xd4\xc3\xb2\xa1", b"\x4d\x3c\xb2\xa1") else ">"
    linktype = struct.unpack_from(endian + "I", data, 20)[0]
    off = 24; pkts = []
    while off + 16 <= len(data):
        caplen = struct.unpack_from(endian + "I", data, off + 8)[0]
        off += 16
        if off + caplen > len(data): break
        pkts.append(data[off:off + caplen]); off += caplen
    return linktype, pkts

def pkt_tcp_payload(pkt, linktype):
    l3 = pkt[14:] if linktype == 1 else pkt
    if linktype == 1:
        if len(pkt) < 14 or struct.unpack_from(">H", pkt, 12)[0] != 0x0800:
            return None
    if len(l3) < 20 or (l3[0] >> 4) != 4: return None
    ihl = (l3[0] & 0xF) * 4
    if l3[9] != 6: return None
    tcp = l3[ihl:]
    if len(tcp) < 20: return None
    sport, dport = struct.unpack_from(">HH", tcp, 0)
    seq = struct.unpack_from(">I", tcp, 4)[0]
    doff = (tcp[12] >> 4) * 4
    return sport, dport, seq, tcp[doff:]

def run_offline(path):
    linktype, pkts = parse_pcapng(path)
    import collections
    streams = collections.defaultdict(list)
    for pkt in pkts:
        r = pkt_tcp_payload(pkt, linktype)
        if not r: continue
        sport, dport, seq, pl = r
        if (sport == 5555 or dport == 5555) and pl:
            streams[(sport, dport)].append((seq, pl))
    count = 0
    for (sport, dport), segs in streams.items():
        if sport != 5555:  # on ne décode que serveur -> client
            continue
        segs.sort()
        buf = bytearray()
        nextseq = None
        for seq, pl in segs:
            if nextseq is None or seq >= nextseq:
                buf += pl; nextseq = seq + len(pl)
        results, _ = scan_stream(bytes(buf))
        for end, key, body in results:
            pr = extract_price(body)
            if pr:
                emit(pr[0], pr[1], pr[2], f"pcap:{key}"); count += 1
    print(f"\n{count} relevé(s) de prix extrait(s). Détail dans {OUT_JSONL}")

# ----------------------------------------------------------------------------
# Mode live : scapy + Npcap
# ----------------------------------------------------------------------------
def run_live(iface):
    try:
        from scapy.all import sniff, TCP, IP, Raw
    except ImportError:
        raise SystemExit("scapy n'est pas installé. Fais : pip install scapy  (et installe Npcap).")
    buffers = {}  # flux serveur->client -> {'data':bytearray, 'scan':int}
    def handle(pkt):
        if not pkt.haslayer(TCP) or not pkt.haslayer(Raw) or not pkt.haslayer(IP):
            return
        tcp = pkt[TCP]
        if tcp.sport != 5555:  # on ne garde que serveur -> client
            return
        key = (pkt[IP].src, tcp.sport, pkt[IP].dst, tcp.dport)
        st = buffers.setdefault(key, {"data": bytearray(), "scan": 0})
        st["data"] += bytes(tcp[Raw].load)
        results, last_incomplete = scan_stream(st["data"], st["scan"])
        for end, k, body in results:
            pr = extract_price(body)
            if pr:
                emit(pr[0], pr[1], pr[2], f"live:{k}")
        st["scan"] = last_incomplete
        # on évite que le tampon grandisse indéfiniment
        if st["scan"] > 262144:
            st["data"] = st["data"][st["scan"]:]
            st["scan"] = 0
    print("Écoute du trafic Dofus (TCP 5555). Ouvre l'HDV et consulte des objets. Ctrl+C pour arrêter.")
    sniff(filter="tcp port 5555", prn=handle, store=False, iface=iface)

# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Sniffer de prix HDV Dofus 3 (lecture passive).")
    ap.add_argument("pcap", nargs="?", help="fichier .pcap/.pcapng à décoder (mode hors-ligne)")
    ap.add_argument("--live", action="store_true", help="écoute le réseau en direct (admin + scapy/Npcap)")
    ap.add_argument("--iface", default=None, help="nom de l'interface réseau (ex: \"Wi-Fi\")")
    args = ap.parse_args()
    if args.live:
        run_live(args.iface)
    elif args.pcap:
        run_offline(args.pcap)
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
