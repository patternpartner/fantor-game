"""Review sheet: for each painting and filled layer, the hidden area as LaMa fills it vs Telea (hole outlined in cyan)."""
import sys, os, numpy as np, cv2
from PIL import Image
wdir, out = sys.argv[1], sys.argv[2]; names = sys.argv[3:]
rows = []
for n in names:
    for L in ('L0', 'L1'):
        hp = f'{wdir}/{n}_{L}_hole.png'
        if not os.path.exists(hp): continue
        hole = np.asarray(Image.open(hp).convert('L').resize((640, 360))) > 0
        cnt, _ = cv2.findContours(hole.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        tiles = []
        for m in ('lama', 'telea'):
            im = np.array(np.asarray(Image.open(f'{wdir}/{n}_{L}_{m}.png').convert('RGB').resize((640, 360))))
            cv2.drawContours(im, cnt, -1, (0, 255, 255), 1); cv2.putText(im, f'{n} {L} {m}', (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            tiles.append(im)
        rows.append(np.hstack(tiles))
Image.fromarray(np.vstack(rows)).save(out, quality=82)
