#!/usr/bin/env python3
"""Fetch the Fukujinzuke Lingua Libre list from Commons, then download + convert each WAV slowly.
Usage: fetch.py <workdir> <repo>
"""
import json, os, sys, time, hashlib, subprocess, urllib.request, urllib.parse, urllib.error

UA = "MohidoiPersonalStudy/2.0 (https://github.com/Metagawa/Mohidoi)"
PREFIX = "LL-Q5287 (jpn)-Fukujinzuke"
API = "https://commons.wikimedia.org/w/api.php"
work, repo = sys.argv[1], sys.argv[2]
listfile = os.path.join(work, "list.json")
rawdir = os.path.join(work, "raw")
outdir = os.path.join(repo, "audio", "words")
os.makedirs(rawdir, exist_ok=True)
os.makedirs(outdir, exist_ok=True)


def get(url, binary=False):
    delay = 5
    for attempt in range(8):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503, 502):
                ra = e.headers.get("Retry-After")
                wait = int(ra) if ra and ra.isdigit() else delay
                print(f"HTTP {e.code}, backing off {wait}s", flush=True)
                time.sleep(wait)
                delay = min(delay * 2, 300)
                continue
            raise
        except urllib.error.URLError as e:
            print(f"URLError {e}, retry in {delay}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 300)
    raise RuntimeError("too many retries: " + url)


if not os.path.exists(listfile):
    items, cont = [], {}
    while True:
        params = {"action": "query", "list": "allimages", "aiprefix": PREFIX, "ailimit": "500",
                  "aiprop": "url|size", "format": "json", "formatversion": "2"}
        params.update(cont)
        data = json.loads(get(API + "?" + urllib.parse.urlencode(params)))
        items += data["query"]["allimages"]
        print("listed", len(items), flush=True)
        if "continue" not in data:
            break
        cont = data["continue"]
        time.sleep(2)
    json.dump(items, open(listfile, "w"), ensure_ascii=False, indent=0)

items = json.load(open(listfile))
print("total", len(items), flush=True)
for i, it in enumerate(items):
    name = it["name"]  # underscores form
    sid = hashlib.sha1(name.encode()).hexdigest()[:10]
    ogg = os.path.join(outdir, sid + ".ogg")
    if os.path.exists(ogg) and os.path.getsize(ogg) > 0:
        continue
    raw = os.path.join(rawdir, sid + ".wav")
    if not os.path.exists(raw):
        data = get(it["url"], True)
        with open(raw + ".part", "wb") as f:
            f.write(data)
        os.replace(raw + ".part", raw)
        time.sleep(1.6)
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", raw,
                    "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse",
                    "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "28k", "-application", "voip",
                    "-map_metadata", "-1", ogg], check=True)
    if i % 50 == 0:
        print(i, name, flush=True)
print("done", flush=True)
