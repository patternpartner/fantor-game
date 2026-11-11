"""Collect layers_out.json + the game's land table (src/game.js) into g1_manifest.json."""
import sys, re, json, os
game_js, layers_out, img_dir, out = sys.argv[1:5]
src = open(game_js).read(); L = json.load(open(layers_out))
lands = []
for m in re.finditer(r"makeArea\((?:v6\()?(?:v5\()?\{key:'(\w+)'(.*?)imgs:(\[\[.*?\]\])", src, re.S):
    key, mid, imgs = m.group(1), m.group(2), m.group(3)
    title = re.search(r"title:'((?:[^'\\]|\\.)*)'|title:\"([^\"]*)\"", mid); title = title and (title.group(1) or title.group(2))
    secret = 'secret:' in mid
    paints = []
    for nm, at in re.findall(r"\['(\w+)',(\d+)\]", imgs):
        if nm not in L: paints.append({'name': nm, 'at': int(at), 'in_pack': False, 'why': 'no 1920 master on the box (x-series came from elsewhere); keep today\'s 1280 file and bands'}); continue
        e = L[nm]; two = e['layers'] == 2; big = e['cover']['near'] > 0.35
        near_par = (0.8 if two else 0.9) - (0.1 if big else 0)
        layers = [{'id': 'L0', 'role': 'far', 'file': f'assets/img/{nm}_L0.webp', 'box': e['boxes']['L0'], 'depth': [0.0, e['t_mid'] if not two else e['t_near']], 'par': 0.35, 'fill': e['fill']['L0']}]
        if not two and e['boxes'].get('L1'):
            layers.append({'id': 'L1', 'role': 'mid', 'file': f'assets/img/{nm}_L1.webp', 'box': e['boxes']['L1'], 'depth': [e['t_mid'], e['t_near']], 'par': 0.62, 'fill': e['fill']['L1']})
        if e['boxes'].get('L2'):
            layers.append({'id': 'L2', 'role': 'near', 'file': f'assets/img/{nm}_L2.webp', 'box': e['boxes']['L2'], 'depth': [e['t_near'], 1.0], 'par': round(near_par, 2), 'fill': 'none (the painting\'s own pixels)'})
        paints.append({'name': nm, 'at': int(at), 'in_pack': True, 'base1920': f'assets/img/{nm}@1920.webp', 'base1280': f'assets/img/{nm}.webp (unchanged, keep for Light/lowres)',
                       'feather': e['feather'], 'auto_thresholds': [round(x, 3) for x in e['auto']], 'hand_tuned': e['note'] != '' or [round(e['t_mid'], 3), round(e['t_near'], 3)] != [round(x, 3) for x in e['auto']],
                       'note': e['note'], 'fill_note': e.get('fill_note', ''), 'parallax': {'scale': 1.16, 'breath_per_layer': [1.0, 1.5, 2.0]}, 'layers': layers,
                       'bytes': {k: os.path.getsize(os.path.join(img_dir, os.path.basename(f))) for k, f in [('base1920', f'{nm}@1920.webp')] + [(l['id'], l['file']) for l in layers]}})
    lands.append({'key': key, 'title': title, 'secret': secret, 'paintings': paints})
man = {'pack': 'Fantor G1 Clean canvas asset pack (v12.0)', 'based_on': 'patternpartner/fantor-game main d4bdef7 (v11.4)', 'frame': [1920, 1080],
       'box_units': 'px in the 1920x1080 frame: [x, y, w, h]; draw a cropped layer at (ox + x*dw/1920, oy + y*dh/1080, w*dw/1920, h*dh/1080)',
       'depth_units': 'inverse depth 0 = far .. 1 = near (Depth Anything V2 Small), thresholds are the layer cut points; feather is the soft band half-width',
       'parallax_units': "same meaning as drawBackdrop's par (0.35 today's base, 1.0 today's lowest band); all layers use one scale so edges never double",
       'fill_methods': {'lama': 'LaMa big-lama (Apache-2.0, ONNX Carve/LaMa-ONNX), run locally; user-approved generative fill of hidden pixels', 'telea': "OpenCV Telea inpainting: only spreads the painting's own neighbouring colours (fallback where LaMa invented something)"},
       'lands': lands}
tot = {}
for l in lands:
    for p in l['paintings']:
        if p.get('in_pack'):
            for k, v in p['bytes'].items(): tot.setdefault(p['name'], {})[k] = v
man['totals_bytes'] = {'base1920': sum(v['base1920'] for v in tot.values()), 'layers': sum(b for v in tot.values() for k, b in v.items() if k != 'base1920'), 'paintings': len(tot)}
man['not_in_pack'] = 'x1-x3, x5-x8 (secret-land backdrops) and x4 (ending) have no 1920 master on the box; s20/s21 are the throne cinematic, not a land backdrop. Keep their current files and drawing.'
json.dump(man, open(out, 'w'), indent=1); print('lands', len(lands), 'paintings in pack', len({p['name'] for l in lands for p in l['paintings'] if p['in_pack']}))
