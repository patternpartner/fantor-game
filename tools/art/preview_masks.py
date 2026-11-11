"""Debug sheet: painting with far (blue) / mid (green) / near (red) tint, to tune layers.json by eye."""
import sys, json, os, numpy as np
from PIL import Image
img_dir, out = sys.argv[1], sys.argv[2]; names = sys.argv[3:]
tiles = []
for n in names:
    base = Image.open(f'{img_dir}/{n}@1920.webp').convert('RGB').resize((480, 270))
    t = np.asarray(base, np.float32) * 0.55 + np.array([20, 40, 110]) * 0.45
    js = json.load(open(os.path.join(os.path.dirname(out), 'layers_out.json')))[n]['boxes']
    for k, colr in (('L1', (40, 160, 60)), ('L2', (200, 40, 40))):
        if not js[k]: continue
        x, y, w, h = js[k]; L = Image.open(f'{img_dir}/{n}_{k}.webp').convert('RGBA')
        full = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0)); full.paste(L, (x, y)); A = np.asarray(full.resize((480, 270)), np.float32)[..., 3:4] / 255
        t = t * (1 - A * 0.6) + (np.asarray(base, np.float32) * 0.5 + np.array(colr) * 0.5) * A * 0.6
    tiles.append((n, Image.fromarray(t.clip(0, 255).astype(np.uint8)), base))
S = Image.new('RGB', (960 * 2, 270 * ((len(tiles) + 1) // 2)))
for i, (n, t, b) in enumerate(tiles):
    S.paste(b, ((i % 2) * 960, (i // 2) * 270)); S.paste(t, ((i % 2) * 960 + 480, (i // 2) * 270))
S.save(out, quality=80)
