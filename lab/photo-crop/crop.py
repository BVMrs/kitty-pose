# Which part of each meme photo survives snap()'s cover crop into the 1080 x 675 cat band, and how much it is upscaled.
# usage: python3 -I crop.py <assets dir> [outdir for contact sheet]
import sys, os
from PIL import Image
A = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else None
W, BH = 1080, 675
rows = []; tiles = []
for f in sorted(os.listdir(A)):
    im = Image.open(os.path.join(A, f)); w, h = im.size
    k = max(W / w, BH / h); cw, ch = W / k, BH / k
    box = ((w - cw) / 2, (h - ch) / 2, (w + cw) / 2, (h + ch) / 2)
    rows.append((f, w, h, k, 100 * cw * ch / (w * h)))
    if out:
        im.convert("RGB").crop(tuple(round(v) for v in box)).resize((324, 203)); 
        full = im.convert("RGB").copy(); 
        t = Image.new("RGB", (324 + 8 + 120, 203), "white")
        t.paste(im.convert("RGB").crop(tuple(round(v) for v in box)).resize((324, 203)), (0, 0))
        s = full.copy(); s.thumbnail((120, 203)); t.paste(s, (332, 0)); tiles.append(t)
print("file             size       upscale  kept%")
for f, w, h, k, p in rows: print(f"{f:17s}{w}x{h:<6d} {k:5.2f}x  {p:5.1f}")
print("mean upscale %.2f, mean kept %.1f%%, min kept %.1f%%" % (sum(r[3] for r in rows) / len(rows), sum(r[4] for r in rows) / len(rows), min(r[4] for r in rows)))
if out:
    os.makedirs(out, exist_ok=True)
    cols = 3; sheet = Image.new("RGB", (cols * 460, ((len(tiles) + cols - 1) // cols) * 210), "white")
    for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * 460, (i // cols) * 210))
    sheet.save(os.path.join(out, "sheet.png"))
