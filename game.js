/* FANTOR · The Wanderer's Light
   A small side-scrolling journey through the paintings of "The Road to Fantor".
   Plain canvas + WebAudio, no dependencies. */
'use strict';
(function(){
const W=854, H=480;                       // VHS-ish 480 lines
const cv=document.getElementById('game'), cx=cv.getContext('2d');
const Q=new URLSearchParams(location.search);
const AUTO=Q.has('auto'), DEBUG=Q.has('debug'), START_AREA=+(Q.get('area')||0), MUTE=Q.has('mute');
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, sm=t=>t*t*(3-2*t);
function rngf(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

/* ---------------- layout / resize ---------------- */
function fit(){const vw=innerWidth, vh=innerHeight, s=Math.min(vw/W,vh/H);
  cv.style.width=Math.floor(W*s)+'px'; cv.style.height=Math.floor(H*s)+'px';}
addEventListener('resize',fit); fit();

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
 'g10':'The river does not wait. But it always comes back.'
};

/* ---------------- audio ---------------- */
const AC=window.AudioContext||window.webkitAudioContext;
let ac=null, master, musG, voG, sfxG, recDest=null;
const bufs={}, raw={};
function audioInit(){
  if(ac) { if(ac.state==='suspended') ac.resume(); return; }
  try{ ac=new AC(); }catch(e){ return; }
  const comp=ac.createDynamicsCompressor(); comp.threshold.value=-10; comp.knee.value=6; comp.ratio.value=8; comp.attack.value=0.004; comp.release.value=0.2; comp.connect(ac.destination);
  master=ac.createGain(); master.gain.value=MUTE?0:0.8; master.connect(comp);
  musG=ac.createGain(); musG.gain.value=0.55; musG.connect(master);
  voG=ac.createGain(); voG.gain.value=1.0; voG.connect(master);
  sfxG=ac.createGain(); sfxG.gain.value=0.5; sfxG.connect(master);
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
    const g=ac.createGain(); g.gain.value=0; s.connect(g); g.connect(musG);
    const t=ac.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(1,t+fade);
    s.start(t);
    if(musCur){ const o=musCur; o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value,t); o.g.gain.linearRampToValueAtTime(0,t+fade); o.s.stop(t+fade+0.1); }
    musCur={s,g,name};
  };
  const p=decode('m_'+name); if(p) p.then(go);
}
function stopMusic(fade=2){ if(!ac||!musCur) return; const t=ac.currentTime,o=musCur; o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value,t); o.g.gain.linearRampToValueAtTime(0,t+fade); o.s.stop(t+fade+.1); musCur=null; musName=''; }
// narration queue
const vo={queue:[],cur:null,sub:'',subA:0,gap:0,heard:new Set()};
function say(id,opt={}){
  if(!opt.again && vo.heard.has(id)) return; vo.heard.add(id);
  vo.queue.push({id,delay:opt.delay||0,cb:opt.cb});
}
function voUpdate(dt,now){
  if(vo.cur){ if(now>=vo.cur.end){ const c=vo.cur; vo.cur=null; vo.gap=0.5; if(c.cb) c.cb(); } }
  if(!vo.cur){ if(vo.gap>0){vo.gap-=dt;} else if(vo.queue.length){ const q=vo.queue[0]; if(q.delay>0){q.delay-=dt;} else { vo.queue.shift(); startLine(q,now);} } }
  const want=vo.cur?1:0; vo.subA+= (want-vo.subA)*Math.min(1,dt*(want?6:2.5));
  if(ac&&musG){ const target=(vo.cur?0.30:0.55); musG.gain.setTargetAtTime(target,ac.currentTime,0.25); }
}
function startLine(q,now){
  const b=bufs['v_'+q.id]; let dur=2.5+(LINES[q.id]||'').length*0.06;
  if(ac&&b){ const s=ac.createBufferSource(); s.buffer=b; s.connect(voG); s.start(); dur=b.duration+0.2; }
  vo.cur={id:q.id,end:now+dur,cb:q.cb}; vo.sub=LINES[q.id]||'';
  game.log.push(['vo',q.id,+now.toFixed(1)]);
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
  step(){ noise(0.07,900,400,0.022,0.9); },
  pulse(){ noise(0.9,300,3200,0.12,0.9); tone(220,1.2,'sine',0.12); tone(330,1.4,'sine',0.08,0.05); tone(440,1.6,'triangle',0.04,0.1); },
  fizzle(){ tone(110,0.5,'triangle',0.12); tone(104,0.6,'sine',0.1,0.05); },
  hurt(){ tone(70,0.5,'sine',0.35); noise(0.4,800,150,0.12,0.8); tone(98,0.4,'sawtooth',0.03); },
  calm(){ [523.3,659.3,784,1046.5].forEach((f,i)=>tone(f,1.6,'sine',0.07,i*0.07)); },
  shrine(){ [146.8,220,293.7,370,440,587.3].forEach((f,i)=>tone(f,3.5,'sine',0.09,i*0.12)); noise(2.5,200,4000,0.06,0.6); },
  lantern(){ tone(1318.5,0.9,'sine',0.08); tone(1975.5,0.6,'sine',0.03,0.04); },
  splash(){ noise(0.8,1800,300,0.18,0.6); },
  veil(){ noise(2.4,150,2500,0.1,0.5); tone(293.7,2.5,'sine',0.06); },
  ember(){ noise(0.25,3000,900,0.06,1.5); },
  release(){ for(let i=0;i<14;i++) tone(PENTA[i%PENTA.length]*(i>8?2:1),2.2,'sine',0.05,i*0.11,(Math.random()-.5)); noise(5,120,5000,0.12,0.5); },
};

/* ---------------- images ---------------- */
const IMG={};
function loadImg(n){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>{IMG[n]=i;res();}; i.onerror=()=>rej(new Error(n)); i.src='assets/img/'+n+'.webp'; }); }
// parallax bands cut from each painting: the lower parts move faster than the sky
const bandCache={};
function bands(n){
  if(bandCache[n]) return bandCache[n];
  const im=IMG[n]; const bw=960, bh=540, out=[];
  for(const [top,feather] of [[0.40,0.16],[0.64,0.12]]){
    const c=document.createElement('canvas'); c.width=bw; c.height=bh; const g=c.getContext('2d');
    g.drawImage(im,0,0,bw,bh); g.globalCompositeOperation='destination-in';
    const gr=g.createLinearGradient(0,0,0,bh); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(Math.max(0,top-feather),'rgba(0,0,0,0)'); gr.addColorStop(top,'rgba(0,0,0,1)'); gr.addColorStop(1,'rgba(0,0,0,1)');
    g.fillStyle=gr; g.fillRect(0,0,bw,bh); out.push(c);
  }
  bandCache[n]=out; return out;
}
function dropBands(keep){ for(const k in bandCache) if(!keep.includes(k)) delete bandCache[k]; }

/* ---------------- input ---------------- */
const keys={}, pressed={};
const KEYMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'j',KeyW:'j',Space:'j',KeyZ:'j',KeyX:'s',KeyE:'s',ShiftLeft:'s',ShiftRight:'s',KeyK:'s',Enter:'ok',KeyC:'c',KeyP:'p',Escape:'p'};
addEventListener('keydown',e=>{ const k=KEYMAP[e.code]; audioInit(); if(k){ if(!keys[k]) pressed[k]=true; keys[k]=true; e.preventDefault(); } });
addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k){ keys[k]=false; e.preventDefault(); } });
addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
const touchEl=document.getElementById('touch');
let touchMode=false;
function bindBtn(id,k){ const el=document.getElementById(id); const ids=new Set();
  const dn=e=>{ e.preventDefault(); audioInit(); ids.add(e.pointerId); if(!keys[k]) pressed[k]=true; keys[k]=true; el.classList.add('down'); try{el.setPointerCapture(e.pointerId);}catch(_){} };
  const up=e=>{ ids.delete(e.pointerId); if(!ids.size){ keys[k]=false; el.classList.remove('down'); } };
  el.addEventListener('pointerdown',dn); el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); el.addEventListener('lostpointercapture',up); }
bindBtn('bl','l'); bindBtn('br','r'); bindBtn('bj','j'); bindBtn('bs','s');
function enableTouch(){ if(touchMode) return; touchMode=true; touchEl.classList.add('on'); }
if(matchMedia('(pointer:coarse)').matches) enableTouch();
addEventListener('touchstart',()=>enableTouch(),{passive:true});
// taps on the canvas (title / end screens)
let tap=null;
cv.addEventListener('pointerdown',e=>{ audioInit(); const r=cv.getBoundingClientRect(); tap={x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}; if(e.pointerType==='touch') enableTouch(); });

/* ---------------- areas ---------------- */
const BASE=392;
function makeArea(def){
  const a=Object.assign({gaps:[],solids:[],plats:[],motes:[],trig:[],enemies:[],lanterns:[],braziers:[],npcs:0,embers:false,drain:0,flats:[],waves:[[12,0.0042,0],[6,0.011,1.3]]},def);
  if(a.shrine) a.flats.push([a.shrine.x,140]); a.flats.push([0,200],[a.len,220]);
  for(const g of a.gaps){ a.flats.push([g[0],70],[g[1],70]); }
  for(const s of a.solids){ a.flats.push([s.x+s.w/2,s.w/2+40]); }
  if(a.throne) a.flats.push([a.throne.x,400]); if(a.bench) a.flats.push([a.bench.x,200]);
  a.flatAt=(x)=>{ let f=1; for(const [c,r] of a.flats) { const d=Math.abs(x-c); if(d<r) f=Math.min(f,sm(d/r)); } return f; };
  a.gy=(x)=>{ for(const g of a.gaps) if(x>g[0]&&x<g[1]) return 1e9; let y=BASE; const f=a.flatAt(x); for(const [amp,fr,ph] of a.waves) y-=amp*Math.sin(x*fr+ph)*f; return y; };
  return a;
}
function row(x0,n,dx,h){ const r=[]; for(let i=0;i<n;i++) r.push([x0+i*dx,h]); return r; }
function arc(x0,n,dx,h0,h1){ const r=[]; for(let i=0;i<n;i++){ const t=n>1?i/(n-1):0; r.push([x0+i*dx,h0+(h1-h0)*Math.sin(t*Math.PI)]); } return r; }

const AREAS=[
 makeArea({key:'shore',num:'I',title:'The Shore of Wakes',music:'shore',len:2700,dark:0.22,darkCol:'20,10,24',ground:['#4a2f1c','#140b08'],rim:'#f0c080',fg:'shore',
  imgs:[['s01',0],['s02',1000],['s03',1950]],
  solids:[{x:860,w:46,h:26,k:'rock'},{x:1500,w:60,h:30,k:'rock'},{x:1530,w:30,h:54,k:'rock'}],
  motes:[...row(300,4,40,24),...arc(640,5,38,30,90),...row(1050,3,45,24),...arc(1380,3,60,60,100),...row(1700,4,40,26),...arc(2000,3,40,60,100)],
  shrine:{x:2300,need:6,lines:['03']},
  trig:[{x:40,line:'01',delay:1.2},{x:560,line:'02'},{x:100,hint:'move',ttl:6},{x:760,hint:'jump',ttl:6},{x:2120,hint:'offer',ttl:8}],
 }),
 makeArea({key:'forest',num:'II',title:'The Forest of Bent Trees',music:'forest',len:3300,dark:0.42,darkCol:'16,12,8',ground:['#3b2a16','#0f0a05'],rim:'#e8c27a',fg:'forest',
  imgs:[['s04',0],['s05',1500]],waves:[[16,0.0035,0.5],[7,0.012,2]],
  solids:[{x:520,w:70,h:22,k:'root'},{x:1100,w:40,h:30,k:'root'},{x:1680,w:90,h:24,k:'root'},{x:2380,w:50,h:36,k:'root'}],
  plats:[{x:760,y:BASE-62,w:100,k:'branch'},{x:900,y:BASE-118,w:80,k:'branch'},{x:1880,y:BASE-62,w:110,k:'branch'},{x:2050,y:BASE-118,w:90,k:'branch'}],
  motes:[...row(240,3,40,24),...row(780,2,40,92),...row(915,2,35,148),...row(1240,4,42,24),...arc(1500,3,40,40,80),...row(1900,3,35,92),...row(2060,2,40,148),...row(2500,4,40,24),...row(2950,2,40,24)],
  enemies:[{t:'wisp',x:1350},{t:'wisp',x:2200},{t:'wisp',x:2700}],
  shrine:{x:2900,need:10,lines:['g02']},
  trig:[{x:60,line:'05',delay:0.8},{x:1180,hint:'shine',ttl:8}],
 }),
 makeArea({key:'river',num:'III',title:'The Silver River Road',music:'river',len:3500,dark:0.3,darkCol:'10,16,26',ground:['#3c3a34','#0d0c0b'],rim:'#e9e2c8',fg:'river',
  imgs:[['s06',0],['s07',2300]],waves:[[8,0.004,0],[4,0.013,1]],
  gaps:[[620,800],[1250,1560],[2050,2400]],
  plats:[{x:682,y:BASE+4,w:56,k:'stone'},{x:1312,y:BASE-8,w:54,k:'stone'},{x:1405,y:BASE-30,w:46,k:'stone'},{x:1490,y:BASE-8,w:46,k:'stone'},
         {x:2110,y:BASE+2,w:100,k:'log',mx:120,per:7}],
  motes:[...row(300,3,45,24),...arc(640,4,48,40,70),...row(1000,3,45,24),...arc(1300,5,55,50,90),...row(1750,3,40,24),...row(2600,4,45,24),...row(2870,3,45,24)],
  enemies:[{t:'wisp',x:1800},{t:'wisp',x:2800}],
  shrine:{x:3050,need:14,lines:['07']},
  trig:[{x:60,line:'06',delay:0.8},{x:500,hint:'river',ttl:6}],
 }),
 makeArea({key:'kingdom',num:'IV',title:'The Golden Kingdom',music:'kingdom',len:3700,dark:0.28,darkCol:'24,14,10',ground:['#5a3a20','#160d06'],rim:'#ffd08a',fg:'kingdom',
  imgs:[['s08',0],['s09',1300],['s10',2600]],waves:[[6,0.004,0],[3,0.015,1]],
  solids:[{x:700,w:120,h:24,k:'step'},{x:730,w:60,h:48,k:'step'},{x:1700,w:70,h:30,k:'cart'},{x:2700,w:80,h:24,k:'step'},{x:2720,w:40,h:48,k:'step'}],
  plats:[{x:1000,y:BASE-64,w:120,k:'balcony'},{x:1180,y:BASE-120,w:90,k:'balcony'},{x:2200,y:BASE-64,w:120,k:'balcony'}],
  lanterns:[400,880,1120,1450,1900,2150,2500,2950,3250],
  motes:[...row(250,3,45,24),...row(1010,3,40,94),...row(1190,2,40,150),...row(1500,4,45,24),...row(2210,3,40,94),...row(2400,4,40,24),...arc(2780,3,40,60,100),...row(3020,4,40,24)],
  npcs:16, enemies:[{t:'wisp',x:2050}],
  shrine:{x:3400,need:16,lines:['g09','10']},
  trig:[{x:60,line:'08',delay:0.8},{x:1350,line:'09'},{x:330,hint:'lantern',ttl:7}],
 }),
 makeArea({key:'war',num:'V',title:'The Frygar Camp',music:'war',len:3900,dark:0.4,darkCol:'40,6,4',ground:['#4a1d12','#120504'],rim:'#ff9a5a',fg:'war',
  imgs:[['s11',0],['s12',1000],['s13',2000],['s14',2900]],waves:[[10,0.004,0.3],[5,0.012,2]],
  solids:[{x:900,w:50,h:30,k:'crate'},{x:1600,w:80,h:26,k:'crate'},{x:1630,w:40,h:50,k:'crate'},{x:2600,w:60,h:32,k:'crate'}],
  plats:[{x:1100,y:BASE-64,w:100,k:'plank'},{x:2300,y:BASE-66,w:110,k:'plank'}],
  motes:[...row(250,4,40,24),...row(1110,3,35,94),...row(1350,3,45,24),...arc(1600,3,40,80,110),...row(2000,4,40,24),...row(2310,3,40,96),...row(2800,4,40,24),...row(3200,4,40,24)],
  enemies:[{t:'frygar',x:1250,r:140},{t:'frygar',x:1900,r:160},{t:'frygar',x:2450,r:120},{t:'frygar',x:3050,r:170},{t:'wisp',x:2200}],
  embers:true, shrine:{x:3550,need:16,lines:['13']},
  trig:[{x:60,line:'11',delay:0.8},{x:950,hint:'frygar',ttl:7}],
 }),
 makeArea({key:'dark',num:'VI',title:'Where the Old Things Watch',music:'dark',len:4100,dark:0.9,darkCol:'6,3,6',ground:['#2a1612','#050203'],rim:'#c06040',fg:'dark',
  imgs:[['s15',0],['s16',2100]],waves:[[14,0.0038,1],[6,0.013,0]],
  gaps:[[1150,1310],[2700,2860]],
  plats:[{x:1200,y:BASE-16,w:60,k:'stone'},{x:2750,y:BASE-22,w:60,k:'stone'}],
  braziers:[700,2000,3250],
  motes:[...row(250,4,40,24),...row(800,3,40,24),...arc(1170,3,60,50,80),...row(1500,4,40,24),...row(2150,4,40,24),...arc(2720,3,60,60,90),...row(3000,4,40,24),...row(3400,4,40,24)],
  enemies:[{t:'stalker',x:1000},{t:'stalker',x:1800},{t:'stalker',x:2480},{t:'stalker',x:3100},{t:'wisp',x:1550},{t:'wisp',x:3550}],
  drain:6, shrine:{x:3750,need:12,lines:['16']},
  trig:[{x:60,line:'15',delay:0.8},{x:480,line:'g05'},{x:560,hint:'brazier',ttl:7}],
 }),
 makeArea({key:'heart',num:'VII',title:'The Heart of Fantor',music:'heart',len:3100,dark:0.12,darkCol:'40,24,6',ground:['#7a5222','#2a1606'],rim:'#fff0b0',fg:'heart',
  imgs:[['s17',0],['s18',1300],['s19',2300]],waves:[[5,0.004,0],[3,0.012,0]],
  solids:[{x:2420,w:320,h:26,k:'gold'},{x:2470,w:270,h:52,k:'gold'},{x:2520,w:220,h:78,k:'gold'},{x:2570,w:170,h:104,k:'gold'}],
  plats:[{x:700,y:BASE-64,w:100,k:'shard'},{x:880,y:BASE-120,w:90,k:'shard'},{x:1600,y:BASE-64,w:110,k:'shard'},{x:1780,y:BASE-120,w:90,k:'shard'}],
  motes:[...row(200,5,40,24),...row(710,3,35,94),...row(890,3,30,150),...row(1150,5,40,24),...row(1610,3,40,94),...row(1790,3,30,150),...row(2050,6,40,24)],
  throne:{x:2660},
  trig:[{x:60,line:'17',delay:1.0},{x:1300,line:'18'}],
 }),
 makeArea({key:'garden',num:'',title:'Dusk',music:'garden',len:2600,dark:0.0,darkCol:'0,0,0',ground:['#3a1a1c','#0e0607'],rim:'#ffb090',fg:'garden',
  imgs:[['s22',0],['s23',1500]],waves:[[6,0.004,0],[3,0.012,1]],
  bench:{x:2200},
 }),
];
const HINTS={
  move:()=>touchMode?'◀ ▶  walk':'← →  walk',
  jump:()=>touchMode?'⤒  jump':'↑ / Space  jump',
  offer:()=>touchMode?'Stand at the stone and tap ✦ to offer your light':'Stand at the stone and press X to offer your light',
  shine:()=>touchMode?'✦  shine: calms shadows (costs 2 light)':'X  shine: calms shadows (costs 2 light)',
  river:()=>'Leap the stones. The river only sends you back.',
  lantern:()=>'Shine near the dark lanterns to light them',
  frygar:()=>'The Frygars want your light. Calm them with a shine, or slip past.',
  brazier:()=>'The dark drinks light. Shine at braziers to keep it.',
};

/* ---------------- game state ---------------- */
const game={state:'loading',t:0,areaI:0,log:[],stats:{motes:0,calmed:0,lanterns:0,given:0,shrines:0,start:0,falls:0,hits:0},flash:0,fade:0,title:{a:0},cine:null,throne:null,ending:null,paused:false};
window.FANTOR=game;
const P={x:80,y:BASE,vx:0,vy:0,face:1,ground:true,coy:0,buf:0,walk:0,light:3,hurtT:0,plat:null,stepT:0,sit:0,glow:1,safeX:80,cp:80,ctrl:true,auto:AUTO};
game.P=P;
let A=null; // current area runtime
let camX=0, camY=0;
function setupArea(i){
  game.areaI=i; const d=AREAS[i];
  const gyOr=(x)=>{ const g=d.gy(x); return g<1e8?g:BASE; };
  A={d,motes:d.motes.map(([x,h])=>({x,y:gyOr(x)-h,got:false,ph:Math.random()*TAU})),
     enemies:d.enemies.map(e=>({...e,x0:e.x,y:gyOr(e.x)-(e.t==='wisp'?60:0),vx:0,calm:false,ct:0,ph:Math.random()*TAU,hp:e.t==='stalker'?2:1,dir:1,hit:0})),
     lanterns:d.lanterns.map(x=>({x,lit:false,t:0})), braziers:d.braziers.map(x=>({x,lit:false,t:0})),
     shrine:d.shrine?{...d.shrine,awake:false,t:0}:null, veil:d.shrine?1:0, trig:d.trig.map(t=>({...t,done:false})),
     plats:d.plats.map(p=>{ const g=d.gy(p.x+p.w/2); const y=g<1e8?g-(BASE-p.y):p.y; return {...p,y,x0:p.x,dx:0}; }),
     particles:[], rings:[], streams:[], hint:null, hintT:0, npcs:[], embers:[], drainT:0, rng:rngf(1234+i*77)};
  const r=rngf(99+i);
  for(let k=0;k<d.npcs;k++) A.npcs.push({x:r()*d.len,s:0.55+r()*0.25,v:14+r()*16,ph:r()*TAU,lit:false});
  P.x=70; P.y=d.gy(70); P.vx=0; P.vy=0; P.ground=true; P.safeX=70; P.cp=70; P.plat=null; P.ctrl=true; P.sit=0; P.hurtT=0;
  if(i===7) P.light=0;
  if(!d.throne) game.throne=null;
  camX=0; camY=0;
  playMusic(d.music);
  const keep=d.imgs.map(x=>x[0]); dropBands(keep); keep.forEach(bands);
  game.areaTitle=4.0;
  game.log.push(['area',i,+game.t.toFixed(1)]);
  try{ localStorage.setItem('fantor_area',String(Math.min(6,Math.max(+localStorage.getItem('fantor_area')||0,i)))); }catch(_){}
}

/* ---------------- physics ---------------- */
const GRAV=980, JV=362, SPD=142, PH=54, PW=16;
function solidTop(s){ return A.d.gy(s.x+s.w/2)-s.h; }
function floorAt(x,prevFeet){
  let gy=A.d.gy(x), plat=null;
  for(const s of A.d.solids){ if(x>s.x-PW/2&&x<s.x+s.w+PW/2){ const top=solidTop(s); if(prevFeet<=top+6&&top<gy){ gy=top; plat=null; } } }
  for(const p of A.plats){ if(x>p.x-4&&x<p.x+p.w+4){ if(prevFeet<=p.y+5&&p.y<gy){ gy=p.y; plat=p; } } }
  return [gy,plat];
}
function blockedX(nx,feet){
  if(A.veil>0.5 && nx>A.d.len-120) return true;
  if(nx<12) return true;
  if(nx>A.d.len-8) return false;
  const g=A.d.gy(nx); if(g<1e8 && feet>g+10) return true;
  for(const s of A.d.solids){ if(nx>s.x-PW/2&&nx<s.x+s.w+PW/2 && feet>solidTop(s)+4) return true; }
  return false;
}
function stepPlayer(dt,inp){
  const d=A.d;
  let want=0; if(P.ctrl){ if(inp.l) want-=1; if(inp.r) want+=1; }
  const spd=SPD*(P.light<=0&&game.areaI<7?0.85:1)*(P.hurtT>0.6?0.4:1);
  const acc=P.ground?1400:900;
  if(want){ P.vx+=want*acc*dt; P.face=want; } else { const f=P.ground?1600:500; P.vx-=Math.sign(P.vx)*Math.min(Math.abs(P.vx),f*dt); }
  if(P.hurtT<=0.6) P.vx=clamp(P.vx,-spd,spd);
  if(P.hurtT>0) P.hurtT-=dt;
  P.coy=P.ground?0.1:P.coy-dt; P.buf=inp.jp?0.13:P.buf-dt;
  if(P.ctrl&&P.buf>0&&P.coy>0){ P.vy=-JV; P.ground=false; P.coy=0; P.buf=0; P.plat=null; sfx.jump(); }
  if(!inp.j&&P.vy<-120) P.vy+= GRAV*1.4*dt; // variable jump height
  P.vy+=GRAV*dt; if(P.vy>800) P.vy=800;
  if(P.plat&&P.ground) P.x+=P.plat.dx; // ride moving platforms
  let nx=P.x+P.vx*dt;
  if(blockedX(nx,P.y)) { nx=P.x; P.vx=0; }
  P.x=nx;
  const prev=P.y; let ny=P.y+P.vy*dt;
  const [fy,plat]=floorAt(P.x,prev);
  if(P.vy>=0&&ny>=fy&&prev<=fy+12){ if(!P.ground&&P.vy>250) sfx.land(); ny=fy; P.vy=0; P.ground=true; P.plat=plat; }
  else if(P.ground&&P.vy>=0&&fy-ny<14&&fy>ny){ ny=fy; P.vy=0; P.plat=plat; }
  else { P.ground=false; P.plat=null; }
  P.y=ny;
  if(P.ground&&!plat&&d.gy(P.x)<1e8){ let nearGap=false; for(const g of d.gaps) if(P.x>g[0]-50&&P.x<g[1]+30) nearGap=true; if(!nearGap) P.safeX=P.x; }
  if(P.ground&&Math.abs(P.vx)>20){ P.walk+=dt*Math.abs(P.vx)/24; P.stepT-=dt; if(P.stepT<=0){ sfx.step(); P.stepT=0.34; } }
  else P.walk+=(Math.round(P.walk/Math.PI)*Math.PI-P.walk)*Math.min(1,dt*8);
  if(P.y>H+160) fall();
}
function fall(){
  game.stats.falls++; sfx.splash(); game.log.push(['fall',game.areaI,P.x|0]);
  if(A.d.key==='river') say('g10');
  P.light=Math.max(0,P.light-1);
  respawn(P.safeX);
}
function respawn(x){ game.fade=0.9; P.x=x; P.y=A.d.gy(x); P.vx=0; P.vy=0; P.ground=true; P.plat=null; P.hurtT=0.6; }

/* ---------------- light actions ---------------- */
function shine(){
  const s=A.shrine;
  if(s&&!s.awake&&Math.abs(P.x-s.x)<55){
    if(P.light>=s.need) wakeShrine(); else { sfx.fizzle(); showHint(`The stone wants ${s.need} light. You carry ${P.light}.`,3.5); }
    return;
  }
  if(P.light<2){ sfx.fizzle(); showHint('Not enough light to shine. Gather motes.',2.5); return; }
  P.light-=2; sfx.pulse(); game.log.push(['shine',game.areaI,P.x|0]);
  const R=150+Math.min(P.light,20)*3;
  A.rings.push({x:P.x,y:P.y-PH+8,r:10,R,t:0});
  for(const e of A.enemies){ if(e.calm) continue; const dd=Math.hypot(e.x-P.x,(e.t==='wisp'?e.y:e.y-40)-(P.y-30)); if(dd<R){ e.hp--; e.hit=0.4; if(e.hp<=0) calmEnemy(e); else e.vx=Math.sign(e.x-P.x||1)*160; } }
  for(const l of A.lanterns){ if(!l.lit&&Math.abs(l.x-P.x)<R){ l.lit=true; l.t=0; game.stats.lanterns++; sfx.lantern(); say('g03'); } }
  for(const b of A.braziers){ if(!b.lit&&Math.abs(b.x-P.x)<R){ b.lit=true; b.t=0; P.cp=b.x; sfx.lantern(); } }
  for(const n of A.npcs){ if(Math.abs(n.x-P.x)<R) n.lit=true; }
}
function calmEnemy(e){
  e.calm=true; e.ct=0; game.stats.calmed++; sfx.calm(); say('g04');
  const n=e.t==='stalker'?3:e.t==='frygar'?3:2;
  for(let i=0;i<n;i++){ const x=e.x+(i-(n-1)/2)*26; const g=A.d.gy(x); A.motes.push({x,y:(g<1e8?g:BASE)-30-i*6,got:false,ph:Math.random()*TAU,born:0}); }
}
function wakeShrine(){
  const s=A.shrine; s.awake=true; s.t=0; game.stats.shrines++;
  P.light-=s.need; sfx.shrine(); game.log.push(['shrine',game.areaI,+game.t.toFixed(1)]);
  for(let i=0;i<s.need;i++) A.streams.push({x0:P.x,y0:P.y-PH,x1:s.x,y1:A.d.gy(s.x)-48,t:-i*0.08});
  s.lines.forEach((l,i)=>say(l,{delay:i?0:0.8}));
  setTimeout(()=>sfx.veil(),1200);
  P.cp=s.x;
  if(P.light<2) P.light=2; // a little warmth to carry on
}
function hurt(e,amt){
  if(P.hurtT>0) return;
  game.stats.hits++;
  P.hurtT=1.0; P.vx=Math.sign(P.x-e.x||1)*260; P.vy=-200; P.ground=false; sfx.hurt(); game.flash=0.35;
  if(P.light<=0){ respawn(P.cp); P.light=3; showHint('The wanderer wakes where the light last held.',3); return; }
  P.light=Math.max(0,P.light-amt);
  if(amt>1){ const x=P.x+Math.sign(P.x-e.x||1)*70; const g=A.d.gy(x); if(g<1e8) A.motes.push({x,y:g-40,got:false,ph:0,born:0}); }
  if(P.light<=1) say('g08');
}
function showHint(t,ttl){ A.hint=t; A.hintT=ttl; }

/* ---------------- throne & ending ---------------- */
function startThrone(){ game.throne={phase:'arrive',t:0,sat:false}; P.ctrl=false; P.vx=0; say('19',{cb:()=>{ if(game.throne.phase==='arrive') game.throne.phase='choose'; }}); }
function sitThrone(){ const th=game.throne; if(th.sat) return; th.sat=true; th.phase='sit'; th.t=0; P.sit=1; say('g06',{cb:()=>{ say('g07',{cb:()=>{ P.sit=0; th.phase='choose'; }}); }}); }
function letGo(){
  const th=game.throne; th.phase='release'; th.t=0; sfx.release();
  game.stats.given=P.light;
  for(let i=0;i<180;i++){ const a=Math.random()*TAU, v=60+Math.random()*360; A.particles.push({x:P.x,y:P.y-PH+8,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:2.5+Math.random()*2.5,t:0,gold:1,big:Math.random()<0.25}); }
  P.light=0;
  say('20',{delay:0.6});
  setTimeout(()=>{ game.cine={imgs:['s20','s21'],t:0,dur:11,lineDone:false}; say('21',{cb:()=>{ game.cine.lineDone=true; }}); },3400);
}

/* ---------------- autopilot (automated testing / attract mode) ---------------- */
const bot={tShine:0,stuck:0,lastX:0,skip:new Set(),tgt:null,tgtT:0};
function reachable(m){ if(bot.skip.has(m)) return false; const g=A.d.gy(m.x); const h=(g<1e8?g:BASE)-m.y; return h<=72||nearPlat(m); }
function nearPlat(m){ for(const p of A.plats) if(!p.mx&&m.x>p.x-10&&m.x<p.x+p.w+10&&m.y<p.y&&m.y>p.y-75) return true; for(const s of A.d.solids){ const top=solidTop(s); if(m.x>s.x-10&&m.x<s.x+s.w+10&&m.y>top-85) return true; } return false; }
function autopilot(dt){
  const inp={l:false,r:false,j:false,jp:false,sp:false};
  const d=A.d;
  if(game.throne){ const th=game.throne; if(th.phase==='choose'){ if(!th.sat&&!Q.has('nosit')) inp.jp=true; else inp.sp=true; } return inp; }
  if(d.bench){ inp.r=true; return inp; }
  let tx=d.len+50; const s=A.shrine;
  if(s&&!s.awake){
    if(P.light>=s.need) tx=s.x; else {
      let best=null,bd=1e9; for(const m of A.motes){ if(m.got||!reachable(m)) continue; const dd=Math.abs(m.x-P.x)+(m.x<P.x-30?150:0); if(dd<bd){bd=dd;best=m;} }
      tx=best?best.x:s.x;
    }
  } else {
    let best=null,bd=260; for(const m of A.motes){ if(m.got||!reachable(m)) continue; const dx=m.x-P.x; if(dx<-40||dx>bd) continue; bd=dx; best=m; }
    tx=best?best.x+8:d.len+50;
  }
  bot.tShine-=dt;
  if(bot.tShine<=0&&P.light>=2){
    let threat=false; for(const e of A.enemies){ if(!e.calm&&Math.abs(e.x-P.x)<115&&Math.abs((e.t==='wisp'?e.y:e.y-40)-(P.y-30))<150) threat=true; }
    let lamp=false; for(const l of A.lanterns) if(!l.lit&&Math.abs(l.x-P.x)<80) lamp=true; for(const b of A.braziers) if(!b.lit&&Math.abs(b.x-P.x)<80) lamp=true;
    if(threat||(lamp&&P.light>=4)){ inp.sp=true; bot.tShine=0.9; }
  }
  if(s&&!s.awake&&P.light>=s.need&&Math.abs(P.x-s.x)<30){ inp.sp=true; return inp; }
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
    for(const p of A.plats){ if(p.mx) continue; const edge=dir>0?p.x:p.x+p.w; if(P.ground&&Math.abs(edge-ahead)<12&&p.y<P.y-15&&p.y>P.y-70&&tx>p.x-20&&tx<p.x+p.w+20) jump=true; }
    for(const g of d.gaps){ const mv=A.plats.find(p=>p.mx&&p.x0<g[1]&&p.x0+p.w>g[0]); if(!mv||dir<0) continue;
      if(P.ground&&!P.plat&&P.x>g[0]-70&&P.x<=g[0]){ if(mv.x>mv.x0+12){ inp.r=P.x<g[0]-24; jump=false; } else { inp.r=true; jump=P.x>g[0]-16; } }
      if(P.plat===mv){ if(mv.x<mv.x0+mv.mx-14){ inp.r=P.x<mv.x+mv.w-25; inp.l=false; jump=false; } else { inp.r=true; jump=P.x>mv.x+mv.w-18; } } }
  }
  if(Math.abs(dx)<30){ for(const m of A.motes){ if(!m.got&&Math.abs(m.x-P.x)<30&&m.y<P.y-48&&m.y>P.y-115) jump=true; } }
  if(Math.abs(P.x-bot.lastX)<0.3&&(inp.l||inp.r)) bot.stuck+=dt; else bot.stuck=0; bot.lastX=P.x;
  if(bot.stuck>0.4) jump=true;
  if(jump&&P.ground) inp.jp=true;
  inp.j=inp.jp||(!P.ground&&P.vy<0);
  return inp;
}

/* ---------------- update ---------------- */
function update(dt){
  game.t+=dt; const now=game.t;
  voUpdate(dt,now);
  if(comboT>0){ comboT-=dt; if(comboT<=0) combo=0; }
  game.flash=Math.max(0,game.flash-dt*1.5);
  game.fade=Math.max(0,game.fade-dt*1.6);
  if(game.state==='title'){ game.title.a=Math.min(1,game.title.a+dt*0.5);
    const contTap=tap&&canContinue()&&tap.y>H*0.72+14&&tap.y<H*0.72+48;
    if(pressed.c&&canContinue()||contTap) startGame(true); else if(pressed.ok||pressed.j||pressed.s||tap) startGame(false); return; }
  if(game.state==='end'){ game.endT+=dt; if(game.endT>4&&(pressed.ok||pressed.j||tap)){ game.state='title'; game.title.a=0; playMusic('title'); } return; }
  if(game.state==='trans'){ game.transT+=dt; if(game.transT>1.2&&!game.transDone){ game.transDone=true; game.cine=null; setupArea(game.nextArea); } if(game.transT>2.0) game.state='play'; if(A) updateWorld(dt,{}); return; }
  if(game.state!=='play') return;
  if(pressed.p) game.paused=!game.paused;
  if(game.paused) return;
  const inp=P.auto?autopilot(dt):{l:keys.l,r:keys.r,j:keys.j,jp:pressed.j,sp:pressed.s};
  if(game.throne&&game.throne.phase==='choose'){ if(inp.jp&&!game.throne.sat) sitThrone(); else if(inp.sp) letGo(); inp.jp=false; inp.sp=false; }
  if(inp.sp&&P.ctrl) shine();
  stepPlayer(dt,inp);
  updateWorld(dt,inp);
}
function updateWorld(dt){
  const d=A.d, now=game.t, live=game.state==='play';
  game.areaTitle=Math.max(0,(game.areaTitle||0)-dt);
  const tcx=clamp(P.x-W*0.36,0,d.len-W); camX+=(tcx-camX)*Math.min(1,dt*4);
  const tcy=Math.min(0,P.y-310); camY+=(tcy-camY)*Math.min(1,dt*3);
  for(const t of A.trig){ if(!t.done&&P.x>=t.x){ t.done=true; if(t.line) say(t.line,{delay:t.delay||0}); if(t.hint) showHint(HINTS[t.hint](),t.ttl||5); } }
  if(A.hintT>0) A.hintT-=dt;
  for(const p of A.plats){ if(p.mx){ const nx=p.x0+p.mx*(0.5-0.5*Math.cos(now*TAU/p.per)); p.dx=nx-p.x; p.x=nx; } else p.dx=0; }
  // motes drift toward the sun-head and are gathered
  for(const m of A.motes){ if(m.got) continue; m.ph+=dt*2; if(m.born!==undefined) m.born+=dt;
    const dx=m.x-P.x, dy=m.y-(P.y-PH/2); const dd=Math.hypot(dx,dy);
    if(dd<64&&live){ m.x-=dx*dt*3.2; m.y-=dy*dt*3.2; }
    if(dd<22&&live&&!(m.born<0.4)){ m.got=true; P.light=Math.min(40,P.light+1); game.stats.motes++; sfx.mote(); say('g01',{delay:0.3});
      for(let i=0;i<8;i++){ const a=Math.random()*TAU; A.particles.push({x:m.x,y:m.y,vx:Math.cos(a)*60,vy:Math.sin(a)*60-20,life:0.6,t:0,gold:1}); } } }
  for(const e of A.enemies){
    e.ph+=dt; if(e.hit>0) e.hit-=dt;
    if(e.calm){ e.ct+=dt; if(e.t!=='frygar') e.y-=dt*(e.t==='wisp'?20:6); continue; }
    if(!live) continue;
    const dx=P.x-e.x;
    if(e.t==='wisp'){
      const near=Math.abs(dx)<230; const g=d.gy(e.x0); const tx=near?P.x:e.x0+Math.sin(e.ph*0.5)*60, ty=near?P.y-PH/2:(g<1e8?g:BASE)-70+Math.sin(e.ph)*10;
      e.x+=clamp(tx-e.x,-1,1)*(near?40:25)*dt+e.vx*dt; e.y+=clamp(ty-e.y,-1,1)*32*dt; e.vx*=0.95;
      if(Math.abs(dx)<18&&Math.abs((P.y-PH/2)-e.y)<26){ hurt(e,2); e.vx=-Math.sign(dx||1)*200; }
    } else if(e.t==='frygar'){
      const see=Math.abs(dx)<170&&Math.abs(P.y-e.y)<80;
      if(see){ e.dir=Math.sign(dx)||1; e.x+=e.dir*62*dt; } else { e.x+=e.dir*35*dt; if(e.x>e.x0+e.r) e.dir=-1; if(e.x<e.x0-e.r) e.dir=1; }
      e.x+=e.vx*dt; e.vx*=0.92; e.y=d.gy(e.x);
      if(Math.abs(dx)<20&&Math.abs(P.y-e.y)<40) hurt(e,2);
    } else if(e.t==='stalker'){
      const near=Math.abs(dx)<300; if(near){ e.dir=Math.sign(dx)||1; e.x+=e.dir*(Math.abs(dx)>140?54:40)*dt; } else e.x+=Math.sin(e.ph*0.3)*15*dt;
      e.x+=e.vx*dt; e.vx*=0.93; if(d.gy(e.x)>1e8) e.x-=(e.dir*54*dt+e.vx*dt); e.y=d.gy(e.x);
      if(Math.abs(dx)<20&&Math.abs(P.y-e.y)<50) hurt(e,3);
    }
  }
  for(const n of A.npcs){ n.x+=n.v*dt; n.ph+=dt*n.v/10; if(n.x>d.len+40) n.x=-40; }
  for(const l of A.lanterns) l.t+=dt; for(const b of A.braziers) b.t+=dt;
  if(A.shrine){ A.shrine.t+=dt; if(A.shrine.awake) A.veil=Math.max(0,A.veil-dt*0.5); }
  if(d.drain&&live){ let safe=false; for(const b of A.braziers) if(b.lit&&Math.abs(b.x-P.x)<170) safe=true; if(A.shrine&&A.shrine.awake) safe=true;
    if(!safe&&P.light>0){ A.drainT+=dt; if(A.drainT>d.drain){ A.drainT=0; P.light--; A.particles.push({x:P.x,y:P.y-PH,vx:0,vy:-30,life:1.2,t:0,gold:0}); if(P.light<=1) say('g08'); } } }
  if(d.embers){ if(A.rng()<dt*2.2) A.embers.push({x:camX+A.rng()*W*1.1,y:camY-20,vx:(A.rng()-.5)*30,vy:60+A.rng()*60,life:8});
    for(const em of A.embers){ em.x+=em.vx*dt; em.y+=em.vy*dt; em.life-=dt;
      if(live&&Math.abs(em.x-P.x)<10&&Math.abs(em.y-(P.y-PH/2))<22){ em.life=0; if(P.hurtT<=0){ P.light=Math.max(0,P.light-1); P.hurtT=0.5; sfx.ember(); game.flash=0.15; } }
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
  if(d.bench&&!game.ending&&P.x>d.bench.x-6&&live){ game.ending={t:0}; P.ctrl=false; P.vx=0; P.sit=1; say('22',{delay:1.0,cb:()=>{ say('23',{cb:()=>{ game.ending.lineDone=true; }}); }}); }
  if(game.ending){ game.ending.t+=dt; P.x+=(d.bench.x-P.x)*Math.min(1,dt*3); if(game.ending.lineDone&&!game.ending.out){ game.ending.out=true; game.ending.outT=game.ending.t; } if(game.ending.out&&game.ending.t-game.ending.outT>4&&game.state==='play') endGame(); }
  if(live&&!d.throne&&!d.bench&&P.x>d.len-30&&A.veil<0.5) goArea(game.areaI+1);
  const tg=game.areaI===7?0.9:clamp(0.3+P.light/14,0.3,1.5); P.glow+=(tg-P.glow)*Math.min(1,dt*3);
}
function goArea(i){ game.state='trans'; game.transT=0; game.transDone=false; game.nextArea=i; P.ctrl=false; if(game.cine) game.cine.fadeOut=true; }
function canContinue(){ try{ return (+localStorage.getItem('fantor_area')||0)>0; }catch(_){ return false; } }
function startGame(cont){
  let i=START_AREA; if(cont){ try{ i=+localStorage.getItem('fantor_area')||0; }catch(_){} }
  game.stats={motes:0,calmed:0,lanterns:0,given:0,shrines:0,start:game.t,falls:0,hits:0};
  vo.heard.clear(); vo.queue.length=0; game.throne=null; game.cine=null; game.ending=null;
  P.light=i>=4?6:3;
  game.state='trans'; game.transT=0.6; game.transDone=false; game.nextArea=i; P.ctrl=false; A=null;
}
function endGame(){ game.state='end'; game.endT=0; game.stats.time=game.t-game.stats.start; playMusic('title',4); game.log.push(['end',+game.t.toFixed(1)]); }

/* ---------------- drawing ---------------- */
const lc=document.createElement('canvas'); lc.width=W; lc.height=H; const lx=lc.getContext('2d');
const post=document.createElement('canvas'); post.width=W; post.height=H; const px=post.getContext('2d');
const vig=document.createElement('canvas'); vig.width=W; vig.height=H; (()=>{ const g=vig.getContext('2d');
  const gr=g.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.95); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(10,4,0,0.62)'); g.fillStyle=gr; g.fillRect(0,0,W,H);
  g.fillStyle='rgba(0,0,0,0.06)'; for(let y=0;y<H;y+=3) g.fillRect(0,y,W,1); })();
function drawBackdrop(){
  const d=A.d, imgs=d.imgs; const cam=camX+W*0.36;
  let k=0; for(let i=0;i<imgs.length;i++) if(cam>=imgs[i][1]-130) k=i;
  const draws=[[k,1]]; const nxt=imgs[k+1];
  if(nxt){ const t=clamp((cam-(nxt[1]-390))/260,0,1); if(t>0) draws.push([k+1,sm(t)]); }
  for(const [i,alpha] of draws){
    const [n,at]=imgs[i]; const end=imgs[i+1]?imgs[i+1][1]:d.len; const p=clamp((cam-at+390)/(end-at+390),0,1);
    const im=IMG[n]; const b=bands(n);
    cx.globalAlpha=alpha;
    const layers=[[im,1.16,0.35],[b[0],1.28,0.7],[b[1],1.42,1.0]];
    for(const [src,sc,par] of layers){ const dw=W*sc, dh=H*sc; const slack=dw-W; const ox=-slack*0.5+slack*(0.5-p)*par*0.9; const oy=-(dh-H)*0.6-camY*par*0.35;
      cx.drawImage(src,ox,oy,dw,dh); }
  }
  cx.globalAlpha=1;
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
    if(d.key==='dark'){ wg.addColorStop(0,'rgba(10,0,4,0.95)'); wg.addColorStop(1,'#000'); } else { wg.addColorStop(0,'rgba(200,210,215,0.7)'); wg.addColorStop(0.15,'rgba(60,80,100,0.9)'); wg.addColorStop(1,'#050a10'); }
    cx.fillStyle=wg; cx.fillRect(gp[0]-8,wy,gp[1]-gp[0]+16,H-wy-camY+200);
    if(d.key!=='dark'){ cx.strokeStyle='rgba(255,250,230,0.45)'; cx.lineWidth=1; for(let i=0;i<8;i++){ const yy=wy+4+i*9; const off=(game.t*(18+i*7))%60; cx.beginPath(); for(let x=gp[0]-60+off;x<gp[1];x+=60){ const a=Math.max(gp[0],x), b=Math.min(gp[1],x+24-i*2); if(b>a){ cx.moveTo(a,yy); cx.lineTo(b,yy); } } cx.stroke(); } }
  }
  const g=cx.createLinearGradient(0,BASE-40,0,BASE+160); g.addColorStop(0,d.ground[0]); g.addColorStop(0.4,d.ground[1]); g.addColorStop(1,'#000');
  cx.fillStyle=g; cx.beginPath();
  for(const s of segs){ cx.moveTo(s[0][0],H+300); for(const [x,y] of s) cx.lineTo(x,y); cx.lineTo(s[s.length-1][0],H+300); cx.closePath(); }
  cx.fill();
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
    if(s.k==='crate'){ cx.strokeStyle='rgba(0,0,0,0.45)'; cx.strokeRect(s.x+3,top+3,s.w-6,by-top-11); cx.beginPath(); cx.moveTo(s.x+3,top+3); cx.lineTo(s.x+s.w-3,by-8); cx.stroke(); }
  }
  for(const p of A.plats){ if(p.x+p.w<camX-20||p.x>camX+W+20) continue; const k=p.k;
    if(k==='branch'){ cx.fillStyle='#24170c'; cx.beginPath(); cx.moveTo(p.x-8,p.y+1); cx.quadraticCurveTo(p.x+p.w/2,p.y-5,p.x+p.w+10,p.y+2); cx.lineTo(p.x+p.w+4,p.y+9); cx.quadraticCurveTo(p.x+p.w/2,p.y+4,p.x-4,p.y+12); cx.fill(); cx.fillStyle='rgba(255,210,140,0.25)'; cx.fillRect(p.x,p.y,p.w,1.5); }
    else if(k==='stone'){ const g=cx.createLinearGradient(0,p.y,0,p.y+44); g.addColorStop(0,d.key==='dark'?'#4a3a34':'#9a9586'); g.addColorStop(1,'#141210'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(p.x-2,p.y+3); cx.quadraticCurveTo(p.x+p.w/2,p.y-6,p.x+p.w+2,p.y+3); cx.lineTo(p.x+p.w-2,p.y+46); cx.lineTo(p.x+2,p.y+46); cx.fill(); }
    else if(k==='log'){ cx.fillStyle='#3a2414'; cx.fillRect(p.x,p.y,p.w,12); cx.fillStyle='#6a4626'; cx.fillRect(p.x,p.y,p.w,3); cx.fillStyle='#24150a'; cx.beginPath(); cx.ellipse(p.x+p.w,p.y+6,4,6,0,0,TAU); cx.fill(); cx.strokeStyle='rgba(255,250,230,0.4)'; cx.beginPath(); cx.moveTo(p.x-6,p.y+13); cx.lineTo(p.x+p.w+6,p.y+13); cx.stroke(); }
    else if(k==='shard'){ const g=cx.createLinearGradient(0,p.y,0,p.y+30); g.addColorStop(0,'#fff0b8'); g.addColorStop(1,'rgba(160,90,20,0)'); cx.fillStyle=g; cx.beginPath(); cx.moveTo(p.x,p.y); cx.lineTo(p.x+p.w,p.y); cx.lineTo(p.x+p.w*0.62,p.y+30); cx.lineTo(p.x+p.w*0.3,p.y+22); cx.fill(); }
    else { const g=cx.createLinearGradient(0,p.y,0,p.y+14); g.addColorStop(0,k==='plank'?'#7a4426':'#a8763e'); g.addColorStop(1,'#2a1608'); cx.fillStyle=g; cx.fillRect(p.x,p.y,p.w,9); cx.fillStyle='rgba(0,0,0,0.4)'; cx.fillRect(p.x+6,p.y+9,4,22); cx.fillRect(p.x+p.w-10,p.y+9,4,22); }
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
    if(b.lit){ for(let k=0;k<3;k++){ const fh=12+Math.sin(game.t*9+k*2)*4; cx.fillStyle=k?'rgba(255,170,60,0.85)':'rgba(255,240,180,0.95)'; cx.beginPath(); cx.ellipse(b.x+(k-1)*5,gy-36-fh/2,4-k*0.5,fh/2,0,0,TAU); cx.fill(); } }
    else { cx.fillStyle=`rgba(255,120,60,${0.25+0.15*Math.sin(game.t*3)})`; cx.fillRect(b.x-6,gy-36,12,2); } }
}
function drawNPCs(){
  for(const n of A.npcs){ const x=n.x; if(x<camX-40||x>camX+W+40) continue; const gy=A.d.gy(x); if(gy>1e8) continue;
    cx.save(); cx.translate(x,gy+2); cx.scale(n.s,n.s); cx.globalAlpha=0.8; drawFigure(cx,0,0,1,n.ph,n.lit?0.6:0,{cloak:'#2a1810',head:n.lit?'#ffcf80':'#3a2416',small:true}); cx.restore(); }
  cx.globalAlpha=1;
}
function drawEnemies(){
  for(const e of A.enemies){ if(e.x<camX-80||e.x>camX+W+80) continue; const t=e.ph;
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
        cx.strokeStyle='#b0a090'; cx.lineWidth=2; cx.beginPath(); cx.moveTo(e.dir*10,-20); cx.lineTo(e.dir*18,-84); cx.stroke(); cx.fillStyle='#d0c0a0'; cx.beginPath(); cx.moveTo(e.dir*18-3,-84); cx.lineTo(e.dir*19,-96); cx.lineTo(e.dir*18+3,-84); cx.fill(); }
      cx.restore(); }
    else if(e.t==='stalker'){ if(calmA>=1) continue; cx.save(); cx.translate(e.x,e.y); cx.globalAlpha=1-calmA; const sway=Math.sin(t*1.5)*3;
      cx.fillStyle=e.calm?'rgba(255,215,150,0.85)':(e.hit>0?'#4a2838':'#0c060a'); cx.beginPath(); cx.moveTo(-10,0); cx.lineTo(-7,-60); cx.quadraticCurveTo(-14,-80,-6+sway,-100); cx.lineTo(6+sway,-100); cx.quadraticCurveTo(14,-80,7,-60); cx.lineTo(10,0); cx.fill();
      cx.beginPath(); cx.ellipse(sway,-110,7,11,0,0,TAU); cx.fill();
      cx.strokeStyle=cx.fillStyle; cx.lineWidth=2.5; cx.beginPath(); cx.moveTo(sway-4,-118); cx.lineTo(sway-14,-136); cx.lineTo(sway-22,-140); cx.moveTo(sway-14,-136); cx.lineTo(sway-12,-148); cx.moveTo(sway+4,-118); cx.lineTo(sway+14,-136); cx.lineTo(sway+22,-140); cx.moveTo(sway+14,-136); cx.lineTo(sway+12,-148); cx.stroke();
      cx.lineWidth=2; cx.beginPath(); cx.moveTo(-8,-70); cx.lineTo(-20,-30+Math.sin(t*2)*4); cx.moveTo(8,-70); cx.lineTo(20,-30-Math.sin(t*2)*4); cx.stroke();
      if(!e.calm){ cx.fillStyle='rgba(255,90,60,0.9)'; cx.fillRect(sway-4,-112,2,2); cx.fillRect(sway+2,-112,2,2); }
      cx.restore(); }
  }
}
// the wanderer: a faceless cloaked figure with a small sun for a head
function drawFigure(g,x,y,face,ph,glow,o={}){
  const bob=Math.abs(Math.sin(ph))*2.2, sw=Math.sin(ph); const sit=o.sit||0;
  g.save(); g.translate(x,y-bob*(1-sit)); g.scale(face,1);
  const hY=-38+sit*12;
  if(o.small) g.fillStyle=o.cloak; else { const cl=g.createLinearGradient(0,hY,0,0); cl.addColorStop(0,'#5a3622'); cl.addColorStop(1,'#1c100a'); g.fillStyle=cl; }
  g.beginPath();
  if(sit){ g.moveTo(-15,0); g.quadraticCurveTo(-13,-14,-8,hY+2); g.quadraticCurveTo(0,hY-10,9,hY+3); g.quadraticCurveTo(16,-10,22,-2); g.lineTo(22,0); }
  else { const hem=sw*4; g.moveTo(-12-hem*0.6,0); g.quadraticCurveTo(-11,-18,-7,hY+4); g.quadraticCurveTo(0,hY-9,7,hY+4); g.quadraticCurveTo(11+Math.abs(sw)*2,-16,17+hem*0.4,0);
    for(let i=0;i<5;i++) g.lineTo(17+hem*0.4-(i+1)*(29+hem*0.2)/5,(i%2?-2:1)+Math.sin(ph*2+i)*1.2); }
  g.closePath(); g.fill();
  if(glow>0){ g.strokeStyle=`rgba(255,200,120,${0.6*Math.min(1,glow)})`; g.lineWidth=1.4; g.beginPath(); g.moveTo(-7,hY+5); g.quadraticCurveTo(0,hY-9,7,hY+5); g.stroke();
    if(!o.small){ g.strokeStyle=`rgba(255,170,90,${0.3*Math.min(1,glow)})`; g.beginPath(); g.moveTo(8,hY+8); g.quadraticCurveTo(11,-16,15,-2); g.stroke(); } }
  if(!sit&&!o.small){ g.fillStyle='#0c0604'; g.fillRect(-4+sw*5,-2,5,2); g.fillRect(2-sw*5,-2,5,2); }
  const hr=o.small?4:5.5;
  if(!o.small&&glow>0.05){ g.save(); g.translate(1,hY+1); g.rotate(game.t*0.6); g.strokeStyle=`rgba(255,220,140,${0.7*Math.min(1,glow)})`; g.lineWidth=1.2; g.beginPath();
    for(let i=0;i<10;i++){ const a=i/10*TAU, r1=hr+2.5, r2=hr+5+(i%2)*3+Math.sin(game.t*3+i)*1.2; g.moveTo(Math.cos(a)*r1,Math.sin(a)*r1); g.lineTo(Math.cos(a)*r2,Math.sin(a)*r2); } g.stroke(); g.restore(); }
  if(o.small){ g.fillStyle=o.head; } else { const hg=g.createRadialGradient(1,hY+1,0,1,hY+1,hr); hg.addColorStop(0,'#fffbe8'); hg.addColorStop(0.6,glow>0.35?'#ffd27a':'#c88a4a'); hg.addColorStop(1,glow>0.35?'#ff9a3a':'#6a3a1a'); g.fillStyle=hg; }
  g.beginPath(); g.arc(1,hY+1,hr,0,TAU); g.fill();
  g.restore();
}
const PS=1.3; // player sprite scale
function drawPlayer(){ if(P.hurtT>0.3&&Math.floor(game.t*20)%2===0) return; cx.save(); cx.translate(P.x,P.y+1); cx.scale(PS,PS); drawFigure(cx,0,0,P.face,P.walk,P.glow,{sit:P.sit}); cx.restore(); }
function drawMotes(){
  for(const m of A.motes){ if(m.got||m.x<camX-20||m.x>camX+W+20) continue; const y=m.y+Math.sin(m.ph)*3;
    const g=cx.createRadialGradient(m.x,y,0,m.x,y,11); g.addColorStop(0,'rgba(255,250,220,1)'); g.addColorStop(0.3,'rgba(255,210,120,0.85)'); g.addColorStop(1,'rgba(255,160,60,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(m.x,y,11,0,TAU); cx.fill(); }
}
function drawParticles(){
  cx.save(); cx.globalCompositeOperation='lighter';
  for(const p of A.particles){ const a=1-p.t/p.life; if(p.dust){ cx.fillStyle=`rgba(255,220,160,${0.3*Math.sin(Math.PI*p.t/p.life)})`; cx.fillRect(p.x,p.y,1.5,1.5); continue; }
    const r=p.big?4:2; cx.fillStyle=p.gold?`rgba(255,215,130,${a})`:`rgba(120,90,90,${a})`; cx.beginPath(); cx.arc(p.x,p.y,r,0,TAU); cx.fill(); }
  for(const e of A.embers){ cx.fillStyle='rgba(255,150,50,0.9)'; cx.fillRect(e.x,e.y,2.5,2.5); }
  for(const r of A.rings){ const a=1-r.t/0.9; cx.strokeStyle=`rgba(255,225,150,${0.7*a})`; cx.lineWidth=3*a+1; cx.beginPath(); cx.arc(r.x,r.y,r.r,0,TAU); cx.stroke(); }
  for(const s of A.streams){ if(s.t<0) continue; const t=sm(Math.min(1,s.t)); const x=lerp(s.x0,s.x1,t), y=lerp(s.y0,s.y1,t)-Math.sin(t*Math.PI)*60; cx.fillStyle='rgba(255,230,160,0.95)'; cx.beginPath(); cx.arc(x,y,3,0,TAU); cx.fill(); }
  cx.restore();
}
function lightSources(){
  const L=[]; const d=A.d;
  L.push([P.x+1,P.y-49+(P.sit?15:0),70+P.glow*130,1]);
  for(const m of A.motes) if(!m.got) L.push([m.x,m.y,34,0.8]);
  if(A.shrine){ const s=A.shrine, gy=d.gy(s.x); L.push([s.x,gy-48,s.awake?260*clamp(s.t/1.5,0,1)+40:46,1]); }
  for(const l of A.lanterns) if(l.lit) L.push([l.x+14,d.gy(l.x)-82,110,0.9]);
  for(const b of A.braziers) L.push([b.x,d.gy(b.x)-40,b.lit?200:34,1]);
  for(const n of A.npcs) if(n.lit) L.push([n.x,d.gy(n.x)-30*n.s,40,0.6]);
  for(const r of A.rings) L.push([r.x,r.y,r.r+40,0.6*(1-r.t/0.9)]);
  for(const e of A.enemies) if(e.calm&&e.t==='frygar') L.push([e.x,e.y-32,50,0.7]);
  for(const e of A.embers) L.push([e.x,e.y,16,0.5]);
  return L;
}
function drawLighting(){
  const d=A.d; let dark=d.dark; if(game.throne&&game.throne.sat&&game.throne.phase==='sit') dark=Math.min(0.78,dark+0.6*clamp(game.throne.t/2,0,1));
  if(dark<=0.01) return;
  lx.globalCompositeOperation='source-over'; lx.clearRect(0,0,W,H);
  lx.fillStyle=`rgba(${d.darkCol},${dark})`; lx.fillRect(0,0,W,H);
  lx.globalCompositeOperation='destination-out';
  for(const [x,y,r,a] of lightSources()){ const sx=x-camX, sy=y-camY; if(sx<-r||sx>W+r||sy<-r||sy>H+r) continue; const g=lx.createRadialGradient(sx,sy,0,sx,sy,r); g.addColorStop(0,`rgba(0,0,0,${a})`); g.addColorStop(0.5,`rgba(0,0,0,${a*0.6})`); g.addColorStop(1,'rgba(0,0,0,0)'); lx.fillStyle=g; lx.fillRect(sx-r,sy-r,r*2,r*2); }
  cx.drawImage(lc,0,0);
}
function drawGlow(){
  cx.save(); cx.globalCompositeOperation='lighter';
  const r=40+P.glow*70, x=P.x+1-camX, y=P.y-49-camY+(P.sit?15:0);
  const g=cx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,`rgba(255,220,150,${0.33*Math.min(1.2,P.glow)})`); g.addColorStop(1,'rgba(255,140,40,0)'); cx.fillStyle=g; cx.fillRect(x-r,y-r,r*2,r*2);
  for(const l of A.lanterns) if(l.lit){ const lx2=l.x+14-camX, ly=A.d.gy(l.x)-82-camY; const gg=cx.createRadialGradient(lx2,ly,0,lx2,ly,40); gg.addColorStop(0,'rgba(255,200,120,0.35)'); gg.addColorStop(1,'rgba(255,200,120,0)'); cx.fillStyle=gg; cx.fillRect(lx2-40,ly-40,80,80); }
  cx.restore();
}
function post_fx(){
  // VHS softness: colour bleed + gentle halation, no grain
  px.clearRect(0,0,W,H); px.drawImage(cv,0,0);
  cx.save(); cx.globalCompositeOperation='screen'; cx.globalAlpha=0.10; cx.drawImage(post,2,0); cx.globalAlpha=0.06; cx.drawImage(post,-2,1);
  cx.globalCompositeOperation='lighter'; cx.globalAlpha=0.045; cx.drawImage(post,0,0,W,H,-8,-5,W+16,H+10); cx.restore();
  cx.drawImage(vig,0,0);
  const tb=(game.t*0.07)%1.6; if(tb<1){ cx.fillStyle='rgba(255,240,220,0.03)'; cx.fillRect(0,tb*H,W,5); }
}
function text(t,x,y,size,col,align='center',alpha=1){
  cx.save(); cx.globalAlpha=alpha; cx.font=`${size}px Georgia, 'Times New Roman', serif`; cx.textAlign=align; cx.textBaseline='middle';
  cx.shadowColor='rgba(0,0,0,0.85)'; cx.shadowBlur=6; cx.fillStyle=col; cx.fillText(t,x,y); cx.restore();
}
function wrap(t,maxW,size){ cx.font=`${size}px Georgia, serif`; const words=t.split(' '), lines=[]; let cur=''; for(const w of words){ const tt=cur?cur+' '+w:w; if(cx.measureText(tt).width>maxW&&cur){ lines.push(cur); cur=w; } else cur=tt; } if(cur) lines.push(cur); return lines; }
function drawHUD(){
  const n=P.light; const x0=24,y0=26;
  if(game.areaI<7){
    cx.save(); cx.globalCompositeOperation='lighter';
    const r=7+Math.min(n,20)*0.45; const g=cx.createRadialGradient(x0,y0,0,x0,y0,r*2.4); g.addColorStop(0,n>0?'rgba(255,240,200,1)':'rgba(120,70,40,0.8)'); g.addColorStop(0.35,n>0?'rgba(255,190,90,0.7)':'rgba(90,40,20,0.4)'); g.addColorStop(1,'rgba(255,120,30,0)'); cx.fillStyle=g; cx.beginPath(); cx.arc(x0,y0,r*2.4,0,TAU); cx.fill();
    cx.restore();
    text(String(n),x0+28,y0+1,19,'#ffe6b8','left',0.95);
    if(A.shrine&&!A.shrine.awake) text(`the stone ahead wants ${A.shrine.need}`,x0+54,y0+1,12,'rgba(255,220,180,0.65)','left',0.85);
  }
  if(A.hintT>0&&A.hint){ const a=Math.min(1,A.hintT)*Math.min(1,(game.t%1e9)>0?1:1); text(A.hint,W/2,64,15,'#ffe2b0','center',a); }
  if(game.areaTitle>0&&game.state==='play'){ const t=game.areaTitle; const a=Math.min(1,t)*Math.min(1,(4-t)*1.5); const d=A.d; if(d.num) text(d.num,W/2,H*0.34,18,'#ffd9a0','center',a*0.8); text(d.title,W/2,H*0.34+30,30,'#fff0d0','center',a); }
  if(vo.subA>0.02&&vo.sub){ const ls=wrap(vo.sub,W*0.78,17); const by=H-28-(ls.length-1)*22; cx.save(); cx.globalAlpha=vo.subA*0.5; cx.fillStyle='#000'; cx.fillRect(W*0.08,by-16,W*0.84,ls.length*22+10); cx.restore();
    ls.forEach((l,i)=>text(l,W/2,by+i*22,17,'#f4e6cc','center',vo.subA)); }
  if(game.throne&&game.throne.phase==='choose'){ const a=0.6+0.4*Math.sin(game.t*2);
    if(!game.throne.sat) text(touchMode?'⤒  sit on the throne':'↑  sit on the throne',W/2-170,H*0.2,17,'#ffe2b0','center',0.9);
    text(touchMode?'✦  let the light go':'X  let the light go',game.throne.sat?W/2:W/2+170,H*0.2,17,'#fff4d8','center',a); }
  if(game.paused){ cx.fillStyle='rgba(0,0,0,0.5)'; cx.fillRect(0,0,W,H); text('Paused',W/2,H/2,28,'#ffe6c0'); text('P or Esc to return',W/2,H/2+34,14,'#e0c8a8'); }
  if(DEBUG) text(`x ${P.x|0} y ${P.y|0} light ${P.light} area ${game.areaI} ${game.state}`,W-8,H-10,11,'#9f9','right');
}
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
function drawWorld(){
  cx.setTransform(1,0,0,1,0,0); cx.globalAlpha=1; cx.globalCompositeOperation='source-over'; cx.fillStyle='#000'; cx.fillRect(0,0,W,H);
  if(!A) return;
  const d=A.d;
  drawBackdrop();
  silLayer(d.fg,0.55,false);
  cx.save(); cx.translate(-Math.round(camX),-Math.round(camY));
  drawGround(); drawThrone(); drawVeil(); drawShrine(); drawLanterns(); drawSolids(); drawNPCs(); drawMotes(); drawEnemies();
  if(d.bench){ const bx=d.bench.x-14, gy=d.gy(bx); cx.fillStyle='#1c0c0a'; cx.fillRect(bx-4,gy-16,40,5); cx.fillRect(bx,gy-16,3,16); cx.fillRect(bx+30,gy-16,3,16); cx.fillRect(bx-4,gy-34,3,22); }
  drawPlayer(); drawParticles();
  cx.restore();
  drawLighting(); drawGlow();
  silLayer(d.fg,1.25,true);
  if(game.areaI===7){ // dusk garden: everyone's lights
    cx.save(); cx.globalCompositeOperation='lighter'; const n=50+Math.min(120,(game.stats.given||0)*5); const r=rngf(77);
    for(let i=0;i<n;i++){ const par=0.2+r()*0.6; const base=r()*W*3; const xx=((base-camX*par)%(W*1.2)+W*1.2)%(W*1.2)-W*0.1; const y=H*0.2+r()*H*0.62+Math.sin(game.t*(0.5+r())+i)*8; const a=0.3+0.3*Math.sin(game.t*(1+r()*2)+i); cx.fillStyle=`rgba(255,${200+r()*40|0},120,${a})`; cx.beginPath(); cx.arc(xx,y,1.2+r()*1.8,0,TAU); cx.fill(); }
    cx.restore(); }
  if(game.throne&&game.throne.phase==='release'){ const t=game.throne.t; cx.fillStyle=`rgba(255,248,230,${clamp((t-1.8)/1.4,0,1)})`; cx.fillRect(0,0,W,H); }
  if(game.ending&&game.ending.out){ const t=game.ending.t-game.ending.outT; cx.fillStyle=`rgba(0,0,0,${clamp(t/3.5,0,1)})`; cx.fillRect(0,0,W,H); }
  drawCine();
  if(game.flash>0){ cx.fillStyle=`rgba(120,20,10,${game.flash*0.5})`; cx.fillRect(0,0,W,H); }
}
function drawTitle(){
  cx.setTransform(1,0,0,1,0,0); cx.fillStyle='#000'; cx.fillRect(0,0,W,H);
  const t=game.t, a=game.title.a; const im=IMG.s01; const z=1.12+0.03*Math.sin(t*0.1);
  cx.globalAlpha=a; cx.drawImage(im,W/2-W*z/2+Math.sin(t*0.07)*10,H/2-H*z/2,W*z,H*z); cx.globalAlpha=1;
  const g=cx.createLinearGradient(0,0,0,H); g.addColorStop(0,'rgba(0,0,0,0.4)'); g.addColorStop(0.5,'rgba(0,0,0,0.08)'); g.addColorStop(1,'rgba(0,0,0,0.78)'); cx.fillStyle=g; cx.fillRect(0,0,W,H);
  cx.save(); cx.globalCompositeOperation='lighter'; const r=rngf(5); for(let i=0;i<50;i++){ const x=(r()*W+t*(4+r()*10))%W, y=((r()*H-t*(3+r()*8))%H+H)%H; cx.fillStyle=`rgba(255,210,140,${0.25+0.25*Math.sin(t+i)})`; cx.beginPath(); cx.arc(x,y,1+r()*1.5,0,TAU); cx.fill(); } cx.restore();
  // the wanderer, small, on the title
  drawFigure(cx,W*0.5,H*0.62,1,t*2,1.1,{});
  text('FANTOR',W/2,H*0.24,66,'#fff0d2','center',a);
  text("THE   WANDERER'S   LIGHT",W/2,H*0.24+50,16,'#ffd59a','center',a*0.9);
  const blink=0.55+0.45*Math.sin(t*2.5);
  text(touchMode?'Tap to begin':'Press Enter or Space to begin',W/2,H*0.72,18,'#fff2dc','center',a*blink);
  if(canContinue()) text(touchMode?'or tap here to continue your journey':'C  continue your journey',W/2,H*0.72+30,14,'#ffd9b0','center',a*0.85);
  text(touchMode?'◀ ▶ walk    ⤒ jump    ✦ shine / offer light':'← →  walk     ↑ / Space  jump     X  shine / offer light     P  pause',W/2,H-32,13,'rgba(255,230,200,0.8)','center',a);
  text('a journey through the paintings of The Road to Fantor',W/2,H-13,10,'rgba(255,220,190,0.5)','center',a);
}
function drawEnd(){
  cx.setTransform(1,0,0,1,0,0); const t=game.endT; const im=IMG.s23; const z=1.06+0.02*Math.min(1,t/30);
  cx.fillStyle='#000'; cx.fillRect(0,0,W,H); cx.globalAlpha=clamp(t/3,0,1); cx.drawImage(im,W/2-W*z/2,H/2-H*z/2,W*z,H*z); cx.globalAlpha=1;
  cx.fillStyle='rgba(0,0,0,0.45)'; cx.fillRect(0,0,W,H);
  const a=clamp((t-1)/2,0,1), s=game.stats;
  text('Fantor still glows at dusk.',W/2,H*0.22,30,'#fff0d6','center',a);
  text('THE END',W/2,H*0.22+38,13,'#ffcf9a','center',a*0.8);
  const m=Math.floor((s.time||0)/60), sec=Math.floor((s.time||0)%60);
  const rows=[['Light gathered',s.motes],['Shadows calmed',s.calmed],['Lanterns lit',s.lanterns],['Stones woken',s.shrines],['Light given away',s.given||0],['Journey',`${m}m ${String(sec).padStart(2,'0')}s`]];
  rows.forEach(([k,v],i)=>{ const aa=clamp((t-2-i*0.4)/1,0,1); text(k,W/2-12,H*0.42+i*26,16,'#ffdcae','right',aa); text(String(v),W/2+12,H*0.42+i*26,16,'#fff6e6','left',aa); });
  if(t>4) text(touchMode?'Tap to return':'Press Enter to return',W/2,H-30,14,'#ffe8cc','center',0.5+0.4*Math.sin(t*2));
}
function drawLoading(){
  cx.setTransform(1,0,0,1,0,0); cx.fillStyle='#050302'; cx.fillRect(0,0,W,H);
  const p=load.done/Math.max(1,load.total); text('FANTOR',W/2,H/2-30,40,'#ffe6c0','center',0.9);
  cx.fillStyle='rgba(255,210,150,0.2)'; cx.fillRect(W/2-120,H/2+10,240,4); cx.fillStyle='#ffd08a'; cx.fillRect(W/2-120,H/2+10,240*p,4);
  if(load.err) text('Could not load: '+load.err,W/2,H/2+40,12,'#f99');
}
function render(){
  if(game.state==='loading'){ drawLoading(); return; }
  if(game.state==='title') drawTitle();
  else if(game.state==='end') drawEnd();
  else { drawWorld(); if(A) drawHUD();
    if(game.state==='trans'){ const t=game.transT; const a=t<1.2?clamp(t/1.0,0,1):clamp(1-(t-1.2)/0.8,0,1); cx.fillStyle=`rgba(0,0,0,${a})`; cx.fillRect(0,0,W,H); } }
  if(game.fade>0&&game.state==='play'){ cx.fillStyle=`rgba(0,0,0,${game.fade})`; cx.fillRect(0,0,W,H); }
  post_fx();
}

/* ---------------- loop ---------------- */
let last=performance.now(), acc=0; const STEP=1/60;
game.timeScale=1;
function frame(now){
  let dt=(now-last)/1000; last=now; if(dt>0.25) dt=0.25; acc+=dt*game.timeScale;
  let n=0; while(acc>=STEP&&n<40){ update(STEP); acc-=STEP; n++; for(const k in pressed) delete pressed[k]; tap=null; }
  render();
  requestAnimationFrame(frame);
}
window.addEventListener('error',e=>{ game.log.push(['error',String(e.message)]); });

/* ---------------- loading ---------------- */
const load={total:0,done:0,err:null};
function track(p){ load.total++; return p.then(()=>{load.done++;},e=>{ load.err=String(e.message||e); console.error(e); }); }
const imgNames=[]; for(let i=1;i<=23;i++) imgNames.push('s'+String(i).padStart(2,'0'));
const musNames=['title','shore','forest','river','kingdom','war','dark','heart','garden'];
Promise.all([
  ...imgNames.map(n=>track(loadImg(n))),
  ...Object.keys(LINES).map(n=>track(fetchRaw('v_'+n,'assets/vo/'+n+'.mp3'))),
  ...musNames.map(n=>track(fetchRaw('m_'+n,'assets/music/'+n+'.mp3'))),
]).then(()=>{ game.state='title'; if(ac) playMusic('title',2); if(Q.has('rec')) audioInit(); if(AUTO){ audioInit(); startGame(false); } });
// keep only nearby music decoded (phones have little memory)
setInterval(()=>{ if(!ac) return; const cur=A?A.d.music:'title'; const nx=A&&AREAS[game.areaI+1]?AREAS[game.areaI+1].music:'title'; const keep=new Set(['m_title','m_'+cur,'m_'+nx]);
  for(const k in bufs) if(k.startsWith('m_')&&!keep.has(k)&&!(musCur&&'m_'+musCur.name===k)){ delete bufs[k]; delete decoding[k]; } for(const k of keep) decode(k); },3000);

/* ---------------- hooks for recording and testing ---------------- */
window.fantorRec={
  start(){ const vs=cv.captureStream(30); const tracks=[...vs.getVideoTracks()]; if(recDest) tracks.push(...recDest.stream.getAudioTracks());
    this.chunks=[]; this.mr=new MediaRecorder(new MediaStream(tracks),{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:5000000}); this.mr.ondataavailable=e=>{ if(e.data.size) this.chunks.push(e.data); }; this.mr.start(1000); },
  pause(){ this.mr&&this.mr.state==='recording'&&this.mr.pause(); }, resume(){ this.mr&&this.mr.state==='paused'&&this.mr.resume(); },
  stop(){ return new Promise(res=>{ this.mr.onstop=async()=>{ const b=new Blob(this.chunks,{type:'video/webm'}); const buf=new Uint8Array(await b.arrayBuffer()); let s=''; for(let i=0;i<buf.length;i+=0x8000) s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000)); res(btoa(s)); }; this.mr.stop(); }); }
};
window.fantorDebug={ tp:(x,light)=>{ P.x=x; P.y=A.d.gy(x); P.vy=0; camX=clamp(x-W*0.36,0,A.d.len-W); for(const t of A.trig) if(t.x<x) { t.done=true; } if(light!==undefined) P.light=light; }, goArea, setLight:(n)=>{P.light=n;}, areas:AREAS, state:()=>({state:game.state,area:game.areaI,x:Math.round(P.x),y:Math.round(P.y),light:P.light,stats:game.stats,throne:game.throne&&game.throne.phase,vo:vo.cur&&vo.cur.id}) };
requestAnimationFrame(frame);
})();
