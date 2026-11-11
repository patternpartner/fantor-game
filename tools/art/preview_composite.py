"""Before/after preview using the game's own backdrop maths (drawBackdrop, v11.4) in a canvas-2D-style composite.
Before: today's 1280 sNN.webp + two gradient-masked copies at 1.16/1.28/1.42 scale.
After : the pack's sNN_L0/L1/L2 at one scale (1.16) with per-layer parallax from g1_manifest.json.
Rendered at 854x480 logical x RS 1.5 = 1281x720, camera progress p = 0..1 across the painting's stretch."""
import sys, json, math, numpy as np, cv2
from PIL import Image
GAME_IMG, PACK, MAN, OUT = sys.argv[1:5]; names = sys.argv[5:]
W, H, RS = 854, 480, 1.5
man = json.load(open(MAN)); P = {p['name']: p for l in man['lands'] for p in l['paintings']}
def blit(dst, src, ox, oy, dw, dh, box=None):
    """drawImage(src, ox, oy, dw, dh) in logical px; src may be a crop placed at box inside a 1920x1080 frame."""
    sh, sw = src.shape[:2]
    if box: fx, fy = dw / 1920, dh / 1080; ox, oy, dw, dh = ox + box[0] * fx, oy + box[1] * fy, box[2] * fx, box[3] * fy
    M = np.float32([[dw * RS / sw, 0, ox * RS], [0, dh * RS / sh, oy * RS]])
    im = cv2.warpAffine(src, M, (dst.shape[1], dst.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    a = im[..., 3:4] / 255.0 if im.shape[2] == 4 else 1.0
    dst[:] = dst * (1 - a) + im[..., :3] * a
def bands(im):
    out = []; h = im.shape[0]
    for top, f in ((0.40, 0.16), (0.64, 0.12)):
        y = np.arange(h) / h; a = np.clip((y - (top - f)) / f, 0, 1)
        out.append(np.dstack([im, (a[:, None] * 255 * np.ones(im.shape[1]))]).astype(np.float32))
    return out
def before(n, p):
    im = np.asarray(Image.open(f'{GAME_IMG}/{n}.webp').convert('RGB'), np.float32); b = bands(im)
    dst = np.zeros((round(H * RS), round(W * RS), 3), np.float32)
    for src, sc, par in ((im, 1.16, 0.35), (b[0], 1.28, 0.7), (b[1], 1.42, 1.0)):
        dw, dh = W * sc, H * sc; sl = dw - W; blit(dst, src, -sl * 0.5 + sl * (0.5 - p) * par * 0.9, -(dh - H) * 0.6, dw, dh)
    return dst
def after(n, p):
    e = P[n]; dst = np.zeros((round(H * RS), round(W * RS), 3), np.float32); sc = e['parallax']['scale']
    for L in e['layers']:
        src = np.asarray(Image.open(f"{PACK}/{L['file']}").convert('RGBA' if L['id'] != 'L0' else 'RGB'), np.float32)
        dw, dh = W * sc, H * sc; sl = dw - W
        blit(dst, src, -sl * 0.5 + sl * (0.5 - p) * L['par'] * 0.9, -(dh - H) * 0.6, dw, dh, L['box'])
    return dst
u8 = lambda a: Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
import os
if os.environ.get('SHEET'):  # QA sheet: every painting, after, at both ends of its pan
    S = Image.new('RGB', (4 * 480, ((len(names) + 1) // 2) * 270))
    for i, n in enumerate(names):
        for j, p in enumerate((0.0, 1.0)): S.paste(u8(after(n, p)).resize((480, 270)), (((i % 2) * 2 + j) * 480, (i // 2) * 270))
    S.save(f"{OUT}/{os.environ['SHEET']}", quality=82); sys.exit(0)
for n in names:
    frames = []
    for i in range(20):
        p = 0.5 - 0.5 * math.cos(i / 20 * 2 * math.pi)
        S = Image.new('RGB', (1290, 360)); S.paste(u8(before(n, p)).resize((640, 360)), (0, 0)); S.paste(u8(after(n, p)).resize((640, 360)), (650, 0)); frames.append(S)
    frames[0].save(f'{OUT}/{n}_before_after_sweep.gif', save_all=True, append_images=frames[1:], duration=120, loop=0)
    st = Image.new('RGB', (2572, 1450), 'white')
    for j, p in enumerate((0.0, 1.0)):
        st.paste(u8(before(n, p)), (0, j * 730)); st.paste(u8(after(n, p)), (1291, j * 730))
    st.save(f'{OUT}/{n}_before_after_still.jpg', quality=86); print(n, 'preview ok', flush=True)
