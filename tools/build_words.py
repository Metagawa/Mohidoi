#!/usr/bin/env python3
"""Build data/words.js from the Commons list + JMdict (jmdict-simplified eng JSON).
Usage: build_words.py <list.json> <jmdict.json> <repo>
"""
import json, sys, os, re, hashlib, unicodedata
from collections import defaultdict

listfile, jmfile, repo = sys.argv[1:4]
PREFIX = "LL-Q5287_(jpn)-Fukujinzuke-"
items = json.load(open(listfile))
jm = json.load(open(jmfile))["words"]

KANA_RE = re.compile(r"^[ぁ-ゟ゠-ヿー・]+$")
HIRA_RE = re.compile(r"^[ぁ-ゟー]+$")


def kata2hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


# ---- indexes -------------------------------------------------------------
by_kanji = defaultdict(list)
by_kana = defaultdict(list)
for e in jm:
    for k in e["kanji"]:
        by_kanji[k["text"]].append(e)
    for k in e["kana"]:
        by_kana[k["text"]].append(e)


def entry_common(e):
    return any(k["common"] for k in e["kanji"]) or any(k["common"] for k in e["kana"])


def first_sense(e, kanji=None, kana=None):
    for s in e["sense"]:
        if kanji and "*" not in s["appliesToKanji"] and kanji not in s["appliesToKanji"]:
            continue
        if kana and "*" not in s["appliesToKana"] and kana not in s["appliesToKana"]:
            continue
        return s
    return e["sense"][0]


def glosses(sense, n=3):
    out = []
    for g in sense["gloss"]:
        t = g["text"]
        if t not in out:
            out.append(t)
        if len(out) >= n:
            break
    return out


def reading_for(e, kanji, hint=None):
    reads = [k for k in e["kana"] if "*" in k["appliesToKanji"] or kanji in k["appliesToKanji"]]
    reads = [k for k in reads if not set(k["tags"]) & {"sk", "ik", "ok", "rk"}] or reads
    if hint:
        for k in reads:
            if kata2hira(k["text"]) == kata2hira(hint):
                return k["text"]
    reads.sort(key=lambda k: not k["common"])
    return reads[0]["text"] if reads else None


def kanji_rank(e, form):
    k = next((k for k in e["kanji"] if k["text"] == form), None)
    tags = set(k["tags"]) if k else set()
    return (0 if k and k["common"] else 1, 1 if tags & {"sK", "rK", "iK", "oK"} else 0, int(e["id"]))


def is_uk(e):
    return "uk" in e["sense"][0]["misc"] or not e["kanji"]


POS_SIMPLE = [
    (lambda p: p.startswith("v5") or p in ("v1", "v1-s", "vk", "vs-i", "vs-s", "vz") or p.startswith("v4"), "verb"),
    (lambda p: p in ("adj-i", "adj-ix"), "i-adjective"),
    (lambda p: p == "adj-na", "na-adjective"),
    (lambda p: p == "adv" or p == "adv-to", "adverb"),
    (lambda p: p == "int", "interjection"),
    (lambda p: p == "exp", "expression"),
    (lambda p: p == "pn", "pronoun"),
    (lambda p: p == "num", "number"),
    (lambda p: p == "ctr", "counter"),
    (lambda p: p == "prt", "particle"),
    (lambda p: p == "conj", "conjunction"),
    (lambda p: p == "adj-pn", "pre-noun adjectival"),
    (lambda p: p == "adj-no", "no-adjective"),
    (lambda p: p.startswith("n"), "noun"),
    (lambda p: p == "pref", "prefix"),
    (lambda p: p == "suf", "suffix"),
]


def simple_pos(posl):
    out = []
    for p in posl:
        for f, name in POS_SIMPLE:
            if f(p):
                if name not in out:
                    out.append(name)
                break
    return out


# ---- matching -------------------------------------------------------------
RECORDED = {unicodedata.normalize("NFC", re.sub(r"[（(].*$", "", it["name"][len(PREFIX):-4])) for it in items}
BADK = {"sK", "rK", "iK", "oK"}


def kana_common(e, word):
    return next((k["common"] for k in e["kana"] if k["text"] == word), False)


def match(word, hint, need_pos=None):
    """Return (entry, kanji_form_or_None, reading, alts) or None."""
    if KANA_RE.match(word):
        cands = by_kana.get(word, [])
        if need_pos:
            cands = [e for e in cands if need_pos in e["sense"][0]["partOfSpeech"]]
        if not cands:
            return None

        def rank(e):
            # the speaker often recorded a word both in kanji and in kana: prefer that pairing
            paired = any(k["text"] in RECORDED for k in e["kanji"])
            return (0 if kana_common(e, word) else 1, 0 if paired else 1, 0 if is_uk(e) else 1,
                    0 if entry_common(e) else 1, int(e["id"]))
        cands = sorted(cands, key=rank)
        best = cands[0]
        paired_k = [k["text"] for k in best["kanji"] if k["text"] in RECORDED]
        alts = []
        if not paired_k and not is_uk(best):
            # kana recording of a word normally written in kanji: list other common homophones
            for e in cands[1:]:
                if kana_common(e, word) and not is_uk(e) and len(alts) < 4:
                    alts.append(e)
        kform = None
        if paired_k:
            kform = paired_k[0]
        elif best["kanji"] and not is_uk(best):
            ks = sorted(best["kanji"], key=lambda k: (not k["common"], bool(set(k["tags"]) & BADK)))
            kform = ks[0]["text"]
        return best, kform, word, alts
    cands = by_kanji.get(word, [])
    if need_pos:
        cands = [e for e in cands if need_pos in e["sense"][0]["partOfSpeech"]]
    if not cands:
        return None
    if hint:
        h = [e for e in cands if any(kata2hira(k["text"]) == kata2hira(hint) for k in e["kana"])]
        cands = h or cands
    cands = sorted(cands, key=lambda e: kanji_rank(e, word))
    best = cands[0]
    return best, word, reading_for(best, word, hint), []


# ---- segmentation (only used to give phrases like 電車に乗ります a reading + per-part glosses)
seg = {}    # surface -> (reading, gloss, base, is_content, prio)
stems = {}  # masu-stem surface -> same tuple
PARTICLES = ["を", "に", "が", "は", "で", "へ", "と", "も", "の"]
AUX = ["ましょう", "ました", "ます", "します", "する"]
GODAN_I = {"う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち", "ぬ": "に", "ぶ": "び", "む": "み", "る": "り"}
# kana-written verbs whose sense is ambiguous in a kana-only lookup: pick the JMdict entry by its kanji spelling
STEM_PICK = {"おろし": "下ろす", "あり": "有る", "かけ": "掛ける", "はき": "履く", "あび": "浴びる", "かぶり": "被る", "降り": "降りる"}


def put(d, surface, val):
    cur = d.get(surface)
    if cur is None or val[4] > cur[4]:
        d[surface] = val


for e in jm:
    if not entry_common(e):
        continue
    s = e["sense"][0]
    g = s["gloss"][0]["text"]
    lexical = 0.5 if any(p.startswith("n") and p not in ("n-suf", "n-pref") or p.startswith("v") for p in s["partOfSpeech"]) else 0
    for k in e["kanji"]:
        if set(k["tags"]) & BADK:
            continue
        r = reading_for(e, k["text"])
        if r:
            put(seg, k["text"], (r, g, k["text"], True, (2 if k["common"] else 1) + lexical))
    kana_forms = [k for k in e["kana"] if not set(k["tags"]) & {"sk", "ik", "ok", "rk"}]
    for k in kana_forms:
        if len(k["text"]) >= 2:
            put(seg, k["text"], (k["text"], g, k["text"], True, (1 if k["common"] else 0) + lexical))
    forms = [(k["text"], reading_for(e, k["text"])) for k in e["kanji"] if k["common"]] + \
            [(k["text"], k["text"]) for k in kana_forms if k["common"]]
    for p in s["partOfSpeech"]:
        for f, r in forms:
            if not r:
                continue
            pick = 1 + lexical
            if p.startswith("v5") and f[-1] in GODAN_I and r[-1] in GODAN_I:
                stem = f[:-1] + GODAN_I[f[-1]]
                if STEM_PICK.get(stem) and STEM_PICK[stem] in [k["text"] for k in e["kanji"]]:
                    pick = 99
                put(stems, stem, (r[:-1] + GODAN_I[r[-1]], g, f, True, pick))
            elif p in ("v1", "v1-s") and f.endswith("る"):
                stem = f[:-1]
                if STEM_PICK.get(stem) and STEM_PICK[stem] in [k["text"] for k in e["kanji"]]:
                    pick = 99
                put(stems, stem, (r[:-1], g, f, True, pick))
for p in PARTICLES:
    seg[p] = (p, None, p, False, 99)
for a in AUX:
    seg[a] = (a, None, a, False, 99)


def segment(word):
    i, parts = 0, []
    while i < len(word):
        hit = None
        for j in range(len(word), i, -1):  # a verb stem directly followed by ます/ましょう wins
            if word[j:].startswith("ま") and word[i:j] in stems:
                hit = (j, stems[word[i:j]])
                break
        if not hit:
            for j in range(len(word), i, -1):
                if word[i:j] in seg:
                    hit = (j, seg[word[i:j]])
                    break
        if hit:
            j, v = hit
            parts.append((word[i:j],) + v[:4])
            i = j
            continue
        c = word[i]
        if KANA_RE.match(c):
            parts.append((c, c, None, c, False))
            i += 1
        else:
            return None
    return parts


# ---- categories ----------------------------------------------------------
# rebuild multi-word names properly
COUNTRY_NAMES = [c.strip() for c in ("""Afghanistan|Albania|Algeria|Andorra|Angola|Antigua and Barbuda|Argentina|Armenia|Australia|Austria|Azerbaijan|Bahamas|Bahrain|Bangladesh|Barbados|Belarus|Belgium|Belize|Benin|Bhutan|Bolivia|Bosnia and Herzegovina|Botswana|Brazil|Brunei|Bulgaria|Burkina Faso|Burundi|Cabo Verde|Cape Verde|Cambodia|Cameroon|Canada|Central African Republic|Chad|Chile|China|Colombia|Comoros|Congo|Costa Rica|Croatia|Cuba|Cyprus|Czech Republic|Czechia|Denmark|Djibouti|Dominica|Dominican Republic|East Timor|Timor-Leste|Ecuador|Egypt|El Salvador|Equatorial Guinea|Eritrea|Estonia|Eswatini|Ethiopia|Fiji|Finland|France|Gabon|Gambia|The Gambia|Georgia|Germany|Ghana|Greece|Grenada|Guatemala|Guinea|Guinea-Bissau|Guyana|Haiti|Honduras|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Ivory Coast|Jamaica|Japan|Jordan|Kazakhstan|Kenya|Kiribati|Kuwait|Kyrgyzstan|Kyrgyz Republic|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Liechtenstein|Lithuania|Luxembourg|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Marshall Islands|Mauritania|Mauritius|Mexico|Micronesia|Moldova|Monaco|Mongolia|Montenegro|Morocco|Mozambique|Myanmar|Burma|Namibia|Nauru|Nepal|Netherlands|Holland|New Zealand|Nicaragua|Niger|Nigeria|North Korea|North Macedonia|Norway|Oman|Pakistan|Palau|Panama|Papua New Guinea|Paraguay|Peru|Philippines|Poland|Portugal|Qatar|Romania|Russia|Rwanda|Saint Kitts and Nevis|Saint Lucia|Samoa|San Marino|Saudi Arabia|Senegal|Serbia|Seychelles|Sierra Leone|Singapore|Slovakia|Slovenia|Solomon Islands|Somalia|South Africa|South Korea|Korea|South Sudan|Spain|Sri Lanka|Sudan|Suriname|Sweden|Switzerland|Syria|Taiwan|Tajikistan|Tanzania|Thailand|Togo|Tonga|Trinidad and Tobago|Tunisia|Turkey|Türkiye|Turkmenistan|Tuvalu|Uganda|Ukraine|United Arab Emirates|UAE|United Kingdom|UK|Britain|Great Britain|United States|USA|America|United States of America|Uruguay|Uzbekistan|Vanuatu|Venezuela|Vietnam|Viet Nam|Yemen|Zambia|Zimbabwe|Europe|Republic of China|People's Republic of China|Hellenic Republic|Greece|Kingdom of the Netherlands""".split("|"))]
COUNTRY_SET = {c.lower() for c in COUNTRY_NAMES}
ELEMENT_RE = re.compile(r"\(([A-Z][a-z]?)\)$")
NUM_KANJI = set("零一二三四五六七八九十百千万億兆")


def strip_paren(g):
    return re.sub(r"\s*\([^)]*\)", "", g).strip()


def categorise(w):
    word, pos, gl = w["w"], w.get("pos", []), w.get("m", [])
    g0 = gl[0] if gl else ""
    if len(word) == 1 and KANA_RE.match(word):
        return "kana"
    if gl and any(ELEMENT_RE.search(g) for g in gl[:1]):
        return "elements"
    if word.endswith("語") and len(word) > 2 and any("language" in g.lower() for g in gl):
        return "places"
    if word == "エスペラント":
        return "places"
    if any(strip_paren(g).lower() in COUNTRY_SET for g in gl[:2]) or any(strip_paren(g).lower().replace("the ", "") in COUNTRY_SET for g in gl[:1]):
        return "places"
    if w.get("phrase"):
        return "phrases"
    if "expression" in pos and g0[:1].isupper() and g0 not in ("I",):
        return "places"
    if "expression" in pos and "noun" in pos:
        return "nouns"
    if "interjection" in pos or "expression" in pos:
        return "phrases"
    if word.endswith("ます") or word.endswith("ましょう"):
        return "phrases"
    if pos and pos[0] == "verb" or (word.endswith("する") and len(word) > 2):
        return "verbs"
    if pos and pos[0] in ("i-adjective", "na-adjective") or ("i-adjective" in pos):
        return "adjectives"
    if ("number" in pos or (word and all(c in NUM_KANJI for c in word)) or re.match(r"^[一二三四五六七八九十]+(月|時|つ|人)$", word)
            or word.endswith("曜日") or re.match(r"^(today|yesterday|tomorrow|day after tomorrow|day before yesterday|this year|afternoon|p\.m\.)$", g0)):
        return "numbers"
    if pos and pos[0] == "noun":
        return "nouns"
    if "noun" in pos:
        return "nouns"
    return "other"


# ---- build ---------------------------------------------------------------
out = []
stats = defaultdict(int)
for it in sorted(items, key=lambda x: x["name"]):
    name = it["name"]
    raw = name[len(PREFIX):-4]
    word = unicodedata.normalize("NFC", raw)
    sid = hashlib.sha1(name.encode()).hexdigest()[:10]
    hint = None
    m = re.match(r"^(.*?)[（(]([ぁ-ゟー]+)[）)]$", word)
    base = word
    if m:
        base, hint = m.group(1), m.group(2)
    rec = {"id": sid, "w": word}
    if base != word:
        rec["w"] = base
        rec["hint"] = hint
    if len(base) == 1 and KANA_RE.match(base):
        rec["r"] = base
        rec["cat"] = "kana"
        stats["kana"] += 1
        out.append(rec)
        continue
    res = match(base, hint)
    if res is None and base.endswith("する") and len(base) > 2:
        res2 = match(base[:-2], None)
        if res2:
            e, k, r, alts = res2
            s = first_sense(e, k, r)
            rec.update(r=(r + "する") if r else None, m=glosses(s), pos=["suru verb"], via="する")
            if k and k + "する" != base:
                rec["k"] = k + "する"
            if any(kk["common"] for kk in e["kanji"] + e["kana"]):
                rec["c"] = 1
            rec["src"] = int(e["id"])
            stats["matched_suru"] += 1
            res = "done"
    if res is None and base.endswith("な") and len(base) > 1:
        res2 = match(base[:-1], hint, need_pos="adj-na")
        if res2:
            e, k, r, alts = res2
            s = first_sense(e, k, r)
            rec.update(r=r + "な", m=glosses(s), pos=["na-adjective"], via="な")
            if entry_common(e):
                rec["c"] = 1
            stats["matched_na"] += 1
            res = "done"
    if res is None:
        parts = segment(base)
        is_phrase = bool(parts) and len(parts) > 1 and any(p[0] in AUX or p[0] in PARTICLES for p in parts)
        if parts:
            if hint:
                rec["r"] = hint
            elif is_phrase:
                rec["r"] = "".join(p[1] for p in parts)
                rec["rg"] = 1  # reading assembled from dictionary parts
            content = [{"w": p[3], "g": p[2]} for p in parts if p[4] and p[2]]
            if content:
                rec["parts"] = content
            if is_phrase:
                rec["phrase"] = 1
            stats["segmented"] += 1
        else:
            if hint:
                rec["r"] = hint
            elif KANA_RE.match(base):
                rec["r"] = base
            stats["unmatched_noreading"] += 1
        rec["nm"] = 1  # no JMdict entry for the whole word
        stats["unmatched"] += 1
    elif res != "done":
        e, k, r, alts = res
        s = first_sense(e, k if k == base else None, r)
        rec["r"] = r
        if k and k != base:
            rec["k"] = k  # usual kanji spelling for a kana recording
        rec["m"] = glosses(s)
        rec["pos"] = simple_pos(s["partOfSpeech"])
        if entry_common(e):
            rec["c"] = 1
        if alts:
            rec["alt"] = [{"k": (a["kanji"][0]["text"] if a["kanji"] else word), "g": first_sense(a)["gloss"][0]["text"]} for a in alts]
        rec["src"] = int(e["id"])
        stats["matched"] += 1
    rec["cat"] = categorise(rec)
    out.append(rec)

# overrides for greetings whose は is read わ
for r in out:
    if r.get("r") in ("こんにちは", "こんばんは"):
        r["ro"] = {"こんにちは": "konnichiwa", "こんばんは": "konbanwa"}[r["r"]]

cats = defaultdict(int)
for r in out:
    cats[r["cat"]] += 1
for r in out:
    r.pop("src", None)
os.makedirs(os.path.join(repo, "data"), exist_ok=True)
with open(os.path.join(repo, "data", "words.js"), "w") as f:
    f.write("// Generated by tools/build_words.py. Recordings: Fukujinzuke via Lingua Libre / Wikimedia Commons (CC BY 4.0).\n")
    f.write("// Readings/meanings: JMdict (c) EDRDG, CC BY-SA 4.0. Fields: id=audio/words/<id>.ogg, w=word as recorded,\n")
    f.write("// r=reading, k=usual kanji, m=glosses, pos, c=common, cat=category, nm=no JMdict match, rg=reading from parts.\n")
    f.write("window.WORDS = [\n")
    f.write(",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in out))
    f.write("\n];\n")
print(json.dumps(stats, ensure_ascii=False))
print(json.dumps(cats, ensure_ascii=False))
print("total", len(out))
