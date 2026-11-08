/* Build the browser file from src/game.js.
   Strips the dev-only blocks (autopilot cheats, fantorDebug) and minifies.
   Run from the repo root: node tools/build.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

function ship(src){
  let s = src.replace(/\/\*@DEV\*\/[\s\S]*?\/\*@\/DEV\*\//g, '');
  if(s.includes('@DEV')) throw new Error('a @DEV marker survived the strip');
  s = s.replace(/\/\*@PROD\s*([\s\S]*?)\s*@PROD\*\//g, (_, inner) => inner);
  if(s.includes('@DEV') || s.includes('@PROD')) throw new Error('a build marker survived');
  return s;
}

(async () => {
  const root = path.join(__dirname, '..');
  const srcPath = path.join(root, 'src', 'game.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const code = ship(src);
  const out = await minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if(!out || !out.code) throw new Error('minify produced no code');
  const dest = path.join(root, 'game.js');
  fs.writeFileSync(dest, out.code);
  console.log(`game.js  ${out.code.length} bytes  (from src/game.js ${src.length})`);
})().catch(err => { console.error(err); process.exit(1); });
