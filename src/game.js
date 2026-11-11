/* FANTOR · The Wanderer's Light  (v12.1)
   A small side-scrolling journey through the AI-generated art of "The Road to Fantor",
   with characters cut from Eh AyeC's Fantor collections on Fine Art America.
   Canvas 2D and WebAudio, plus a WebGL2 compositor (WebGL1 where that is all the
   browser has). No WebGL, a lost context, or Classic in the menu: the canvas path.
   No dependencies.
   Source of the build: this file. tools/build.js writes the minified game.js. */
'use strict';
(function(){
const W=854, H=480;                       // VHS-ish 480 lines
const cv=document.getElementById('game');
let cx=cv.getContext('2d');
const gameCx=cx;
const playCv=document.createElement('canvas'); playCv.width=W; playCv.height=H;
const playCx=playCv.getContext('2d',{alpha:true});
const hud=document.getElementById('hud'), hx=hud.getContext('2d');
let pen=cx; // text and the HUD overlay. The world keeps drawing on cx.
const Q=new URLSearchParams(location.search);
const perfOn=Q.has('perf');
/*@DEV*/const AUTO=Q.has('auto'), DEBUG=Q.has('debug'), START_AREA=+(Q.get('area')||0), MUTE=Q.has('mute');
let GOD=Q.has('god');            // debug invincibility (used by the autopilot tests)
/*@/DEV*/
/*@PROD const AUTO=false, DEBUG=false, START_AREA=0, MUTE=Q.has('mute'); let GOD=false; @PROD*/
const DEATH_T=1.0; // v4: death to retry in about a second (was 1.8)
const SHINE_COST=3, SHINE_CD=0.8, START_LIVES=3, LIFE_MOTES=50, MAX_LIVES=9, LIGHT_CAP=40;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, sm=t=>t*t*(3-2*t);
function rngf(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

/* ---------------- layout / resize ---------------- */
let RS=1, artOn=false, vigRS=-1, rsDrop=0, autoTier=1, glState='init', glFailed=false, glImgTex=null, glPara=0; // backing-store scale. 1920 paintings are used when this is 1.5 or 2.
// Auto may step the backing store 2 → 1.5 → 1.25 → 1 before it steps the effect tier. rsDrop is only raised while Auto is on.
function chooseRS(){
  const vw=Math.max(1,innerWidth), vh=Math.max(1,innerHeight), s=Math.min(vw/W,vh/H);
  const want=s*(window.devicePixelRatio||1);
  let rs=Q.has('lowres')?1:want>1.75?2:want>1.2?1.5:1;
  if(!Q.has('lowres')&&rsDrop>0){ const ladder=rs>=2?[2,1.5,1.25,1]:rs>=1.5?[1.5,1.25,1]:[rs]; rs=ladder[Math.min(rsDrop,ladder.length-1)]; }
  return rs;
}
function fit(){const vw=Math.max(1,innerWidth), vh=Math.max(1,innerHeight), s=Math.min(vw/W,vh/H);
  const cssW=Math.floor(W*s), cssH=Math.floor(H*s);
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  if(hud){ hud.style.width=cssW+'px'; hud.style.height=cssH+'px';
    const dpr=window.devicePixelRatio||1, hw=Math.max(1,Math.round(cssW*dpr)), hh=Math.max(1,Math.round(cssH*dpr));
    if(hud.width!==hw||hud.height!==hh){ hud.width=hw; hud.height=hh; } }
  const rs=chooseRS();
  if(rs!==RS||cv.width!==Math.round(W*rs)){ RS=rs; cv.width=Math.round(W*RS); cv.height=Math.round(H*RS); vigRS=-1; if(artOn) syncArt(); }}
addEventListener('resize',()=>{ fit(); noteLayout(); }); fit();
if(Q.has('classic')||Q.has('nowebgl')) glState='classic';
function base(){ cx.setTransform(RS,0,0,RS,0,0); }
function hudPrepare(){ if(!hud) return; hx.setTransform(hud.width/W,0,0,hud.height/H,0,0); hx.globalAlpha=1; hx.globalCompositeOperation='source-over'; hx.clearRect(0,0,W,H); }

/* ---------------- text ---------------- */
const LINES={
 '01':'Every hundred years, the sea gives Fantor a light.',
 '02':'This time, it came wearing a cloak.',
 '03':'It walked out of the waves, and it did not stop walking.',
 '05':'It did not know where it was going. Only that it was expected.',
 '06':'The rivers knew the way.',
 '07':'And there, beyond the trees, the kingdom waited.',
 '08':'Fantor. Golden. Ancient… and afraid.',
 '09':'Word spread faster than the river. A light had come.',
 '10':'And every army in the land wanted it for their own.',
 '11':'The Frygars sharpened their blades.',
 '13':'The first fire was lit.',
 '15':'And the old things in the dark woke up, to watch.',
 '16':'Through all of it, the wanderer kept walking.',
 '17':'At the heart of the kingdom, it found an empty throne. Of light…',
 '18':'…and understood. They were not fighting over the light. They were fighting over who would hold it.',
 '19':'So it did the one thing no king ever had.',
 '20':'It let go.',
 '21':'It gave the light away. To everyone.',
 '22':'Fantor still glows at dusk.',
 '23':"That's how you know it came.",
 'g01':'It gathered the little lights as it went, the way you would gather shells.',
 'g02':'The trees bent toward it, as if they remembered the last one.',
 'g03':'Some of them had not seen a light in a very long time.',
 'g04':'Even the dark, it turned out, only wanted to be warm.',
 'g05':'Here, the dark drank light. It would need every spark.',
 'g06':'It sat. And for a moment, it understood why kings are so lonely.',
 'g07':'Then it stood up again.',
 'g08':'Its light was nearly gone. It kept walking anyway.',
 'g09':'The stones of Fantor had been waiting a hundred years to hear it.',
 'g10':'The river does not wait. But it always comes back.',
 'd01':'Not yet. The wanderer got up again.',
 'd02':'A little dimmer now… but still walking.',
 'x01':'Fifty little lights. Enough for one more try.',
 'rp1':'Again the wanderer came to the shore. The sea was no longer surprised.',
 'rp2':'Ten times now. The road had begun to know its footsteps.',
 'rp3':'The light had gone out many times. It always came back to the shore.',
 'rp4':'Some journeys are walked once. This one was walked until it was known.',
 'rp5':'The wanderer had fallen here before. It came anyway.',
 'rp6':'This land had seen the light go out ten times. It had not seen it give up.',
 'rp7':'Every land keeps its losses. This one kept many. The light kept walking.',
 'rp8':'One light. Nothing to spare. The wanderer chose it anyway.',
 'go1':'And so the light went out… and the sea took it back. It will come again, from the very beginning.',
 'n01':'Gruff had watched this shore for forty years. “Keep your light,” he said. “Shine when you must… not when you can.”',
 'n02':'Old Whiskers pointed at the holes in the forest floor. “Them that fall,” he said, “start again.”',
 'n03':'A Key Holder waited by the water. “Ride the logs,” she said. “The river never waits.”',
 'n04':'The second Key Holder kept the golden stair. “The Doig is waking,” he warned. “Strike when it rests.”',
 'n05':'The third Key Holder hid among the tents. “Mind the fire vents. They breathe… and then they rest.”',
 'n06':'The last Key Holder smiled in the dark. “Stay near the braziers,” she said. “Vere is waiting.”',
 'n07':'The Grand Old Mother had seen a hundred lights come and go. “This one,” she said, “will have to fight for its throne.”',
 'b01':"From the waves rose the Smonster, who believed the sea's gift was his.",
 'b02':'Yogi Yogs had sat among the bent trees since before the trees were bent.',
 'b03':'Over the river hung the Battle Armour. A war that had forgotten how to stop.',
 'b04':'In the square stood the Doig. A god of gold that nobody remembered making.',
 'b05':'Neco, captain of the Frygars, had sworn to carry the light home in a jar.',
 'b06':'And in the deepest dark… Vere opened its eyes.',
 'b07':'Before the throne stood the King of Bell. He had held the light once… and he wanted it back.',
 'bw1':'It did not fight them. It only shone… until they remembered.',
 'bw2':'The King of Bell knelt down. And for the first time in a hundred years, he was not afraid.',
 'e1':'It sank… and for once, the sea gave something back.',
 'e2':'It waited. And this time, the forest waited with it.',
 'e3':'The river remembered every light that ever crossed it.',
 'r1':'In the bent wood, the highest bough keeps a gift… for the one who can stand still.',
 'r2':'Where the river runs widest, stand on the smallest stone… and give your light to the water.',
 'r3':'In the golden city, one chain holds a lantern nobody can see. Light it… and let it lift you.',
 'e4':'The city had kept one light for itself, high above the streets.',
 'r4':'Where the scorch climbs the Frygar wall, stand there empty… and let the fire throw you.',
 'e5':'The fire did not burn it. It only threw it further.',
 'r5':'One of the old things never wakes. Bring it a little fire.',
 'e6':'The old thing opened its eye… and it was warm.',
 'r6':'Before the King of Bell is woken, kneel to him.',
 'e7':'The King did not wake. But somewhere far below, a bell answered.',
 'r7':'Seven lights the sea never counted. Carry them to the very end.',
 'gv1':'And the stone gave back a little of what it was given.',
 'ln1':'Then came the long night. The sea sent the light back… and this time, the dark was waiting for it.',
 'ln2':'And when the long night was over, nobody had to wait a hundred years again. Fantor kept its light burning, and the wanderer could rest.',
 'ne1':'The rock was hollow. The sea had been keeping something in it, all this time.',
 'ne2':'Under the rotten bough, the wind had kept a road of its own.',
 'ne3':'The moon lay on the river… and the river let the wanderer walk on it.',
 'nr1':'In the bent wood, the wind comes up from under one rotten branch. Come down on it, like a falling star.',
 'nr2':'Where the moon lies on the silver river, run along the road it makes.',
 'nr3':'Three lights the night had kept. Carry them to the bench.',
 'nx1':'And the three lights the night had kept went home too. In Fantor, after that, the nights were never quite so long.',
 'sx1':'And the seven lost lights went home with it… so that the next one, a hundred years from now, would not have to walk alone.'
};

/* ---------------- settings ---------------- */
const SET={music:0.8,voice:1,sfx:0.8,timer:0,gfx:0,depth:1,gv:1}; // gfx: 0 auto, 1 ultra, 2 high, 3 light, 4 classic. depth 1: layers (and, on GL, per-pixel parallax). gv marks a v12.1 save.
try{ const j=JSON.parse(localStorage.getItem('fantor.settings')||'null'); if(j){ if(!(j.gv>0)&&j.gfx===2) j.gfx=3; // a save from before five tiers stored Light as 2
  for(const k in SET) if(k!=='gv'&&typeof j[k]==='number'&&j[k]>=0&&j[k]<=(k==='gfx'?4:k==='depth'?1:1)) SET[k]=(k==='gfx'||k==='depth')?j[k]|0:j[k]; } }catch(_){}
if(Q.has('flat')) SET.depth=0;
function saveSettings(){ try{ localStorage.setItem('fantor.settings',JSON.stringify(SET)); }catch(_){} }
function applyVolumes(){ if(!ac) return; voG.gain.value=1.0*SET.voice; sfxG.gain.value=0.5*SET.sfx; }

/* ---------------- audio ---------------- */
const AC=window.AudioContext||window.webkitAudioContext;
let ac=null, master, musG, voG, sfxG, recDest=null, musF=null, musPk=null, a2Mix=false, duckK=0, hbT=0;
const bufs={}, raw={};
function audioInit(){
  if(ac) { if(ac.state==='suspended'&&!menuOpen) ac.resume(); return; }
  try{ ac=new AC(); }catch(e){ return; }
  const comp=ac.createDynamicsCompressor(); comp.threshold.value=-10; comp.knee.value=6; comp.ratio.value=8; comp.attack.value=0.004; comp.release.value=0.2; comp.connect(ac.destination);
  master=ac.createGain(); master.gain.value=MUTE?0:0.8; master.connect(comp);
  musG=ac.createGain(); musG.gain.value=0.55*SET.music;
  // v9: the music runs through a tone stage. Act 1 is warm and a little veiled; Act 2 opens up, with more bite, and a slow heartbeat under it
  musF=ac.createBiquadFilter(); musF.type='lowpass'; musF.frequency.value=8500; musF.Q.value=0.5; musPk=ac.createBiquadFilter(); musPk.type='peaking'; musPk.frequency.value=2600; musPk.Q.value=0.8; musPk.gain.value=0;
  musG.connect(musF); musF.connect(musPk); musPk.connect(master);
  voG=ac.createGain(); voG.gain.value=1.0*SET.voice; voG.connect(master);
  sfxG=ac.createGain(); sfxG.gain.value=0.5*SET.sfx; sfxG.connect(master);
  if(Q.has('rec')){ recDest=ac.createMediaStreamDestination(); comp.connect(recDest); }
  noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  for(const k in raw) if(k.startsWith('v_')) decode(k);
  if(A) playMusic(A.d.music,1); else if(game.state==='title') playMusic('title',2);
}
let noiseBuf=null;
function fetchRaw(name,url){ return fetch(url).then(r=>{ if(!r.ok) throw new Error(url); return r.arrayBuffer(); }).then(b=>{ raw[name]=b; if(ac&&name.startsWith('v_')) decode(name); }); }
const decoding={};
function decode(name){
  if(bufs[name]) return Promise.resolve(bufs[name]);
  if(decoding[name]) return decoding[name];
  if(!raw[name]||!ac) return null;
  const copy=raw[name].slice(0);
  decoding[name]=new Promise(res=>{ ac.decodeAudioData(copy,b=>{bufs[name]=b;res(b);},()=>res(null)); });
  return decoding[name];
}
// music: two-slot crossfade
let musCur=null, musName='';
function playMusic(name,fade=2.5){
  if(!ac||name===musName) return; musName=name;
  const go=()=>{
    if(musName!==name) return;
    const b=bufs['m_'+name]; if(!b) return;
    const s=ac.createBufferSource(); s.buffer=b; s.loop=true;
    const g=ac.createGain(); g.gain.value=0; s.playbackRate.value=(game.night?0.9:1)*(A&&A.act===2?1.04:1); s.connect(g); g.connect(musG);
    const t=ac.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(1,t+fade);
    s.start(t);
    if(musCur){ const o=musCur; o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value,t); o.g.gain.linearRampToValueAtTime(0,t+fade); o.s.stop(t+fade+0.1); }
    musCur={s,g,name};
  };
  actMix(!!(A&&A.act===2&&name===A.d.music));
  const p=decode('m_'+name); if(p) p.then(go);
}
function actMix(on){ a2Mix=on; hbT=0; if(!ac||!musF) return; const t=ac.currentTime; musF.frequency.setTargetAtTime(on?16000:8500,t,1.2); musPk.gain.setTargetAtTime(on?2.5:0,t,1.2); }
function heartbeat(dt){ if(!ac||!a2Mix||game.state!=='play'||game.paused||menuOpen||!A) return; const B=A.boss; if(B&&!B.calm&&B.st!=='sleep') return; if(A.shrine&&A.shrine.awake) return;
  hbT-=dt; if(hbT>0) return; hbT=1.7*(game.night?NIGHT_TEMPO:1); const t=ac.currentTime;
  for(const [at,f,v] of [[0,62,0.11],[0.24,54,0.07]]){ const o=ac.createOscillator(), g=ac.createGain(); o.type='sine'; o.frequency.setValueAtTime(f,t+at); o.frequency.exponentialRampToValueAtTime(f*0.62,t+at+0.22); o.connect(g); g.connect(musG); env(g,t+at,0.012,0.3,v); o.start(t+at); o.stop(t+at+0.4); } }
function stopMusic(fade=2){ if(!ac||!musCur) return; const t=ac.currentTime,o=musCur; o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value,t); o.g.gain.linearRampToValueAtTime(0,t+fade); o.s.stop(t+fade+.1); musCur=null; musName=''; }
// narration queue
const vo={queue:[],cur:null,sub:'',subA:0,gap:0,heard:new Set(),lift:false,legend:false};
// Story and ending lines are the payoff. They play again every journey. A skipped heard line still runs its callback.
const AGAIN=new Set(['17','18','19','20','21','22','23','g06','g07','ln2','nx1','sx1','bw2']);
function say(id,opt={}){
  const again=!!(opt.again||AGAIN.has(id));
  const queued=(vo.cur&&vo.cur.id===id)||vo.queue.some(q=>q.id===id);
  // Heard means the line started. A line still waiting can be asked for again after the queue is dropped.
  if(!again && (vo.heard.has(id)||queued)){
    // v11.4: skipping a heard line must not drop the follow-on. A silent entry runs it, with no subtitle.
    if(vo.heard.has(id)&&opt.cb&&!queued) vo.queue.push({id:null,delay:opt.delay||0,cb:opt.cb});
    return;
  }
  vo.queue.push({id,delay:opt.delay||0,cb:opt.cb,x:opt.x,drop:!!opt.drop&&!AGAIN.has(id)});
}
function sayNow(id){ vo.queue.length=0; if(vo.cur){ try{ vo.cur.src&&vo.cur.src.stop(); }catch(_){} const c=vo.cur; vo.cur=null; if(c.cb) c.cb(); } vo.gap=0; vo.queue.unshift({id,delay:0}); }
function voUpdate(dt,now){
  if(vo.cur){ if(now>=vo.cur.end){ const c=vo.cur; vo.cur=null; vo.gap=0.5; if(c.cb) c.cb(); } }
  if(!vo.cur){
    for(let n=0;n<8&&vo.queue.length&&!vo.queue[0].id;n++){
      const q=vo.queue[0];
      if(q.delay>0){ q.delay-=dt; break; }
      vo.queue.shift(); if(q.cb) q.cb();
    }
    const q=vo.queue[0];
    if(q&&!q.id){ /* a silent follow-on is still waiting out its delay */ }
    else if(vo.gap>0) vo.gap-=dt;
    else if(q){
      if(q.drop&&q.x!=null&&A&&P.x>q.x+600){ vo.queue.shift(); game.log.push(['vodrop',q.id,P.x|0]); }
      else if(q.delay>0) q.delay-=dt;
      else { vo.queue.shift(); startLine(q,now); }
    }
  }
  const want=vo.cur?1:0; vo.subA+= (want-vo.subA)*Math.min(1,dt*(want?6:2.5));
  duckK=Math.max(0,duckK-dt*1.2); heartbeat(dt);
  if(ac&&musG){ const target=(vo.cur?0.30:0.55)*SET.music*(1-duckK); musG.gain.setTargetAtTime(target,ac.currentTime,duckK>0?0.05:0.25); } // v9: the music ducks under a hit or a stone waking, so they land
}
function startLine(q,now){
  if(!q||!q.id){ if(q&&q.cb) q.cb(); return; }
  vo.heard.add(q.id); // v11.4: only a line that starts is heard. A discarded queue does not burn it.
  const b=bufs['v_'+q.id]; let dur=2.5+(LINES[q.id]||'').length*0.06;
  let src=null; if(ac&&b){ const s=ac.createBufferSource(); s.buffer=b; s.connect(voG); s.start(); dur=b.duration+0.2; src=s; }
  vo.lift=subLift(); vo.legend=game.legendT>0; // v11.4: the box is placed once, for what is just ahead
  vo.cur={id:q.id,end:now+dur,cb:q.cb,src}; vo.sub=LINES[q.id]||'';
  game.log.push(['vo',q.id,+now.toFixed(1),P.x|0]);
}
// synth sfx
function env(g,t,a,d,peak){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
function tone(f,dur=0.6,type='sine',vol=0.25,at=0,pan=0){ if(!ac) return; const t=ac.currentTime+at; const o=ac.createOscillator(), g=ac.createGain(); o.type=type; o.frequency.value=f;
  if(ac.createStereoPanner){ const p=ac.createStereoPanner(); p.pan.value=pan; g.connect(p); p.connect(sfxG);} else g.connect(sfxG);
  o.connect(g); env(g,t,0.01,dur,vol); o.start(t); o.stop(t+dur+0.05); }
function noise(dur,f0,f1,vol=0.2,q=1.2,at=0){ if(!ac||!noiseBuf) return; const t=ac.currentTime+at; const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
  const bq=ac.createBiquadFilter(); bq.type='bandpass'; bq.Q.value=q; bq.frequency.setValueAtTime(f0,t); bq.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=ac.createGain(); s.connect(bq); bq.connect(g); g.connect(sfxG); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+dur*0.3); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.start(t); s.stop(t+dur+0.05); }
const PENTA=[587.3,659.3,740,880,987.8,1174.7,1318.5,1480,1760];
let combo=0, comboT=0;
const sfx={
  mote(){ combo=Math.min(PENTA.length-1,combo+1); comboT=1.2; const f=PENTA[combo]; tone(f,0.5,'sine',0.16,0,(Math.random()-.5)*.6); tone(f*2,0.25,'sine',0.04); },
  jump(){ noise(0.22,500,1600,0.05,0.8); },
  land(){ noise(0.09,300,120,0.06,0.7); },
  step(){ noise(0.07,900,400,0.016,0.9); }, // v9: a little quieter, it repeats the most
  pulse(){ noise(0.9,300,3200,0.12,0.9); tone(220,1.2,'sine',0.12); tone(330,1.4,'sine',0.08,0.05); tone(440,1.6,'triangle',0.04,0.1); },
  fizzle(){ tone(110,0.5,'triangle',0.12); tone(104,0.6,'sine',0.1,0.05); },
  hurt(){ duckK=0.45; tone(70,0.5,'sine',0.35); noise(0.4,800,150,0.12,0.8); tone(98,0.4,'sawtooth',0.03); },
  calm(){ [523.3,659.3,784,1046.5].forEach((f,i)=>tone(f,1.6,'sine',0.07,i*0.07)); },
  shrine(){ duckK=0.5; [146.8,220,293.7,370,440,587.3].forEach((f,i)=>tone(f,3.5,'sine',0.09,i*0.12)); noise(2.5,200,4000,0.06,0.6); },
  lantern(){ tone(1318.5,0.9,'sine',0.08); tone(1975.5,0.6,'sine',0.03,0.04); },
  splash(){ noise(0.8,1800,300,0.18,0.6); },
  veil(){ noise(2.4,150,2500,0.1,0.5); tone(293.7,2.5,'sine',0.06); },
  ember(){ noise(0.25,3000,900,0.06,1.5); },
  death(){ [392,330,262,196,131].forEach((f,i)=>tone(f,0.7,'triangle',0.12,i*0.14)); noise(1.4,1200,100,0.12,0.7); },
  oneup(){ [523.3,659.3,784,1046.5,1318.5,1568].forEach((f,i)=>tone(f,0.35,'square',0.045,i*0.075)); },
  bosshit(){ tone(90,0.6,'sawtooth',0.08); noise(0.5,2000,200,0.14,0.8); tone(440,0.8,'sine',0.08,0.05); },
  throw(){ noise(0.3,600,2400,0.05,1.2); },
  vent(){ noise(1.0,180,900,0.07,0.7); },
  tele(){ tone(150,0.55,'sawtooth',0.035); tone(158,0.55,'sawtooth',0.03,0.02); },
  thud(){ tone(60,0.4,'sine',0.25); noise(0.35,500,90,0.12,0.8); },
  roar(){ noise(1.8,80,700,0.22,0.5); tone(55,1.8,'sawtooth',0.07); tone(82,1.6,'sawtooth',0.04,0.1); },
  gameover(){ [220,207.7,196,174.6,146.8].forEach((f,i)=>tone(f,1.8,'sine',0.11,i*0.45)); },
  waystone(){ tone(880,0.8,'sine',0.07); tone(1318.5,1.1,'sine',0.05,0.08); },
  phase(n){ tone(n===3?65.4:73.4,2.2,'sawtooth',0.09); tone(n===3?98:110,2.0,'sawtooth',0.05,0.08); noise(1.6,60,2400,0.16,0.6); [0,0.18,0.36].forEach((d,i)=>tone([220,277.2,330][i]*(n===3?1.5:1),1.2,'triangle',0.05,0.5+d)); },
  tide(){ noise(1.5,120,900,0.12,0.5); noise(2.2,900,200,0.10,0.6,1.4); },
  rumble(){ noise(1.0,60,260,0.18,0.9); tone(46,1.0,'sawtooth',0.06); },
  flame(){ noise(1.2,2400,500,0.12,0.7); tone(80,0.6,'sawtooth',0.05); },
  horn(){ tone(146.8,0.9,'sawtooth',0.06); tone(220,0.9,'sawtooth',0.04,0.05); tone(146.8,0.7,'sawtooth',0.05,0.5); },
  snuff(){ noise(0.6,1600,180,0.12,0.8); tone(98,0.5,'sine',0.08); },
  decree(){ [523.3,784,1046.5].forEach((f,i)=>tone(f,1.0,'sine',0.06,i*0.05)); },
  pillar(){ noise(0.5,600,5000,0.12,0.6); tone(1568,0.5,'sine',0.05); },
  spear(){ noise(0.25,1200,3600,0.06,2.2); tone(520,0.15,'triangle',0.03); },
  sting(){ tone(1400,0.12,'square',0.025); noise(0.15,4000,2000,0.03,3); },
  shake(){ noise(0.7,180,420,0.05,1.4); },
  inhale(){ noise(0.7,900,200,0.05,0.8); },
  ash(){ noise(1.4,700,90,0.1,0.5); tone(55,1.0,'sine',0.12); },
  // v5
  dash(){ noise(0.22,2400,600,0.09,1.1); tone(330,0.18,'triangle',0.04); },
  adash(){ noise(0.3,900,4200,0.1,1.0); tone(523.3,0.25,'sine',0.06); tone(784,0.3,'sine',0.04,0.05); },
  pull(){ tone(659.3,0.4,'sine',0.06); tone(988,0.5,'sine',0.04,0.06); noise(0.4,600,3000,0.06,1.2); },
  turn(){ tone(1046.5,0.35,'square',0.05); tone(1568,0.5,'sine',0.06,0.04); noise(0.25,5000,1500,0.08,2); },
  stomp(){ noise(0.3,3000,500,0.08,1.4); },
  bounce(){ tone(392,0.3,'sine',0.08); tone(587.3,0.35,'sine',0.06,0.05); },
  bellhit(){ tone(523.3,1.6,'sine',0.09); tone(1046.5,1.2,'sine',0.04); tone(1318.5,0.9,'triangle',0.02); },
  hum(){ tone(98,0.9,'sine',0.08); tone(196,0.9,'sine',0.04); },
  alarm(){ tone(740,0.18,'triangle',0.07); tone(988,0.22,'triangle',0.06,0.16); },
  wash(){ noise(1.1,250,1200,0.07,0.8); },
  tok(){ tone(150,0.16,'sine',0.12); tone(92,0.25,'sine',0.08,0.02); },
  toll(){ tone(130.8,2.6,'sine',0.16); tone(261.6,2.2,'sine',0.08); tone(392,1.6,'triangle',0.03); noise(0.8,300,80,0.08,0.6); },
  creak(){ noise(0.5,320,180,0.06,6); tone(140,0.4,'sawtooth',0.02); },
  crack(){ noise(0.35,1800,300,0.12,1.5); tone(90,0.3,'sine',0.1); },
  thump(){ noise(0.4,200,900,0.12,1.0); tone(70,0.4,'sine',0.14); },
  growl(){ noise(1.1,90,220,0.12,2.5); tone(49,1.1,'sawtooth',0.04); },
  bump(){ noise(0.07,480,160,0.055,1.6); tone(78,0.08,'sine',0.05); }, // v11.4: a small knock when you walk into a rock
  gain(){ [293.7,440,587.3,740,880].forEach((f,i)=>tone(f,2.2,'sine',0.06,i*0.16)); },
  release(){ for(let i=0;i<14;i++) tone(PENTA[i%PENTA.length]*(i>8?2:1),2.2,'sine',0.05,i*0.11,(Math.random()-.5)); noise(5,120,5000,0.12,0.5); },
};

/* ---------------- images ---------------- */
const IMG={};
function loadImg(n){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>{IMG[n]=i;res();}; i.onerror=()=>rej(new Error(n)); i.src='assets/img/'+n+'.webp'; }); }
// Depth-cut layers (g1_manifest.json). One scale, a different par per layer, drawn with the WebP alpha.
// x1–x8 and anything not in the pack keep the band path below. Light and ?lowres keep the 1280 files.
const PACK={}; let manifestReady=false;
function wantLayers(){ return artOn&&manifestReady&&SET.depth!==0&&!Q.has('flat')&&!gfxLite()&&!Q.has('lowres'); }
function wantHi(){ return artOn&&!gfxLite()&&!Q.has('lowres')&&RS>=1.5; }
function baseImg(n){ return (wantHi()&&IMG[n+'@1920'])||IMG[n]; }
function layersReady(n){ const e=PACK[n]; return !!(e&&e.layers.every(L=>IMG[n+'_'+L.id])); }
// parallax bands cut from each painting: the lower parts move faster than the sky. Fallback for Light, flat, and x1–x8.
const bandCache={};
function bands(n){
  const src=baseImg(n); if(!src){ if(!bandCache._blank){ const a=document.createElement('canvas'), b=document.createElement('canvas'); a.width=a.height=b.width=b.height=1; bandCache._blank=[a,b]; } return bandCache._blank; }
  const hi=!!(wantHi()&&IMG[n+'@1920']&&src===IMG[n+'@1920']);
  const key=hi?n+'@1920':n;
  if(bandCache[key]) return bandCache[key];
  const bw=960, bh=540, out=[];
  for(const [top,feather] of [[0.40,0.16],[0.64,0.12]]){
    const c=document.createElement('canvas'); c.width=bw; c.height=bh; const g=c.getContext('2d');
    g.drawImage(src,0,0,bw,bh); g.globalCompositeOperation='destination-in';
    const gr=g.createLinearGradient(0,0,0,bh); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(Math.max(0,top-feather),'rgba(0,0,0,0)'); gr.addColorStop(top,'rgba(0,0,0,1)'); gr.addColorStop(1,'rgba(0,0,0,1)');
    g.fillStyle=gr; g.fillRect(0,0,bw,bh); out.push(c);
  }
  bandCache[key]=out; return out;
}
function dropBands(keep){ for(const k in bandCache){ const base=k.replace('@1920',''); if(!keep.includes(base)) delete bandCache[k]; } }
function artFiles(names){ const files=[]; for(const n of names){ if(PACK[n]&&wantLayers()) for(const L of PACK[n].layers) files.push(n+'_'+L.id); if(PACK[n]&&wantHi()) files.push(n+'@1920'); } return files; }
function dropArt(keep){ const s=new Set(keep); for(const k in IMG) if((k.indexOf('@1920')>0||/_L\d$/.test(k))&&!s.has(k)){ if(glImgTex&&IMG[k]){ const t=glImgTex.get(IMG[k]); if(t&&glAlive()) gl.deleteTexture(t); glImgTex.delete(IMG[k]); } delete IMG[k]; } }
const artLoads={};
function ensureArt(names){
  if(!artOn) return;
  const uniq=[]; for(const n of names) if(n&&uniq.indexOf(n)<0) uniq.push(n);
  dropBands(uniq); const files=artFiles(uniq); dropArt(files);
  for(const f of files) if(!IMG[f]&&!artLoads[f]) artLoads[f]=loadImg(f).then(()=>{ delete artLoads[f]; },()=>{ delete artLoads[f]; });
  for(const n of uniq) if(IMG[n]&&!(wantLayers()&&PACK[n])) bands(n);
  ensureDepth(uniq);
}
// Per-pixel parallax reads the depth maps G1 derived (0 far .. 1 near). Ultra and High only.
const DEPTH={}; const depthLoads={};
function wantDepth(){ if(!artOn||SET.depth===0||Q.has('flat')||Q.has('classic')||Q.has('nowebgl')||glFailed||glState==='classic') return false; const t=activeTier(); return t===1||t===2; }
function ensureDepth(names){
  if(!wantDepth()){ for(const k in DEPTH){ if(glImgTex&&DEPTH[k]){ const t=glImgTex.get(DEPTH[k]); if(t&&glAlive()) gl.deleteTexture(t); glImgTex.delete(DEPTH[k]); } delete DEPTH[k]; } return; }
  const keep=new Set(names);
  for(const k in DEPTH) if(!keep.has(k)){ if(glImgTex&&DEPTH[k]){ const t=glImgTex.get(DEPTH[k]); if(t&&glAlive()) gl.deleteTexture(t); glImgTex.delete(DEPTH[k]); } delete DEPTH[k]; }
  for(const n of names){ if(!PACK[n]||DEPTH[n]||depthLoads[n]) continue; depthLoads[n]=1; const i=new Image();
    i.onload=()=>{ DEPTH[n]=i; delete depthLoads[n]; }; i.onerror=()=>{ delete depthLoads[n]; }; i.src='tools/art/depth/'+n+'_depth.webp'; }
}
function artKeep(){
  const names=[];
  if(game.state==='title'||game.state==='loading') names.push('s01');
  if(game.state==='end') names.push('s23');
  if(game.state==='gameover') names.push('s15');
  if(game.ending) names.push('x4');
  if(game.cine&&game.cine.imgs) for(const n of game.cine.imgs) names.push(n);
  if(A&&A.d) for(const im of A.d.imgs) names.push(im[0]);
  if(game.state==='trans'&&!game.transFn&&game.nextArea!=null){ const d=LAND(game.nextArea); if(d) for(const im of d.imgs) names.push(im[0]); }
  return names;
}
function syncArt(){ if(artOn) ensureArt(artKeep()); }
// characters cut from the artist's own Fantor images (AI-generated, created and curated by the artist) (see CHARACTERS.md)
const SPR={};
const CHR=['gorit','goils','honey','keepaway','illinor','renoy','harms','xon','chroner','smonster','yogi','armour','doig','neco','vere','kingbell','gruff','whiskers','key1','key2','key3','key4','mother'];
function tintCopy(im,col){ const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d'); g.drawImage(im,0,0); g.globalCompositeOperation='source-in'; g.fillStyle=col; g.fillRect(0,0,c.width,c.height); return c; }
function loadSpr(n){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>{ SPR[n]={img:i,white:tintCopy(i,'#fff4d6'),gold:tintCopy(i,'#ffc45a'),ar:i.width/i.height}; if(RIG[n]){ const q=SPR[n]; q.soft=featherCopy(i,0.1); q.goldS=featherCopy(q.gold,0.1); q.whiteS=featherCopy(q.white,0.1); } res(); }; i.onerror=()=>rej(new Error(n)); i.src='assets/img/c_'+n+'.webp'; }); }
// draw a painted cut-out, feet at (x,y), h pixels tall, with code-driven animation
function drawSpr(k,x,y,h,o={}){
  const s=SPR[k]; if(!s) return; const w=h*s.ar; const al=o.alpha===undefined?1:o.alpha; if(al<=0.01) return;
  cx.save(); cx.translate(x,y); if(o.rot) cx.rotate(o.rot); cx.scale((o.flip?-1:1)*(o.sx||1),o.sy||1); cx.globalAlpha=al;
  if(o.glow){ cx.shadowColor=o.glow; cx.shadowBlur=o.glowB||14; }
  cx.drawImage(s.img,-w/2,-h,w,h); cx.shadowBlur=0;
  if(o.gold>0){ cx.globalAlpha=al*Math.min(1,o.gold)*0.75; cx.drawImage(s.gold,-w/2,-h,w,h); }
  if(o.flash>0){ cx.globalAlpha=al*Math.min(1,o.flash); cx.drawImage(s.white,-w/2,-h,w,h); }
  cx.restore();
}

/* ---------------- input ---------------- */
const keys={}, pressed={};
const KEYMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'j',KeyW:'j',Space:'j',KeyZ:'j',KeyX:'s',KeyE:'s',ShiftLeft:'s',ShiftRight:'s',KeyK:'s',KeyC:'c',KeyL:'c',ArrowDown:'d',KeyS:'d',Enter:'ok',KeyP:'p',Escape:'p',KeyN:'n',KeyR:'er',KeyM:'map',KeyG:'card'};
const UPK=new Set(['ArrowUp','KeyW']);
const NOSCROLL=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','PageUp','PageDown','Home','End']);
addEventListener('keydown',e=>{
  if(game.veil){ e.preventDefault(); resumeVeil(); return; }
  if(e.code==='Escape'||e.code==='KeyP'){ e.preventDefault(); if(!e.repeat) toggleMenu(); return; }
  if(e.code==='KeyF'&&!e.repeat&&!menuOpen){ e.preventDefault(); toggleFullscreen(); return; }
  if(menuOpen){ const t=e.target; if(NOSCROLL.has(e.code)&&!(t&&(t.tagName==='INPUT'||t.tagName==='BUTTON'))) e.preventDefault(); return; }
  if(e.code==='KeyG'&&!e.repeat&&(game.state==='end'||game.state==='gameover')){ e.preventDefault(); saveCard(); return; } // v11: in the key event itself, so the download is allowed
  const k=KEYMAP[e.code]; audioInit(); if(NOSCROLL.has(e.code)) e.preventDefault(); if(UPK.has(e.code)) keys.u=true; if(k){ if(!keys[k]) pressed[k]=true; keys[k]=true; e.preventDefault(); } },{capture:true});
addEventListener('keyup',e=>{ if(UPK.has(e.code)) keys.u=false; const k=KEYMAP[e.code]; if(k){ keys[k]=false; if(!menuOpen) e.preventDefault(); } });
// v11.4: itch's fullscreen button sits outside the frame, so the click blurs the game and the pause opens.
// A resize or fullscreen change within 1.5s, and a real size change, is that button: close the menu, keep the pause,
// and wait until the frame has focus again. A tab switch (no size change) leaves the menu up.
let blurPauseAt=0, blurW=0, blurH=0;
function noteLayout(){
  if(!(blurPauseAt && performance.now()-blurPauseAt<1500 && menuOpen)) return;
  const w=Math.max(1,innerWidth), h=Math.max(1,innerHeight);
  const dw=Math.abs(w-blurW)/Math.max(1,blurW), dh=Math.abs(h-blurH)/Math.max(1,blurH);
  if(dw<=0.15 && dh<=0.15) return;
  blurPauseAt=0; menuOpen=false; $('menu').classList.remove('on');
  game.paused=true; game.veil=true; const v=$('veil'); if(v) v.classList.add('on');
  for(const k in keys) keys[k]=false;
}
function resumeVeil(){
  if(!game.veil) return;
  game.veil=false; game.paused=false; blurPauseAt=0;
  const v=$('veil'); if(v) v.classList.remove('on');
  if(ac){ try{ ac.resume(); }catch(_){} }
  audioInit(); try{ cv.focus({preventScroll:true}); }catch(_){}
}
addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; if(game.state==='play'&&!AUTO&&!Q.has('rec')&&!menuOpen&&!game.veil){ blurPauseAt=performance.now(); blurW=innerWidth; blurH=innerHeight; toggleMenu(true); } });
addEventListener('focus',()=>{ if(game.veil) resumeVeil(); });
// itch.io runs the game in an iframe: take keyboard focus when clicked
try{ cv.tabIndex=0; window.focus(); cv.focus({preventScroll:true}); }catch(_){}
addEventListener('pointerdown',e=>{ if(game.veil){ resumeVeil(); return; } if(!menuOpen) try{ cv.focus({preventScroll:true}); }catch(_){} });
/* fullscreen + pause/settings menu (DOM, so sliders and buttons work with mouse, touch and keyboard) */
const fsEl=document.documentElement;
function fsOn(){ return !!(document.fullscreenElement||document.webkitFullscreenElement); }
function toggleFullscreen(){ try{ if(fsOn()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); } else { const f=fsEl.requestFullscreen||fsEl.webkitRequestFullscreen; if(f){ const p=f.call(fsEl); if(p&&p.catch) p.catch(()=>{}); } } }catch(_){} }
const fsOK=!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
let menuOpen=false;
const $=id=>document.getElementById(id);
function toggleMenu(force){
  const open=force===undefined?!menuOpen:force; if(open===menuOpen) return; menuOpen=open;
  $('menu').classList.toggle('on',open); game.paused=open; for(const k in keys) keys[k]=false;
  if(ac){ try{ if(open) ac.suspend(); else ac.resume(); }catch(_){} }
  if(open){ $('m_timer').checked=!!SET.timer; $('m_gfx').value=String(SET.gfx|0); if($('m_depth')) $('m_depth').value=String(SET.depth?1:0); $('m_music').value=Math.round(SET.music*100); $('m_voice').value=Math.round(SET.voice*100); $('m_sfx').value=Math.round(SET.sfx*100); setTimeout(()=>{ try{ $('m_resume').focus({preventScroll:true}); }catch(_){} },0); }
  else { audioInit(); try{ cv.focus({preventScroll:true}); }catch(_){} }
}
for(const k of ['music','voice','sfx']){ const el=$('m_'+k); el.addEventListener('input',()=>{ SET[k]=clamp(+el.value/100,0,1); applyVolumes(); saveSettings(); }); }
$('m_resume').addEventListener('click',()=>toggleMenu(false));
$('m_gfx').addEventListener('change',()=>{ applyGfx(+$('m_gfx').value|0); });
if($('m_depth')) $('m_depth').addEventListener('change',()=>{ SET.depth=+$('m_depth').value|0; saveSettings(); syncArt(); });
$('m_timer').addEventListener('change',()=>{ SET.timer=$('m_timer').checked?1:0; saveSettings(); });
$('m_fs').addEventListener('click',()=>toggleFullscreen());
$('b_menu').addEventListener('click',e=>{ e.stopPropagation(); toggleMenu(); });
$('b_fs').addEventListener('click',e=>{ e.stopPropagation(); toggleFullscreen(); });
for(const id of ['b_menu','b_fs']) $(id).addEventListener('pointerdown',e=>e.stopPropagation());
if(!fsOK){ $('b_fs').style.display='none'; $('m_fs').style.display='none'; }
if(Q.has('rec')||Q.has('clean')) document.body.classList.add('clean');
document.addEventListener('fullscreenchange',()=>{ fit(); noteLayout(); }); document.addEventListener('webkitfullscreenchange',()=>{ fit(); noteLayout(); });
const touchEl=document.getElementById('touch');
let touchMode=false;
function bindBtn(id,k){ const el=document.getElementById(id); const ids=new Set();
  const dn=e=>{ e.preventDefault(); audioInit(); ids.add(e.pointerId); if(!keys[k]) pressed[k]=true; keys[k]=true; el.classList.add('down'); try{el.setPointerCapture(e.pointerId);}catch(_){} };
  const up=e=>{ ids.delete(e.pointerId); if(!ids.size){ keys[k]=false; el.classList.remove('down'); } };
  el.addEventListener('pointerdown',dn); el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); el.addEventListener('lostpointercapture',up); }
bindBtn('bl','l'); bindBtn('br','r'); bindBtn('bj','j'); bindBtn('bs','s'); bindBtn('bu','c'); bindBtn('bd','d'); bindBtn('bc','d'); // v11.4: crouch is Down, on its own button so it is there before the stone-moves appear
// v5: the move buttons only appear once a stone has given the move
let touchMoves=-1; function touchButtons(){ const m=game.moves|0; if(m===touchMoves) return; touchMoves=m; $('bu').style.display=m>=1?'flex':'none'; $('bd').style.display=m>=5?'flex':'none'; }
// on-screen buttons only while playing: on the end card they covered the existing "keep this card" tap
function syncTouch(){ if(!touchEl) return; let play=false, veil=false; try{ play=game.state==='play'||game.state==='trans'; veil=!!game.veil; }catch(_){ play=false; } // phones turn touch on before `game` exists
  touchEl.classList.toggle('on', touchMode&&!menuOpen&&!veil&&play); }
function enableTouch(){ touchMode=true; syncTouch(); }
if(matchMedia('(pointer:coarse)').matches) enableTouch();
addEventListener('touchstart',()=>enableTouch(),{passive:true});
// taps on the canvas (title / end screens)
let tap=null;
cv.addEventListener('pointerdown',e=>{ audioInit(); const r=cv.getBoundingClientRect(); tap={x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}; if(e.pointerType==='touch') enableTouch();
  if(cardZone(tap.x,tap.y)){ tap=null; saveCard(); } });

/* ---------------- areas ---------------- */
const BASE=392;
function makeArea(def){
  const raw=JSON.parse(JSON.stringify(def));
  const a=Object.assign({tides:[],gaps:[],solids:[],plats:[],motes:[],trig:[],enemies:[],lanterns:[],braziers:[],npcs:0,embers:false,drain:0,flats:[],hazards:[],ways:[],folk:[],boss:null,waves:[[12,0.0042,0],[6,0.011,1.3]],
    hang:[],cats:[],eyes:[],bells:[],cold:[],gates:[],secRet:{}},def); a.raw=raw;
  if(a.shrine) a.flats.push([a.shrine.x,140]); a.flats.push([0,200],[a.len,220]);
  for(const g of a.gaps){ a.flats.push([g[0],70],[g[1],70]); }
  for(const t of a.tides) a.flats.push([t.x+t.w/2,t.w/2+60]);
  for(const s of a.solids){ a.flats.push([s.x+s.w/2,s.w/2+40]); }
  for(const h of a.hazards){ a.flats.push([h.x,40]); }
  if(a.boss) a.flats.push([(a.boss.a0+a.boss.a1)/2,(a.boss.a1-a.boss.a0)/2+60]);
  if(a.throne) a.flats.push([a.throne.x,400]); if(a.bench) a.flats.push([a.bench.x,200]);
  a.flatAt=(x)=>{ let f=1; for(const [c,r] of a.flats) { const d=Math.abs(x-c); if(d<r) f=Math.min(f,sm(d/r)); } return f; };
  a.gy=(x)=>{ for(const g of a.gaps) if(x>g[0]&&x<g[1]) return 1e9; if(a.dyn) for(const g of a.dyn) if(x>g[0]&&x<g[1]) return 1e9; for(const t of a.tides) if(x>t.x&&x<t.x+t.w&&tideUp(t)) return 1e9; let y=BASE; const f=a.flatAt(x); for(const [amp,fr,ph] of a.waves) y-=amp*Math.sin(x*fr+ph)*f; return y; };
  return a;
}
// v7: tide flats. The sea comes in over them on a fixed beat: it creeps up for a second (you hear it), then covers them.
function tideK(t){ const per=t.per*(game.night?NIGHT_TEMPO:1); return [((game.t+(t.ph||0))%per+per)%per,per]; }
function tideOn(t){ return t.on*(game.night?NIGHT_TEMPO:1); }
function tideUp(t){ const [k,per]=tideK(t); return k>per-tideOn(t); }
function tideLevel(t){ const [k,per]=tideK(t), on=tideOn(t); if(k>per-on) return k>per-0.45?1-(k-(per-0.45))/0.45*0.7:1; if(k>per-on-1.0) return (k-(per-on-1.0))*0.8; return 0; }
function tideSoon(t){ const [k,per]=tideK(t), on=tideOn(t); return k>per-on?0:per-on-k; }
function row(x0,n,dx,h){ const r=[]; for(let i=0;i<n;i++) r.push([x0+i*dx,h]); return r; }
function arc(x0,n,dx,h0,h1){ const r=[]; for(let i=0;i<n;i++){ const t=n>1?i/(n-1):0; r.push([x0+i*dx,h0+(h1-h0)*Math.sin(t*Math.PI)]); } return r; }
// a raft/log that ferries you across a gap: starts near the left bank and drifts right
function ferry(g0,g1,w,per,k='log'){ const x0=g0+40, mx=(g1-60)-(x0+w); return {x:x0,y:BASE+2,w,k,mx,per}; }

/* v5 "New light": every land after the shore opens new stretches that teach the move its last stone gave.
   ins() opens a stretch of land: everything from x=at onward moves w to the right, and the new pieces
   (written relative to the stretch start) drop into the hole. The v4 layouts are untouched otherwise. */
function ins(d,at,w,s){
  const sh=x=>x>=at?x+w:x, mv=o=>({...o,x:sh(o.x)}), off=o=>({...o,x:o.x+at});
  d.len+=w; d.gaps=(d.gaps||[]).map(g=>[sh(g[0]),sh(g[1])]); d.cold=(d.cold||[]).map(g=>[sh(g[0]),sh(g[1])]); d.gates=(d.gates||[]).map(mv);
  for(const k of ['solids','plats','hazards','enemies','folk','hang','cats','eyes','bells','tides']) d[k]=(d[k]||[]).map(o=>{ const r=mv(o); if(o.ret!==undefined) r.ret=sh(o.ret); return r; });
  d.lanterns=(d.lanterns||[]).map(sh); d.braziers=(d.braziers||[]).map(b=>typeof b==='number'?sh(b):mv(b));
  d.motes=(d.motes||[]).map(m=>[sh(m[0]),...m.slice(1)]); d.trig=(d.trig||[]).map(mv);
  if(d.tiles) d.tiles=d.tiles.map(g=>[sh(g[0]),sh(g[1])]);
  if(d.imgs) d.imgs=d.imgs.map(([n,x])=>[n,x>0?sh(x):x]);
  if(d.boss) d.boss={...d.boss,a0:sh(d.boss.a0),a1:sh(d.boss.a1),x:sh(d.boss.x)};
  for(const k of ['shrine','throne','bench']) if(d[k]) d[k]={...d[k],x:sh(d[k].x)};
  if(d.secretPit) d.secretPit={...d.secretPit,x0:sh(d.secretPit.x0),x1:sh(d.secretPit.x1)};
  if(d.secretStill) d.secretStill={...d.secretStill,plat:sh(d.secretStill.plat)}; if(d.secretShine) d.secretShine={...d.secretShine,plat:sh(d.secretShine.plat)};
  if(d.secretWall) d.secretWall={...d.secretWall,x0:sh(d.secretWall.x0),x1:sh(d.secretWall.x1)}; if(d.secretKneel) d.secretKneel={...d.secretKneel,x0:sh(d.secretKneel.x0),x1:sh(d.secretKneel.x1)};
  if(d.secRet){ const r={}; for(const n in d.secRet) r[n]=sh(d.secRet[n]); d.secRet=r; }
  if(d.act2!==undefined) d.act2=sh(d.act2); if(d.moon) d.moon={...d.moon,x0:sh(d.moon.x0),x1:sh(d.moon.x1)};
  if(s){
    for(const g of s.gaps||[]) d.gaps.push([g[0]+at,g[1]+at]); for(const g of s.cold||[]) d.cold.push([g[0]+at,g[1]+at]);
    for(const k of ['solids','plats','hazards','enemies','hang','cats','eyes','bells','gates','tides']) for(const o of s[k]||[]){ const r=off(o); if(o.ret!==undefined) r.ret=o.ret+at; (d[k]=d[k]||[]).push(r); }
    for(const b of s.braziers||[]) d.braziers.push(typeof b==='number'?b+at:off(b));
    for(const m of s.motes||[]) d.motes.push([m[0]+at,...m.slice(1)]);
    for(const t of s.trig||[]) d.trig.push(off(t));
    if(s.secretWall) d.secretWall={...s.secretWall,x0:s.secretWall.x0+at,x1:s.secretWall.x1+at}; if(s.secretKneel) d.secretKneel={...s.secretKneel,x0:s.secretKneel.x0+at,x1:s.secretKneel.x1+at};
    if(s.secRet) for(const n in s.secRet) (d.secRet=d.secRet||{})[n]=s.secRet[n]+at;
  }
  return d;
}
// apply several stretches, written in the land's original (v4) coordinates
function v5(d,list){ list.sort((a,b)=>b[0]-a[0]); for(const [at,w,s] of list) ins(d,at,w,s); return d; }
/* v6 "The Long Night": every land is two acts. act2 is where Act 2 begins (in the v5 layout), and each land gets one more
   stretch before its boss: a short, dense test of that land's own idea (written in v5 coordinates, like v5's own). */
function v6(d,act2,list){ d.act2=act2; return v5(d,list); }
const ft=(x,h)=>[x,h,'ft']; // a fleeting mote: it fades if you come at it slowly

const AREAS=[
 makeArea(v6({key:'shore',num:'I',title:'The Shore of Wakes',music:'shore',len:3000,dark:0.22,darkCol:'20,10,24',ground:['#4a2f1c','#140b08'],rim:'#f0c080',fg:'shore',
  imgs:[['s01',0],['s02',1000],['s03',1950]],
  gaps:[[760,835],[1560,1635],[1990,2230]],
  solids:[{x:520,w:46,h:26,k:'rock'},{x:1250,w:60,h:30,k:'rock'},{x:1280,w:30,h:54,k:'rock'},{x:2368,w:52,h:30,k:'rock'},{x:2672,w:52,h:30,k:'rock'}],
  plats:[Object.assign(ferry(1990,2230,80,6),{mx:80})], // v9: the log carries you 20 px nearer the far bank (most human-model falls on the shore were just short of it)
  motes:[...row(300,3,40,24),...arc(560,3,50,30,70),[788,62],[812,62], /* v9: the first pit's motes sit over its middle, so they ask for a jump from the edge */...row(1000,3,45,24),...arc(1250,3,40,70,100),...row(1700,3,40,24),...row(2280,3,40,24),[1584,4,'s1'],[1596,-26,'s1'],[1607,-60,'s1k']],
  enemies:[{t:'wisp',x:965},{t:'walker',spr:'gorit',x:1110,r:95,h:74},{t:'flyer',spr:'honey',x:1780,r:150}], // v9: Act 1 brings one new thing at a time (a wisp, then a Gorit, then Hey Honey); Act 2 puts them together
  folk:[{x:250,spr:'gruff',h:86,lift:26,line:'n01',name:'Gruff',reach:52}], // v11.4: his line waits until you stand by him
  boss:{key:'smonster',spr:'smonster',name:'The Smonster',a0:2330,a1:2760,x:2620,hp:5,h:150,spd:34,move:2.4,atks:['arc','charge'],p2:['arc','tide','charge'],n:3,line:'b01'},
  shrine:{x:2850,need:16,lines:['03']}, secretPit:{n:0,x0:1560,x1:1635}, secRet:{0:1700},
  tides:[{x:1385,w:110,per:4.0,on:1.5,ph:0}], // v7: a tide flat the sea covers on a beat
  trig:[{x:40,line:'01',delay:1.2},{x:560,line:'02'},{x:100,hint:'lives',ttl:3.4},{x:400,hint:'jump',ttl:5},{x:860,hint:'shine',ttl:7},{x:2780,hint:'offer',ttl:8}],
 },1660,[
  // v6 Act 2, the conclusion: three pools, a Gorit between the first two (his shove is a fall), a wisp over the third
  [2250,760,{gaps:[[400,475],[630,705]],tides:[{x:95,w:120,per:3.8,on:1.5,ph:0.5}],enemies:[{t:'walker',spr:'gorit',x:300,r:40,h:74},{t:'wisp',x:550}],
    motes:[...row(20,3,30,24),...row(215,2,30,24),[437,72],...row(500,3,35,24),...row(725,2,25,24)]}],
 ])),
 makeArea(v6(v5({key:'forest',num:'II',title:'The Forest of Bent Trees',music:'forest',len:3600,dark:0.42,darkCol:'16,12,8',ground:['#3b2a16','#0f0a05'],rim:'#e8c27a',fg:'forest',
  imgs:[['s04',0],['s05',1600]],waves:[[16,0.0035,0.5],[7,0.012,2]],
  gaps:[[880,955],[1980,2055],[2420,2700]],
  solids:[{x:520,w:70,h:22,k:'root'},{x:1250,w:40,h:30,k:'root'},{x:1730,w:90,h:24,k:'root'}],
  plats:[{x:640,y:BASE-62,w:90,k:'branch'},{x:760,y:BASE-118,w:80,k:'branch'},{x:1450,y:BASE-62,w:110,k:'branch'},{x:1600,y:BASE-118,w:90,k:'branch'},ferry(2420,2700,80,6.5,'branch')],
  hazards:[{k:'drop',x:1130,per:3.2},{k:'drop',x:2270,per:2.8,ph:1.2}],
  motes:[...row(240,3,40,24),...row(655,2,40,92),...row(775,2,35,148),...row(1060,2,42,24),...row(1460,3,35,92),...row(1610,2,40,148),...row(2120,3,40,24),...row(2760,3,40,24)],
  enemies:[{t:'walker',spr:'goils',x:1120,r:110,h:70},{t:'wisp',x:1350},{t:'flyer',spr:'honey',x:1700,r:160},{t:'wisp',x:1900},{t:'walker',spr:'goils',x:2240,r:120,h:70},{t:'flyer',spr:'honey',x:2300,r:140},{t:'wisp',x:2780}],
  folk:[{x:220,spr:'whiskers',h:84,lift:30,line:'n02',name:'Whiskers'}],
  boss:{key:'yogi',spr:'yogi',name:'Yogi Yogs',a0:2900,a1:3330,x:3200,hp:6,h:140,fly:120,spd:70,move:2.0,atks:['aim','rain','aim','summon'],p2:['aim','split','rain','summon','split'],n:3,line:'b02'},
  shrine:{x:3420,need:22,lines:['g02']}, secretStill:{n:1,plat:760,t:4}, secRet:{1:1010},
  trig:[{x:60,line:'05',delay:0.8},{x:120,hint:'move1',ttl:7}],
 },[
  // safe: little lights that fade unless you come at them fast, then an arc of them over a pool
  [400,520,{gaps:[[300,375]],motes:[ft(60,24),ft(95,24),ft(130,24),ft(235,40),ft(285,62),ft(335,72),ft(385,64),ft(435,42)]}],
  // test: two thorn whips that rest together for a breath, a pit too wide to jump; twist: a rotten branch mid-pit
  [2100,1250,{hazards:[{k:'vent',f:'thorn',x:250,per:2.0,on:1.6},{k:'vent',f:'thorn',x:284,per:2.0,on:1.6}],
    gaps:[[480,640],[800,1130]], plats:[{x:942,y:BASE-8,w:66,k:'branch',rot:0.8}],
    motes:[...row(30,3,40,24),...row(360,2,40,24),...arc(500,3,70,60,90),...row(680,2,35,24),[975,50],...row(1170,3,30,24)],
    enemies:[{t:'wisp',x:720}], gates:[{x:480,cost:1},{x:800,cost:2}]}],
 ]),2640,[
  // v6 conclusion: thorn whips on either side of a pit too wide to jump, then a rotten branch in a wider one
  [4610,860,{hazards:[{k:'vent',f:'thorn',x:90,per:2.0,on:1.3},{k:'vent',f:'thorn',x:345,per:2.0,on:1.3,ph:1.0}],gaps:[[150,270],[420,740]],
    plats:[{x:560,y:BASE-8,w:60,k:'branch',rot:0.7}],motes:[...row(10,2,30,24),ft(210,64),...row(285,2,25,24),...row(775,3,28,24)],gates:[{x:150,cost:1},{x:420,cost:2}]}],
 ])),
 makeArea(v6(v5({key:'river',num:'III',title:'The Silver River Road',music:'river',len:3900,dark:0.3,darkCol:'10,16,26',ground:['#3c3a34','#0d0c0b'],rim:'#e9e2c8',fg:'river',
  imgs:[['s06',0],['s07',2400]],waves:[[8,0.004,0],[4,0.013,1]],
  gaps:[[620,800],[1250,1560],[2050,2400],[2750,2825]],
  plats:[{x:682,y:BASE+4,w:56,k:'stone'},{x:1312,y:BASE-8,w:54,k:'stone'},{x:1405,y:BASE-30,w:46,k:'stone'},{x:1490,y:BASE-8,w:46,k:'stone'},
         {x:2110,y:BASE+2,w:100,k:'log',mx:120,per:7}],
  hazards:[{k:'vent',x:1720,per:3.4,on:1.2,f:'water'},{k:'vent',x:2560,per:3.0,on:1.1,ph:1.5,f:'water'}],
  motes:[...row(300,3,45,24),...arc(650,3,55,40,70),...row(1000,3,45,24),...arc(1300,4,70,50,90),...row(1800,2,40,24),...row(2470,3,45,24),...row(2900,3,45,24)],
  enemies:[{t:'walker',spr:'gorit',x:1000,r:120,h:74},{t:'flyer',spr:'honey',x:1150,r:150},{t:'wisp',x:1800},{t:'flyer',spr:'honey',x:2500,r:160},{t:'wisp',x:2650},{t:'walker',spr:'gorit',x:2960,r:90,h:74}],
  folk:[{x:220,spr:'key1',h:84,lift:30,line:'n03',name:'Key Holder'}],
  boss:{key:'armour',spr:'armour',name:'The Battle Armour',a0:3150,a1:3580,x:3450,hp:6,h:130,fly:130,spd:90,move:1.8,atks:['ring','charge','aim'],p2:['ring','dive','charge','aim','dive'],n:3,line:'b03'},
  shrine:{x:3680,need:22,lines:['07']}, secretShine:{n:2,plat:1405}, secRet:{2:1590},
  trig:[{x:60,line:'06',delay:0.8},{x:120,hint:'move2',ttl:7}],
 },[
  // safe: a rock too tall to jump, on dry ground, with the way up drawn in light
  [420,380,{solids:[{x:170,w:56,h:95,k:'rock'}],motes:[[120,56],[148,96],[176,126],[212,126],...row(290,2,40,24)],gates:[{x:170,cost:2}]}],
  // test: a channel with its far bank walled by rock
  [1600,650,{gaps:[[150,290]],solids:[{x:290,w:52,h:90,k:'rock'}],motes:[[185,64],[230,104],[268,122],[316,118],...row(420,3,45,24)],enemies:[{t:'wisp',x:560}],gates:[{x:150,cost:3}]}],
  // twist: stones that sink under you, and one hop too long without the light-dash
  [2450,900,{gaps:[[100,760]],plats:[{x:165,y:BASE-4,w:58,k:'stone',rot:0.55},{x:285,y:BASE-4,w:58,k:'stone',rot:0.55},{x:515,y:BASE-4,w:58,k:'stone',rot:0.55},{x:640,y:BASE-4,w:58,k:'stone',rot:0.55}],
    motes:[[195,50],[315,50],[380,96],[440,104],[545,50],[670,50],...row(800,3,40,24)],gates:[{x:100,cost:2}]}],
 ]),3470,[
  // v6 conclusion: two sinking stones, then a far bank walled too high to reach without the light-dash
  [4800,760,{gaps:[[100,600]],plats:[{x:180,y:BASE-4,w:54,k:'stone',rot:0.5},{x:326,y:BASE-4,w:54,k:'stone',rot:0.5}],solids:[{x:600,w:52,h:90,k:'rock'}],
    motes:[[140,56],[280,80],[480,110],[626,118],...row(690,2,30,24)],gates:[{x:100,cost:3}]}],
 ])),
 makeArea(v6(v5({key:'kingdom',num:'IV',title:'The Golden Kingdom',music:'kingdom',len:4100,dark:0.28,darkCol:'24,14,10',ground:['#5a3a20','#160d06'],rim:'#ffd08a',fg:'kingdom',
  imgs:[['s08',0],['s09',1400],['s10',2800]],waves:[[6,0.004,0],[3,0.015,1]],
  gaps:[[1500,1575],[2350,2650]],
  solids:[{x:700,w:120,h:24,k:'step'},{x:730,w:60,h:48,k:'step'},{x:1800,w:70,h:30,k:'cart'},{x:2900,w:80,h:24,k:'step'},{x:2920,w:40,h:48,k:'step'}],
  plats:[{x:1000,y:BASE-64,w:120,k:'balcony'},{x:1180,y:BASE-120,w:90,k:'balcony'},{x:2150,y:BASE-64,w:110,k:'balcony'},ferry(2350,2650,80,6,'raft')],
  hazards:[{k:'drop',x:1120,per:3.0},{k:'drop',x:2000,per:2.6,ph:0.8},{k:'drop',x:3150,per:2.9,ph:1.7}],
  lanterns:[400,880,1120,1450,1900,2150,2750,3050],
  // secret IV: high above the top balcony, a lantern hangs out of sight. Only its cord shows.
  hang:[{x:1236,y:-34,hidden:1}], secRet:{3:1300},
  motes:[...row(250,3,45,24),...row(1010,3,40,94),...row(1190,2,40,150),...row(1650,3,45,24),...row(2160,3,35,94),...row(2720,3,40,24),...row(3060,2,40,24)],
  npcs:16, enemies:[{t:'guard',spr:'keepaway',x:560,h:84,per:5.0,r:170},{t:'thrower',spr:'illinor',x:1300,h:76},{t:'wisp',x:1700},{t:'walker',spr:'keepaway',x:1950,r:120,h:84},{t:'thrower',spr:'illinor',x:2850,h:76},{t:'wisp',x:3100}],
  folk:[{x:200,spr:'key2',h:84,lift:30,line:'n04',name:'Key Holder'}],
  tiles:[[3340,3395],[3420,3475],[3500,3555],[3645,3700]], boss:{key:'doig',spr:'doig',name:'The Doig',a0:3300,a1:3730,x:3600,hp:7,h:160,spd:0,move:1.6,atks:['ring','rain','wave','arc'],p2:['tiles','ring','rain','tiles','wave','arc'],n:4,line:'b04'},
  shrine:{x:3830,need:20,lines:['g09','10']},
  trig:[{x:60,line:'08',delay:0.8},{x:120,hint:'move3',ttl:7},{x:1350,line:'09'}],
 },[
  // safe: one lit lantern hanging over the street, with light above it
  [300,480,{hang:[{x:240,y:BASE-175,lit:1}],motes:[[196,188],[240,206],[284,188],...row(360,2,40,24)]}],
  // test: a chasm hung with dark lanterns. Light the first and they pass the light along.
  [1700,950,{gaps:[[150,700]],hang:[{x:300,y:BASE-150},{x:455,y:BASE-160},{x:615,y:BASE-150}],motes:[[378,196],[535,200],...row(740,3,40,24)],gates:[{x:150,cost:6}],enemies:[{t:'wisp',x:880}]}],
  // twist: lanterns the wind keeps blowing out, each on its own beat
  [2700,900,{gaps:[[120,665]], /* v9: far bank 15 px nearer the last (windblown) lantern */hang:[{x:260,y:BASE-150,gut:[2.6,1.7,0]},{x:420,y:BASE-160,gut:[2.6,1.7,0.85]},{x:580,y:BASE-150,gut:[2.6,1.7,1.7]}],
    hazards:[{k:'drop',x:760,per:2.6,ph:0.4}],motes:[...row(20,3,30,24),[340,196],[500,200],...row(720,3,40,24)],gates:[{x:120,cost:3}] /* v9: three motes before the gate, so a restart at Act 2 is never left without the light this chasm needs */,enemies:[{t:'walker',spr:'keepaway',x:820,r:60,h:84}]}],
 ]),4130,[
  // v6 conclusion: the wind blows the first lantern; catch it lit, and the chain passes the light on
  [5560,760,{gaps:[[80,640]],hang:[{x:200,y:BASE-150,gut:[2.4,1.5,0]},{x:380,y:BASE-160},{x:560,y:BASE-150}],
    hazards:[{k:'drop',x:700,per:2.6,ph:0.4}],motes:[[290,198],[470,200],...row(655,2,25,24)],gates:[{x:80,cost:4}]}],
 ])),
 makeArea(v6(v5({key:'war',num:'V',title:'The Frygar Camp',music:'war',len:4300,dark:0.4,darkCol:'40,6,4',ground:['#4a1d12','#120504'],rim:'#ff9a5a',fg:'war',
  imgs:[['s11',0],['s12',1100],['s13',2200],['s14',3200]],waves:[[10,0.004,0.3],[5,0.012,2]],
  gaps:[[950,1022],[2050,2125],[2850,3150]],
  solids:[{x:800,w:50,h:30,k:'crate'},{x:1600,w:80,h:26,k:'crate'},{x:1630,w:40,h:50,k:'crate'},{x:2500,w:60,h:32,k:'crate'}],
  plats:[{x:1150,y:BASE-64,w:100,k:'plank'},{x:2250,y:BASE-66,w:110,k:'plank'},ferry(2850,3150,80,6,'plank')],
  hazards:[{k:'vent',x:1350,per:3.0,on:1.0},{k:'vent',x:1880,per:2.6,on:1.0,ph:1.1},{k:'vent',x:2380,per:3.2,on:1.2,ph:0.4},{k:'vent',x:3300,per:2.8,on:1.0,ph:2.0}],
  // twist: a catapult on the far side of the ferry pit (a second one is behind, in the new runway)
  cats:[{x:3240,y:BASE-160,per:3.1,ph:1.55,range:[-640,40]}],
  motes:[...row(250,3,40,24),...row(1160,3,35,94),...row(1420,2,45,24),...arc(1600,3,40,80,110),...row(1930,2,40,24),...row(2260,3,40,96),...row(2650,3,40,24),...row(3220,2,40,24)],
  enemies:[{t:'frygar',x:600,r:120},{t:'frygar',x:1250,r:90},{t:'wisp',x:1500},{t:'frygar',x:1760,r:120},{t:'frygar',x:2350,r:90},{t:'thrower',spr:'illinor',x:2700,h:76},{t:'frygar',x:3280,r:100},{t:'wisp',x:3350}],
  embers:true, folk:[{x:200,spr:'key3',h:84,lift:30,line:'n05',name:'Key Holder'}],
  boss:{key:'neco',spr:'neco',name:'Neco, Captain of the Frygars',a0:3500,a1:3930,x:3800,hp:7,h:120,spd:85,move:1.6,atks:['charge','arc','wave','charge','arc'],p2:['call','charge','arc','wave','charge','arc'],n:3,line:'b05'},
  shrine:{x:4030,need:21,lines:['13']},
  trig:[{x:60,line:'11',delay:0.8},{x:120,hint:'move4',ttl:7}],
 },[
  // safe: open ground under one slow catapult
  [400,650,{cats:[{x:600,y:BASE-150,per:3.4,ph:0,T:1.7,range:[-620,60]}],motes:[...row(100,3,45,24),...row(300,3,45,24),...row(470,2,40,24)]}],
  // test: a vent corridor under a quicker catapult. (secret V: the scorched stretch of wall at its mouth)
  [1750,850,{hazards:[{k:'vent',x:250,per:3.0,on:1.0},{k:'vent',x:420,per:3.0,on:1.0,ph:0.6},{k:'vent',x:590,per:3.0,on:1.0,ph:1.2}],
    cats:[{x:780,y:BASE-160,per:2.6,ph:0.5,range:[-760,40]}], secretWall:{n:4,x0:92,x1:162}, secRet:{4:830},
    motes:[[-150,24],[-110,24],[335,24],[505,24],...row(680,2,40,24)]}],
  // twist runway: a catapult behind the ferry, so the plank is under fire from both sides
  [2800,300,{cats:[{x:120,y:BASE-150,per:3.1,ph:0,range:[60,700]}],motes:[...row(40,2,40,24),...row(200,2,40,24)]}],
 ]),4280,[
  // v6 conclusion: two catapults on one beat, two vents between them, a Frygar at the far one
  [5180,800,{cats:[{x:420,y:BASE-150,per:2.8,ph:0,range:[-460,40]},{x:760,y:BASE-160,per:2.8,ph:1.4,range:[-340,40]}],
    hazards:[{k:'vent',x:200,per:2.8,on:1.0},{k:'vent',x:560,per:2.8,on:1.0,ph:1.4}],enemies:[{t:'frygar',x:640,r:50}],
    motes:[...row(40,3,40,24),...row(290,2,40,24),...row(470,2,30,24),...row(700,2,30,24)]}],
 ])),
 makeArea(v6(v5({key:'dark',num:'VI',title:'Where the Old Things Watch',music:'dark',len:4500,dark:0.9,darkCol:'6,3,6',ground:['#2a1612','#050203'],rim:'#c06040',fg:'dark',
  imgs:[['s15',0],['s16',2200]],waves:[[14,0.0038,1],[6,0.013,0]],
  gaps:[[1150,1310],[2700,2860],[3300,3375]],
  plats:[{x:1200,y:BASE-16,w:60,k:'stone'},{x:2750,y:BASE-22,w:60,k:'stone'}],
  hazards:[{k:'vent',x:1640,per:3.2,on:1.1},{k:'vent',x:2420,per:2.8,on:1.0,ph:1.3}],
  braziers:[700,2000,3150],
  motes:[...row(250,3,40,24),...row(820,3,40,24),...arc(1170,3,60,50,80),...row(1500,3,40,24),...row(2150,3,40,24),...arc(2720,3,60,60,90),...row(3000,3,40,24),...row(3450,2,40,24)],
  enemies:[{t:'stalker',spr:'renoy',x:1000},{t:'spitter',spr:'harms',x:1400,h:60},{t:'wisp',x:1550},{t:'stalker',spr:'renoy',x:1850},{t:'thrower',spr:'xon',x:2300,h:84},{t:'stalker',spr:'renoy',x:2480},{t:'spitter',spr:'harms',x:2950,h:60},{t:'stalker',spr:'renoy',x:3150}],
  drain:4, folk:[{x:200,spr:'key4',h:84,lift:30,line:'n06',name:'Key Holder'}],
  boss:{key:'vere',spr:'vere',name:'Vere',a0:3700,a1:4130,x:4000,hp:7,h:130,fly:110,spd:80,move:1.8,atks:['aim','summon','ring','rain'],p2:['snuff','aim','summon','snuff','ring','rain'],n:4,line:'b06'},
  shrine:{x:4230,need:15,lines:['16']},
  trig:[{x:60,line:'15',delay:0.8},{x:120,hint:'move5',ttl:7},{x:480,line:'g05'}],
 },[
  // safe: a short frost between a brazier and a cold one, with light waiting past it
  [800,450,{cold:[[120,330]],braziers:[{x:380,cold:1}],motes:[...row(410,3,30,24)]}],
  // test: the long cold, one cold brazier to rest at halfway
  [2100,1150,{cold:[[80,1080]],braziers:[{x:540,cold:1}],gaps:[[300,352],[760,812]],motes:[[326,60],[786,60],...row(560,2,40,24),...row(1100,2,40,24)],enemies:[{t:'stalker',spr:'renoy',x:1130}],gates:[{x:80,cost:3}]}],
  // twist: the old things open their eyes over the cold. (secret VI: the one that never opens)
  [3200,1000,{cold:[[0,900]],braziers:[{x:300,cold:1},{x:540,cold:1},{x:780,cold:1}],
    eyes:[{x:180,y:BASE-190,per:5.0,ph:0},{x:420,y:BASE-205,per:5.0,ph:1.6},{x:660,y:BASE-190,per:5.0,ph:3.2},{x:862,y:BASE-118,sleep:1,n:5}], secRet:{5:950},
    motes:[...row(360,2,40,24),...row(600,2,40,24),...row(930,2,30,24)],enemies:[{t:'stalker',spr:'renoy',x:640}]}],
 ]),3700,[
  // v6 conclusion: one more cold, two eyes and a gap in it, one brazier to carry from and one to rest at
  [6150,760,{cold:[[70,700]],braziers:[{x:30,lit:1},{x:380,cold:1}],gaps:[[450,502]],
    eyes:[{x:230,y:BASE-190,per:4.6,ph:0.8},{x:560,y:BASE-200,per:4.6,ph:3.1}],motes:[...row(720,2,20,24)]}],
 ])),
 makeArea(v6(v5({key:'heart',num:'VII',title:'The Heart of Fantor',music:'heart',len:3100,dark:0.12,darkCol:'40,24,6',ground:['#7a5222','#2a1606'],rim:'#fff0b0',fg:'heart',
  imgs:[['s17',0],['s18',1300],['s19',2300]],waves:[[5,0.004,0],[3,0.012,0]],
  gaps:[[1300,1375]],
  solids:[{x:2050,w:44,h:50,k:'rock',cover:1},{x:2420,w:320,h:26,k:'gold'},{x:2470,w:270,h:52,k:'gold'},{x:2520,w:220,h:78,k:'gold'},{x:2570,w:170,h:104,k:'gold'}], // v11.4: one stone in the King of Bell's arena. Crouch in its lee. It takes a few blows, then it is spent.
  plats:[{x:700,y:BASE-64,w:100,k:'shard'},{x:880,y:BASE-120,w:90,k:'shard'},{x:1500,y:BASE-30,w:80,k:'shard',my:110,per:5}],
  motes:[...row(200,4,40,24),...row(710,3,35,94),...row(890,3,30,150),...row(1100,4,40,24),...row(1505,2,40,170),...row(1650,4,40,24)],
  enemies:[{t:'wisp',x:600},{t:'walker',spr:'chroner',x:1050,r:110,h:88},{t:'wisp',x:1700}],
  folk:[{x:260,spr:'mother',h:92,lift:20,line:'n07',name:'The Grand Old Mother'}],
  boss:{key:'kingbell',spr:'kingbell',name:'The King of Bell',a0:1880,a1:2330,x:2200,hp:9,h:170,spd:60,move:1.7,atks:['wave','arc','charge','rain','wave','charge'],p2:['decree','wave','arc','charge','decree','rain','charge'],p3:['bell','decree','arc','charge','bell','rain','wave','charge'],n:3,line:'b07',win:'bw2',kneel:true},
  throne:{x:2660}, secretKneel:{n:6,x0:1808,x1:1918,t:3}, secRet:{6:1790},
  trig:[{x:60,line:'17',delay:1.0},{x:120,hint:'move6',ttl:7},{x:1150,line:'18'}],
 },[
  // safe: one golden bell over the floor, light above it
  [400,420,{bells:[{x:210,y:BASE-34}],motes:[[210,172],[210,196],...row(330,2,40,24)],enemies:[{t:'spitter',spr:'harms',x:380,h:60}]}],
  // test: a chasm crossed bell to bell
  [1100,800,{gaps:[[100,700]],bells:[{x:200,y:BASE-34},{x:330,y:BASE-40},{x:460,y:BASE-40},{x:590,y:BASE-34}],motes:[[265,150],[395,156],[525,150],...row(730,3,40,24)],gates:[{x:100,cost:5}]}],
  // twist: bells that swing, and one that tolls
  [1700,700,{gaps:[[80,560]],bells:[{x:180,y:BASE-40,sw:20,per:2.4,ph:0},{x:305,y:BASE-44,toll:[3.6,0]},{x:430,y:BASE-40,sw:20,per:2.4,ph:1.2}],motes:[[242,150],[368,150],...row(600,3,40,24)],gates:[{x:80,cost:4}]}],
 ]),2900,[
  // v6 conclusion: four bells, the second tolls and the third swings
  [3560,720,{gaps:[[80,600]],bells:[{x:180,y:BASE-36},{x:300,y:BASE-42,toll:[3.4,1.2]},{x:420,y:BASE-40,sw:22,per:2.2,ph:0.5},{x:530,y:BASE-36}],
    motes:[[240,150],[360,156],[475,150],...row(640,3,25,24)],gates:[{x:80,cost:5}]}],
 ])),
 makeArea({key:'garden',num:'',title:'Dusk',music:'garden',len:2600,dark:0.0,darkCol:'0,0,0',ground:['#3a1a1c','#0e0607'],rim:'#ffb090',fg:'garden',
  imgs:[['s22',0],['s23',1500]],waves:[[6,0.004,0],[3,0.012,1]],
  bench:{x:2200},
 }),
 // 8: under the pool  (painting: "Source error hire")
 makeArea({key:'sec1',secret:1,wet:true,num:'',title:'Beneath the Pool',music:'river',len:1950,dark:0.28,darkCol:'6,14,26',ground:['#28343c','#06090c'],rim:'#bfe4ff',fg:'shore',
  imgs:[['x1',0]],waves:[[6,0.006,0],[3,0.02,1]],
  gaps:[[300,420],[600,790],[1000,1190],[1400,1570]],
  plats:[{x:347,y:BASE-12,w:28,k:'stone'},{x:640,y:BASE+2,w:56,k:'log',mx:68,per:3.0},{x:1046,y:BASE-40,w:28,k:'stone'},{x:1124,y:BASE-74,w:28,k:'stone'},{x:1462,y:BASE-8,w:36,k:'stone',my:84,per:3.4}],
  hazards:[{k:'drop',x:510,per:2.4},{k:'drop',x:900,per:2.2,ph:1.1},{k:'vent',x:1300,per:2.6,on:1.0,ph:0.6},{k:'drop',x:1660,per:2.0,ph:0.5}],
  motes:[...row(130,4,40,24),...arc(310,3,50,40,70),...row(450,3,36,24),...arc(610,3,80,60,110),...row(830,3,40,24),[1060,104],[1138,138],...row(1220,3,40,24),...arc(1420,3,60,70,150),...row(1600,4,36,24)],
  enemies:[{t:'wisp',x:560},{t:'flyer',spr:'honey',x:880,r:110},{t:'wisp',x:1250},{t:'spitter',spr:'harms',x:1720,h:60}],
  relic:{x:1850}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
 // 9: above the canopy  (painting: "The swottys")
 makeArea({key:'sec2',secret:2,num:'',title:'Above the Bent Wood',music:'kingdom',len:1900,dark:0.15,darkCol:'8,12,30',ground:['#2a2c48','#07070f'],rim:'#d8e0ff',fg:'forest',
  imgs:[['x2',0]],waves:[[5,0.006,0],[3,0.02,1]],
  gaps:[[240,1700]],
  plats:[{x:262,y:BASE-30,w:44,k:'shard'},{x:350,y:BASE-86,w:40,k:'shard'},{x:450,y:BASE-60,w:60,k:'shard',mx:90,per:3.2},{x:640,y:BASE-110,w:40,k:'shard'},
         {x:740,y:BASE-60,w:44,k:'shard',my:90,per:3.0},{x:850,y:BASE-120,w:36,k:'shard'},{x:950,y:BASE-80,w:56,k:'shard',mx:110,per:3.6},
         {x:1160,y:BASE-40,w:40,k:'shard'},{x:1250,y:BASE-90,w:36,k:'shard'},{x:1340,y:BASE-50,w:44,k:'shard',my:70,per:2.6},{x:1440,y:BASE-100,w:40,k:'shard'},{x:1540,y:BASE-60,w:60,k:'shard',mx:70,per:2.8}],
  motes:[...row(80,4,36,24),[284,60],[370,118],[480,92],[560,92],[660,142],[762,150],[868,152],[980,112],[1060,112],[1180,72],[1268,122],[1362,140],[1460,132],[1570,92],...row(1760,4,36,24)],
  enemies:[{t:'wisp',x:600},{t:'flyer',spr:'honey',x:1000,r:140},{t:'wisp',x:1300},{t:'spitter',spr:'harms',x:1500,h:60}],
  relic:{x:1820}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
 // 10: the river's memory  (painting: "Not so important")
 makeArea({key:'sec3',secret:3,num:'',title:'What the River Remembers',music:'dark',len:2000,dark:0.55,darkCol:'14,10,6',ground:['#3a3026','#0b0805'],rim:'#e8d6b8',fg:'dark',
  imgs:[['x3',0]],waves:[[8,0.005,0],[4,0.016,1]],
  gaps:[[380,470],[820,1010],[1500,1590]],
  solids:[{x:600,w:40,h:40,k:'rock'},{x:1250,w:30,h:56,k:'rock'}],
  plats:[{x:860,y:BASE+2,w:60,k:'log',mx:70,per:2.8}],
  hazards:[{k:'vent',x:700,per:2.4,on:1.0},{k:'drop',x:1120,per:2.0},{k:'drop',x:1170,per:2.0,ph:1.0},{k:'vent',x:1400,per:2.2,on:1.0,ph:1.1},{k:'drop',x:1700,per:1.8,ph:0.4}],
  braziers:[150,1080],
  motes:[...row(120,4,36,24),...arc(380,3,45,50,80),...row(520,3,36,24),...row(610,2,30,72),...arc(830,3,80,60,100),...row(1060,3,40,24),[1265,90],...row(1320,3,36,24),...arc(1500,3,45,50,80),...row(1640,4,36,24)],
  enemies:[{t:'stalker',spr:'renoy',x:560},{t:'thrower',spr:'xon',x:1310,h:84},{t:'stalker',spr:'renoy',x:1440},{t:'spitter',spr:'harms',x:1650,h:60}],
  drain:3, relic:{x:1900}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
 // 11 (v5): high over the golden city  (painting: "Blackout")
 makeArea({key:'sec4',secret:4,num:'',title:'The Lantern Above the City',music:'kingdom',len:2050,dark:0.3,darkCol:'16,12,14',ground:['#4a3a2a','#0c0906'],rim:'#f2dcb0',fg:'kingdom',
  imgs:[['x5',0]],waves:[[5,0.006,0],[3,0.02,1]],
  gaps:[[260,660],[860,1340],[1540,1760]],
  hang:[{x:400,y:BASE-150,lit:1},{x:575,y:BASE-160},{x:1000,y:BASE-150,gut:[2.2,1.4,0]},{x:1150,y:BASE-160,gut:[2.2,1.4,0.75]},{x:1290,y:BASE-150,gut:[2.2,1.4,1.5]}],
  hazards:[{k:'drop',x:760,per:2.2},{k:'drop',x:1440,per:2.0,ph:0.9},{k:'drop',x:1860,per:2.0,ph:0.3}],
  motes:[...row(100,4,40,24),[400,196],[575,206],...row(700,3,40,24),[1000,196],[1150,206],[1290,196],...row(1380,3,40,24),[1600,70],[1680,90],...row(1800,3,30,24)],
  enemies:[{t:'wisp',x:720},{t:'flyer',spr:'honey',x:1450,r:90},{t:'spitter',spr:'harms',x:1880,h:60}],
  relic:{x:1960}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
 // 12 (v5): over the Frygar wall  (painting: "Gozzies")
 makeArea({key:'sec5',secret:5,num:'',title:'Over the Frygar Wall',music:'war',len:2050,dark:0.35,darkCol:'40,10,4',ground:['#5a2412','#140604'],rim:'#ffb070',fg:'war',
  imgs:[['x6',0]],waves:[[6,0.006,0],[3,0.02,1]],
  gaps:[[420,520],[980,1160],[1500,1580]],
  hazards:[{k:'vent',x:300,per:2.4,on:1.0},{k:'vent',x:700,per:2.4,on:1.0,ph:0.8},{k:'vent',x:1300,per:2.2,on:1.0,ph:0.3},{k:'vent',x:1420,per:2.2,on:1.0,ph:1.4}],
  cats:[{x:900,y:BASE-160,per:2.6,ph:0,range:[-800,40]},{x:1740,y:BASE-160,per:2.4,ph:1.0,range:[-600,40]}],
  motes:[...row(100,4,40,24),...row(560,3,40,24),...arc(1000,3,70,60,90),...row(1200,2,40,24),...row(1620,3,40,24),...row(1820,3,30,24)],
  enemies:[{t:'frygar',x:620,r:80},{t:'frygar',x:1250,r:50},{t:'wisp',x:1820}],
  embers:true, relic:{x:1960}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
 // 13 (v5): where the old thing sleeps  (painting: "Reverse")
 makeArea({key:'sec6',secret:6,num:'',title:'Where the Old Thing Sleeps',music:'dark',len:2050,dark:0.85,darkCol:'6,4,8',ground:['#2a1a18','#050203'],rim:'#c88a70',fg:'dark',
  imgs:[['x7',0]],waves:[[8,0.005,0],[4,0.016,1]],
  gaps:[[760,812],[1260,1312]],
  braziers:[{x:150,lit:1},{x:620,cold:1},{x:1150,cold:1},{x:1620,cold:1}], cold:[[250,1860]],
  eyes:[{x:420,y:BASE-190,per:4.6,ph:0},{x:900,y:BASE-200,per:4.6,ph:1.5},{x:1390,y:BASE-190,per:4.6,ph:3.0}],
  motes:[...row(80,3,36,24),...row(660,2,40,24),...row(1190,2,40,24),...row(1660,2,40,24),...row(1880,3,30,24)],
  enemies:[{t:'stalker',spr:'renoy',x:1000},{t:'spitter',spr:'harms',x:1500,h:60},{t:'stalker',spr:'renoy',x:1760}],
  drain:3, relic:{x:1960}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
 // 14 (v5): the bell beneath the throne  (painting: "Stationers")
 makeArea({key:'sec7',secret:7,num:'',title:'The Bell Beneath the Throne',music:'heart',len:1950,dark:0.15,darkCol:'30,24,30',ground:['#6a5a62','#1a1216'],rim:'#fff0e0',fg:'heart',
  imgs:[['x8',0]],waves:[[5,0.006,0],[3,0.02,1]],
  gaps:[[200,690],[880,1380],[1550,1700]],
  bells:[{x:300,y:BASE-34},{x:430,y:BASE-40},{x:560,y:BASE-40},{x:990,y:BASE-40,sw:32,per:2.2,ph:0},{x:1120,y:BASE-44,toll:[3.2,0]},{x:1250,y:BASE-40,sw:32,per:2.2,ph:1.1}],
  motes:[...row(80,3,36,24),[365,150],[495,150],...row(740,3,36,24),[1055,150],[1185,150],...row(1420,3,36,24),...arc(1560,3,70,70,100),...row(1760,3,30,24)],
  enemies:[{t:'wisp',x:820},{t:'flyer',spr:'honey',x:1470,r:70},{t:'wisp',x:1800}],
  relic:{x:1870}, trig:[{x:40,hint:'secret',ttl:5}],
 }),
];
// which stage each secret opens and what the narrator says (the way back is in each land's secRet)
const SECRETS=[{area:8,from:0,enter:'e1',riddle:'r1'},{area:9,from:1,enter:'e2',riddle:'r2'},{area:10,from:2,enter:'e3',riddle:'r3'},
  {area:11,from:3,enter:'e4',riddle:'r4'},{area:12,from:4,enter:'e5',riddle:'r5'},{area:13,from:5,enter:'e6',riddle:'r6'},{area:14,from:6,enter:'e7',riddle:'r7'}];

/* v7: the Long Night, remixed. Each land keeps its shape and its acts, but key stretches are rebuilt at night around
   the moves (leaps that need the ebb-step, a lantern chain in the bent wood, guards in the city, catapults in a row,
   swinging bells...). Three of them also hide something that only the night shows (see SECRETS.md). */
function cut(d,x0,x1){ const inR=x=>x>=x0&&x<x1;
  d.gaps=d.gaps.filter(g=>!(g[0]>=x0&&g[1]<=x1)); d.cold=(d.cold||[]).filter(g=>!(g[0]>=x0&&g[1]<=x1));
  for(const k of ['solids','plats','hazards','enemies','hang','cats','eyes','bells','gates','tides']) d[k]=(d[k]||[]).filter(o=>!inR(o.x));
  d.braziers=(d.braziers||[]).filter(b=>!inR(typeof b==='number'?b:b.x)); d.lanterns=(d.lanterns||[]).filter(x=>!inR(x)); d.motes=(d.motes||[]).filter(m=>!inR(m[0])); return d; }
const put=(d,at,s)=>ins(d,at,0,s);
function nightLand(i,f){ const d=JSON.parse(JSON.stringify(AREAS[i].raw)); f(d); d.night=1; return makeArea(d); }
const NIGHT=[
 nightLand(0,d=>{ cut(d,700,1240); put(d,700,{tides:[{x:40,w:120,per:3.6,on:1.5,ph:0}],gaps:[[300,450]],enemies:[{t:'walker',spr:'gorit',x:520,r:28,h:74},{t:'wisp',x:250}],
     motes:[...row(0,2,30,24),...row(190,3,30,24),[375,84],...row(470,3,24,24)],gates:[{x:300,cost:1}]});
   cut(d,2250,3010); put(d,2250,{tides:[{x:90,w:130,per:4.0,on:1.4,ph:0.6}],gaps:[[300,650]],plats:[{x:385,y:BASE-4,w:50,k:'stone',rot:0.6},{x:515,y:BASE-4,w:50,k:'stone',rot:0.6}],
     enemies:[{t:'walker',spr:'gorit',x:245,r:22,h:74},{t:'wisp',x:710}],motes:[...row(20,3,30,24),[410,56],[540,56],...row(675,3,28,24)]});
   const hr=d.solids.find(o=>o.x===1280); if(hr) hr.hollow=7; d.secRet[7]=1345; }),
 nightLand(1,d=>{ cut(d,1380,1500); put(d,1380,{gaps:[[20,190]],plats:[{x:85,y:BASE-8,w:56,k:'branch',rot:0.6}],motes:[[113,56],...row(205,2,25,24)]});
   cut(d,3400,3760); put(d,3400,{gaps:[[20,350]],hang:[{x:120,y:BASE-150,lit:1},{x:262,y:BASE-156}],motes:[[190,200],...row(365,2,25,24)],gates:[{x:20,cost:2}]});
   cut(d,4740,5360); put(d,4740,{gaps:[[20,160],[290,610]],hazards:[{k:'vent',f:'thorn',x:215,per:2.0,on:1.3,ph:1.0}],
     plats:[{x:380,y:BASE-8,w:54,k:'branch',rot:0.55,upd:8},{x:490,y:BASE-8,w:54,k:'branch',rot:0.55}],motes:[[90,64],...row(170,2,22,24),[407,50],[517,50]],gates:[{x:20,cost:1},{x:290,cost:1}]});
   d.secRet[8]=5385; }),
 nightLand(2,d=>{ cut(d,1000,1960); // v9: the two stone crossings become one wide, sinking crossing you light-dash across, with a vent and Hey Honey before it
   put(d,1000,{gaps:[[0,180],[560,960]],plats:[{x:62,y:BASE-4,w:56,k:'stone',rot:0.5},{x:622,y:BASE-4,w:56,k:'stone',rot:0.5},{x:790,y:BASE-4,w:56,k:'stone',rot:0.5}],
     hazards:[{k:'vent',x:300,per:3.0,on:1.1,f:'water',ph:0.4}],enemies:[{t:'flyer',spr:'honey',x:430,r:110}],
     motes:[[90,56],...row(200,2,30,24),...row(360,3,30,24),[650,56],[818,56],...row(980,3,30,24)]});
   d.moon={n:9,x0:3088,x1:3210}; d.secRet[9]=3450;
   put(d,0,{hazards:[{k:'drop',x:5153,per:2.6,ph:0}],enemies:[{t:'flyer',spr:'honey',x:3880,r:100}]}); }),
 nightLand(3,d=>{ cut(d,1000,1960); // v9: the balconies become a lantern chasm behind a watchman, then two falling stones on a beat
   put(d,1000,{gaps:[[300,665]],hang:[{x:420,y:BASE-150,lit:1},{x:580,y:BASE-158,gut:[2.4,1.5,0.6]}],hazards:[{k:'drop',x:800,per:2.6,ph:0},{k:'drop',x:880,per:2.6,ph:1.3}],
     enemies:[{t:'guard',spr:'keepaway',x:150,h:84,per:4.6,ph:0.5,r:110}],motes:[...row(0,3,30,24),[500,190],...row(720,2,30,24),...row(920,3,30,24)]});
   d.enemies=d.enemies.filter(e=>!(e.t==='walker'&&(e.x===3380||e.x===4950)));
   put(d,0,{enemies:[{t:'guard',spr:'keepaway',x:3380,h:84,per:4.6,ph:1.0,r:170},{t:'guard',spr:'keepaway',x:4950,h:84,per:4.6,ph:0,r:120}]});
   for(const h of d.hang){ if(h.x===5760) h.gut=[2.4,1.5,0]; if(h.x===5940) h.gut=[2.4,1.5,0.8]; if(h.x===6120) h.gut=[2.4,1.5,1.6]; } }),
 nightLand(4,d=>{ cut(d,2600,3060); // v9: the vent corridor rolls like a wave, under a catapult
   put(d,2600,{hazards:[{k:'vent',x:60,per:2.7,on:1.0,ph:0},{k:'vent',x:200,per:2.7,on:1.0,ph:0.9},{k:'vent',x:340,per:2.7,on:1.0,ph:1.8}],
     cats:[{x:200,y:BASE-150,per:3.0,ph:0.3,range:[-180,160]}],motes:[...row(0,2,25,24),...row(120,2,25,24),...row(260,2,25,24),...row(400,2,25,24)]});
   cut(d,1560,1760); put(d,1560,{gaps:[[30,180]],motes:[...row(0,2,25,24),[105,70],...row(195,2,25,24)],gates:[{x:30,cost:1}]});
   put(d,0,{cats:[{x:5480,y:BASE-150,per:2.8,ph:0.7,range:[-200,40]}]}); }),
 nightLand(5,d=>{ cut(d,1440,2400); // v9: a cold walk between two watching eyes, a pit in the middle of it, and a Renoy at the far fire
   put(d,1440,{cold:[[80,760]],braziers:[{x:20,lit:1},{x:720,cold:1}],gaps:[[400,452]],eyes:[{x:280,y:BASE-190,per:4.6,ph:0},{x:600,y:BASE-196,per:4.6,ph:2.3}],
     enemies:[{t:'stalker',spr:'renoy',x:1040}],motes:[...row(100,3,30,24),[426,60],...row(500,3,30,24),...row(780,3,30,24),...row(900,3,30,24)]}); // the Renoy waits a little past the fire, so you can warm up first
   d.cold=d.cold.map(c=>c[0]===920?[880,1420]:c); put(d,0,{eyes:[{x:1260,y:BASE-190,per:4.6,ph:2.2},{x:6520,y:BASE-195,per:4.6,ph:2.0}]}); }),
 nightLand(6,d=>{ cut(d,600,1500); // v9: the opening becomes a tolling-bell chasm, then a Chroner and a wisp on the far side
   put(d,600,{gaps:[[120,580]],bells:[{x:220,y:BASE-40,sw:22,per:2.2,ph:0},{x:345,y:BASE-42,toll:[3.0,0.6]},{x:470,y:BASE-40,sw:22,per:2.2,ph:1.1}],
     enemies:[{t:'wisp',x:680},{t:'walker',spr:'chroner',x:790,r:90,h:88}],motes:[...row(-90,3,28,24),...row(20,3,30,24),[282,80],[408,80],...row(600,4,28,24),...row(860,5,26,24)]}); // star-falls spend light: enough motes after the chasm for the gate at 1620
   for(const b of d.bells){ if(b.x===1850||b.x===2110){ b.sw=18; b.per=2.4; b.ph=b.x===2110?1.2:0; } if(b.x===3740){ b.sw=20; b.per=2.2; b.ph=0.3; } if(b.x===4090) b.toll=[3.2,0.6]; } }),
];
function LAND(i){ return game.night&&NIGHT[i]?NIGHT[i]:AREAS[i]; }
// v7: what the night hides, in the first three lands. They want the moves, which only the night gives you there.
AREAS.push(
 makeArea({key:'nsec1',secret:8,wet:true,num:'',title:'Inside the Hollow Rock',music:'river',len:1950,dark:0.5,darkCol:'6,10,26',ground:['#2c3640','#06090c'],rim:'#cfe6ff',fg:'shore',
  imgs:[['s02',0]],waves:[[6,0.006,0],[3,0.02,1]],
  tides:[{x:260,w:130,per:3.4,on:1.4,ph:0},{x:1080,w:140,per:3.2,on:1.4,ph:1.6}], gaps:[[520,690],[1350,1620]], plats:[{x:1435,y:BASE-6,w:44,k:"stone",rot:0.5},{x:1530,y:BASE-6,w:44,k:"stone",rot:0.5}],
  hazards:[{k:'drop',x:820,per:2.4,ph:0.3},{k:'drop',x:1250,per:2.2,ph:1.0}],
  motes:[...row(100,4,36,24),...row(420,2,40,24),[605,80],...row(720,3,36,24),...row(900,2,40,24),...row(1260,2,30,24),[1457,60],[1552,60],...row(1660,4,36,24)],
  enemies:[{t:'wisp',x:700},{t:'walker',spr:'gorit',x:960,r:40,h:74},{t:'flyer',spr:'honey',x:1500,r:90}],
  relic:{x:1860}, trig:[{x:40,hint:'secret',ttl:5}] }),
 makeArea({key:'nsec2',secret:9,num:'',title:'Under the Rotten Bough',music:'forest',len:1950,dark:0.55,darkCol:'10,8,16',ground:['#2e2214','#0a0604'],rim:'#e0c08a',fg:'forest',
  imgs:[['s05',0]],waves:[[8,0.005,0],[4,0.016,1]],
  gaps:[[310,620],[980,1330],[1585,1660]], plats:[{x:400,y:BASE-8,w:54,k:'branch',rot:0.5},{x:510,y:BASE-8,w:54,k:'branch',rot:0.5}],
  hang:[{x:1080,y:BASE-150,lit:1},{x:1230,y:BASE-156}],
  hazards:[{k:'vent',f:'thorn',x:800,per:2.0,on:1.3},{k:'vent',f:'thorn',x:860,per:2.0,on:1.3,ph:1.0},{k:'drop',x:1450,per:2.4}],
  motes:[...row(100,4,36,24),[427,50],[537,50],...row(660,2,40,24),[1155,200],...row(1370,3,30,24),...row(1730,4,36,24)],
  enemies:[{t:'wisp',x:700},{t:'walker',spr:'goils',x:1420,r:50,h:70}],
  relic:{x:1860}, trig:[{x:40,hint:'secret',ttl:5}] }),
 makeArea({key:'nsec3',secret:10,wet:true,num:'',title:"The Moon's Road",music:'river',len:1950,dark:0.5,darkCol:'8,12,30',ground:['#3a3a40','#0b0b10'],rim:'#e6ecff',fg:'river',
  imgs:[['s07',0]],waves:[[6,0.005,0],[3,0.016,1]],
  gaps:[[250,700],[1000,1150],[1400,1720]], plats:[{x:350,y:BASE-4,w:52,k:'stone',rot:0.5},{x:480,y:BASE-4,w:52,k:'stone',rot:0.5},{x:610,y:BASE-4,w:46,k:'stone',rot:0.45}],
  solids:[{x:1150,w:52,h:90,k:'rock'}], bells:[{x:1500,y:BASE-36,sw:18,per:2.4,ph:0},{x:1620,y:BASE-40}], hazards:[{k:'vent',x:850,per:2.6,on:1.0,f:'water'}],
  motes:[...row(100,4,36,24),[376,50],[506,50],[633,50],...row(740,2,40,24),[1060,90],[1120,120],...row(1250,2,40,24),[1560,150],...row(1760,4,36,24)],
  enemies:[{t:'wisp',x:900},{t:'flyer',spr:'honey',x:1280,r:80}],
  relic:{x:1870}, trig:[{x:40,hint:'secret',ttl:5}] }));
SECRETS.push({area:15,from:0,enter:'ne1',riddle:'nr1',night:1},{area:16,from:1,enter:'ne2',riddle:'nr2',night:1},{area:17,from:2,enter:'ne3',riddle:'nr3',night:1});
const DAYN=7; // the seven day secrets are 0-6, the night's three are 7-9
// v5: what each stone gives back. Shown once when it is given, and once more as the next land begins.
const MOVES=[
  {name:'ebb-step', k:()=>touchMode?'»':'C', t:'dash along the ground (1 light)'},
  {name:'light-dash', k:()=>touchMode?'» in the air':'C in the air', t:'dash once per jump, any way you hold (2 light)'},
  {name:'lantern-pull', k:()=>touchMode?'» near a hanging lantern':'C near a hanging lantern', t:'pull yourself to it (1 light)'},
  {name:'turnlight', k:()=>touchMode?'✦ just as a shot reaches you':'X just as a shot reaches you', t:'send it back (a shine)'},
  {name:'ember-carry', k:()=>touchMode?'▼ at a brazier':'↓ at a brazier', t:'carry its fire. ↓ again to set it down'},
  {name:'star-fall', k:()=>touchMode?'▼ in the air':'↓ in the air', t:'drop like a star, bounce off what you land on (1 light)'},
];
const moveHint=i=>{ const m=MOVES[i]; return `${m.k()}  ${m.name}: ${m.t}`; };

const HINTS={
  secret:()=>'A hidden place. One try. Fall here and you lose a life and are thrown back out.',
  move:()=>touchMode?'◀ ▶  walk':'← →  walk',
  jump:()=>touchMode?'⤒  jump':'↑ / Space  jump',
  lives:()=>game.ember?'One light. Lose it and the run is over.':'Three lives. Lose them all and the journey starts again from the shore.',
  shine:()=>touchMode?'✦  shine: calms shadows (costs 3 light). Light is your shield: hit with none, and you lose a life':'X  shine: calms shadows (costs 3 light). Light is your shield: hit with none, and you lose a life',
  offer:()=>touchMode?'Stand at the stone and tap ✦ to offer your light':'Stand at the stone and press X to offer your light',
  move1:()=>moveHint(0), move2:()=>moveHint(1), move3:()=>moveHint(2), move4:()=>moveHint(3), move5:()=>moveHint(4), move6:()=>moveHint(5),
};

/* ---------------- game state ---------------- */
const game={stop:0,slowT:0,deaths:[],state:'loading',t:0,areaI:0,log:[],stats:{},flash:0,fade:0,shake:0,title:{a:0},cine:null,throne:null,ending:null,paused:false,veil:false,lives:START_LIVES,lifeMotes:0,bossBanner:null,popups:[]};
/*@DEV*/window.FANTOR=game;/*@/DEV*/
const P={x:80,y:BASE,vx:0,vy:0,face:1,ground:true,coy:0,buf:0,walk:0,light:3,hurtT:0,plat:null,stepT:0,sit:0,glow:1,safeX:80,cp:80,ctrl:true,auto:AUTO,dead:0,shineCD:0,
  dashT:0,dashCD:0,dashG:0,dashDir:1,carry:0,airDash:true,adT:0,adV:[0,0],pull:null,ember:false,stomp:false,kneel:0,inv:0,knockT:0,bumpT:0,bumpCd:0,bumpDir:1,bumpHold:0,jumpT:0,airSince:0};
game.moves=0; // v5: how many of the stones' gifts the wanderer carries (0-6)
game.hintSeen={}; game.legendSeen=0; game.legendT=0; game.legendWant=0; game.legendAtShine=0; game.cardSeen={}; game.titleDur=4; // v11.4: hints, the star legend, heard lines and which land cards have shown last the sitting
function resetMoves(){ Object.assign(P,{dashT:0,dashCD:0,dashG:0,carry:0,airDash:true,adT:0,pull:null,ember:false,stomp:false,kneel:0,inv:0,knockT:0}); }
game.night=false; game.splits=[]; game.actT=0; game.split=null; // v6
// v6: the Long Night opens once the seven lights have gone home; best times are kept in this browser
const store={get(k){ try{ return JSON.parse(localStorage.getItem('fantor.'+k)||'null'); }catch(_){ return null; } }, set(k,v){ try{ localStorage.setItem('fantor.'+k,JSON.stringify(v)); }catch(_){} }};
const nightOpen=()=>!!store.get('night');
const lifeNeed=()=>game.night?LIFE_MOTES*2:LIFE_MOTES;
const runT=()=>game.t-(game.stats.start||0);
// v10 "Keepsakes": a quiet record kept in this browser, one for the journey and one for the Long Night: how many journeys
// were begun and the furthest the light has gone. A record, not a hint.
const JLEN=()=>AREAS.slice(0,7).reduce((q,l)=>q+l.len,0);
function journeyPos(ai,x){ if(ai>=7) return 1; let q=0; for(let i=0;i<ai;i++) q+=AREAS[i].len; return (q+clamp(x,0,AREAS[ai].len))/JLEN(); }
function recGet(){ const r=store.get('rec'); return r&&typeof r==='object'?r:{}; }
function noteFar(ai,x,done){ if(!game.fromStart||ai<0) return; const r=recGet(), k=recKey(), o=r[k]||{runs:0}; const pos=done?1.0001:journeyPos(ai,x);
  if(!(o.far>=pos)){ o.far=pos; o.ai=done?8:Math.min(ai,7); o.x=x|0; r[k]=o; store.set('rec',r); } if(pos>(game.runFar||0)) game.runFar=pos; }
// v11 "Ember": a lifetime map of where the light has gone out (per land, kept in this browser), the Ember Run, and a card to keep.
const recKey=()=>game.ember?'ember':game.night?'night':'day';
const emberOpen=()=>{ const r=recGet(); return nightOpen()||!!(r.day&&r.day.ai>=8)||!!(r.night&&r.night.ai>=8); };
function dmGet(){ const d=store.get('dmap'); const z=()=>[0,0,0,0,0,0,0,0]; const o=d&&typeof d==='object'?d:{}; for(const k of ['day','night']) if(!Array.isArray(o[k])||o[k].length!==8) o[k]=z(); return o; }
function dmNote(ai){ if(ai<0||ai>7) return 0; const d=dmGet(), k=game.night?'night':'day'; d[k][ai]=(d[k][ai]|0)+1; store.set('dmap',d); return d[k][ai]; }
function farLabel(o){ return o.ai>=8?"the journey's end":o.ai>=7?'Dusk':`${AREAS[o.ai].num}  ${AREAS[o.ai].title}`; }
function fmtT(t,cs){ t=Math.max(0,t); const m=Math.floor(t/60), s=t-m*60; return `${m}:${(cs?s.toFixed(1):String(Math.floor(s))).padStart(cs?4:2,'0')}`; }
game.P=P; game.relics=new Set(); game.secretsSpent=new Set(); game.secretFrom=null; game.transFn=null;
let A=null; // current area runtime
let camX=0, camY=0, prevCamX=0, prevCamY=0, prevPX=80, prevPY=392, renderA=1;
function holdView(){ prevCamX=camX; prevCamY=camY; prevPX=P.x; prevPY=P.y; }
const ETYPE={wisp:{hp:1,fly:60,h:0},walker:{hp:2,h:74},flyer:{hp:1,h:50,fly:135},thrower:{hp:2,h:76},spitter:{hp:2,h:60,fly:105},stalker:{hp:2,h:118},frygar:{hp:1,h:64},guard:{hp:2,h:84}};
function gyOr(x){ const g=A.d.gy(x); return g<1e8?g:BASE; }
function mkEnemy(e){
  const T=ETYPE[e.t]; const o={...e,x0:e.x,vx:0,calm:false,ct:0,ph:(e.x*0.0137)%TAU,dir:1,hit:0,cd:e.cd||1.6,tele:0}; // v4: no random phase or cooldown, patterns can be learned
  o.hp0=o.hp=(e.hp||T.hp)+(game.night?1:0); o.h=e.h||T.h; o.fly=T.fly||0; o.y0=o.y=gyOr(e.x)-o.fly; return o;
}
function mkMote(x,y){ return {x,y,ox:x,oy:y,got:false,ph:Math.random()*TAU}; }
function setupArea(i){
  game.areaI=i; const d=LAND(i);
  A={d,motes:[],enemies:[],lanterns:d.lanterns.map(x=>({x,lit:false,t:0})), braziers:d.braziers.map(b=>typeof b==='number'?{x:b,lit:false,t:0}:{x:b.x,lit:!!b.lit,cold:!!b.cold,t:0}),
     hang:d.hang.filter(h=>!(h.hidden&&(game.secretsSpent.has(3)||game.relics.has(3)))).map(h=>({...h,lit:!!h.lit,t:0})), cats:d.cats.map(c=>({...c,per:c.per*(game.night?NIGHT_TEMPO:1),dead:false,lastT:1e9,wind:0})),
     eyes:d.eyes.map(e=>({...e,op:0,gz:0})), bells:d.bells.map(b=>({...b,x0:b.x,ring:0,lastT:1e9})), gateT:0, eyeT:0,
     shrine:d.shrine?{...d.shrine,need:game.night?Math.round(d.shrine.need*1.25):d.shrine.need,awake:false,t:0}:null, veil:d.shrine?1:0, trig:d.trig.map(t=>({...t,line:game.night&&t.line==='01'?'ln1':t.line,done:false})),
     plats:[], particles:[], rings:[], streams:[], shots:[], hint:null, hintT:0, npcs:[], embers:[], drainT:0, zeroT:0, trickle:0, rng:rngf(1234+i*77),
     haz:d.hazards.map(h=>({...h,per:h.per*(game.night?NIGHT_TEMPO:1)})), act:d.act2?1:0, ways:d.ways.map(x=>({x,lit:false})), folk:d.folk.map(f=>({...f,said:false,ph:Math.random()*TAU,near:0})), boss:null, cp:null};
  A.motes=d.motes.map(([x,h,f])=>{ const m=mkMote(x,gyOr(x)-h); if(f==='ft') m.ft=1; else if(f) m.sec=f; return m; });
  A.relic=d.relic&&!game.relics.has(d.secret-1)?{x:d.relic.x,got:false,t:0}:null; A.stillT=0; A.ripT=0;
  A.enemies=d.enemies.map(mkEnemy);
  A.plats=d.plats.map(p=>{ const g=d.gy(p.x+p.w/2); const y=g<1e8?g-(BASE-p.y):p.y; return {...p,y,y0:y,x0:p.x,dx:0,dy:0,rt:0,off:0}; });
  if(d.boss){ const b=d.boss; A.boss={...b,y:gyOr(b.x),hp:b.hp,max:b.hp,st:'sleep',t:0,iT:0,hit:0,ph:0,ai:0,calm:false,ct:0,side:1,rain:0,face:-1}; bossResetPhase(A.boss); }
  d.dyn=null; A.fires=[]; A.pillars=[]; A.tide=null; A.tiles=null; A.decoys=[];
  if(d.boss&&d.boss.key==='vere'){ const b=d.boss; for(const x of [b.a0+50,(b.a0+b.a1)/2,b.a1-50]) A.braziers.push({x,lit:true,t:0,arena:1,snuff:0}); }
  const r=rngf(99+i);
  for(let k=0;k<d.npcs;k++) A.npcs.push({x:r()*d.len,s:0.55+r()*0.25,v:14+r()*16,ph:r()*TAU,lit:false});
  P.x=70; P.y=d.gy(70); P.vx=0; P.vy=0; P.ground=true; P.safeX=70; P.cp=70; P.plat=null; P.ctrl=true; P.sit=0; P.hurtT=0; P.dead=0; P.shineCD=0; resetMoves();
  if(i===7) P.light=0;
  if(i>=1&&i<=7&&!d.secret){ game.splits[i-1]=runT(); if(game.fromStart) showSplit(i-1); noteFar(i,0); }
  game.paint=null; // v10
  if(!d.throne) game.throne=null;
  camX=0; camY=0; holdView(); game.bossBanner=null;
  playMusic(d.music);
  syncArt();
  game.titleDur=game.cardSeen[i]?1.8:4; game.cardSeen[i]=1; game.areaTitle=game.titleDur; // v11.4: a land's card is short only after this sitting has already shown it. A new land stays at 4s.
  game.log.push(['area',i,+game.t.toFixed(1)]);
  resetCover();
  setCP(70,true);
}
function resetCover(){ if(!A) return; for(const s of A.d.solids) if(s.k==='rock'){ s.chip=0; s.spent=0; } }
// checkpoints (v4): the area start, then only a calmed boss and a woken stone at the very end of a land.
// Dying sends you back to the last one with the light you had there; motes gathered since come back too.
// v6: two acts per land. Act 2 is a level start, like a second act on a cartridge: the first act is behind you (its shadows
// with it), and losing a life in Act 2 starts Act 2 again. Game over is still the very beginning.
function startAct2(){ const d=A.d; A.act=2; A.enemies=A.enemies.filter(e=>e.x0>=d.act2); A.shots.length=0; if(game.areaI){ game.fade=Math.max(game.fade,0.85); game.actT=3.6; } // v8: on the shore Act 2 just carries on, no dip to black and no card
  setCP(d.act2+6,true); game.log.push(['act',game.areaI,2,+game.t.toFixed(1)]);
  if(ac&&musCur) musCur.s.playbackRate.setTargetAtTime((game.night?0.9:1)*1.04,ac.currentTime,1.2); actMix(true); } // v7: Act 2 plays a touch higher and quicker, and the light closes in a little
function showSplit(i){ const b=store.get('best'), bb=b&&b[game.night?'night':'day']; const t=game.splits[i]; let dl='';
  if(bb&&bb.splits&&bb.splits[i]!==undefined){ const dd=t-bb.splits[i]; dl=`  ${dd<0?'−':'+'}${Math.abs(dd).toFixed(1)}`; }
  game.split={txt:`${AREAS[i].num}  ${fmtT(t,1)}${dl}`,t:0,good:dl.startsWith('  −')}; }
function setCP(x,force){
  if(A.cp&&!force&&x<=A.cp.x) return;
  A.cp={x,light:Math.max(P.light,3),got:A.motes.map(m=>m.got),n:A.motes.length,calm:A.enemies.map(e=>e.calm),ne:A.enemies.length,cats:A.cats.map(c=>c.dead)};
  P.cp=x;
}
function restoreCP(){
  const s=A.cp;
  A.motes.length=s.n; A.motes.forEach((m,i)=>{ m.got=s.got[i]; if(!m.got){ m.x=m.ox; m.y=m.oy; } });
  A.enemies.length=s.ne;
  A.enemies.forEach((e,i)=>{ if(!s.calm[i]){ e.calm=false; e.ct=0; e.x=e.x0; e.vx=0; e.hp=e.hp0; e.hit=0; e.cd=1.5; e.tele=0; e.y=e.y0; } });
  A.shots.length=0; resetMoves(); resetCover();
  A.cats.forEach((c,i)=>{ if(!s.cats[i]) c.dead=false; });
  for(const p of A.plats) if(p.rot){ p.rt=0; p.off=0; p.y=p.y0; p.dy=0; }
  const B=A.boss; if(B&&!B.calm){ Object.assign(B,{st:'sleep',t:0,hp:B.max,x:A.d.boss.x,iT:0,hit:0,ai:0,rain:0}); bossResetPhase(B); B.y=gyOr(B.x); game.bossBanner=null; clearBossHazards(); for(const b of A.braziers) if(b.arena){ b.lit=true; b.snuff=0; } }
  P.light=s.light; respawn(s.x); P.ctrl=true; P.dead=0; game.fade=0.55;
}

/* ---------------- physics ---------------- */
const GRAV=980, JV=362, SPD=142, PH=54, PW=16;
function solidTop(s){ return A.d.gy(s.x+s.w/2)-s.h; }
function floorAt(x,prevFeet){
  let gy=A.d.gy(x), plat=null;
  for(const s of A.d.solids){ if(x>s.x-PW/2&&x<s.x+s.w+PW/2){ const top=solidTop(s); if(prevFeet<=top+6&&top<gy){ gy=top; plat=null; } } }
  for(const p of A.plats){ if(p.off) continue; if(x>p.x-4&&x<p.x+p.w+4){ if(prevFeet<=p.y+5+Math.max(0,p.dy||0)&&p.y<gy){ gy=p.y; plat=p; } } }
  return [gy,plat];
}
function solidAt(x){ for(const s of A.d.solids) if(x>s.x-6&&x<s.x+s.w+6) return true; return false; }
function blockedX(nx,feet){
  if(A.veil>0.5 && nx>A.d.len-120) return true;
  if(nx<12) return true;
  if(A.act===2&&nx<A.d.act2&&nx<P.x) return true; // v6: the first act is behind you
  const B=A.boss; if(B&&!B.calm){ if(nx>B.a1) return true; if(B.st!=='sleep'&&nx<B.a0) return true; }
  if(nx>A.d.len-8) return false;
  const g=A.d.gy(nx); if(g<1e8 && feet>g+10) return true;
  for(const s of A.d.solids){ if(nx>s.x-PW/2&&nx<s.x+s.w+PW/2 && feet>solidTop(s)+4) return true; }
  return false;
}
/* v5: the stones' gifts. C is the "light move" (ebb-step on the ground, light-dash in the air, lantern-pull near a
   hanging lantern); Down carries a brazier's fire, or drops you like a star in the air. Every one of them costs light
   except carrying fire, and none of them makes you safe from anything: a hit mid-dash is still a hit. */
const NIGHT_TEMPO=0.88; // v6: the Long Night's hazards keep a quicker beat
const DASH_V=430, DASH_T=0.18, CARRY_V=270, AD_V=400, AD_T=0.15, AD_CARRY=290, PULL_R=270, PULL_V=620, STOMP_V=650, BOUNCE_V=470, TURN_R=74, HOP_V=230;
const COVER_H=44, COVER_HITS=5; // a tall rock can be cover; the arena stone gives out after this many caught blows
function hangLit(l){ if(l.gut){ const [per,on,ph]=l.gut; return ((game.t+ph)%per)<on; } return l.lit; }
function hangFlicker(l){ if(!l.gut) return 0; const [per,on,ph]=l.gut; const t=(game.t+ph)%per; return t<on&&t>on-0.6?1:0; }
function pullTarget(){ let best=null,bd=1e9; const px=P.x, py=P.y-27;
  for(const l of A.hang){ if(!hangLit(l)||l.y>P.y-10||l===P.lastPull) continue; const dd=Math.hypot(l.x-px,l.y-py); if(dd>PULL_R) continue; const k=dd+((l.x-px)*P.face<-20?140:0); if(k<bd){ bd=k; best=l; } }
  return best; }
function trail(n,gold){ for(let i=0;i<n;i++) A.particles.push({x:P.x-P.vx*0.012*i,y:P.y-12-(i%3)*14,vx:-P.vx*0.08,vy:-10,life:0.35,t:0,gold:gold?1:0,soft:gold?0:1}); }
function lightMove(inp){
  const m=game.moves|0; if(!m||P.ember||P.pull) return;
  if(m>=3){ const l=pullTarget(); if(l){ if(P.light<1){ sfx.fizzle(); return; } P.light-=1; P.pull={l,t:0}; P.dashT=0; P.adT=0; P.carry=0; P.stomp=false; P.kneel=0; sfx.pull(); game.log.push(['move','pull',game.areaI,P.x|0]); return; } }
  if(P.ground||P.coy>0){ if(P.dashCD>0) return; if(P.light<1){ sfx.fizzle(); return; }
    P.light-=1; const dir=inp.l&&!inp.r?-1:inp.r&&!inp.l?1:P.face; P.dashDir=dir; P.face=dir; P.dashT=DASH_T; P.dashCD=0.34; P.kneel=0; { const mo=A.d.moon; if(mo&&dir>0&&P.x>mo.x0-90&&P.x<mo.x0) A.moonT=game.t; } sfx.dash(); trail(6,1); game.log.push(['move','dash',game.areaI,P.x|0]); return; }
  if(m>=2&&P.airDash&&P.adT<=0){ if(P.light<2){ sfx.fizzle(); return; }
    P.light-=2; P.airDash=false; let x=(inp.r?1:0)-(inp.l?1:0), y=(inp.u?-1:0)+(inp.dh?1:0); if(!x&&!y) x=P.face; const n=Math.hypot(x,y);
    P.adV=[x/n*AD_V,y/n*AD_V]; P.adT=AD_T; P.carry=0; P.dashT=0; P.stomp=false; if(x) P.face=Math.sign(x); sfx.adash(); trail(8,1); game.log.push(['move','adash',game.areaI,P.x|0]); }
}
function nearBrazier(lit){ let best=null,bd=36; for(const b of A.braziers){ if(b.arena||!!b.lit!==lit) continue; const dd=Math.abs(b.x-P.x); if(dd<bd){ bd=dd; best=b; } } return best; }
function dropEmber(){ if(!P.ember) return; P.ember=false; if(P.emberFrom) P.emberFrom.relight=3; P.emberFrom=null; sfx.snuff(); for(let i=0;i<12;i++) A.particles.push({x:P.x+P.face*8,y:P.y-PH*PS-4,vx:(i-6)*8,vy:-20-i*3,life:0.9,t:0,gold:0,ash:1}); }
function downMove(inp){
  const m=game.moves|0;
  if(P.ground){
    if(P.ember){ const b=nearBrazier(false); if(b){ b.lit=true; b.t=0; b.snuff=0; P.ember=false; P.emberFrom=null; sfx.lantern(); sfx.ember(); game.log.push(['move','kindle',game.areaI,P.x|0]); return; }
      const e=A.eyes.find(e=>e.sleep&&Math.abs(e.x-P.x)<44); if(e&&enterSecret(e.n)){ P.ember=false; return; }
      dropEmber(); return; }
    if(m>=5){ const b=nearBrazier(true); if(b){ b.lit=false; b.from=1; P.emberFrom=b; P.ember=true; P.kneel=0; sfx.ember(); sfx.lantern(); game.log.push(['move','carry',game.areaI,P.x|0]); return; } }
    return; }
  if(m>=6&&!P.ember&&!P.stomp&&!P.pull&&P.adT<=0){ if(P.light<1){ sfx.fizzle(); return; } P.light-=1; P.stomp=true; P.vx*=0.35; P.carry=0; P.dashT=0; P.vy=STOMP_V; sfx.stomp(); game.log.push(['move','stomp',game.areaI,P.x|0]); }
}
function leaveGround(){ if(P.ground||!(P.airSince>0)) P.airSince=game.t; P.ground=false; } // the touch "up" gate reads this clock: a later jump press is after you left the ground
function bounce(){ P.vy=-BOUNCE_V; P.stomp=false; P.airDash=true; P.inv=0.25; leaveGround(); P.plat=null; sfx.bounce(); game.shake=Math.max(game.shake,0.12);
  for(let i=0;i<10;i++){ const a=Math.PI*(0.1+0.8*i/9); A.particles.push({x:P.x,y:P.y,vx:Math.cos(a)*90,vy:Math.sin(a)*40,life:0.4,t:0,gold:1}); } }
// v11.4: a jump landing on a small walker. Not a star-fall (that one costs light and works on anything).
// Side-on is still a hit. Wisps, flyers, spitters, throwers, spears, stalkers and bosses are not stepped on.
function headStomp(prevY,ny){
  let best=null;
  for(const e of A.enemies){
    if(e.calm||e.t!=='walker') continue;
    // The head band sits where a full jump can reach. The sprite is taller than the hop, so the
    // very top of the painting is not the step. Feet already down in the body are still a side hit.
    const top=e.y-Math.min(e.h*0.55,46), hw=e.h*0.2+8;
    if(Math.abs(P.x-e.x)>hw) continue;
    if(prevY>top+8) continue; // feet were already down in the body
    if(ny<top) continue;
    if(!best||top<best.top) best={e,top};
  }
  return best;
}
function doHeadStomp(e){
  e.hp=0; e.hit=0.4; calmEnemy(e);
  P.vy=-HOP_V; leaveGround(); P.plat=null; P.inv=0.3; P.carry=0; P.airDash=true;
  sfx.bounce();
  for(let i=0;i<6;i++){ const a=Math.PI*(0.15+0.7*i/5); A.particles.push({x:P.x,y:e.y-e.h,vx:Math.cos(a)*50,vy:Math.sin(a)*22,life:0.35,t:0,gold:1}); }
  game.log.push(['headstomp',game.areaI,e.spr||e.t,P.x|0]);
}
function stompCheck(prevY){
  for(const b of A.bells){ const top=b.y-16; if(Math.abs(P.x-b.x)<24&&prevY<=top+6&&P.y>=top){ P.y=top; bounce(); b.ring=0.6; sfx.bellhit(); game.log.push(['bell',game.areaI,b.x|0]); return; } }
  for(const e of A.enemies){ if(e.calm) continue; const rr=e.t==='wisp'?18:e.h*0.32, cy=e.t==='wisp'?e.y:e.y-e.h*0.62;
    if(Math.abs(P.x-e.x)<rr+10&&P.y>cy-rr-8&&P.y<cy+rr){ e.hp--; e.hit=0.4; e.tele=0; if(e.hp<=0) calmEnemy(e); bounce(); return; } }
  for(const sh of A.shots){ if(sh.wait>0||sh.turned) continue; if(Math.abs(P.x-sh.x)<sh.r+10&&P.y>sh.y-sh.r-10&&P.y<sh.y+sh.r+4){ sh.dead=1; for(let i=0;i<6;i++) A.particles.push({x:sh.x,y:sh.y,vx:(i-3)*30,vy:-20,life:0.4,t:0,gold:1}); bounce(); return; } }
}
function stepPull(dt){
  const p=P.pull, l=p.l; p.t+=dt; const tx=l.x, ty=l.y+56; const dx=tx-P.x, dy=ty-P.y, dd=Math.hypot(dx,dy);
  if(dd<=PULL_V*dt||p.t>0.9){ P.x=tx; P.y=ty; P.pull=null; P.lastPull=l; P.vx=(Math.sign(dx)||P.face)*160; P.vy=-230; leaveGround(); P.plat=null; P.airDash=true; P.coy=0; P.carry=0;
    sfx.lantern(); for(let i=0;i<10;i++){ const a=i/10*TAU; A.particles.push({x:l.x,y:l.y+4,vx:Math.cos(a)*70,vy:Math.sin(a)*70,life:0.5,t:0,gold:1}); }
    // a lit lantern passes its light to the next dark one along the chain
    for(const o of A.hang) if(!o.lit&&!o.gut&&!o.hidden&&o!==l&&Math.abs(o.x-l.x)<185&&Math.abs(o.y-l.y)<90){ o.lit=true; o.t=0; sfx.lantern(); }
    if(l.hidden) enterSecret(3);
    return; }
  P.vx=dx/dd*PULL_V; P.vy=dy/dd*PULL_V; P.x+=P.vx*dt; P.y+=P.vy*dt; if(Math.abs(dx)>2) P.face=Math.sign(dx); leaveGround(); P.plat=null;
  if(Math.random()<0.6) A.particles.push({x:P.x,y:P.y-30,vx:-P.vx*0.05,vy:-P.vy*0.05,life:0.3,t:0,gold:1});
}
function stepPlayer(dt,inp){
  const d=A.d;
  if(P.bumpT>0) P.bumpT-=dt; if(P.bumpCd>0) P.bumpCd-=dt;
  if(P.inv>0) P.inv-=dt; if(P.dashCD>0) P.dashCD-=dt; if(P.dashG>0) P.dashG-=dt; if(P.knockT>0) P.knockT-=dt;
  if(P.shineCD>0) P.shineCD-=dt;
  if(P.pull){ if(P.hurtT>0) P.hurtT-=dt; stepPull(dt); return; }
  let want=0; if(P.ctrl&&!P.dead){ if(inp.l) want-=1; if(inp.r) want+=1; }
  P.kneel=(P.ctrl&&!P.dead&&P.ground&&inp.dh&&!want&&!P.ember&&P.dashT<=0)?P.kneel+dt:0; // holding down, still: kneel
  if(P.ctrl&&!P.dead&&inp.cp) lightMove(inp);
  if(P.ctrl&&!P.dead&&inp.dp) downMove(inp);
  if(P.pull) return;
  const spd=SPD*(P.light<=0&&(game.areaI<7||A.d.secret)?0.85:1)*(P.hurtT>0.6?0.4:1)*(P.ember?0.8:1);
  const acc=P.ground?1400:900;
  if(P.adT>0){ // light-dash: a straight line, no gravity, then it carries on
    P.adT-=dt; P.vx=P.adV[0]; P.vy=P.adV[1]; if(P.adT<=0){ P.vy=P.adV[1]>0?220:P.adV[1]<0?-200:0; P.carry=P.adV[0]?Math.sign(P.adV[0])*AD_CARRY:0; }
  } else {
    if(want&&P.knockT<=0){ P.vx+=want*acc*dt; P.face=want; } else if(!(P.carry&&!P.ground)){ const f=P.ground?1600:500; P.vx-=Math.sign(P.vx)*Math.min(Math.abs(P.vx),f*dt); }
    if(P.dashT>0){ P.dashT-=dt; P.vx=P.dashDir*DASH_V; if(P.dashT<=0) P.dashG=0.14; if(Math.random()<0.5) trail(1,0); }
    else if(P.hurtT<=0.6&&P.knockT<=0){ const lim=P.carry&&!P.ground?Math.max(spd,Math.abs(P.carry)):spd; P.vx=clamp(P.vx,-lim,lim); }
    if(P.carry&&!P.ground&&P.dashT<=0&&P.hurtT<=0.6){ if(want===-Math.sign(P.carry)) P.carry=0; else P.vx=P.carry; }
  }
  if(P.hurtT>0) P.hurtT-=dt;
  P.coy=P.ground?0.1:P.coy-dt; P.buf=inp.jp?0.13:P.buf-dt;
  if(P.ctrl&&!P.dead&&P.buf>0&&P.coy>0&&P.adT<=0){ P.vy=-JV*(P.ember?0.9:1); leaveGround(); P.coy=0; P.buf=0; P.plat=null; P.kneel=0; sfx.jump();
    if(P.dashT>0||P.dashG>0){ P.carry=P.dashDir*CARRY_V; P.dashT=0; P.dashG=0; } }
  if(!inp.j&&P.vy<-120&&P.adT<=0&&!P.stomp) P.vy+= GRAV*1.4*dt; // variable jump height
  if(P.adT<=0){ P.vy+=GRAV*dt; if(P.vy>800) P.vy=800; }
  if(P.plat&&P.ground){ P.x+=P.plat.dx; }
  let nx=P.x+P.vx*dt, rockContact=false;
  if(blockedX(nx,P.y)) { if(game.night&&P.ground) for(const so of d.solids) if(so.hollow!==undefined&&Math.abs(nx-(P.vx>0?so.x-PW/2:so.x+so.w+PW/2))<8){ if(P.dashT>0&&enterSecret(so.hollow)){ game.shake=0.4; sfx.thud(); return; } if((A.tokT||0)<game.t){ A.tokT=game.t+1.2; sfx.tok(); } }
    // v11.4: walking into a rock or a block. A bump and a short push, so a stop reads as the stone and not a stuck walk.
    if(P.ground&&!P.dead){ for(const so of d.solids) if(nx>so.x-PW/2&&nx<so.x+so.w+PW/2&&P.y>solidTop(so)+4){ rockContact=true; if(!P.bumpHold){ P.bumpHold=1; P.bumpT=0.34; P.bumpDir=Math.sign(P.vx)||P.face||1; sfx.bump(); game.log.push(['bump',P.x|0]); } break; } }
    nx=P.x; P.vx=0; P.carry=0; if(P.adT>0){ P.adV[0]=0; } }
  if(!rockContact) P.bumpHold=0;
  P.x=nx;
  const prev=P.y+(P.plat&&P.ground?P.plat.dy:0); let ny=P.y+P.vy*dt;
  const hopped=P.vy>40&&!P.stomp&&P.adT<=0?headStomp(prev,ny):null;
  if(hopped){ doHeadStomp(hopped.e); ny=hopped.top; }
  const [fy,plat]=floorAt(P.x,prev);
  if(!hopped&&P.vy>=0&&ny>=fy&&prev<=fy+12){ if(!P.ground&&P.vy>250){ sfx.land(); P.sq=Math.min(1,P.vy/600); for(let i=0;i<6;i++) A.particles.push({x:P.x+(i-2.5)*5,y:fy-2,vx:(i-2.5)*22,vy:-12-(i%3)*8,life:0.35,t:0,gold:0,soft:1}); }
    if(P.stomp&&plat&&plat.upd!==undefined&&enterSecret(plat.upd)){ game.shake=0.3; sfx.crack(); return; }
    if(P.stomp){ P.stomp=false; game.shake=Math.max(game.shake,0.15); }
    ny=fy; P.vy=0; P.ground=true; P.plat=plat; P.carry=0; P.airDash=true; P.adT=0; P.lastPull=null; P.airSince=0; P.jumpT=0; if(plat&&plat.rot&&!plat.rt){ plat.rt=0.001; sfx.creak(); } }
  else if(P.ground&&P.vy>=0&&fy-ny<14&&fy>ny){ ny=fy; P.vy=0; P.plat=plat; }
  else { leaveGround(); P.plat=null; }
  P.y=ny;
  if(P.stomp&&P.vy>0) stompCheck(prev);
  if(P.ground&&!plat&&d.gy(P.x)<1e8){ let nearGap=false; for(const g of d.gaps) if(P.x>g[0]-50&&P.x<g[1]+30) nearGap=true; if(!nearGap) P.safeX=P.x; }
  if(P.ground&&Math.abs(P.vx)>20){ P.walk+=dt*Math.abs(P.vx)/24; P.stepT-=dt; if(P.stepT<=0){ sfx.step(); P.stepT=0.34; } }
  else P.walk+=(Math.round(P.walk/Math.PI)*Math.PI-P.walk)*Math.min(1,dt*8);
  if(P.sq>0) P.sq=Math.max(0,P.sq-dt*5);
  if(P.y>H+160&&!P.dead) fall();
}
function fall(){
  game.stats.falls++; sfx.splash(); game.log.push(['fall',game.areaI,P.x|0]);
  /*@DEV*/if(P.auto) for(const m of A.motes) if(Math.abs(m.x-P.x)<90) bot.skip.add(m);/*@/DEV*/
  if(A.d.key==='river') say('g10');
  const mo=A.d.moon; if(mo&&A.moonT&&game.t-A.moonT<1.8&&P.x>mo.x0-20&&P.x<mo.x1+40&&enterSecret(mo.n)) return;
  const sp=A.d.secretPit; if(sp&&A.s1armed&&P.x>sp.x0-10&&P.x<sp.x1+10&&enterSecret(sp.n)) return;
  const FB=A.boss; if(GOD){ respawn(FB&&!FB.calm&&FB.st!=='sleep'?FB.a0+20:A.act===2?Math.max(P.safeX,A.d.act2+6):P.safeX); return; }
  P.fellT=1; loseLife('fall');
}
function respawn(x){ game.fade=0.9; P.x=x; P.y=A.d.gy(x); if(P.y>1e8) P.y=BASE; P.vx=0; P.vy=0; P.ground=true; P.plat=null; P.hurtT=0.6; P.fellT=0; holdView(); }
function loseLife(why){
  if(P.dead>0||game.state!=='play') return;
  if(P.ember) dropEmber(); P.pull=null; P.stomp=false; P.adT=0; P.dashT=0; P.carry=0;
  game.lives--; game.stats.lost++; P.dead=DEATH_T; P.deadWhy=why; P.ctrl=false; P.vx=0; sfx.death(); game.flash=0.7; game.shake=Math.max(game.shake,0.4); game.stop=Math.max(game.stop,0.1);
  game.log.push(['life',game.areaI,why,game.lives,P.x|0]);
  recordDeath(why);
  if(P.fellT){ // sink and splash
    const wy=BASE+34; for(let i=0;i<34;i++){ const a=-Math.PI*(0.15+0.7*(i/33)); const v=90+(i%5)*40; A.particles.push({x:P.x,y:wy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0.9,t:0,gold:0,water:1}); } }
  else if(why==='dark'||why==='ember'||why==='cold'){ sfx.ash(); // fade to ash
    for(let i=0;i<46;i++){ A.particles.push({x:P.x+((i*7)%30-15),y:P.y-((i*13)%60),vx:((i*5)%20-10),vy:-18-(i%6)*6,life:1.6+(i%4)*0.3,t:0,gold:0,ash:1}); } }
  else for(let i=0;i<44;i++){ const a=i/44*TAU,v=60+(i%6)*30; A.particles.push({x:P.x,y:P.y-34,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:1.0+(i%3)*0.3,t:0,gold:1,big:i%7===0}); } // shatter
}

function recordDeath(why){
  let ai=game.areaI, x=P.x, sec=0; if(A.d.secret&&game.secretFrom){ ai=game.secretFrom.areaI; x=game.secretFrom.ret; sec=1; }
  const B=A.boss, fight=!sec&&B&&!B.calm&&B.st!=='sleep';
  if(!(A.d.secret&&!game.secretFrom)){ noteFar(ai,x); // v10
    if(game.fromStart){ const c=dmNote(ai); const l=c===3?'rp5':c===10?'rp6':c===25?'rp7':null; if(l) say(l,{delay:0.6}); } } // v11
  game.deaths.push({ai,x:x|0,why,sec,boss:fight?{name:B.name,hit:B.max-B.hp,max:B.max,phase:B.phase,nph:B.nph}:null});
}
/* ---------------- secrets ---------------- */
function enterSecret(n){
  if(game.secretsSpent.has(n)||game.relics.has(n)||game.state!=='play'||(P.auto&&!Q.has('secrets'))) return false;
  const sd=SECRETS[n]; game.secretsSpent.add(n); if(P.ember) P.ember=false; P.pull=null; P.stomp=false; P.adT=0; P.dashT=0; P.carry=0;
  game.secretFrom={A,areaI:game.areaI,ret:LAND(sd.from).secRet[n],n,light:P.light};
  game.state='trans'; game.transT=0; game.transDone=false; P.ctrl=false; P.dead=0; P.fellT=0; sfx.veil();
  game.transFn=()=>{ setupArea(sd.area); say(sd.enter,{delay:0.6}); };
  game.log.push(['secret',n,+game.t.toFixed(1)]); return true;
}
function exitSecret(won){
  const f=game.secretFrom; if(!f) return;
  game.state='trans'; game.transT=0; game.transDone=false; P.ctrl=false;
  game.transFn=()=>{ A=f.A; game.areaI=f.areaI; game.secretFrom=null; const d=A.d; A.shots.length=0; if(!won) P.light=Math.max(P.light,Math.min(3,f.light));
    respawn(f.ret); P.dead=0; P.ctrl=true; P.hurtT=0.8; resetMoves(); camX=clamp(P.x-W*0.36,0,d.len-W); camY=0; holdView(); playMusic(d.music);
    syncArt(); };
  game.log.push(['secretout',f.n,won,+game.t.toFixed(1)]);
}
function getRelic(){
  const r=A.relic; if(!r||r.got) return; r.got=true; const n=A.d.secret-1; game.relics.add(n);
  if(game.lives<(game.ember?1:MAX_LIVES)){ game.lives++; game.stats.oneups++; }
  sfx.oneup(); sfx.shrine(); game.flash=0; popup('RELIC',r.x,gyOr(r.x)-110); popup('1 UP',r.x,gyOr(r.x)-80);
  for(let i=0;i<60;i++){ const a=Math.random()*TAU,v=60+Math.random()*200; A.particles.push({x:r.x,y:gyOr(r.x)-50,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:1.5+Math.random(),t:0,gold:1}); }
  sayNow(SECRETS[n].riddle); game.log.push(['relic',n,game.relics.size]);
}

/* ---------------- light actions ---------------- */
function gainLight(n){
  // One pool. A mote adds to the light a shine spends (3 a time), up to forty — thirteen shines.
  // There is no separate weapon charge left empty while the counter climbs.
  P.light=Math.min(LIGHT_CAP,P.light+(n||1));
}
function shine(){
  const s=A.shrine, B=A.boss;
  if(s&&!s.awake&&Math.abs(P.x-s.x)<55){
    if(B&&!B.calm){ sfx.fizzle(); showHint(`${B.name} still watches. The stone will not wake.`,3); return; }
    if(P.light>=s.need) wakeShrine(); else { sfx.fizzle(); showHint(`The stone wants ${s.need} light. You carry ${P.light}.`,3.5); }
    return;
  }
  if(P.shineCD>0) return;
  if(P.light<SHINE_COST){ sfx.fizzle(); showHint(`Not enough light (a shine takes ${SHINE_COST}).`,2.5); return; }
  P.light-=SHINE_COST; P.shineCD=SHINE_CD; sfx.pulse(); game.log.push(['shine',game.areaI,P.x|0]); // the same light motes refill
  const ss=A.d.secretShine; if(ss&&!P.auto&&P.ground&&P.plat&&P.plat.x0===ss.plat&&!(A.boss&&!A.boss.calm&&A.boss.st!=='sleep')) enterSecret(ss.n);
  const R=150+Math.min(P.light,30)*3, cy=P.y-30; // v7: the more light you carry, the further a shine reaches (up to 30)
  A.rings.push({x:P.x,y:P.y-PH+8,r:10,R,t:0});
  // v5 turnlight: a shine timed as a shot reaches you sends it back where it came from
  if((game.moves|0)>=4){ const ty=P.y-28; for(const sh of A.shots){ if(sh.wait>0||sh.turned||sh.k==='wave'||sh.k==='hwave') continue; const dx=P.x-sh.x, dy=ty-sh.y; if(Math.hypot(dx,dy)<TURN_R&&(sh.vx*dx+sh.vy*dy)>0) turnShot(sh); } }
  for(const e of A.enemies){ if(e.calm) continue; const ey=e.t==='wisp'?e.y:e.y-e.h*0.5; const dd=Math.hypot(e.x-P.x,ey-cy); if(dd<R){ e.hp--; e.hit=0.4; e.tele=0; if(e.hp<=0) calmEnemy(e); else e.vx=Math.sign(e.x-P.x||1)*160; } }
  for(const sh of A.shots){ if(sh.wait>0||sh.turned||sh.heavy) continue; if(Math.hypot(sh.x-P.x,sh.y-cy)<R){ sh.dead=1; for(let i=0;i<5;i++){ const a=Math.random()*TAU; A.particles.push({x:sh.x,y:sh.y,vx:Math.cos(a)*50,vy:Math.sin(a)*50,life:0.5,t:0,gold:1}); } } }
  if(B&&!B.calm&&B.st!=='sleep'&&B.st!=='intro'){ const by=B.y-B.h*0.5; if(Math.hypot(B.x-P.x,by-cy)<R+B.h*0.3){
    if(B.st==='rest'&&B.iT<=0) bossHit(); else if(B.st!=='rest'){ popup('deflected',B.x,B.y-B.h-10); sfx.fizzle(); } } }
  for(const l of A.lanterns){ if(!l.lit&&Math.abs(l.x-P.x)<R){ l.lit=true; l.t=0; game.stats.lanterns++; sfx.lantern(); say('g03'); } }
  for(const l of A.hang){ if(!l.lit&&!l.gut&&Math.abs(l.x-P.x)<R){ l.lit=true; l.t=0; sfx.lantern(); } }
  for(const b of A.braziers){ if(!b.lit&&!b.cold&&Math.abs(b.x-P.x)<R){ b.lit=true; b.t=0; b.snuff=0; sfx.lantern(); } } // v4: braziers keep the dark away but are no longer checkpoints
  for(const n of A.npcs){ if(Math.abs(n.x-P.x)<R) n.lit=true; }
}
function turnShot(sh){ const B=A.boss; let tx=sh.ox, ty=sh.oy;
  if(sh.src==='boss'&&B){ tx=B.x; ty=B.y-B.h*0.5; } else if(sh.cat){ tx=sh.cat.x; ty=sh.cat.y-16; } else if(sh.src&&sh.src.x!==undefined){ const e=sh.src; tx=e.x; ty=e.t==='wisp'?e.y:e.y-e.h*0.55; }
  const sp=Math.max(340,Math.hypot(sh.vx,sh.vy)*1.25), a=Math.atan2(ty-sh.y,tx-sh.x); sh.vx=Math.cos(a)*sp; sh.vy=Math.sin(a)*sp; sh.g=0; sh.turned=1; sh.t=0; sh.life=2.4;
  sfx.turn(); game.stop=Math.max(game.stop,0.05); A.rings.push({x:sh.x,y:sh.y,r:4,R:40,t:0.1}); game.log.push(['turn',game.areaI,sh.k,P.x|0]); }
function wreckCat(c){ c.dead=true; c.dt=0; game.stats.calmed++; sfx.thud(); sfx.calm(); game.shake=Math.max(game.shake,0.35);
  for(let i=0;i<26;i++){ const a=i/26*TAU; A.particles.push({x:c.x,y:c.y-10,vx:Math.cos(a)*120,vy:Math.sin(a)*120-40,life:0.9,t:0,gold:i%2}); }
  for(let i=0;i<4;i++) dropMote(c.x+(i-1.5)*34,28+(i%2)*14); game.log.push(['cat',game.areaI,c.x|0]); }
function dropMote(x,above,fromSky){
  const B=A.boss; if(B&&!B.calm&&B.st!=='sleep') x=clamp(x,B.a0+30,B.a1-30);
  if(A.d.gy(x)>1e8){ for(const g of A.d.gaps) if(x>g[0]&&x<g[1]) x=(x-g[0]<g[1]-x)?g[0]-20:g[1]+20; }
  const ty=gyOr(x)-above; const m=mkMote(x,fromSky?camY-20:ty); m.ty=ty; m.born=0; m.drop=1; A.motes.push(m); return m;
}
function calmEnemy(e){
  e.calm=true; e.ct=0; game.stats.calmed++; sfx.calm(); say('g04');
  { const ey=e.t==='wisp'?e.y:e.y-e.h*0.5; A.rings.push({x:e.x,y:ey,r:4,R:60,t:0.1}); for(let i=0;i<18;i++){ const a=i/18*TAU; A.particles.push({x:e.x,y:ey,vx:Math.cos(a)*110,vy:Math.sin(a)*110,life:0.55,t:0,gold:1}); } }
  const n=e.t==='stalker'?2:1;
  for(let i=0;i<n;i++) dropMote(e.x+(i-(n-1)/2)*26,30+i*6);
}
function bossHit(){
  const B=A.boss; B.hp-=1; B.iT=0.75; B.hit=0.45; sfx.bosshit(); game.shake=0.3; game.stop=Math.max(game.stop,0.07);
  game.log.push(['bosshit',B.key,B.hp,B.phase]);
  dropMote(P.x+(B.x>P.x?-40:40),28);
  if(B.hp<=0) calmBoss();
  else if(B.phase<B.nph&&B.hp<=B.th[B.phase-1]) bossPhase();
}
/* v4: multi-phase bosses. Two phases each, three for the King of Bell. A new phase is a telegraphed
   moment (roar, shake, the cut-out swells and burns brighter), adds one attack and shortens the rest. */
function bossResetPhase(B){ B.phase=1; B.nph=B.p3?3:B.p2?2:1; B.th=B.nph===3?[Math.round(B.max*2/3),Math.round(B.max/3)]:[Math.ceil(B.max/2)]; B.list=B.atks; B.restT=1.7; B.ringN=0; B.dropN=0; B.slotN=0; B.tideN=0; B.tileN=0; B.decreeN=0; B.snuffN=0; B.swell=0;
  if(game.night&&B.nph>1){ B.phase=2; B.list=B.p2; B.restT=1.3; } } // v6: in the Long Night every boss starts in its second form
const REST_T=[1.7,1.3,1.0];
function bossPhase(){
  const B=A.boss; B.phase++; B.list=B.phase===3?B.p3:B.p2; B.restT=REST_T[B.phase-1]; B.ai=0;
  B.st='phase'; B.t=0; B.iT=2.2; for(const s of A.shots) s.dead=1; A.decoys.length=0;
  game.shake=0.9; game.flash=0.25; game.stop=Math.max(game.stop,0.12); sfx.roar(); sfx.phase(B.phase);
  game.bossBanner={name:B.name,t:0,sub:B.phase===2?'II':'III'};
  for(let i=0;i<50;i++){ const a=i/50*TAU; A.particles.push({x:B.x,y:B.y-B.h*0.5,vx:Math.cos(a)*190,vy:Math.sin(a)*190,life:0.9,t:0,gold:1}); }
  game.log.push(['phase',B.key,B.phase,+game.t.toFixed(1)]);
}
function clearBossHazards(){ A.fires.length=0; A.pillars.length=0; A.tide=null; A.tiles=null; A.d.dyn=null; A.decoys.length=0; A.shots.length=0; }
function calmBoss(){
  const B=A.boss; B.calm=true; B.st='calm'; B.ct=0; game.stats.bosses++; sfx.calm(); setTimeout(()=>sfx.shrine(),400); game.slowT=0.9; game.stop=Math.max(game.stop,0.1);
  clearBossHazards(); for(const b of A.braziers) if(b.arena){ b.lit=true; b.snuff=0; }
  for(let i=0;i<70;i++){ const a=i/70*TAU,v=120+(i%5)*40; A.particles.push({x:B.x,y:B.y-B.h*0.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1.4,t:0,gold:1,big:i%4===0}); }
  sayNow(B.win||'bw1'); game.paint={k:'calm',t:0}; // v10
  for(let i=0;i<8;i++) dropMote(B.x+(i-3.5)*34,30+(i%2)*26);
  for(const s of A.shots) s.dead=1;
  for(const e of A.enemies) if(!e.calm&&Math.abs(e.x-B.x)<400) calmEnemy(e);
  game.log.push(['boss',game.areaI,B.key,+game.t.toFixed(1)]);
  setCP(clamp(P.x,B.a0+20,B.a1-20),true);
}
function wakeShrine(){
  const s=A.shrine; s.awake=true; s.t=0; game.stats.shrines++;
  P.light-=s.need; sfx.shrine(); game.log.push(['shrine',game.areaI,+game.t.toFixed(1)]);
  for(let i=0;i<s.need;i++) A.streams.push({x0:P.x,y0:P.y-PH,x1:s.x,y1:A.d.gy(s.x)-48,t:-i*0.08});
  s.lines.forEach((l,i)=>say(l,{delay:i?0:0.8})); game.paint={k:'wake',t:0}; // v10: the painting opens up as the stone wakes
  setTimeout(()=>sfx.veil(),1200);
  if(P.light<2) P.light=2; // a little warmth to carry on
  setCP(s.x,true);
  grantMove(game.areaI);
}
function grantMove(ai){ if(ai>5||(game.moves|0)>ai) return; game.moves=ai+1; setTimeout(()=>sfx.gain(),900); showHint(moveHint(ai),10); say('gv1',{delay:0.4}); game.log.push(['move',ai+1,+game.t.toFixed(1)]);
}
// light is your shield: a hit takes light; a hit with none left takes a life
function hurt(src,amt){
  if(P.hurtT>0||P.inv>0||P.dead>0||game.state!=='play') return;
  game.stats.hits++; P.dashT=0; P.dashG=0; P.adT=0; P.carry=0; P.stomp=false; P.pull=null; P.kneel=0; if(P.ember) dropEmber();
  P.hurtT=1.0; P.vx=Math.sign(P.x-src.x||-P.face)*240; P.vy=-200; leaveGround(); P.plat=null; sfx.hurt(); game.flash=0.35; game.shake=Math.max(game.shake,0.18); game.stop=Math.max(game.stop,0.05);
  game.log.push(['hit',game.areaI,P.x|0,amt,P.light]);
  if(GOD) return;
  if(P.light<=0){ loseLife('hit'); return; }
  const lost=Math.min(P.light,amt); for(let i=0;i<lost*5;i++){ const a=-Math.PI*(0.1+0.8*((i*0.618)%1)), v=110+(i%4)*45; A.particles.push({x:P.x,y:P.y-30,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0.55+(i%3)*0.12,t:0,gold:1}); } // v10
  P.light=Math.max(0,P.light-amt);
  if(P.light<=1) say('g08');
}
function nearGap(x,pad){ if(!A) return false; const d=A.d; for(const g of d.gaps) if(x>g[0]-pad&&x<g[1]+pad) return true; if(d.dyn) for(const g of d.dyn) if(x>g[0]-pad&&x<g[1]+pad) return true; return false; }
function showLegend(){ if(game.legendSeen||(!game.legendWant&&!game.legendAtShine)) return; if(A&&A.hintT>0) return; if(!game.legendAtShine&&nearGap(P.x,120)) return; game.legendSeen=1; game.legendT=4.6; game.legendWant=0; game.legendAtShine=0; }
function situationHint(t){ return /^Not enough light/.test(t)||/taking you/.test(t)||/^The stone/.test(t)||/still watches/.test(t); }
function showHint(t,ttl,key){
  if(!A) return;
  // v11.4: two control hints can wait. A situation hint (no light, the dark, a stone) replaces what is showing and leaves the queue.
  if(situationHint(t)){ A.hint=t; A.hintT=ttl; A.hintKey=key||'sit'; return; }
  if(A.hintT>0.25||game.legendT>0.05){ if(!A.hintQ) A.hintQ=[]; if(A.hintQ.length<2) A.hintQ.push({t,ttl,key:key||''}); return; }
  A.hint=t; A.hintT=ttl; A.hintKey=key||'';
}
function popup(t,x,y){ game.popups.push({t,x,y,life:1.6,a:0}); }

/* ---------------- bosses ---------------- */
let SRC=null;
function lob(x,y,tx,ty,T,k,dmg){ const g=520; A.shots.push({x,y,vx:(tx-x)/T,vy:(ty-y-0.5*g*T*T)/T,g,r:8,k,dmg,life:4,src:SRC,ox:x,oy:y}); }
function aim(x,y,tx,ty,spd,k,dmg,wait=0){ const a=Math.atan2(ty-y,tx-x); A.shots.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,g:0,r:8,k,dmg,life:4,wait,src:SRC,ox:x,oy:y}); }
function bossAttack(k){ const n0=A.shots.length; SRC='boss'; bossAttack0(k); SRC=null; for(let i=n0;i<A.shots.length;i++){ const s=A.shots[i]; s.src='boss'; if(s.ox===undefined){ s.ox=s.x; s.oy=s.y; } } }
function bossAttack0(k){
  const B=A.boss; const bx=B.x, by=B.y-B.h*0.6, px=P.x, py=P.y-28; sfx.throw();
  if(k==='arc'){ for(let i=0;i<B.n;i++) lob(bx,by,px+(i-(B.n-1)/2)*55,py,0.85+i*0.18,'orb',2); }
  else if(k==='aim'){ for(let i=0;i<B.n;i++) aim(bx,by,px,py,200,'orb',2,i*0.22); }
  else if(k==='rain'){ for(let i=0;i<5;i++){ const x=clamp(px+(i-2)*72,B.a0+20,B.a1-20); A.shots.push({x,y:camY-14,vx:0,vy:30,g:430,r:9,k:'orb',dmg:2,wait:0.5+i*0.2,warn:1,life:5}); } }
  else if(k==='ring'){ B.ringN=(B.ringN||0)+1; for(let i=0;i<10;i++){ const a=i/10*TAU+(B.ringN%2?TAU/20:0); A.shots.push({x:bx,y:by,vx:Math.cos(a)*125,vy:Math.sin(a)*125,g:0,r:8,k:'orb',dmg:2,life:4}); } }
  else if(k==='wave'){ for(const s of [-1,1]) A.shots.push({x:bx+s*30,y:gyOr(bx)-10,vx:s*215,vy:0,g:0,r:11,k:'wave',dmg:2,life:2.6}); game.shake=0.4; sfx.thud(); }
  else if(k==='charge'){ B.cdir=Math.sign(P.x-B.x)||1; B.cspd=B.fly?270:310; }
  else if(k==='summon'){ for(const s of [-1,1]){ const e=mkEnemy({t:'wisp',x:clamp(B.x+s*100,B.a0+20,B.a1-20)}); e.y=B.y-B.h*0.5; A.enemies.push(e); } }
  // Smonster: the tide. The waterline creeps in for 1.4 s, then the arena floor floods for 1.8 s. Only the sea rocks stay dry.
  else if(k==='tide'){ A.tide={t:0,warn:1.4,on:1.8,from:(B.tideN++%2)?1:-1}; sfx.tide(); }
  // Yogi Yogs: three of him, in fixed spots. Only the real one rests.
  else if(k==='split'){ const sl=[B.a0+90,(B.a0+B.a1)/2,B.a1-90]; const real=[2,0,1][B.slotN++%3]; A.decoys.length=0;
    sl.forEach((x,i)=>{ if(i===real){ B.x=x; } else A.decoys.push({x,y:gyOr(x)-B.fly,t:0,a:1}); });
    for(const [i,x] of sl.entries()) aim(x,gyOr(x)-B.fly-B.h*0.6,px,py,190,'orb',2,0.25+i*0.3);
    for(let i=0;i<30;i++){ const a=i/30*TAU; A.particles.push({x:B.x,y:B.y-B.h*0.5,vx:Math.cos(a)*120,vy:Math.sin(a)*120,life:0.6,t:0,gold:0}); } sfx.veil(); }
  // Battle Armour: dive onto the spot it marked, leaving a burning trail on the ground.
  else if(k==='dive'){ B.dvy=B.y; }
  // The Doig: its floor gives way, two tiles at a time, always in the same order.
  else if(k==='tiles'){ const T=A.d.tiles; const set=(B.tileN++%2)?[1,3]:[0,2]; A.tiles={t:0,crack:1.0,open:1.5,set:set.map(i=>T[i])}; sfx.rumble(); }
  // Neco: two Frygar spearmen take the edges of the camp and throw in turn.
  else if(k==='call'){ const alive=A.enemies.filter(e=>e.edge&&!e.calm).length; if(alive<2){ A.enemies=A.enemies.filter(e=>!(e.edge&&e.calm)); for(const [i,x] of [[0,B.a0+24],[1,B.a1-24]].map(([i,x])=>[i,x])){ if(A.enemies.some(e=>e.edge&&!e.calm&&e.x0===x)) continue; const e=mkEnemy({t:'frygar',x,r:0,cd:1.0+i*1.2}); e.edge=1; A.enemies.push(e); for(let j=0;j<16;j++) A.particles.push({x,y:gyOr(x)-30,vx:(j%2?1:-1)*(20+j*5),vy:-30-j*4,life:0.7,t:0,gold:0}); } sfx.horn(); } }
  // Vere: snuffs the arena braziers in turn (left, right, middle). Out of their light, the dark drinks yours.
  else if(k==='snuff'){ const br=A.braziers.filter(b=>b.arena); const ord=[0,2,1]; for(let n=0;n<3;n++){ const b=br[ord[(B.snuffN+n)%3]]; if(b&&b.lit&&!b.snuff){ b.snuff=1.0; break; } } B.snuffN++; }
  // The King of Bell: pillars of light rise from marked flagstones, alternating between two sets.
  else if(k==='decree'){ const w=B.a1-B.a0; const set=(B.decreeN++%2)?[0.29,0.6,0.91]:[0.13,0.44,0.75]; for(const f of set) A.pillars.push({x:B.a0+w*f,t:0,warn:1.0,on:0.6}); sfx.decree(); }
  // ...and in the last phase he rings the bell: shockwaves alternate low (jump them) and high (stay down).
  else if(k==='bell'){ const seq=['low','high','low','high']; seq.forEach((h,i)=>{ const w=0.35+i*0.85; for(const s of [-1,1]) A.shots.push({x:bx+s*30,y:h==='low'?gyOr(bx)-10:gyOr(bx)-96,vx:s*205,vy:0,g:0,r:h==='low'?11:12,k:h==='low'?'wave':'hwave',dmg:2,life:2.6,wait:w,hi:h==='high'}); tone(h==='low'?196:392,1.4,'sine',0.12,w-0.25); tone(h==='low'?98:784,1.0,'triangle',0.05,w-0.25); }); game.shake=0.3; }
}
function bossUpdate(dt,live){
  const B=A.boss; if(!B) return; B.t+=dt; B.ph+=dt; if(B.iT>0) B.iT-=dt; if(B.hit>0) B.hit-=dt;
  const gY=gyOr(B.x);
  if(B.calm){ B.ct+=dt; if(!B.kneel) B.y-=dt*14; return; }
  if(B.st==='sleep'){ B.y=gY; if(live&&P.x>B.a0+40){ B.st='intro'; B.t=0; if(vo.heard.has(B.line)) say(B.line); else sayNow(B.line); sfx.roar(); game.bossBanner={name:B.name,t:0}; game.log.push(['bosswake',B.key,+game.t.toFixed(1)]); } return; }
  if(!live) return;
  const dx=P.x-B.x; if(B.st!=='charge') B.face=Math.sign(dx)||1;
  if(B.st==='intro'){ if(B.t>2.4){ B.st='move'; B.t=0; } }
  else if(B.st==='move'){
    if(B.fly){ const tx=P.x+B.side*150; B.x+=clamp((tx-B.x)*1.5,-B.spd,B.spd)*dt; }
    else if(B.spd){ const want=Math.abs(dx)>120?Math.sign(dx):-Math.sign(dx)*0.6; B.x+=want*B.spd*dt; }
    if(B.t>B.move){ B.st='tele'; B.t=0; B.atk=B.list[B.ai++%B.list.length]; sfx.tele(); B.side=-B.side;
      if(B.atk==='dive'){ B.dtx=clamp(P.x,B.a0+50,B.a1-50); } }
  }
  else if(B.st==='phase'){ B.swell=Math.min(1,B.t/1.2); if(B.t>2.0){ B.st='move'; B.t=0; } }
  else if(B.st==='tele'){ if(B.t>0.75){ bossAttack(B.atk); B.st=B.atk==='charge'?'charge':B.atk==='dive'?'dive':'act'; B.t=0; } }
  else if(B.st==='dive'){ // rise, then drop onto the marked spot
    if(B.t<0.35){ B.y-=dt*160; B.x+=(B.dtx-B.x)*Math.min(1,dt*3); }
    else { B.x+=(B.dtx-B.x)*Math.min(1,dt*14); B.y+=dt*900; const g=gyOr(B.x); if(B.y>=g){ B.y=g; A.fires.push({x0:B.dtx-72,x1:B.dtx+72,t:0,life:2.8}); game.shake=0.5; sfx.thud(); sfx.flame(); B.st='rest'; B.t=0; B.grounded=1; } } }
  else if(B.st==='charge'){ B.x+=B.cdir*B.cspd*dt; if(B.x<=B.a0+40||B.x>=B.a1-40||B.t>2.2){ B.st='rest'; B.t=0; game.shake=0.25; sfx.thud(); } }
  else if(B.st==='act'){ if(B.t>0.9){ B.st='rest'; B.t=0; } }
  else if(B.st==='rest'){ if(B.t>B.restT){ B.st='move'; B.t=0; B.grounded=0; } }
  B.x=clamp(B.x,B.a0+40,B.a1-40);
  const hy=B.fly&&B.st!=='intro'? (B.grounded?gyOr(B.x):gyOr(B.x)-B.fly+Math.sin(B.ph*1.7)*10+(B.st==='rest'?45:0)) : gyOr(B.x);
  if(B.st!=='dive') B.y+=(hy-B.y)*Math.min(1,dt*(B.st==='charge'?8:B.grounded?10:3));
  bossHazards(dt);
  const by=B.y-B.h*0.5;
  if(B.st!=='intro'&&Math.abs(P.x-B.x)<B.h*0.26+6&&(P.y-30)>by-B.h*0.45&&(P.y-30)<by+B.h*0.5) hurt(B,3);
  // the arena never runs dry: a mote drifts down now and then (in a fixed order of spots)
  B.rain+=dt; if(B.rain>4.5){ B.rain=0; let n=0; for(const m of A.motes) if(!m.got&&m.x>B.a0&&m.x<B.a1) n++; if(n<2){ const k=(B.dropN=(B.dropN||0)+1); dropMote(B.a0+60+((k*0.618)%1)*(B.a1-B.a0-120),26+(k%3)*12,true); } }
}

function bossHazards(dt){
  const B=A.boss;
  // decoys (Yogi Yogs): hover, never rest, fade when he moves again
  for(const dc of A.decoys){ dc.t+=dt; if(B.st==='move'&&B.t>0.1) dc.a-=dt*2.5; dc.y=gyOr(dc.x)-B.fly+Math.sin(B.ph*1.7+dc.x)*10;
    if(dc.a>0.5&&Math.abs(P.x-dc.x)<B.h*0.26+6&&(P.y-30)>dc.y-B.h*0.95&&(P.y-30)<dc.y) hurt(dc,3); }
  A.decoys=A.decoys.filter(dc=>dc.a>0);
  // tide (Smonster)
  const td=A.tide; if(td){ td.t+=dt; td.wet=td.t>td.warn&&td.t<td.warn+td.on;
    if(td.wet&&!P.dead){ const g=A.d.gy(P.x); if(P.x>B.a0-10&&P.x<B.a1+10&&g<1e8&&P.y>g-8) hurt({x:P.x-P.face},2); }
    if(td.t>td.warn+td.on+0.8) A.tide=null; }
  // falling tiles (the Doig)
  const tl=A.tiles; if(tl){ tl.t+=dt; const open=tl.t>tl.crack&&tl.t<tl.crack+tl.open; if(open&&!A.d.dyn){ A.d.dyn=tl.set; sfx.thud(); game.shake=0.35; }
    if(!open&&A.d.dyn&&tl.t>=tl.crack+tl.open){ A.d.dyn=null; A.tiles=null; } }
  // burning trail (Battle Armour)
  for(const f of A.fires){ f.t+=dt; if(f.t<f.life-0.3&&!P.dead&&P.x>f.x0&&P.x<f.x1){ const g=gyOr(P.x); if(P.y>g-10) hurt({x:(f.x0+f.x1)/2},2); } }
  A.fires=A.fires.filter(f=>f.t<f.life);
  // pillars of light (King of Bell)
  for(const p of A.pillars){ p.t+=dt; if(p.t>p.warn&&!p.rang){ p.rang=1; sfx.pillar(); } if(p.t>p.warn&&p.t<p.warn+p.on&&!P.dead&&Math.abs(P.x-p.x)<20) hurt(p,2); }
  A.pillars=A.pillars.filter(p=>p.t<p.warn+p.on+0.2);
  // snuffed braziers (Vere)
  for(const b of A.braziers){ if(b.snuff>0){ b.snuff-=dt; if(b.snuff<=0){ b.snuff=0; b.lit=false; sfx.snuff(); for(let i=0;i<10;i++) A.particles.push({x:b.x+(i-5)*2,y:gyOr(b.x)-40,vx:(i-5)*6,vy:-30-i*3,life:1.2,t:0,gold:0}); } } }
}
/* ---------------- throne & ending ---------------- */
function startThrone(){ game.throne={phase:'arrive',t:0,sat:false}; P.ctrl=false; P.vx=0; say('19',{again:true,cb:()=>{ if(game.throne&&game.throne.phase==='arrive') game.throne.phase='choose'; }}); }
function sitThrone(){ const th=game.throne; if(th.sat) return; th.sat=true; th.phase='sit'; th.t=0; P.sit=1; say('g06',{again:true,cb:()=>{ say('g07',{again:true,cb:()=>{ P.sit=0; th.phase='choose'; }}); }}); }
function letGo(){
  const th=game.throne; th.phase='release'; th.t=0; sfx.release();
  game.stats.given=P.light;
  for(let i=0;i<180;i++){ const a=Math.random()*TAU, v=60+Math.random()*360; A.particles.push({x:P.x,y:P.y-PH+8,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:2.5+Math.random()*2.5,t:0,gold:1,big:Math.random()<0.25}); }
  P.light=0;
  say('20',{again:true,delay:0.6});
  setTimeout(()=>{ game.cine={imgs:['s20','s21'],t:0,dur:11,lineDone:false}; say('21',{again:true,cb:()=>{ if(game.cine) game.cine.lineDone=true; }}); },3400);
}

/* ---------------- autopilot (automated testing / attract mode) ---------------- */
const bot={tShine:0,stuck:0,lastX:0,skip:new Set(),tgt:null,tgtT:0};
function reachable(m){ if(bot.skip.has(m)||m.sec) return false; if(m.ty!==undefined&&m.y<m.ty-4) return false; const g=A.d.gy(m.x); const h=(g<1e8?g:BASE)-m.y; return h<=72||nearPlat(m); }
function nearPlat(m){ for(const p of A.plats) if(!p.mx&&!p.my&&m.x>p.x-10&&m.x<p.x+p.w+10&&m.y<p.y&&m.y>p.y-75) return true; for(const s of A.d.solids){ const top=solidTop(s); if(m.x>s.x-10&&m.x<s.x+s.w+10&&m.y>top-85) return true; } return false; }
// v4: the autopilot reads the new boss hazards the way a player would (from their telegraphs)
function botZones(){ const Z=[]; const B=A.boss;
  if(A.tiles) for(const g of A.tiles.set) Z.push([g[0]-12,g[1]+12]);
  for(const f of A.fires) if(f.t<f.life-0.2) Z.push([f.x0-14,f.x1+14]);
  for(const p of A.pillars) if(p.t<p.warn+p.on) Z.push([p.x-34,p.x+34]);
  for(const dc of A.decoys) Z.push([dc.x-56,dc.x+56]);
  if(B&&B.st==='tele'&&B.atk==='dive') Z.push([B.dtx-90,B.dtx+90]);
  return Z; }
function botAvoid(tx){ const B=A.boss, Z=botZones(); if(!Z.length) return tx; const inZ=x=>Z.some(z=>x>z[0]&&x<z[1]);
  const lo=B.a0+14, hi=B.a1-14; if(!inZ(tx)&&!inZ(P.x)) return tx;
  let best=tx, bd=1e9; for(let x=lo;x<=hi;x+=6){ if(inZ(x)) continue; if(Math.abs(x-B.x)<B.h*0.26+26) continue; const d=Math.abs(x-tx)*0.5+Math.abs(x-P.x); if(d<bd){ bd=d; best=x; } } return best; }
/* v5 bot: it uses the stones' gifts where a stretch asks for them (dev only) */
function simFly(x,y,vx,vy,dir){ // a rough flight: where would it come down? null if into the water
  const dt=1/60; let blk=false;
  for(let i=0;i<200;i++){ vy=Math.min(800,vy+GRAV*dt); const nx=x+vx*dt; if(!blockedX(nx,y)) x=nx; else blk=true; const ny=y+vy*dt; const [fy,pl]=floorAt(x,y);
    if(vy>=0&&ny>=fy&&y<=fy+12) return {x,y:fy,pl,wall:blockedX(x+dir*4,fy)}; y=ny; if(y>H+60) return null; }
  return null; }
function simDash(dx,dy,dir){ let x=P.x,y=P.y; const n=Math.hypot(dx,dy), vx=dx/n*AD_V, vy=dy/n*AD_V; for(let i=0;i<9;i++){ const nx=x+vx/60; if(!blockedX(nx,y)) x=nx; y+=vy/60; }
  return simFly(x,y,dx?Math.sign(dx)*AD_CARRY:0,dy>0?220:dy<0?-200:0,dir); }
function landOK(r,dir,x0){ return r&&!r.wall&&(r.x-x0)*dir>18&&!(r.pl&&(r.pl.mx||r.pl.my)); }
function edgeAhead(dir,max){ for(let e=0;e<=max;e+=3){ const x=P.x+dir*e; const [fy]=floorAt(x,P.y); if(fy>P.y+24) return e; } return null; }
function gapMov(x){ const g=gapAt(x); return g&&A.plats.some(p=>(p.mx||p.my)&&p.x0<g[1]&&p.x0+p.w>g[0]); }
function gapAt(x){ for(const g of A.d.gaps) if(x>g[0]-70&&x<g[1]) return g; return null; }
function botV5(dt,inp,dir,jump,fight){
  const m=game.moves|0, d=A.d, now=game.t; if(!m||fight||P.pull) return jump;
  if(P.ground) bot.lp=null;
  // a stone's gate wants light: go back for what it drops
  for(const gt of d.gates){ if(P.ground&&P.x>gt.x-90&&P.x<gt.x+10&&P.light<gt.cost){ let best=null,bd=480; for(const mo of A.motes){ if(mo.got||!reachable(mo)||mo.x>gt.x) continue; const dd=Math.abs(mo.x-P.x); if(dd<bd){ bd=dd; best=mo; } }
      if(best){ const dx=best.x-P.x; inp.l=dx<-6; inp.r=dx>6; return Math.abs(dx)<30&&best.y<P.y-48; } for(const mo of A.motes) if(!mo.got&&mo.x<=gt.x&&mo.x>gt.x-480) bot.skip.delete(mo); inp.l=inp.r=false; return false; } } // v6: try skipped motes again rather than wait forever
  if(!P.ground&&P.vx>40&&d.gy(P.x)>1e8&&!gapMov(P.x)){ inp.r=true; inp.l=false; }
  if(!P.ground&&P.coy>0&&(P.dashT>0||P.dashG>0)&&!P.ember) return true; // ran off the edge mid-step: leap now
  const g=gapAt(P.x), mov=g&&A.plats.some(p=>(p.mx||p.my)&&p.x0<g[1]&&p.x0+p.w>g[0]);
  const hs=g&&m>=3?A.hang.filter(l=>!l.hidden&&l.x>g[0]&&l.x<g[1]):[];
  const bs=g&&m>=6?A.bells.filter(b=>(b.x0||b.x)>g[0]&&(b.x0||b.x)<g[1]):[];
  // turnlight: shine as a thrown thing reaches you
  if(m>=4&&P.light>=SHINE_COST&&P.shineCD<=0){ for(const sh of A.shots){ if(sh.wait>0||sh.turned||sh.k==='wave'||sh.k==='hwave'||sh.src==='boss') continue; const dx=P.x-sh.x, dy=P.y-28-sh.y; if(Math.hypot(dx,dy)<TURN_R-8&&(sh.vx*dx+sh.vy*dy)>0){ inp.sp=true; break; } } }
  // carrying fire through the cold, and waiting out the eyes
  if(m>=5&&d.cold.length){
    let c=null; for(const z of d.cold) if(z[1]>P.x+10&&(!c||z[0]<c[0])) c=z;
    if(c&&!P.ember&&P.x<c[0]+5&&c[0]-P.x<300){
      let b=null,bd=1e9; for(const o of A.braziers){ if(o.arena||!o.lit||o.x>c[0]+10) continue; const dd=Math.abs(o.x-P.x); if(o.x>P.x-900&&dd<bd){ bd=dd; b=o; } }
      if(!b&&P.light>=SHINE_COST) for(const o of A.braziers){ if(o.arena||o.lit||o.cold||o.x>c[0]||Math.abs(o.x-P.x)>420) continue; if(Math.abs(o.x-P.x)<bd){ bd=Math.abs(o.x-P.x); b=o; } }
      let thr=false; for(const e of A.enemies) if(!e.calm&&Math.abs(e.x-P.x)<130) thr=true;
      if(b&&!b.lit&&P.light<SHINE_COST) b=null;
      if(b&&!(thr&&P.light<SHINE_COST)){ const dx=b.x-P.x; inp.l=dx<-6; inp.r=dx>6; jump=jump&&Math.abs(dx)>20;
        if(Math.abs(dx)<20&&P.ground){ if(b.lit){ if(!bot.dpT||now-bot.dpT>0.3){ inp.dp=true; bot.dpT=now; } } else if(P.light>=SHINE_COST&&P.shineCD<=0) inp.sp=true; }
        return jump; } }
    if(P.ember){ for(const e of A.eyes){ if(e.sleep) continue; const ahead=e.x-P.x; if(ahead<-70||ahead>260) continue;
        const t=((now+e.ph)%e.per+e.per)%e.per, safe=t<e.per-1.7?(e.per-1.7-t)+0.2:0, need=(e.x+76-P.x)/(SPD*0.8);
        if(ahead>74&&safe<need+0.15&&ahead<110){ inp.r=false; inp.l=false; jump=false; } } }
  }
  // the lantern chains
  if(hs.length){ const first=hs.find(l=>l.x>P.x+10);
    if(P.ground&&P.x>g[0]-60){ if(P.x<g[0]-14){ return false; } inp.r=false; inp.l=false;
      if(first){ if(!first.gut&&!first.lit){ if(P.light>=SHINE_COST&&P.shineCD<=0) inp.sp=true; }
        else if(first.gut){ const [per,on,ph]=first.gut, t=(now+ph)%per; if(t<0.12&&P.light>=hs.length) inp.cp=true; }
        else if(P.light>=1) inp.cp=true; }
      return false; }
    if(!P.ground){ const l=pullTarget(); if(l&&l.x>P.x+20) inp.cp=true; inp.r=true; return false; }
  }
  // the bells: jump in with a dash, then fall like a star onto each one
  if(bs.length){
    if(P.ground&&!P.plat&&P.x>g[0]-70&&P.x<g[0]){
      const tb=bs.find(b=>b.toll); if(tb){ const [per,ph]=tb.toll, t=((now+ph)%per+per)%per; if(t>0.45){ inp.r=P.x<g[0]-40; inp.l=false; return false; } }
      const e=g[0]-P.x; if(e<=50&&P.dashT<=0&&P.dashG<=0&&P.dashCD<=0&&P.light>=1) inp.cp=true; return (P.dashT>0||P.dashG>0)&&e<10; }
    if(!P.ground){ inp.r=true; inp.l=false;
      const nb=bs.find(b=>b.x>P.x-14); if(nb&&nb.x>P.x+30&&!P.stomp&&P.airDash&&P.adT<=0&&P.light>=3&&P.vy>-120){ const t=(nb.x-P.x)/Math.max(P.vx,90), y=P.y+P.vy*t+490*t*t; if(y>nb.y-20){ inp.cp=true; inp.u=false; } } }
    if(!P.ground&&!P.stomp){ const b=bs.find(b=>b.x>P.x-14); if(b&&P.vy>-60&&Math.abs(b.x-P.x)<11&&P.y<b.y-22&&P.light>=1) inp.dp=true; }
    if(!P.ground) return false;
  }
  if(!dir) return jump;
  // gaps: a plain jump if it carries, else the ebb-step leap; and in the air, a light-dash to save a short fall
  if(P.ground&&!mov&&!P.ember||P.ground&&P.ember&&!mov){ const e=edgeAhead(dir,90);
    if(e!==null){ const k=P.ember?0.9:1, x0=P.x+dir*Math.max(0,e-6);
      const plain=landOK(simFly(x0,P.y,dir*SPD*(P.ember?0.8:1),-JV*k,dir),dir,x0);
      if(plain) return e<(P.ember?7:12);
      if(m>=2&&!P.ember&&P.light>=3&&P.plat&&!simFly(x0,P.y,dir*CARRY_V,-JV,dir)) return e<12; // v6: a leap would sail past a small stone: jump, then light-dash
      if(m>=1&&!P.ember&&P.light>=1){ if(e<=48&&P.dashT<=0&&P.dashG<=0&&P.dashCD<=0) inp.cp=true; return (P.dashT>0||P.dashG>0)&&e<9||P.dashG>0&&P.dashG<0.05; }
    } }
  if(!P.ground&&m>=2&&dir>0&&P.vx>=-20&&P.airDash&&P.adT<=0&&!P.stomp&&!P.ember&&P.light>=2&&P.vy>-90){
    const md=Math.abs(P.vx)>20?Math.sign(P.vx):dir, now0=simFly(P.x,P.y,P.vx,P.vy,md);
    if(!now0||(now0.wall&&md===dir)){ for(const [dx,dy] of [[md,0],[md,-1],[0,-1]]){ const r=simDash(dx,dy,md); if(r&&!r.wall&&!(r.pl&&(r.pl.mx||r.pl.my))){ inp.cp=true; inp.r=dx>0; inp.l=dx<0; inp.u=dy<0; game.log.push(['botad',P.x|0,P.y|0,P.vx|0,P.vy|0,dx,dy,now0&&[now0.x|0,now0.y|0,!!now0.wall]]); break; } }
      if(!inp.cp&&P.vy>200&&!now0){ inp.cp=true; inp.r=md>0; inp.l=md<0; inp.u=true; } } }
  return jump;
}
// v7: the bot waits for the tide, times the guards, and (with ?human) stops to look before each new thing, like a careful player
function botHold(dt){ const d=A.d;
  if(HUMAN){ if(bot.pauseT>0){ bot.pauseT-=dt; return true; }
    if(!A.feat){ A.feat=[...d.gaps.map(g=>g[0]),...d.tides.map(t=>t.x),...d.hazards.map(h=>h.x),...d.enemies.map(e=>e.x),...d.cats.map(c=>c.x+c.range[0]),...d.gates.map(g=>g.x),...d.cold.map(c=>c[0])].sort((a,b)=>a-b); A.featI=0; }
    while(A.featI<A.feat.length&&A.feat[A.featI]<P.x-20) A.featI++;
    if(P.ground&&A.featI<A.feat.length&&A.feat[A.featI]-P.x<100){ bot.pauseT=0.8; A.featI++; bot.looks=(bot.looks||0)+1; return true; } }
  if(!P.ground) return false;
  for(const t of d.tides){ if(P.x>t.x-60&&P.x<t.x-4){ const need=(t.x+t.w+20-P.x)/SPD+0.3; if(tideUp(t)||tideSoon(t)<need) return true; } }
  for(const e of A.enemies){ if(e.t!=='guard'||e.calm) continue; const r=e.r||170, dx=e.x-P.x;
    if(dx>r+15&&dx<r+90&&e.dir<0) return true; // it looks this way: wait out of its light
    if(dx>-2&&dx<=34&&e.dir>0) return true; } // under it while it looks ahead: wait for it to turn
  return false; }
/*@DEV*/
/* v9 test only: a sloppier, more human autopilot (?sloppy=<ms reaction>&seed=<n>). Every input it decides on reaches the game
   late by a reaction time with jitter, and now and then a press comes extra late or not at all. Seeded, so a run repeats. */
const SLOPPY=Q.has('sloppy')?(+Q.get('sloppy')||140)/1000:0; let hR=rngf(+(Q.get('seed')||7)*7919+13); const hQ=[]; let hT=0, hLag=0;
function humanize(inp,dt){ hT+=dt; const E=['jp','sp','cp','dp'];
  for(const k of E) if(inp[k]){ const r=hR(); if(r<0.01) inp[k]=false; } // a press that never happened
  hQ.push({t:hT+SLOPPY*hR()+(hR()<0.03?0.09:0),inp}); // the timing error left after a player has learned to press early: 0..ms, sometimes a beat late
  let out=null; const ev={}; while(hQ.length&&hQ[0].t<=hT){ out=hQ.shift().inp; for(const k of E) if(out[k]) ev[k]=true; }
  if(out) hLag=out; const o=Object.assign({},hLag||{}); for(const k of E) o[k]=!!ev[k];
  if(o.jp) hJ=0.3+0.1*hR(); hJ-=dt; o.j=o.j||hJ>0; return o; } let hJ=0; // a person holds the jump key for a beat, not just the frame
/*@/DEV*/
function autopilot(dt){
  const inp={l:false,r:false,j:false,jp:false,sp:false,cp:false,dp:false,dh:false,u:false};
  const d=A.d;
  if(P.dead) return inp;
  if(game.throne){ const th=game.throne; if(th.phase==='choose'){ if(!th.sat&&!Q.has('nosit')) inp.jp=true; else inp.sp=true; } return inp; }
  if(d.bench){ inp.r=true; return inp; }
  let tx=d.len+50; const s=A.shrine, B=A.boss;
  const fight=B&&!B.calm&&B.st!=='sleep';
  if(fight){
    let best=null,bd=1e9; for(const m of A.motes){ if(m.got||!reachable(m)||m.x<B.a0||m.x>B.a1) continue; const dd=Math.abs(m.x-P.x); if(dd<bd){bd=dd;best=m;} }
    if(P.light>=SHINE_COST) tx=clamp(B.x-Math.sign(B.x-P.x||1)*80,B.a0+15,B.a1-15); else tx=best?best.x:clamp(B.x-Math.sign(B.x-P.x||1)*200,B.a0+15,B.a1-15);
    if(A.tide&&A.tide.t<A.tide.warn+A.tide.on){ let rb=null,rd=1e9; for(const so of d.solids){ if(so.x<B.a0||so.x>B.a1) continue; const c=so.x+so.w/2; const dd=Math.abs(c-P.x)+(Math.abs(c-B.x)<70?400:0); if(dd<rd){ rd=dd; rb=c; } } if(rb!==null) tx=rb; }
    else tx=botAvoid(tx);
    if(P.light>=SHINE_COST&&P.shineCD<=0&&B.iT<=0&&B.st==='rest'&&Math.hypot(B.x-P.x,(B.y-B.h*0.5)-(P.y-30))<150+Math.min(P.light-SHINE_COST,30)*3+B.h*0.3-10) inp.sp=true;
  }
  else if(s&&!s.awake){
    if(P.light>=s.need) tx=s.x; else {
      let best=null,bd=1e9; for(const m of A.motes){ if(m.got||!reachable(m)) continue; const dd=Math.abs(m.x-P.x)+(m.x<P.x-30?150:0); if(dd<bd){bd=dd;best=m;} }
      tx=best?best.x:s.x;
    }
  } else {
    let best=null,bd=260; for(const m of A.motes){ if(m.got||!reachable(m)) continue; const dx=m.x-P.x; if(dx<-40||dx>bd) continue; bd=dx; best=m; }
    tx=best?best.x+8:d.len+50;
  }
  bot.tShine-=dt;
  if(!fight&&bot.tShine<=0&&P.light>=SHINE_COST){
    const spare=P.light-(s&&!s.awake?s.need:0);
    let threat=false; for(const e of A.enemies){ const ey=e.t==='wisp'?e.y:e.y-e.h*0.5; if(!e.calm&&Math.abs(e.x-P.x)<115&&Math.abs(ey-(P.y-30))<150) threat=true; }
    let lamp=false; for(const l of A.lanterns) if(!l.lit&&Math.abs(l.x-P.x)<80) lamp=true;
    let braz=false; for(const b of A.braziers) if(!b.lit&&Math.abs(b.x-P.x)<80) braz=true;
    const edge=A.enemies.some(e=>!e.calm&&e.t==='walker'&&Math.abs(e.x-P.x)<115&&d.gaps.some(g=>{ const k=Math.sign(e.x-P.x||1); return k>0?(g[1]<=P.x&&P.x-g[1]<170):(g[0]>=P.x&&g[0]-P.x<170); })); // v6: a shove here is a fall, so spend the light
    const gNext=d.gates.filter(g=>g.x>P.x).sort((u,v)=>u.x-v.x)[0], gRes=gNext?gNext.cost:0; // v6: keep a stone's light in hand
    const pitW=A.enemies.some(e=>!e.calm&&e.t==='wisp'&&Math.abs(e.x-P.x)<115&&d.gaps.some(g=>Math.abs((g[0]+g[1])/2-e.x)<170)); // v9: a wisp by a pit can knock you in, so spend the light
    if(braz||(threat&&spare>=SHINE_COST+4)||(threat&&pitW&&P.light>=SHINE_COST&&P.light-SHINE_COST+A.motes.filter(m=>!m.got&&m.x>P.x&&reachable(m)).length>=(s&&!s.awake?s.need:0))||(threat&&edge&&P.light-SHINE_COST>=gRes)||(lamp&&spare>=SHINE_COST+6)){ inp.sp=true; bot.tShine=0.9; }
  }
  if(!fight&&s&&!s.awake&&P.light>=s.need&&Math.abs(P.x-s.x)<30&&!(B&&!B.calm)){ inp.sp=true; return inp; }
  // give up on motes the bot cannot reach after a while
  const tgtKey=Math.round(tx); if(bot.tgt===tgtKey) bot.tgtT+=dt; else { bot.tgt=tgtKey; bot.tgtT=0; }
  if(bot.tgtT>5){ for(const m of A.motes) if(!m.got&&Math.abs(m.x-tx)<12) bot.skip.add(m); bot.tgtT=0; }
  const dx=tx-P.x; const dir=Math.abs(dx)<6?0:Math.sign(dx);
  if(dir>0) inp.r=true; else if(dir<0) inp.l=true;
  let jump=false;
  if(dir){
    const ahead=P.x+dir*30;
    for(const so of d.solids){ const top=solidTop(so); const edge=dir>0?so.x:so.x+so.w; if(Math.abs(edge-ahead)<14&&P.y>top+2) jump=true; }
    if(P.ground&&!P.plat&&d.gy(P.x+dir*16)>1e8) jump=true;
    if(P.plat&&P.ground&&!P.plat.mx){ const p=P.plat; const edge=dir>0?p.x+p.w:p.x; if(Math.abs(edge-P.x)<10) jump=true; }
    for(const p of A.plats){ if(p.mx||p.my) continue; const edge=dir>0?p.x:p.x+p.w; if(P.ground&&Math.abs(edge-ahead)<12&&p.y<P.y-15&&p.y>P.y-70&&tx>p.x-20&&tx<p.x+p.w+20) jump=true; }
    for(const g of d.gaps){ const mv=A.plats.find(p=>p.mx&&p.x0<g[1]&&p.x0+p.w>g[0]); if(!mv||dir<0) continue;
      if(P.ground&&!P.plat&&P.x>g[0]-70&&P.x<=g[0]){ if(mv.x>mv.x0+12){ inp.r=P.x<g[0]-24; jump=false; } else { inp.r=true; jump=P.x>g[0]-16; } }
      if(P.plat===mv){ if(mv.x<mv.x0+mv.mx-14){ inp.r=P.x<mv.x+mv.w-25; inp.l=false; jump=false; } else { inp.r=true; jump=P.x>mv.x+mv.w-18; } } }
  }
  if(Math.abs(dx)<30){ for(const m of A.motes){ if(!m.got&&Math.abs(m.x-P.x)<30&&m.y<P.y-48&&m.y>P.y-115) jump=true; } }
  if(Math.abs(P.x-bot.lastX)<0.3&&(inp.l||inp.r)) bot.stuck+=dt; else bot.stuck=0; bot.lastX=P.x;
  if(bot.stuck>0.4) jump=true;
  let hiNear=false; for(const sh of A.shots){ if(sh.wait>0) continue; const ddx=sh.x-P.x, app=Math.sign(sh.vx)!==Math.sign(ddx)||Math.abs(ddx)<10;
    if(sh.k==='wave'&&app&&Math.abs(ddx)<48+Math.abs(sh.vx)*0.04) jump=true;
    if(sh.k==='hwave'&&app&&Math.abs(ddx)<190) hiNear=true; }
  if(hiNear) jump=false;
  jump=botV5(dt,inp,dir,jump,fight);
  if(inp.r&&!fight&&botHold(dt)){ inp.r=false; jump=false; }
  /*@DEV*/if(SLOPPY&&jump&&P.ground&&dir&&!P.plat&&!gapMov(P.x)&&!fight&&!simFly(P.x,P.y,dir*SPD,-JV,dir)&&d.gy(P.x+dir*16)<1e8) jump=false; // a person sees the water: no early hop that comes down in it/*@/DEV*/
  if(jump&&(P.ground||P.coy>0)) inp.jp=true;
  inp.j=inp.jp||(!P.ground&&P.vy<0);
  return inp;
}

/* ---------------- update ---------------- */
function update(dt){
  if(menuOpen||game.paused) return;
  game.t+=dt; const now=game.t;
  voUpdate(dt,now);
  if(comboT>0){ comboT-=dt; if(comboT<=0) combo=0; }
  game.flash=Math.max(0,game.flash-dt*1.5);
  game.fade=Math.max(0,game.fade-dt*2.4);
  if(game.legendT>0) game.legendT=Math.max(0,game.legendT-dt);
  if(game.state==='play'&&!game.legendSeen){ if(game.lightMark===undefined) game.lightMark=P.light; else if(P.light!==game.lightMark) game.legendWant=1; }
  if(game.state==='play') showLegend(); // v11.4: the legend waits out a hint and a nearby gap. The shine hint can call it in.
  game.shake=Math.max(0,game.shake-dt);
  for(const p of game.popups){ p.life-=dt; p.y-=dt*30; } game.popups=game.popups.filter(p=>p.life>0);
  if(game.state==='title'){ game.title.a=Math.min(1,game.title.a+dt*0.5);
    if(pressed.map||tap&&tap.y<H*0.14&&dmAny()){ game.dmShow=game.dmShow?0:1; return; } // v11: the map of where the light has gone out
    if(game.dmShow){ if(pressed.ok||pressed.j||pressed.s||pressed.p||tap) game.dmShow=0; return; }
    const no=nightOpen(), eo=emberOpen(), lo=tap&&tap.y>H*0.84;
    if(no&&(pressed.n||lo&&(!eo||tap.x<W/2))) startGame(false,true); else if(eo&&(pressed.er||lo)) startGame(false,false,true); else if(pressed.ok||pressed.j||pressed.s||tap) startGame(false,false); return; }
  if(game.state==='end'){ game.endT+=dt; if(game.endT>4&&(pressed.ok||pressed.j||tap)){ game.state='title'; game.title.a=0; playMusic('title'); } return; }
  if(game.state==='gameover'){ game.goT+=dt; if(game.goT>1.0&&(pressed.ok||pressed.j||pressed.s||tap||(AUTO&&game.goT>7))) startGame(true,game.night,game.ember); return; } // v11.4: a key skips after 1s. Lives and the restart are unchanged.
  if(game.state==='trans'){ game.transT+=dt; if(game.transT>1.2&&!game.transDone){ game.transDone=true; game.cine=null; if(game.transFn){ const fn=game.transFn; game.transFn=null; fn(); } else setupArea(game.nextArea); } if(game.transT>2.0) game.state='play'; if(A) updateWorld(dt,{}); return; }
  if(game.state!=='play') return;
  if(game.paused) return;
  if(game.retLine){ say(game.retLine,{delay:1.2}); game.retLine=null; } // v11
  if(A&&!game.paused) paintTick(dt); // v10
  if(game.stop>0){ game.stop-=dt; return; } // hit-stop
  if(P.dead>0){ P.dead-=dt; if(P.dead<=0){ P.dead=0; if(game.lives<=0) gameOver(); else if(A.d.secret) { exitSecret(false); say('d01'); } else { restoreCP(); say(game.stats.lost%2?'d01':'d02'); } } if(game.state==='play'){ stepPlayer(dt,{}); updateWorld(dt,{}); } return; }
  if(touchMode&&pressed.j&&!P.ground&&!(P.coy>0)) P.jumpT=game.t; // a jump pressed again after leaving the ground, not the hold that started it
  const inp=P.auto?/*@DEV*/(SLOPPY?humanize(autopilot(dt),dt):/*@/DEV*/autopilot(dt)/*@DEV*/)/*@/DEV*/:{l:keys.l,r:keys.r,j:keys.j,jp:pressed.j,sp:pressed.s,cp:pressed.c,dp:pressed.d,dh:keys.d,u:keys.u||(touchMode&&keys.j&&P.jumpT>0&&P.airSince>0&&P.jumpT>=P.airSince)};
  touchButtons();
  if(game.throne&&game.throne.phase==='choose'){ if(inp.jp&&!game.throne.sat) sitThrone(); else if(inp.sp) letGo(); inp.jp=false; inp.sp=false; }
  if(inp.sp&&P.ctrl) shine();
  stepPlayer(dt,inp);
  updateWorld(dt,inp);
}
function touchBox(x,y,h,hw){ return Math.abs(P.x-x)<hw&&P.y>y-h+6&&P.y-PH*PS<y; }
// v11.4: crouch (hold Down, still, on the ground — the kneel) behind a tall rock.
// The stone has to be between you and the shot. Crouching in the open does nothing.
// Rain, a charge, and the bell-pillars are not shots crossing the stone, so they still land.
// The arena stone (cover:1) cracks, and after COVER_HITS caught blows it no longer shelters you.
function tryCover(sh){
  if(P.kneel<0.12||!P.ground||P.ember||P.dead) return false;
  const head=P.y-PH*PS;
  for(const s of A.d.solids){
    if(s.k!=='rock'||s.h<COVER_H||s.spent) continue;
    const near=P.x<s.x?s.x-P.x:P.x-(s.x+s.w);
    if(near<2||near>36) continue;
    if(sh.y<head-6||sh.y>P.y+10) continue;
    const mid=s.x+s.w/2, face=P.x<mid?s.x:s.x+s.w;
    if((sh.x-mid)*(P.x-mid)>0&&Math.abs(sh.x-face)>sh.r+10) continue;
    const at=P.x<mid?sh.x-sh.r<=face+10:sh.x+sh.r>=face-10;
    if(!at) continue;
    if(P.x<mid?sh.x<P.x-4:sh.x>P.x+4) continue;
    sh.dead=1;
    const y=sh.y, x=face;
    for(let i=0;i<7;i++) A.particles.push({x,y,vx:(i-3)*16,vy:-16-(i%3)*8,life:0.35,t:0,gold:1});
    if(s.cover){ s.chip=(s.chip|0)+1; if(s.chip>=COVER_HITS){ s.spent=1; sfx.crack(); game.shake=Math.max(game.shake,0.22); } else sfx.tok(); }
    else sfx.tok();
    game.log.push(['cover',game.areaI,s.chip|0,P.x|0]);
    return true;
  }
  return false;
}
function updateWorld(dt){
  const d=A.d, now=game.t, live=game.state==='play'&&!P.dead;
  game.areaTitle=Math.max(0,(game.areaTitle||0)-dt);
  if(game.bossBanner){ game.bossBanner.t+=dt; if(game.bossBanner.t>3.5) game.bossBanner=null; }
  game.look=(game.look||0)+((P.dead?0:P.face*28)-(game.look||0))*Math.min(1,dt*1.5); const tcx=clamp(P.x-W*0.36+game.look,0,d.len-W); camX+=(tcx-camX)*Math.min(1,dt*4);
  const tcy=Math.min(0,P.y-310); if(!P.dead) camY+=(tcy-camY)*Math.min(1,dt*3);
  if(live) for(const t of A.trig){ if(!t.done&&P.x>=t.x){ t.done=true; if(t.line) say(t.line,{delay:t.delay||0,x:t.x,drop:true}); if(t.hint&&!game.hintSeen[t.hint]){ game.hintSeen[t.hint]=1; showHint(HINTS[t.hint](),t.ttl||5,t.hint); if(t.hint==='shine') game.legendAtShine=1; } } }
  if(A.hintT>0) A.hintT-=dt;
  else if(game.legendT<=0&&A.hintQ&&A.hintQ.length){ const w=A.hintQ.shift(); A.hint=w.t; A.hintT=w.ttl; A.hintKey=w.key||''; }
  if(live&&A.act===1&&P.x>=d.act2) startAct2();
  if(game.actT>0) game.actT-=dt; if(game.split){ game.split.t+=dt; if(game.split.t>4.5) game.split=null; }
  for(const p of A.plats){
    if(p.mx){ const nx=p.x0+p.mx*(0.5-0.5*Math.cos(now*TAU/p.per)); p.dx=nx-p.x; p.x=nx; } else p.dx=0;
    if(p.my){ const ny=p.y0-p.my*(0.5-0.5*Math.cos(now*TAU/p.per)); p.dy=ny-p.y; p.y=ny; } else p.dy=0;
    // v5: rotten branches and sinking stones: once stood on, they go after a moment (they creak and shake first)
    if(p.rot){ if(p.rt>0&&!p.off){ p.rt+=dt; if(p.rt>p.rot){ p.off=1; p.ot=0; sfx.crack(); if(P.plat===p){ P.plat=null; leaveGround(); } } }
      if(p.off){ p.ot+=dt; p.dy=dt*(60+p.ot*700); p.y+=p.dy; if(p.ot>3.0&&P.plat!==p){ p.off=0; p.rt=0; p.y=p.y0; p.dy=0; } } } }
  // motes drift toward the sun-head and are gathered
  for(const m of A.motes){ if(m.got) continue; m.ph+=dt*2; if(m.born!==undefined) m.born+=dt;
    if(m.ty!==undefined&&m.y<m.ty) m.y=Math.min(m.ty,m.y+110*dt);
    const dx=m.x-P.x, dy=m.y-(P.y-PH/2); const dd=Math.hypot(dx,dy);
    if(m.ft){ // v5: fleeting light: it starts to fade when you come near, and is back a little later
      if(m.hide>0){ m.hide-=dt; if(m.hide<=0){ m.fade=0; m.fading=0; } continue; }
      if(!m.fading&&dd<110&&live) m.fading=1; if(m.fading){ m.fade=(m.fade||0)+dt; if(m.fade>0.5){ m.hide=3; continue; } } }
    else if(dd<64&&live){ m.x-=dx*dt*3.2; m.y-=dy*dt*3.2; }
    if(dd<22&&live&&!(m.born<0.4)){ m.got=true; if(m.sec==='s1k') A.s1armed=true; gainLight(1); game.stats.motes++; P.pulse=Math.min(1,(P.pulse||0)+0.45); sfx.mote(); say('g01',{delay:0.3});
      if(!m.counted&&!m.drop){ m.counted=true; game.lifeMotes++; if(game.lifeMotes>=lifeNeed()){ game.lifeMotes-=lifeNeed(); if(game.lives<(game.ember?1:MAX_LIVES)){ game.lives++; game.stats.oneups++; sfx.oneup(); say('x01'); popup('1 UP',P.x,P.y-90); game.log.push(['1up',game.lives]); } } }
      for(let i=0;i<8;i++){ const a=Math.random()*TAU; A.particles.push({x:m.x,y:m.y,vx:Math.cos(a)*60,vy:Math.sin(a)*60-20,life:0.6,t:0,gold:1}); } } }
  for(const e of A.enemies){
    e.ph+=dt; if(e.hit>0) e.hit-=dt;
    if(e.calm){ e.ct+=dt; if(e.t!=='frygar') e.y-=dt*(e.t==='wisp'?20:12); continue; }
    if(!live) continue;
    const dx=P.x-e.x;
    if(e.t==='wisp'){
      const near=Math.abs(dx)<260; const tx=near?P.x:e.x0+Math.sin(e.ph*0.5)*60, ty=near?P.y-PH/2:gyOr(e.x0)-70+Math.sin(e.ph)*10;
      e.x+=clamp(tx-e.x,-1,1)*(near?56:28)*dt+e.vx*dt; e.y+=clamp(ty-e.y,-1,1)*40*dt; e.vx*=0.95;
      if(Math.abs(dx)<18&&Math.abs((P.y-PH/2)-e.y)<26){ hurt(e,2); e.vx=-Math.sign(dx||1)*200; }
    } else if(e.t==='walker'){
      const see=Math.abs(dx)<240&&Math.abs(P.y-e.y)<90; let sp;
      if(see){ e.dir=Math.sign(dx)||1; sp=88; } else { sp=40; if(e.x>e.x0+e.r) e.dir=-1; if(e.x<e.x0-e.r) e.dir=1; }
      let nx=e.x+e.dir*sp*dt+e.vx*dt; e.vx*=0.92;
      if(d.gy(nx+e.dir*14)>1e8||solidAt(nx+e.dir*14)||(A.boss&&nx>A.boss.a0-30)){ nx=e.x; if(!see) e.dir*=-1; }
      e.x=nx; e.y=gyOr(e.x); e.chasing=see;
      if(touchBox(e.x,e.y,e.h,e.h*0.22+8)) hurt(e,2);
    } else if(e.t==='flyer'){
      const near=Math.abs(dx)<300&&Math.abs(dx)>4;
      if(e.tele>0){ e.tele-=dt; if(e.tele<=0){ A.shots.push({x:e.x,y:e.y+6,vx:0,vy:90,g:520,r:6,k:'sting',dmg:1,life:3,src:e,ox:e.x,oy:e.y}); sfx.sting(); e.cd=1.9; } }
      else { const tx=near?P.x:e.x0+Math.sin(e.ph*0.6)*e.r; e.x+=clamp(tx-e.x,-1,1)*(near?74:40)*dt; e.cd-=dt; if(near&&Math.abs(dx)<34&&e.cd<=0) e.tele=0.45; }
      e.x=clamp(e.x,e.x0-e.r-160,e.x0+e.r+160); e.dir=Math.sign(dx)||1;
      e.y=gyOr(e.x0)-135+Math.sin(e.ph*2.2)*8;
      if(touchBox(e.x,e.y,e.h,e.h*0.3)) hurt(e,2);
    } else if(e.t==='thrower'||e.t==='spitter'){
      const fl=e.t==='spitter';
      if(fl){ e.x=e.x0+Math.sin(e.ph*0.5)*50; e.y=gyOr(e.x0)-105+Math.sin(e.ph*1.6)*12; } else { e.x=e.x0+Math.sin(e.ph*0.4)*24; e.y=gyOr(e.x); }
      e.dir=Math.sign(dx)||1;
      if(e.tele>0){ e.tele-=dt; if(e.tele<=0){ const by=e.y-e.h*0.7; SRC=e; if(fl) aim(e.x,by+e.h*0.3,P.x,P.y-30,175,'fire',1); else lob(e.x,by,P.x+P.vx*0.5,P.y-30,1.0,'fire',1); SRC=null; sfx.throw(); e.cd=2.1; } }
      else { e.cd-=dt; if(Math.abs(dx)<400&&Math.abs(dx)>30&&e.cd<=0){ e.tele=0.6; } }
      if(touchBox(e.x,e.y,e.h,e.h*0.25+6)) hurt(e,2);
    } else if(e.t==='frygar'){
      const see=Math.abs(dx)<190&&Math.abs(P.y-e.y)<80;
      if(e.tele>0){ e.tele-=dt; if(e.tele<=0){ SRC=e; lob(e.x+e.dir*10,e.y-60,P.x+P.vx*0.4,P.y-30,0.9,'spear',1); SRC=null; sfx.spear(); e.cd=e.edge?2.4:2.3; } }
      else if(e.edge){ e.dir=Math.sign(dx)||1; }
      else if(see){ e.dir=Math.sign(dx)||1; e.x+=e.dir*72*dt; } else { e.x+=e.dir*38*dt; if(e.x>e.x0+e.r) e.dir=-1; if(e.x<e.x0-e.r) e.dir=1; }
      e.cd-=dt; if(e.tele<=0&&Math.abs(dx)>(e.edge?70:140)&&Math.abs(dx)<(e.edge?460:330)&&Math.abs(P.y-e.y)<140&&e.cd<=0){ e.dir=Math.sign(dx)||1; e.tele=0.6; }
      e.x+=e.vx*dt; e.vx*=0.92; if(d.gy(e.x)>1e8||solidAt(e.x)){ e.x-=e.dir*80*dt+e.vx*dt; e.dir*=-1; } e.y=gyOr(e.x);
      if(Math.abs(dx)<20&&Math.abs(P.y-e.y)<40) hurt(e,2);
    } else if(e.t==='guard'){ // v7: a Keepaway on watch. Its lantern looks one way, then the other, on a fixed beat (it shifts first).
      const per=e.per||5, k=((now+(e.ph||0))%per+per)%per; e.dir=k<per/2?-1:1; e.turnW=(k>per/2-0.6&&k<per/2)||k>per-0.6; e.x=e.x0; e.y=gyOr(e.x);
      if(e.turnW&&!e.shuf&&Math.abs(dx)<W*0.7){ e.shuf=1; sfx.creak(); } if(!e.turnW) e.shuf=0;
      const r=e.r||170, rel=dx*e.dir; const seen=rel>22&&rel<r&&P.y>e.y-150&&!P.dead;
      if(e.alarm>0){ e.alarm-=dt; if(e.alarm<=0){ SRC=e; for(let q=0;q<3;q++){ lob(e.x+e.dir*8,e.y-70,e.ax+e.dir*q*34,gyOr(e.ax)-20,1.0,'fire',1); A.shots[A.shots.length-1].wait=q*0.28; } SRC=null; sfx.throw(); e.cd=3.0; } }
      else { e.cd-=dt; if(seen&&e.cd<=0){ e.alarm=0.5; e.ax=P.x; sfx.alarm(); } }
    } else if(e.t==='stalker'){
      const near=Math.abs(dx)<(P.ember?420:330), fk=P.ember?1.35:1; if(near){ e.dir=Math.sign(dx)||1; e.x+=e.dir*(Math.abs(dx)>140?64:46)*fk*dt; } else e.x+=Math.sin(e.ph*0.3)*15*dt;
      e.x+=e.vx*dt; e.vx*=0.93; if(d.gy(e.x)>1e8||(A.boss&&e.x>A.boss.a0-30)) e.x-=(e.dir*64*dt+e.vx*dt); e.y=gyOr(e.x);
      if(touchBox(e.x,e.y,e.h*0.8,20)) hurt(e,3);
    }
  }
  bossUpdate(dt,live);
  if(d.secretStill&&live&&!P.auto){ const q=d.secretStill; const on=P.ground&&P.plat&&P.plat.x0===q.plat&&!keys.l&&!keys.r&&!keys.j&&!keys.s&&Math.abs(P.vx)<1&&!game.secretsSpent.has(q.n)&&!game.relics.has(q.n);
    A.stillT=on?A.stillT+dt:0; if(A.stillT>1.6&&A.rng()<dt*10) A.particles.push({x:P.x+(A.rng()-.5)*40,y:P.y-4,vx:0,vy:-24-A.rng()*20,life:1.4,t:0,gold:1});
    if(A.stillT>q.t){ A.stillT=0; enterSecret(q.n); } }
  if(A.relic&&!A.relic.got){ A.relic.t+=dt; const r=A.relic, ry=gyOr(r.x)-48+Math.sin(r.t*2)*5; if(live&&Math.abs(P.x-r.x)<26&&Math.abs((P.y-PH/2)-ry)<46) getRelic(); }
  // projectiles
  for(const s of A.shots){ if(s.wait>0){ s.wait-=dt; continue; } s.t=(s.t||0)+dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+=s.g*dt;
    const g=d.gy(s.x);
    if(s.turned){ if(s.t>s.life||(g<1e8&&s.y>g-2)) s.dead=1;
      for(const e of A.enemies){ if(e.calm||s.dead) continue; const ey=e.t==='wisp'?e.y:e.y-e.h*0.5; if(Math.hypot(e.x-s.x,ey-s.y)<(e.t==='wisp'?22:e.h*0.42)){ e.hp-=2; e.hit=0.4; e.tele=0; if(e.hp<=0) calmEnemy(e); s.dead=1; } }
      for(const c of A.cats){ if(!c.dead&&!s.dead&&Math.hypot(c.x-s.x,(c.y-16)-s.y)<42){ wreckCat(c); s.dead=1; } }
      const B=A.boss; if(!s.dead&&B&&!B.calm&&B.st!=='sleep'&&B.st!=='intro'&&Math.hypot(B.x-s.x,(B.y-B.h*0.5)-s.y)<B.h*0.42){ s.dead=1; if(B.st==='rest'&&B.iT<=0) bossHit(); else { popup('deflected',B.x,B.y-B.h-10); sfx.fizzle(); } }
      continue; }
    if(s.k==='wave'){ if(g>1e8) s.dead=1; else s.y=g-10; }
    else if(s.k==='hwave'){ if(g>1e8) s.dead=1; else s.y=g-96; }
    else if(g<1e8&&s.y>g-2&&s.vy>0){ s.dead=1; for(let i=0;i<5;i++) A.particles.push({x:s.x,y:g-3,vx:(Math.random()-.5)*80,vy:-Math.random()*60,life:0.5,t:0,gold:0}); }
    if(s.t>(s.life||5)||s.y>H+300) s.dead=1;
    if(live&&!s.dead&&tryCover(s)) continue;
    if(live&&!s.dead&&Math.abs(s.x-P.x)<s.r+8&&s.y>P.y-PH*PS-s.r&&s.y<P.y+s.r){ s.dead=1; const w=d.secretWall;
      if(s.heavy&&P.light<=0&&w&&P.x>w.x0&&P.x<w.x1&&P.inv<=0&&P.hurtT<=0&&enterSecret(w.n)){ game.shake=0.5; sfx.thud(); } else hurt(s,s.dmg||1); } }
  A.shots=A.shots.filter(s=>!s.dead);
  // timed hazards
  for(const h of A.haz){ const per=h.per, t=((now+(h.ph||0))%per+per)%per; const gy=gyOr(h.x);
    if(h.k==='vent'){ const on=h.on||1.1; const act=t>per-on; const wn=!act&&t>per-on-0.7; if(wn&&!h.warn&&Math.abs(h.x-P.x)<W*0.7) sfx.inhale(); h.warn=wn; if(act&&!h.act&&Math.abs(h.x-P.x)<W) sfx.vent(); h.act=act; h.tt=t-(per-on);
      if(act&&live&&Math.abs(P.x-h.x)<15&&P.y>gy-125) hurt(h,2); }
    else if(h.k==='drop'){ const fT=0.7, f=t-(per-fT); const wn=f<0&&f>-0.9; if(wn&&!h.warn&&Math.abs(h.x-P.x)<W*0.7) sfx.shake(); h.warn=wn; const top=gy-430;
      if(f>=0){ h.ry=top+(gy-top)*Math.min(1,(f/fT)**2); h.fall=true; if(live&&Math.abs(P.x-h.x)<16&&h.ry>P.y-PH*PS&&h.ry<P.y+4) hurt(h,2); }
      else { if(h.fall&&Math.abs(h.x-P.x)<W){ sfx.thud(); for(let i=0;i<10;i++) A.particles.push({x:h.x,y:gy-4,vx:(Math.random()-.5)*120,vy:-Math.random()*90,life:0.7,t:0,gold:0}); } h.fall=false; } } }
  // v5: catapults: the arm draws back (it creaks), then a stone is thrown at where you stand. Its shadow marks the spot.
  for(const c of A.cats){ if(c.dead){ c.dt+=dt; continue; } const per=c.per, t=((now+(c.ph||0))%per+per)%per; const inR=P.x>c.x+c.range[0]&&P.x<c.x+c.range[1];
    c.wind=t>per-0.8?(t-(per-0.8))/0.8:0; if(c.wind>0&&!c.creak&&inR&&live){ c.creak=1; sfx.creak(); } if(c.wind===0) c.creak=0; c.snap=Math.max(0,(c.snap||0)-dt);
    if(t<c.lastT&&c.lastT<1e8&&inR&&live){ const T=c.T||1.5, tx=P.x; SRC=c; lob(c.x,c.y-18,tx,gyOr(tx)-14,T,'boulder',2); SRC=null; const b=A.shots[A.shots.length-1]; b.r=13; b.heavy=1; b.tx=tx; b.T=T; b.cat=c; b.life=T+1.2; c.snap=0.35; sfx.thump(); }
    c.lastT=t; }
  // v5: the old things' eyes: they open slowly (a low sound), and while open they drink your light and put out carried fire
  for(const e of A.eyes){ if(e.sleep){ e.op=0; continue; } const t=((now+e.ph)%e.per+e.per)%e.per; const open=t>e.per-1.7, opening=!open&&t>e.per-2.7;
    e.op=open?1:opening?0.45*(t-(e.per-2.7)):0; e.open=open; if(opening&&!e.grr&&Math.abs(e.x-P.x)<W*0.7){ e.grr=1; sfx.growl(); } if(!opening&&!open) e.grr=0;
    if(open&&live&&Math.abs(P.x-e.x)<70){ e.gz+=dt; if(P.ember&&e.gz>0.25) dropEmber(); A.eyeT+=dt; if(A.eyeT>0.5){ A.eyeT=0; if(P.light>0&&!GOD){ P.light--; A.particles.push({x:P.x,y:P.y-PH,vx:0,vy:-40,life:1,t:0,gold:0}); } } } else e.gz=0; }
  // v5: bells: some swing, one tolls. A toll is heard first (the bell shivers), then it knocks you a fixed way.
  for(const b of A.bells){ if(b.sw) b.x=b.x0+b.sw*Math.sin((now+(b.ph||0))*TAU/b.per); if(b.ring>0) b.ring-=dt;
    if(b.toll){ const [per,ph]=b.toll; const t=((now+ph)%per+per)%per; b.warn=t>per-0.8; if(b.warn&&!b.hum&&Math.abs(b.x-P.x)<W*0.7){ b.hum=1; sfx.hum(); }
      if(t<b.lastT&&b.lastT<1e8){ b.hum=0; b.ring=0.9; A.rings.push({x:b.x,y:b.y,r:8,R:95,t:0}); sfx.toll(); game.shake=Math.max(game.shake,0.15);
        if(live&&Math.hypot(P.x-b.x,(P.y-27)-b.y)<95){ P.vx=Math.sign(P.x-b.x||1)*260; P.vy=Math.min(P.vy,-140); leaveGround(); P.plat=null; P.knockT=0.45; P.carry=0; P.adT=0; P.stomp=false; P.dashT=0; } }
      b.lastT=t; } }
  // v5: carried fire goes out at a boss's arena (the dark there takes it), and the stones' gates never leave you stuck
  if(P.ember&&A.boss&&!A.boss.calm&&P.x>A.boss.a0-20) dropEmber();
  for(const g of d.gates){ if(live&&P.x>g.x-380&&P.x<g.x+10&&P.light<g.cost&&!P.ember){ A.gateT+=dt; if(A.gateT>4){ A.gateT=0; let n=0; for(const m of A.motes) if(!m.got&&m.x>g.x-420&&m.x<g.x&&gyOr(m.x)-m.y<=72) n++; if(n<2){ const k=(A.gateN=(A.gateN||0)+1); dropMote(g.x-50-((k*0.618)%1)*220,26,true); } } } }
  // secret VII: kneel to the King of Bell before he wakes
  const kq=d.secretKneel; if(kq&&live&&!P.auto&&P.kneel>0&&A.boss&&A.boss.st==='sleep'&&P.x>kq.x0&&P.x<kq.x1&&!game.secretsSpent.has(kq.n)&&!game.relics.has(kq.n)){ A.kneelT=P.kneel;
    if(P.kneel>kq.t){ P.kneel=0; enterSecret(kq.n); } } else A.kneelT=0;
  // waystones and the folk who speak
  for(const w of A.ways){ if(!w.lit&&live&&P.x>=w.x){ w.lit=true; sfx.waystone(); setCP(w.x); popup('waystone',w.x,gyOr(w.x)-70); } }
  for(const f of A.folk){ f.ph+=dt; const n=Math.abs(P.x-f.x)<170; f.near+=((n?1:0)-f.near)*Math.min(1,dt*3); if(!f.said&&live&&n&&!vo.cur&&!vo.queue.length){ f.said=true; say(f.line,{x:f.x,drop:true}); } }
  for(const n of A.npcs){ n.x+=n.v*dt; n.ph+=dt*n.v/10; if(n.x>d.len+40) n.x=-40; }
  for(const l of A.lanterns) l.t+=dt; for(const b of A.braziers){ b.t+=dt; if(b.relight>0){ b.relight-=dt; if(b.relight<=0&&!b.lit){ b.lit=true; b.t=0; b.snuff=0; if(Math.abs(b.x-P.x)<W) sfx.lantern(); } } } // a fire you lose smoulders back in the brazier it came from
  if(A.shrine){ A.shrine.t+=dt; if(A.shrine.awake) A.veil=Math.max(0,A.veil-dt*0.5); }
  // the stone is patient: if the light has run out nearby, a mote drifts down now and then (never a dead end)
  if(A.shrine&&!A.shrine.awake&&live&&!(A.boss&&!A.boss.calm)&&P.light<A.shrine.need&&Math.abs(P.x-A.shrine.x)<500){ A.trickle+=dt; if(A.trickle>6){ A.trickle=0; let n=0; for(const m of A.motes) if(!m.got&&Math.abs(m.x-A.shrine.x)<600) n++; if(n<2){ const k=(A.trickN=(A.trickN||0)+1); dropMote(A.shrine.x-90-((k*0.618)%1)*200,26,true); } } }
  const inCold=d.cold.some(c=>P.x>c[0]&&P.x<c[1]); A.inCold=inCold;
  if((d.drain||inCold)&&live){ let safe=false; for(const b of A.braziers) if(b.lit&&Math.abs(b.x-P.x)<(inCold?130:170)) safe=true; if(P.ember) safe=true; if(A.shrine&&(A.shrine.awake||Math.abs(P.x-A.shrine.x)<220)) safe=true; if(A.boss&&!A.boss.calm&&A.boss.st!=='sleep'&&A.boss.phase<2) safe=true; // the boss's own glow lights its arena (until Vere's second phase)
    if(!safe&&P.light>0){ A.drainT+=dt; if(A.drainT>(inCold?0.4:A.boss&&A.boss.phase>=2&&!A.boss.calm&&P.x>A.boss.a0-20?2.5:d.drain)){ A.drainT=0; P.light--; A.particles.push({x:P.x,y:P.y-PH,vx:0,vy:-30,life:1.2,t:0,gold:0}); if(P.light<=1) say('g08'); } }
    if(!safe&&P.light<=0&&!GOD){ A.zeroT+=dt; if(A.zeroT>0.2&&A.zeroT<0.25) showHint(inCold?'The cold is taking you.':'The dark is taking you.',3); if(A.zeroT>(inCold?1.5:5)){ A.zeroT=0; loseLife(inCold?'cold':'dark'); } } else A.zeroT=0; }
  if(d.embers){ if(A.rng()<dt*2.6) A.embers.push({x:camX+A.rng()*W*1.1,y:camY-20,vx:(A.rng()-.5)*30,vy:60+A.rng()*60,life:8});
    for(const em of A.embers){ em.x+=em.vx*dt; em.y+=em.vy*dt; em.life-=dt;
      if(live&&Math.abs(em.x-P.x)<10&&Math.abs(em.y-(P.y-PH/2))<22){ em.life=0; if(P.hurtT<=0&&!GOD){ if(P.light<=0) loseLife('ember'); else { P.light--; P.hurtT=0.5; sfx.ember(); game.flash=0.15; } } }
      const g=d.gy(em.x); if(em.y>g) em.life=0; }
    A.embers=A.embers.filter(e=>e.life>0); }
  for(const p of A.particles){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.985; p.vy=p.vy*0.985+(p.gold?-6:0)*dt; }
  A.particles=A.particles.filter(p=>p.t<p.life);
  for(const r of A.rings){ r.t+=dt; r.r=r.R*sm(Math.min(1,r.t/0.6)); } A.rings=A.rings.filter(r=>r.t<0.9);
  for(const s of A.streams) s.t+=dt; A.streams=A.streams.filter(s=>s.t<1.2);
  if(A.rng()<dt*6) A.particles.push({x:camX+A.rng()*W,y:camY+A.rng()*H,vx:(A.rng()-.3)*10,vy:-4-A.rng()*6,life:5,t:0,dust:1});
  // throne
  if(d.throne&&!game.throne&&P.x>d.throne.x-10&&P.ground&&live) startThrone();
  if(game.throne){ game.throne.t+=dt; if(game.throne.phase!=='release') P.x+=(d.throne.x-P.x)*Math.min(1,dt*3); }
  if(game.cine){ game.cine.t+=dt; if(game.cine.t>game.cine.dur&&game.cine.lineDone&&!game.cine.done){ game.cine.done=true; goArea(7); } }
  // bench: the ending
  if(d.bench&&!game.ending&&P.x>d.bench.x-6&&live){ game.ending={t:0}; P.ctrl=false; P.vx=0; P.sit=1; say('22',{again:true,delay:1.0,cb:()=>{ say('23',{again:true,cb:()=>{ if(game.night){ game.ending.sec=game.ending.t; game.log.push(['nightending']); say('ln2',{again:true,delay:0.8,cb:()=>{ const fin=()=>setTimeout(()=>{ if(game.ending) game.ending.lineDone=true; },2500); if([7,8,9].every(n=>game.relics.has(n))){ game.log.push(['nightsecret']); game.ending.nsec=1; say('nx1',{again:true,delay:0.6,cb:fin}); } else fin(); }}); }
  else if([...game.relics].filter(n=>n<DAYN).length>=DAYN){ game.ending.sec=game.ending.t; game.log.push(['secretending']); if(!nightOpen()) game.nightNew=true; store.set('night',1); say('sx1',{again:true,delay:0.8,cb:()=>{ setTimeout(()=>{ if(game.ending) game.ending.lineDone=true; },2500); }}); } else game.ending.lineDone=true; }}); }}); }
  if(game.ending){ game.ending.t+=dt; P.x+=(d.bench.x-P.x)*Math.min(1,dt*3); if(game.ending.lineDone&&!game.ending.out){ game.ending.out=true; game.ending.outT=game.ending.t; } if(game.ending.out&&game.ending.t-game.ending.outT>4&&game.state==='play') endGame(); }
  if(live&&!d.throne&&!d.bench&&P.x>d.len-30&&A.veil<0.5){ if(d.secret) exitSecret(true); else goArea(game.areaI+1); }
  const tg=game.areaI===7?0.9:0.3+1.7*(1-Math.exp(-P.light/15)); P.glow+=(tg-P.glow)*Math.min(1,dt*(tg>P.glow?1.6:3)); P.pulse=Math.max(0,(P.pulse||0)-dt*1.8); // v7: the light you carry builds up as you gather it
}
function goArea(i){ game.state='trans'; game.transT=0; game.transDone=false; game.nextArea=i; P.ctrl=false; if(game.cine) game.cine.fadeOut=true; syncArt(); }
function startGame(fresh,night,ember){
  const i=fresh?0:START_AREA;  // after a game over it is always the very beginning
  game.runsThisSitting=(game.runsThisSitting||0)+1; // the land card is per land this sitting (cardSeen), not per journey
  if(!game.legendSeen) game.lightMark=undefined;
  if(night!==undefined) game.night=!!night; game.ember=!!ember&&!game.night; game.splits=[]; game.split=null; game.actT=0; game.fromStart=i===0; game.newBest=null;
  game.stats={motes:0,calmed:0,lanterns:0,given:0,shrines:0,start:game.t,falls:0,hits:0,lost:0,bosses:0,oneups:0};
  game.lives=game.ember?1:START_LIVES; game.lifeMotes=0; game.popups=[]; game.deaths=[]; game.stop=0; game.slowT=0; game.relics=new Set(); game.secretsSpent=new Set(); game.secretFrom=null; game.transFn=null;
  vo.queue.length=0; game.throne=null; game.cine=null; game.ending=null; // v11.4: lines already heard this sitting stay heard. The game-over line uses again.
  P.light=i>=4?6:3; P.dead=0; P.fellT=0; game.moves=game.night?6:Math.min(6,i); resetMoves();
  for(let n=0;n<SECRETS.length;n++) if(!!SECRETS[n].night!==game.night) game.secretsSpent.add(n); // v7: the day's hidden places sleep through the Long Night, and the night's sleep by day
  bot.skip.clear();
  game.state='trans'; game.transT=0.6; game.transDone=false; game.nextArea=i; P.ctrl=false; A=null;
  game.runFar=0; game.prevRec=null; game.runNo=0; game.paint=null; game.retLine=null; game.dmShow=0;
  if(game.fromStart){ const r=recGet(), k=recKey(), o=r[k]||{runs:0}; game.prevRec=o.far?{far:o.far,ai:o.ai,x:o.x}:null; o.runs=(o.runs|0)+1; game.runNo=o.runs; r[k]=o; store.set('rec',r); // v10
    const tot=['day','night','ember'].reduce((q,j)=>q+((r[j]&&r[j].runs)|0),0); // v11: the narrator notices a returning wanderer (never with advice)
    const rl=game.ember&&o.runs===1?'rp8':tot===5?'rp1':tot===10?'rp2':tot===25?'rp3':tot===50?'rp4':null; if(rl) game.retLine=rl; }
  game.log.push(['start',i,+game.t.toFixed(1),game.night?'night':'day']);
}
function gameOver(){
  game.state='gameover'; game.goT=0; game.goArea=game.areaI; game.stats.time=game.t-game.stats.start;
  stopMusic(2.5); sfx.gameover(); vo.queue.length=0; say('go1',{again:true,delay:1.4});
  game.log.push(['gameover',game.areaI,+game.t.toFixed(1)]);
}
function endGame(){ game.state='end'; game.endT=0; game.stats.time=game.t-game.stats.start; noteFar(8,0,true); // v10
  if(game.fromStart&&!game.ember){ const k=game.night?'night':'day', b=store.get('best')||{}; const old=b[k]&&b[k].t; game.oldBest=old||null;
    if(!old||game.stats.time<old){ b[k]={t:game.stats.time,splits:game.splits.slice()}; store.set('best',b); game.newBest=true; } } playMusic('title',4); game.log.push(['end',+game.t.toFixed(1)]); }
/* ---------------- drawing ---------------- */
const lc=document.createElement('canvas'); lc.width=W; lc.height=H; const lx=lc.getContext('2d');
const post=document.createElement('canvas'); post.width=W; post.height=H; const px=post.getContext('2d');
const vig=document.createElement('canvas'); vig.width=W; vig.height=H;
function ensureVig(){
  if(vigRS===RS&&vig.width===cv.width&&vig.height===cv.height) return;
  vigRS=RS; vig.width=cv.width; vig.height=cv.height; const g=vig.getContext('2d');
  g.setTransform(RS,0,0,RS,0,0); g.clearRect(0,0,W,H);
  const gr=g.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.95); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(10,4,0,0.62)'); g.fillStyle=gr; g.fillRect(0,0,W,H);
  if(RS<2){ g.setTransform(1,0,0,1,0,0); g.fillStyle='rgba(0,0,0,0.06)'; for(let y=0;y<vig.height;y+=3) g.fillRect(0,y,vig.width,1); } // device rows. Dropped at RS 2, where they moiré.
}
// v10: the paintings are not quite still. They breathe very slowly; once in each act the far and near layers of the painting
// drift apart and back, as if it turned to look; and when a stone wakes or an old power is calmed, the painting opens up.
// It is only ever the backdrop: nothing over the play moves.
const PAINT={wake:[2.5,3.5,3.5,0.05,1.0,'255,190,110',0.11],calm:[1.6,2.4,3.0,0.035,0.7,'205,220,255',0.08],drift:[3.5,3,4.5,0.012,0.0,'',0]};
function paintEnv(){ const g=game.paint; if(!g) return null; const c=PAINT[g.k]; const [a,h,f]=c, T=a+h+f;
  if(g.t>=T){ game.paint=null; return null; } const e=g.t<a?sm(g.t/a):g.t<a+h?1:sm(1-(g.t-a-h)/f); return {e,c,k:g.k,t:g.t}; }
function paintTick(dt){ if(game.paint) game.paint.t+=dt; const d=A.d; if(d.secret||!d.act2||game.paint) return;
  const cam=camX+W*0.36, end=d.boss?d.boss.a0:d.len, mids=[d.act2*0.5,(d.act2+end)*0.5]; A.paintDone=A.paintDone||[0,0];
  for(let i=0;i<2;i++) if(!A.paintDone[i]&&cam>mids[i]&&(i===0?A.act!==2:A.act===2)){ A.paintDone[i]=1; game.paint={k:'drift',t:0,dir:(game.areaI+i)%2?1:-1}; } }
// A painting fades in over the 260px before its anchor. If that window crosses a pool, hold the
// painting that is already up until the far bank: two paintings at once hide the lip (the shore's first pool).
function backdropPlan(imgs, gaps, cam){
  const WIN=260, PRE=390, POST=130;
  const bounds=imgs.map((im,i)=>{
    if(!i) return null;
    let start=im[1]-PRE, end=im[1]-POST;
    for(const g of [...gaps].sort((a,b)=>a[0]-b[0])){ if(end>g[0]&&start<g[1]){ start=g[1]+24; end=start+WIN; } }
    return [start,end];
  });
  let k=0; for(let i=1;i<imgs.length;i++) if(cam>=bounds[i][1]) k=i;
  let inI=null, inA=0;
  if(k+1<imgs.length){ const [a,b]=bounds[k+1]; const t=b<=a?1:clamp((cam-a)/(b-a),0,1);
    if(t>0){ inI=k+1; inA=sm(t); } } // the new painting fades in over the one already there, which stays opaque
  return {k,outA:1,inI,inA};
}
function backdropState(){
  const d=A.d, imgs=d.imgs; const cam=camX+W*0.36; const pe=paintEnv(), pz=0.005*Math.sin(game.t*0.11)+(pe?pe.c[3]*pe.e:0), spread=pe?pe.c[4]*pe.e:0;
  const dx=pe&&pe.k==='drift'?Math.sin(Math.min(1,pe.t/11)*Math.PI)*(game.paint.dir||1):0;
  const plan=backdropPlan(imgs,d.gaps,cam);
  const draws=[]; if(plan.outA>0.004) draws.push([plan.k,plan.outA]); if(plan.inI!==null&&plan.inA>0.004) draws.push([plan.inI,plan.inA]);
  if(!draws.length) draws.push([plan.k,1]);
  return {d,imgs,cam,pe,pz,spread,dx,draws};
}
function paintWash(pe){ if(pe&&pe.c[6]){ cx.save(); cx.globalCompositeOperation='lighter'; cx.fillStyle=`rgba(${pe.c[5]},${(pe.c[6]*pe.e).toFixed(3)})`; cx.fillRect(0,0,W,H); cx.restore(); } }
function drawBackdrop(){
  const s=backdropState();
  for(const [i,alpha] of s.draws){
    const [n,at]=s.imgs[i]; const end=s.imgs[i+1]?s.imgs[i+1][1]:s.d.len; const p=clamp((s.cam-at+390)/(end-at+390),0,1);
    cx.globalAlpha=alpha;
    if(wantLayers()&&layersReady(n)) drawLayers(n,p,s.pz,s.dx,s.spread,s.pe);
    else drawBands(n,p,s.pz,s.dx,s.spread,s.pe); // v10: the drift never shows a layer's edge. x1–x8 stay on this path.
  }
  cx.globalAlpha=1;
  paintWash(s.pe);
}
// Every layer of one painting shares one scale (the manifest's 1.16) so an edge is never drawn twice.
function drawLayers(n,p,pz,dx,spread,pe){
  const e=PACK[n], sc0=e.parallax.scale, breath=e.parallax.breath_per_layer||[1,1.5,2];
  e.layers.forEach((L,li)=>{
    const im=IMG[n+'_'+L.id]; if(!im) return;
    const sc=sc0*(1+pz*(breath[li]===undefined?1+li*0.5:breath[li]));
    const dw=W*sc, dh=H*sc, slack=dw-W, par=L.par;
    let ox=-slack*0.5+slack*(0.5-p)*par*0.9+(li?(li===1?-1:1)*dx*W*0.022*li:dx*W*0.008);
    const oy=-(dh-H)*0.6-camY*par*0.35-spread*li*5;
    if(pe) ox=clamp(ox,W-dw,0);
    const b=L.box, fx=dw/1920, fy=dh/1080;
    cx.drawImage(im, ox+b[0]*fx, oy+b[1]*fy, b[2]*fx, b[3]*fy);
  });
}
function drawBands(n,p,pz,dx,spread,pe){
  const im=baseImg(n); if(!im) return; const b=bands(n);
  const layers=[[im,1.16,0.35,0],[b[0],1.28,0.7,1],[b[1],1.42,1.0,2]];
  for(const [src,sc0,par,li] of layers){ const sc=sc0*(1+pz*(1+li*0.5)); const dw=W*sc, dh=H*sc; const slack=dw-W; const ox=-slack*0.5+slack*(0.5-p)*par*0.9+(li?(li===1?-1:1)*dx*W*0.022*li:dx*W*0.008); const oy=-(dh-H)*0.6-camY*par*0.35-spread*li*5;
    cx.drawImage(src,pe?clamp(ox,W-dw,0):ox,oy,dw,dh); }
}
function groundSegs(){ const d=A.d; const x0=Math.floor(camX/8)*8-16, x1=camX+W+24; const segs=[]; let cur=null;
  for(let x=x0;x<=x1;x+=8){ const y=d.gy(x); if(y<1e8){ if(!cur){cur=[];segs.push(cur);} cur.push([x,y]); } else { if(cur){ // close exactly at the gap edge
        let gx=x; for(const g of d.gaps) if(x>g[0]&&x-8<=g[0]) gx=g[0]; cur.push([gx,d.gy(gx-0.01)]); } cur=null; } }
  return segs; }
function drawGround(){
  const d=A.d; const segs=groundSegs();
  // water/abyss in gaps (behind the banks)
  for(const gp of d.gaps){ if(gp[1]<camX-20||gp[0]>camX+W+20) continue;
    const wy=BASE+34; const wg=cx.createLinearGradient(0,wy,0,H-camY+40);
    const wet=d.wet||d.key==='river'||d.key==='shore'; if(!wet){ wg.addColorStop(0,d.key==='war'?'rgba(60,8,2,0.95)':'rgba(10,0,4,0.95)'); wg.addColorStop(1,'#000'); } else { wg.addColorStop(0,'rgba(200,210,215,0.7)'); wg.addColorStop(0.15,'rgba(60,80,100,0.9)'); wg.addColorStop(1,'#050a10'); }
    cx.fillStyle=wg; cx.fillRect(gp[0]-8,wy,gp[1]-gp[0]+16,H-wy-camY+200);
    if(!wet){ cx.fillStyle=d.key==='war'?'rgba(255,90,30,0.55)':'rgba(120,60,40,0.35)'; for(let x=gp[0]+4;x<gp[1]-4;x+=12){ cx.beginPath(); cx.moveTo(x,wy+70); cx.lineTo(x+6,wy+44+Math.sin(x)*4); cx.lineTo(x+12,wy+70); cx.fill(); } }
    if(wet){ cx.strokeStyle='rgba(255,250,230,0.45)'; cx.lineWidth=1; for(let i=0;i<8;i++){ const yy=wy+4+i*9; const off=(game.t*(18+i*7))%60; cx.beginPath(); for(let x=gp[0]-60+off;x<gp[1];x+=60){ const a=Math.max(gp[0],x), b=Math.min(gp[1],x+24-i*2); if(b>a){ cx.moveTo(a,yy); cx.lineTo(b,yy); } } cx.stroke(); } }
  }
  const g=cx.createLinearGradient(0,BASE-40,0,BASE+160); g.addColorStop(0,d.ground[0]); g.addColorStop(0.4,d.ground[1]); g.addColorStop(1,'#000');
  cx.fillStyle=g; cx.beginPath();
  for(const s of segs){ cx.moveTo(s[0][0],H+300); for(const [x,y] of s) cx.lineTo(x,y); cx.lineTo(s[s.length-1][0],H+300); cx.closePath(); }
  cx.fill();
  for(const t of d.tides){ if(t.x+t.w<camX-20||t.x>camX+W+20) continue; const lv=tideLevel(t);
    cx.fillStyle='rgba(40,60,80,0.35)'; cx.fillRect(t.x,BASE-6,t.w,14); // the wet sand shows where the sea comes
    cx.strokeStyle='rgba(220,235,245,0.25)'; cx.lineWidth=1; cx.beginPath(); for(let x=t.x+6;x<t.x+t.w-6;x+=14){ cx.moveTo(x,BASE+3+Math.sin(x)*2); cx.lineTo(x+7,BASE+3+Math.sin(x)*2); } cx.stroke();
    if(lv>0){ const top=BASE+16-lv*14; const wg=cx.createLinearGradient(0,top,0,top+120); wg.addColorStop(0,'rgba(200,215,225,0.75)'); wg.addColorStop(0.08,'rgba(60,85,110,0.92)'); wg.addColorStop(1,'#050a10');
      cx.fillStyle=wg; cx.fillRect(t.x-6,top,t.w+12,H-top-camY+200);
      cx.strokeStyle=`rgba(255,250,235,${0.4+0.4*lv})`; cx.lineWidth=1.5; cx.beginPath(); for(let x=t.x-6;x<=t.x+t.w+6;x+=6) cx.lineTo(x,top+Math.sin(x*0.15+game.t*5)*1.6); cx.stroke(); }
    if(lv>0&&lv<0.06&&!t.washed&&Math.abs(t.x-P.x)<W*0.7){ t.washed=1; sfx.wash(); } if(lv===0) t.washed=0; }
  // soft top edge so the ground melts into the painting
  const g2=cx.createLinearGradient(0,BASE-60,0,BASE); g2.addColorStop(0,'rgba(0,0,0,0)'); g2.addColorStop(1,'rgba(0,0,0,0.18)'); cx.fillStyle=g2; cx.fillRect(camX-10,BASE-60,W+20,60);
  cx.strokeStyle=d.rim; cx.lineWidth=1.5; cx.globalAlpha=0.38; cx.beginPath(); for(const s of segs){ cx.moveTo(s[0][0],s[0][1]); for(const [x,y] of s) cx.lineTo(x,y); } cx.stroke(); cx.globalAlpha=1;
}
function drawSolids(){
  const d=A.d;
  for(const s of d.solids){ if(s.x+s.w<camX-20||s.x>camX+W+20) continue; const top=solidTop(s), by=d.gy(s.x+s.w/2)+8;
    let c1='#4a3020',c2='#120a06';
    if(s.k==='gold'){ c1='#e0aa52'; c2='#6a3a10'; } else if(s.k==='crate'){ c1='#5a2816'; c2='#1a0806'; } else if(s.k==='step'||s.k==='cart'){ c1='#8a6038'; c2='#2a170a'; } else if(s.k==='root'){ c1='#3a2612'; c2='#0c0604'; }
    const g=cx.createLinearGradient(0,top,0,by); g.addColorStop(0,c1); g.addColorStop(1,c2); cx.fillStyle=g;
    cx.beginPath();
    if(s.k==='rock'||s.k==='root'){ cx.moveTo(s.x-5,by); cx.quadraticCurveTo(s.x-3,top+3,s.x+s.w*0.3,top); cx.quadraticCurveTo(s.x+s.w*0.7,top-3,s.x+s.w,top+5); cx.lineTo(s.x+s.w+6,by); }
    else cx.rect(s.x,top,s.w,by-top);
    cx.fill();
    cx.strokeStyle=s.k==='gold'?'rgba(255,245,200,0.85)':'rgba(255,210,150,0.28)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(s.x+2,top+1); cx.lineTo(s.x+s.w-2,top+1); cx.stroke();
    if(s.k==='rock'&&(s.chip||s.spent)){ cx.strokeStyle='rgba(28,10,6,0.9)'; cx.lineWidth=1; cx.beginPath(); const n=s.spent?4:(s.chip|0);
      for(let i=0;i<n;i++){ const x=s.x+5+(i*11)%Math.max(8,s.w-8); cx.moveTo(x,top+6+i*3); cx.lineTo(x+5,top+16+i*2); cx.lineTo(x+1,top+26+i); } cx.stroke();
      if(s.spent){ cx.fillStyle='rgba(18,8,4,0.5)'; cx.fillRect(s.x+2,top,s.w-4,7); } }
    if(s.k==='crate'){ cx.strokeStyle='rgba(0,0,0,0.45)'; cx.strokeRect(s.x+3,top+3,s.w-6,by-top-11); cx.beginPath(); cx.moveTo(s.x+3,top+3); cx.lineTo(s.x+s.w-3,by-8); cx.stroke(); }
  }
  for(const p of A.plats){ if(p.x+p.w<camX-20||p.x>camX+W+20) continue; const k=p.k;
    if(p.rot){ if(p.off&&p.ot>1.2) continue; const sh=p.rt>0&&!p.off?Math.sin(game.t*60)*1.5*Math.min(1,p.rt/p.rot+0.3):0; cx.save(); cx.translate(sh,0); if(p.off) cx.globalAlpha=Math.max(0,1-p.ot/1.2); }
    if(k==='branch'){ cx.fillStyle='#24170c'; cx.beginPath(); cx.moveTo(p.x-8,p.y+1); cx.quadraticCurveTo(p.x+p.w/2,p.y-5,p.x+p.w+10,p.y+2); cx.lineTo(p.x+p.w+4,p.y+9); cx.quadraticCurveTo(p.x+p.w/2,p.y+4,p.x-4,p.y+12); cx.fill(); cx.fillStyle='rgba(255,210,140,0.25)'; cx.fillRect(p.x,p.y,p.w,1.5); }
    else if(k==='stone'){ const g=cx.createLinearGradient(0,p.y,0,p.y+44); g.addColorStop(0,d.key==='dark'?'#4a3a34':'#9a9586'); g.addColorStop(1,'#141210'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(p.x-2,p.y+3); cx.quadraticCurveTo(p.x+p.w/2,p.y-6,p.x+p.w+2,p.y+3); cx.lineTo(p.x+p.w-2,p.y+46); cx.lineTo(p.x+2,p.y+46); cx.fill(); }
    else if(k==='log'){ cx.fillStyle='#3a2414'; cx.fillRect(p.x,p.y,p.w,12); cx.fillStyle='#6a4626'; cx.fillRect(p.x,p.y,p.w,3); cx.fillStyle='#24150a'; cx.beginPath(); cx.ellipse(p.x+p.w,p.y+6,4,6,0,0,TAU); cx.fill(); cx.strokeStyle='rgba(255,250,230,0.4)'; cx.beginPath(); cx.moveTo(p.x-6,p.y+13); cx.lineTo(p.x+p.w+6,p.y+13); cx.stroke(); }
    else if(k==='shard'){ const g=cx.createLinearGradient(0,p.y,0,p.y+30); g.addColorStop(0,'#fff0b8'); g.addColorStop(1,'rgba(160,90,20,0)'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(p.x,p.y); cx.lineTo(p.x+p.w,p.y); cx.lineTo(p.x+p.w*0.62,p.y+30); cx.lineTo(p.x+p.w*0.3,p.y+22); cx.fill(); }
    else { const g=cx.createLinearGradient(0,p.y,0,p.y+14); g.addColorStop(0,k==='plank'?'#7a4426':'#a8763e'); g.addColorStop(1,'#2a1608'); cx.fillStyle=g; cx.fillRect(p.x,p.y,p.w,9); cx.fillStyle='rgba(0,0,0,0.4)'; cx.fillRect(p.x+6,p.y+9,4,22); cx.fillRect(p.x+p.w-10,p.y+9,4,22); }
    if(p.rot){ // the tell: a rotten branch is pale and split; a sinking stone is wet and ringed
      if(k==='branch'){ cx.strokeStyle='rgba(200,170,120,0.55)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(p.x+p.w*0.3,p.y+1); cx.lineTo(p.x+p.w*0.38,p.y+7); cx.lineTo(p.x+p.w*0.33,p.y+10); cx.moveTo(p.x+p.w*0.66,p.y+2); cx.lineTo(p.x+p.w*0.6,p.y+8); cx.stroke(); }
      else { const ph=(game.t*0.8+p.x*0.01)%1; cx.strokeStyle=`rgba(230,240,255,${0.35*(1-ph)})`; cx.lineWidth=1; cx.beginPath(); cx.ellipse(p.x+p.w/2,BASE+36,p.w*0.55+ph*16,3+ph*3,0,0,TAU); cx.stroke(); cx.fillStyle='rgba(20,30,40,0.35)'; cx.fillRect(p.x+4,p.y+6,p.w-8,3); }
      cx.restore(); }
  }
}
function drawThrone(){
  const d=A.d; if(!d.throne) return; const x=d.throne.x; if(x<camX-200||x>camX+W+200) return; const s=d.solids[d.solids.length-1]; const top=solidTop(s);
  const pul=0.5+0.5*Math.sin(game.t*1.2); const gone=game.throne&&game.throne.phase==='release'?clamp(game.throne.t/2,0,1):0;
  cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createRadialGradient(x,top-60,0,x,top-60,190); g.addColorStop(0,`rgba(255,230,160,${0.45+0.15*pul})`); g.addColorStop(1,'rgba(255,170,60,0)'); cx.fillStyle=g; cx.fillRect(x-200,top-260,400,400); cx.restore();
  const tg=cx.createLinearGradient(0,top-110,0,top); tg.addColorStop(0,'#fff2c0'); tg.addColorStop(1,'#b07428'); cx.fillStyle=tg;
  cx.beginPath(); cx.moveTo(x-26,top); cx.lineTo(x-24,top-62); cx.lineTo(x-30,top-100); cx.lineTo(x-12,top-84); cx.lineTo(x,top-118); cx.lineTo(x+12,top-84); cx.lineTo(x+30,top-100); cx.lineTo(x+24,top-62); cx.lineTo(x+26,top); cx.closePath(); cx.fill();
  cx.fillStyle='rgba(120,70,20,0.55)'; cx.fillRect(x-17,top-58,34,40); cx.fillStyle='#d49a48'; cx.fillRect(x-22,top-20,44,8);
}
// procedural silhouette layers (behind and in front), seeded per area
function silLayer(kind,par,front){
  const span=front?260:200; const off=camX*par;
  const first=Math.floor((off-80)/span), last=Math.floor((off+W+80)/span);
  for(let i=first;i<=last;i++){
    const rr=rngf(i*9301+(front?49297:233)+game.areaI*7919);
    const bx=i*span+rr()*span*0.7-off, baseY=(front?H+8:BASE+8)-camY*(front?1.15:0.6);
    const skip=rr(); if(!front&&skip<0.25) continue; if(front&&skip<0.5) continue;
    cx.save(); cx.translate(bx,baseY); const s=front?1.2+rr()*0.5:0.6+rr()*0.5; cx.scale(s,s);
    cx.fillStyle=front?'rgba(8,4,2,0.9)':'rgba(20,10,6,0.4)';
    const t=game.t;
    switch(kind){
      case 'shore': if(rr()<0.5){ cx.beginPath(); cx.moveTo(-60,0); cx.quadraticCurveTo(0,-26-rr()*20,70,0); cx.fill(); } else { for(let k=0;k<6;k++){ cx.save(); cx.rotate(-0.4+k*0.16+Math.sin(t*1.3+k+i)*0.05); cx.fillRect(-1,-30-rr()*30,2,32+rr()*20); cx.restore(); } if(!front) cx.fillRect(-3,-80,6,80); } break;
      case 'forest': { const hgt=front?180:320; const lean=(rr()-.5)*60; cx.beginPath(); cx.moveTo(-10,0); cx.quadraticCurveTo(-6+lean*0.3,-hgt*0.5,lean-4,-hgt); cx.lineTo(lean+8,-hgt); cx.quadraticCurveTo(10+lean*0.3,-hgt*0.5,14,0); cx.fill(); if(front){ for(let k=0;k<5;k++){ cx.save(); cx.rotate(-0.5+k*0.25+Math.sin(t+k)*0.04); cx.fillRect(-1,-24,2,26); cx.restore(); } } } break;
      case 'river': for(let k=0;k<7;k++){ cx.save(); cx.translate(k*5-15,0); cx.rotate(-0.15+k*0.05+Math.sin(t*1.1+k+i)*0.06); cx.fillRect(-1,-40-rr()*40,2,44+rr()*30); cx.beginPath(); cx.ellipse(0,-60-rr()*20,2.5,9,0,0,TAU); cx.fill(); cx.restore(); } break;
      case 'kingdom': if(front){ cx.fillRect(-3,-130,6,130); cx.beginPath(); cx.moveTo(3,-126); cx.quadraticCurveTo(30,-120+Math.sin(t*2+i)*4,46,-110); cx.lineTo(3,-98); cx.fill(); } else { const hh=110+rr()*130; cx.fillRect(-14,-hh,28,hh); cx.beginPath(); cx.moveTo(-18,-hh); cx.lineTo(0,-hh-50-rr()*30); cx.lineTo(18,-hh); cx.fill(); cx.fillStyle='rgba(255,190,110,0.25)'; cx.fillRect(-4,-hh+20,8,12); } break;
      case 'war': if(rr()<0.55){ const w=front?90:110; cx.fillStyle=front?'rgba(20,4,2,0.9)':'rgba(70,10,6,0.45)'; cx.beginPath(); cx.moveTo(-w/2,0); cx.lineTo(0,-w*0.85); cx.lineTo(w/2,0); cx.fill(); cx.fillRect(-1,-w*0.85-14,2,16); } else { cx.fillRect(-2,-160,3,160); cx.fillStyle=front?'rgba(60,6,4,0.9)':'rgba(120,20,10,0.45)'; cx.beginPath(); cx.moveTo(0,-158); for(let k=0;k<=6;k++) cx.lineTo(k*9,-158+Math.sin(t*3+k*0.9+i)*4+k*1.5); cx.lineTo(54,-130); for(let k=6;k>=0;k--) cx.lineTo(k*9,-130+Math.sin(t*3+k*0.9+i)*4); cx.fill(); } break;
      case 'dark': { cx.beginPath(); cx.moveTo(-8,0); let x=0,y=0; for(let k=0;k<5;k++){ x+=(rr()-.5)*30; y-=36+rr()*30; cx.lineTo(x-3,y); } cx.lineTo(x+4,y); cx.lineTo(10,0); cx.fill(); cx.strokeStyle=cx.fillStyle; cx.lineWidth=2; cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x-20,y-20); cx.moveTo(x,y); cx.lineTo(x+18,y-26); cx.stroke(); } break;
      case 'heart': cx.fillStyle=front?'rgba(70,36,8,0.7)':'rgba(255,225,150,0.2)'; cx.beginPath(); cx.moveTo(-10,0); cx.lineTo(-3,-60-rr()*80); cx.lineTo(6,-40-rr()*50); cx.lineTo(12,0); cx.fill(); break;
      case 'garden': cx.beginPath(); cx.ellipse(0,-18,40,26,0,0,TAU); cx.fill(); cx.fillStyle=front?'rgba(120,20,30,0.85)':'rgba(220,80,90,0.35)'; for(let k=0;k<6;k++){ cx.beginPath(); cx.arc(-28+k*11,-28-(k%2)*12,4,0,TAU); cx.fill(); } break;
    }
    cx.restore();
  }
}
function drawShrine(){
  const s=A.shrine; if(!s) return; const gy=A.d.gy(s.x); if(s.x<camX-100||s.x>camX+W+100) return;
  const aw=s.awake?clamp(s.t/1.5,0,1):0;
  if(aw>0){ const g=cx.createLinearGradient(0,gy-460,0,gy); g.addColorStop(0,'rgba(255,220,140,0)'); g.addColorStop(1,`rgba(255,232,165,${0.5*aw})`); cx.fillStyle=g; cx.fillRect(s.x-24,gy-460,48,460); }
  const g=cx.createLinearGradient(0,gy-92,0,gy); g.addColorStop(0,aw>0?'#8a7050':'#5a4a3a'); g.addColorStop(1,'#15100a'); cx.fillStyle=g;
  cx.beginPath(); cx.moveTo(s.x-20,gy+5); cx.lineTo(s.x-16,gy-78); cx.quadraticCurveTo(s.x,gy-96,s.x+16,gy-78); cx.lineTo(s.x+20,gy+5); cx.fill();
  const pulse=0.35+0.25*Math.sin(game.t*2.4);
  cx.strokeStyle=aw>0?`rgba(255,240,180,${0.6+0.4*aw})`:`rgba(255,200,120,${pulse})`; cx.lineWidth=2;
  cx.beginPath(); for(let a=0;a<TAU*2.2;a+=0.2){ const r=2+a*1.6; const xx=s.x+Math.cos(a)*r, yy=gy-48+Math.sin(a)*r; a?cx.lineTo(xx,yy):cx.moveTo(xx,yy); } cx.stroke();
  if(!s.awake&&Math.abs(P.x-s.x)<140) text(`${Math.min(P.light,s.need)} / ${s.need}`,s.x,gy-108,13,P.light>=s.need?'#fff4c0':'#e9c8a0','center',0.95);
}
function drawVeil(){
  if(A.veil<=0.01) return; const x=A.d.len-110; if(x>camX+W+80) return;
  for(let i=0;i<28;i++){ const yy=BASE-290+i*12+Math.sin(game.t*0.7+i)*6, xx=x+Math.sin(game.t*0.9+i*1.7)*16;
    const g=cx.createRadialGradient(xx,yy,2,xx,yy,64); g.addColorStop(0,`rgba(12,5,12,${0.6*A.veil})`); g.addColorStop(1,'rgba(12,5,12,0)'); cx.fillStyle=g; cx.fillRect(xx-64,yy-64,128,128); }
}
function drawLanterns(){
  for(const l of A.lanterns){ if(l.x<camX-40||l.x>camX+W+40) continue; const gy=A.d.gy(l.x);
    cx.fillStyle='#1a0f08'; cx.fillRect(l.x-2,gy-96,4,96); cx.fillRect(l.x-2,gy-96,18,3);
    const sw=Math.sin(game.t*1.6+l.x)*2; cx.fillStyle=l.lit?'#ffe0a0':'#3a2a1c'; cx.fillRect(l.x+9+sw,gy-90,10,14); cx.strokeStyle='#1a0f08'; cx.strokeRect(l.x+9+sw,gy-90,10,14); }
  for(const b of A.braziers){ if(b.x<camX-40||b.x>camX+W+40) continue; const gy=A.d.gy(b.x);
    cx.fillStyle='#2a140c'; cx.beginPath(); cx.moveTo(b.x-15,gy-34); cx.lineTo(b.x+15,gy-34); cx.lineTo(b.x+5,gy-16); cx.lineTo(b.x+3,gy); cx.lineTo(b.x-3,gy); cx.lineTo(b.x-5,gy-16); cx.fill();
    if(b.lit){ const fl=b.snuff>0?(0.35+0.65*Math.abs(Math.sin(game.t*28)))*Math.max(0.3,b.snuff):1; for(let k=0;k<3;k++){ const fh=(12+Math.sin(game.t*9+k*2)*4)*fl; cx.fillStyle=k?'rgba(255,170,60,0.85)':'rgba(255,240,180,0.95)'; cx.beginPath(); cx.ellipse(b.x+(k-1)*5,gy-36-fh/2,4-k*0.5,fh/2,0,0,TAU); cx.fill(); } }
    else { cx.fillStyle=`rgba(255,120,60,${0.25+0.15*Math.sin(game.t*3)})`; cx.fillRect(b.x-6,gy-36,12,2); } }
}
function drawNPCs(){
  for(const n of A.npcs){ const x=n.x; if(x<camX-40||x>camX+W+40) continue; const gy=A.d.gy(x); if(gy>1e8) continue;
    cx.save(); cx.translate(x,gy+2); cx.scale(n.s,n.s); cx.globalAlpha=0.8; drawFigure(cx,0,0,1,n.ph,n.lit?0.6:0,{cloak:'#2a1810',head:n.lit?'#ffcf80':'#3a2416',small:true}); cx.restore(); }
  cx.globalAlpha=1;
}
function drawEnemies(){
  for(const e of A.enemies){ if(e.x<camX-120||e.x>camX+W+120) continue; const t=e.ph;
    const calmA=e.calm?clamp(e.ct/1.8,0,1):0;
    if(e.t==='wisp'){ if(calmA>=1) continue; cx.save(); cx.globalAlpha=1-calmA;
      for(let k=0;k<6;k++){ const r=14-k*1.5; const ox=Math.sin(t*3+k)*4-k*3*Math.sign(P.x-e.x||1), oy=Math.cos(t*2.3+k)*3+k*2;
        const g=cx.createRadialGradient(e.x+ox,e.y+oy,0,e.x+ox,e.y+oy,r+6); g.addColorStop(0,e.calm?'rgba(255,220,150,0.7)':'rgba(15,5,15,0.8)'); g.addColorStop(1,'rgba(15,5,15,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(e.x+ox,e.y+oy,r+6,0,TAU); cx.fill(); }
      if(!e.calm){ cx.fillStyle=e.hit>0?'#fff':'rgba(255,120,80,0.85)'; cx.fillRect(e.x-5,e.y-3,2,2); cx.fillRect(e.x+3,e.y-3,2,2); } cx.restore(); }
    else if(e.t==='frygar'){ cx.save(); cx.translate(e.x,e.y);
      if(e.calm){ cx.fillStyle='#4a1a0c'; cx.beginPath(); cx.moveTo(-12,0); cx.lineTo(-8,-26); cx.quadraticCurveTo(0,-36,8,-26); cx.lineTo(14,0); cx.fill(); cx.fillStyle='#1a0806'; cx.beginPath(); cx.arc(0,-32,6,0,TAU); cx.fill();
        cx.strokeStyle='#8a6a50'; cx.lineWidth=2; cx.beginPath(); cx.moveTo(14,-2); cx.lineTo(40,-4); cx.stroke();
        cx.fillStyle=`rgba(255,200,120,${0.4+0.2*Math.sin(game.t*2)})`; cx.beginPath(); cx.arc(0,-32,3,0,TAU); cx.fill(); }
      else { const sw=Math.sin(t*6)*3; cx.fillStyle=e.hit>0?'#8a3a20':'#5a1a0c'; cx.beginPath(); cx.moveTo(-14,0); cx.lineTo(-9+sw*0.5,-40); cx.lineTo(9,-40); cx.lineTo(14-sw*0.3,0); cx.fill();
        cx.fillStyle='#140604'; cx.fillRect(-8,-56,16,18); cx.beginPath(); cx.moveTo(-9,-56); cx.lineTo(0,-64); cx.lineTo(9,-56); cx.fill();
        cx.fillStyle='rgba(255,120,40,0.95)'; cx.fillRect(e.dir>0?1:-6,-50,5,2);
        if(e.tele>0){ cx.rotate(-0.25*e.dir); cx.fillStyle='rgba(255,140,60,0.9)'; cx.fillRect(e.dir>0?1:-6,-50,5,2); } if(e.tele<=0||Math.floor(game.t*20)%2){ cx.strokeStyle='#b0a090'; cx.lineWidth=2; cx.beginPath(); cx.moveTo(e.dir*10,-20); cx.lineTo(e.dir*18,-84); cx.stroke(); cx.fillStyle='#d0c0a0'; cx.beginPath(); cx.moveTo(e.dir*18-3,-84); cx.lineTo(e.dir*19,-96); cx.lineTo(e.dir*18+3,-84); cx.fill(); } }
      cx.restore(); }
    else { if(calmA>=1) continue;
      if(e.t==='guard'&&!e.calm){ const r=e.r||170, gy=gyOr(e.x), lx0=e.x+e.dir*16, ly0=e.y-60; const fl=e.turnW?0.5+0.5*Math.sin(game.t*30):1, red=e.alarm>0;
        cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createLinearGradient(lx0,0,e.x+e.dir*r,0); g.addColorStop(0,red?`rgba(255,90,50,${0.55*fl})`:`rgba(255,220,150,${0.48*fl})`); g.addColorStop(1,'rgba(255,190,110,0.04)');
        cx.fillStyle=g; cx.beginPath(); cx.moveTo(lx0,ly0); cx.lineTo(e.x+e.dir*r,gy-34); cx.lineTo(e.x+e.dir*r,gy+2); cx.lineTo(e.x+e.dir*22,gy+2); cx.closePath(); cx.fill();
        cx.strokeStyle=red?`rgba(255,120,80,${0.6*fl})`:`rgba(255,230,170,${0.4*fl})`; cx.lineWidth=1; cx.beginPath(); cx.moveTo(lx0,ly0); cx.lineTo(e.x+e.dir*r,gy-34); cx.moveTo(e.x+e.dir*22,gy+1); cx.lineTo(e.x+e.dir*r,gy+1); cx.stroke();
        cx.fillStyle=red?'rgba(255,120,80,0.95)':`rgba(255,230,170,${0.9*fl})`; cx.beginPath(); cx.arc(lx0,ly0,4,0,TAU); cx.fill(); cx.restore(); }
      let bob=0,rot=0,sx=1,sy=1; const tk=e.tele>0?1-e.tele/0.6:0;
      if(e.t==='walker'){ const st=t*(e.chasing?12:7); bob=Math.abs(Math.sin(st))*4; rot=Math.sin(st)*0.07+(e.chasing?0.12*e.dir:0); sy=1-Math.abs(Math.cos(st))*0.05; sx=1/sy; }
      else if(e.t==='flyer'){ rot=Math.sin(t*12)*0.1+(e.tele>0?Math.sin(t*70)*0.25:0); sx=1+Math.sin(t*30)*0.06; }
      else if(e.t==='thrower'||e.t==='spitter'){ sy=1-0.14*tk+Math.sin(t*2)*0.02; sx=1+0.12*tk; rot=e.tele>0?-0.18*e.dir*tk:Math.sin(t*1.4)*0.05; if(e.tele<=0&&e.cd>2.2) rot=0.25*e.dir*(e.cd-2.2)/0.3; }
      else if(e.t==='stalker'){ rot=Math.sin(t*1.5)*0.06; bob=Math.sin(t*2)*2; sx=1+Math.sin(t*3)*0.03; }
      const glow=e.calm?'rgba(255,210,130,0.95)':e.tele>0?'rgba(255,80,30,1)':e.hit>0?'rgba(255,255,220,0.9)':'rgba(120,10,0,0.75)';
      drawSpr(e.spr,e.x,e.y-bob+(e.t==='stalker'?4:2),e.h,{flip:e.dir>0,rot,sx,sy,alpha:1-calmA,flash:e.hit>0?e.hit/0.4:0,gold:e.calm?0.5+calmA:0,glow,glowB:e.tele>0?24:12});
    }
  }
}
/* v8: living bosses. Each boss is still one AI-generated cut-out, but it is drawn as a puppet: the image is cut into thin
   horizontal bands in code and each band is offset on its own, so the body can bend, breathe, crouch before an attack, snap
   through it, recoil when hit, shudder through a change of form and come apart into light when calmed. Springs give the
   overshoot and follow-through; hair, chains, cloth and tendrils hang off it with trailing lag. All of it is drawing only:
   the boss's position, timings and hitbox are exactly as before. */
const RIG={ // u,v: points on the image (0..1 from its left/top, before any flip). eye: glowing eyes; ch: hanging chains
  smonster:{tint:'rgba(52,14,34,0.34)',rim:'rgba(14,2,10,0.9)',eye:[[0.36,0.2],[0.47,0.2]],ec:'255,235,200',wa:0.05,wk:5,chest:0.45,ch:[[0.14,0.36,5,9,'h'],[0.27,0.5,6,9,'h'],[0.72,0.48,6,9,'h'],[0.86,0.62,5,8,'h'],[0.5,0.62,6,10,'h']]},
  yogi:{eye:[[0.4,0.3],[0.55,0.3]],ec:'255,190,90',wa:0.015,wk:3,chest:0.5,wing:[[0.22,0.34],[0.8,0.34]],ch:[[0.3,0.12,4,7,'f'],[0.68,0.1,4,7,'f']]},
  armour:{eye:[[0.5,0.3]],ec:'255,214,140',er:1.8,wa:0.012,wk:3,chest:0.35,ch:[[0.5,0.32,6,9,'e'],[0.5,0.32,5,9,'e'],[0.5,0.32,6,8,'e']]},
  doig:{eye:[[0.38,0.12],[0.52,0.12]],ec:'255,120,60',wa:0.01,wk:2,chest:0.55,ch:[[0.1,0.3,7,9,'c'],[0.86,0.33,7,9,'c']]},
  neco:{eye:[[0.46,0.2],[0.56,0.2]],ec:'255,80,60',wa:0.02,wk:3,chest:0.5,ch:[[0.6,0.3,8,11,'s']]},
  vere:{eye:[[0.26,0.4],[0.67,0.4]],ec:'150,220,255',er:1.3,wa:0.02,wk:3,chest:0.3,jaw:0.64,mw:0.42,mx:0.47,ch:[[0.36,0.88,5,8,'t'],[0.47,0.9,6,9,'t'],[0.58,0.88,5,8,'t']]},
  kingbell:{eye:[[0.43,0.17],[0.55,0.17]],ec:'255,236,170',wa:0.008,wk:2,chest:0.42,ch:[[0.86,0.86,6,9,'b']]}
};
function featherCopy(img,f){ const k=document.createElement('canvas'); k.width=img.width; k.height=img.height; const g=k.getContext('2d'); g.drawImage(img,0,0);
  g.globalCompositeOperation='destination-out'; const W0=img.width,H0=img.height, fw=W0*f, fh=H0*f;
  const lg=(x0,y0,x1,y1)=>{ const q=g.createLinearGradient(x0,y0,x1,y1); q.addColorStop(0,'rgba(0,0,0,1)'); q.addColorStop(1,'rgba(0,0,0,0)'); return q; };
  g.fillStyle=lg(0,0,fw,0); g.fillRect(0,0,fw,H0); g.fillStyle=lg(W0,0,W0-fw,0); g.fillRect(W0-fw,0,fw,H0); g.fillStyle=lg(0,0,0,fh); g.fillRect(0,0,W0,fh);
  return k; } // the cut-outs were cropped from paintings, so some have a straight edge; fade it instead of showing it
const RC=document.createElement('canvas'), rcx=RC.getContext('2d'), RC2=document.createElement('canvas'), rc2=RC2.getContext('2d');
function rigOf(B){ let R=B.rg; if(!R) R=B.rg={lean:0,lv:0,sq:0,sv:0,px:B.x,py:B.y,vx:0,lt:game.t,lst:B.st,step:0,hitS:0,ch:null,rings:[],br:0}; return R; }
function rigPt(B,P0,u,v){ // world position of image point (u,v) under the current pose
  const fl=P0.flip?-1:1, uh=1-v; return [P0.x+(u-0.5)*P0.w*fl+P0.R.lean*Math.pow(uh,1.6)*P0.h+Math.sin(P0.wt-uh*P0.c.wk)*P0.c.wa*uh*P0.h+(P0.jit?P0.jit(v):0), P0.y-uh*P0.hh+(P0.c.jaw&&v>P0.c.jaw?P0.jd:0)]; }
function rigStep(B,R,dt){
  const vx=(B.x-R.px)/Math.max(dt,1e-3); R.px=B.x; R.py=B.y; if(dt>0) R.vx+=(clamp(vx,-600,600)-R.vx)*Math.min(1,dt*8);
  const f=B.face||1; let lt=clamp(R.vx/1100,-0.07,0.07), st=0;
  if(B.st==='tele'){ const k=sm(clamp(B.t/0.75,0,1)); st=-0.1*k; lt=-0.06*f*k; }       // anticipation: gathers itself, leans back
  else if(B.st==='charge'){ lt=0.12*B.cdir; st=0.03; }
  else if(B.st==='act'){ lt=0.03*f*Math.max(0,1-B.t*2); }
  else if(B.st==='rest'){ st=-0.06; lt=0.025*f; }                                   // spent: sags, head drops
  else if(B.st==='dive'){ st=B.t<0.35?-0.07:0.09; }
  else if(B.st==='sleep'){ st=-0.03; }
  if(B.calm){ lt=0; st=B.kneel?0:-0.02; }
  if(R.lst!==B.st){ const was=R.lst; R.lst=B.st;
    if(was==='tele'&&!B.calm){ R.sv+=1.5; R.lv+=0.9*f; R.flare=0.5; }            // release: snaps up and through
    if(B.st==='rest'&&(was==='charge'||was==='dive')){ R.sv-=1.9; dustAt(B.x,gyOr(B.x),14,B.h); }
    if(B.st==='phase'){ R.rings.push({t:0,c:'255,90,40'}); R.sv+=1.0; }
    if(was==='phase'){ R.sv+=1.8; R.rings.push({t:0,c:B.phase===3?'255,240,200':'255,120,60'}); }
    if(B.st==='intro'){ dustAt(B.x,gyOr(B.x),26,B.h); }
    if(B.st==='move'&&was==='intro'){ R.rings.push({t:0,c:'255,200,140'}); R.sv+=1.2; } }
  if(B.hit>0.4&&!R.hitS){ R.hitS=1; const s=Math.sign(B.x-P.x)||1; R.lv+=1.5*s; R.sv-=1.3; R.flare=0.3;
    for(let i=0;i<10;i++){ const a=-Math.PI/2+(i-4.5)*0.28; A.particles.push({x:B.x-s*B.h*0.15,y:B.y-B.h*0.55,vx:Math.cos(a)*120*s*-1+s*60,vy:Math.sin(a)*130,life:0.5,t:0,gold:1}); } }
  if(B.hit<=0) R.hitS=0;
  if(!B.fly&&!B.calm&&(B.st==='move'||B.st==='charge')&&Math.abs(R.vx)>12){ const s0=Math.floor(R.step); R.step+=Math.abs(R.vx)*dt/(B.h*0.32); if(Math.floor(R.step)!==s0){ R.sv-=B.st==='charge'?0.7:0.35; dustAt(B.x-(B.face||1)*B.h*0.12,gyOr(B.x),4,B.h*0.5); } }
  if(B.st==='tele'&&!B.calm&&((game.t*30)|0)%2===0){ const k=(game.t*7.3)%1, a=k*TAU, r=B.h*0.55, oy=B.y-B.h*0.6; A.particles.push({x:B.x+Math.cos(a)*r,y:oy+Math.sin(a)*r,vx:-Math.cos(a)*r*2.2,vy:-Math.sin(a)*r*2.2,life:0.42,t:0,gold:1}); } // light drawn in to where it will strike
  if(B.calm&&!B.kneel&&B.ct<3.2&&((game.t*40)|0)%2===0){ const k=(game.t*3.7)%1; A.particles.push({x:B.x+(k-0.5)*B.h*0.6,y:B.y-B.h*(0.2+((game.t*5.3)%1)*0.7),vx:(k-0.5)*20,vy:-40-k*40,life:1.3,t:0,gold:1,big:k>0.8}); }
  R.lv+=((lt-R.lean)*90-R.lv*10)*dt; R.lean+=R.lv*dt; R.lean=clamp(R.lean,-0.2,0.2);
  R.sv+=((st-R.sq)*170-R.sv*11)*dt; R.sq+=R.sv*dt; R.sq=clamp(R.sq,-0.2,0.2);
  if(R.flare>0) R.flare-=dt; for(const r of R.rings) r.t+=dt; R.rings=R.rings.filter(r=>r.t<0.9);
}
function dustAt(x,y,n,h){ for(let i=0;i<n;i++){ const s=i%2?1:-1, k=(i*0.37)%1; A.particles.push({x:x+s*k*h*0.3,y:y-2,vx:s*(40+k*120),vy:-20-k*70,life:0.6+k*0.4,t:0,soft:1}); } }
function rigChains(B,R,P0,dt){
  const c=P0.c; if(!c.ch) return; if(!R.ch) R.ch=c.ch.map(q=>{ const [x,y]=rigPt(B,P0,q[0],q[1]); return {q,p:Array.from({length:q[2]},(_,i)=>({x,y:y+i*q[3],ox:x,oy:y+i*q[3]}))}; });
  const st=Math.min(dt,1/30); if(st<=0) return;
  R.ch.forEach((ch,j)=>{ const q=ch.q; const [ax,ay]=rigPt(B,P0,q[0],q[1]); const L=q[3]*(P0.h/150); const ty=q[4];
    const grav=ty==='e'?-140:ty==='h'||ty==='t'?520:ty==='s'?260:700, wind=ty==='s'?-(B.face||1)*260-R.vx*0.6:ty==='e'?Math.sin(game.t*3+j*2.1)*220:0;
    for(let i=1;i<ch.p.length;i++){ const p=ch.p[i]; const vx=(p.x-p.ox)*0.94, vy=(p.y-p.oy)*0.94; p.ox=p.x; p.oy=p.y; p.x+=vx+wind*st*st; p.y+=vy+grav*st*st; }
    ch.p[0].x=ax; ch.p[0].y=ay; ch.p[0].ox=ax; ch.p[0].oy=ay;
    for(let it=0;it<3;it++) for(let i=1;i<ch.p.length;i++){ const a=ch.p[i-1], b=ch.p[i]; const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, k=(d-L)/d; if(i===1){ b.x-=dx*k; b.y-=dy*k; } else { a.x+=dx*k*0.5; a.y+=dy*k*0.5; b.x-=dx*k*0.5; b.y-=dy*k*0.5; } } });
}
function drawChains(B,R,P0,alpha,front){
  if(!R.ch) return; cx.save(); cx.lineCap='round'; cx.lineJoin='round';
  for(const ch of R.ch){ const ty=ch.q[4], p=ch.p, sc=P0.h/150; if((ty==='s')===front) continue;
    if(ty==='e'){ cx.globalCompositeOperation='lighter'; }
    cx.globalAlpha=alpha*(ty==='h'?0.55:ty==='e'?0.5:ty==='f'?0.8:0.9);
    if(ty==='c'||ty==='b'){ cx.strokeStyle='#2a1c14'; cx.lineWidth=2.2*sc; for(let i=1;i<p.length;i++){ const a=p[i-1],b=p[i]; cx.beginPath(); cx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)*0.55),2.6*sc,Math.atan2(b.y-a.y,b.x-a.x),0,TAU); cx.stroke(); }
      if(ty==='b'){ const e=p[p.length-1], d=p[p.length-2], an=Math.atan2(e.y-d.y,e.x-d.x)-Math.PI/2; cx.save(); cx.translate(e.x,e.y); cx.rotate(an); cx.fillStyle='#8a6a2a'; cx.beginPath(); cx.moveTo(-3*sc,0); cx.quadraticCurveTo(-4*sc,9*sc,-9*sc,14*sc); cx.lineTo(9*sc,14*sc); cx.quadraticCurveTo(4*sc,9*sc,3*sc,0); cx.closePath(); cx.fill(); cx.fillStyle='rgba(255,230,160,0.8)'; cx.fillRect(-7*sc,12*sc,14*sc,1.5*sc); cx.restore(); }
      continue; }
    const col=ty==='h'?'232,222,196':ty==='t'?'60,20,70':ty==='e'?'255,200,120':ty==='f'?'90,50,30':'40,40,48';
    const w0=(ty==='s'?9:ty==='h'?3.2:ty==='f'?3:ty==='e'?2.6:2.4)*sc;
    for(let i=1;i<p.length;i++){ const a=p[i-1],b=p[i], k=1-i/p.length; cx.strokeStyle=`rgb(${col})`; cx.lineWidth=Math.max(0.6,w0*(0.35+0.65*k)); cx.beginPath(); cx.moveTo(a.x,a.y); cx.lineTo(b.x,b.y); cx.stroke(); }
    if(ty==='s'){ cx.strokeStyle='rgba(150,30,30,0.8)'; cx.lineWidth=1.2*sc; cx.beginPath(); cx.moveTo(p[0].x,p[0].y); for(const q of p) cx.lineTo(q.x,q.y+2*sc); cx.stroke(); }
    cx.globalCompositeOperation='source-over'; }
  cx.restore();
}
function drawWings(B,R,P0,alpha){
  const c=P0.c; if(!c.wing) return; const fl=P0.flip?-1:1, sc=P0.h/140; const tele=B.st==='tele'?sm(clamp(B.t/0.75,0,1)):0;
  const fr=B.st==='rest'?2.4:B.st==='tele'?4+tele*5:6.5, amp=B.st==='rest'?0.12:0.5;
  const beat=Math.sin(B.ph*fr), flap=beat*amp-(B.st==='tele'?tele*0.55:0)+(B.st==='rest'?0.5:0); // folds up as it gathers, droops at rest
  cx.save(); cx.globalAlpha=alpha*0.92;
  for(const w of c.wing){ const side=(w[0]<0.5?-1:1)*fl; const [x,y]=rigPt(B,P0,w[0],w[1]); const L=62*sc;
    cx.save(); cx.translate(x,y); cx.rotate(side*(-0.55+flap*0.9)); cx.scale(side*(0.55+0.45*Math.abs(Math.cos(B.ph*fr*0.5))),1); // a beat foreshortens the wing
    const g=cx.createLinearGradient(0,0,L,0); g.addColorStop(0,'rgba(60,32,18,0.95)'); g.addColorStop(1,'rgba(120,70,36,0.55)'); cx.fillStyle=g;
    cx.beginPath(); cx.moveTo(0,0); cx.quadraticCurveTo(L*0.5,-L*0.55,L,-L*0.35);
    for(let k=0;k<4;k++){ const t0=1-k/4, t1=1-(k+1)/4; cx.quadraticCurveTo(L*(t0*0.9+0.02),L*(0.1+k*0.05),L*t1*0.95,-L*0.35*t1+L*0.18*(1-t1)); }
    cx.closePath(); cx.fill(); cx.strokeStyle='rgba(255,190,110,0.35)'; cx.lineWidth=1.2; cx.stroke();
    cx.strokeStyle='rgba(40,20,10,0.8)'; cx.lineWidth=2.4*sc; cx.beginPath(); cx.moveTo(0,0); cx.quadraticCurveTo(L*0.5,-L*0.55,L,-L*0.35); cx.stroke(); cx.restore(); }
  cx.restore();
}
function drawRig(B,spr,x,y,h,o,R,live){
  const s=SPR[spr]; if(!s) return; const c=RIG[spr]||{wa:0.01,wk:2,chest:0.5}; const al=o.alpha===undefined?1:o.alpha; if(al<=0.01) return;
  const sq=live?R.sq:0, w=h*s.ar*(o.sx||1)*(1-sq*0.6), hh=h*(o.sy||1)*(1+sq);
  const breath=live?(B.st==='rest'?0.035:0.02)*Math.sin(B.ph*(B.st==='rest'?3.4:2.1)):0;
  const wt=B.ph*(B.st==='charge'?6:B.st==='tele'?1:2.4);
  const jd=c.jaw&&live?h*(B.st==='tele'?0.07*sm(clamp(B.t/0.75,0,1)):B.st==='act'?0.06*Math.max(0,1-B.t*1.4):B.st==='phase'?0.05+0.03*Math.sin(B.t*30):B.calm?0:0.006+0.006*Math.sin(B.ph*2.1)):0;
  const shake=B.st==='phase'&&live?(1-sm(clamp(B.t/2,0,1))):0, ct=B.calm&&!B.kneel?B.ct:0;
  const jit=(shake||ct)?(v=>Math.sin(v*41+game.t*60)*shake*h*0.035+Math.sin(v*17.3+ct*2.5)*ct*ct*h*0.03):null;
  const P0={x,y,w,h,hh,flip:o.flip,R:live?R:{lean:0},c,wt:live?wt:B.ph,jd,jit};
  if(live&&!o.decoy){ const dt=clamp(game.t-R.lt,0,0.05); R.lt=game.t; rigStep(B,R,dt); rigChains(B,R,P0,dt); }
  // the boss is drawn into its own canvas in bands, then laid onto the scene once (so its glow follows the whole body)
  const padX=Math.ceil(h*0.45), padT=Math.ceil(h*0.3), cw=Math.ceil(w+padX*2), chh=Math.ceil(hh+padT+jd+10);
  if(RC.width<cw) RC.width=cw; if(RC.height<chh) RC.height=chh;
  const g=rcx; g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='source-over'; g.globalAlpha=1; g.clearRect(0,0,RC.width,RC.height);
  const ox0=cw/2, base=chh-6-jd, fl=o.flip?-1:1, N=gfxLite()?10:20;
  if(jd>0.5){ const [mx,my]=rigPt(B,P0,c.mx,c.jaw); g.fillStyle='rgba(20,0,10,0.95)'; g.beginPath(); g.ellipse(mx-x+ox0,my-y+base+jd*0.5,w*c.mw*0.5,jd*0.75+1,0,0,TAU); g.fill(); }
  const layers=[[s.soft||s.img,1]]; if(o.gold>0) layers.push([s.goldS||s.gold,Math.min(1,o.gold)*0.75]); if(o.flash>0) layers.push([s.whiteS||s.white,Math.min(1,o.flash)]);
  for(const [im,a] of layers){ const L0=a<1; const gg=L0?rc2:g; if(L0){ if(RC2.width<cw) RC2.width=cw; if(RC2.height<chh) RC2.height=chh; gg.setTransform(1,0,0,1,0,0); gg.clearRect(0,0,cw,chh); } gg.globalAlpha=1; const iw=im.width, ih=im.height, sh=ih/N;
    for(let i=0;i<N;i++){ const v0=i/N, vm=(i+0.5)/N, uh=1-vm;
      const dx=P0.R.lean*Math.pow(uh,1.6)*h+Math.sin(P0.wt-uh*c.wk)*c.wa*uh*h+(jit?jit(vm):0);
      const bump=Math.max(0,1-Math.abs(vm-c.chest)/0.25), bw=w*(1+breath*bump);
      const top=base-(1-v0)*hh+(c.jaw&&vm>c.jaw?jd:0);
      gg.save(); gg.translate(ox0+dx,0); gg.scale(fl,1); gg.drawImage(im,0,i*sh,iw,sh,-bw/2,top,bw,hh/N+0.9); gg.restore(); }
    if(L0){ g.globalAlpha=a; g.drawImage(RC2,0,0,cw,chh,0,0,cw,chh); } } // overlays are built whole first, so the bands' overlaps never show as stripes
  g.globalAlpha=1;
  if(c.tint){ g.globalCompositeOperation='source-atop'; g.fillStyle=c.tint; g.fillRect(0,0,cw,chh); g.globalCompositeOperation='source-over'; } // v9: the pale Smonster sank into the bright sky; a deeper tone
  drawWings(B,R,P0,al);
  if(live) drawChains(B,R,P0,al,false);
  if(c.rim&&!gfxLite()){ cx.save(); cx.globalAlpha=al*0.8; cx.shadowColor=c.rim; cx.shadowBlur=22; cx.shadowOffsetX=4000; cx.drawImage(RC,0,0,cw,chh,x-ox0-4000,y-base,cw,chh); cx.restore(); } // and a dark rim behind it, the shadow only
  cx.save(); cx.globalAlpha=al; if(o.glow&&!gfxLite()){ cx.shadowColor=o.glow; cx.shadowBlur=o.glowB||14; }
  cx.drawImage(RC,0,0,cw,chh,x-ox0,y-base,cw,chh); cx.restore();
  if(live) drawChains(B,R,P0,al,true);
  if(!c.eye||!live) return;
  // eyes: dim when it rests, burning as it gathers an attack (the tell), flaring as it strikes
  let ea=B.st==='sleep'?0.12:B.st==='rest'?0.08:B.st==='tele'?0.35+0.65*sm(clamp(B.t/0.6,0,1)):B.st==='phase'?0.6+0.4*Math.sin(B.t*25):0.35;
  if(B.phase>1) ea+=0.15; if(R.flare>0) ea=Math.max(ea,R.flare*2); if(B.calm) ea=Math.max(0,0.5-B.ct); if(o.decoy) ea*=0.4;
  const ec=B.phase===3&&!B.calm?'255,245,210':c.ec;
  cx.save(); cx.globalCompositeOperation='lighter';
  for(const e of c.eye){ const [ex,ey]=rigPt(B,P0,e[0],e[1]); const r=h*0.05*(c.er||1)*(1+0.3*ea); cx.globalAlpha=al*clamp(ea,0,1); const gs=glowSpr(ec); cx.drawImage(gs,ex-r*2.2,ey-r*2.2,r*4.4,r*4.4); cx.globalAlpha=al*clamp(ea,0,1)*0.9; cx.drawImage(gs,ex-r*0.7,ey-r*0.7,r*1.4,r*1.4); }
  for(const r of R.rings){ const k=r.t/0.9; cx.globalAlpha=al*(1-k)*0.8; cx.strokeStyle=`rgb(${r.c})`; cx.lineWidth=2+5*(1-k); cx.beginPath(); cx.ellipse(B.x,B.y-B.h*0.5,B.h*(0.3+1.4*k),B.h*(0.25+0.9*k),0,0,TAU); cx.stroke(); }
  cx.restore();
}
function drawBoss(){
  const B=A.boss; if(!B||B.x<camX-320||B.x>camX+W+320) return; const gY=gyOr(B.x);
  if(B.calm&&!B.kneel&&B.ct>4) return;
  const rise=B.st==='sleep'?0:B.st==='intro'?sm(clamp(B.t/1.8,0,1)):1, sink=(1-rise)*B.h*0.55;
  let rot=0,sx=1,sy=1+Math.sin(B.ph*2)*0.025,ox=0,alpha=1,glow='rgba(150,10,0,0.8)',gb=18;
  if(B.st==='sleep'){ alpha=0.75; sy=1+Math.sin(game.t*1.2)*0.02; glow='rgba(0,0,0,0.6)'; }
  if(B.st==='intro'){ ox=Math.sin(B.t*50)*3*(1-rise); }
  if(B.st==='tele'){ ox=Math.sin(B.t*70)*2*sm(clamp(B.t/0.75,0,1)); glow='rgba(255,70,20,1)'; gb=34; }
  
  if(B.st==='act'){ glow='rgba(255,120,40,1)'; gb=26; }
  if(B.st==='rest'){ alpha=0.95; glow='rgba(255,220,150,0.6)'; gb=10; }
  if(B.st==='phase'){ ox=Math.sin(B.t*60)*4*(1-B.swell*0.5); glow=B.phase===3?'rgba(255,250,210,1)':'rgba(255,40,10,1)'; gb=40+20*Math.sin(B.t*20); }
  const pk=B.phase>1?1+0.06*(B.phase-2+(B.st==='phase'?B.swell:1)):1; sx*=pk; sy*=pk;
  if(B.phase>1&&!B.calm&&B.st!=='rest'&&B.st!=='phase'){ glow=B.phase===3?'rgba(255,236,170,1)':'rgba(230,30,10,0.95)'; gb=Math.max(gb,26); }
  let gold=0; if(B.calm){ gold=clamp(B.ct/1.5,0,1); glow='rgba(255,220,140,1)'; gb=30; if(B.kneel){ sy=1-0.18*gold; } else alpha=clamp(1-(B.ct-1.5)/2.5,0,1); }
  cx.save(); cx.beginPath(); cx.rect(B.x-B.h*1.5,-2000,B.h*3,gY+4+2000); cx.clip();
  const R=rigOf(B);
  for(const dc of A.decoys) drawRig(B,B.spr,dc.x,dc.y+4,B.h,{flip:P.x>dc.x,sx,sy:1+Math.sin(B.ph*2+dc.x)*0.025,alpha:dc.a*alpha,glow,glowB:gb,decoy:1},R,false);
  drawRig(B,B.spr,B.x+ox,B.y+sink+4,B.h,{flip:B.face>0,sx,sy,alpha,glow,glowB:gb,flash:B.hit>0?B.hit/0.45:0,gold:gold||(B.phase===3&&!B.calm?0.35:0)},R,true);
  cx.restore();
  if(B.st==='tele'&&B.atk==='split'){ const k=clamp(B.t/0.75,0,1); for(const x of [B.a0+90,(B.a0+B.a1)/2,B.a1-90]) drawSpr(B.spr,x,gyOr(x)-B.fly+4,B.h,{alpha:0.12+0.22*k*(0.6+0.4*Math.sin(game.t*30)),glow:'rgba(255,60,20,0.8)',glowB:20}); }
  if(B.st==='tele'&&B.atk==='call'){ const k=clamp(B.t/0.75,0,1); for(const x of [B.a0+24,B.a1-24]){ const gy=gyOr(x); cx.fillStyle=`rgba(255,110,40,${0.25+0.5*k*(0.5+0.5*Math.sin(game.t*24))})`; cx.beginPath(); cx.ellipse(x,gy-1,18,4,0,0,TAU); cx.fill(); cx.fillRect(x-1,gy-60*k,2,60*k); } }
  if(B.st==='tele'&&B.atk==='dive'||B.st==='dive'){ const gx=B.dtx, gy=gyOr(gx); const a=0.45+0.35*Math.sin(game.t*18); cx.strokeStyle=`rgba(255,110,40,${a})`; cx.lineWidth=2; cx.beginPath(); cx.ellipse(gx,gy-2,72,7,0,0,TAU); cx.stroke(); cx.beginPath(); cx.moveTo(gx-10,gy-2); cx.lineTo(gx+10,gy-2); cx.moveTo(gx,gy-8); cx.lineTo(gx,gy+4); cx.stroke(); }
  if(B.st==='rest'&&!B.calm){ text('✦',B.x,B.y-B.h-14,16,'rgba(255,240,190,'+(0.5+0.5*Math.sin(game.t*8))+')'); }
}
function drawShots(){
  for(const s of A.shots){ if(s.heavy&&!s.turned&&s.tx>camX-40&&s.tx<camX+W+40){ const gy=gyOr(s.tx), k=clamp((s.t||0)/s.T,0,1); cx.fillStyle=`rgba(0,0,0,${0.25+0.45*k})`; cx.beginPath(); cx.ellipse(s.tx,gy+1,6+18*k,2+3*k,0,0,TAU); cx.fill(); } }
  for(const s of A.shots){ if(s.x<camX-40||s.x>camX+W+40) continue;
    if(s.turned){ const g=cx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*2.2); g.addColorStop(0,'rgba(255,255,235,1)'); g.addColorStop(0.4,'rgba(255,220,130,0.9)'); g.addColorStop(1,'rgba(255,180,60,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(s.x,s.y,s.r*2.2,0,TAU); cx.fill(); continue; }
    if(s.k==='boulder'){ cx.save(); cx.translate(s.x,s.y); cx.rotate((s.t||0)*5); cx.fillStyle='#2a1a12'; cx.beginPath(); for(let i=0;i<8;i++){ const a=i/8*TAU, r=s.r*(0.8+0.25*((i*37)%5)/5); cx.lineTo(Math.cos(a)*r,Math.sin(a)*r); } cx.closePath(); cx.fill(); cx.strokeStyle='rgba(255,120,40,0.9)'; cx.lineWidth=1.5; cx.beginPath(); cx.moveTo(-6,-2); cx.lineTo(0,3); cx.lineTo(5,-4); cx.stroke(); cx.restore(); continue; }
    if(s.wait>0){ if(s.warn){ const a=0.4+0.4*Math.sin(game.t*20); cx.fillStyle=`rgba(255,120,60,${a})`; cx.beginPath(); cx.moveTo(s.x-7,camY+14); cx.lineTo(s.x+7,camY+14); cx.lineTo(s.x,camY+26); cx.fill(); } continue; }
    if(s.k==='spear'){ const a=Math.atan2(s.vy,s.vx); cx.save(); cx.translate(s.x,s.y); cx.rotate(a); cx.strokeStyle='#c8b498'; cx.lineWidth=2; cx.beginPath(); cx.moveTo(-18,0); cx.lineTo(10,0); cx.stroke(); cx.fillStyle='#ffe0b0'; cx.beginPath(); cx.moveTo(10,-3); cx.lineTo(18,0); cx.lineTo(10,3); cx.fill(); cx.restore(); continue; }
    if(s.k==='sting'){ cx.fillStyle='#1a0a04'; cx.fillRect(s.x-1.5,s.y-9,3,12); cx.fillStyle='#ffd040'; cx.fillRect(s.x-1.5,s.y+1,3,3); continue; }
    if(s.k==='hwave'){ const f=Math.sin(game.t*30)*3; const hg=cx.createRadialGradient(s.x,s.y,0,s.x,s.y,30); hg.addColorStop(0,'rgba(255,240,190,0.9)'); hg.addColorStop(0.5,'rgba(255,170,60,0.5)'); hg.addColorStop(1,'rgba(255,120,30,0)'); cx.fillStyle=hg; cx.beginPath(); cx.arc(s.x,s.y,30,0,TAU); cx.fill(); cx.strokeStyle='rgba(255,236,170,0.95)'; cx.lineWidth=4; cx.beginPath(); cx.ellipse(s.x,s.y,8+f*0.5,16,0,0,TAU); cx.stroke(); cx.strokeStyle='rgba(255,170,60,0.6)'; cx.lineWidth=2; cx.beginPath(); cx.ellipse(s.x-Math.sign(s.vx)*8,s.y,6,13,0,0,TAU); cx.stroke(); continue; }
    if(s.k==='wave'){ const f=Math.sin(game.t*30)*3; const g=cx.createLinearGradient(0,s.y-26,0,s.y+10); g.addColorStop(0,'rgba(255,200,90,0)'); g.addColorStop(1,'rgba(255,90,20,0.95)'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(s.x-14,s.y+10); cx.quadraticCurveTo(s.x,s.y-30-f,s.x+14,s.y+10); cx.fill(); continue; }
    const r=s.r+1; const g=cx.createRadialGradient(s.x,s.y,0,s.x,s.y,r*1.8); const fire=s.k==='fire';
    g.addColorStop(0,fire?'rgba(255,240,180,1)':'rgba(255,200,220,1)'); g.addColorStop(0.35,fire?'rgba(255,130,40,0.95)':'rgba(170,20,60,0.95)'); g.addColorStop(1,'rgba(60,0,10,0)');
    cx.fillStyle=g; cx.beginPath(); cx.arc(s.x,s.y,r*1.8,0,TAU); cx.fill(); }
}
function drawHazards(){
  for(const h of A.haz){ if(h.x<camX-60||h.x>camX+W+60) continue; const gy=gyOr(h.x); const water=h.f==='water';
    if(h.k==='vent'&&h.f==='thorn'){ cx.fillStyle='#1c1208'; cx.beginPath(); cx.ellipse(h.x,gy,18,4,0,0,TAU); cx.fill();
      if(h.warn){ for(let i=0;i<4;i++){ const yy=gy-3-((game.t*30+i*7)%14); cx.fillStyle='rgba(150,110,60,0.8)'; cx.fillRect(h.x-8+i*5,yy,2,2); } }
      const k=h.act?clamp(h.tt/0.12,0,1):h.warn?0.12:0.05, hh=125*k; cx.strokeStyle='#2a1a0c'; cx.lineWidth=3; cx.beginPath();
      for(let i=-2;i<=2;i++){ const bx=h.x+i*5, sw=Math.sin(game.t*7+i)*(h.act?3:1); cx.moveTo(bx,gy); cx.quadraticCurveTo(bx+sw*2,gy-hh*0.5,bx+i*2+sw,gy-hh*(0.8+0.2*((i+2)%2))); } cx.stroke();
      if(h.act){ cx.fillStyle='#3a2410'; for(let j=0;j<6;j++){ const yy=gy-hh*(0.15+j*0.13); cx.beginPath(); cx.moveTo(h.x-6+(j%2)*10,yy); cx.lineTo(h.x-12+(j%2)*22,yy-5); cx.lineTo(h.x-4+(j%2)*8,yy-3); cx.fill(); } } }
    else if(h.k==='vent'){ cx.fillStyle=water?'#2a3a40':'#1a0c08'; cx.fillRect(h.x-14,gy-4,28,6); cx.fillStyle=water?'#7a9aa0':'#5a2a14'; cx.fillRect(h.x-10,gy-5,20,2);
      if(h.warn){ for(let i=0;i<3;i++){ const yy=gy-6-((game.t*40+i*9)%22); cx.fillStyle=water?'rgba(220,240,255,0.7)':'rgba(255,150,60,0.8)'; cx.fillRect(h.x-6+i*5+Math.sin(game.t*9+i)*2,yy,2,2); } }
      if(h.act){ const k=clamp(h.tt/0.15,0,1), hh=125*k; const fl=Math.sin(game.t*40)*3;
        const g=cx.createLinearGradient(0,gy-hh,0,gy); if(water){ g.addColorStop(0,'rgba(230,245,255,0)'); g.addColorStop(0.3,'rgba(200,230,250,0.75)'); g.addColorStop(1,'rgba(120,170,200,0.95)'); } else { g.addColorStop(0,'rgba(255,230,120,0)'); g.addColorStop(0.3,'rgba(255,170,60,0.9)'); g.addColorStop(1,'rgba(200,40,10,0.95)'); }
        cx.fillStyle=g; cx.beginPath(); cx.moveTo(h.x-12,gy); cx.quadraticCurveTo(h.x-16+fl,gy-hh*0.5,h.x-3,gy-hh); cx.lineTo(h.x+3,gy-hh); cx.quadraticCurveTo(h.x+16-fl,gy-hh*0.5,h.x+12,gy); cx.fill(); } }
    else if(h.k==='drop'){
      if(h.warn){ const a=0.25+0.25*Math.sin(game.t*14); cx.fillStyle=`rgba(0,0,0,${a+0.2})`; cx.beginPath(); cx.ellipse(h.x,gy-1,16,4,0,0,TAU); cx.fill(); if(Math.random()<0.3) A.particles.push({x:h.x+(Math.random()-.5)*16,y:camY+4,vx:0,vy:120,life:0.8,t:0,gold:0}); }
      if(h.fall){ cx.fillStyle=A.d.key==='kingdom'?'#8a5a2a':'#2a1a0c'; cx.save(); cx.translate(h.x,h.ry); cx.rotate(game.t*3); cx.beginPath(); cx.moveTo(-12,-6); cx.lineTo(-4,-13); cx.lineTo(10,-8); cx.lineTo(12,6); cx.lineTo(-6,11); cx.closePath(); cx.fill(); cx.restore(); } } }
}
function drawBossHazards(){
  if(!A.boss) return; const B=A.boss, t=game.t;
  const td=A.tide; if(td){ // the waterline creeps in, then floods the floor
    const k=td.t<td.warn?td.t/td.warn:td.t<td.warn+td.on?1:1-(td.t-td.warn-td.on)/0.8; const depth=td.wet?14:3+3*k;
    const w=(B.a1-B.a0+40)*(td.t<td.warn?k:1); const x0=td.from<0?B.a0-20:B.a1+20-w;
    for(let x=x0;x<x0+w;x+=6){ const gy=A.d.gy(x); if(gy>1e8) continue; const yy=gy-depth+Math.sin(t*5+x*0.05)*2;
      cx.fillStyle=td.wet?'rgba(140,190,220,0.6)':'rgba(200,225,240,0.35)'; cx.fillRect(x,yy,6,gy-yy+4); }
    const fx=td.from<0?x0+w:x0; cx.fillStyle='rgba(255,255,255,0.7)'; if(td.t<td.warn) cx.fillRect(fx-2,A.d.gy(fx)-8,4,10); }
  const tl=A.tiles; if(tl){ for(const g of tl.set){ const gy=BASE; if(tl.t<tl.crack){ const a=0.4+0.4*Math.sin(t*22); cx.strokeStyle=`rgba(255,200,120,${a})`; cx.lineWidth=1.5; cx.beginPath(); const m=(g[0]+g[1])/2; cx.moveTo(g[0]+4,gy+2); cx.lineTo(m-6,gy-1); cx.lineTo(m+4,gy+4); cx.lineTo(g[1]-4,gy); cx.moveTo(m,gy); cx.lineTo(m-3,gy+12); cx.stroke();
      if((t*30|0)%3===0) A.particles.push({x:g[0]+((t*997)%1)*(g[1]-g[0]),y:gy+2,vx:0,vy:40,life:0.4,t:0,gold:0}); }
    else { const wg=cx.createLinearGradient(0,gy,0,gy+160); wg.addColorStop(0,'rgba(10,0,4,0.95)'); wg.addColorStop(1,'#000'); cx.fillStyle=wg; cx.fillRect(g[0],gy-6,g[1]-g[0],H-gy-camY+200); } } }
  for(const f of A.fires){ const a=Math.min(1,f.t/0.15)*Math.min(1,(f.life-f.t)/0.4); for(let x=f.x0;x<f.x1;x+=9){ const gy=gyOr(x); const fh=10+6*Math.sin(t*14+x); cx.fillStyle=`rgba(255,${120+((x*7)%60)},40,${0.8*a})`; cx.beginPath(); cx.moveTo(x-5,gy); cx.quadraticCurveTo(x,gy-fh*1.6,x+5,gy); cx.fill(); } }
  for(const p of A.pillars){ const gy=gyOr(p.x); if(p.t<p.warn){ const a=0.3+0.5*(p.t/p.warn); cx.fillStyle=`rgba(255,230,150,${a*(0.6+0.4*Math.sin(t*20))})`; cx.beginPath(); cx.ellipse(p.x,gy-1,20,4,0,0,TAU); cx.fill(); }
    else if(p.t<p.warn+p.on){ const g=cx.createLinearGradient(p.x-20,0,p.x+20,0); g.addColorStop(0,'rgba(255,220,140,0)'); g.addColorStop(0.5,'rgba(255,250,220,0.95)'); g.addColorStop(1,'rgba(255,220,140,0)'); cx.fillStyle=g; cx.fillRect(p.x-20,gy-480,40,480); } }
}
function drawFolk(){
  for(const f of A.folk){ if(f.x<camX-120||f.x>camX+W+120) continue; const gy=gyOr(f.x); const fl=Math.sin(f.ph*1.3)*4;
    const lift=f.lift||0; cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createRadialGradient(f.x,gy-lift-f.h*0.5,0,f.x,gy-lift-f.h*0.5,f.h*0.9); g.addColorStop(0,'rgba(255,200,120,0.22)'); g.addColorStop(1,'rgba(255,160,60,0)'); cx.fillStyle=g; cx.fillRect(f.x-f.h,gy-lift-f.h*1.4,f.h*2,f.h*1.8); cx.restore();
    drawSpr(f.spr,f.x,gy-lift+fl,f.h,{alpha:0.9,glow:'rgba(255,210,140,0.8)',glowB:16,flip:P.x>f.x,rot:Math.sin(f.ph*0.8)*0.03});
    if(f.near>0.02) text(f.name,f.x,gy-lift-f.h-14+fl,13,'#ffe6b8','center',f.near*0.9); }
}
function drawWays(){ for(const w of A.ways){ if(w.x<camX-40||w.x>camX+W+40) continue; const gy=gyOr(w.x); cx.fillStyle='#3a2a20'; cx.beginPath(); cx.ellipse(w.x,gy-5,13,6,0,0,TAU); cx.ellipse(w.x+1,gy-15,10,5,0,0,TAU); cx.ellipse(w.x,gy-23,7,4,0,0,TAU); cx.fill();
  if(w.lit){ const fh=10+Math.sin(game.t*9)*3; cx.fillStyle='rgba(255,220,140,0.95)'; cx.beginPath(); cx.ellipse(w.x,gy-30-fh/2,3.5,fh/2,0,0,TAU); cx.fill(); } } }
// the wanderer: a faceless cloaked figure// the wanderer: a faceless cloaked figure with a small sun for a head
function drawFigure(g,x,y,face,ph,glow,o={}){
  const bob=Math.abs(Math.sin(ph))*2.2, sw=Math.sin(ph); const sit=o.sit||0;
  g.save(); g.translate(x,y-bob*(1-sit)); g.scale(face,1);
  const hY=-38+sit*12;
  if(o.small) g.fillStyle=o.cloak; else { const cl=g.createLinearGradient(0,hY,0,0); cl.addColorStop(0,'#5a3622'); cl.addColorStop(1,'#1c100a'); g.fillStyle=cl; }
  g.beginPath();
  if(sit){ g.moveTo(-15,0); g.quadraticCurveTo(-13,-14,-8,hY+2); g.quadraticCurveTo(0,hY-10,9,hY+3); g.quadraticCurveTo(16,-10,22,-2); g.lineTo(22,0); }
  else { const hem=sw*4; g.moveTo(-12-hem*0.6,0); g.quadraticCurveTo(-11,-18,-7,hY+4); g.quadraticCurveTo(0,hY-9,7,hY+4); g.quadraticCurveTo(11+Math.abs(sw)*2,-16,17+hem*0.4,0);
    for(let i=0;i<5;i++) g.lineTo(17+hem*0.4-(i+1)*(29+hem*0.2)/5,(i%2?-2:1)+Math.sin(ph*2+i)*1.2); }
  g.closePath();
  if(o.ink){ g.strokeStyle=o.ink; g.lineWidth=o.inkW||1.7; g.stroke(); }
  else g.fill();
  if(!o.ink&&glow>0){ g.strokeStyle=`rgba(255,200,120,${0.6*Math.min(1,glow)})`; g.lineWidth=1.4; g.beginPath(); g.moveTo(-7,hY+5); g.quadraticCurveTo(0,hY-9,7,hY+5); g.stroke();
    if(!o.small){ g.strokeStyle=`rgba(255,170,90,${0.3*Math.min(1,glow)})`; g.beginPath(); g.moveTo(8,hY+8); g.quadraticCurveTo(11,-16,15,-2); g.stroke(); } }
  if(!o.ink&&!sit&&!o.small){ g.fillStyle='#0c0604'; g.fillRect(-4+sw*5,-2,5,2); g.fillRect(2-sw*5,-2,5,2); }
  const hr=o.small?4:5.5;
  if(!o.ink&&!o.small&&glow>0.05){ g.save(); g.translate(1,hY+1); g.rotate(game.t*0.6); g.strokeStyle=`rgba(255,220,140,${0.7*Math.min(1,glow)})`; g.lineWidth=1.2; g.beginPath();
    const nr=8+Math.round(Math.min(2,glow)*4), gl=Math.min(2,glow); for(let i=0;i<nr;i++){ const a=i/nr*TAU, r1=hr+2.5, r2=hr+4+gl*2.5+(i%2)*3+Math.sin(game.t*3+i)*1.2; g.moveTo(Math.cos(a)*r1,Math.sin(a)*r1); g.lineTo(Math.cos(a)*r2,Math.sin(a)*r2); } g.stroke(); g.restore(); }
  if(o.small){ g.fillStyle=o.head; } else { const hg=g.createRadialGradient(1,hY+1,0,1,hY+1,hr); hg.addColorStop(0,'#fffbe8'); hg.addColorStop(0.6,glow>0.35?'#ffd27a':'#c88a4a'); hg.addColorStop(1,glow>0.35?'#ff9a3a':'#6a3a1a'); g.fillStyle=hg; }
  g.beginPath(); g.arc(1,hY+1,hr,0,TAU); if(o.ink){ g.strokeStyle=o.ink; g.lineWidth=o.inkW||1.7; g.stroke(); } else g.fill();
  g.restore();
}
const PS=1.3; // player sprite scale
function drawPlayer(){ if(P.dead>0||P.fellT) return;
  const blink=P.hurtT>0.3&&((game.t*20)|0)%2===0; // the body still flashes; a contour stays so a large figure cannot erase you
  const q=P.sq||0;
  const b=P.bumpT>0?Math.min(1,P.bumpT/0.34):0; // v11.4: a short lean away from the block, and a squash
  const lean=b?-(P.bumpDir||P.face||1):0;
  if(!blink){ // v7: a scarf of light that trails as you move; brighter the more you carry
    const nx=P.x-P.face*3, ny=P.y-49+(P.sit?15:0), sp=Math.min(1.6,Math.abs(P.vx)/140), gl=Math.min(1,P.glow/1.6);
    cx.save(); cx.lineCap='round'; for(let k=0;k<2;k++){ cx.strokeStyle=k?`rgba(255,230,170,${0.25+0.45*gl})`:'rgba(60,30,16,0.85)'; cx.lineWidth=k?1.4:3.2; cx.beginPath(); cx.moveTo(nx,ny);
      for(let i=1;i<=6;i++) cx.lineTo(nx-P.face*i*(3.5+sp*2.5)-P.vx*0.012*i, ny+i*(1.6-sp*0.6)+Math.sin(game.t*7-i*0.9)*(0.8+sp*1.6)*i*0.4); cx.stroke(); } cx.restore(); }
  cx.save(); cx.translate(P.x+lean*5*b,P.y+1+b*3); if(!P.sit&&!(P.kneel>0.15)) cx.rotate(lean*0.22*b+clamp(P.vx/SPD,-1.6,1.6)*(P.ground?0.05:0.035)); cx.scale(PS*(1+0.18*q)*(1+0.14*b),PS*(1-0.16*q)*(1-0.16*b));
  const sit=P.sit||(P.kneel>0.15?1:0); // v11.4: holding Down on the ground is a crouch (the old kneel, lower)
  if(blink) drawFigure(cx,0,0,P.face,P.walk,0,{sit,ink:'rgba(255,228,186,0.95)',inkW:1.2});
  else drawFigure( /* v9: leans a touch into the run */cx,0,0,P.face,P.walk,P.glow,{sit});
  cx.restore();
  if(blink) return;
  // v7: what you carry shows: small lights circle you, one for every four (up to ten)
  const n=Math.min(10,Math.floor(P.light/4)); if(n>0&&game.areaI<7){ const hy=P.y-49+(P.sit?15:0); cx.save(); cx.globalCompositeOperation='lighter';
    for(let i=0;i<n;i++){ const a=game.t*(0.9+0.05*i)+i*TAU/n, rr=20+n*1.3+Math.sin(game.t*2+i)*2; const x=P.x+Math.cos(a)*rr, y=hy+Math.sin(a)*rr*0.45; cx.fillStyle=`rgba(255,225,150,${0.55+0.3*Math.sin(game.t*3+i)})`; cx.beginPath(); cx.arc(x,y,1.6,0,TAU); cx.fill(); }
    cx.restore(); } }
function drawMotes(){
  for(const m of A.motes){ if(m.got||m.x<camX-20||m.x>camX+W+20||m.hide>0) continue; const y=m.y+Math.sin(m.ph)*3; const fa=m.ft&&m.fading?clamp(1-m.fade/0.5,0,1):1; cx.globalAlpha=fa;
    cx.drawImage(moteSpr(),m.x-11,y-11,22,22); cx.globalAlpha=1; }
}
let moteC=null; function moteSpr(){ if(moteC) return moteC; moteC=document.createElement('canvas'); moteC.width=moteC.height=44; const g=moteC.getContext('2d'), q=g.createRadialGradient(22,22,0,22,22,22);
  q.addColorStop(0,'rgba(255,250,220,1)'); q.addColorStop(0.3,'rgba(255,210,120,0.85)'); q.addColorStop(1,'rgba(255,160,60,0)'); g.fillStyle=q; g.fillRect(0,0,44,44); return moteC; } // v9: one baked glow, not a new gradient per mote per frame
function drawSecrets(){
  const d=A.d, t=game.t;
  const r=A.relic; if(r&&!r.got&&r.x>camX-60&&r.x<camX+W+60){ const ry=gyOr(r.x)-48+Math.sin(r.t*2)*5;
    cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createRadialGradient(r.x,ry,0,r.x,ry,60); g.addColorStop(0,'rgba(255,245,210,0.9)'); g.addColorStop(0.3,'rgba(255,190,90,0.45)'); g.addColorStop(1,'rgba(255,120,30,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(r.x,ry,60,0,TAU); cx.fill(); cx.restore();
    cx.save(); cx.translate(r.x,ry); cx.rotate(Math.sin(r.t)*0.3); cx.fillStyle='#fff3cf'; cx.strokeStyle='rgba(120,70,20,0.9)'; cx.lineWidth=1.5; cx.beginPath();
    for(let k=0;k<10;k++){ const a=k/10*TAU-Math.PI/2, rr=k%2?7:16; cx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); } cx.closePath(); cx.fill(); cx.stroke(); cx.restore(); }
  if(game.night) return;
  // area II: something faint above the highest bough, only now and then
  if(d.secretStill&&!game.relics.has(d.secretStill.n)){ const p=A.plats.find(q=>q.x0===d.secretStill.plat); if(p){ const a=0.16*Math.max(0,Math.sin(t*0.37))**6; if(a>0.005){ const x=p.x+p.w*0.6, y=p.y-150;
    cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createRadialGradient(x,y,0,x,y,9); g.addColorStop(0,`rgba(255,240,200,${a})`); g.addColorStop(1,'rgba(255,200,120,0)'); cx.fillStyle=g; cx.fillRect(x-9,y-9,18,18); cx.restore(); } } }
  // area III: a slow ring in the water beside the smallest stone, once in a long while
  if(d.secretShine&&!game.relics.has(d.secretShine.n)){ const p=A.plats.find(q=>q.x0===d.secretShine.plat); if(p){ const ph=(t%9)/9; if(ph<0.33){ const k=ph/0.33; cx.strokeStyle=`rgba(255,240,210,${0.12*(1-k)})`; cx.lineWidth=1; cx.beginPath(); cx.ellipse(p.x+p.w/2,BASE+40,8+k*34,2+k*6,0,0,TAU); cx.stroke(); } } }
}
/* ---------------- v5 drawing ---------------- */
function drawNightSecrets(){ if(!game.night) return; const d=A.d, t=game.t, open=n=>!game.secretsSpent.has(n)&&!game.relics.has(n);
  for(const so of d.solids) if(so.hollow!==undefined&&open(so.hollow)&&so.x>camX-80&&so.x<camX+W+80){ const top=solidTop(so); cx.strokeStyle='rgba(0,0,0,0.5)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(so.x+so.w*0.46,top+5); cx.lineTo(so.x+so.w*0.56,top+17); cx.lineTo(so.x+so.w*0.42,top+31); cx.lineTo(so.x+so.w*0.52,top+48); cx.stroke(); }
  for(const p of A.plats) if(p.upd!==undefined&&open(p.upd)&&Math.abs(p.x-P.x)<W&&A.rng()<0.035) A.particles.push({x:p.x+A.rng()*p.w,y:BASE+80,vx:(A.rng()-.5)*10,vy:-30-A.rng()*14,life:3.4,t:0,leaf:1});
  const m=d.moon; if(m&&open(m.n)&&m.x1>camX-40&&m.x0<camX+W+40){ cx.save(); cx.globalCompositeOperation='lighter'; for(let i=0;i<8;i++){ const x=m.x0+(m.x1-m.x0)*(i/7), w=(m.x1-m.x0)/6, a=0.09+0.05*Math.sin(t*1.7+i*1.3); cx.fillStyle=`rgba(210,225,255,${a})`; cx.beginPath(); cx.ellipse(x,BASE+37+(i%2)*2,w*0.7,1.5,0,0,TAU); cx.fill(); } cx.restore(); }
}
function drawShadows(){ // v7: soft contact shadows ground the figures
  cx.fillStyle='rgba(0,0,0,0.28)'; const sh=(x,w)=>{ const g=A.d.gy(x); if(g>1e8||x<camX-60||x>camX+W+60) return; cx.beginPath(); cx.ellipse(x,g+1,w,w*0.22,0,0,TAU); cx.fill(); };
  if(!P.dead&&!P.fellT){ const g=A.d.gy(P.x), up=g<1e8?Math.max(0,g-P.y):999; if(up<120&&!P.plat) sh(P.x,13*(1-up/160)); }
  for(const e of A.enemies) if(!e.calm&&!e.fly&&e.t!=='wisp') sh(e.x,e.h*0.22);
  const B=A.boss; if(B&&!B.calm&&!B.fly) sh(B.x,B.h*0.3); }
function drawHang(){
  for(const l of A.hang){ if(l.x<camX-60||l.x>camX+W+60) continue; const t=game.t, sw=Math.sin(t*1.3+l.x)*2;
    if(l.hidden){ // only a cord shows, dangling out of the sky above the balcony
      cx.strokeStyle='rgba(30,18,10,0.85)'; cx.lineWidth=1.2; cx.beginPath(); cx.moveTo(l.x,l.y+12); for(let y=l.y+12;y<l.y+92;y+=8) cx.lineTo(l.x+Math.sin(t*1.1+y*0.05)*2*(y-l.y)/90,y); cx.stroke();
      if(l.lit){ cx.fillStyle='#ffe0a0'; cx.fillRect(l.x-5+sw,l.y-7,10,14); } else { cx.fillStyle='#3a2a1c'; cx.fillRect(l.x-5+sw,l.y-7,10,14); }
      continue; }
    cx.strokeStyle='#1a0f08'; cx.lineWidth=1.5; cx.beginPath(); cx.moveTo(l.x,camY-20); cx.lineTo(l.x+sw,l.y-9); cx.stroke();
    const lit=hangLit(l), fl=hangFlicker(l); const on=lit&&!(fl&&Math.sin(t*38)>0.3);
    cx.fillStyle='#1a0f08'; cx.fillRect(l.x-7+sw,l.y-10,14,3); cx.fillRect(l.x-6+sw,l.y+8,12,3);
    cx.fillStyle=on?'#ffe0a0':'#3a2a1c'; cx.fillRect(l.x-5+sw,l.y-7,10,15); cx.strokeStyle='#1a0f08'; cx.lineWidth=1; cx.strokeRect(l.x-5+sw,l.y-7,10,15);
    if(on){ cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createRadialGradient(l.x,l.y,0,l.x,l.y,34); g.addColorStop(0,'rgba(255,210,130,0.35)'); g.addColorStop(1,'rgba(255,190,100,0)'); cx.fillStyle=g; cx.fillRect(l.x-34,l.y-34,68,68); cx.restore(); } }
}
function drawCats(){
  for(const c of A.cats){ if(c.x<camX-120||c.x>camX+W+120) continue; const gy=gyOr(c.x), top=c.y; const k=c.dead?clamp(c.dt/0.6,0,1):0;
    cx.save(); cx.translate(c.x,0); if(c.dead) cx.rotate(0.12*k);
    cx.strokeStyle='#2a140a'; cx.lineWidth=4; cx.beginPath(); cx.moveTo(-26,gy); cx.lineTo(-18,top); cx.moveTo(26,gy); cx.lineTo(18,top); cx.moveTo(-22,(gy+top)/2); cx.lineTo(22,(gy+top)/2+14); cx.moveTo(22,(gy+top)/2); cx.lineTo(-22,(gy+top)/2+14); cx.stroke();
    cx.fillStyle='#4a2414'; cx.fillRect(-30,top-4,60,8);
    if(!c.dead){ const back=c.wind>0?c.wind:0, snap=c.snap>0?c.snap/0.35:0; const ang=-0.5-1.0*back+1.4*snap*(1-back); const dir=Math.sign(P.x-c.x)||-1;
      cx.save(); cx.translate(0,top-8); cx.scale(-dir,1); cx.rotate(ang); cx.strokeStyle='#6a3a1c'; cx.lineWidth=4; cx.beginPath(); cx.moveTo(0,0); cx.lineTo(-40,0); cx.stroke(); cx.fillStyle='#2a1a12'; cx.beginPath(); cx.arc(-42,-4,back>0.05?9:5,0,TAU); cx.fill(); cx.restore();
      cx.fillStyle='#140604'; cx.fillRect(10,top-30,10,22); cx.beginPath(); cx.moveTo(9,top-30); cx.lineTo(15,top-37); cx.lineTo(21,top-30); cx.fill(); cx.fillStyle='rgba(255,120,40,0.95)'; cx.fillRect(13,top-26,4,2); }
    else { cx.strokeStyle='#3a2010'; cx.lineWidth=3; cx.beginPath(); cx.moveTo(-10,top-6); cx.lineTo(-38,top+10); cx.stroke(); }
    cx.restore(); }
}
function drawWall(){ const w=A.d.secretWall; if(!w) return; const x0=w.x0-260, x1=w.x1+240; if(x1<camX-40||x0>camX+W+40) return;
  // a palisade behind the path. One stretch of it is scorched, streaks climbing up and over the top.
  const spent=game.secretsSpent.has(w.n)||game.relics.has(w.n);
  for(let x=x0;x<x1;x+=13){ const gy=gyOr(x), h=150+((x*7)%23); cx.fillStyle='rgba(42,18,10,0.82)'; cx.beginPath(); cx.moveTo(x,gy); cx.lineTo(x,gy-h); cx.lineTo(x+5.5,gy-h-9); cx.lineTo(x+11,gy-h); cx.lineTo(x+11,gy); cx.fill();
    if(x>w.x0-6&&x<w.x1-4&&!spent){ const hh=h*(0.55+0.45*((x*13)%7)/7); const g=cx.createLinearGradient(0,gy,0,gy-hh); g.addColorStop(0,'rgba(0,0,0,0.75)'); g.addColorStop(1,'rgba(0,0,0,0)'); cx.fillStyle=g; cx.fillRect(x+2,gy-hh,7,hh); } }
  cx.fillStyle='rgba(30,12,6,0.85)'; cx.fillRect(x0,gyOr(x0)-120,x1-x0,4); }
function drawKneelMark(){ const k=A.d.secretKneel; if(!k||game.secretsSpent.has(k.n)||game.relics.has(k.n)) return; const x=(k.x0+k.x1)/2; if(x<camX-40||x>camX+W+40) return;
  // the floor before the throne is worn in two small hollows, where someone knelt for a very long time
  const gy=gyOr(x); cx.fillStyle='rgba(60,34,8,0.32)'; for(const o of [-7,8]){ cx.beginPath(); cx.ellipse(x+o,gy+2,6,2,0,0,TAU); cx.fill(); } }
function drawBells(){
  for(const b of A.bells){ if(b.x<camX-60||b.x>camX+W+60) continue; const sh=(b.warn?Math.sin(game.t*50)*2:0)+(b.ring>0?Math.sin(game.t*30)*3*b.ring:0);
    cx.strokeStyle='rgba(120,80,30,0.9)'; cx.lineWidth=1.5; cx.beginPath(); cx.moveTo(b.x0,camY-20); cx.lineTo(b.x+sh,b.y-16); cx.stroke();
    cx.save(); cx.translate(b.x+sh,b.y); cx.rotate(b.sw?0.25*Math.cos((game.t+(b.ph||0))*TAU/b.per):0);
    const g=cx.createLinearGradient(-16,0,16,0); g.addColorStop(0,'#8a5a1c'); g.addColorStop(0.45,'#ffe6a0'); g.addColorStop(1,'#9a6420'); cx.fillStyle=g;
    cx.beginPath(); cx.moveTo(-7,-16); cx.quadraticCurveTo(-9,-4,-15,10); cx.lineTo(15,10); cx.quadraticCurveTo(9,-4,7,-16); cx.closePath(); cx.fill();
    cx.fillStyle=b.toll?'#5a3410':'#6a4418'; cx.fillRect(-16,9,32,3); cx.beginPath(); cx.arc(0,14,3,0,TAU); cx.fill();
    if(b.toll){ cx.strokeStyle='rgba(60,30,10,0.8)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(-11,2); cx.lineTo(11,2); cx.stroke(); }
    cx.restore(); }
}
function drawCold(){ for(const c of A.d.cold){ if(c[1]<camX-20||c[0]>camX+W+20) continue;
    for(let x=Math.max(c[0],camX-20);x<Math.min(c[1],camX+W+20);x+=6){ const gy=A.d.gy(x); if(gy>1e8) continue; const e=Math.min(1,(x-c[0])/40,(c[1]-x)/40); cx.fillStyle=`rgba(190,215,240,${0.28*e})`; cx.fillRect(x,gy-3,6,4); if(((x*13)%7)<1) { cx.fillStyle=`rgba(220,235,255,${0.5*e})`; cx.fillRect(x+2,gy-6-((x*7)%4),1.5,4); } }
    if(A.rng()<0.5) { const x=c[0]+A.rng()*(c[1]-c[0]); if(x>camX&&x<camX+W) A.particles.push({x,y:camY+A.rng()*H*0.6,vx:-6,vy:14,life:3,t:0,frost:1}); } } }
function drawEyes(){ // drawn after the dark, so they show in it
  for(const e of A.eyes){ if(e.x<camX-80||e.x>camX+W+80) continue; const o=e.op, t=game.t; const br=e.sleep?Math.sin(t*0.6)*0.6:0;
    if(e.open&&!e.sleep){ const g=cx.createLinearGradient(0,e.y,0,gyOr(e.x)); g.addColorStop(0,'rgba(200,40,20,0.16)'); g.addColorStop(1,'rgba(200,40,20,0.05)'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(e.x-14,e.y); cx.lineTo(e.x+14,e.y); cx.lineTo(e.x+70,gyOr(e.x)); cx.lineTo(e.x-70,gyOr(e.x)); cx.fill(); }
    for(const s of [-1,1]){ const ex=e.x+s*13, ey=e.y+br; const hh=1+7*o; cx.fillStyle=e.sleep?'rgba(90,50,40,0.75)':o>0.01?`rgba(255,${120+60*o|0},60,${0.5+0.5*o})`:'rgba(120,50,40,0.7)';
      cx.beginPath(); cx.ellipse(ex,ey,9,hh,0,0,TAU); cx.fill(); if(o>0.5){ cx.fillStyle='#200404'; cx.beginPath(); cx.ellipse(ex,ey,2,hh*0.8,0,0,TAU); cx.fill(); }
      if(o<=0.01){ cx.strokeStyle=e.sleep?'rgba(110,70,55,0.8)':'rgba(140,60,45,0.8)'; cx.lineWidth=1; cx.beginPath(); for(let k=-2;k<=2;k++){ cx.moveTo(ex+k*3.5,ey+1); cx.lineTo(ex+k*4.2,ey+4); } cx.stroke(); } } }
}
function drawCarried(){ // the carried fire, the kneel, the star-fall
  if(P.dead>0||P.fellT) return;
  if(P.ember){ const x=P.x+P.face*9, y=P.y-PH*PS-8; for(let k=0;k<3;k++){ const fh=12+Math.sin(game.t*11+k*2)*4; cx.fillStyle=k?'rgba(255,160,60,0.85)':'rgba(255,240,190,0.95)'; cx.beginPath(); cx.ellipse(x+(k-1)*3,y-fh/2,3.5-k*0.6,fh/2,0,0,TAU); cx.fill(); } }
  if(P.stomp){ cx.strokeStyle='rgba(255,230,160,0.7)'; cx.lineWidth=2; cx.beginPath(); for(const o of [-8,0,8]){ cx.moveTo(P.x+o,P.y-PH*PS-10); cx.lineTo(P.x+o*0.5,P.y-PH*PS-40); } cx.stroke(); }
}
function drawParticles(){
  cx.save(); cx.globalCompositeOperation='lighter';
  for(const p of A.particles){ const a=1-p.t/p.life; if(p.dust){ cx.fillStyle=`rgba(255,220,160,${0.3*Math.sin(Math.PI*p.t/p.life)})`; cx.fillRect(p.x,p.y,1.5,1.5); continue; }
    if(p.leaf){ cx.fillStyle=`rgba(120,90,50,${0.6*Math.sin(Math.PI*p.t/p.life)})`; cx.fillRect(p.x+Math.sin(p.t*3)*3,p.y,2.5,1.5); continue; }
    if(p.frost){ cx.fillStyle=`rgba(210,230,255,${0.5*Math.sin(Math.PI*p.t/p.life)})`; cx.fillRect(p.x,p.y,2,2); continue; }
    const r=p.big?4:2; cx.fillStyle=p.gold?`rgba(255,215,130,${a})`:p.water?`rgba(200,225,240,${a})`:p.ash?`rgba(150,140,135,${a*0.8})`:p.soft?`rgba(170,140,110,${a*0.6})`:`rgba(120,90,90,${a})`; cx.beginPath(); cx.arc(p.x,p.y,r,0,TAU); cx.fill(); }
  for(const e of A.embers){ cx.fillStyle='rgba(255,150,50,0.9)'; cx.fillRect(e.x,e.y,2.5,2.5); }
  for(const r of A.rings){ const a=1-r.t/0.9; cx.strokeStyle=`rgba(255,225,150,${0.7*a})`; cx.lineWidth=3*a+1; cx.beginPath(); cx.arc(r.x,r.y,r.r,0,TAU); cx.stroke(); }
  for(const s of A.streams){ if(s.t<0) continue; const t=sm(Math.min(1,s.t)); const x=lerp(s.x0,s.x1,t), y=lerp(s.y0,s.y1,t)-Math.sin(t*Math.PI)*60; cx.fillStyle='rgba(255,230,160,0.95)'; cx.beginPath(); cx.arc(x,y,3,0,TAU); cx.fill(); }
  cx.restore();
}
function lightSources(){
  const L=[]; const d=A.d;
  L.push([P.x+1,P.y-49+(P.sit?15:0),60+P.glow*150+(P.pulse||0)*40,1]);
  for(const m of A.motes) if(!m.got) L.push([m.x,m.y,34,0.8]);
  if(A.shrine){ const s=A.shrine, gy=d.gy(s.x); L.push([s.x,gy-48,s.awake?260*clamp(s.t/1.5,0,1)+40:46,1]); }
  for(const l of A.lanterns) if(l.lit) L.push([l.x+14,d.gy(l.x)-82,110,0.9]);
  for(const l of A.hang) if(!l.hidden&&hangLit(l)) L.push([l.x,l.y,120,0.9]);
  if(P.ember) L.push([P.x+P.face*9,P.y-PH*PS-14,200,1]);
  for(const b of A.bells) L.push([b.x,b.y,60,0.6]);
  for(const c of A.cats) if(!c.dead&&c.wind>0) L.push([c.x,c.y-14,60,0.6]);
  for(const b of A.braziers) L.push([b.x,d.gy(b.x)-40,b.lit?(b.snuff>0?120+80*Math.abs(Math.sin(game.t*28)):200):34,1]);
  for(const n of A.npcs) if(n.lit) L.push([n.x,d.gy(n.x)-30*n.s,40,0.6]);
  for(const r of A.rings) L.push([r.x,r.y,r.r+40,0.6*(1-r.t/0.9)]);
  for(const e of A.enemies) if(e.calm&&e.t==='frygar') L.push([e.x,e.y-32,50,0.7]);
  for(const e of A.embers) L.push([e.x,e.y,16,0.5]);
  for(const e of A.enemies) if(!e.calm&&e.spr) L.push([e.x,e.y-e.h*0.5,e.tele>0?90:55,e.tele>0?0.8:0.45]);
  for(const e of A.enemies) if(e.t==='guard'&&!e.calm){ const r=e.r||170; for(let q=1;q<=3;q++) L.push([e.x+e.dir*r*q/3.4,gyOr(e.x)-20,46+q*8,e.alarm>0?0.7:0.5]); }
  for(const t of A.d.tides){ const lv=tideLevel(t); if(lv>0||game.night) L.push([t.x+t.w/2,BASE+10,t.w*0.7,0.25+0.4*lv]); }
  const B=A.boss; if(B&&(!B.calm||B.kneel)) L.push([B.x,B.y-B.h*0.5,B.h*(B.st==='tele'?1.5:1.1),B.st==='sleep'?0.4:0.8]);
  for(const f of A.folk) L.push([f.x,gyOr(f.x)-(f.lift||0)-f.h*0.5,f.h*1.1,0.8]);
  for(const s of A.shots) if(!(s.wait>0)) L.push([s.x,s.y,s.k==='wave'?60:s.turned?60:34,0.8]);
  for(const h of A.haz){ if(h.k==='vent'&&h.act) L.push([h.x,gyOr(h.x)-60,110,0.8]); if(h.k==='drop'&&h.warn) L.push([h.x,gyOr(h.x),game.night?70:30,game.night?0.8:0.4]);
    if(game.night&&h.k==='vent'&&h.warn) L.push([h.x,gyOr(h.x)-10,60,0.7]); if(game.night&&h.k==='drop'&&h.fall) L.push([h.x,h.ry,50,0.7]); }
  if(game.night){ for(const g of A.d.gaps){ L.push([g[0],gyOr(g[0]-4)-6,26,0.5]); L.push([g[1],gyOr(g[1]+4)-6,26,0.5]); } for(const p of A.plats) L.push([p.x+p.w/2,p.y,Math.max(30,p.w*0.6),0.45]); }
  for(const w of A.ways) if(w.lit) L.push([w.x,gyOr(w.x)-30,80,0.8]);
  if(A.fires) for(const f of A.fires) L.push([(f.x0+f.x1)/2,gyOr(f.x0)-14,110,0.8]);
  if(A.pillars) for(const p of A.pillars) L.push([p.x,gyOr(p.x)-(p.t>p.warn?120:6),p.t>p.warn?160:40,0.9]);
  if(A.decoys&&A.boss) for(const dc of A.decoys) L.push([dc.x,dc.y-A.boss.h*0.5,A.boss.h*1.1,0.8*dc.a]);
  return L;
}
function drawLighting(){
  const d=A.d; let dark=d.dark; const night=game.night&&game.areaI<7&&!d.secret; if(night) dark=Math.max(dark,Math.min(0.72,dark+0.3)); // v6: the Long Night
  if(A.act===2&&!d.secret) dark=Math.min(0.94,dark+0.07);
  if(game.throne&&game.throne.sat&&game.throne.phase==='sit') dark=Math.min(0.78,dark+0.6*clamp(game.throne.t/2,0,1));
  if(dark<=0.01) return;
  lx.globalCompositeOperation='source-over'; lx.clearRect(0,0,W,H);
  lx.fillStyle=`rgba(${night&&d.key!=='dark'?'6,8,24':d.darkCol},${dark})`; lx.fillRect(0,0,W,H);
  lx.globalCompositeOperation='destination-out';
  for(const [x,y,r,a] of lightSources()){ const sx=x-camX, sy=y-camY; if(sx<-r||sx>W+r||sy<-r||sy>H+r) continue; const g=lx.createRadialGradient(sx,sy,0,sx,sy,r); g.addColorStop(0,`rgba(0,0,0,${a})`); g.addColorStop(0.5,`rgba(0,0,0,${a*0.6})`); g.addColorStop(1,'rgba(0,0,0,0)'); lx.fillStyle=g; lx.fillRect(sx-r,sy-r,r*2,r*2); }
  cx.drawImage(lc,0,0);
}
// v7: soft coloured light. One cached glow per colour, drawn additively; cheaper than a gradient per light per frame.
const GLC={}; function glowSpr(c){ if(GLC[c]) return GLC[c]; const k=document.createElement('canvas'); k.width=k.height=64; const g=k.getContext('2d'); const r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,`rgba(${c},1)`); r.addColorStop(0.25,`rgba(${c},0.55)`); r.addColorStop(0.6,`rgba(${c},0.16)`); r.addColorStop(1,`rgba(${c},0)`); g.fillStyle=r; g.fillRect(0,0,64,64); return GLC[c]=k; }
function glowAt(x,y,r,c,a){ const sx=x-camX, sy=y-camY; if(sx<-r||sx>W+r||sy<-r||sy>H+r||a<=0.01) return; cx.globalAlpha=Math.min(1,a); cx.drawImage(glowSpr(c),sx-r,sy-r,r*2,r*2); }
function drawGlow(){
  cx.save(); cx.globalCompositeOperation='lighter'; const d=A.d;
  for(const l of A.hang) if(!l.hidden&&hangLit(l)) glowAt(l.x,l.y,64,'255,200,120',0.35);
  for(const b of A.braziers) if(b.lit) glowAt(b.x,d.gy(b.x)-38,80+6*Math.sin(game.t*9+b.x),'255,150,60',0.32);
  for(const s of A.shots) if(!(s.wait>0)) glowAt(s.x,s.y,s.k==='wave'?44:24,s.turned?'255,230,160':s.k==='sting'?'255,220,120':'255,110,50',0.5);
  for(const h of A.haz) if(h.k==='vent'&&(h.act||h.warn)) glowAt(h.x,gyOr(h.x)-(h.act?50:8),h.act?70:34,h.f==='water'?'150,200,255':h.f==='thorn'?'170,220,120':'255,120,40',h.act?0.4:0.22);
  for(const m of A.motes) if(!m.got&&!(m.hide>0)) glowAt(m.x,m.y,20,'255,210,120',0.28);
  for(const e of A.enemies) if(!e.calm&&e.tele>0) glowAt(e.x,e.y-e.h*0.6,54,'255,70,30',0.35);
  for(const b of A.bells) glowAt(b.x,b.y,b.ring>0?70:36,'255,220,140',b.ring>0?0.4:0.16);
  cx.globalAlpha=1;
  const r=40+P.glow*80+(P.pulse||0)*30, x=P.x+1-camX, y=P.y-49-camY+(P.sit?15:0);
  const g=cx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,`rgba(255,220,150,${0.3*Math.min(1.4,P.glow)+0.12*(P.pulse||0)})`); g.addColorStop(1,'rgba(255,140,40,0)'); cx.fillStyle=g; cx.fillRect(x-r,y-r,r*2,r*2);
  for(const l of A.lanterns) if(l.lit){ const lx2=l.x+14-camX, ly=A.d.gy(l.x)-82-camY; const gg=cx.createRadialGradient(lx2,ly,0,lx2,ly,40); gg.addColorStop(0,'rgba(255,200,120,0.35)'); gg.addColorStop(1,'rgba(255,200,120,0)'); cx.fillStyle=gg; cx.fillRect(lx2-40,ly-40,80,80); }
  cx.restore();
}
function drawAir(){ // v7: depth: slow light shafts by day, a low drifting mist in the dark lands
  const d=A.d, t=game.t; cx.save(); cx.globalCompositeOperation='lighter';
  if(!game.night&&!d.secret&&d.dark<0.35&&d.key!=='garden'){ for(let i=0;i<3;i++){ const x=((i*347+120-camX*0.15)%(W+300)+W+300)%(W+300)-150+Math.sin(t*0.13+i)*30, w=60+i*24;
      const g=cx.createLinearGradient(x,0,x+180,H); g.addColorStop(0,'rgba(255,230,180,0.045)'); g.addColorStop(1,'rgba(255,230,180,0)'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(x,-10); cx.lineTo(x+w,-10); cx.lineTo(x+w+220,H); cx.lineTo(x+220,H); cx.fill(); } }
  cx.restore();
  if(d.dark>=0.25||game.night){ cx.save(); const mc=game.night?'150,170,220':d.key==='war'?'200,110,80':'170,160,150'; for(let i=0;i<7;i++){ const par=1.1+i*0.04, x=((i*233-camX*par+t*(6+i))%(W+400)+W+400)%(W+400)-200, y=BASE-camY+4+(i%3)*10;
      cx.globalAlpha=0.07; cx.drawImage(glowSpr(mc),x-150,y-34,300,68); } cx.restore(); } }
// v7: bloom: the bright parts of the frame, shrunk, boosted and laid back over softly
const blm=document.createElement('canvas'); blm.width=Math.round(W/4); blm.height=Math.round(H/4); const blx=blm.getContext('2d');
let BLOOM=true, blmN=0, HUMAN=false; /*@DEV*/ HUMAN=Q.has('human'); /*@/DEV*/ /*@DEV*/ if(Q.has('nobloom')) BLOOM=false; /*@/DEV*/
const hal=document.createElement('canvas'); hal.width=Math.round(W/2); hal.height=Math.round(H/2); const hlx=hal.getContext('2d');
let perfT=0, perfN=0, perfS=0; // SET.gfx: 0 auto, 1 ultra, 2 high, 3 light, 4 classic. Auto steps resolution, then one tier, when a frame stays over 18 ms.
const perfShow={frame:0,back:0,play:0,upload:0,post:0,gpu:-1};
function perfNote(k,ms){ if(!perfOn||!(ms>=0)) return; perfShow[k]=perfShow[k]<0?ms:perfShow[k]*0.8+ms*0.2; }
function tierLabel(t){ return ['auto','ultra','high','light','classic'][t]||String(t); }
function activeTier(){ return SET.gfx===0?autoTier:SET.gfx; }
function gfxLite(){ return activeTier()===3; }
function atPerfFloor(){ return autoTier>=3&&RS<=1.01; }
function applyGfx(n){
  SET.gfx=clamp(n|0,0,4); rsDrop=0; perfT=0; perfN=0; perfS=0;
  if(!SET.gfx) autoTier=1;
  if(SET.gfx!==4&&!Q.has('classic')&&!Q.has('nowebgl')){ glFailed=false; if(glState==='classic') glState='init'; }
  saveSettings(); syncArt(); fit();
}
function glLabel(){ if(!glOn()) return 'classic'; return glState==='webgl2'||glState==='webgl1'?glState:'pending'; }
function perfStepDown(){
  const before=RS+':'+autoTier+':'+rsDrop;
  // Resolution all the way to 1 (2 → 1.5 → 1.25 → 1) before a tier change.
  if(RS>1+1e-3){ rsDrop++; fit(); }
  else if(autoTier<3){ autoTier++; syncArt(); }
  return before!==(RS+':'+autoTier+':'+rsDrop);
}
function perfWatch(rdt){ if(AUTO||SET.gfx||game.state!=='play'||game.paused||atPerfFloor()) return; perfT+=rdt; perfN++; perfS+=rdt; // a 2 s window of play, then one step
  if(perfT<2) return; const mean=perfS/Math.max(1,perfN); perfT=0; perfN=0; perfS=0; if(mean>0.018) perfStepDown(); }
function drawPerf(){
  if(!perfOn||!hud) return;
  const g=hx; g.save(); g.setTransform(hud.width/W,0,0,hud.height/H,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over';
  const name=SET.gfx===0?'auto→'+tierLabel(activeTier()):tierLabel(activeTier());
  const gpu=perfShow.gpu<0?'gpu n/a':'gpu '+perfShow.gpu.toFixed(2);
  const lines=['v12.1  '+glLabel()+'  '+name+'  RS '+RS,'frame '+perfShow.frame.toFixed(2)+' ms   back '+perfShow.back.toFixed(2)+'   play '+perfShow.play.toFixed(2)+'   upload '+perfShow.upload.toFixed(2)+'   post '+perfShow.post.toFixed(2)+'   '+gpu];
  g.font='11px Georgia, serif'; const w=Math.ceil(Math.max(g.measureText(lines[0]).width,g.measureText(lines[1]).width))+18;
  g.fillStyle='rgba(8,4,2,0.78)'; g.fillRect(W/2-w/2,6,w,34); g.fillStyle='#ffe6c4'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(lines[0],W/2,16); g.fillText(lines[1],W/2,30); g.restore();
}
// Bloom and the VHS bleed read only what has been drawn so far (the backdrop). The play layer is composited after.
function postBackdrop(){
  if(gfxLite()) return;
  hlx.globalCompositeOperation='copy'; hlx.drawImage(cv,0,0,hal.width,hal.height);
  if(BLOOM&&!(blmN++%2)){ blx.globalCompositeOperation='copy'; blx.drawImage(hal,0,0,blm.width,blm.height); blx.globalCompositeOperation='multiply'; blx.drawImage(blm,0,0); blx.drawImage(blm,0,0); }
  cx.save(); cx.globalCompositeOperation='screen'; cx.globalAlpha=0.13; cx.drawImage(hal,0,0,hal.width,hal.height,2,0,W,H);
  if(BLOOM){ cx.globalCompositeOperation='lighter'; cx.globalAlpha=0.24; cx.drawImage(blm,-6,-4,W+12,H+8); } cx.restore();
}
function postFrame(){
  ensureVig(); cx.save(); cx.setTransform(1,0,0,1,0,0); cx.drawImage(vig,0,0); cx.restore(); base();
  const tb=(game.t*0.07)%1.6; if(tb<1){ cx.fillStyle='rgba(255,240,220,0.03)'; cx.fillRect(0,tb*H,W,5); }
}
// trauma² × smooth noise. Peak at trauma 1 matches the old ±5 / ±4 px. The decay of game.shake is unchanged.
function shakeOffset(){
  const tr=game.shake; if(tr<=0) return [0,0];
  const k=tr*tr, t=game.t;
  const nx=Math.sin(t*47.1)+Math.sin(t*91.7+1.3), ny=Math.sin(t*53.3+0.7)+Math.sin(t*81.1+2.1);
  return [nx*2.5*k, ny*2*k];
}
function text(t,x,y,size,col,align='center',alpha=1){
  pen.save(); pen.globalAlpha=alpha; pen.font=`${size}px Georgia, 'Times New Roman', serif`; pen.textAlign=align; pen.textBaseline='middle';
  pen.shadowColor='rgba(0,0,0,0.85)'; pen.shadowBlur=6; pen.fillStyle=col; pen.fillText(t,x,y); pen.restore();
}
function wrap(t,maxW,size){ pen.font=`${size}px Georgia, serif`; const words=t.split(' '), lines=[]; let cur=''; for(const w of words){ const tt=cur?cur+' '+w:w; if(pen.measureText(tt).width>maxW&&cur){ lines.push(cur); cur=w; } else cur=tt; } if(cur) lines.push(cur); return lines; }
function inkWash(x,y,w,h){ const r=Math.min(16,h*0.4); pen.save(); pen.fillStyle='rgba(14,6,2,0.72)'; pen.beginPath();
  pen.moveTo(x+r,y); pen.arcTo(x+w,y,x+w,y+h,r); pen.arcTo(x+w,y+h,x,y+h,r); pen.arcTo(x,y+h,x,y,r); pen.arcTo(x,y,x+w,y,r); pen.closePath(); pen.fill(); pen.restore(); }
function drawStar(x,y,R,a,col){ pen.save(); pen.translate(x,y); pen.globalAlpha=a; pen.lineJoin='round'; pen.beginPath();
  for(let k=0;k<8;k++){ const ang=k/8*TAU-Math.PI/2, r=k%2?R*0.42:R; pen.lineTo(Math.cos(ang)*r,Math.sin(ang)*r); }
  pen.closePath(); pen.lineWidth=3; pen.strokeStyle='rgba(12,4,1,0.95)'; pen.stroke(); pen.fillStyle=col; pen.fill(); pen.restore(); }
// v11.4: a line lifts only for a gap, a moving floor, a hazard or a tide in the next stretch (P.x-40 to P.x+260).
// The choice is made once, in startLine. A lifted line sits in the top band, under the hint, clear of the left wash.
function subLift(){
  if(!A) return false;
  const d=A.d, L=P.x-40, R=P.x+260, over=(a,b)=>b>L&&a<R;
  for(const g of d.gaps) if(over(g[0],g[1])) return true;
  if(d.dyn) for(const g of d.dyn) if(over(g[0],g[1])) return true;
  for(const h of d.hazards) if(h.x>L&&h.x<R) return true;
  for(const t of d.tides||[]) if(over(t.x,t.x+t.w)) return true;
  return false;
}
function subBox(n,lift,legend){
  const h=n*22+10, top=lift?78+(legend?28:0):(H-28-(n-1)*22)-16;
  const w=lift?W*0.62:W*0.84, x=lift?(W-w)/2:W*0.08;
  return {top,h,bottom:top+h,x,w};
}
function titleFade(t){ const dur=game.titleDur||4; return Math.min(1,t)*Math.min(1,Math.max(0,(dur-t)*1.5)); }
function drawHUD(){
  const cx=pen; // the overlay canvas: bloom never touches the counters, the subtitle or the cards
  const n=Math.max(0,P.light); const x0=32,y0=46;
  const shines=Math.floor(n/SHINE_COST), rem=n%SHINE_COST;
  const danger=n<=0, thin=!danger&&n<SHINE_COST; // 0: the next hit takes a life. 1–2: no shine, one hit from empty.
  const beat=0.62+0.38*Math.abs(Math.sin(game.t*2.6)); // a slow pulse, never blinking out
  if(game.areaI<7||A.d.secret){
    const shown=Math.min(shines,5), starR=9, gap=22, extra=shines>5?36:0;
    const rowW=Math.max(64,(shown||1)*gap+extra);
    inkWash(x0+16,8,rowW+36,92); // a soft dark wash so the count reads on a bright painting
    cx.save(); cx.globalCompositeOperation='lighter';
    const glow=danger?30:22+Math.min(n,LIGHT_CAP)*0.35;
    const g=cx.createRadialGradient(x0,y0,0,x0,y0,glow);
    const hot=danger?'255,50,30':thin?'255,140,50':'255,200,110';
    g.addColorStop(0,`rgba(255,245,220,${danger?beat:1})`); g.addColorStop(0.45,`rgba(${hot},${danger?0.9*beat:0.8})`); g.addColorStop(1,'rgba(255,80,20,0)');
    cx.fillStyle=g; cx.beginPath(); cx.arc(x0,y0,glow,0,TAU); cx.fill(); cx.restore();
    cx.fillStyle=danger?`rgba(255,48,28,${0.75+0.25*beat})`:thin?'#ffb15a':'#fff6dc';
    cx.beginPath(); cx.arc(x0,y0,12,0,TAU); cx.fill();
    const fr=game.ember?0:game.lifeMotes/lifeNeed(); cx.strokeStyle='rgba(255,220,160,0.28)'; cx.lineWidth=3; cx.beginPath(); cx.arc(x0,y0,20,0,TAU); cx.stroke(); cx.strokeStyle='rgba(255,236,190,0.95)'; cx.beginPath(); cx.arc(x0,y0,20,-Math.PI/2,-Math.PI/2+TAU*fr); cx.stroke(); // v7: the ring fills toward a new life
    if(danger){ cx.strokeStyle=`rgba(255,64,36,${0.5+0.5*beat})`; cx.lineWidth=4; cx.beginPath(); cx.arc(x0,y0,27,0,TAU); cx.stroke(); }
    else if(thin){ cx.strokeStyle='rgba(255,150,60,0.95)'; cx.lineWidth=3; cx.beginPath(); cx.arc(x0,y0,27,0,TAU); cx.stroke(); }
    const numCol=danger?'#ff4a32':thin?'#ffb15a':'#fff6e4';
    text(String(n),x0+30,y0-14,32,numCol,'left',danger?0.78+0.22*beat:1);
    // v11.4: stars are shines the light will buy. Three seeds fill into the next one.
    const sx=x0+36, sy=y0+14, starCol=danger?'#ff5c3c':thin?'#ffc06a':'#fff3c8';
    if(!shines) drawStar(sx,sy,starR,danger?0.45+0.55*beat:0.55,starCol);
    for(let i=0;i<shown;i++) drawStar(sx+i*gap,sy,starR,1,'#fff6d4');
    if(shines>5) text(String(shines),sx+shown*gap,sy,20,'#fff3d0','left',1);
    for(let i=0;i<SHINE_COST;i++){ const dx=sx-4+i*14, dy=sy+18;
      cx.beginPath(); cx.arc(dx,dy,3.4,0,TAU);
      cx.fillStyle=i<rem?(danger?'#ff6a48':thin?'#ffc278':'#fff1c4'):'rgba(255,220,170,0.16)'; cx.fill();
      cx.lineWidth=1.6; cx.strokeStyle=i<rem?'rgba(40,16,4,0.8)':'rgba(255,220,170,0.75)'; cx.stroke(); }
    // v11.4: one short legend, the first time the light changes. Stars are shines left. Seeds are light toward the next.
    const leg=game.legendT>0?Math.min(1,game.legendT*2.2,(4.6-game.legendT)*3):0;
    if(leg>0.02){
      const ly=108, cap='a shine left', cap2='light toward the next';
      cx.font='13px Georgia, serif'; const w1=cx.measureText(cap).width, w2=cx.measureText(cap2).width;
      inkWash(12,ly-13,36+w1+46+w2,26);
      drawStar(28,ly,6,leg,'#fff6d4'); text(cap,40,ly,13,'#ffe8c4','left',leg);
      const dx0=40+w1+14; for(let i=0;i<3;i++){ cx.beginPath(); cx.arc(dx0+i*9,ly,2.5,0,TAU); cx.fillStyle=`rgba(255,241,196,${leg})`; cx.fill(); }
      text(cap2,dx0+32,ly,13,'#ffe8c4','left',leg);
    }
    if(A.shrine&&!A.shrine.awake){ const have=Math.max(0,P.light)|0, need=A.shrine.need, ready=have>=need;
      const line=`stone  ${have} / ${need}  light`; // v11.4: the light you carry, and the light the stone wants
      cx.font='14px Georgia, serif'; const lw=Math.ceil(cx.measureText(line).width)+28;
      const sy2=leg>0.02?148:125; inkWash(12,sy2-13,lw,26);
      cx.save(); cx.globalAlpha=0.95; cx.fillStyle=ready?'#fff6dc':'#ffd27a'; cx.beginPath(); cx.arc(24,sy2,4.2,0,TAU); cx.fill(); cx.fillStyle='#fff6dc'; cx.beginPath(); cx.arc(23.2,sy2-0.8,1.7,0,TAU); cx.fill(); cx.restore();
      text(line,34,sy2,14,ready?'#fff6dc':'#ffe8c4','left',0.95); }
  }
  // lives: little suns, top right. One life left pulses. The light's own sun, not these, gutters when the next hit would take one.
  for(let i=0;i<Math.min(game.lives,MAX_LIVES);i++){ const lx2=W-26-i*24, ly=26; const lone=game.lives===1; const pr=lone?0.82+0.18*Math.sin(game.t*4):1;
    cx.save(); cx.globalCompositeOperation='lighter'; const g=cx.createRadialGradient(lx2,ly,0,lx2,ly,13); g.addColorStop(0,'rgba(255,245,210,1)'); g.addColorStop(0.45,'rgba(255,190,90,0.85)'); g.addColorStop(1,'rgba(255,120,30,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(lx2,ly,13*pr,0,TAU); cx.fill(); cx.restore();
    cx.strokeStyle='rgba(255,220,150,0.7)'; cx.lineWidth=1; cx.beginPath(); for(let k=0;k<8;k++){ const a=k/8*TAU+game.t*0.5; cx.moveTo(lx2+Math.cos(a)*7,ly+Math.sin(a)*7); cx.lineTo(lx2+Math.cos(a)*10*pr,ly+Math.sin(a)*10*pr); } cx.stroke(); }
  if(game.areaI<7||A.d.secret){ text(`lives`,W-26-Math.min(game.lives,MAX_LIVES)*24+4,27,11,'rgba(255,220,180,0.7)','right',0.85);
    if(!game.ember) text(`${game.lifeMotes}/${lifeNeed()} to a new life`,W-14,48,10,'rgba(255,220,180,0.55)','right',0.8); }
  if(SET.timer&&game.fromStart&&!A.d.bench) text(fmtT(runT(),1),14,H-14,13,'rgba(255,236,206,0.8)','left',0.9); // v6: the run timer (pause menu)
  if(game.split&&SET.timer){ const t=game.split.t, a=Math.min(1,t*3)*Math.min(1,(4.5-t)); text(game.split.txt,14,H-34,13,game.split.good?'#c8ffb0':'#ffe0c0','left',a); }
  if(GOD&&!Q.has('rec')&&!Q.has('clean')) text('debug: invincible',W-14,64,10,'#9f9','right',0.8);
  // boss
  const B=A.boss; if(B&&!B.calm&&B.st!=='sleep'){ const bw=280, bx=W/2-bw/2, by=H-74; cx.fillStyle='rgba(0,0,0,0.5)'; cx.fillRect(bx-2,by-2,bw+4,10); const fr=clamp(B.hp/B.max,0,1); const g=cx.createLinearGradient(bx,0,bx+bw,0); g.addColorStop(0,'#8a1a10'); g.addColorStop(1,'#ff7a3a'); cx.fillStyle=g; cx.fillRect(bx,by,bw*fr,6); if(B.th) for(const th of B.th){ const nx=bx+bw*th/B.max; cx.fillStyle='rgba(255,240,210,0.85)'; cx.fillRect(nx-1,by-3,2,12); } text(B.name+(B.phase>1?'  '+(B.phase===2?'II':'III'):''),W/2,by-11,13,'#ffd2b0','center',0.9); }
  if(game.bossBanner){ const t=game.bossBanner.t; const a=Math.min(1,t*2)*Math.min(1,(3.5-t)*1.5); text(game.bossBanner.name.toUpperCase(),W/2,H*0.36,34,'#ffe0c0','center',a); if(game.bossBanner.sub) text(game.bossBanner.sub,W/2,H*0.36+36,22,'#ffb080','center',a); }
  for(const p of game.popups) text(p.t,p.x-camX,p.y-camY,p.t==='1 UP'?22:13,p.t==='1 UP'?'#fff2a0':'#ffe0b0','center',Math.min(1,p.life));
  if(P.dead>0){ const k=clamp((DEATH_T-P.dead)/0.45,0,1); cx.fillStyle=`rgba(0,0,0,${0.55*k})`; cx.fillRect(0,0,W,H);
    text(game.lives>0?'A light goes out':'The last light goes out',W/2,H*0.42,26,'#ffd8b0','center',k);
    text(game.lives>0?`${game.lives} ${game.lives===1?'life':'lives'} left`:'',W/2,H*0.42+32,16,'#ffcf9a','center',k*0.9); }
  if(A.zeroT>0.2&&!P.dead){ cx.fillStyle=`rgba(120,0,0,${0.12+0.1*Math.sin(game.t*8)})`; cx.fillRect(0,0,W,H); }
  if(A.hintT>0&&A.hint){ const a=Math.min(1,A.hintT)*Math.min(1,(game.t%1e9)>0?1:1); text(A.hint,W/2,64,15,'#ffe2b0','center',a); }
  if(game.areaTitle>0&&game.state==='play'){ const t=game.areaTitle; const a=titleFade(t); const d=A.d; if(d.num) text(actLine(d,1),W/2,H*0.34,18,'#ffd9a0','center',a*0.8); text(d.title,W/2,H*0.34+30,30,'#fff0d0','center',a); cardRule(a); }
  if(game.actT>0&&game.state==='play'){ const t=game.actT; const a=Math.min(1,t)*Math.min(1,(3.6-t)*1.5); const d=A.d; text(actLine(d,2),W/2,H*0.34,18,'#ffd9a0','center',a*0.8); text(d.title,W/2,H*0.34+30,30,'#fff0d0','center',a); cardRule(a); }
  if(vo.subA>0.02&&vo.sub){ const lift=!!vo.lift; const ls=wrap(vo.sub,lift?W*0.58:W*0.78,17); const box=subBox(ls.length,lift,!!vo.legend); cx.save(); cx.globalAlpha=vo.subA*0.5; cx.fillStyle='#000'; cx.fillRect(box.x,box.top,box.w,box.h); cx.restore();
    ls.forEach((l,i)=>text(l,box.x+box.w/2,box.top+16+i*22,17,'#f4e6cc','center',vo.subA)); }
  if(game.throne&&game.throne.phase==='choose'){ const a=0.6+0.4*Math.sin(game.t*2);
    if(!game.throne.sat) text(touchMode?'⤒  sit on the throne':'↑  sit on the throne',W/2-170,H*0.2,17,'#ffe2b0','center',0.9);
    text(touchMode?'✦  let the light go':'X  let the light go',game.throne.sat?W/2:W/2+170,H*0.2,17,'#fff4d8','center',a); }
  if(game.paused&&!game.veil){ cx.fillStyle='rgba(0,0,0,0.55)'; cx.fillRect(0,0,W,H); }
  if(DEBUG) text(`x ${P.x|0} y ${P.y|0} light ${P.light} area ${game.areaI} ${game.state}`,W-8,H-10,11,'#9f9','right');
}
function cardRule(a){ const y=H*0.34+54; const g=pen.createLinearGradient(W/2-160,0,W/2+160,0); g.addColorStop(0,'rgba(255,220,160,0)'); g.addColorStop(0.5,`rgba(255,220,160,${0.6*a})`); g.addColorStop(1,'rgba(255,220,160,0)'); pen.fillStyle=g; pen.fillRect(W/2-160,y,320,1.2); }
function actLine(d,n){ return (game.night?'The Long Night   ·   ':'')+d.num+(d.act2&&game.areaI?`   ·   Act ${n}`:''); }
function drawCine(){
  const c=game.cine; if(!c) return; const t=c.t;
  const a=clamp(t/1.2,0,1);
  const k=t<5.5?0:1; const im=IMG[c.imgs[k]]; const zz=1.04+0.05*((t%5.5)/5.5);
  cx.save(); cx.globalAlpha=a; cx.drawImage(im,W/2-W*zz/2,H/2-H*zz/2,W*zz,H*zz);
  if(t>5.0&&t<6.0){ cx.globalAlpha=a*(1-Math.abs(t-5.5)*2); cx.fillStyle='#fff8e8'; cx.fillRect(0,0,W,H); }
  cx.restore();
  // the light, streaming out to everyone
  cx.save(); cx.globalCompositeOperation='lighter'; const r=rngf(31); for(let i=0;i<90;i++){ const sp=40+r()*120; const ang=r()*TAU; const dd=(t*sp+r()*300)%(W*0.7); const x=W/2+Math.cos(ang)*dd, y=H*0.45+Math.sin(ang)*dd*0.6; cx.fillStyle=`rgba(255,225,150,${0.5*a*(1-dd/(W*0.7))})`; cx.beginPath(); cx.arc(x,y,1.5+r()*2,0,TAU); cx.fill(); } cx.restore();
}
/* ---- gl ---- */
let gl=null, glCv=null, glBack=null, glComp=null, glBuf=null, bgTex=null, playTex=null, gpuExt=null, gpuQ=[], glWarm=0;
function glAlive(){ return !!(gl&&!gl.isContextLost()); }
function glOn(){ if(Q.has('classic')||Q.has('nowebgl')||glFailed) return false; return activeTier()!==4; }
function glFail(){ glState='classic'; glFailed=true; gl=null; glBack=null; glComp=null; gpuExt=null; gpuQ=[]; glImgTex=null; glPara=0; }
function glLost(){ glFail(); }
function glMakeTex(){
  const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function glTex(tex, src, premul){
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!premul);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  return tex;
}
function glImage(img){
  let t=glImgTex.get(img);
  if(!t){ t=glMakeTex(); glTex(t, img, false); glImgTex.set(img, t); }
  return t;
}
function glVS(){
  if(glState==='webgl2') return '#version 300 es\nprecision mediump float;\nin vec2 aPos;\nout vec2 vUv;\nvoid main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }';
  return 'precision mediump float;\nattribute vec2 aPos;\nvarying vec2 vUv;\nvoid main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }';
}
function glFS(body){
  const web2=glState==='webgl2';
  let s=body.replace(/VARY/g, web2?'in':'varying').replace(/TEXTURE/g, web2?'texture':'texture2D').replace(/FRAGCOLOR/g, web2?'o':'gl_FragColor').replace(/OUTDECL/g, web2?'out vec4 o;':'');
  if(web2) s='#version 300 es\n'+s;
  return s;
}
function glProgram(fsBody){
  const p=gl.createProgram(), a=gl.createShader(gl.VERTEX_SHADER), b=gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(a, glVS()); gl.compileShader(a); gl.shaderSource(b, glFS(fsBody)); gl.compileShader(b);
  if(!gl.getShaderParameter(a, gl.COMPILE_STATUS)||!gl.getShaderParameter(b, gl.COMPILE_STATUS)){ console.warn(gl.getShaderInfoLog(a)||'', gl.getShaderInfoLog(b)||''); return null; }
  gl.attachShader(p, a); gl.attachShader(p, b); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ console.warn(gl.getProgramInfoLog(p)||''); return null; }
  return p;
}
const GL_BACK=`precision mediump float;
VARY vec2 vUv;
uniform sampler2D uPaint; uniform sampler2D uDepth;
uniform vec2 uLog; uniform float uP, uPz, uDx, uSpread, uCamY, uScale, uTaps, uAlpha, uStr;
OUTDECL
void main(){
  vec2 s=vec2(vUv.x, 1.0-vUv.y)*uLog;
  float dw=uLog.x*uScale, dh=uLog.y*uScale, slack=dw-uLog.x, parF=0.35;
  float ox=-slack*0.5+slack*(0.5-uP)*parF*0.9+uDx*uLog.x*0.008;
  float oy=-(dh-uLog.y)*0.6-uCamY*parF*0.35;
  vec2 uvF=vec2((s.x-ox)/dw, (s.y-oy)/dh);
  float extra=0.65*uStr;
  float oxN=ox+slack*(0.5-uP)*extra*0.9+uDx*uLog.x*0.02*uStr;
  float oyN=oy-uCamY*extra*0.35-uSpread*5.0*uStr;
  vec2 uvN=vec2((s.x-oxN)/dw, (s.y-oyN)/dh);
  vec2 best=uvF; float bestD=0.0;
  for(int i=0;i<8;i++){
    if(float(i)<uTaps){
      float t=uTaps<=1.0?1.0:float(i)/(uTaps-1.0);
      vec2 u=mix(uvF, uvN, t);
      vec2 uc=clamp(u, 0.0, 1.0);
      float d=TEXTURE(uDepth, vec2(uc.x, 1.0-uc.y)).r;
      if(d+0.02>=t){ best=u; bestD=d; }
    }
  }
  float br=uPz*mix(1.0, 2.0, bestD);
  vec2 uv=(best-0.5)/(1.0+br)+0.5;
  if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) FRAGCOLOR=vec4(0.0);
  else FRAGCOLOR=vec4(TEXTURE(uPaint, vec2(uv.x, 1.0-uv.y)).rgb, uAlpha);
}`;
const GL_COMP=`precision mediump float;
VARY vec2 vUv;
uniform sampler2D uBg; uniform sampler2D uPlay;
uniform float uLight, uBloom, uGrade;
OUTDECL
vec3 hookLight(vec3 c, float k){ return c; }
vec3 hookBloom(vec3 c, float k){ return c; }
vec3 hookGrade(vec3 c, float k){ return c; }
void main(){
  vec4 bg=TEXTURE(uBg, vUv); vec4 pl=TEXTURE(uPlay, vUv);
  vec3 bgc=hookGrade(hookBloom(hookLight(bg.rgb, uLight), uBloom), uGrade);
  FRAGCOLOR=vec4(bgc*(1.0-pl.a)+pl.rgb, 1.0);
}`;
function glBuild(){
  glBack=glProgram(GL_BACK); glComp=glProgram(GL_COMP); if(!glBack||!glComp) return false;
  const take=(p,list)=>{ const u={}; for(const n of list) u[n]=gl.getUniformLocation(p, n); p.u=u; };
  take(glBack, ['uPaint','uDepth','uLog','uP','uPz','uDx','uSpread','uCamY','uScale','uTaps','uAlpha','uStr']);
  take(glComp, ['uBg','uPlay','uLight','uBloom','uGrade']);
  glBuf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  bgTex=glMakeTex(); playTex=glMakeTex();
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  return true;
}
function glInit(){
  glFailed=false;
  try{
    glCv=document.createElement('canvas'); glCv.width=Math.max(1,cv.width); glCv.height=Math.max(1,cv.height);
    const opts={alpha:false, antialias:false, depth:false, stencil:false, premultipliedAlpha:false, preserveDrawingBuffer:true, powerPreference:'high-performance'};
    gl=glCv.getContext('webgl2', opts);
    if(gl) glState='webgl2';
    else { gl=glCv.getContext('webgl', opts)||glCv.getContext('experimental-webgl', opts); if(gl) glState='webgl1'; }
    if(!gl){ glFail(); return false; }
    const mine=glCv;
    glCv.addEventListener('webglcontextlost', ev=>{ ev.preventDefault(); if(ev.target===mine&&glCv===mine) glLost(); });
    glImgTex=new Map(); glWarm=0; gpuQ=[];
    if(!glBuild()){ glFail(); return false; }
    gpuExt=null; if(glState==='webgl2'){ try{ gpuExt=gl.getExtension('EXT_disjoint_timer_query_webgl2'); }catch(_){ gpuExt=null; } }
    return true;
  }catch(e){ glFail(); return false; }
}
function glResize(){
  const w=cv.width, h=cv.height;
  if(playCv.width!==w||playCv.height!==h){ playCv.width=w; playCv.height=h; }
  if(glCv&&(glCv.width!==w||glCv.height!==h)){ glCv.width=w; glCv.height=h; }
  if(glAlive()) gl.viewport(0,0,glCv.width,glCv.height);
}
function glUse(prog){ gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, glBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
function glCheck(){ if(glWarm>8) return; glWarm++; const e=gl.getError(); if(e) throw new Error('gl '+e); }
function gpuStart(){
  if(!gpuExt) return null;
  try{ if(gl.getParameter(gpuExt.GPU_DISJOINT_EXT)) return null; const q=gl.createQuery(); gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, q); return q; }
  catch(_){ gpuExt=null; return null; }
}
function gpuStop(q){ if(!q||!gpuExt) return; try{ gl.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuQ.push(q); }catch(_){ gpuExt=null; } }
function gpuPoll(){
  if(!gpuExt||!gpuQ.length) return;
  try{
    if(gl.getParameter(gpuExt.GPU_DISJOINT_EXT)){ gpuQ.length=0; return; }
    const keep=[];
    for(const q of gpuQ){
      if(!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)){ keep.push(q); continue; }
      const ns=gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q);
      if(ns>0) perfShow.gpu=perfShow.gpu<0?ns/1e6:perfShow.gpu*0.8+(ns/1e6)*0.2;
    }
    gpuQ=keep;
  }catch(_){ gpuExt=null; gpuQ=[]; }
}
function glCanParallax(s){
  if(!s||activeTier()>2||SET.depth===0||Q.has('flat')) return false;
  for(const [i] of s.draws){ const n=s.imgs[i][0], im=baseImg(n), dp=DEPTH[n]; if(!PACK[n]||!im||!dp||!dp.complete||!dp.naturalWidth) return false; }
  return true;
}
function glBackdrop(s){
  gl.viewport(0,0,glCv.width,glCv.height); gl.disable(gl.BLEND); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); glUse(glBack);
  const L=glBack.u;
  gl.uniform2f(L.uLog, W, H); gl.uniform1f(L.uScale, 1.16); gl.uniform1f(L.uPz, s.pz); gl.uniform1f(L.uDx, s.dx);
  gl.uniform1f(L.uSpread, s.spread); gl.uniform1f(L.uCamY, camY); gl.uniform1f(L.uTaps, activeTier()===1?8:4); gl.uniform1f(L.uStr, 0.75);
  const q=gpuStart();
  for(const [i,alpha] of s.draws){
    const [n,at]=s.imgs[i]; const end=s.imgs[i+1]?s.imgs[i+1][1]:s.d.len; const p=clamp((s.cam-at+390)/(end-at+390),0,1);
    gl.uniform1f(L.uP, p); gl.uniform1f(L.uAlpha, alpha);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glImage(baseImg(n))); gl.uniform1i(L.uPaint, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glImage(DEPTH[n])); gl.uniform1i(L.uDepth, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  gpuStop(q); gl.disable(gl.BLEND);
}
function glLights(){ return 0; } // G3: painted normals. Zero leaves the canvas veil in charge.
function glBloom(){ return 0; } // G3: shader bloom on the backdrop only. Zero keeps postBackdrop.
function glGrade(){ return 0; } // G3: per-land grade. Zero is identity.
function glPost(){ const L=glComp.u; gl.uniform1f(L.uLight, glLights()); gl.uniform1f(L.uBloom, glBloom()); gl.uniform1f(L.uGrade, glGrade()); }
function glPlay(){
  gl.viewport(0,0,glCv.width,glCv.height); gl.disable(gl.BLEND); glUse(glComp);
  gl.activeTexture(gl.TEXTURE0); glTex(bgTex, cv, false); gl.uniform1i(glComp.u.uBg, 0);
  gl.activeTexture(gl.TEXTURE1); glTex(playTex, playCv, true); gl.uniform1i(glComp.u.uPlay, 1);
  const q=gpuStart(); glPost(); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gpuStop(q); gpuPoll();
}
function blitGL(){ cx.setTransform(1,0,0,1,0,0); cx.imageSmoothingEnabled=false; cx.drawImage(glCv,0,0); cx.imageSmoothingEnabled=true; base(); }
function drawBack(){
  drawBackdrop();
  silLayer(A.d.fg,0.55,false);
  if(!gfxLite()) drawAir();
  postBackdrop();
}
function drawPlayGeom(){
  const sh=shakeOffset(), shx=sh[0], shy=sh[1], d=A.d;
  cx.save(); cx.translate(-camX+shx,-camY+shy);
  drawWall(); drawGround(); drawKneelMark(); drawCold(); drawThrone(); drawVeil(); drawShrine(); drawLanterns(); drawHang(); drawWays(); drawSolids(); drawHazards(); drawCats(); drawBells(); drawNPCs(); drawFolk(); drawMotes(); drawSecrets(); drawNightSecrets(); drawBossHazards(); drawShadows(); drawBoss(); drawEnemies();
  if(d.bench){ const bx=d.bench.x-14, gy=d.gy(bx); cx.fillStyle='#1c0c0a'; cx.fillRect(bx-4,gy-16,40,5); cx.fillRect(bx,gy-16,3,16); cx.fillRect(bx+30,gy-16,3,16); cx.fillRect(bx-4,gy-34,3,22); }
  drawPlayer(); drawCarried(); drawShots(); drawParticles();
  cx.restore();
}
function drawPlayFront(){
  const d=A.d;
  drawLighting(); drawGlow();
  const sh=shakeOffset(), shx=sh[0], shy=sh[1];
  if(A.eyes.length){ cx.save(); cx.translate(-camX+shx,-camY+shy); drawEyes(); cx.restore(); }
  silLayer(d.fg,1.25,true);
  if(game.areaI===7){ // dusk garden: everyone's lights
    cx.save(); cx.globalCompositeOperation='lighter'; const n=50+Math.min(120,(game.stats.given||0)*5); const r=rngf(77);
    for(let i=0;i<n;i++){ const par=0.2+r()*0.6; const base=r()*W*3; const xx=((base-camX*par)%(W*1.2)+W*1.2)%(W*1.2)-W*0.1; const y=H*0.2+r()*H*0.62+Math.sin(game.t*(0.5+r())+i)*8; const a=0.3+0.3*Math.sin(game.t*(1+r()*2)+i); cx.fillStyle=`rgba(255,${200+r()*40|0},120,${a})`; cx.beginPath(); cx.arc(xx,y,1.2+r()*1.8,0,TAU); cx.fill(); }
    cx.restore(); }
}
function drawPlay(){ drawPlayGeom(); drawPlayFront(); }
function drawOver(){
  if(game.throne&&game.throne.phase==='release'){ const t=game.throne.t; cx.fillStyle=`rgba(255,248,230,${clamp((t-1.8)/1.4,0,1)})`; cx.fillRect(0,0,W,H); }
  if(game.ending&&game.ending.sec!==undefined){ const t=game.ending.t-game.ending.sec; const a=clamp(t/2.5,0,1); const z=1.04+0.04*clamp(t/14,0,1); cx.save(); cx.globalAlpha=a; cx.drawImage(IMG.x4,W/2-W*z/2,H/2-H*z/2,W*z,H*z); cx.restore();
    cx.save(); cx.globalCompositeOperation='lighter'; for(let i=0;i<3;i++){ const x=W*(0.3+i*0.2), y=H*0.3+Math.sin(game.t+i)*6; const g=cx.createRadialGradient(x,y,0,x,y,26); g.addColorStop(0,`rgba(255,240,200,${0.8*a})`); g.addColorStop(1,'rgba(255,170,60,0)'); cx.fillStyle=g; cx.fillRect(x-26,y-26,52,52); } cx.restore(); }
  if(game.ending&&game.ending.out){ const t=game.ending.t-game.ending.outT; cx.fillStyle=`rgba(0,0,0,${clamp(t/3.5,0,1)})`; cx.fillRect(0,0,W,H); }
  drawCine();
  if(game.flash>0){ cx.fillStyle=`rgba(120,20,10,${game.flash*0.5})`; cx.fillRect(0,0,W,H); }
  postFrame();
}
function drawWorldClassic(){
  const t0=performance.now(); glPara=0;
  base(); cx.globalAlpha=1; cx.globalCompositeOperation='source-over'; cx.fillStyle='#000'; cx.fillRect(0,0,W,H);
  if(!A){ perfNote('play', performance.now()-t0); return; }
  drawBack(); drawPlay(); drawOver();
  perfNote('play', performance.now()-t0);
}
function drawWorldGL(){
  const t0=performance.now();
  glResize(); if(!glAlive()) throw new Error('lost');
  const keep=pen; cx=playCx; pen=playCx;
  try{
    playCx.setTransform(RS,0,0,RS,0,0); playCx.globalAlpha=1; playCx.globalCompositeOperation='source-over'; playCx.clearRect(0,0,W,H);
    drawPlayGeom();
    cx=gameCx; pen=keep;
    const t1=performance.now();
    base(); cx.globalAlpha=1; cx.globalCompositeOperation='source-over'; cx.fillStyle='#000'; cx.fillRect(0,0,W,H);
    const st=backdropState(); const para=glCanParallax(st); glPara=para?1:0;
    if(para){ glBackdrop(st); blitGL(); paintWash(st.pe); silLayer(A.d.fg,0.55,false); if(!gfxLite()) drawAir(); postBackdrop(); }
    else drawBack();
    const t2=performance.now();
    glPlay(); blitGL(); glCheck();
    const t3=performance.now();
    drawPlayFront(); drawOver();
    const t4=performance.now();
    perfNote('play', t1-t0); perfNote('back', t2-t1); perfNote('upload', t3-t2); perfNote('post', t4-t3);
  }catch(err){ cx=gameCx; pen=keep; throw err; }
}
function drawWorld(){
  if(A&&glOn()){
    try{
      if(glState==='init'||!glAlive()){ if(!glInit()) throw new Error('no gl'); }
      drawWorldGL();
      return;
    }catch(err){ cx=gameCx; glFail(); }
  }
  drawWorldClassic();
}
function drawTitle(){
  base(); cx.fillStyle='#000'; cx.fillRect(0,0,W,H);
  const t=game.t, a=game.title.a; const im=baseImg('s01'); const z=1.12+0.03*Math.sin(t*0.1);
  cx.globalAlpha=a; if(im) cx.drawImage(im,W/2-W*z/2+Math.sin(t*0.07)*10,H/2-H*z/2,W*z,H*z); cx.globalAlpha=1;
  const g=cx.createLinearGradient(0,0,0,H); g.addColorStop(0,'rgba(0,0,0,0.4)'); g.addColorStop(0.5,'rgba(0,0,0,0.08)'); g.addColorStop(1,'rgba(0,0,0,0.78)'); cx.fillStyle=g; cx.fillRect(0,0,W,H);
  cx.save(); cx.globalCompositeOperation='lighter'; const r=rngf(5); for(let i=0;i<50;i++){ const x=(r()*W+t*(4+r()*10))%W, y=((r()*H-t*(3+r()*8))%H+H)%H; cx.fillStyle=`rgba(255,210,140,${0.25+0.25*Math.sin(t+i)})`; cx.beginPath(); cx.arc(x,y,1+r()*1.5,0,TAU); cx.fill(); } cx.restore();
  // the wanderer, small, on the title
  drawFigure(cx,W*0.5,H*0.62,1,t*2,1.1,{});
  postBackdrop(); postFrame(); pen=hx;
  if(game.dmShow){ drawDeathMap(a); return; } // v11
  text('FANTOR',W/2,H*0.24,66,'#fff0d2','center',a);
  text("THE   WANDERER'S   LIGHT",W/2,H*0.24+50,16,'#ffd59a','center',a*0.9);
  const blink=0.55+0.45*Math.sin(t*2.5);
  text(touchMode?'Tap to begin':(document.hasFocus()?'Press Enter or Space to begin':'Click to begin'),W/2,H*0.72,18,'#fff2dc','center',a*blink);
  text('Three lives. No continues.',W/2,H*0.72+30,14,'#ffd9b0','center',a*0.85);
  { const no=nightOpen(), eo=emberOpen(), nx=eo&&no?W/2-150:W/2, ex=no?W/2+150:W/2; // v6 / v11
    if(no) text(touchMode?'Tap here for The Long Night':'N  The Long Night',nx,H*0.86,16,'#c8d4ff','center',a*(0.75+0.25*blink));
    if(eo) text(touchMode?'Tap here for the Ember Run':'R  Ember Run  (one life)',ex,H*0.86,16,'#ffb27a','center',a*(0.75+0.25*blink)); }
  const bst=store.get('best'); if(SET.timer&&bst){ const r=[]; if(bst.day) r.push('best journey '+fmtT(bst.day.t,1)); if(bst.night) r.push('best long night '+fmtT(bst.night.t,1)); if(r.length) text(r.join('     '),W/2,H*0.86+(nightOpen()?20:0),11,'rgba(255,225,190,0.7)','center',a); }
  { const r=recGet(), o=r.day, n=r.night; const q=[]; // v10: the record, quietly
    if(o&&o.runs) q.push(`journeys ${o.runs}`+(o.far?`     furthest  ${farLabel(o)}`:''));
    if(n&&n.runs) q.push(`long nights ${n.runs}`+(n.far?`     furthest  ${farLabel(n)}`:''));
    const e=r.ember; if(e&&e.runs) q.push(`ember runs ${e.runs}`+(e.far?`     furthest  ${farLabel(e)}`:'')); // v11
    if(q.length) text(q.join('          '),W/2,H*0.72+52,11,'rgba(255,222,190,0.62)','center',a); }
  text('v12.1',W-10,H-13,9,'rgba(255,220,190,0.35)','right',a);
  if(dmAny()) text(touchMode?'tap here: where the light has gone out':'M  where the light has gone out',W-14,18,11,'rgba(255,222,190,0.6)','right',a);
  text(touchMode?'◀ ▶ walk    ⤒ jump    ⌄ crouch    ✦ shine':'← →  walk     ↑ jump     ↓ crouch     X  shine     Esc menu',W/2,H-32,13,'rgba(255,230,200,0.8)','center',a);
  text('a journey through the art of The Road to Fantor',W/2,H-13,10,'rgba(255,220,190,0.5)','center',a);
}
// v11: the lifetime map, one row per land, a count of every time the light has gone out there, in every journey kept in this browser
function dmAny(){ const d=dmGet(); return d.day.some(v=>v>0)||d.night.some(v=>v>0); }
function drawDeathMap(a){ const cx=pen; const d=dmGet(), nn=d.night.some(v=>v>0), r=recGet(), runs=['day','night','ember'].reduce((q,j)=>q+((r[j]&&r[j].runs)|0),0);
  cx.save(); cx.globalAlpha=a*0.8; cx.fillStyle='#090504'; cx.fillRect(0,0,W,H); cx.restore();
  text('Where the light has gone out',W/2,48,26,'#fff0d6','center',a);
  text(`journeys kept in this browser: ${runs}`,W/2,76,12,'rgba(255,222,190,0.7)','center',a);
  text('each number is a time the light went out there',W/2,94,11,'rgba(255,214,180,0.55)','center',a);
  const rows=AREAS.slice(0,7).map((l,i)=>[`${l.num}  ${l.title}`,d.day[i]|0,d.night[i]|0]); if(d.day[7]||d.night[7]) rows.push(['Dusk',d.day[7]|0,d.night[7]|0]);
  const mx=Math.max(1,...rows.map(q=>q[1]+q[2])), y0=124, lh=Math.min(36,(H-190)/rows.length), bx=W/2-30, bw=W/2-90;
  if(nn){ text('by day',W-40,y0-24,10,'#ffd59a','right',a*0.8); text('by night',W-40,y0-12,10,'#c8d4ff','right',a*0.8); }
  rows.forEach(([k,dv,nv],i)=>{ const y=y0+i*lh; text(k,bx-14,y,15,'#ffdcae','right',a);
    cx.save(); cx.globalAlpha=a; cx.fillStyle='rgba(255,220,170,0.12)'; cx.fillRect(bx,y-5,bw,10); cx.fillStyle='rgba(255,180,90,0.85)'; cx.fillRect(bx,y-5,bw*dv/mx,10); cx.fillStyle='rgba(170,190,255,0.85)'; cx.fillRect(bx+bw*dv/mx,y-5,bw*nv/mx,10); cx.restore();
    text(String(dv+nv),bx+bw+12,y,15,'#fff6e6','left',a); });
  text(touchMode?'Tap to close':'Enter to close',W/2,H-28,13,'#ffe8cc','center',a*0.8); }
// v11: a card to keep, drawn off-screen and saved as a PNG
function cardCanvas(){ const C=document.createElement('canvas'); C.width=1200; C.height=675; const c=C.getContext('2d');
  const T=(t,x,y,sz,col,al='center')=>{ c.font=`${sz}px Georgia, 'Times New Roman', serif`; c.textAlign=al; c.textBaseline='middle'; c.shadowColor='rgba(0,0,0,0.85)'; c.shadowBlur=8; c.fillStyle=col; c.fillText(t,x,y); };
  c.fillStyle='#000'; c.fillRect(0,0,1200,675); const im=baseImg(game.state==='end'?'s23':'s15'); try{ if(im) c.drawImage(im,0,0,1200,675); }catch(_){}
  c.fillStyle='rgba(0,0,0,0.62)'; c.fillRect(0,0,1200,675);
  const r=recGet(), d=dmGet(), s=game.stats||{};
  T('FANTOR',600,70,64,'#fff0d2'); T("THE  WANDERER'S  LIGHT",600,118,20,'#ffd59a');
  const mode=game.ember?'Ember Run':game.night?'The Long Night':'The journey';
  T(game.state==='end'?`${mode}: reached the end.`:`${mode}: the light went out in ${AREAS[game.goArea|0].title}.`,600,166,24,'#fff6e6');
  const L=[]; for(const [k,n] of [['day','journeys'],['night','long nights'],['ember','ember runs']]){ const o=r[k]; if(o&&o.runs) L.push(`${n} ${o.runs}`+(o.far?`, furthest ${farLabel(o)}`:'')); }
  L.forEach((q,i)=>T(q,600,212+i*30,19,'#ffdcae'));
  const y0=212+L.length*30+30; T('where the light has gone out',600,y0,15,'rgba(255,222,190,0.75)');
  const n=d.day.map((v,i)=>v+(d.night[i]|0)), cols=n[7]?8:7, cw=1000/cols;
  for(let i=0;i<cols;i++){ const x=100+cw*(i+0.5); T(i<7?AREAS[i].num:'Dusk',x,y0+36,20,'#ffd59a'); T(String(n[i]),x,y0+68,26,'#fff6e6'); }
  T(`this run: light gathered ${s.motes|0}, shadows calmed ${s.calmed|0}, old powers calmed ${s.bosses|0}`,600,y0+116,17,'#ffe6cc');
  T('AI-generated art, created and curated by Eh AyeC',600,610,15,'rgba(255,225,195,0.85)');
  T('https://ehayec.itch.io/fantor-the-wanderers-light',600,638,16,'#ffcf9a'); T('v12.1',1185,660,11,'rgba(255,220,190,0.5)','right');
  return C; }
function saveCard(){ if(!(game.state==='end'||game.state==='gameover')) return; let url; try{ url=cardCanvas().toDataURL('image/png'); }catch(_){ return; }
  const again=game.cardT&&game.t-game.cardT<8; game.cardT=game.t; game.cardN=(game.cardN|0)+1; let u=url;
  try{ const b=atob(url.split(',')[1]), a8=new Uint8Array(b.length); for(let i=0;i<b.length;i++) a8[i]=b.charCodeAt(i); u=URL.createObjectURL(new Blob([a8],{type:'image/png'})); }catch(_){}
  if(!again){ try{ const a=document.createElement('a'); a.href=u; a.download='fantor-card.png'; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove(); game.cardMsg=1; return; }catch(_){} }
  try{ const w=window.open(u,'_blank'); game.cardMsg=w?2:3; }catch(_){ game.cardMsg=3; } }
function cardZone(x,y){ return (game.state==='end'&&game.endT>=3||game.state==='gameover'&&game.goT>=3)&&x>W-240&&y>H-50; }
function cardLabel(){ const m=game.cardMsg, rec=game.cardT&&game.t-game.cardT<8;
  if(rec) return m===1?(touchMode?'card saved. Not there? tap again':'card saved. Not there? G again opens it'):m===2?'card opened in a new tab':'could not save the card here';
  return touchMode?'tap here: keep this card':'G  keep this card (PNG)'; }
function drawCardBtn(t){ if(t<3) return; text(cardLabel(),W-14,H-30,12,'rgba(255,230,200,0.8)','right',0.85); }
const CREDITS=[["FANTOR",34,'#fff0d2'],["THE WANDERER'S LIGHT",14,'#ffd59a'],['',0,''],
  ['ART',12,'#ffcf9a'],['Eh AyeC',18,'#fff6e6'],["AI-generated images from the Fantor's Long War collection,",14,'#ffe6cc'],['created and curated by the artist',14,'#ffe6cc'],['',0,''],
  ['STORY',12,'#ffcf9a'],['from the short film The Road to Fantor',15,'#fff0e0'],['',0,''],
  ['GAME DESIGN',12,'#ffcf9a'],['Eh AyeC',16,'#fff0e0'],['',0,''],
  ['CODE',12,'#ffcf9a'],['written with an AI coding assistant, then tested and tuned by playing',14,'#fff0e0'],['',0,''],
  ['VOICE',12,'#ffcf9a'],['a synthetic narrator (Piper text-to-speech, VCTK voice p237), not a human actor',14,'#fff0e0'],['',0,''],
  ['MUSIC',12,'#ffcf9a'],['an AI-assisted score',15,'#fff0e0'],['',0,''],['',0,''],
  ['Thank you for walking with the light.',17,'#fff0d6']];
function drawEnd(){
  base(); const t=game.endT; const im=baseImg('s23'); const z=1.06+0.02*Math.min(1,t/30);
  cx.fillStyle='#000'; cx.fillRect(0,0,W,H); cx.globalAlpha=clamp(t/3,0,1); if(im) cx.drawImage(im,W/2-W*z/2,H/2-H*z/2,W*z,H*z); cx.globalAlpha=1;
  cx.fillStyle='rgba(0,0,0,0.45)'; cx.fillRect(0,0,W,H);
  postBackdrop(); postFrame(); pen=hx;
  // v10: after the card, an honest credits roll over the painting, then the card again (screenshot it if you like)
  const CR0=16, crN=CREDITS.length, crEnd=CR0+1.5+(H+crN*24+40)/26, cardA=t<CR0?1:t<CR0+1.5?1-(t-CR0)/1.5:clamp((t-crEnd)/1.5,0,1);
  if(t>CR0+1.5&&t<crEnd){ const y0=H+20-(t-CR0-1.5)*26; CREDITS.forEach(([tx,sz,col],i)=>{ const y=y0+i*24; if(y<-20||y>H+20||!tx) return;
      const fa=clamp(Math.min(y-40,H-40-y)/60,0,1); text(tx,W/2,y,sz,col,'center',fa); }); }
  const a=clamp((t-1)/2,0,1)*cardA, s=game.stats;
  text(game.night?'The long night is over.':'Fantor still glows at dusk.',W/2,H*0.22,30,'#fff0d6','center',a);
  text(game.night?'THE TRUE END':'THE END',W/2,H*0.22+38,13,'#ffcf9a','center',a*0.8);
  const m=Math.floor((s.time||0)/60), sec=Math.floor((s.time||0)%60);
  const rows=[['Light gathered',s.motes],['Shadows calmed',s.calmed],['Old powers calmed',s.bosses||0],['Stones woken',s.shrines],['Lives lost',s.lost||0],['Light given away',s.given||0],['Secrets',game.night?`${[...game.relics].filter(n=>n>=DAYN).length}/3`:`${game.relics.size}/${DAYN}`],[game.night?'The Long Night':'Journey',`${m}m ${String(sec).padStart(2,'0')}s`],
    ...(game.newBest?[['Best','a new best']]:game.oldBest?[['Best',fmtT(game.oldBest,1)]]:[])];
  rows.forEach(([k,v],i)=>{ const aa=clamp((t-2-i*0.4)/1,0,1)*cardA; text(k,W/2-12,H*0.38+i*25,16,'#ffdcae','right',aa); text(String(v),W/2+12,H*0.38+i*25,16,'#fff6e6','left',aa); });
  if(game.nightNew) text('The Long Night has begun. It waits on the title.',W/2,H-56,15,'#c8d4ff','center',clamp((t-6)/1.5,0,1)*cardA);
  text("FANTOR: The Wanderer's Light  v12.1",W/2,H-10,9,'rgba(255,220,190,0.45)','center',a);
  if(t>4) text(touchMode?'Tap to return':'Press Enter to return',W/2,H-30,14,'#ffe8cc','center',0.5+0.4*Math.sin(t*2));
  drawCardBtn(t); // v11
}
const DEATH_WHY={fall:'fell',hit:'was struck',dark:'taken by the dark',ember:'burned',cold:'taken by the cold',debug:'lost'};
function deathPhrase(why){ return DEATH_WHY[why]||why; }
function deathListLine(deaths){ return deaths.map((dd,i)=>`${i+1}. ${AREAS[dd.ai].num} ${deathPhrase(dd.why)}`).join('    '); }
// One X for marks that land on each other, plus a count. The X stays on the death: it is not
// walked along the land, which would look like a loss somewhere the light had not been.
function clusterMarks(marks, gap){
  const groups=[];
  for(const m of [...marks].sort((a,b)=>a.x-b.x||a.i-b.i)){
    const g=groups.length?groups[groups.length-1]:null;
    if(g&&g.ai===m.ai&&Math.abs(m.x-g.anchor)<=gap){ g.n++; if(m.i>=g.i) g.i=m.i; if(m.last) g.last=true; }
    else groups.push({x:m.x,anchor:m.x,ai:m.ai,n:1,i:m.i,last:!!m.last,landL:m.landL,landR:m.landR});
  }
  return groups;
}
function drawGameOver(){
  base(); const t=game.goT; const im=baseImg('s15'); const z=1.1+0.02*Math.sin(t*0.3);
  cx.fillStyle='#000'; cx.fillRect(0,0,W,H); cx.globalAlpha=clamp(t/2.5,0,1)*0.5; if(im) cx.drawImage(im,W/2-W*z/2,H/2-H*z/2,W*z,H*z); cx.globalAlpha=1;
  cx.fillStyle='rgba(30,0,0,0.5)'; cx.fillRect(0,0,W,H);
  postBackdrop(); postFrame(); pen=hx;
  drawGameOverUi(t);
}
function drawGameOverUi(t){
  const cx=pen;
  const a=clamp((t-0.4)/1.2,0,1), s=game.stats;
  text('GAME OVER',W/2,H*0.15,54,'#ffe0c4','center',a);
  text(`The light went out in ${AREAS[game.goArea].title}.`,W/2,H*0.15+42,17,'#ffcfa0','center',a*0.9);
  const pr=game.prevRec; if(pr&&(game.runFar||0)>pr.far+1e-4) text('Further than ever before.',W/2,H*0.15+66,13,'#dfe6ff','center',clamp((t-2.4)/0.8,0,1)*0.9); // v10
  // v4: "where the light went out", a strip of the seven lands with a mark for every death this run
  const lands=AREAS.slice(0,7), tot=lands.reduce((q,l)=>q+l.len,0), X0=70, X1=W-70, SY=H*0.43, gap=6, span=X1-X0-gap*6;
  const a2=clamp((t-1.0)/0.9,0,1); const last=game.deaths[game.deaths.length-1]; const far=last?last.ai:game.goArea;
  let x=X0; const pos=[]; const DMd=dmGet(), DM=DMd.day.map((v,i)=>v+(DMd.night[i]|0)); if(DM.some(v=>v)) text('lights out',X0-8,SY-32,9,'rgba(255,214,180,0.55)','right',a2*0.8);
  lands.forEach((l,i)=>{ const w=span*l.len/tot; pos.push([x,w]);
    const reached=i<far?1:i===far?clamp((last?last.x:0)/l.len,0,1):0;
    cx.globalAlpha=a2; cx.fillStyle='rgba(255,220,170,0.14)'; cx.fillRect(x,SY-4,w,8);
    if(reached>0){ const g=cx.createLinearGradient(x,0,x+w,0); g.addColorStop(0,'rgba(255,200,110,0.85)'); g.addColorStop(1,'rgba(255,150,60,0.85)'); cx.fillStyle=g; cx.fillRect(x,SY-4,w*reached,8); }
    if(l.act2){ const ax=x+w*l.act2/l.len; cx.fillStyle='rgba(255,230,200,0.6)'; cx.fillRect(ax-0.5,SY-7,1.5,14); } // v6: where Act 2 begins
    if(l.boss){ const bx=x+w*l.boss.a0/l.len; cx.fillStyle=i<=far?'rgba(255,120,60,0.95)':'rgba(255,200,160,0.35)'; cx.beginPath(); cx.moveTo(bx,SY-11); cx.lineTo(bx+5,SY-6); cx.lineTo(bx,SY-1); cx.lineTo(bx-5,SY-6); cx.fill(); }
    cx.globalAlpha=1; { const dn=(DM[i]|0); if(dn) text(String(dn),x+w/2,SY-32,10,'rgba(255,214,180,0.7)','center',a2*0.8); } // v11: times the light went out, every journey kept here
    text(l.num,x+w/2,SY+20,13,i<=far?'#ffe0b8':'rgba(255,220,190,0.45)','center',a2);
    x+=w+gap; });
  if(pr&&pr.ai<7&&pos[pr.ai]){ const [lx,lw]=pos[pr.ai]; const mx=lx+lw*clamp(pr.x/AREAS[pr.ai].len,0,1), aa=a2*0.85; // v10: the furthest the light had gone before this run
    cx.save(); cx.globalAlpha=aa; cx.strokeStyle='rgba(205,218,255,0.9)'; cx.lineWidth=1.5; cx.setLineDash([2,2]); cx.beginPath(); cx.moveTo(mx,SY-9); cx.lineTo(mx,SY+9); cx.stroke(); cx.restore();
    text('furthest before',mx,SY+31,9,'rgba(205,218,255,0.8)','center',aa); }
  const markPts=game.deaths.map((dd,i)=>{ const [lx,lw]=pos[dd.ai]||pos[0]; return {i,ai:dd.ai,x:lx+lw*clamp(dd.x/Math.max(1,AREAS[dd.ai].len),0,1),last:i===game.deaths.length-1,landL:lx,landR:lx+lw}; });
  for(const g of clusterMarks(markPts,14)){ const aa=clamp((t-1.4-g.i*0.25)/0.4,0,1); const r=g.last?7:5;
    cx.save(); cx.globalAlpha=aa; cx.strokeStyle=g.last?'#ff6a3a':'#ffd0a0'; cx.lineWidth=g.last?2.5:1.8;
    cx.beginPath(); cx.moveTo(g.x-r,SY-r-14); cx.lineTo(g.x+r,SY+r-14); cx.moveTo(g.x+r,SY-r-14); cx.lineTo(g.x-r,SY+r-14); cx.stroke(); cx.restore();
    if(g.n>1){ const label='×'+g.n; let tx=g.x+r+3, al='left'; if(tx+18>g.landR-2){ tx=g.x-r-3; al='right'; } text(label,tx,SY-14,11,g.last?'#ffd0b0':'#ffe6cc',al,aa); } }
  // how close it got
  let close=''; const L=AREAS[far];
  if(last&&last.boss){ const b=last.boss; close=`${b.name}: ${b.hit} of ${b.max} blows struck${b.nph>1?`, phase ${b.phase} of ${b.nph}`:''}`; }
  else if(L&&L.boss&&last){ const pc=Math.round(100*clamp(last.x/L.boss.a0,0,1)); close=`${pc}% of the way to ${L.boss.name}`; }
  text(close,W/2,SY+48,16,'#fff0dc','center',clamp((t-1.8)/0.8,0,1));
  if(game.deaths.length) text(deathListLine(game.deaths),W/2,SY+72,12,'rgba(255,220,190,0.75)','center',clamp((t-2.0)/0.8,0,1));
  const rows=[['Light gathered',s.motes],['Shadows calmed',s.calmed],['Old powers calmed',s.bosses||0],...(game.relics.size?[['Secrets',`${game.relics.size}/${game.night?3:DAYN}`]]:[]),...(game.runNo?[[game.ember?'Ember runs begun':game.night?'Long nights begun':'Journeys begun',game.runNo]]:[])];
  rows.forEach(([k,v],i)=>{ const aa=clamp((t-2.2-i*0.2)/0.6,0,1); text(k,W/2-12,H*0.66+i*22,14,'#ffd0a8','right',aa); text(String(v),W/2+12,H*0.66+i*22,14,'#fff0e0','left',aa); });
  text(game.night?'No continues. The long night begins again at the shore.':'No continues. The journey begins again at the shore.',W/2,H-56,14,'#ffd9b8','center',clamp((t-2.5)/1,0,1)*0.85);
  if(t>1.0) text(touchMode?'Tap to begin again':'Press Enter to begin again',W/2,H-30,16,'#fff0dc','center',0.5+0.4*Math.sin(t*2.5));
  drawCardBtn(t); // v11
  text("FANTOR: The Wanderer's Light  v12.1",W/2,H-10,9,'rgba(255,220,190,0.4)','center',a); // v10
}
function drawLoading(){
  base(); cx.fillStyle='#050302'; cx.fillRect(0,0,W,H); pen=hx;
  const p=load.done/Math.max(1,load.total); text('FANTOR',W/2,H/2-30,40,'#ffe6c0','center',0.9);
  pen.fillStyle='rgba(255,210,150,0.2)'; pen.fillRect(W/2-120,H/2+10,240,4); pen.fillStyle='#ffd08a'; pen.fillRect(W/2-120,H/2+10,240*p,4);
  if(load.err) text('Could not load: '+load.err,W/2,H/2+40,12,'#f99');
}
function pushView(){
  const a=renderA, sx=camX, sy=camY, px=P.x, py=P.y;
  const vx=lerp(prevCamX,camX,a), vy=lerp(prevCamY,camY,a);
  camX=Math.round(vx*RS)/RS; camY=Math.round(vy*RS)/RS;
  P.x=lerp(prevPX,px,a); P.y=lerp(prevPY,py,a);
  drawnX=camX; drawnY=camY;
  return ()=>{ camX=sx; camY=sy; P.x=px; P.y=py; };
}
let drawnX=0, drawnY=0;
function render(){
  const pop=pushView();
  try{
    hudPrepare(); pen=cx;
    if(game.state==='loading'){ drawLoading(); return; }
    if(game.state==='title') drawTitle();
    else if(game.state==='end') drawEnd();
    else if(game.state==='gameover') drawGameOver();
    else { drawWorld(); pen=hx; if(A) drawHUD();
      if(game.state==='trans'){ const t=game.transT; const a=t<1.2?clamp(t/1.0,0,1):clamp(1-(t-1.2)/0.8,0,1); hx.fillStyle=`rgba(0,0,0,${a})`; hx.fillRect(0,0,W,H); }
      if(game.fade>0&&game.state==='play'){ hx.fillStyle=`rgba(0,0,0,${game.fade})`; hx.fillRect(0,0,W,H); } }
    if(perfOn) drawPerf();
    pen=cx;
  } finally { pop(); }
}

/* ---------------- loop ---------------- */
let last=performance.now(), acc=0, manual=false; const STEP=1/60;
game.timeScale=1;
function stepFrame(now){
  let dt=(now-last)/1000; last=now; const rawDt=dt; if(dt>0.25) dt=0.25; perfNote('frame', rawDt*1000); perfWatch(dt); if(game.slowT>0){ game.slowT-=dt; dt*=0.35; } acc+=dt*game.timeScale;
  let n=0; while(acc>=STEP&&n<40){ prevCamX=camX; prevCamY=camY; prevPX=P.x; prevPY=P.y; update(STEP); acc-=STEP; n++; for(const k in pressed) delete pressed[k]; tap=null; }
  renderA=clamp(acc/STEP,0,1);
  syncTouch();
  render();
}
function frame(now){ if(manual) return; stepFrame(now); requestAnimationFrame(frame); }
window.addEventListener('error',e=>{ game.log.push(['error',String(e.message)]); });

/* ---------------- loading ---------------- */
const load={total:0,done:0,err:null};
function track(p){ load.total++; return p.then(()=>{load.done++;},e=>{ load.err=String(e.message||e); console.error(e); }); }
const imgNames=[]; for(let i=1;i<=23;i++) imgNames.push('s'+String(i).padStart(2,'0')); imgNames.push('x1','x2','x3','x4','x5','x6','x7','x8');
const musNames=['title','shore','forest','river','kingdom','war','dark','heart','garden'];
artOn=true;
Promise.all([
  ...imgNames.map(n=>track(loadImg(n))),
  ...CHR.map(n=>track(loadSpr(n))),
  ...Object.keys(LINES).map(n=>track(fetchRaw('v_'+n,'assets/vo/'+n+'.mp3'))),
  ...musNames.map(n=>track(fetchRaw('m_'+n,'assets/music/'+n+'.mp3'))),
  fetch('g1_manifest.json').then(r=>r.ok?r.json():null).then(m=>{ if(!m) return; for(const land of m.lands||[]) for(const p of land.paintings||[]) if(p.in_pack) PACK[p.name]=p; manifestReady=true; }).catch(()=>{}),
]).then(()=>{ syncArt(); game.state='title'; if(ac) playMusic('title',2); if(Q.has('rec')) audioInit(); if(AUTO){ audioInit(); startGame(false,Q.has('night')); } });
// keep only nearby music decoded (phones have little memory)
setInterval(()=>{ if(!ac) return; const cur=A?A.d.music:'title'; const nx=A&&AREAS[game.areaI+1]?AREAS[game.areaI+1].music:'title'; const keep=new Set(['m_title','m_'+cur,'m_'+nx]);
  for(const k in bufs) if(k.startsWith('m_')&&!keep.has(k)&&!(musCur&&'m_'+musCur.name===k)){ delete bufs[k]; delete decoding[k]; } for(const k of keep) decode(k); },3000);

function playBoxes(){
  if(!A) return [];
  const boxes=[], x0=camX, y0=camY;
  const scr=(x,y,w,h,kind)=>boxes.push({kind,x:x-x0,y:y-y0,w,h});
  if(!(P.dead>0)){ const h=PH*PS, w=36; scr(P.x-w/2,P.y-h,w,h,'player'); }
  for(const e of A.enemies){
    if(e.calm||e.x<x0-8||e.x>x0+W+8) continue;
    if(e.t==='wisp') scr(e.x-16,e.y-16,32,32,'enemy');
    else { const h=e.h||60; scr(e.x-h*0.28,e.y-h,h*0.56,h,'enemy'); }
  }
  if(A.boss&&!A.boss.calm&&A.boss.st!=='sleep'&&A.boss.x>x0-40&&A.boss.x<x0+W+40){ const B=A.boss, h=B.h, w=h*0.5; scr(B.x-w/2,B.y-h,w,h,'enemy'); }
  for(const hz of A.haz){
    if(hz.x<x0||hz.x>x0+W) continue;
    const gy=A.d.gy(hz.x), top=hz.k==='drop'&&hz.fall?hz.ry-16:(gy<1e8?gy:BASE)-(hz.act?120:20), hh=hz.k==='drop'&&hz.fall?36:(hz.act?130:24);
    scr(hz.x-14,top,28,hh,'hazard');
  }
  for(const s of A.shots){ if(s.wait>0||s.x<x0||s.x>x0+W) continue; const r=(s.r||10)+6; scr(s.x-r,s.y-r,r*2,r*2,'shot'); }
  for(const g of A.d.gaps) for(const edge of [g[0],g[1]]){
    if(edge<x0+4||edge>x0+W-4) continue;
    const y=A.d.gy(edge===g[0]?edge-1:edge+1); if(!(y<1e8)) continue;
    boxes.push({kind:'gap',x:edge-x0-4,y:y-y0-3,w:8,h:6});
  }
  return boxes;
}
/* ---------------- hooks for recording and testing ---------------- */
/*@DEV*/window.fantorRec={
  start(){ const vs=cv.captureStream(30); const tracks=[...vs.getVideoTracks()]; if(recDest) tracks.push(...recDest.stream.getAudioTracks());
    this.chunks=[]; this.mr=new MediaRecorder(new MediaStream(tracks),{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:5000000}); this.mr.ondataavailable=e=>{ if(e.data.size) this.chunks.push(e.data); }; this.mr.start(1000); },
  pause(){ this.mr&&this.mr.state==='recording'&&this.mr.pause(); }, resume(){ this.mr&&this.mr.state==='paused'&&this.mr.resume(); },
  stop(){ return new Promise(res=>{ this.mr.onstop=async()=>{ const b=new Blob(this.chunks,{type:'video/webm'}); const buf=new Uint8Array(await b.arrayBuffer()); let s=''; for(let i=0;i<buf.length;i+=0x8000) s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000)); res(btoa(s)); }; this.mr.stop(); }); }
};
window.fantorTest={ deathPhrase, deathListLine, clusterMarks, backdropPlan, cardZone, cardLabel, dmGet, recGet, subLift, subBox,
  shines:()=>Math.floor(Math.max(0,P.light)/SHINE_COST),
  consts:()=>({START_LIVES,MAX_LIVES,GRAV,JV,SPD,PH,PW,SHINE_COST,LIGHT_CAP,COVER_H,COVER_HITS,HOP_V}),
  areas:()=>AREAS.map(a=>({key:a.key,imgs:a.imgs,gaps:a.gaps,len:a.len})),
  nights:()=>NIGHT.map(a=>({key:a.key,imgs:a.imgs,gaps:a.gaps,len:a.len})),
  hint:()=>A&&{text:A.hint||'',key:A.hintKey||'',wait:(A.hintQ&&A.hintQ[0]&&A.hintQ[0].key)||'',q:(A.hintQ||[]).map(h=>h.key),ttl:A.hintT||0},
  heard:()=>[...vo.heard], queue:()=>vo.queue.map(q=>q.id),
  subNow:()=>{ const lift=!!vo.lift, legend=!!vo.legend; const ls=vo.sub?wrap(vo.sub,lift?W*0.58:W*0.78,17):[]; return {lift,legend,lines:ls.length,box:subBox(Math.max(1,ls.length),lift,legend)}; },
  titleFade,
  folk:()=>A?A.folk.map(f=>({name:f.name,x:f.x,said:!!f.said,reach:f.reach||120})):[] };
window.fantorDebug={ boxes:playBoxes, gfx:()=>({gfx:SET.gfx,tier:activeTier(),auto:autoTier,rs:RS,drop:rsDrop,gl:glLabel(),lite:gfxLite()?1:0,para:glPara,depth:Object.keys(DEPTH),perf:perfShow}), setGfx(n){ applyGfx(n); }, glLose(){ if(glCv){ try{ const ev=new Event('webglcontextlost'); glCv.dispatchEvent(ev); }catch(_){} } glLost(); }, perfStep(){ return perfStepDown(); }, drawn:()=>[drawnX,drawnY], art:()=>Object.keys(IMG).filter(k=>k.indexOf('@1920')>0||/_L\d$/.test(k)), manual(v){ manual=!!v; if(!manual){ last=performance.now(); requestAnimationFrame(frame); } }, frame:stepFrame, cam:()=>[camX,camY], line:(id)=>{ if(!id){ vo.sub=''; vo.subA=0; vo.lift=false; vo.legend=false; vo.queue.length=0; if(vo.cur){ try{ vo.cur.src&&vo.cur.src.stop(); }catch(_){} vo.cur=null; } return; } vo.queue.length=0; if(vo.cur){ try{ vo.cur.src&&vo.cur.src.stop(); }catch(_){} vo.cur=null; } vo.sub=LINES[id]||String(id); vo.subA=1; vo.lift=subLift(); vo.legend=!!(game.legendT>0); }, kill:()=>{ if(game.state==='play'&&!P.dead){ const g=GOD; GOD=false; loseLife('debug'); GOD=g; } }, setLives:(n)=>{ game.lives=n; }, god:(v)=>{ GOD=!!v; }, boss:()=>A&&A.boss&&{st:A.boss.st,hp:A.boss.hp,calm:A.boss.calm,x:Math.round(A.boss.x),phase:A.boss.phase,atk:A.boss.atk}, bossHp:(n)=>{ const B=A.boss; B.hp=n; while(B.phase<B.nph&&B.hp<=B.th[B.phase-1]) bossPhase(); }, deaths:()=>game.deaths, tp:(x,light)=>{ P.x=x; P.y=A.d.gy(x); P.vy=0; camX=clamp(x-W*0.36,0,A.d.len-W); for(const t of A.trig) if(t.x<x) { t.done=true; } for(const fo of A.folk) if(fo.x<x) fo.said=true; vo.queue.length=0; if(vo.cur){ try{ vo.cur.src&&vo.cur.src.stop(); }catch(_){} vo.cur.end=0; } if(light!==undefined) P.light=light; holdView(); }, goArea, setLight:(n)=>{P.light=n;}, enterSecret, relics:()=>[...game.relics], giveRelics:(n)=>{ for(let i=0;i<n;i++) game.relics.add(i); }, areas:AREAS, nareas:NIGHT, act:()=>A&&A.act, night:()=>game.night, splits:()=>game.splits, store, moves:(n)=>{ if(n!==undefined) game.moves=n; return game.moves; }, P:()=>P, A:()=>A, state:()=>({act:A&&A.act,night:game.night,moves:game.moves,ember:!!P.ember,secret:A&&A.d.secret||0,relics:game.relics.size,audio:ac?ac.state:null,menu:menuOpen,veil:!!game.veil,paused:!!game.paused,rs:RS,cw:cv.width,ch:cv.height,state:game.state,area:game.areaI,x:Math.round(P.x),y:Math.round(P.y),light:P.light,lives:game.lives,dead:P.dead,stats:game.stats,throne:game.throne&&game.throne.phase,vo:vo.cur&&vo.cur.id,boss:A&&A.boss?{st:A.boss.st,hp:A.boss.hp,calm:A.boss.calm,phase:A.boss.phase}:null,shrine:A&&A.shrine?{need:A.shrine.need,awake:A.shrine.awake}:null}) };/*@/DEV*/
requestAnimationFrame(frame);
})();
