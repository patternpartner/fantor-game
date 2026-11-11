/* Focused checks for the v11.1 readability fixes, plus a few guards that the
   journey's rules (lives, knockback, records) are still the ones v11 shipped.
   Serves this repo and drives the real canvas build in headless Chrome.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
const PORT = 8771;
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');

let failed = 0;
let useSource = true;
function assert(cond, msg){
  if(cond) console.log('  ok  '+msg);
  else { failed++; console.error('  FAIL  '+msg); }
}

function serve(){
  const types = {'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.txt':'text/plain'};
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p === '/') p = '/index.html';
      if(p === '/game.js' && useSource) p = '/src/game.js';
      if(p.includes('..')){ res.writeHead(400); res.end(); return; }
      const file = path.join(ROOT, p);
      fs.readFile(file, (err, buf) => {
        if(err){ res.writeHead(404); res.end('missing '+p); return; }
        res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
        res.end(buf);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function sourceChecks(){
  console.log('source');
  assert(!SRC.includes('struck down'), 'the end card no longer says "struck down"');
  assert(SRC.includes("hit:'was struck'"), 'a blow reads as "was struck"');
  assert(!SRC.includes('all journeys'), 'the death counts are not labeled "all journeys"');
  assert(SRC.includes("text('lights out'"), 'the strip labels those counts "lights out"');
  assert(SRC.includes('each number is a time the light went out there'), 'the lifetime map says what its numbers count');
  assert(SRC.includes('journeys kept in this browser'), 'the lifetime map still states how many journeys were kept');
  assert(SRC.includes("tot===5?'rp1':tot===10?'rp2':tot===25?'rp3':tot===50?'rp4'"), 'returning lines still fall on the 5th, 10th, 25th and 50th journey');
  assert(SRC.includes("c===3?'rp5':c===10?'rp6':c===25?'rp7'"), 'the land lines are still the 3rd, 10th and 25th time the light goes out there');
  assert(SRC.includes("game.ember&&o.runs===1?'rp8'"), 'the first Ember Run line is unchanged');
  assert(SRC.includes('const GRAV=980, JV=362, SPD=142, PH=54, PW=16'), 'gravity, jump and run speed are unchanged');
  assert(SRC.includes('P.vx=Math.sign(P.x-src.x||-P.face)*240; P.vy=-200'), 'a hit still knocks you back, including toward a pit');
  assert(SRC.includes('START_LIVES=3') && SRC.includes('game.lives=game.ember?1:START_LIVES'), 'three lives, and the Ember Run is still one');
  assert(SRC.includes("localStorage.getItem('fantor.'+k)") && SRC.includes("store.get('dmap')") && SRC.includes("store.get('rec')"), 'records stay in the same fantor.dmap and fantor.rec keys');
  assert(SRC.includes('function cardZone') && SRC.includes('function syncTouch'), 'the card tap is the existing one, and play buttons leave the end screens');
  assert(!/hand-?painted/i.test(SRC), 'the source does not call the art hand-painted');
  const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(HTML.includes('id="bc"'), 'phones have a crouch button');
  assert(HTML.includes('crouch, fire, star-fall, kneel'), 'the pause menu lists crouch');
  assert(SRC.includes("e.t!=='walker'"), 'a head stomp only accepts a walker');
  assert(SRC.includes('function gainLight'), 'collected light goes into the shine pool');
  assert(SRC.includes('function tryCover'), 'crouching behind a rock can cover a shot');
  assert(SRC.includes("k:'rock',cover:1"), 'the King of Bell arena has a cover stone');
  assert(SRC.includes('v11.3') && !SRC.includes('v11.2'), 'the source is marked v11.3');
  assert(!SRC.includes('vo.heard.clear'), 'a retry keeps narration already heard this sitting');
  assert(SRC.includes('again:true'), 'the game-over line can still be said again');
  assert(SRC.includes('game.goT>1.0') && !SRC.includes('game.goT>3.0'), 'game over accepts a key after 1s');
  assert(!SRC.includes('the stone ahead wants'), 'the stone line is no longer "the stone ahead wants"');
  assert(SRC.includes('stone  ${have} / ${need}  light'), 'the stone counter is the light you carry over the light it wants');
  assert(SRC.includes('a shine left') && SRC.includes('light toward the next'), 'the legend names the stars and the seeds');
  assert(SRC.includes('reach:52'), "Gruff's line waits until you stand by him");
  assert(SRC.includes('noteLayout') && SRC.includes('blurPauseAt'), 'a blur pause closes if a resize follows');
  assert(SRC.includes('P.coy=P.ground?0.1:P.coy-dt') && SRC.includes('P.buf=inp.jp?0.13:P.buf-dt'), 'coyote time and the jump buffer are unchanged');
  assert(SRC.includes('m.got=s.got[i]') && SRC.includes('P.light=s.light'), 'a death still restores checkpoint light and puts motes back');
}

async function boot(browser, gameFile){
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(String(err.message || err)));
  page.on('console', msg => { if(msg.type()==='error') errors.push('console: '+msg.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/?mute&lowres`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { page, errors };
}

async function browserChecks(browser){
  console.log('canvas (src/game.js)');
  const { page, errors } = await boot(browser, 'src/game.js');
  await page.waitForFunction(() => window.fantorTest && window.FANTOR && window.FANTOR.state !== 'loading', { timeout: 30000 });
  assert(errors.length === 0, 'no page errors while loading ('+(errors[0] || 'none')+')');

  const logic = await page.evaluate(() => {
    const T = window.fantorTest;
    const out = [];
    const phrase = T.deathListLine([{ai:0,why:'hit'},{ai:0,why:'fall'},{ai:1,why:'hit'}]);
    out.push(['land I hit is passive', phrase.startsWith('1. I was struck') && !phrase.includes('struck down')]);
    out.push(['later lands stay passive', phrase.includes('3. II was struck')]);
    const pile = T.clusterMarks([
      {i:0,ai:0,x:100,last:false,landL:70,landR:180},
      {i:1,ai:0,x:103,last:false,landL:70,landR:180},
      {i:2,ai:0,x:98,last:true,landL:70,landR:180},
      {i:3,ai:0,x:160,last:false,landL:70,landR:180},
      {i:4,ai:1,x:108,last:false,landL:190,landR:300}
    ], 14);
    out.push(['six-on-a-spot would be one mark', pile.filter(g => g.ai===0 && Math.abs(g.x-100)<=14).length===1 && pile.find(g => Math.abs(g.x-100)<=14).n===3]);
    out.push(['the pile stays on the deaths', Math.abs(pile.find(g => g.n===3).x - 98) < 1 || Math.abs(pile.find(g => g.n===3).x - 100) < 6]);
    out.push(['a death further along stays its own mark', pile.some(g => g.ai===0 && g.n===1 && g.x===160)]);
    out.push(['a nearby mark in the next land is not swallowed', pile.some(g => g.ai===1 && g.n===1 && g.x===108)]);
    out.push(['the pile that holds the last death is the one marked last', pile.find(g => g.n===3).last===true]);
    const shore = T.areas().find(a => a.key==='shore');
    const mid = (shore.gaps[0][0]+shore.gaps[0][1])/2;
    const atGap = T.backdropPlan(shore.imgs, shore.gaps, mid);
    out.push(['first shore pool is a single painting', atGap.inA===0 && atGap.k===0]);
    const later = T.backdropPlan(shore.imgs, shore.gaps, shore.gaps[0][1]+80);
    out.push(['the fade begins only after that pool', later.inA>0 && later.inA<1 && later.k===0]);
    let stable = true, reached = true, muddy = [];
    for(const list of [T.areas(), T.nights()]){
      for(const a of list){
        if(!a.imgs || !a.imgs.length){ stable = false; continue; }
        const end = T.backdropPlan(a.imgs, a.gaps||[], a.len+50);
        if(end.k !== a.imgs.length-1 || end.inA!==0) reached = false;
        for(const g of a.gaps||[]){
          for(let cam=g[0]+8; cam<g[1]-8; cam+=30){
            const p = T.backdropPlan(a.imgs, a.gaps, cam);
            if(p.inA>0.001 && p.inA<0.999){ stable = false; muddy.push(a.key+':'+Math.round(cam)); }
          }
        }
      }
    }
    out.push(['no pool is crossed by a half-faded painting'+(muddy.length?(' '+muddy.slice(0,4).join(',')):''), stable]);
    out.push(['every land still reaches its last painting', reached]);
    const C = T.consts();
    out.push(['exported speeds match v11', C.GRAV===980 && C.JV===362 && C.SPD===142 && C.START_LIVES===3 && C.MAX_LIVES===9]);
    localStorage.setItem('fantor.dmap', JSON.stringify({day:[9,0,0,0,0,0,0,0], night:[0,1,0,0,0,0,0,0], extra:1}));
    localStorage.setItem('fantor.rec', JSON.stringify({day:{runs:5,far:0.2,ai:0,x:800}, note:'kept'}));
    const d = T.dmGet(), r = T.recGet();
    out.push(['an old death map still reads', d.day[0]===9 && d.night[1]===1 && d.day.length===8 && d.night.length===8]);
    out.push(['an old journey record still reads', r.day && r.day.runs===5 && r.day.ai===0 && r.day.x===800]);
    localStorage.setItem('fantor.dmap', JSON.stringify({day:[1]}));
    const repaired = T.dmGet();
    out.push(['a short old map is not read as a partial land list', repaired.day.length===8 && repaired.day.every(v=>v===0) && repaired.night.length===8]);
    // put the reviewer's record back for the run that follows
    localStorage.setItem('fantor.dmap', JSON.stringify({day:[9,0,0,0,0,0,0,0], night:[0,0,0,0,0,0,0,0]}));
    localStorage.setItem('fantor.rec', JSON.stringify({day:{runs:5,far:0.2,ai:0,x:800}}));
    return out;
  });
  for(const [msg, ok] of logic) assert(ok, msg);

  await page.focus('canvas#game');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.FANTOR.state==='play', { timeout: 10000 });
  const begun = await page.evaluate(() => {
    const lives = window.fantorDebug.state().lives;
    const rec = window.fantorTest.recGet();
    const map = window.fantorTest.dmGet();
    return { lives, runs: rec.day && rec.day.runs, map0: map.day[0], ember: !!window.FANTOR.ember };
  });
  assert(begun.lives===3 && begun.ember===false, 'a journey still starts with 3 lives (got '+begun.lives+')');
  assert(begun.runs===6, 'starting a journey still counts it (5 kept, now '+begun.runs+')');
  assert(begun.map0===9, 'starting a journey does not touch the death map (land I still 9)');

  await page.close();

  // phone: the existing card tap, with the play buttons out of the way
  console.log('phone card');
  const phonePage = await browser.newPage();
  await phonePage.setViewport({ width:844, height:390, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  await phonePage.goto(`http://127.0.0.1:${PORT}/?mute&lowres`, { waitUntil:'domcontentloaded', timeout:60000 });
  await phonePage.waitForFunction(() => window.FANTOR && window.FANTOR.state!=='loading', { timeout:30000 });
  await phonePage.evaluate(() => {
    const g = window.FANTOR;
    g.state = 'gameover'; g.goT = 4; g.goArea = 0; g.night = false; g.ember = false; g.runNo = 6;
    g.deaths = [770,772,768,775,771,769].map((x,i) => ({ai:0,x,why:i%2?'hit':'fall',sec:0,boss:null}));
    g.stats = { motes:12, calmed:0, bosses:0, lost:6, given:0, shrines:0, time:420 };
    g.prevRec = { far:0.1, ai:0, x:700 }; g.runFar = 0.12; g.cardN = 0; g.cardMsg = 0; g.cardT = 0;
    window.dispatchEvent(new Event('touchstart'));
  });
  await new Promise(r => setTimeout(r, 250));
  const phone = await phonePage.evaluate(() => {
    const cv = document.getElementById('game');
    const r = cv.getBoundingClientRect();
    const gx = 800, gy = 460; // inside the card zone (x>614, y>430)
    const px = r.left + gx/854*r.width, py = r.top + gy/480*r.height;
    const el = document.elementFromPoint(px, py);
    const touchOn = document.getElementById('touch').classList.contains('on');
    return {
      label: window.fantorTest.cardLabel(),
      zone: window.fantorTest.cardZone(gx, gy),
      outside: window.fantorTest.cardZone(200, 200),
      el: el && (el.id || el.tagName),
      touchOn, px, py
    };
  });
  assert(phone.label==='tap here: keep this card', 'phone prompt is the existing tap line, not a second control');
  assert(phone.zone===true && phone.outside===false, 'the tap target is the bottom-right of the card');
  assert(phone.touchOn===false, 'play buttons are hidden on the end card (they were covering the tap)');
  assert(phone.el==='game', 'the card tap lands on the canvas (hit '+(phone.el)+')');
  await phonePage.mouse.click(phone.px, phone.py);
  await new Promise(r => setTimeout(r, 300));
  const afterCard = await phonePage.evaluate(() => ({ state: window.FANTOR.state, n: window.FANTOR.cardN|0, label: window.fantorTest.cardLabel() }));
  assert(afterCard.state==='gameover' && afterCard.n>=1, 'the tap keeps the card and does not start a new journey (state '+afterCard.state+', cards '+afterCard.n+')');
  assert(/card saved|could not save|new tab/.test(afterCard.label), 'the line reports what the tap did');

  // buttons come back once you are playing again
  await phonePage.evaluate(() => { window.FANTOR.state='play'; window.dispatchEvent(new Event('touchstart')); });
  await new Promise(r => setTimeout(r, 200));
  const playing = await phonePage.evaluate(() => document.getElementById('touch').classList.contains('on') && window.FANTOR.state==='play');
  assert(playing, 'the play buttons return while the journey is going');
  await phonePage.close();

  console.log('ember run');
  const ember = await boot(browser, 'src/game.js');
  await ember.page.waitForFunction(() => window.FANTOR && window.FANTOR.state!=='loading', { timeout: 30000 });
  await ember.page.evaluate(() => {
    localStorage.setItem('fantor.rec', JSON.stringify({day:{runs:1,far:1.1,ai:8,x:0}}));
    localStorage.setItem('fantor.dmap', JSON.stringify({day:[2,0,0,0,0,0,0,0],night:[0,0,0,0,0,0,0,0]}));
  });
  await ember.page.reload({ waitUntil:'domcontentloaded' });
  await ember.page.waitForFunction(() => window.FANTOR && window.FANTOR.state==='title', { timeout: 30000 });
  await ember.page.focus('canvas#game');
  await ember.page.keyboard.press('KeyR');
  await ember.page.waitForFunction(() => window.FANTOR.state==='play', { timeout: 10000 });
  const er = await ember.page.evaluate(() => {
    const s = window.fantorDebug.state();
    return { lives:s.lives, ember:!!window.FANTOR.ember, night:!!window.FANTOR.night, map:window.fantorTest.dmGet().day[0], runs:window.fantorTest.recGet().ember && window.fantorTest.recGet().ember.runs };
  });
  assert(er.ember===true && er.night===false && er.lives===1, 'Ember Run is still opt-in, one life, not the Long Night (lives '+er.lives+')');
  assert(er.map===2, 'an Ember Run does not reset the death map');
  assert(er.runs===1, 'an Ember Run keeps its own count of runs begun');
  await ember.page.close();
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function canvasPng(page, file){
  const data = await page.evaluate(() => document.getElementById('game').toDataURL('image/png'));
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
}

async function playChecks(browser){
  console.log('v11.2 play');
  const { page, errors } = await boot(browser);
  await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });
  await page.waitForFunction(() => window.fantorDebug && window.FANTOR && window.FANTOR.state!=='loading', { timeout: 30000 });
  await page.focus('canvas#game');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.FANTOR.state==='play', { timeout: 10000 });
  await sleep(400);

  // Collect motes with the keyboard, then shine. Shore motes at 300, 340, 380.
  await page.evaluate(() => { window.fantorDebug.setLight(0); window.fantorDebug.tp(240); });
  await page.keyboard.down('ArrowRight');
  let got = null;
  for(let i=0;i<50;i++){
    await sleep(40);
    got = await page.evaluate(() => ({ light: window.fantorDebug.state().light, shines: window.fantorTest.shines() }));
    if(got.light>=3) break;
  }
  await page.keyboard.up('ArrowRight');
  assert(got && got.shines>=1, 'walking into motes refills a shine (light '+(got&&got.light)+', shines '+(got&&got.shines)+')');
  const before = got.light;
  await page.keyboard.press('KeyX');
  await sleep(180);
  const shone = await page.evaluate(() => ({ light: window.fantorDebug.state().light, rings: window.fantorDebug.A().rings.length }));
  assert(shone.light===before-3 && shone.rings>0, 'that shine spends 3 of the gathered light ('+before+' -> '+shone.light+', rings '+shone.rings+')');

  // Two light is not a shine. One more mote, gathered by walking, is.
  await page.evaluate(() => {
    const d = window.fantorDebug;
    d.setLight(2); d.tp(250);
    const m = d.A().motes[0];
    m.got=false; m.x=360; m.y=d.A().d.gy(360)-16; m.hide=0; m.born=1; m.ft=0;
  });
  await sleep(900);
  await page.keyboard.press('KeyX');
  await sleep(120);
  const held = await page.evaluate(() => window.fantorDebug.state().light);
  assert(held===2, 'two light does not shine (stayed '+held+')');
  await page.keyboard.down('ArrowRight');
  let third = held;
  for(let i=0;i<40;i++){
    await sleep(40);
    third = await page.evaluate(() => window.fantorDebug.state().light);
    if(third>=3) break;
  }
  await page.keyboard.up('ArrowRight');
  assert(third>=3, 'the next mote completes a shine (light '+third+')');
  await page.keyboard.press('KeyX');
  await sleep(150);
  const again = await page.evaluate(() => window.fantorDebug.state().light);
  assert(again===third-3, 'and that shine spends it ('+third+' -> '+again+')');

  await page.evaluate(() => {
    const d = window.fantorDebug;
    d.setLight(40); d.tp(470);
    const m = d.A().motes[0];
    m.got=false; m.x=500; m.y=d.A().d.gy(500)-16; m.hide=0; m.born=1;
  });
  await page.keyboard.down('ArrowRight');
  await sleep(500);
  await page.keyboard.up('ArrowRight');
  const capped = await page.evaluate(() => window.fantorDebug.state().light);
  assert(capped===40, 'past forty, a mote does not raise the pool (got '+capped+')');

  await page.evaluate(() => window.fantorDebug.setLight(5));
  await sleep(200);
  await canvasPng(page, '/opt/cursor/artifacts/hud-shines.png');
  await page.evaluate(() => window.fantorDebug.setLight(0));
  await sleep(280);
  await canvasPng(page, '/opt/cursor/artifacts/hud-danger.png');
  await page.evaluate(() => window.fantorDebug.setLight(8));

  // Shore walker: a side touch hurts, a landing from a jump does not, and calms it.
  await page.evaluate(() => {
    const d = window.fantorDebug;
    const A = d.A();
    for(const e of A.enemies) if(e.t!=='walker') e.x=-400;
    const w = A.enemies.find(e => e.t==='walker');
    w.calm=false; w.hp=w.hp0; w.x=1180; w.x0=1180; w.r=40; w.y=A.d.gy(1180); w.vx=0;
    for(const m of A.motes) if(Math.abs(m.x-1180)<280) m.got=true;
    d.setLight(10);
    d.tp(1120);
    const P = d.P(); P.vx=0; P.vy=0; P.hurtT=0; P.ground=true;
  });
  await sleep(80);
  const side0 = await page.evaluate(() => window.fantorDebug.state().light);
  await page.keyboard.down('ArrowRight');
  let side = null;
  for(let i=0;i<30;i++){
    await sleep(40);
    side = await page.evaluate(() => {
      const w = window.fantorDebug.A().enemies.find(e => e.t==='walker');
      return { light: window.fantorDebug.state().light, calm: !!w.calm };
    });
    if(side.light<side0) break;
  }
  await page.keyboard.up('ArrowRight');
  assert(side && side.light<side0 && !side.calm, 'walking into the walker still hurts (light '+side0+' -> '+(side&&side.light)+', calm '+!!(side&&side.calm)+')');

  await sleep(1100);
  await page.evaluate(() => {
    const d = window.fantorDebug;
    const w = d.A().enemies.find(e => e.t==='walker');
    w.x=w.x0; w.y=d.A().d.gy(w.x0); w.vx=0;
    d.tp(w.x-8);
    const P = d.P(); P.vx=0; P.vy=0; P.hurtT=0; P.ground=true;
  });
  let stomped = false;
  for(let attempt=0; attempt<8 && !stomped; attempt++){
    await page.evaluate(() => {
      const d = window.fantorDebug;
      const w = d.A().enemies.find(e => e.t==='walker');
      if(w.calm) return;
      w.x=1180; w.x0=1180; w.vx=0; w.y=d.A().d.gy(1180);
      d.tp(1128);
      const P = d.P(); P.vx=0; P.vy=0; P.hurtT=0; P.ground=true; P.inv=0.8;
      d.setLight(8);
    });
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await sleep(420);
    await page.keyboard.up('Space');
    for(let i=0;i<22;i++){
      await sleep(30);
      const s = await page.evaluate(() => {
        const w = window.fantorDebug.A().enemies.find(e => e.t==='walker');
        return { calm: !!w.calm, n: window.FANTOR.log.filter(r => r[0]==='headstomp').length };
      });
      if(s.calm && s.n){ stomped=true; await canvasPng(page, '/opt/cursor/artifacts/stomp-shore.png'); break; }
    }
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Space');
  }
  const hop = await page.evaluate(() => {
    const w = window.fantorDebug.A().enemies.find(e => e.t==='walker');
    return { calm: !!w.calm, light: window.fantorDebug.state().light, n: window.FANTOR.log.filter(r => r[0]==='headstomp').length, vy: window.fantorDebug.P().vy };
  });
  assert(stomped && hop.calm && hop.n>=1, 'a jump landing stomps the Shore walker (calm '+hop.calm+', stomps '+hop.n+')');
  assert(hop.light>=8, 'the stomp did not cost light (landed at '+hop.light+')');

  // Final boss: crouch behind the arena stone and a wave stops. Standing, and crouching in the open, do not.
  await page.evaluate(() => window.fantorDebug.goArea(6));
  await page.waitForFunction(() => window.FANTOR.state==='play' && window.fantorDebug.state().area===6, { timeout: 10000 });
  await sleep(250);
  const pocket = await page.evaluate(() => {
    const d = window.fantorDebug;
    const A = d.A();
    const rock = A.d.solids.find(s => s.cover);
    const B = A.boss;
    d.setLight(9);
    d.tp(rock.x-16);
    const P = d.P(); P.vx=0; P.vy=0; P.ground=true; P.hurtT=0; P.kneel=0;
    B.x=rock.x+rock.w+160; B.st='rest'; B.t=0; B.restT=40; B.iT=1; B.hp=B.max;
    A.shots.length=0;
    return { px: Math.round(P.x), rx: Math.round(rock.x), a0: B.a0, a1: B.a1, h: rock.h };
  });
  assert(pocket.h>=44 && pocket.px>pocket.a0 && pocket.px<pocket.a1, 'the stone stands inside the King of Bell arena');
  await page.keyboard.down('ArrowDown');
  await sleep(280);
  const kneel = await page.evaluate(() => window.fantorDebug.P().kneel);
  assert(kneel>0.12, 'Down crouches (kneel '+kneel.toFixed(2)+')');
  await page.evaluate(() => {
    const A = window.fantorDebug.A();
    const rock = A.d.solids.find(s => s.cover);
    const g = A.d.gy(rock.x+rock.w+30);
    A.shots.push({ x: rock.x+rock.w+80, y: g-12, vx: -260, vy: 0, g: 0, r: 11, k: 'wave', dmg: 2, life: 3, t: 0 });
  });
  await sleep(600);
  const blocked = await page.evaluate(() => {
    const d = window.fantorDebug;
    const rock = d.A().d.solids.find(s => s.cover);
    return { light: d.state().light, chip: rock.chip|0, shots: d.A().shots.length };
  });
  await page.evaluate(() => { window.FANTOR.actT=0; window.FANTOR.areaTitle=0; });
  await sleep(50);
  await canvasPng(page, '/opt/cursor/artifacts/crouch-cover.png');
  assert(blocked.light===9 && blocked.chip>=1 && blocked.shots===0, 'the crouched stone stopped the wave (light '+blocked.light+', chip '+blocked.chip+', left '+blocked.shots+')');

  await page.keyboard.up('ArrowDown');
  await sleep(150);
  await page.evaluate(() => {
    const d = window.fantorDebug;
    const A = d.A();
    const rock = A.d.solids.find(s => s.cover);
    d.setLight(9); d.tp(rock.x-16);
    const P = d.P(); P.vx=0; P.vy=0; P.ground=true; P.hurtT=0; P.kneel=0;
    A.shots.length=0;
    const g = A.d.gy(rock.x+rock.w+30);
    A.shots.push({ x: rock.x+rock.w+80, y: g-12, vx: -260, vy: 0, g: 0, r: 11, k: 'wave', dmg: 2, life: 3, t: 0 });
  });
  await sleep(600);
  const stood = await page.evaluate(() => window.fantorDebug.state().light);
  assert(stood<9, 'standing at the stone does not stop the wave (light '+stood+')');

  await page.evaluate(() => {
    const d = window.fantorDebug;
    const A = d.A();
    const B = A.boss;
    d.setLight(9); d.tp(B.a1-90);
    const P = d.P(); P.vx=0; P.vy=0; P.ground=true; P.hurtT=0; P.kneel=0;
    B.x=B.a0+80; B.st='rest'; B.t=0; B.restT=40;
    A.shots.length=0;
  });
  await page.keyboard.down('ArrowDown');
  await sleep(250);
  await page.evaluate(() => {
    const A = window.fantorDebug.A();
    const P = window.fantorDebug.P();
    const g = A.d.gy(P.x+20);
    A.shots.push({ x: P.x+140, y: g-12, vx: -260, vy: 0, g: 0, r: 11, k: 'wave', dmg: 2, life: 3, t: 0 });
  });
  await sleep(600);
  await page.keyboard.up('ArrowDown');
  const open = await page.evaluate(() => window.fantorDebug.state().light);
  assert(open<9, 'crouching in the open does not stop the wave (light '+open+')');

  await page.close();

  const phone = await browser.newPage();
  await phone.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  phone.on('pageerror', err => errors.push(String(err.message || err)));
  await phone.goto(`http://127.0.0.1:${PORT}/?mute&lowres`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await phone.waitForFunction(() => window.FANTOR && window.FANTOR.state!=='loading', { timeout: 30000 });
  await phone.evaluate(() => window.dispatchEvent(new Event('touchstart')));
  await phone.focus('canvas#game');
  await phone.keyboard.press('Enter');
  await phone.waitForFunction(() => window.FANTOR.state==='play', { timeout: 10000 });
  await sleep(300);
  const lay = await phone.evaluate(() => {
    const box = id => { const b=document.getElementById(id).getBoundingClientRect(); return { x:b.left, y:b.top, r:b.right, b:b.bottom }; };
    const hit = (a,c) => a.x<c.r && a.r>c.x && a.y<c.b && a.b>c.y;
    const cv = document.getElementById('game').getBoundingClientRect();
    const card = { x: cv.left+cv.width*(854-240)/854, y: cv.top+cv.height*(480-50)/480, r: cv.right, b: cv.bottom };
    const bc=box('bc'), bl=box('bl'), br=box('br'), bj=box('bj'), bs=box('bs'), bd=box('bd'), bu=box('bu');
    return {
      walk: hit(bc,bl)||hit(bc,br), right: hit(bc,bj)||hit(bc,bs)||hit(bc,bd)||hit(bc,bu),
      card: hit(bc,card), on: document.getElementById('touch').classList.contains('on')
    };
  });
  assert(lay.on && !lay.walk && !lay.right && !lay.card, 'the crouch button clears the other buttons and the card tap '+JSON.stringify(lay));
  await phone.screenshot({ path: '/opt/cursor/artifacts/phone-controls.png' });
  assert(errors.length===0, 'no page errors during play ('+(errors[0]||'none')+')');
  await phone.close();
}

async function prodChecks(browser){
  console.log('built game.js');
  useSource = false;
  const built = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  assert(!built.includes('fantorDebug') && !built.includes('fantorTest'), 'the shipped file has no debug hooks');
  assert(!built.includes("Q.has('auto')") && !built.includes('has("auto")'), 'the shipped file has no autopilot switch');
  assert(built.includes('was struck') && !built.includes('struck down'), 'the shipped card says "was struck"');
  assert(built.includes('lights out') && !built.includes('all journeys'), 'the shipped strip says "lights out"');
  assert(built.includes('v11.3') && !built.includes('v11.2'), 'the shipped build is marked v11.3');
  const { page, errors } = await boot(browser, 'game.js');
  await page.waitForFunction(() => {
    const c = document.getElementById('game');
    const g = c.getContext('2d').getImageData(400, 180, 1, 1).data;
    return g[0]+g[1]+g[2] > 30;
  }, { timeout: 30000 });
  assert(errors.length===0, 'the shipped build reaches the title with no errors ('+(errors[0]||'none')+')');
  assert(await page.evaluate(() => window.fantorDebug===undefined && window.fantorTest===undefined), 'debug objects are absent on the title');
  await page.close();
}

async function clarityChecks(browser){
  console.log('v11.3 clarity');
  const { page, errors } = await boot(browser);
  await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });
  await page.waitForFunction(() => window.fantorDebug && window.FANTOR && window.FANTOR.state!=='loading', { timeout: 30000 });
  await page.focus('canvas#game');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.FANTOR.state==='play', { timeout: 10000 });
  const opened = await page.evaluate(() => ({
    title: window.FANTOR.titleDur, lives: window.FANTOR.lives,
    low: window.fantorTest.subBox(1, false), high: window.fantorTest.subBox(2, true)
  }));
  assert(opened.title===4 && opened.lives===3, 'the first land card is still 4s and the journey still starts with 3 lives');
  assert(opened.low.bottom>420 && opened.high.bottom<=372 && opened.high.bottom<392, 'a lifted subtitle ends above the ledge (bottom '+opened.high.bottom+')');

  await page.evaluate(() => {
    const d = window.fantorDebug, P = d.P(), A = d.A();
    P.x = 180; P.vx = 0; P.vy = 0; P.y = A.d.gy(180); P.ground = true;
  });
  await sleep(200);
  const early = await page.evaluate(() => window.fantorTest.folk().find(f => f.name==='Gruff'));
  assert(early && !early.said && early.reach===52, 'Gruff does not speak before you reach him');
  await page.evaluate(() => {
    const d = window.fantorDebug, P = d.P();
    P.x = 208; P.vx = 0; P.y = d.A().d.gy(208); P.ground = true;
  });
  await sleep(250);
  const byHim = await page.evaluate(() => ({ folk: window.fantorTest.folk().find(f => f.name==='Gruff'), heard: window.fantorTest.heard().includes('n01') }));
  assert(byHim.folk && byHim.folk.said && byHim.heard, 'Gruff speaks once you are standing by him');

  await page.evaluate(() => {
    const d = window.fantorDebug, P = d.P();
    P.x = 450; P.vx = 0; P.y = d.A().d.gy(450); P.ground = true;
  });
  await sleep(120);
  const hint = await page.evaluate(() => window.fantorTest.hint());
  assert(hint && hint.key==='lives' && hint.wait==='jump', 'the jump hint waits until the lives hint is done ('+JSON.stringify(hint)+')');

  await page.evaluate(() => window.fantorDebug.tp(700));
  await sleep(400);
  const pit = await page.evaluate(() => ({ lift: window.fantorTest.subLift(), box: window.fantorTest.subBox(2, window.fantorTest.subLift()) }));
  assert(pit.lift && pit.box.bottom<=372, 'the first pit lifts the subtitle above the water (bottom '+pit.box.bottom+')');

  await page.evaluate(() => { const d=window.fantorDebug; d.tp(490); const P=d.P(); P.vx=0; P.ground=true; P.y=d.A().d.gy(490); });
  await sleep(80);
  await page.keyboard.down('ArrowRight');
  let bumps = 0;
  for(let i=0;i<25;i++){
    await sleep(40);
    bumps = await page.evaluate(() => window.FANTOR.log.filter(r => r[0]==='bump').length);
    if(bumps>0) break;
  }
  await page.keyboard.up('ArrowRight');
  const bumped = await page.evaluate(() => ({ n: window.FANTOR.log.filter(r => r[0]==='bump').length, pose: window.fantorDebug.P().bumpT>0 || window.FANTOR.log.some(r => r[0]==='bump') }));
  assert(bumped.n>=1, 'walking into the shore rock bumps ('+bumped.n+')');

  await page.evaluate(() => window.fantorDebug.goArea(7));
  await page.waitForFunction(() => window.FANTOR.state==='play' && window.fantorDebug.state().area===7, { timeout: 10000 });
  await sleep(300);
  assert(await page.evaluate(() => window.fantorTest.subLift()===false), 'Dusk has no pit, so the subtitle stays low');

  await page.evaluate(() => window.fantorDebug.goArea(1));
  await page.waitForFunction(() => window.FANTOR.state==='play' && window.fantorDebug.state().area===1, { timeout: 10000 });
  await page.evaluate(() => {
    const g = window.fantorDebug.A().d.gaps[0];
    window.fantorDebug.tp(g[0]-30);
    window.fantorDebug.P().ground = true;
  });
  await sleep(400);
  assert(await page.evaluate(() => window.fantorTest.subLift()===true), 'a forest pit lifts the subtitle too');

  const heardBefore = await page.evaluate(() => window.fantorTest.heard().includes('01'));
  assert(heardBefore, 'the opening line was heard on the first run');
  await page.evaluate(() => { window.FANTOR.state='gameover'; window.FANTOR.goArea=0; window.FANTOR.goT=-4; });
  await page.focus('canvas#game');
  await page.keyboard.press('Enter');
  await sleep(80);
  assert(await page.evaluate(() => window.FANTOR.state==='gameover'), 'game over ignores a key in the first second');
  await page.evaluate(() => { window.FANTOR.goT=1.05; });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.FANTOR.state==='play', { timeout: 10000 });
  const retry = await page.evaluate(() => ({
    title: window.FANTOR.titleDur, lives: window.FANTOR.lives,
    heard: window.fantorTest.heard().includes('01'),
    queued: window.fantorTest.queue().includes('01'),
    ember: !!window.FANTOR.ember
  }));
  assert(retry.title===1.8 && retry.lives===3 && retry.ember===false, 'a retry shortens the land card and still gives 3 lives (card '+retry.title+', lives '+retry.lives+')');
  assert(retry.heard && !retry.queued, 'the opening line does not play again on the retry');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(40);
  assert(await page.evaluate(() => window.fantorDebug.state().menu===true), 'leaving the window pauses');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(40);
  assert(await page.evaluate(() => window.fantorDebug.state().menu===false), 'a resize just after the blur closes that pause');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(700);
  assert(await page.evaluate(() => window.fantorDebug.state().menu===true), 'a blur with no resize stays paused');
  assert(errors.length===0, 'no page errors in the clarity checks ('+(errors[0]||'none')+')');
  await page.close();
}

(async () => {
  sourceChecks();
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox','--disable-gpu']
  });
  try {
    await browserChecks(browser);
    await playChecks(browser);
    await clarityChecks(browser);
    await prodChecks(browser);
  } finally {
    await browser.close();
    server.close();
  }
  if(failed){ console.error('\n'+failed+' failed'); process.exit(1); }
  console.log('\nall checks passed');
})().catch(err => { console.error(err); process.exit(1); });
