/* v12.1 renderer foundation.
   The canvas path is the fallback: no WebGL, a lost context, ?classic, ?nowebgl.
   Auto steps 2 → 1.5 → 1.25 → 1 before it steps Ultra → High → Light.
   The same play-layer boxes come back from both renderers.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
const PORT = 8773;
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const POSES = [
  { id: 'shore', area: 0, x: 640 },
  { id: 'war', area: 4, x: 2500 },
  { id: 'dark', area: 5, x: 1640 },
  { id: 'boss-heart', area: 6, x: 2050, boss: true }
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
  assert(SRC.includes('function glInit') && SRC.includes('function glTex') && SRC.includes('function glBackdrop'), 'the compositor has init, texture upload and a backdrop pass');
  assert(SRC.includes('function glPlay') && SRC.includes('function glPost') && SRC.includes('function glLost'), 'play, post and context-loss have their own functions');
  assert(SRC.includes('function glLights') && SRC.includes('function glBloom') && SRC.includes('function glGrade'), 'lighting, bloom and grade are hooked and not built');
  assert(SRC.includes("getContext('webgl2'") && SRC.includes("getContext('webgl'"), 'WebGL2 is tried first, then WebGL1');
  assert(SRC.includes('webglcontextlost') && SRC.includes('preventDefault'), 'a lost context is caught without a reload');
  assert(SRC.includes("Q.has('classic')") && SRC.includes("Q.has('nowebgl')"), 'classic and a missing-WebGL switch both skip the GL path');
  assert(SRC.includes('mean>0.018') && SRC.includes('1.25'), 'auto steps down when a frame is over 18 ms, and 1.25 is on the resolution ladder');
  assert(SRC.includes("tools/art/depth/"), 'depth parallax reads the maps G1 committed');
  assert(HTML.includes('>Ultra</option>') && HTML.includes('>High</option>') && HTML.includes('>Light</option>') && HTML.includes('>Classic</option>'), 'the menu lists five graphics tiers');
  assert(SRC.includes('k===\'gfx\'?4') || SRC.includes("k==='gfx'?4"), 'a saved graphics value may be Classic');
  assert(!/hand-?painted/i.test(SRC), 'the source does not call the art hand-painted');
}

const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'];

async function openPage(browser, query, gfx, viewport, stubGL){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err.message || err)));
  const vp = viewport || { width: 1280, height: 720, deviceScaleFactor: 1 };
  await page.setViewport(vp);
  if(stubGL){
    await page.evaluateOnNewDocument(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, opts){
        if(kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
        return orig.call(this, kind, opts);
      };
    });
  }
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
    D.tp(sc.x, 10);
    const A = D.A(), P = D.P();
    G.t = 8.25; G.areaTitle = 0; G.actT = 0; G.shake = 0; G.flash = 0; G.fade = 0;
    if(A.hintT) A.hintT = 0;
    P.vx = 0; P.vy = 0; P.walk = 0; P.hurtT = 0; P.dead = 0;
    if(A.d.gy(P.x) < 1e8) P.y = A.d.gy(P.x);
    if(sc.boss && A.boss){
      const B = A.boss;
      B.st = 'act'; B.t = 0.18; B.calm = false; B.hp = Math.max(1, B.max - 2);
      B.x = A.d.boss.x; B.y = A.d.gy(B.x);
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, sc);
}

function near(a, b){
  return Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2 && a.kind === b.kind;
}

async function main(){
  sourceChecks();
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: GL_ARGS });

  console.log('fallback');
  const classic = await openPage(browser, 'mute&god&clean&auto&classic', 1);
  const classicInfo = await classic.page.evaluate(() => {
    const c = document.getElementById('game'), g = c.getContext('2d').getImageData(200, 200, 40, 40).data;
    let s = 0; for(let i = 0; i < g.length; i += 4) s += g[i] + g[i + 1] + g[i + 2];
    return { gfx: window.fantorDebug.gfx(), sum: s, lives: window.FANTOR.lives };
  });
  assert(classic.errors.length === 0, '?classic reaches play (' + (classic.errors[0] || 'no errors') + ')');
  assert(classicInfo.gfx.gl === 'classic' && classicInfo.gfx.para === 0, '?classic stays on the canvas path (' + classicInfo.gfx.gl + ')');
  assert(classicInfo.sum > 100 && classicInfo.lives === 3, '?classic still draws the land, with 3 lives');

  const none = await openPage(browser, 'mute&god&clean&auto&nowebgl', 1);
  const noneInfo = await none.page.evaluate(() => window.fantorDebug.gfx());
  assert(none.errors.length === 0, '?nowebgl reaches play (' + (none.errors[0] || 'no errors') + ')');
  assert(noneInfo.gl === 'classic', 'a forced miss falls back to classic (' + noneInfo.gl + ')');

  const live = await openPage(browser, 'mute&god&clean&auto', 1);
  await live.page.waitForFunction(() => { const g = window.fantorDebug.gfx(); return g.gl === 'webgl2' || g.gl === 'webgl1'; }, { timeout: 8000 });
  const beforeLose = await live.page.evaluate(() => window.fantorDebug.gfx().gl);
  await live.page.evaluate(() => { window.fantorDebug.glLose(); });
  await live.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const lost = await live.page.evaluate(() => {
    const c = document.getElementById('game'), g = c.getContext('2d').getImageData(180, 160, 80, 80).data;
    let s = 0; for(let i = 0; i < g.length; i += 4) s += g[i] + g[i + 1] + g[i + 2];
    return { gfx: window.fantorDebug.gfx(), sum: s, lives: window.FANTOR.lives };
  });
  assert(beforeLose === 'webgl2' || beforeLose === 'webgl1', 'the run starts on WebGL (' + beforeLose + ')');
  assert(lost.gfx.gl === 'classic', 'context loss falls back to classic without a reload');
  assert(lost.sum > 100 && lost.lives === 3, 'the frame after the loss is still the land, and the lives are unchanged');
  assert(live.errors.length === 0, 'context loss does not throw (' + (live.errors[0] || 'no errors') + ')');

  console.log('tiers');
  const tier = await openPage(browser, 'mute&god&clean&auto', 0, { width: 1600, height: 900, deviceScaleFactor: 2 });
  const ladder = await tier.page.evaluate(() => {
    const D = window.fantorDebug;
    D.setGfx(0);
    const out = [D.gfx()];
    for(let i = 0; i < 6; i++) out.push({ stepped: D.perfStep(), ...D.gfx() });
    D.setGfx(4); out.push(D.gfx());
    D.setGfx(3); out.push(D.gfx());
    D.setGfx(2); out.push(D.gfx());
    D.setGfx(1); out.push(D.gfx());
    return out;
  });
  function nextDown(rs, tier){
    if(rs > 1.5 + 1e-3) return { rs: 1.5, tier };
    if(rs > 1.25 + 1e-3) return { rs: 1.25, tier };
    if(rs > 1 + 1e-3) return { rs: 1, tier };
    if(tier < 3) return { rs, tier: tier + 1 };
    return null;
  }
  assert(ladder[0].gfx === 0 && ladder[0].tier === 1 && ladder[0].rs >= 1, 'auto starts at Ultra (' + JSON.stringify(ladder[0]) + ')');
  let exp = { rs: ladder[0].rs, tier: 1 };
  for(let i = 1; i <= 6; i++){
    const want = nextDown(exp.rs, exp.tier);
    const got = ladder[i];
    if(!want) assert(got.stepped === false && got.rs === exp.rs && got.tier === exp.tier, 'step ' + i + ' stays on the floor');
    else {
      assert(got.stepped === true && Math.abs(got.rs - want.rs) < 1e-6 && got.tier === want.tier, 'step ' + i + ' goes to RS ' + want.rs + ' tier ' + want.tier + ' (got ' + got.rs + ' / ' + got.tier + ')');
      exp = want;
    }
  }
  const steps = ladder.slice(1, 7);
  const firstTierDrop = steps.find(s => s.tier > 1);
  assert(firstTierDrop && firstTierDrop.rs === 1, 'Auto reaches RS 1 before it lowers a tier' + (firstTierDrop ? ' (RS ' + firstTierDrop.rs + ', tier ' + firstTierDrop.tier + ')' : ''));
  assert(steps.filter(s => s.tier > 1).every(s => s.rs === 1), 'every tier drop stays at RS 1');
  assert(exp.tier === 3 && exp.rs === 1, 'the ladder ends at Light and RS 1');
  assert(ladder[7].tier === 4 && ladder[7].gl === 'classic', 'Classic is the canvas path');
  assert(ladder[8].tier === 3 && ladder[8].lite === 1, 'Light is the lite tier');
  assert(ladder[9].tier === 2 && ladder[9].lite === 0, 'High is not lite');
  assert(ladder[10].tier === 1, 'Ultra can be selected again');
  assert(tier.errors.length === 0, 'tier changes do not throw (' + (tier.errors[0] || 'no errors') + ')');

  console.log('boxes');
  await tier.page.evaluate(() => window.fantorDebug.setGfx(1));
  for(const sc of POSES){
    await pose(tier.page, sc);
    await tier.page.waitForFunction(() => window.fantorDebug.gfx().para === 1 || window.fantorDebug.gfx().gl === 'classic', { timeout: 8000 }).catch(() => {});
    const glBoxes = await tier.page.evaluate(() => ({ boxes: window.fantorDebug.boxes(), gfx: window.fantorDebug.gfx() }));
    await tier.page.evaluate(() => window.fantorDebug.setGfx(4));
    await tier.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const cBoxes = await tier.page.evaluate(() => ({ boxes: window.fantorDebug.boxes(), gfx: window.fantorDebug.gfx() }));
    await tier.page.evaluate(() => window.fantorDebug.setGfx(1));
    const n = Math.min(glBoxes.boxes.length, cBoxes.boxes.length);
    let bad = glBoxes.boxes.length !== cBoxes.boxes.length ? 1 : 0;
    for(let i = 0; i < n; i++) if(!near(glBoxes.boxes[i], cBoxes.boxes[i])) bad++;
    assert(glBoxes.gfx.gl !== 'classic' && cBoxes.gfx.gl === 'classic', sc.id + ' compared WebGL with classic');
    assert(bad === 0, sc.id + ' play boxes match within 2 px (' + glBoxes.boxes.length + ' boxes)');
  }

  console.log('no webgl in the browser');
  const dead = await openPage(browser, 'mute&god&clean&auto', 1, null, true);
  const deadInfo = await dead.page.evaluate(() => {
    const c = document.getElementById('game'), g = c.getContext('2d').getImageData(200, 220, 30, 30).data;
    let s = 0; for(let i = 0; i < g.length; i += 4) s += g[i] + g[i + 1] + g[i + 2];
    return { gfx: window.fantorDebug.gfx(), sum: s, lives: window.FANTOR.lives };
  });
  assert(dead.errors.length === 0, 'a browser without WebGL still reaches play (' + (dead.errors[0] || 'no errors') + ')');
  assert(deadInfo.gfx.gl === 'classic', 'no WebGL support uses the canvas path (' + deadInfo.gfx.gl + ')');
  assert(deadInfo.sum > 50 && deadInfo.lives === 3, 'that path still draws the land and keeps 3 lives');

  await browser.close();

  server.close();
  if(failed){ console.error(failed + ' failed'); process.exit(1); }
  console.log('render ok');
}

main().catch(err => { console.error(err); process.exit(1); });
