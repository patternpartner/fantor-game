"""Offline: painting master + depth -> web-ready base + three depth layers (far / mid / near), for Fantor v12.0 (G1).

Fill behind each cut (the pixels only seen as a sliver when a nearer layer slides):
  "lama"  : LaMa (big-lama, Apache-2.0, ONNX build Carve/LaMa-ONNX, run locally on CPU) - default, user-approved 11 Nov 2026
  "telea" : OpenCV Telea inpainting - only spreads the painting's own neighbouring colours (fallback, chosen per layer
            in layers.json "fill": {"L0": "telea"} wherever LaMa invented something wrong on inspection)
Both fills are cached in work/fills/ so switching a layer's method does not recompute.

usage: python tools/art/layers.py MASTER_DIR DEPTH_DIR OUT_IMG_DIR layers.json [sNN ...]
Writes, per painting sNN (names match assets/img/sNN.webp):
  sNN@1920.webp      the full painting, 1920x1080 (sharper replacement for the 1280 sNN.webp)
  sNN_L0.webp        far layer: full frame, opaque, with the mid+near areas filled
  sNN_L1.webp        mid layer: RGBA, cropped to its alpha box, near area filled
  sNN_L2.webp        near layer: RGBA, cropped to its alpha box, the painting's own pixels
and prints a JSON fragment (crop boxes, thresholds) that build_manifest.py collects.
"""
import sys, os, json, numpy as np, cv2
from PIL import Image

def otsu3(d):
    h, _ = np.histogram(d, 64, (0, 1)); h = h.astype(np.float64) / h.sum(); c = (np.arange(64) + 0.5) / 64
    best, bt = -1, (0.4, 0.7)
    for i in range(4, 60):
        for j in range(i + 3, 62):
            v = 0
            for a, b in ((0, i), (i, j), (j, 64)):
                w = h[a:b].sum()
                if w > 0: m = (h[a:b] * c[a:b]).sum() / w; v += w * m * m
            if v > best: best, bt = v, (i / 64, j / 64)
    return bt

def ramp(d, t, w):
    return np.clip((d - (t - w)) / (2 * w), 0, 1)

LAMA = None
def lama_fill(img, hole):
    """LaMa at 512 px tall (fixed 512x512 input): two overlapping windows across the 16:9 frame, blended in the overlap."""
    global LAMA
    import onnxruntime as ort
    if LAMA is None: LAMA = ort.InferenceSession(os.environ.get('LAMA_ONNX', 'models/lama/lama_fp32.onnx'), providers=['CPUExecutionProvider'])
    H, W = hole.shape; h = 512; w = round(W * h / H)
    s = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    m = (cv2.resize(hole, (w, h), interpolation=cv2.INTER_NEAREST) > 0).astype(np.float32)
    acc = np.zeros((h, w, 3), np.float32); wt = np.zeros((h, w, 1), np.float32)
    xs = [0, w - 512] if w > 512 else [0]
    for x0 in xs:
        if m[:, x0:x0 + 512].sum() == 0: continue
        o = LAMA.run(None, {'image': s[:, x0:x0 + 512].transpose(2, 0, 1)[None], 'mask': m[None, None, :, x0:x0 + 512]})[0][0].transpose(1, 2, 0)
        r = np.ones((1, 512, 1), np.float32)
        if len(xs) > 1:  # linear blend across the overlap
            ov = 512 * 2 - w; ramp_ = np.linspace(0, 1, ov, dtype=np.float32)
            if x0 == 0: r[0, 512 - ov:, 0] = ramp_[::-1]
            else: r[0, :ov, 0] = ramp_
        acc[:, x0:x0 + 512] += o * r; wt[:, x0:x0 + 512] += r
    f = np.where(wt > 0, acc / np.maximum(wt, 1e-6), s * 255)
    f = cv2.resize(np.clip(f, 0, 255).astype(np.uint8), (W, H), interpolation=cv2.INTER_CUBIC)
    return np.where(hole[..., None] > 0, f, img)

def fill_cached(img, hole, n, layer, method, wdir):
    os.makedirs(wdir, exist_ok=True); p = os.path.join(wdir, f'{n}_{layer}_{method}.png')
    if os.path.exists(p) and os.environ.get('REFILL') != '1': return np.asarray(Image.open(p).convert('RGB'))
    f = lama_fill(img, hole) if method == 'lama' else fill(img, hole)
    Image.fromarray(f).save(p); return f

def fill(img, hole, scale=2):
    """Telea inpaint at 1/scale res (fast; the fill is only ever seen as a thin sliver), pasted back into the hole only."""
    H, W = hole.shape
    s = cv2.resize(img, (W // scale, H // scale), interpolation=cv2.INTER_AREA)
    hs = cv2.resize(hole, (W // scale, H // scale), interpolation=cv2.INTER_NEAREST)
    f = cv2.inpaint(s, hs, 12, cv2.INPAINT_TELEA)
    f = cv2.resize(f, (W, H), interpolation=cv2.INTER_CUBIC)
    f = cv2.GaussianBlur(f, (0, 0), 2.0)  # soften the Telea streaks a touch
    return np.where(hole[..., None] > 0, f, img)

def crop_box(a, pad=4):
    ys, xs = np.where(a > 2)
    if not len(xs): return None
    H, W = a.shape
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad), max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

def run(n, src, ddir, out, cfg):
    c = dict(cfg.get('_default', {})); c.update(cfg.get(n, {}))
    col = np.asarray(Image.open(os.path.join(src, f'fin_{n}.png')).convert('RGB'))
    H, W = col.shape[:2]
    d = np.asarray(Image.open(os.path.join(ddir, f'{n}_depth.png')).convert('L'), np.float32) / 255
    # hand overrides: rectangles (fractions of the frame) forced to a depth (e.g. painted light rays -> far)
    for r in c.get('force', []):
        x0, y0, x1, y1 = int(r['box'][0] * W), int(r['box'][1] * H), int(r['box'][2] * W), int(r['box'][3] * H)
        m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1; m = cv2.GaussianBlur(m, (0, 0), 25)
        if 'below' in r: m *= (d < r['below'])  # only pull down what is already far-ish (keeps a figure in front intact)
        d = d * (1 - m) + r['depth'] * m
    if c.get('thin', 0):  # keep spires, poles, swords whole: grow near depth by a few px before cutting
        k = int(c['thin']); d = cv2.dilate(d, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    auto = otsu3(d)
    t_mid = c.get('t_mid', round(auto[0], 3)); t_near = c.get('t_near', round(auto[1], 3)); w = c.get('feather', 0.04)
    a_mid = ramp(d, t_mid, w); a_near = ramp(d, t_near, w)
    if c.get('layers', 3) == 2: a_mid = a_near  # two-layer paintings: far + near only (mid file is the near one's backing)
    blur = c.get('edge_px', 2.0)
    a_mid = cv2.GaussianBlur(a_mid, (0, 0), blur); a_near = cv2.GaussianBlur(a_near, (0, 0), blur)
    grow = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (c.get('hole_grow', 31),) * 2)
    fm = {'L0': 'lama', 'L1': 'lama'}; fm.update(c.get('fill', {}))
    wdir = os.environ.get('FILL_CACHE') or os.path.join(os.path.dirname(os.path.dirname(out.rstrip('/'))), 'work', 'fills')
    # Only a band around each cut edge can ever be revealed (max relative layer shift is about 66 px at 1920 with the
    # suggested parallax), so the fill hole is that band: grown 'hole_grow' outward, 'band' px inward. The interior keeps the
    # painting's pixels and is always covered by the nearer layer. Thin holes give LaMa far better context than huge ones.
    band = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * c.get('band', 170) + 1,) * 2)
    def hole_of(a):
        m = (a > 0.02).astype(np.uint8); return cv2.dilate(m, grow) & (1 - cv2.erode(m, band))
    h0 = hole_of(a_mid); h1 = hole_of(a_near)
    for meth in ('lama', 'telea'):  # cache both so the review can compare and the config can switch
        fill_cached(col, h0, n, 'L0', meth, wdir)
        if c.get('layers', 3) == 3: fill_cached(col, h1, n, 'L1', meth, wdir)
    far = fill_cached(col, h0, n, 'L0', fm['L0'], wdir)
    mid = fill_cached(col, h1, n, 'L1', fm['L1'], wdir) if c.get('layers', 3) == 3 else col
    Image.fromarray(h0 * 255).save(os.path.join(wdir, f'{n}_L0_hole.png'))
    if c.get('layers', 3) == 3: Image.fromarray(h1 * 255).save(os.path.join(wdir, f'{n}_L1_hole.png'))
    q = c.get('q', {})
    Image.fromarray(col).save(os.path.join(out, f'{n}@1920.webp'), 'WEBP', quality=q.get('base', 80), method=6)
    Image.fromarray(far).save(os.path.join(out, f'{n}_L0.webp'), 'WEBP', quality=q.get('far', 72), method=6)
    info = {'t_mid': float(t_mid), 't_near': float(t_near), 'auto': [float(auto[0]), float(auto[1])], 'feather': w, 'layers': c.get('layers', 3), 'note': c.get('note', ''), 'fill_note': c.get('fill_note', ''), 'fill': {'L0': fm['L0'], 'L1': fm['L1'] if c.get('layers', 3) == 3 else 'none (2-layer: near layer is the painting itself, mid file not used)'}}
    boxes = {'L0': [0, 0, W, H]}
    for k, (img, a) in {'L1': (mid, a_mid), 'L2': (col, a_near)}.items():
        if k == 'L1' and c.get('layers', 3) == 2: boxes[k] = None; continue  # 2-layer painting: no mid file
        A = (np.clip(a, 0, 1) * 255).astype(np.uint8); b = crop_box(A)
        if b is None: boxes[k] = None; continue
        x, y, bw, bh = b
        Image.fromarray(np.dstack([img[y:y + bh, x:x + bw], A[y:y + bh, x:x + bw]])).save(os.path.join(out, f'{n}_{k}.webp'), 'WEBP', quality=q.get(k, 74), alpha_quality=c.get('alpha_q', 70), method=6)
        boxes[k] = b
    info['boxes'] = boxes; info['cover'] = {'mid': float(a_mid.mean()), 'near': float(a_near.mean())}
    return info

if __name__ == '__main__':
    src, ddir, out, cfgp = sys.argv[1:5]; names = sys.argv[5:]
    cfg = json.load(open(cfgp)); os.makedirs(out, exist_ok=True)
    names = names or [k for k in cfg if not k.startswith('_')]
    res = {}
    for n in names:
        res[n] = run(n, src, ddir, out, cfg); print(n, json.dumps({k: res[n][k] for k in ('t_mid', 't_near', 'auto', 'cover')}), flush=True)
    json.dump(res, open(os.path.join(os.path.dirname(cfgp), 'layers_out.json'), 'w'), indent=1)
