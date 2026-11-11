"""Zoom review: the fill of one layer shown only inside its hole (rest dimmed), LaMa left / Telea right."""
import sys, numpy as np
from PIL import Image
wdir, out = sys.argv[1], sys.argv[2]; items = sys.argv[3:]
rows = []
for it in items:
    n, L = it.split(':'); h = np.asarray(Image.open(f'{wdir}/{n}_{L}_hole.png').convert('L').resize((960, 540)), np.float32)[..., None] / 255
    t = []
    for m in ('lama', 'telea'):
        a = np.asarray(Image.open(f'{wdir}/{n}_{L}_{m}.png').convert('RGB').resize((960, 540)), np.float32)
        t.append(a * (0.25 + 0.75 * h))
    rows.append(np.hstack(t))
Image.fromarray(np.vstack(rows).astype(np.uint8)).save(out, quality=84)
