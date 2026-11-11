"""Offline: painting master -> inverse depth map (1 = near), Depth Anything V2 Small (Apache-2.0) via onnxruntime, CPU.
usage: python tools/art/depth.py MODEL.onnx MASTER_DIR OUT_DIR s01 s02 ...
Masters are fin_sNN.png (1920x1080). Output: OUT_DIR/sNN_depth.png (8-bit, 1920x1080, guided-filtered to the painting's edges)."""
import sys, os, numpy as np, cv2, onnxruntime as ort
from PIL import Image
model, src, out = sys.argv[1:4]; names = sys.argv[4:]
sess = ort.InferenceSession(model, providers=['CPUExecutionProvider']); inp = sess.get_inputs()[0].name
os.makedirs(out, exist_ok=True)
for n in names:
    im = Image.open(os.path.join(src, f'fin_{n}.png')).convert('RGB'); W, H = im.size
    x = np.asarray(im.resize((924, 518), Image.BICUBIC), np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {inp: x})[0][0]; d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    d = cv2.resize(d.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    g = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    d = cv2.ximgproc.guidedFilter(g, d, 12, 1e-3)
    Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8)).save(os.path.join(out, f'{n}_depth.png'))
    print(n, 'depth ok', flush=True)
