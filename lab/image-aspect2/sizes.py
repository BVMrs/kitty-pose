# Image width/height (EXIF-orientation aware) for HaGRID test images, via HTTP Range on the class zips.
# usage: sizes.py <class> <zip-url> <annotations-test-dir> <n> > out.json
import zlib, io, sys, json, struct, random, zipfile, urllib.request as ur
from concurrent.futures import ThreadPoolExecutor
cls, url, adir, N = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
def rng(a, b):
    return ur.urlopen(ur.Request(url, headers={"Range": f"bytes={a}-{b}"}), timeout=60).read()
class R(io.RawIOBase):
    def __init__(s):
        s.pos = 0; s.bytes = 0
        s.n = int(ur.urlopen(ur.Request(url, headers={"Range": "bytes=0-0"})).headers["Content-Range"].split("/")[1])
    def seekable(s): return True
    def readable(s): return True
    def tell(s): return s.pos
    def seek(s, o, w=0): s.pos = {0: o, 1: s.pos + o, 2: s.n + o}[w]; return s.pos
    def readinto(s, b):
        if s.pos >= s.n: return 0
        d = rng(s.pos, min(s.pos + len(b), s.n) - 1); b[:len(d)] = d; s.pos += len(d); s.bytes += len(d); return len(d)
r = R(); z = zipfile.ZipFile(io.BufferedReader(r, 1 << 20))
test = json.load(open(f"{adir}/{cls}.json"))
byid = {}
for i in z.infolist():
    if i.filename.endswith((".jpg", ".jpeg")): byid[i.filename.rsplit("/", 1)[-1].rsplit(".", 1)[0]] = i
ids = [k for k in test if k in byid]
random.seed(1); random.shuffle(ids); ids = ids[:N]
def parse(d):
    orient = 1
    i = 2
    while i + 4 < len(d):
        if d[i] != 0xFF: i += 1; continue
        m = d[i + 1]
        if m == 0xFF: i += 1; continue
        L = struct.unpack(">H", d[i + 2:i + 4])[0]
        if m == 0xE1 and d[i + 4:i + 10] == b"Exif\0\0":
            t = d[i + 10:i + 2 + L]; e = "<" if t[:2] == b"II" else ">"
            o = struct.unpack(e + "I", t[4:8])[0]; n = struct.unpack(e + "H", t[o:o + 2])[0]
            for k in range(n):
                en = t[o + 2 + 12 * k:o + 14 + 12 * k]
                if en[:2] == (b"\x12\x01" if e == "<" else b"\x01\x12"): orient = struct.unpack(e + "H", en[8:10])[0]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", d[i + 5:i + 9]); return w, h, orient
        i += 2 + L
    return None
def one(k):
    i = byid[k]
    for take in (16000, 120000):
        raw = rng(i.header_offset, i.header_offset + take)
        nl, el = struct.unpack("<HH", raw[26:30]); d = raw[30 + nl + el:]
        if i.compress_type == 8: d = zlib.decompressobj(-15).decompress(d)
        p = parse(d)
        if p: return {"id": k, "w": p[0], "h": p[1], "orient": p[2]}
    return None
with ThreadPoolExecutor(8) as ex: items = [x for x in ex.map(one, ids) if x]
print(json.dumps({"class": cls, "zip_entries": len(byid), "test_total": len(test), "test_matched": sum(k in byid for k in test), "sampled": len(items), "bytes": r.bytes, "items": items}))
