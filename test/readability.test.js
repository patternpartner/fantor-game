/* v12.0 readability guard.
   Renders 16 fixed scenes and compares the contrast of the player, enemies, hazards,
   shots and gap lips with the v11.4 baseline in test/baseline-v11.4.json.
   Contrast is the dark core of each box (20th percentile luminance) against the ring
   around it. The build fails if that ratio drops more than 5% below v11.4, which is
   what a bloom, a veil or a lost gap rim would do. A brighter painting behind a figure
   raises the ratio; it does not hide the figure.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
const PORT = 8772;
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-v11.4.json'), 'utf8'));

const SCENES = [
  { id: 'shore', area: 0, x: 960 },
  { id: 'forest', area: 1, x: 1100 },
  { id: 'river', area: 2, x: 1000 },
  { id: 'kingdom', area: 3, x: 1260 },
  { id: 'war', area: 4, x: 2600 },
  { id: 'dark', area: 5, x: 1640 },
  { id: 'heart', area: 6, x: 1050 },
  { id: 'garden', area: 7, x: 900 },
  { id: 'boss-shore', area: 0, x: 2480, boss: true },
  { id: 'boss-forest', area: 1, x: 3050, boss: true },
  { id: 'boss-river', area: 2, x: 3300, boss: true },
  { id: 'boss-kingdom', area: 3, x: 3450, boss: true },
  { id: 'boss-war', area: 4, x: 3650, boss: true },
  { id: 'boss-dark', area: 5, x: 3850, boss: true },
  { id: 'boss-heart', area: 6, x: 2050, boss: true },
  { id: 'shore-gap', area: 0, x: 800 }
];

let failed = 0;
function assert(cond, msg){
  if(cond) console.log('  ok  ' + msg);
  else { failed++; console.error('  FAIL  ' + msg); }
}

function serve(){
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json' };
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p === '/') p = '/index.html';
      if(p === '/game.js') p = '/src/game.js';
      if(p.includes('..')){ res.writeHead(400); res.end(); return; }
      fs.readFile(path.join(ROOT, p), (err, buf) => {
        if(err){ res.writeHead(404); res.end('missing ' + p); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function sourceChecks(){
  console.log('source');
  assert(SRC.includes('function playBoxes'), 'fantorDebug can report screen boxes');
  assert(SRC.includes('boxes:playBoxes'), 'the boxes hook is on fantorDebug');
  assert(SRC.includes('function shakeOffset') && SRC.includes('tr*tr'), 'shake is trauma squared, not a fresh random offset');
  assert(!SRC.includes('(Math.random()-.5)*10*game.shake'), 'the old per-frame jitter is gone');
  assert(SRC.includes('Math.round(vx*RS)/RS'), 'the camera snaps to device pixels');
  assert(SRC.includes('renderA=clamp(acc/STEP,0,1)'), 'render blends the camera between 60 Hz steps');
  assert(SRC.includes('function drawLayers') && SRC.includes('e.parallax.scale'), 'depth layers use the manifest scale');
  assert(SRC.includes('sc0=e.parallax.scale') || SRC.includes('sc0=e.parallax.scale'), 'one scale for every layer');
  assert(SRC.includes("hlx.drawImage(cv"), 'bloom reads the game canvas, not the HUD');
  assert(SRC.includes('postBackdrop();') && SRC.indexOf('postBackdrop();') < SRC.indexOf('drawGround();'), 'bloom runs before the play layer');
  assert(HTML.includes('canvas id="hud"') && HTML.includes('pointer-events:none'), 'the HUD is its own canvas and ignores the pointer');
  assert(HTML.includes('>Layers</option>') && HTML.includes('>Off</option>'), 'depth can be turned off');
  assert(SRC.includes('function wantHi') && SRC.includes('RS>=1.5'), '1920 paintings are for high-DPI and large screens');
  assert(SRC.includes("Q.has('lowres')") && SRC.includes('gfxLite()'), 'Light and ?lowres keep the 1280 path');
  assert(!/hand-?painted/i.test(SRC), 'the source does not call the art hand-painted');
}

async function boot(browser, query, gfx){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err.message || err)));
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((gfx) => {
    localStorage.setItem('fantor.settings', JSON.stringify({ music: 0, voice: 0, sfx: 0, timer: 0, gfx, depth: 1, gv: 1 }));
  }, gfx);
  await page.goto(`http://127.0.0.1:${PORT}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.FANTOR && window.FANTOR.state === 'play', { timeout: 30000 });
  return { page, errors };
}

async function pose(page, sc){
  await page.evaluate(async (sc) => {
    const D = window.fantorDebug, G = window.FANTOR;
    const lands = ['shore','forest','river','kingdom','war','dark','heart','garden'];
    G.paused = false;
    if(G.areaI !== sc.area || !D.A() || D.A().d.key !== lands[sc.area]){
      D.goArea(sc.area);
      await new Promise(res => {
        const t0 = performance.now();
        const tick = () => {
          if(G.state === 'play' && G.areaI === sc.area) res();
          else if(performance.now() - t0 > 8000) res();
          else requestAnimationFrame(tick);
        };
        tick();
      });
    }
    G.paused = true;
    const A0 = D.A();
    let x = sc.x;
    for(let i = 0; i < 48 && A0.d.gy(x) > 1e8; i++) x -= 16;
    D.tp(x, 10);
    const A = D.A(), P = D.P();
    G.t = 8.25; G.areaTitle = 0; G.actT = 0; G.shake = 0; G.flash = 0; G.fade = 0;
    if(A.hintT) A.hintT = 0;
    A.hint = '';
    P.vx = 0; P.vy = 0; P.walk = 0; P.hurtT = 0; P.dead = 0; P.glow = 1.2;
    if(A.d.gy(P.x) < 1e8) P.y = A.d.gy(P.x);
    for(const e of A.enemies){ e.x = e.x0; e.vx = 0; e.y = e.y0; e.calm = false; e.hit = 0; e.tele = 0; }
    A.particles = []; A.embers = [];
    if(sc.boss && A.boss){
      const B = A.boss;
      B.st = 'act'; B.t = 0.18; B.calm = false; B.hp = Math.max(1, B.max - 2); B.hit = 0;
      B.x = A.d.boss.x; B.y = A.d.gy(B.x);
      const gy = A.d.gy(B.x - 140);
      A.shots = [{ x: B.x - 130, y: gy - 46, vx: -160, vy: 0, g: 0, r: 9, k: 'orb', dmg: 1, life: 4, t: 0.2 }];
    } else A.shots = [];
    for(const h of A.haz){
      if(Math.abs(h.x - sc.x) > 520) continue;
      if(h.k === 'vent'){ h.act = 1; h.tt = 0.25; h.warn = 0; }
      if(h.k === 'drop'){ h.fall = 1; h.ry = (A.d.gy(h.x) < 1e8 ? A.d.gy(h.x) : 392) - 90; }
    }
    const paint = A.d.imgs[0][0];
    const t1 = performance.now();
    while(performance.now() - t1 < 2500 && paint[0] !== 'x' && !(D.art() || []).some(n => n.indexOf(paint + '_L') === 0)){
      await new Promise(r => setTimeout(r, 40));
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, sc);
}

async function measure(page){
  return page.evaluate(() => {
    const D = window.fantorDebug;
    const boxes = D.boxes();
    const W = 854, H = 480;
    const cv = document.getElementById('game');
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const sx = cv.width / W, sy = cv.height / H;
    const lumAt = (lx, ly) => {
      const x = Math.max(0, Math.min(cv.width - 1, Math.round(lx * sx)));
      const y = Math.max(0, Math.min(cv.height - 1, Math.round(ly * sy)));
      const i = (y * cv.width + x) * 4;
      const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const d = img.data;
      return 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]);
    };
    const samples = (x, y, w, h) => {
      const out = [];
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      const step = Math.max(1, Math.round(Math.min(x1 - x0, y1 - y0) / 12));
      for(let yy = y0; yy < y1; yy += step) for(let xx = x0; xx < x1; xx += step) out.push(lumAt(xx, yy));
      return out;
    };
    const meanOf = xs => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
    const p20 = xs => { if(!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.2))]; };
    const mean = (x, y, w, h) => meanOf(samples(x, y, w, h));
    const ring = b => {
      const m = 5; let s = 0, n = 0;
      const take = (x, y, w, h) => { const v = mean(x, y, w, h); if(w > 1 && h > 1){ s += v; n++; } };
      take(b.x - m, b.y - m, b.w + m * 2, m);
      take(b.x - m, b.y + b.h, b.w + m * 2, m);
      take(b.x - m, b.y, m, b.h);
      take(b.x + b.w, b.y, m, b.h);
      return n ? s / n : 0;
    };
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return boxes.map(b => {
      const pix = samples(b.x, b.y, b.w, b.h);
      const core = p20(pix);
      return { kind: b.kind, contrast: +ratio(core, ring(b)).toFixed(4) };
    });
  });
}

async function main(){
  sourceChecks();
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  console.log('contrast against v11.4');
  let page, errors, webglPage;
  for(const pass of [{ gfx: 1, name: 'webgl' }, { gfx: 4, name: 'classic' }]){
  ({ page, errors } = await boot(browser, 'mute&god&clean&auto', pass.gfx));
  assert(errors.length === 0, pass.name + ' reaches play (' + (errors[0] || 'no errors') + ')');
  for(const sc of SCENES){
    await pose(page, sc);
    if(pass.gfx === 1){
      await page.waitForFunction(() => { const g = window.fantorDebug.gfx(); return g.para === 1 || g.gl === 'classic'; }, { timeout: 8000 }).catch(() => {});
      const g = await page.evaluate(() => window.fantorDebug.gfx());
      assert(g.gl === 'webgl2' || g.gl === 'webgl1', sc.id + ' ultra stays on WebGL (' + g.gl + ')');
      assert(g.para === 1, sc.id + ' ultra uses depth parallax');
    } else {
      const g = await page.evaluate(() => window.fantorDebug.gfx());
      assert(g.gl === 'classic' && g.tier === 4, sc.id + ' classic stays on the canvas path (' + g.gl + ' tier ' + g.tier + ')');
    }
    const rows = await measure(page);
    const base = BASE[sc.id].rows;
    assert(rows.length === base.length, sc.id + ' still has ' + base.length + ' boxes (got ' + rows.length + ')');
    const n = Math.min(rows.length, base.length);
    const drops = [];
    for(let i = 0; i < n; i++){
      if(rows[i].kind !== base[i].kind){ drops.push('kind ' + base[i].kind + '/' + rows[i].kind); continue; }
      const ratio = base[i].contrast ? rows[i].contrast / base[i].contrast : 1;
      if(ratio < 0.95) drops.push(rows[i].kind + ' ' + base[i].contrast.toFixed(3) + '→' + rows[i].contrast.toFixed(3));
    }
    assert(drops.length === 0, pass.name + ' ' + sc.id + ' contrast stays within 5% of v11.4' + (drops.length ? ' (' + drops.join(', ') + ')' : ''));
  }
  if(pass.gfx === 1) webglPage = page;
  else await page.close();
  }
  page = webglPage;

  const hud = await page.evaluate(async () => {
    const G = window.FANTOR;
    G.paused = false; // the pause wash would dim the counter
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    G.paused = true;
    const box = (id) => {
      const c = document.getElementById(id), g = c.getContext('2d');
      const w = Math.min(c.width, 220), h = Math.min(c.height, 140);
      const d = g.getImageData(0, 0, w, h).data;
      let bright = 0, max = 0;
      for(let i = 0; i < d.length; i += 4){ const r = d[i]; if(r > max) max = r; if(d[i + 3] > 200 && r > 220) bright++; }
      return { bright, max };
    };
    return { hud: box('hud'), game: box('game'), art: window.fantorDebug.art() };
  });
  assert(hud.hud.bright > 8, 'the counter is drawn on the HUD canvas (' + hud.hud.bright + ' bright pixels, max ' + hud.hud.max + ')');
  assert(hud.game.bright < hud.hud.bright, 'the game canvas is not carrying that text (' + hud.game.bright + ' vs ' + hud.hud.bright + ')');
  assert(hud.art.every(n => /^s0[123]/.test(n)), 'only the shore layers are loaded (' + hud.art.slice(0, 8).join(',') + ')');
  assert(hud.art.some(n => n.indexOf('@1920') > 0) && hud.art.some(n => /_L\d$/.test(n)), 'the shore loaded 1920 art and depth layers');

  console.log('camera and shake');
  const motion = await page.evaluate(async () => {
    const D = window.fantorDebug, G = window.FANTOR;
    D.manual(true);
    await new Promise(r => requestAnimationFrame(r));
    G.paused = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true }));
    const xs = [];
    let t = performance.now();
    for(let i = 0; i < 30; i++){ t += 1000 / 120; D.frame(t); xs.push(+D.drawn()[0].toFixed(3)); }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }));
    G.paused = true; G.shake = 1; G.t = 4;
    const grab = () => {
      const c = document.getElementById('game'), g = c.getContext('2d');
      const d = g.getImageData(Math.floor(c.width * 0.4), Math.floor(c.height * 0.7), 48, 24).data;
      let s = 0; for(let i = 0; i < d.length; i += 16) s = (s * 33 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
      return s;
    };
    const t0 = t + 50;
    D.frame(t0); const a = grab();
    D.frame(t0); const b = grab();
    G.t = 4.45;
    D.frame(t0); const c = grab();
    D.manual(false);
    return { xs, a, b, c };
  });
  let up = 0, down = 0;
  for(let i = 1; i < motion.xs.length; i++){ if(motion.xs[i] > motion.xs[i - 1] + 0.001) up++; else if(motion.xs[i] + 0.001 < motion.xs[i - 1]) down++; }
  assert(down === 0 && up >= 8 && motion.xs[motion.xs.length - 1] > motion.xs[0] + 1, 'at 120 Hz the camera advances smoothly (' + up + ' steps, ' + motion.xs[0] + '→' + motion.xs[motion.xs.length - 1] + ')');
  assert(motion.a === motion.b, 'the same moment shakes the same way');
  assert(motion.a !== motion.c, 'the shake moves as time moves');
  await page.close();

  console.log('light tier');
  const lite = await browser.newPage();
  const liteErr = [];
  lite.on('pageerror', e => liteErr.push(String(e.message || e)));
  await lite.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });
  await lite.evaluateOnNewDocument(() => {
    localStorage.setItem('fantor.settings', JSON.stringify({ music: 0, voice: 0, sfx: 0, timer: 0, gfx: 3, depth: 1, gv: 1 }));
  });
  await lite.goto(`http://127.0.0.1:${PORT}/?mute&god&clean&auto&lowres`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await lite.waitForFunction(() => window.FANTOR && window.FANTOR.state === 'play', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 300));
  const liteInfo = await lite.evaluate(() => {
    const c = document.getElementById('game'), g = c.getContext('2d').getImageData(400, 300, 1, 1).data;
    return { art: window.fantorDebug.art(), rs: window.fantorDebug.state().rs, pix: g[0] + g[1] + g[2], lives: window.FANTOR.lives };
  });
  assert(liteErr.length === 0, 'Light reaches play (' + (liteErr[0] || 'no errors') + ')');
  assert(liteInfo.rs === 1 && liteInfo.art.length === 0, 'Light / lowres keeps RS 1 and the 1280 files (rs ' + liteInfo.rs + ', extra ' + liteInfo.art.length + ')');
  assert(liteInfo.pix > 10 && liteInfo.lives === 3, 'Light still draws the land, and the journey still has 3 lives');
  await lite.close();

  await browser.close();
  server.close();
  if(failed){ console.error(failed + ' failed'); process.exit(1); }
  console.log('readability ok');
}

main().catch(err => { console.error(err); process.exit(1); });
