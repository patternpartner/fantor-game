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

async function prodChecks(browser){
  console.log('built game.js');
  useSource = false;
  const built = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  assert(!built.includes('fantorDebug') && !built.includes('fantorTest'), 'the shipped file has no debug hooks');
  assert(!built.includes("Q.has('auto')") && !built.includes('has("auto")'), 'the shipped file has no autopilot switch');
  assert(built.includes('was struck') && !built.includes('struck down'), 'the shipped card says "was struck"');
  assert(built.includes('lights out') && !built.includes('all journeys'), 'the shipped strip says "lights out"');
  assert(built.includes('v11.1'), 'the shipped build is marked v11.1');
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
    await prodChecks(browser);
  } finally {
    await browser.close();
    server.close();
  }
  if(failed){ console.error('\n'+failed+' failed'); process.exit(1); }
  console.log('\nall checks passed');
})().catch(err => { console.error(err); process.exit(1); });
