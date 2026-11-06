'use strict';
(function () {
const $ = (s) => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
let doc = null;           // editor document (see core.js)
let selLayer = null;      // selected layer id
let selChain = null;      // selected chain id
let tab = 'rig';
const view = { zoom: 8, panX: 0, panY: 0 }; // rig view: screen = canvasPx*zoom + pan
let showSkel = true, moveSkel = false;
const imgCache = new Map(); // layer/obj -> canvas

function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms || 2600); }
function hint(msg) { $('#hint').innerHTML = msg; }

function layerCanvas(l) {
  let c = imgCache.get(l);
  if (!c) { c = document.createElement('canvas'); c.width = l.w; c.height = l.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(l.rgba), l.w, l.h), 0, 0); imgCache.set(l, c); }
  return c;
}

// ---------------------------------------------------------------- loading
async function decodePng(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  return { w: c.width, h: c.height, rgba: g.getImageData(0, 0, c.width, c.height).data };
}

const psd_or_rig = (files) => files.some(f => /\.ps[db]$/i.test(f.name) || /^rig\.json$/i.test(f.name));
// ---- projects (.luna): save / open the whole character, plus an automatic save in this browser
async function gz(text, inflate) {
  if (typeof CompressionStream === 'undefined') return inflate ? text : new Blob([text]);
  if (inflate) return await new Response(new Blob([text]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
async function saveProject() {
  if (!doc) { toast('Nothing to save yet'); return; }
  const blob = await gz(RIG.serialize(doc));
  await downloadBlob(blob, (doc.name || 'MyCharacter').replace(/[^A-Za-z0-9_\- ]+/g, '_') + '.luna');
  toast('Saved ' + doc.name + '.luna — open it again with Open…', 4000);
}
async function loadProject(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const text = (buf[0] === 0x1f && buf[1] === 0x8b) ? await gz(buf, true) : new TextDecoder().decode(buf);
  setDoc(RIG.deserialize(text)); toast('Opened ' + doc.name, 3000);
}
function setDoc(d) {
  doc = d; imgCache.clear(); selLayer = null; selChain = doc.chains[0] ? doc.chains[0].id : null;
  $('#name').value = doc.name; $('#drop').style.display = 'none';
  fitView(); refresh(); hint(rigHint()); if (tab === 'test') startTest();
}
const AUTOSAVE = 'luna-ars-autosave';
let lastAuto = '';
setInterval(() => {
  if (!doc || !doc.layers.length) return;
  try { const t = RIG.serialize(doc); if (t !== lastAuto) { localStorage.setItem(AUTOSAVE, t); localStorage.setItem(AUTOSAVE + '-time', String(Date.now())); lastAuto = t; } } catch (e) { /* storage full or blocked: the Save button still works */ }
}, 15000);
function autosaveInfo() { try { const t = localStorage.getItem(AUTOSAVE + '-time'); return t && localStorage.getItem(AUTOSAVE) ? new Date(+t) : null; } catch (e) { return null; } }
function restoreAutosave() { try { setDoc(RIG.deserialize(localStorage.getItem(AUTOSAVE))); toast('Back where you left off: ' + doc.name); } catch (e) { toast('Could not restore: ' + e.message); } }

async function openFiles(list) {
  const files = [...list]; if (!files.length) return;
  const proj = files.find(f => /\.luna$/i.test(f.name));
  if (proj) { try { await loadProject(proj); } catch (e) { console.error(e); toast('Could not open: ' + e.message, 6000); } return; }
  try {
    const psd = files.find(f => /\.ps[db]$/i.test(f.name));
    const json = files.find(f => /\.json$/i.test(f.name));
    if (!psd_or_rig(files) && files.some(f => /^(health_|experiment)/i.test(f.name) || /^sprites\.json$/i.test(f.name)) &&
        files.every(f => /^(health_|experiment)/i.test(f.name) || /^sprites\.json$/i.test(f.name))) { await addSprites(files); return; }
    const allPngs = files.filter(f => /\.png$/i.test(f.name) && !/^health_/i.test(f.name));
    const skin = allPngs.filter(f => /^experiment/i.test(f.name));
    const pngs = allPngs.filter(f => !/^experiment/i.test(f.name) || json);
    if (psd) {
      const parsed = RIG.readPSD(await psd.arrayBuffer());
      if (doc && doc.layers.length) {
        const names = new Set(doc.layers.map(l => l.name)); const hits = parsed.layers.filter(l => names.has(l.name)).length;
        if (hits >= Math.max(1, parsed.layers.length / 3) && confirm('This file has ' + hits + ' of your character\'s layers.\n\nOK = update your character from it (keeps bones, roles, animations; new layers are added)\nCancel = open it as a new character')) { updateFromPsd(parsed); return; }
      }
      doc = RIG.newDoc(psd.name.replace(/\.ps[db]$/i, ''), parsed.width, parsed.height, parsed.layers);
      if (!manualMode) RIG.autoAssign(doc);
      if ((doc.ppu || 8) > 8) setTimeout(() => toast('This art looks drawn at ' + (doc.ppu / 8) + '× the game\'s size: kept sharp (HD). Change it or shrink it under Character → Art scale.', 8000), 4200);
      if (doc.layers.some(l => l.suggest)) setTimeout(() => toast('Some layer names meant nothing to the editor: it guessed from where they sit. Check the ✓ / ✗ in the layer list.', 7000), doc.ppu > 8 ? 12500 : 4200);
      applyPsdFolders(parsed);
      toast('Opened ' + psd.name + ' — ' + doc.layers.length + ' layers' + (manualMode ? '. Manual setup: nothing assigned or moved. Set roles on the left (Ctrl/Shift-click several → Set role), then Move skeleton to line it up.' : ', parts matched automatically'), manualMode ? 9000 : 4000);
    } else if (json) {
      const rig = JSON.parse(await json.text());
      const images = {}; for (const f of pngs) images[f.name] = await decodePng(f);
      for (const f of files.filter(f => /\.(wav|ogg|mp3)$/i.test(f.name))) images[f.name] = { raw: new Uint8Array(await f.arrayBuffer()) };
      doc = RIG.docFromRig(rig, images);
      toast('Opened rig ' + doc.name);
    } else if (pngs.length) {
      const decoded = []; let W = 0, H = 0;
      for (let i = 0; i < pngs.length; i++) { const d = await decodePng(pngs[i]); W = Math.max(W, d.w); H = Math.max(H, d.h); decoded.push({ name: pngs[i].name.replace(/\.png$/i, ''), x: 0, y: 0, w: d.w, h: d.h, rgba: d.rgba, order: i }); }
      const sameSize = decoded.every(d => d.w === decoded[0].w && d.h === decoded[0].h) && decoded.length > 1;
      if (sameSize) { // full-canvas layers exported from an art program: positions are already right
        doc = RIG.newDoc('MyCharacter', W, H, decoded); RIG.autoAssign(doc);
        toast(pngs.length + ' layers opened and matched by name. Fix any part with the dropdown next to it.', 5000);
      } else { // separate cut-out images: each one is put on the body by its name
        doc = RIG.docFromLoose('MyCharacter', decoded);
        const lost = doc.layers.filter(l => l.role.type === 'ignore').length;
        toast(pngs.length + ' images placed on the body by name.' + (lost ? ' ' + lost + ' not recognised: they wait beside the character, pick a role for them on the left.' : '') + ' Drag any image to move it.', 7000);
      }
    }
    const hsFiles = files.filter(f => /^health_/i.test(f.name));
    if (hsFiles.length && doc) await addSprites(hsFiles);
    if (skin.length && !json) {
      if (!doc || (!psd && !pngs.length && !doc.layers.length)) doc = doc || RIG.newDoc('MySkin', 64, 64, []);
      for (const f of skin) doc.spriteSwaps[f.name.replace(/\.png$/i, '')] = await decodePng(f);
      doc.hideVanillaTail = doc.chains.some(c => c.attachTo === 'tail');
      toast(skin.length + ' skin sprites added (sprite-replacer format). They show on the body; add a PSD for moving parts.', 5000);
    }
    if (!doc) return;
    imgCache.clear(); selLayer = null; selChain = doc.chains[0] ? doc.chains[0].id : null;
    $('#name').value = doc.name; $('#drop').style.display = 'none';
    fitView(); refresh(); hint(rigHint()); if (tab === 'test') startTest();
  } catch (e) { console.error(e); toast('Could not open: ' + e.message, 6000); }
}

// Add images to the open character: body parts / tail pieces / frames become layers (placed by name),
// images named like the game's sprites (experiment*, health_*) become skins and health screen art.
const isGameSprite = (f) => /^(health_|experiment)/i.test(f.name) || /^sprites\.json$/i.test(f.name);
async function addImages(list) {
  const files = [...list]; if (!files.length) return;
  // a game-named image (experimentTail.png…) whose layer is already in the character is a repaint of that layer, not a skin
  const hasLayer = (f) => doc && /\.png$/i.test(f.name) && doc.layers.some(l => !l.cutSource && l.name === f.name.replace(/\.png$/i, ''));
  const art = files.filter(f => /\.png$/i.test(f.name) && (!isGameSprite(f) || hasLayer(f)));
  const game = files.filter(f => isGameSprite(f) && !hasLayer(f));
  if (!doc && art.length) { await openFiles(art); if (game.length) await addSprites(game); return; }
  if (art.length) {
    const imgs = []; let replaced = 0;
    for (const f of art) {
      const d = await decodePng(f); const name = f.name.replace(/\.png$/i, '');
      const same = doc.layers.find(l => !l.cutSource && l.name === name);
      if (same) { replaceLayerImage(same, d); replaced++; continue; } // an edited layer coming back
      imgs.push({ name, w: d.w, h: d.h, rgba: d.rgba });
    }
    if (replaced) { imgCache.clear(); refresh(); startTestIfOpen(); toast(replaced + ' layer' + (replaced === 1 ? '' : 's') + ' updated from your edited PNGs', 4000); }
    if (!imgs.length) { if (game.length) await addSprites(game); return; }
    pushUndo();
    const added = manualMode ? imgs.map(im => { // manual: where the file says, or the middle of the canvas; no role
      const c = RIG.crop(im.rgba, im.w, im.h); if (!c) return null; const full = im.w === doc.width && im.h === doc.height;
      const l = { id: RIG.newId(), name: im.name, x: full ? c.x : Math.round(doc.width / 2 - c.w / 2), y: full ? c.y : Math.round(doc.height / 2 - c.h / 2), w: c.w, h: c.h, rgba: c.rgba, order: doc.layers.length, hidden: false, role: { type: 'ignore' } };
      doc.layers.push(l); return l; }).filter(Boolean) : RIG.addImages(doc, imgs);
    imgCache.clear(); $('#drop').style.display = 'none';
    const lost = added.filter(l => l.role.type === 'ignore');
    selLayer = added.length === 1 ? added[0].id : selLayer; selChain = null;
    fitView(); refresh();
    toast(added.length + ' image' + (added.length === 1 ? '' : 's') + ' added' + (lost.length ? ' — ' + lost.length + ' not recognised by name, set ' + (lost.length === 1 ? 'its' : 'their') + ' role on the left' : '') + '. Drag to move.', 6000);
  }
  if (game.length) await addSprites(game);
}
async function addSprites(list) {
  const files = [...list]; if (!files.length) return;
  if (!doc) doc = RIG.newDoc('MyCharacter', 64, 64, []);
  let swaps = 0, hs = 0;
  const dump = files.find(f => /^sprites\.json$/i.test(f.name));
  let dumpInfo = null; if (dump) { try { dumpInfo = JSON.parse(await dump.text()); } catch (e) { } }
  for (const f of files.filter(f => /\.png$/i.test(f.name))) {
    const base = f.name.replace(/\.png$/i, '');
    const m = base.match(/^health_([A-Za-z]+)_(outline|middle)$/);
    const img = await decodePng(f);
    if (m && RIG.PARTS.includes(m[1])) {
      const e = doc.healthScreen[m[1]] = doc.healthScreen[m[1]] || { scale: 3 };
      e[m[2]] = img; hs++;
      const pos = dumpInfo && dumpInfo.healthScreen && dumpInfo.healthScreen[m[1]];
      if (pos && e.x === undefined) { e.x = pos.x; e.y = pos.y; e.mirror = !!pos.mirror; e.scale = pos.scale || 3; }
    } else { doc.spriteSwaps[base] = img; swaps++; }
  }
  imgCache.clear(); $('#drop').style.display = 'none';
  if (!doc.layers.length) fitView();
  refresh();
  toast((swaps ? swaps + ' skin/gear sprites' : '') + (swaps && hs ? ' and ' : '') + (hs ? hs + ' health screen images' : '') + ' added', 4000);
}
$('#btnSprites').onclick = () => $('#fileSprites').click();
$('#btnAddPsd').onclick = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.psd,.psb';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; if (doc && doc.layers.length) await updateFromPsdFile(f); else await openFiles([f]); };
  inp.click();
};
$('#dlMenu').onchange = (e) => { const v = e.target.value; e.target.value = ''; if (!doc || !doc.layers.length) { toast('Nothing to download yet.'); return; }
  if (v === 'psd') exportPsd(false); else if (v === 'psb') exportPsd(true); else if (v === 'png') downloadAllLayers(); };
// ---- the game template: comes from the player's own game (the mod writes BepInEx/plugins/AdvancedRigs/GameTemplate).
// Nothing of the game is bundled with the editor. It's kept in this browser after the first load.
RIG.GAME = null;
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('luna-ars', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const rq = db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); }
async function setGame(tpl, clips, pngs, store) {
  const images = {};
  for (const n in pngs) { try { images[n] = await decodePng(new Blob([pngs[n]], { type: 'image/png' })); } catch (e) { } }
  RIG.GAME = { tpl, clips: clips || {}, images, sprites: tpl.sprites || {} };
  if (store) { try { await idbSet('gameTemplate', { tpl, clips, pngs }); } catch (e) { console.warn('could not keep the game template in this browser', e); } }
  updateGameBadge(); imgCache.clear(); if (doc) refresh(); else renderInspector();
}
function updateGameBadge() {
  const b = $('#gameBadge'); if (!b) return;
  if (RIG.GAME) { const g = RIG.GAME; b.textContent = '✓ game template'; b.title = 'Loaded from your game: ' + Object.keys(g.images).length + ' sprites, ' + ((g.tpl.gear || []).length) + ' wearables, ' + Object.keys(g.clips).length + ' animations. Click to reload it.'; b.style.color = 'var(--ok)'; }
  else { b.textContent = 'no game template'; b.style.color = 'var(--warn)'; }
}
async function loadGameTemplateFiles(list) {
  const files = [...list]; const byPath = {};
  for (const f of files) byPath[(f.webkitRelativePath || f.name).replace(/\\/g, '/')] = f;
  const keys = Object.keys(byPath);
  const tf = keys.find(p => /(^|\/)template\.json$/i.test(p));
  if (!tf) { toast('That folder has no template.json. Pick BepInEx\\plugins\\AdvancedRigs\\GameTemplate (the mod makes it the first time you play, or press F10 in game).', 8000); return; }
  const base = tf.slice(0, tf.length - 'template.json'.length);
  const tpl = JSON.parse(await byPath[tf].text());
  if (tpl.format !== 'luna-ars-game-template') { toast('That template.json isn\'t a Luna Advanced Rig Systems game template.', 6000); return; }
  const af = keys.find(p => p === base + 'animations.json');
  const clips = af ? JSON.parse(await byPath[af].text()) : {};
  const pngs = {};
  for (const n in tpl.sprites || {}) { const f = byPath[base + tpl.sprites[n].file]; if (f) pngs[n] = new Uint8Array(await f.arrayBuffer()); }
  await setGame(tpl, clips, pngs, true);
  toast('Game template loaded from your game: ' + Object.keys(pngs).length + ' sprites, ' + (tpl.gear || []).length + ' wearables, ' + Object.keys(clips).length + ' animations.', 6000);
}
$('#fileTpl').onchange = async (e) => { try { await loadGameTemplateFiles(e.target.files); } catch (er) { console.error(er); toast('Could not load the game template: ' + er.message, 6000); } e.target.value = ''; };
$('#gameBadge').onclick = () => $('#fileTpl').click();
(async () => { try { const g = await idbGet('gameTemplate'); if (g && g.tpl) await setGame(g.tpl, g.clips, g.pngs, false); } catch (e) { } updateGameBadge(); })();

// a layer for a game sprite, placed exactly like the game draws it: its pivot on the part's joint
function gameLayer(d, spriteName, name, role, part) {
  const G = RIG.GAME, im = G.images[spriteName], sp = G.sprites[spriteName]; if (!im || !sp) return null;
  const c = RIG.crop(im.rgba, im.w, im.h); if (!c) return null;
  const k = Math.max(1, Math.round((d.ppu || 8) / 8)); // an HD character: the game's sprite blown up to match
  const J = RIG.J(d, part), px = (sp.pivot ? sp.pivot[0] : im.w / 2) * k, py = (sp.pivot ? sp.pivot[1] : im.h / 2) * k;
  const l = { id: RIG.newId(), name, x: Math.round(J.x - px + c.x * k), y: Math.round(J.y - (im.h * k - py) + c.y * k), w: c.w, h: c.h, rgba: c.rgba, hidden: false, order: d.layers.length, role };
  if (k > 1) { const t = { x: 0, y: 0, w: c.w, h: c.h, rgba: c.rgba }; const tmp = { layers: [t], chains: [], align: { x: 0, y: 0 }, width: 8, height: 8 }; RIG.resizeArt(tmp, k); l.w = t.w; l.h = t.h; l.rgba = t.rgba; RIG.PPU = d.ppu || 8; }
  const rot = part !== 'tail' && RIG.REST[part] ? RIG.REST[part][2] : 0;
  if (rot && role.type === 'part') l.spriteRot = rot; // drawn the way the game turns that sprite (the feet)
  d.layers.push(l); return l;
}
function newFromGame() {
  const G = RIG.GAME, tpl = G.tpl;
  const d = RIG.newDoc('MyCharacter', 200, 200, []); d.align = { x: 100, y: 110 };
  const used = {};
  let head = null;
  for (const L of tpl.limbs || []) {
    if (!RIG.PARTS.includes(L.name) || !L.sprite) continue;
    const nm = used[L.sprite] ? L.sprite + ' (far)' : L.sprite; used[L.sprite] = true;
    const l = gameLayer(d, L.sprite, nm, { type: 'part', part: L.name }, L.name);
    if (L.name === 'Head') head = l;
  }
  const f = tpl.face || {};
  if (head) for (const n of [f.mouth, f.mouthHalf, ...(f.disfigured || []), ...(f.disfiguredHealed || [])]) if (n && n !== f.head) gameLayer(d, n, n, { type: 'state', of: head.id, state: n }, 'Head');
  const eyeNames = new Set(); for (const e of f.eyes || []) { if (e.front) eyeNames.add(e.front); if (e.back) eyeNames.add(e.back); } if (f.eyeGone) eyeNames.add(f.eyeGone); if (f.eyeGoneHealed) eyeNames.add(f.eyeGoneHealed);
  for (const n of eyeNames) gameLayer(d, n, n, { type: 'eye', state: n }, 'Head');
  if (tpl.tail) { const t = gameLayer(d, tpl.tail, tpl.tail, { type: 'ignore' }, 'tail'); if (t) { const ch = RIG.addChain(d, 'Tail', 'tail', [t.id], 'Fluffy tail'); t.role = { type: 'chain', chain: ch.id }; RIG.autoBones(d, ch); } }
  // stack like the game does
  const key = new Map(d.layers.map((l, i) => [l.id, RIG.sortKey(d, l) + i * 1e-6]));
  d.layers.sort((a, b) => key.get(a.id) - key.get(b.id)); d.layers.forEach((l, i) => l.order = i);
  d.hideObjects = ['Nosebleed']; d.hideVanillaTail = true;
  RIG.fitCanvas(d);
  return d;
}
// ---- template browser: every asset from the player's game, pick what to use
// selection keys: part:<Part>, state:<sprite>, eye:<sprite>, tail, gear:<id>, hs:<Part>
function tplCatalog() {
  const G = RIG.GAME; if (!G) return {};
  const t = G.tpl, f = t.face || {}, cat = { body: [], head: [], eyes: [], tail: [], gear: [], health: [] };
  for (const L of t.limbs || []) if (L.sprite && RIG.PARTS.includes(L.name)) cat.body.push({ key: 'part:' + L.name, sprite: L.sprite, label: RIG.PART_LABEL[L.name] });
  const heads = [[f.mouth, 'Mouth open'], [f.mouthHalf, 'Mouth half open'], ...(f.disfigured || []).map((n, i) => [n, 'Jaw ripped off ' + (i + 1)]), ...(f.disfiguredHealed || []).map((n, i) => [n, 'Jaw ripped off ' + (i + 1) + ' (healed)'])];
  for (const [n, lab] of heads) if (n) cat.head.push({ key: 'state:' + n, sprite: n, label: lab });
  const eyes = new Set(); for (const e of f.eyes || []) { if (e.front) eyes.add(e.front); if (e.back) eyes.add(e.back); } if (f.eyeGone) eyes.add(f.eyeGone); if (f.eyeGoneHealed) eyes.add(f.eyeGoneHealed);
  for (const n of eyes) cat.eyes.push({ key: 'eye:' + n, sprite: n, label: (RIG.EYE_LABEL[n] || n) });
  if (t.tail) cat.tail.push({ key: 'tail', sprite: t.tail, label: 'Tail' });
  for (const g of (t.gear || []).slice().sort((a, b) => a.id.localeCompare(b.id))) cat.gear.push({ key: 'gear:' + g.id, sprite: g.sprite, label: g.id + ' · ' + (RIG.PART_LABEL[g.limb] || g.limb) });
  for (const p in t.healthScreen || {}) { const h = t.healthScreen[p]; if (h.outline) cat.health.push({ key: 'hs:' + p, sprite: h.outline, label: 'Health screen: ' + (RIG.PART_LABEL[p] || p) }); }
  return cat;
}
const TB = { tab: 'body', picked: new Set() };
const thumbCrop = new WeakMap();
const TB_TABS = [['body', 'Body parts'], ['head', 'Mouth & jaw'], ['eyes', 'Eyes'], ['tail', 'Tail'], ['gear', 'Wearables'], ['health', 'Health screen']];
function openBrowser() {
  if (!RIG.GAME) { toast('Load the game template first: click "no game template" at the top and pick the GameTemplate folder from your game.', 7000); $('#fileTpl').click(); return; }
  if (!TB.picked.size) { const c = tplCatalog(); for (const k of ['body', 'head', 'eyes', 'tail']) for (const it of c[k]) TB.picked.add(it.key); }
  renderBrowser(); $('#tplBrowser').classList.add('show');
}
function renderBrowser() {
  const cat = tplCatalog();
  $('#tbTabs').innerHTML = TB_TABS.map(([k, lab]) => `<button data-tbt="${k}" class="${TB.tab === k ? 'on' : ''}">${lab} (${(cat[k] || []).length})</button>`).join('');
  const grid = $('#tbGrid'); grid.innerHTML = '';
  for (const it of cat[TB.tab] || []) {
    const card = document.createElement('div'); card.className = 'tcard' + (TB.picked.has(it.key) ? ' on' : '');
    const cvs = document.createElement('canvas'); cvs.width = 96; cvs.height = 72; const g = cvs.getContext('2d'); g.imageSmoothingEnabled = false;
    const full = RIG.GAME.images[it.sprite];
    const im = full ? (thumbCrop.get(full) || (() => { const c = RIG.crop(full.rgba, full.w, full.h) || full; thumbCrop.set(full, c); return c; })()) : null;
    if (im) { const k = Math.max(1, Math.floor(Math.min(90 / im.w, 66 / im.h))); g.drawImage(layerCanvas(im), (96 - im.w * k) / 2, (72 - im.h * k) / 2, im.w * k, im.h * k); }
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.label; nm.title = it.label + (it.sprite ? '  (' + it.sprite + ')' : '');
    const tick = document.createElement('div'); tick.className = 'tick'; tick.textContent = TB.picked.has(it.key) ? '✔' : '';
    card.append(tick, cvs, nm);
    card.onclick = () => { if (TB.picked.has(it.key)) TB.picked.delete(it.key); else TB.picked.add(it.key); renderBrowser(); };
    grid.appendChild(card);
  }
  $('#tbTabs').querySelectorAll('[data-tbt]').forEach(b => b.onclick = () => { TB.tab = b.dataset.tbt; renderBrowser(); });
  $('#tbCount').textContent = TB.picked.size + ' ticked';
}
$('#tbAll').onclick = () => { for (const it of tplCatalog()[TB.tab] || []) TB.picked.add(it.key); renderBrowser(); };
$('#tbNone').onclick = () => { for (const it of tplCatalog()[TB.tab] || []) TB.picked.delete(it.key); renderBrowser(); };
$('#tbClose').onclick = () => $('#tplBrowser').classList.remove('show');
$('#btnBrowse').onclick = openBrowser;
// put the picked assets into a character, placed exactly like the game draws them
function addFromGame(d, keys) {
  const G = RIG.GAME, t = G.tpl; let n = 0;
  const has = (k) => keys.has(k);
  const usedSprite = {}; for (const l of d.layers) usedSprite[l.name] = true;
  let head = d.layers.find(l => l.role.type === 'part' && l.role.part === 'Head');
  for (const L of t.limbs || []) {
    if (!RIG.PARTS.includes(L.name) || !L.sprite || !has('part:' + L.name)) continue;
    const nm = usedSprite[L.sprite] ? L.sprite + ' (far)' : L.sprite; usedSprite[L.sprite] = true;
    const l = gameLayer(d, L.sprite, nm, { type: 'part', part: L.name }, L.name); if (l) { n++; if (L.name === 'Head') head = l; }
  }
  for (const k of keys) {
    if (k.startsWith('state:')) {
      if (!head) { const HL = (t.limbs || []).find(x => x.name === 'Head'); if (HL) head = gameLayer(d, HL.sprite, HL.sprite, { type: 'part', part: 'Head' }, 'Head'); }
      if (head && gameLayer(d, k.slice(6), k.slice(6), { type: 'state', of: head.id, state: k.slice(6) }, 'Head')) n++;
    } else if (k.startsWith('eye:')) { if (gameLayer(d, k.slice(4), k.slice(4), { type: 'eye', state: k.slice(4) }, 'Head')) { n++; d.hideObjects = d.hideObjects.filter(o => o !== 'Eyes'); } }
    else if (k === 'tail' && t.tail) { const tl = gameLayer(d, t.tail, t.tail, { type: 'ignore' }, 'tail'); if (tl) { const ch = RIG.addChain(d, 'Tail', 'tail', [tl.id], 'Fluffy tail'); tl.role = { type: 'chain', chain: ch.id }; RIG.autoBones(d, ch); d.hideVanillaTail = true; n++; } }
    else if (k.startsWith('gear:')) {
      const g = (t.gear || []).find(x => x.id === k.slice(5)); if (!g) continue;
      for (const w of [{ limb: g.limb, sprite: g.sprite }, ...(g.extra || [])]) {
        if (!w.sprite || d.layers.some(o => o.role.type === 'gear' && o.role.sprite === w.sprite)) continue;
        const l = gameLayer(d, w.sprite, w.sprite, { type: 'gear', sprite: w.sprite, limb: w.limb, item: g.id }, w.limb);
        if (l) { if (RIG.REST[w.limb] && RIG.REST[w.limb][2]) l.spriteRot = RIG.REST[w.limb][2]; n++; }
      }
    } else if (k.startsWith('hs:')) {
      const p = k.slice(3), h = (t.healthScreen || {})[p]; if (!h) continue;
      const e = d.healthScreen[p] = d.healthScreen[p] || { scale: 3 };
      if (h.outline && G.images[h.outline]) e.outline = G.images[h.outline];
      if (h.middle && G.images[h.middle]) e.middle = G.images[h.middle];
      if (e.x === undefined) { e.x = h.x; e.y = h.y; e.mirror = !!h.mirror; e.scale = h.outline && G.images[h.outline] && h.w ? h.w / G.images[h.outline].w : 3; }
      n++;
    }
  }
  const key = new Map(d.layers.map((l, i) => [l.id, RIG.sortKey(d, l) + i * 1e-6]));
  d.layers.sort((a, b) => key.get(a.id) - key.get(b.id)); d.layers.forEach((l, i) => l.order = i);
  RIG.fitCanvas(d);
  return n;
}
$('#tbNew').onclick = () => {
  if (!TB.picked.size) { toast('Tick something first'); return; }
  if (doc && doc.layers.length && !confirm('Start a new character from the ticked assets? The open one is closed (save it first if you want to keep it).')) return;
  const d = RIG.newDoc('MyCharacter', 200, 200, []); d.align = { x: 100, y: 110 }; d.hideObjects = ['Nosebleed']; d.hideVanillaTail = false;
  const n = addFromGame(d, TB.picked); $('#tplBrowser').classList.remove('show'); setDoc(d); toast(n + ' assets from your game, placed exactly like the game. Repaint: select → Download PNG → Replace.', 6000);
};
$('#tbAdd').onclick = () => {
  if (!doc) { $('#tbNew').click(); return; }
  if (!TB.picked.size) { toast('Tick something first'); return; }
  pushUndo(); const n = addFromGame(doc, TB.picked); $('#tplBrowser').classList.remove('show'); imgCache.clear(); refresh(); startTestIfOpen();
  toast(n + ' assets added to your character (Ctrl+Z to undo).', 5000);
};

$('#btnTemplate').onclick = async () => {
  if (!RIG.GAME) {
    toast('Pick the GameTemplate folder from your game: BepInEx\\plugins\\AdvancedRigs\\GameTemplate. The mod makes it the first time you play with it (or press F10 in game).', 9000);
    $('#fileTpl').click(); return;
  }
  if (doc && doc.layers.length && !confirm('Start over from the game template? Your current character is closed (save it first if you want to keep it).')) return;
  setDoc(newFromGame());
  toast('Your game\'s character, put together exactly like the game: near and far limbs, every mouth / jaw state, every eye. Select a part → Download PNG → repaint → Replace.', 7000);
};
$('#fileSprites').onchange = (e) => { addImages(e.target.files); e.target.value = ''; };
$('#btnOpen').onclick = () => $('#file').click();
$('#btnSave').onclick = () => saveProject();
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); } });
$('#file').onchange = (e) => { openFiles(e.target.files); e.target.value = ''; };
const stage = $('#stage');
stage.addEventListener('dragover', (e) => { e.preventDefault(); $('#drop').classList.add('over'); $('#drop').style.display = 'flex'; });
stage.addEventListener('dragleave', () => { $('#drop').classList.remove('over'); if (doc) $('#drop').style.display = 'none'; });
stage.addEventListener('drop', (e) => {
  e.preventDefault(); $('#drop').classList.remove('over');
  const fs = [...e.dataTransfer.files];
  // with a character open, dropped images are added to it; a PSD or rig.json starts over
  if (doc && !psd_or_rig(fs)) addImages(fs); else openFiles(fs);
});
$('#btnAuto').onclick = () => { if (!doc) return; RIG.autoAssign(doc); selChain = doc.chains[0] ? doc.chains[0].id : null; refresh(); toast('Parts and bones set up automatically'); };
$('#name').oninput = (e) => { if (doc) doc.name = e.target.value.replace(/[^A-Za-z0-9_\- ]/g, '') || 'MyCharacter'; };
// editor look: the Casualties lab-terminal theme, or the plain one (kept in this browser)
const THEMES = ['casualties', 'plain'];
// canvas colours per theme
const PALS = {
  plain: { bg: '#101115', sheet: '#17181d', sheetLine: '#2a2c34', grid: '#1b1d23', ground: '#1b1d23', groundLine: '#3a3d47', box: '#23252d', text: '#9a9caa' },
  casualties: { bg: '#060708', sheet: '#0b0f0d', sheetLine: '#1f3a2a', grid: '#0f1912', ground: '#0d1310', groundLine: '#2f5a3d', box: '#141c17', text: '#7fb98f' }
};
const CV = () => PALS[document.documentElement.getAttribute('data-theme')] || PALS.plain;
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('luna-ars-theme', t); } catch (e) { } if (doc) draw(); }
try { const t = localStorage.getItem('luna-ars-theme'); if (THEMES.includes(t)) document.documentElement.setAttribute('data-theme', t); } catch (e) { }
$('#btnTheme').onclick = () => { const cur = document.documentElement.getAttribute('data-theme') || 'casualties'; setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]); };
$('#btnHelp').onclick = () => $('#help').classList.add('show');
$('#helpClose').onclick = () => $('#help').classList.remove('show');

// ---------------------------------------------------------------- left: layers
function roleOptions(l) {
  let h = `<option value="ignore">— not used —</option><optgroup label="Body part (replaces the game's)">`;
  for (const p of RIG.PARTS) h += `<option value="part:${p}">${RIG.PART_LABEL[p]}</option>`;
  h += `</optgroup><optgroup label="Moving part (tail, wing, hair…)">`;
  for (const c of doc.chains) h += `<option value="chain:${c.id}">${esc(c.name)}</option>`;
  h += `<option value="newchain">+ New moving part…</option></optgroup>`;
  const injurable = doc.chains.filter(c => c.injury && c.injury.enabled);
  const partLayers = doc.layers.filter(o => o.role.type === 'part' && o.id !== l.id);
  if (injurable.length || partLayers.length) {
    h += `<optgroup label="Injury art (shown while that part is hurt)">`;
    for (const c of injurable) c.segs.forEach((sg, k) => { if (sg.layer !== l.id) h += `<option value="injury:${sg.layer}">${esc(c.name)} piece ${k + 1}</option>`; });
    for (const o of partLayers) h += `<option value="injury:${o.id}">${esc(o.name)} (${RIG.PART_LABEL[o.role.part]})</option>`;
    h += `</optgroup>`;
  }
  if (l.role.type === 'gear') h += `<option value="gear">Worn gear: ${esc(l.role.item || l.role.sprite)}</option>`;
  if (l.role.type === 'frame') h += `<option value="frame:${l.role.of}">Animation frame of ${esc((RIG.layer(doc, l.role.of) || {}).name || '?')}</option>`;
  const heads = doc.layers.filter(o => o.role.type === 'part' && o.role.part === 'Head');
  h += `<optgroup label="Eyes (the game swaps these by mood)">`; for (const [k, lab] of RIG.EYE_STATES) h += `<option value="eye:${k}">Eyes: ${lab}</option>`; h += `</optgroup>`;
  if (heads.length) { h += `<optgroup label="Head art: mouth & injuries">`; for (const st of RIG.HEAD_STATES) h += `<option value="state:${heads[0].id}:${st}">${RIG.HEAD_STATE_LABEL[st] || st}</option>`; h += `</optgroup>`; }
  return h;
}
function roleValue(l) {
  const r = l.role; if (r.type === 'part') return 'part:' + r.part; if (r.type === 'chain') return 'chain:' + r.chain;
  if (r.type === 'state') return 'state:' + r.of + ':' + r.state;
  if (r.type === 'injury') return 'injury:' + r.of;
  if (r.type === 'frame') return 'frame:' + r.of; if (r.type === 'eye') return 'eye:' + r.state; if (r.type === 'gear') return 'gear'; return 'ignore';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let dragRow = null;
// ---- layer list: folders (only for keeping things tidy; nothing changes in game), several layers selected at once
let selSet = new Set(), dragFolder = null, lyQuery = '', lyKind = '', xray = false;
let manualMode = (() => { try { return localStorage.getItem('luna-ars-manual') === '1'; } catch (e) { return false; } })();
// while dragging in the layer list, scroll it when the pointer is near its top / bottom edge
function layerScroller() { let el = $('#layers'); while (el && el !== document.body) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return el; el = el.parentElement; } return null; }
document.addEventListener('dragover', (e) => {
  if (!dragRow && !dragFolder) return; const sc = layerScroller(); if (!sc) return;
  const r = sc.getBoundingClientRect(), edge = 60;
  if (e.clientX < r.left || e.clientX > r.right) return;
  if (e.clientY < r.top + edge) sc.scrollTop -= Math.ceil((r.top + edge - e.clientY) / 3) + 4;
  else if (e.clientY > r.bottom - edge) sc.scrollTop += Math.ceil((e.clientY - (r.bottom - edge)) / 3) + 4;
});
const folderOf = (l) => l.folder && doc.folders ? doc.folders.find(f => f.id === l.folder) : null;
function shownRows() { // the layer rows in list order (top of the stack first), folders' layers right under their folder
  const rows = [...doc.layers].filter(l => !l.cutSource).reverse(); const out = [], done = new Set();
  for (const f of (doc.folders || [])) if (!doc.layers.some(o => o.folder === f.id && !o.cutSource)) out.push({ f, members: [] }); // empty folders: at the top until something goes in
  for (const l of rows) {
    const f = folderOf(l);
    if (!f) { out.push({ l }); continue; }
    if (done.has(f.id)) continue; done.add(f.id);
    const members = rows.filter(o => o.folder === f.id);
    out.push({ f, members });
    if (f.open) for (const m of members) out.push({ l: m, inF: true });
  }
  return out;
}
function selectedLayers() { return doc ? doc.layers.filter(l => selSet.has(l.id)) : []; }
function moveLayersTo(list, target, above) { // keep their order, put them next to target in the stack
  const set = new Set(list.map(l => l.id)); if (set.has(target.id)) return;
  const keep = doc.layers.filter(l => !set.has(l.id)); const at = keep.indexOf(target) + (above ? 1 : 0);
  keep.splice(at, 0, ...doc.layers.filter(l => set.has(l.id))); doc.layers = keep; doc.layers.forEach((o, k) => o.order = k);
}
function renderLayers() {
  const box = $('#layers');
  const n = $('#lySelN'); if (n) n.textContent = selSet.size > 1 ? selSet.size + ' selected' : '';
  if (!doc || !doc.layers.length) { box.innerHTML = doc && Object.keys(doc.spriteSwaps).length ? '<div class="empty">Skin-only rig (sprite swaps). Open a PSD too if you want moving parts.</div>' : '<div class="empty">Open a PSD/PSB (or PNG layers) to start.</div>'; return; }
  if (selLayer && !selSet.has(selLayer)) selSet = new Set([selLayer]);
  if (!selLayer && selSet.size === 1) selSet.clear();
  for (const id of [...selSet]) if (!RIG.layer(doc, id)) selSet.delete(id);
  box.innerHTML = '';
  // search / filter: a flat list of the matching layers
  if (lyQuery || lyKind) {
    const q = lyQuery.toLowerCase();
    const kindOf = (l) => l.role.type === 'state' ? 'eye' : l.role.type;
    const list = [...doc.layers].filter(l => !l.cutSource).reverse().filter(l => (!q || l.name.toLowerCase().includes(q) || (folderOf(l) && folderOf(l).name.toLowerCase().includes(q))) && (!lyKind || kindOf(l) === lyKind));
    if (!list.length) { box.innerHTML = '<div class="empty">No layers match.</div>'; return; }
    for (const l of list) box.appendChild(layerRow(l, false, list));
    updateBulk(); const sa = $('#lySugAll'); if (sa) sa.style.display = doc.layers.some(l => l.suggest && l.role.type === 'ignore') ? '' : 'none'; return;
  }
  const rows = shownRows(); const flat = rows.filter(r => r.l).map(r => r.l);
  for (const r of rows) box.appendChild(r.f ? folderRow(r.f, r.members) : layerRow(r.l, r.inF, flat));
  updateBulk(); const sa = $('#lySugAll'); if (sa) sa.style.display = doc.layers.some(l => l.suggest && l.role.type === 'ignore') ? '' : 'none';
}
function folderRow(f, members) {
  const row = document.createElement('div'); row.className = 'folderRow';
  row.innerHTML = `<span>${f.open ? '▾' : '▸'}</span><span>📁</span><span class="fn" title="Double-click to rename">${esc(f.name)} <span class="muted">(${members.length})</span></span><button data-k="ung" title="Remove the folder, keep its layers">Ungroup</button><button data-k="del" title="Delete the folder and every layer in it">🗑</button>`;
  row.onclick = (e) => { if (e.target.closest('button')) return; f.open = !f.open; renderLayers(); };
  row.ondblclick = (e) => { e.stopPropagation(); const nm = prompt('Folder name', f.name); if (nm && nm.trim()) { f.name = nm.trim(); renderLayers(); } };
  row.querySelector('[data-k=ung]').onclick = () => { pushUndo(); for (const l of members) delete l.folder; doc.folders = doc.folders.filter(x => x !== f); renderLayers(); toast('Ungrouped ' + f.name + '. Ctrl+Z to undo.'); };
  row.querySelector('[data-k=del]').onclick = () => { if (!confirm('Delete the folder "' + f.name + '" and its ' + members.length + ' layer(s)?')) return; deleteLayers(members); doc.folders = doc.folders.filter(x => x !== f); renderLayers(); };
  // drag a folder to move all its layers up / down the list (in front / behind) together
  row.draggable = true;
  row.ondragstart = (e) => { dragFolder = f.id; dragRow = null; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', f.id); } catch (er) { } };
  row.ondragend = () => { dragFolder = null; dragRow = null; };
  // drop layers on a folder to put them in it (their drawing order doesn't change); drop a folder on a folder to move it there
  row.ondragover = (e) => { if (!dragRow && !dragFolder) return; e.preventDefault(); row.classList.add('drop'); };
  row.ondragleave = () => row.classList.remove('drop');
  row.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); row.classList.remove('drop');
    if (dragFolder) { const df = doc.folders.find(x => x.id === dragFolder); dragFolder = null; if (!df || df === f || !members.length) return;
      const mine = doc.layers.filter(o => o.folder === df.id); if (!mine.length) { doc.folders.splice(doc.folders.indexOf(df), 1); doc.folders.splice(doc.folders.indexOf(f), 0, df); renderLayers(); return; }
      pushUndo(); const top = members.reduce((a, b) => doc.layers.indexOf(a) > doc.layers.indexOf(b) ? a : b); moveLayersTo(mine, top, true); refresh(); startTestIfOpen(); return; }
    const src = dragRow && RIG.layer(doc, dragRow); dragRow = null; if (!src) return;
    pushUndo(); const list = selSet.has(src.id) ? selectedLayers() : [src]; for (const l of list) l.folder = f.id; f.open = true; renderLayers(); };
  return row;
}
function layerRow(l, inF, flat) {
  const row = document.createElement('div'); row.className = 'layer' + (selSet.has(l.id) || l.id === selLayer ? ' sel' : '') + (l.role.type === 'ignore' ? ' hiddenL' : '') + (inF ? ' inF' : '');
  const th = document.createElement('canvas'); th.width = 34; th.height = 34;
  const g = th.getContext('2d'); g.imageSmoothingEnabled = false; const s = Math.min(34 / l.w, 34 / l.h);
  g.drawImage(layerCanvas(l), (34 - l.w * s) / 2, (34 - l.h * s) / 2, l.w * s, l.h * s);
  const right = document.createElement('div');
  right.innerHTML = `<div class="nm">${l._new ? '<span class="pill" style="background:var(--acc);color:#fff;border-color:var(--acc)">NEW</span> ' : ''}${esc(l.name)} ${l.hidden ? '<small>(hidden)</small>' : ''}</div><select>${roleOptions(l)}</select>`;
  if (l.suggest && l.role.type === 'ignore') {
    const sg = document.createElement('div'); sg.className = 'sug';
    sg.innerHTML = `<span title="Guessed from where it sits on the body">${esc(l.suggest.label)}?</span><button data-k="ok" title="Yes, use that">✓</button><button data-k="no" title="No">✗</button>`;
    sg.querySelector('[data-k=ok]').onclick = (e) => { e.stopPropagation(); applySuggestion(l); };
    sg.querySelector('[data-k=no]').onclick = (e) => { e.stopPropagation(); delete l.suggest; renderLayers(); };
    right.appendChild(sg);
  }
  const sel = right.querySelector('select'); sel.value = roleValue(l);
  sel.onclick = (e) => e.stopPropagation();
  sel.onchange = () => setRole(l, sel.value);
  row.append(th, right);
  row.onclick = (e) => {
    if (e.ctrlKey || e.metaKey) { if (selSet.has(l.id)) { selSet.delete(l.id); if (selLayer === l.id) selLayer = [...selSet][0] || null; } else { selSet.add(l.id); selLayer = l.id; } renderLayers(); renderInspector(); draw(); return; }
    if (e.shiftKey && selLayer && flat) { const a = flat.findIndex(o => o.id === selLayer), b = flat.findIndex(o => o.id === l.id); if (a >= 0 && b >= 0) { const [lo, hi] = a < b ? [a, b] : [b, a]; for (let k = lo; k <= hi; k++) selSet.add(flat[k].id); } renderLayers(); return; }
    selSet = new Set([l.id]); selectLayer(l.id);
  };
  // drag rows to change what's drawn in front (top of the list = in front); several selected rows move together
  row.draggable = true;
  row.ondragend = () => { dragRow = null; dragFolder = null; };
  row.ondragstart = (e) => { dragRow = l.id; dragFolder = null; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', l.id); } catch (er) { } };
  row.ondragover = (e) => { if (!dragRow && !dragFolder) return; e.preventDefault(); const r = row.getBoundingClientRect(); row.style.boxShadow = (e.clientY < r.top + r.height / 2) ? 'inset 0 2px 0 var(--acc2)' : 'inset 0 -2px 0 var(--acc2)'; };
  row.ondragleave = () => { row.style.boxShadow = ''; };
  row.ondrop = (e) => {
    e.preventDefault(); e.stopPropagation(); row.style.boxShadow = '';
    const r = row.getBoundingClientRect(); const above = e.clientY < r.top + r.height / 2; // above in the list = in front
    if (dragFolder) { // a whole folder dropped here: its layers move next to this one, still in their folder
      const df = doc.folders.find(x => x.id === dragFolder); dragFolder = null; if (!df) return;
      const mine = doc.layers.filter(o => o.folder === df.id && o !== l); if (!mine.length) return;
      pushUndo(); moveLayersTo(mine, l, above); refresh(); startTestIfOpen(); return;
    }
    const src = dragRow && RIG.layer(doc, dragRow); dragRow = null; if (!src || src === l) return;
    pushUndo(); const list = selSet.has(src.id) ? selectedLayers() : [src];
    moveLayersTo(list, l, above);
    // dropped among a folder's layers = into that folder; dropped outside = out of it
    for (const m of list) { if (l.folder) m.folder = l.folder; else delete m.folder; }
    refresh(); startTestIfOpen();
  };
  return row;
}
function newFolderFrom(list, name) {
  doc.folders = doc.folders || [];
  const f = { id: RIG.newId(), name: name || 'Folder ' + (doc.folders.length + 1), open: true };
  doc.folders.push(f); for (const l of list) l.folder = f.id; return f;
}
$('#lySugAll').onclick = () => { const list = doc.layers.filter(l => l.suggest && l.role.type === 'ignore'); if (!list.length) return; pushUndo(); window.__noUndo = true; try { for (const l of list) applySuggestion(l); } finally { window.__noUndo = false; } refresh(); toast(list.length + ' guesses used. Ctrl+Z to undo.'); };
$('#lySearch').oninput = (e) => { lyQuery = e.target.value.trim(); renderLayers(); };
$('#lyFilter').onchange = (e) => { lyKind = e.target.value; renderLayers(); };
$('#lyXray').onclick = (e) => { xray = !xray; e.target.classList.toggle('on', xray); draw(); };
$('#manualMode').checked = manualMode;
$('#manualMode').onchange = (e) => { manualMode = e.target.checked; try { localStorage.setItem('luna-ars-manual', manualMode ? '1' : '0'); } catch (er) { }
  toast(manualMode ? 'Manual setup: new files keep their layout and get no roles. Set roles on the left (select several → set role), move parts, place bones yourself.' : 'Automatic setup: new files are matched and put together by their layer names.', 7000); };
// one role for every selected layer
function updateBulk() {
  const bar = $('#lyBulkBar'); if (!bar) return; const list = selectedLayers();
  if (list.length < 2) { bar.style.display = 'none'; return; }
  bar.style.display = ''; $('#lyBulk').innerHTML = '<option value="">Set role for the ' + list.length + ' selected…</option>' + roleOptions(list[0]).replace(/ selected/g, '');
}
$('#lyBulk').onchange = (e) => {
  const v = e.target.value; e.target.value = ''; const list = selectedLayers(); if (!v || !list.length) return;
  pushUndo(); window.__noUndo = true;
  try {
    if (v === 'newchain') { // all of them become one moving part, top of the list = base
      const ordered = [...list].sort((a, b) => b.order - a.order);
      setRole(ordered[0], 'newchain'); const ch = doc.chains.find(c => c.segs.some(sg => sg.layer === ordered[0].id));
      for (const l of ordered.slice(1)) setRole(l, 'chain:' + ch.id);
    } else for (const l of list) setRole(l, v);
  } finally { window.__noUndo = false; }
  refresh(); toast('Role set for ' + list.length + ' layers. Ctrl+Z to undo.');
};
$('#lyFolder').onclick = () => {
  if (!doc) return; const list = selectedLayers();
  const nm = prompt('Folder name', 'Folder ' + ((doc.folders || []).length + 1)); if (nm === null) return;
  pushUndo(); newFolderFrom(list, nm.trim() || undefined); renderLayers();
  if (!list.length) toast('Empty folder made. Drag layers onto it to fill it.');
};
$('#lyDelSel').onclick = () => { if (!doc) return; const list = selectedLayers(); if (!list.length) { toast('Select layers first.'); return; } if (list.length > 1 && !confirm('Delete ' + list.length + ' layers?')) return; deleteLayers(list); };

function removeFrame(l) {
  for (const id in doc.anims) for (const k in doc.anims[id]) {
    const set = doc.anims[id][k]; set.frames = set.frames.filter(f => f !== l.id || f === id);
    if (!set.frames.length) delete doc.anims[id][k];
  }
}
function setRole(l, v) {
  if (v.startsWith('frame:') || v === 'gear') return;
  if (!window.__noUndo) pushUndo(); delete l._new;
  removeFromChain(l); removeFrame(l);
  if (v === 'ignore') l.role = { type: 'ignore' };
  else if (v.startsWith('part:')) { l.role = { type: 'part', part: v.slice(5) }; }
  else if (v.startsWith('state:')) { const [, of, st] = v.split(':'); l.role = { type: 'state', of, state: st }; }
  else if (v.startsWith('eye:')) { l.role = { type: 'eye', state: v.slice(4) }; doc.hideObjects = doc.hideObjects.filter(o => o !== 'Eyes'); }
  else if (v.startsWith('injury:')) { l.role = { type: 'injury', of: v.slice(7), state: guessState(l.name) }; selLayer = l.id; selChain = null; }
  else if (v === 'newchain') {
    const ch = RIG.addChain(doc, l.name, 'tail', [l.id], 'Fluffy tail'); l.role = { type: 'chain', chain: ch.id };
    if (/ear|hair|fringe|floof/i.test(l.name)) { ch.attachTo = 'Head'; applyPreset(ch, 'Hair / ears floof'); }
    if (/wing/i.test(l.name)) { ch.attachTo = 'UpTorso'; applyPreset(ch, 'Wings'); }
    RIG.autoBones(doc, ch); selChain = ch.id;
  } else if (v.startsWith('chain:')) {
    const ch = RIG.chain(doc, v.slice(6)); l.role = { type: 'chain', chain: ch.id };
    const keep = manualMode ? ch.segs.map(sg => ({ joint: sg.joint, tip: sg.tip })) : null;
    ch.segs.push({ layer: l.id, joint: RIG.center(l), tip: null, restAngle: 0, maxBend: -1 });
    RIG.autoBones(doc, ch); selChain = ch.id;
    if (keep) keep.forEach((k, i) => { ch.segs[i].joint = k.joint; ch.segs[i].tip = k.tip; }); // manual: your bones stay where you put them
  }
  // a new tail hides the game's; taking one away never brings the game's tail back by itself (Rig tab → Hide game tail)
  if (doc.chains.some(c => c.attachTo === 'tail')) doc.hideVanillaTail = true;
  delete l.suggest; learnRoles();
  refresh();
}
// remember how your layers are named: next time the same names (or the same pattern, numbers aside) are set up for you
function learnRoles() {
  if (!doc) return; const L = {};
  for (const l of doc.layers) {
    if (l.cutSource || RIG.classifyKnown(l.name)) continue; // names the editor already knows don't need teaching
    const key = RIG.nameKey(l.name); if (!key) continue;
    let r = null;
    if (l.role.type === 'part') r = { t: 'part', part: l.role.part };
    else if (l.role.type === 'eye') r = { t: 'eye', state: l.role.state };
    else if (l.role.type === 'chain') { const ch = RIG.chain(doc, l.role.chain); if (ch) r = { t: 'chain', chain: ch.name, attachTo: ch.attachTo, preset: ch.preset, k: ch.segs.findIndex(sg => sg.layer === l.id) }; }
    if (!r) continue;
    L[RIG.exactKey(l.name)] = r;
    const pr = r.t === 'chain' ? { t: 'chain', chain: r.chain, attachTo: r.attachTo, preset: r.preset } : r; // a pattern for numbered pieces of one moving part
    const prev = L[key]; L[key] = !prev || JSON.stringify(prev) === JSON.stringify(pr) ? pr : { conflict: true };
  }
  Object.assign(RIG.learned, L); doc.learned = Object.assign(doc.learned || {}, L);
  try { localStorage.setItem('luna-ars-learned', JSON.stringify(RIG.learned)); } catch (e) { }
}
try { Object.assign(RIG.learned, JSON.parse(localStorage.getItem('luna-ars-learned') || '{}')); } catch (e) { }
function applySuggestion(l) {
  const v = l.suggest && l.suggest.value; if (!v) return;
  if (v.startsWith('part:')) { setRole(l, v); return; }
  const at = v.slice(6); setRole(l, 'newchain');
  const ch = doc.chains.find(c => c.segs.some(sg => sg.layer === l.id)); if (!ch) return;
  ch.attachTo = at; applyPreset(ch, at === 'Head' ? 'Hair / ears floof' : at === 'tail' ? 'Fluffy tail' : 'Rigid (no physics)'); learnRoles(); refresh();
}
function guessState(name) {
  const n = name.toLowerCase();
  for (const [k] of RIG.INJURY_STATES) if (n.includes(k)) return k;
  if (/bandage/.test(n)) return 'bandaged'; if (/scratch/.test(n)) return 'scratched'; if (/wound|cut|hurt/.test(n)) return 'wounded';
  if (/stub|stump|torn/.test(n)) return 'stump'; if (/bleed|blood/.test(n)) return 'bleeding'; if (/shard|glass/.test(n)) return 'shrapnel';
  return 'wounded';
}
function pieceName(layerId) {
  for (const c of doc.chains) { const k = c.segs.findIndex(s => s.layer === layerId); if (k >= 0) return c.name + ' piece ' + (k + 1); }
  return '?';
}
function removeFromChain(l) {
  for (const c of doc.chains) c.segs = c.segs.filter(s => s.layer !== l.id);
  doc.chains = doc.chains.filter(c => c.segs.length);
  if (selChain && !RIG.chain(doc, selChain)) selChain = null;
}
function selectLayer(id) {
  if (animPrev && animPrev.id !== id) stopAnimPrev();
  selLayer = id; animFocus = false; const l = RIG.layer(doc, id);
  selChain = l && l.role.type === 'chain' ? l.role.chain : null;
  refresh();
}

// ---------------------------------------------------------------- right: inspector
function applyPreset(ch, name) {
  ch.preset = name; const p = RIG.PRESETS[name];
  if (!p) { ch.physics = false; return; }
  ch.physics = true; Object.assign(ch.motion, p);
}
const SLIDERS = [
  ['damping', 'Damping', 0, 0.6, 0.01, 'Calmer ↔ bouncier'], ['elasticity', 'Springiness', 0, 0.6, 0.01, 'Pull back to the drawn shape'],
  ['elasticityFalloff', 'Spring at tip', 0.05, 1.5, 0.05, 'Lower = looser, whippier tip'], ['stiffness', 'Stiffness', 0, 1, 0.01, 'How far it can be pushed out of shape'],
  ['stiffnessFalloff', 'Stiffness at tip', 0.05, 1.5, 0.05, ''], ['gravity', 'Gravity', 0, 12, 0.1, 'Droop'],
  ['drag', 'Air drag', 0, 8, 0.1, 'Trails behind when moving'], ['inertia', 'Follow body', 0, 1, 0.01, '1 = moves stiffly with the body'],
  ['maxBend', 'Max bend°', 0, 120, 1, 'Per piece'], ['wagAmplitude', 'Wag°', 0, 40, 0.5, 'Idle wag'], ['wagSpeed', 'Wag speed', 0, 5, 0.05, 'Per second'],
  ['wagPhase', 'Wag wave', 0, 2, 0.05, 'Delay toward the tip'], ['wagWhileMoving', 'Wag when running', 0, 1, 0.05, ''],
  ['flapAmplitude', 'Flap°', 0, 70, 1, 'Wing beat'], ['flapSpeed', 'Flap speed', 0, 6, 0.05, 'Beats per second'], ['flapPhase', 'Flap wave', 0, 2, 0.05, '']
];
function renderInspector() {
  const box = $('#insp');
  if (!doc) {
    const at = autosaveInfo();
    box.innerHTML = '<div class="empty">Nothing open yet.<br><br>' + (at ? '<button id="restoreAuto" class="primary">Continue last character</button><br><span class="muted">saved ' + at.toLocaleString() + '</span><br><br>' : '') +
      '<button id="emptyTpl">Start from the game template</button><br><br><button onclick="document.querySelector(\'#btnHelp\').click()">How it works</button></div>';
    const ra = $('#restoreAuto'); if (ra) ra.onclick = restoreAutosave;
    $('#emptyTpl').onclick = () => $('#btnTemplate').click();
    return;
  }
  if (tab === 'health') { box.innerHTML = hsInspector(); bindHsInspector(); return; }
  if (tab === 'anim') { box.innerHTML = animInspectorHtml(); bindAnimateTab(); return; }
  if (tab === 'test') { box.innerHTML = injTesterHtml(); bindInjTester(); return; }
  if (tab === 'gear') { box.innerHTML = gearTabHtml(); bindGearTab(); return; }
  let h = '';
  const ch = selChain && RIG.chain(doc, selChain);
  const l = selLayer && RIG.layer(doc, selLayer);
  if (ch) {
    h += `<h2>Moving part</h2><div class="sec">
      <div class="row"><label>Name</label><input id="chName" type="text" value="${esc(ch.name)}" style="flex:1"></div>
      <div class="row"><label>Attached to</label><select id="chAttach" style="flex:1">${['tail', ...RIG.PARTS].map(p => `<option value="${p}" ${p === ch.attachTo ? 'selected' : ''}>${RIG.PART_LABEL[p]}</option>`).join('')}</select></div>
      <div class="muted" style="margin:8px 0 4px">Pieces (base → tip)</div>
      ${ch.segs.map((s, i) => { const sl = RIG.layer(doc, s.layer); const na = doc.anims[s.layer] ? Object.keys(doc.anims[s.layer]).length : 0; return `<div class="seg"><span>${i + 1}. ${esc(sl ? sl.name : '?')}</span><button data-anim="${s.layer}" title="Animated sprite / frames for this piece">🎞${na ? ' ' + na : ''}</button><button data-pin="${i}" title="${s.maxBend === 0 ? 'Rigid: this piece never bends or swings (click to let it move)' : 'Click to make this piece rigid: no bending, no physics (the pieces after it still swing)'}" ${s.maxBend === 0 ? 'class="on"' : ''}>📌</button><button data-up="${i}" title="Move toward base">↑</button><button data-down="${i}" title="Move toward tip">↓</button></div>`; }).join('')}
      ${doc.chains.length > 1 ? `<div class="row"><label>Join with</label><select id="chMerge" style="flex:1" title="Make the other moving part's pieces hang off the tip of this one, so they move as one (a scarf in 3 pieces, a tail in parts…)"><option value="">another moving part…</option>${doc.chains.filter(o => o !== ch).map(o => `<option value="${o.id}">${esc(o.name)} (${o.segs.length} piece${o.segs.length === 1 ? '' : 's'})</option>`).join('')}</select></div>` : ''}
      ${bonesBox(ch)}
      <div class="row"><label>Preset</label><select id="chPreset" style="flex:1">${Object.keys(RIG.PRESETS).map(p => `<option ${p === ch.preset ? 'selected' : ''}>${p}</option>`).join('')}${RIG.PRESETS[ch.preset] === undefined ? '<option selected>Custom</option>' : ''}</select></div>
      <div class="row"><label>Physics</label><input id="chPhys" type="checkbox" ${ch.physics ? 'checked' : ''}><span class="muted">off = moves rigidly with the body</span></div>
    </div>
    <h2>Injuries</h2><div class="sec">
      <div class="row"><label>Can be injured</label><input id="injOn" type="checkbox" ${ch.injury.enabled ? 'checked' : ''}><span class="muted">off by default</span></div>
      ${ch.injury.enabled ? `
      <div class="muted" style="margin-bottom:6px">Each piece becomes a real limb: hits, bleeding, pain, infection, shards, bandages, splints, amputation, and it can be torn off. Hitboxes don't change.</div>
      <div class="row"><label>Health screen name</label><input id="injName" type="text" value="${esc(ch.injury.name)}" style="flex:1"></div>
      ${ch.segs.length > 1 ? groupsBox(ch) : ''}
      <div class="row"><label>Can be torn off</label><input id="injTear" type="checkbox" ${ch.injury.tearOff ? 'checked' : ''}><span class="muted">bitten / ripped off when destroyed</span></div>
      <div class="row"><label>Game wound shading</label><input id="injShade" type="checkbox" ${ch.injury.gameShading ? 'checked' : ''}><span class="muted">the game's own wound/dirt look</span></div>
      <div class="row"><label>Vital</label><input id="injVital" type="checkbox" ${ch.injury.vital ? 'checked' : ''}><span class="muted" style="color:var(--warn)">destroying it kills!</span></div>
      <div class="muted" style="margin:6px 0 2px">Injury art per piece</div>
      ${ch.segs.map((sg, k) => { const arts = doc.layers.filter(a => a.role.type === 'injury' && a.role.of === sg.layer); return `<div class="seg"><span>${k + 1}. ${arts.length ? arts.map(a => `<span class="pill">${a.role.state}</span>`).join(' ') : '<span class="muted">none yet</span>'}</span></div>`; }).join('')}
      <div class="muted" style="margin-top:4px">Add art: set an extra layer's role to <i>Injury art → ${esc(ch.name)} piece N</i>. Place pieces on the <b>Health screen</b> tab.</div>` : ''}
    </div>`;
    if (ch.physics) {
      h += `<h2>Motion</h2><div class="sec">` + SLIDERS.map(([k, label, mn, mx, st, tip]) =>
        `<div class="row" title="${tip}"><label>${label}</label><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${ch.motion[k]}"><span class="v" id="v_${k}">${(+ch.motion[k]).toFixed(st < 1 ? 2 : 0)}</span></div>`).join('') +
        `<div class="row"><label>Flap when</label><select id="chFlapWhen">${['never', 'air', 'always'].map(o => `<option ${o === ch.motion.flapWhen ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="muted">Changes apply live in the Test tab.</div></div>`;
    }
  } else if (l) {
    h += `<h2>Layer</h2><div class="sec"><b>${esc(l.name)}</b><br><span class="muted">${l.w}×${l.h}px at ${l.x},${l.y}</span>
      <div class="row"><label>In front / behind</label><button id="stUp" title="Draw in front of the layer above it">▲ Forward</button><button id="stDown" title="Draw behind the layer below it">▼ Back</button></div>
      <div class="row"><label>Edit in your art app</label><button id="lyDl" title="Save as a PNG the size of the whole canvas, so it lines up when it comes back">⬇ Download PNG</button><button id="lyRep" title="Load your edited PNG into this layer">⬆ Replace…</button></div>
      <div class="row"><label></label><button id="lyDel" title="Remove this layer (Delete key). Ctrl+Z brings it back.">🗑 Delete layer</button></div>`;
    if (l.role.type === 'part') h += `Rides on the game's <b>${RIG.PART_LABEL[l.role.part]}</b> and hides the game's own sprite for it. It moves, ragdolls and can be cut off exactly like the original part.
      <div class="row" style="margin-top:8px"><label>Bends with</label><select id="bwPart" style="flex:1"><option value="">— only its own part —</option>${RIG.PARTS.filter(p => p !== l.role.part).map(p => `<option value="${p}" ${l.blendWith === p ? 'selected' : ''}>${RIG.PART_LABEL[p]}</option>`).join('')}</select></div>
      ${l.blendWith ? `<div class="row"><label>How much</label><input type="range" id="bwW" min="0" max="1" step="0.05" value="${l.blendWeight !== undefined ? l.blendWeight : 0.5}"><span class="v">${Math.round((l.blendWeight !== undefined ? l.blendWeight : 0.5) * 100)}%</span></div>` : ''}
      <div class="muted">For extra pieces between two of the game's parts: e.g. a 5-piece leg = thigh · knee piece (on the thigh, bending 50% with the shin) · shin · ankle piece (on the shin, 50% with the foot) · foot. Give several layers the same part to add pieces; hitboxes never change.</div>`;
    else if (l.role.type === 'state') h += `Shown instead of your head art when the game switches the head to <b>${RIG.HEAD_STATE_LABEL[l.role.state] || l.role.state}</b>. The game opens the mouth by itself while talking, eating, whimpering, barking, yawning and panting, so mouth-open art makes your character's mouth move.`;
    else if (l.role.type === 'injury') h += `Injury art for <b>${esc(pieceName(l.role.of))}</b>, shown when it is:<div class="row"><select id="injState" style="flex:1">${RIG.INJURY_STATES.map(([k, lab]) => `<option value="${k}" ${k === l.role.state ? 'selected' : ''}>${lab}</option>`).join('')}</select></div><span class="muted">Draw it on the same canvas as the piece (same spot). If several states apply, the one highest in this list wins. Preview it in the Test tab.</span>`;
    else if (l.role.type === 'gear') h += `Your version of <b>${esc(l.role.item || l.role.sprite)}</b>, worn on the <b>${esc(RIG.PART_LABEL[l.role.limb] || l.role.limb)}</b>. It replaces the game's sprite only while you wear it. Drag it to fit your character; Download PNG → repaint → Replace.`;
    else if (l.role.type === 'eye') h += `Eyes shown when the game picks <b>${esc(RIG.EYE_LABEL[l.role.state] || l.role.state)}</b>. Draw them where they go on your head; they move with the head. The game switches eyes by itself (pain, fear, falling, tiredness, happiness, blinking…). Preview them in the Test tab.${eyeMissing()}`;
    else if (l.role.type === 'frame') h += `An animation frame of <b>${esc((RIG.layer(doc, l.role.of) || {}).name || '?')}</b>. Select that layer to edit its animations.`;
    else if (l.role.type === 'chain') h += `A piece of <b>${esc((RIG.chain(doc, l.role.chain) || {}).name || '?')}</b>. <button id="backChain">Edit the moving part</button>`;
    else h += `Not used. Pick a role in the dropdown on the left.`;
    h += `</div>`;
    if (l.role.type === 'part' || l.role.type === 'chain') h += addArtBox(l);
    if (l.role.type === 'part' || l.role.type === 'ignore') h += moveBox(l);
    if (l.role.type === 'part' || l.role.type === 'chain') h += animInspector(l);
  } else h += `<div class="empty">Click a layer on the left, or a part on the canvas.</div>`;

  h += `<h2>Character</h2><div class="sec">
    ${RIG.HIDEABLE.map(o => `<div class="row"><label>Hide game ${o.toLowerCase()}</label><input type="checkbox" data-hide="${o}" ${doc.hideObjects.includes(o) ? 'checked' : ''}></div>`).join('')}
    <div class="row"><label>Hide game tail</label><input type="checkbox" id="hideTail" ${doc.hideVanillaTail ? 'checked' : ''}></div>
    <div class="row"><label>Art scale</label><select id="artScale" title="How many times bigger than the game's own sprites your art is drawn. Bigger art stays sharp in game (exported with more pixels per unit).">${[1, 2, 3, 4, 5, 6, 8].map(k => `<option value="${k}" ${Math.round((doc.ppu || 8) / 8) === k ? 'selected' : ''}>${k}× ${k === 1 ? '(game size)' : 'HD'}</option>`).join('')}</select>${(doc.ppu || 8) > 8 ? '<button id="artShrink" title="Shrink every layer pixel-perfectly to the game\'s own size">Shrink to 1×</button>' : ''}</div>
    ${gearBox()}
    <div class="row"><label>All layers</label><button id="dlAll" title="Every layer as a full-size PNG, to edit in Photoshop, Krita, Paint…; drop them back to update">⬇ PNGs</button><button id="dlPsd" title="Every layer in one Photoshop file (PSD), to repaint everything at once in Photoshop, Krita, GIMP, Photopea…">⬇ PSD</button><button id="dlPsb" title="Same as a PSB (Photoshop large document)">⬇ PSB</button><button id="upPsd" title="Bring your edited PSD / PSB back: same-named layers are updated, new ones are added">⬆ Update from PSD…</button></div>
    <div class="row"><label>Skin swaps</label><span class="pill">${Object.keys(doc.spriteSwaps).length} sprites</span>${Object.keys(doc.spriteSwaps).length ? '<button id="clearSwaps">Remove all</button>' : ''}</div>
    ${Object.keys(doc.spriteSwaps).length ? `<details><summary>show them</summary>${Object.keys(doc.spriteSwaps).sort().map(k => `<div class="seg"><span>${esc(k)}</span><button data-swapdel="${esc(k)}" title="Remove this sprite">✕</button></div>`).join('')}</details>` : ''}
    <div class="row"><label>Sounds</label><span class="pill">${Object.keys(doc.sounds || {}).length} replaced</span></div>
    ${soundsInspector()}
    <div class="muted">Skin swaps replace the game's own sprites by name (add experiment*.png files with <i>Add images…</i>).</div>
  </div>`;
  box.innerHTML = h;

  if (ch) {
    $('#chName').oninput = (e) => { ch.name = e.target.value || 'Part'; renderLayers(); };
    box.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { const sg = ch.segs[+b.dataset.pin]; if (!sg) return; pushUndo(); sg.maxBend = sg.maxBend === 0 ? -1 : 0; if (sg.maxBend === 0 && !ch.physics) toast('Tip: turn Physics on for this moving part so the other pieces swing.'); refresh(); startTestIfOpen(); });
    const mg = $('#chMerge'); if (mg) mg.onchange = () => {
      const o = RIG.chain(doc, mg.value); if (!o) return; pushUndo();
      // the other part's pieces continue from this one's tip, in their own order; its frames and art stay with each piece
      // a still part joined by a swinging one (scarf knot + loose ends): the still pieces get pinned, the rest keep their physics
      if (!ch.physics && o.physics) { ch.segs.forEach(sg => sg.maxBend = 0); ch.physics = true; ch.motion = Object.assign({}, o.motion); ch.preset = o.preset; }
      for (const sg of o.segs) { ch.segs.push(sg); const l = RIG.layer(doc, sg.layer); if (l) l.role = { type: 'chain', chain: ch.id }; }
      if (o.source) { const src = RIG.layer(doc, o.source); if (src) { src.role = { type: 'ignore' }; delete src.cutSource; } }
      doc.chains = doc.chains.filter(x => x !== o);
      RIG.autoBones(doc, ch); learnRoles(); refresh(); startTestIfOpen();
      toast(o.name + ' now hangs off ' + ch.name + ' (' + ch.segs.length + ' pieces). Drag the yellow joints to where the pieces meet. Ctrl+Z to undo.', 7000);
    };
    $('#chAttach').onchange = (e) => { ch.attachTo = e.target.value; RIG.autoBones(doc, ch); doc.hideVanillaTail = doc.chains.some(c => c.attachTo === 'tail'); refresh(); };
    bindBonesBox(ch);
    $('#chPreset').onchange = (e) => { applyPreset(ch, e.target.value); refresh(); };
    $('#chPhys').onchange = (e) => { ch.physics = e.target.checked; refresh(); };
    $('#injOn').onchange = (e) => { ch.injury.enabled = e.target.checked; if (!ch.injury.name) ch.injury.name = ch.name; refresh(); };
    const inn = $('#injName'); if (inn) inn.oninput = (e) => { ch.injury.name = e.target.value; };
    bindGroupsBox(ch);
    const it = $('#injTear'); if (it) it.onchange = (e) => { ch.injury.tearOff = e.target.checked; startTestIfOpen(); };
    const ish = $('#injShade'); if (ish) ish.onchange = (e) => { ch.injury.gameShading = e.target.checked; };
    const iv = $('#injVital'); if (iv) iv.onchange = (e) => { ch.injury.vital = e.target.checked; };
    box.querySelectorAll('[data-anim]').forEach(b => b.onclick = () => { selLayer = b.dataset.anim; selChain = null; animFocus = true; refresh(); });
    box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [ch.segs[i - 1], ch.segs[i]] = [ch.segs[i], ch.segs[i - 1]]; RIG.autoBones(doc, ch); refresh(); } });
    box.querySelectorAll('[data-down]').forEach(b => b.onclick = () => { const i = +b.dataset.down; if (i < ch.segs.length - 1) { [ch.segs[i + 1], ch.segs[i]] = [ch.segs[i], ch.segs[i + 1]]; RIG.autoBones(doc, ch); refresh(); } });
    box.querySelectorAll('input[data-k]').forEach(r => r.oninput = () => {
      ch.motion[r.dataset.k] = +r.value; ch.preset = 'Custom';
      $('#v_' + r.dataset.k).textContent = (+r.value).toFixed(+r.step < 1 ? 2 : 0); liveMotion();
    });
    const fw = $('#chFlapWhen'); if (fw) fw.onchange = (e) => { ch.motion.flapWhen = e.target.value; liveMotion(); };
  }
  const bc = $('#backChain'); if (bc && l) bc.onclick = () => { selChain = l.role.chain; selLayer = null; refresh(); };
  if (l && (l.role.type === 'part' || l.role.type === 'chain')) bindAnimInspector(l);
  if (l && (l.role.type === 'part' || l.role.type === 'ignore')) bindMoveBox(l);
  const bw = $('#bwPart'); if (bw && l) bw.onchange = () => { if (bw.value) { l.blendWith = bw.value; if (l.blendWeight === undefined) l.blendWeight = 0.5; } else delete l.blendWith; refresh(); startTestIfOpen(); };
  const bwW = $('#bwW'); if (bwW && l) { bwW.oninput = () => { l.blendWeight = +bwW.value; bwW.nextElementSibling.textContent = Math.round(l.blendWeight * 100) + '%'; }; bwW.onchange = () => startTestIfOpen(); }
  if (l) { const su = $('#stUp'), sd = $('#stDown'); if (su) su.onclick = () => restack(l, +1); if (sd) sd.onclick = () => restack(l, -1);
    const dl = $('#lyDl'), rp = $('#lyRep'); if (dl) dl.onclick = () => downloadLayer(l); if (rp) rp.onclick = () => pickReplace(l); bindAddArt(l);
    const de = $('#lyDel'); if (de) de.onclick = () => deleteLayer(l); }
  const is = $('#injState'); if (is && l) is.onchange = (e) => { l.role.state = e.target.value; updateHeadStates(); };
  box.querySelectorAll('[data-hide]').forEach(c => c.onchange = () => {
    const o = c.dataset.hide; doc.hideObjects = doc.hideObjects.filter(x => x !== o); if (c.checked) doc.hideObjects.push(o);
  });
  $('#hideTail').onchange = (e) => { doc.hideVanillaTail = e.target.checked; };
  $('#artScale').onchange = (e) => { pushUndo(); doc.ppu = 8 * +e.target.value; syncPpu(); if (doc.layers.some(l => l.role.type === 'part')) RIG.autoAlign(doc); refresh(); startTestIfOpen(); toast('Art scale ' + e.target.value + '×: the game skeleton now matches art drawn at that size.'); };
  const ash = $('#artShrink'); if (ash) ash.onclick = () => { if (!confirm('Shrink every layer to the game\'s own size (pixel-perfect, ' + (doc.ppu / 8) + '× smaller)? Ctrl+Z undoes it.')) return; pushUndo(); RIG.resizeArt(doc, 8 / doc.ppu); imgCache.clear(); fitView(); refresh(); startTestIfOpen(); };
  bindSounds();
  const da = $('#dlAll'); if (da) da.onclick = () => downloadAllLayers();
  const dp = $('#dlPsd'); if (dp) dp.onclick = () => exportPsd(false); const db = $('#dlPsb'); if (db) db.onclick = () => exportPsd(true);
  const up = $('#upPsd'); if (up) up.onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.psd,.psb'; inp.onchange = async () => { const f = inp.files[0]; if (f) await updateFromPsdFile(f); }; inp.click(); };
  bindGearBox();
  const cs = $('#clearSwaps'); if (cs) cs.onclick = () => { if (!confirm('Remove every skin sprite?')) return; pushUndo(); doc.spriteSwaps = {}; refresh(); };
  box.querySelectorAll('[data-swapdel]').forEach(b => b.onclick = () => { pushUndo(); delete doc.spriteSwaps[b.dataset.swapdel]; refresh(); startTestIfOpen(); toast('Removed ' + b.dataset.swapdel + ' (Ctrl+Z to undo)'); });
}

// ---- editing a layer in another program: download it full-canvas (so it lines up), load it back with Replace
function replaceLayerImage(l, d) {
  pushUndo();
  if (d.w === doc.width && d.h === doc.height) { // full canvas: keep exactly where it was drawn
    const c = RIG.crop(d.rgba, d.w, d.h); if (!c) return;
    Object.assign(l, { x: c.x, y: c.y, w: c.w, h: c.h, rgba: c.rgba });
  } else { // a cut-out: keep it centred where the old one was
    const c = RIG.crop(d.rgba, d.w, d.h) || { x: 0, y: 0, w: d.w, h: d.h, rgba: d.rgba };
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    Object.assign(l, { x: Math.round(cx - c.w / 2), y: Math.round(cy - c.h / 2), w: c.w, h: c.h, rgba: c.rgba });
  }
  imgCache.delete(l);
  // a cut image (bones) re-cuts its pieces from the new art
  const ch = doc.chains.find(x => x.source === l.id); if (ch) RIG.recut(doc, ch);
}
async function downloadBlob(blob, name) {
  try { if (window.claude && window.claude.use) { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename: name, data: blob }); return; } } } catch (e) { if (e && e.code === 'declined') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function fullCanvasPng(l) {
  const c = document.createElement('canvas'); c.width = doc.width; c.height = doc.height;
  c.getContext('2d').drawImage(layerCanvas(l), l.x, l.y);
  return new Promise(res => c.toBlob(res, 'image/png'));
}
const safeName = (n) => String(n).replace(/[\\/:*?"<>|]+/g, '_');
async function downloadLayer(l) { await downloadBlob(await fullCanvasPng(l), safeName(l.name) + '.png'); toast('Saved ' + l.name + '.png — edit it (keep the size), then click Replace and pick it', 6000); }
async function downloadAllLayers() {
  const entries = [];
  for (const l of doc.layers) if (!l.cutSource) entries.push({ name: safeName(l.name) + '.png', data: new Uint8Array(await (await fullCanvasPng(l)).arrayBuffer()) });
  await downloadBlob(new Blob([RIG.zip(entries)], { type: 'application/zip' }), safeName(doc.name) + '_layers.zip');
  toast('Every layer saved as a full-size PNG. Edit any of them and drop them back here: layers with the same name are updated.', 7000);
}
// ---- the whole character as one PSD / PSB, and back
function exportLayersFor() {
  const pieces = new Set(); for (const ch of doc.chains) if (ch.source) ch.segs.forEach(sg => pieces.add(sg.layer));
  const used = new Set(), out = [];
  for (const l of doc.layers) {
    if (pieces.has(l.id)) continue; // a cut image is exported whole (its pieces are re-cut when it comes back)
    let name = l.name, i = 2; while (used.has(name)) name = l.name + ' #' + (i++); used.add(name);
    if (name !== l.name) l.name = name; // keep names unique so they match when the file comes back
    const art = l.role.type === 'state' || l.role.type === 'injury' || l.role.type === 'frame' || l.role.type === 'gear' || (l.role.type === 'eye' && l.role.state !== 'experimentEyeOpen') || l.role.type === 'ignore' && !l.cutSource;
    const f = folderOf(l); out.push({ name, x: l.x, y: l.y, w: l.w, h: l.h, rgba: l.rgba, hidden: art, folder: f ? f.name : undefined });
  }
  return out;
}
async function exportPsd(big) {
  if (!doc || !doc.layers.length) { toast('Nothing to export yet'); return; }
  const u = RIG.writePSD(doc.width, doc.height, exportLayersFor(), big);
  const name = (doc.name || 'MyCharacter').replace(/[^A-Za-z0-9_\- ]+/g, '_') + (big ? '.psb' : '.psd');
  await downloadBlob(new Blob([u], { type: 'image/vnd.adobe.photoshop' }), name);
  toast('Saved ' + name + ': every layer, with the extra art (mouths, injuries, frames, eyes, gear) hidden. Paint, add or rename layers, then "Update from PSD…" (or open it again).', 8000);
}
// folders in a PSD (layer groups) become folders here, matched by layer name
function applyPsdFolders(parsed) {
  doc.folders = doc.folders || [];
  const byName = new Map(); for (const l of doc.layers) if (!byName.has(l.name)) byName.set(l.name, l);
  for (const pl of parsed.layers) {
    const l = byName.get(pl.name); if (!l) continue;
    if (!pl.folder) { if (l.folder && parsed.layers.some(x => x.folder)) delete l.folder; continue; }
    let f = doc.folders.find(x => x.name === pl.folder); if (!f) { f = { id: RIG.newId(), name: pl.folder, open: false }; doc.folders.push(f); }
    l.folder = f.id;
  }
}
// bring an edited PSD back: same names update in place (bones, roles, animations kept), anything new is added
function updateFromPsd(parsed) {
  pushUndo();
  const pieces = new Set(); for (const ch of doc.chains) if (ch.source) ch.segs.forEach(sg => pieces.add(sg.layer));
  const byName = new Map(); for (const l of doc.layers) if (!pieces.has(l.id) && !byName.has(l.name)) byName.set(l.name, l);
  let updated = 0; const added = [], touched = new Set();
  let after = null; // keep the file's stacking for new layers: right above the layer before them in the file
  for (const pl of parsed.layers) {
    const c = RIG.crop(pl.rgba, pl.w, pl.h);
    const target = byName.get(pl.name);
    if (target) {
      byName.delete(pl.name); after = target;
      if (!c) continue;
      const img = { x: pl.x + c.x, y: pl.y + c.y, w: c.w, h: c.h, rgba: c.rgba };
      const same = target.x === img.x && target.y === img.y && target.w === img.w && target.h === img.h && target.rgba.length === img.rgba.length && target.rgba.every((v, i) => v === img.rgba[i]);
      if (!same) { Object.assign(target, img); imgCache.delete(target); const ch = doc.chains.find(x => x.source === target.id); if (ch) RIG.recut(doc, ch); updated++; }
      continue;
    }
    if (!c) continue;
    const l = { id: RIG.newId(), name: pl.name, x: pl.x + c.x, y: pl.y + c.y, w: c.w, h: c.h, rgba: c.rgba, hidden: false, order: 0, role: { type: 'ignore' }, _new: true };
    const at = after ? doc.layers.indexOf(after) + 1 : 0; doc.layers.splice(at, 0, l); after = l;
    const ch = RIG.assignOne(doc, l); if (ch) touched.add(ch);
    added.push(l);
  }
  doc.layers.forEach((l, i) => l.order = i);
  applyPsdFolders(parsed);
  for (const ch of touched) RIG.autoBones(doc, ch);
  RIG.fitCanvas(doc);
  const unknown = added.filter(l => l.role.type === 'ignore');
  const missing = [...byName.values()].filter(l => !pieces.has(l.id));
  imgCache.clear(); if (unknown[0]) { selLayer = unknown[0].id; selChain = null; } refresh(); startTestIfOpen();
  toast(`Updated ${updated} layer${updated === 1 ? '' : 's'}` + (added.length ? `, added ${added.length} new (${added.length - unknown.length} recognised by name` + (unknown.length ? `, ${unknown.length} marked NEW: pick what they are on the left` : '') + ')' : '') +
    (missing.length ? `. ${missing.length} layer${missing.length === 1 ? ' is' : 's are'} not in the file and were kept.` : '.') + ' Ctrl+Z to undo.', 9000);
}
async function updateFromPsdFile(f) {
  try { const parsed = RIG.readPSD(await f.arrayBuffer()); if (parsed.width !== doc.width || parsed.height !== doc.height) toast('Note: the canvas size changed (' + parsed.width + '×' + parsed.height + '). Layers are placed from the top-left corner.', 6000); updateFromPsd(parsed); }
  catch (e) { console.error(e); toast('Could not read that file: ' + e.message, 6000); }
}
function pickReplace(l) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.png,image/png';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; replaceLayerImage(l, await decodePng(f)); refresh(); startTestIfOpen(); toast(l.name + ' updated'); };
  inp.click();
}
// extra art for a part: injury looks (every part, like the game's limbs), mouth / jaw states (head), eyes
function addArtBox(l) {
  const isHead = l.role.type === 'part' && l.role.part === 'Head';
  let o = `<optgroup label="When it's hurt (works on every part)">` + RIG.INJURY_STATES.map(([k, lab]) => `<option value="injury:${k}">${lab}</option>`).join('') + `</optgroup>`;
  if (isHead) {
    o += `<optgroup label="Mouth & jaw (head)">` + RIG.HEAD_STATES.map(k => `<option value="state:${k}">${RIG.HEAD_STATE_LABEL[k] || k}</option>`).join('') + `</optgroup>`;
    o += `<optgroup label="Eyes">` + RIG.EYE_STATES.map(([k, lab]) => `<option value="eye:${k}">Eyes: ${lab}</option>`).join('') + `</optgroup>`;
  }
  const have = doc.layers.filter(a => (a.role.type === 'injury' || a.role.type === 'state') && a.role.of === l.id).map(a => a.role.state);
  return `<h2>Extra art for this part</h2><div class="sec">
    <div class="row"><select id="artKind" style="flex:1">${o}</select><button id="artAdd">+ Add</button></div>
    <div class="muted">Adds a copy of this part to repaint for that state (Download PNG → paint → Replace). The game picks the most important state the part is in.${have.length ? '<br>Has: ' + have.map(x => `<span class="pill">${esc(x.replace('experimentHead', ''))}</span>`).join(' ') : ''}</div></div>`;
}
function bindAddArt(l) {
  const b = $('#artAdd'); if (!b) return;
  b.onclick = () => {
    const [kind, st] = $('#artKind').value.split(':');
    let src = l;
    if (kind === 'eye') { const open = doc.layers.find(o => o.role.type === 'eye' && o.role.state === 'experimentEyeOpen'); if (open) src = open; }
    const n = { id: RIG.newId(), name: l.name + '_' + st.replace('experimentHead', '').replace('experiment', ''), x: src.x, y: src.y, w: src.w, h: src.h, rgba: new Uint8ClampedArray(src.rgba), hidden: false, order: 0,
      role: kind === 'injury' ? { type: 'injury', of: l.id, state: st } : kind === 'state' ? { type: 'state', of: l.id, state: st } : { type: 'eye', state: st } };
    if (kind === 'eye') { n.name = st; if (src === l) { n.w = 6; n.h = 4; n.x = Math.round(RIG.J(doc, 'Head').x); n.y = Math.round(RIG.J(doc, 'Head').y - 1); n.rgba = new Uint8ClampedArray(6 * 4 * 4).fill(255); } doc.hideObjects = doc.hideObjects.filter(x => x !== 'Eyes'); }
    doc.layers.splice(doc.layers.indexOf(l) + 1, 0, n); doc.layers.forEach((o, i) => o.order = i);
    selLayer = n.id; selChain = null; refresh(); startTestIfOpen();
    toast('Added ' + n.name + '. Download PNG, repaint it, then Replace.', 4500);
  };
}

// ---- worn gear: every wearable from the game template; make your own version that fits your character
function gearList() { return RIG.GAME ? (RIG.GAME.tpl.gear || []).slice().sort((a, b) => a.id.localeCompare(b.id)) : []; }
function gearBox() {
  if (!RIG.GAME) return `<div class="row"><label>Worn gear</label><span class="muted">load the game template to redraw backpacks, helmets, gloves…</span></div>`;
  const mine = doc.layers.filter(l => l.role.type === 'gear');
  const items = new Set(mine.map(l => l.role.item));
  return `<div class="row"><label>Worn gear</label><select id="gearPick" style="flex:1"><option value="">Pick an item to redraw…</option>${gearList().map(g => `<option value="${g.id}">${items.has(g.id) ? '✎ ' : ''}${esc(g.id)} (${esc(RIG.PART_LABEL[g.limb] || g.limb)})</option>`).join('')}</select><button id="gearMake">Make mine</button><button id="gearBrowse" title="See every wearable with pictures">Browse…</button></div>
    <div class="muted">Your version shows only while YOU wear it, for everyone. On the ground, in shops and on other players it stays the game's. ${mine.length ? mine.length + ' redrawn sprite' + (mine.length === 1 ? '' : 's') + '.' : ''}</div>`;
}
function bindGearBox() {
  const gb = $('#gearBrowse'); if (gb) gb.onclick = () => { TB.tab = 'gear'; openBrowser(); };
  const b = $('#gearMake'); if (!b) return;
  b.onclick = () => {
    const id = $('#gearPick').value; if (!id) { toast('Pick an item first'); return; }
    const g = gearList().find(x => x.id === id); let first = null;
    for (const w of [{ limb: g.limb, sprite: g.sprite }, ...(g.extra || [])]) {
      if (!w.sprite || doc.layers.some(o => o.role.type === 'gear' && o.role.sprite === w.sprite)) continue;
      const l = gameLayer(doc, w.sprite, w.sprite, { type: 'gear', sprite: w.sprite, limb: w.limb, item: g.id }, w.limb);
      if (l) { if (RIG.REST[w.limb] && RIG.REST[w.limb][2]) l.spriteRot = RIG.REST[w.limb][2]; first = first || l; }
    }
    if (!first) { toast('Already made (or this item has no sprite in the template)'); return; }
    doc.layers.forEach((o, i) => o.order = i);
    selLayer = first.id; selChain = null; refresh();
    const wp = $('#wearPrev'); if (wp) wp.value = id;
    toast('Added ' + g.id + ' on your character. Download PNG → repaint → Replace, or drag it to fit. Preview it in Test with "Wearing".', 7000);
  };
}
function fillWearList() {
  const sel = $('#wearPrev'); if (!sel) return; const cur = sel.value;
  const mine = new Set(doc ? doc.layers.filter(l => l.role.type === 'gear').map(l => l.role.item) : []);
  sel.innerHTML = '<option value="">Wearing: nothing</option>' + gearList().map(g => `<option value="${g.id}">Wearing: ${mine.has(g.id) ? '✎ ' : ''}${esc(g.id)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
  sel.style.display = RIG.GAME ? '' : 'none';
}

// ---- delete a layer (anything: a part, a piece of a moving part, art, gear, an image added by mistake)
function deleteLayer(l) { deleteLayers([l]); }
function deleteLayers(list) {
  if (!list.length) return; const l = list[0];
  pushUndo();
  const ids = list.map(x => x.id);
  // a cut image goes with its pieces; a piece of a cut image takes the whole cut part with it
  const first = new Set(ids);
  for (const ch of doc.chains) {
    if (first.has(ch.source)) ids.push(...ch.segs.map(s => s.layer));
    if (ch.source && ch.segs.some(s => first.has(s.layer))) { ids.push(ch.source, ...ch.segs.map(s => s.layer)); }
  }
  // its frames, injury art, mouth states go too
  for (const o of doc.layers) if (o.role.of && ids.includes(o.role.of) && o.role.type !== 'part') ids.push(o.id);
  const set = new Set(ids);
  for (const ch of doc.chains) ch.segs = ch.segs.filter(s => !set.has(s.layer));
  doc.chains = doc.chains.filter(c => c.segs.length);
  RIG.removeLayers(doc, [...set]);
  for (const ch of doc.chains) if (ch.injury && ch.injury.groups && ch.injury.groups.length !== ch.segs.length) delete ch.injury.groups;
  const hadTail = doc.hideVanillaTail;
  if (doc.chains.some(c => c.attachTo === 'tail')) doc.hideVanillaTail = true;
  const tailNote = hadTail && !doc.chains.some(c => c.attachTo === 'tail') ? ' The game\u2019s own tail stays hidden (untick Hide game tail on the Rig tab to bring it back).' : '';
  selLayer = null; if (selChain && !RIG.chain(doc, selChain)) selChain = null; selSet.clear();
  imgCache.clear(); refresh(); startTestIfOpen();
  toast('Deleted ' + (list.length > 1 ? list.length + ' layers' : l.name) + (set.size > list.length ? ' (+' + (set.size - list.length) + ' that belonged to them)' : '') + '. Ctrl+Z to undo.' + tailNote, tailNote ? 7000 : 4000);
}
// undo: snapshots of the whole character before anything that changes it a lot
const undoStack = [];
function pushUndo() { if (!doc) return; try { undoStack.push(RIG.serialize(doc)); if (undoStack.length > 30) undoStack.shift(); redoStack.length = 0; } catch (e) { } }
const redoStack = [];
function undo() {
  const snap = undoStack.pop(); if (!snap) { toast('Nothing to undo'); return; }
  try { redoStack.push(RIG.serialize(doc)); if (redoStack.length > 30) redoStack.shift(); } catch (e) { }
  restoreSnap(snap); toast('Undone (Ctrl+Y to redo)');
}
function redo() {
  const snap = redoStack.pop(); if (!snap) { toast('Nothing to redo'); return; }
  try { undoStack.push(RIG.serialize(doc)); } catch (e) { }
  restoreSnap(snap); toast('Redone');
}
function restoreSnap(snap) {
  const keepTab = tab; doc = RIG.deserialize(snap); imgCache.clear(); selLayer = null; selChain = null; selSet.clear(); refresh(); if (keepTab === 'test' || keepTab === 'gear') startTest();
}
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && !typing && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && tab === 'rig' && doc && selLayer) { const list = selSet.size > 1 ? selectedLayers() : [RIG.layer(doc, selLayer)].filter(Boolean); if (list.length) { e.preventDefault(); deleteLayers(list); } }
});

// ---- eyes
function eyeMissing() {
  const have = new Set(doc.layers.filter(o => o.role.type === 'eye').map(o => o.role.state));
  const miss = RIG.EYE_STATES.filter(([k]) => !have.has(k)).map(([, lab]) => lab);
  return miss.length ? `<br><span class="muted">Not drawn yet (the game's own eyes are used for these): ${miss.map(esc).join(', ')}.</span>` : '';
}
// ---- stacking: move a layer one drawn layer up / down (frames, injury art and eyes travel with what they belong to)
function restack(l, dir) {
  pushUndo();
  const drawnRole = (o) => !o.cutSource && (o.role.type === 'part' || o.role.type === 'chain' || o.role.type === 'ignore' || o.role.type === 'eye');
  const list = doc.layers; const i = list.indexOf(l);
  let j = i + dir; while (j >= 0 && j < list.length && !drawnRole(list[j])) j += dir;
  if (j < 0 || j >= list.length) return;
  list.splice(i, 1); list.splice(j, 0, l); list.forEach((o, k) => o.order = k);
  refresh(); startTestIfOpen();
}
// ---- which pieces are injurable, and which pieces count as one limb
function groupsBox(ch) {
  const g = RIG.groupsOf(ch), n = ch.segs.length;
  const mode = !ch.injury.groups ? 'each' : (g.every(x => x === 0) ? 'one' : 'custom');
  const opts = (k) => { let o = `<option value="-1" ${g[k] < 0 ? 'selected' : ''}>can't be hurt</option>`; for (let i = 0; i < n; i++) o += `<option value="${i}" ${g[k] === i ? 'selected' : ''}>limb ${i + 1}</option>`; return o; };
  return `<div class="row"><label>Limbs on the health screen</label><select id="grMode" style="flex:1">
      <option value="each" ${mode === 'each' ? 'selected' : ''}>One per piece (${n})</option>
      <option value="one" ${mode === 'one' ? 'selected' : ''}>The whole part as one</option>
      <option value="custom" ${mode === 'custom' ? 'selected' : ''}>Choose per piece…</option></select></div>
    ${mode === 'custom' ? `<div class="muted" style="margin:2px 0 4px">Pieces with the same limb number are hurt, bandaged and torn off together. "Can't be hurt" pieces are just looks (they still fall off with the piece before them).</div>` + ch.segs.map((sg, k) => { const sl = RIG.layer(doc, sg.layer); return `<div class="seg"><span>${k + 1}. ${esc(sl ? sl.name : '?')}</span><select data-grp="${k}">${opts(k)}</select></div>`; }).join('') : ''}
    <div class="muted">${RIG.groupCount(ch)} injurable limb${RIG.groupCount(ch) === 1 ? '' : 's'} on the health screen.</div>`;
}
function bindGroupsBox(ch) {
  const m = $('#grMode'); if (!m) return;
  m.onchange = () => {
    const n = ch.segs.length;
    if (m.value === 'each') delete ch.injury.groups;
    else if (m.value === 'one') ch.injury.groups = ch.segs.map(() => 0);
    else ch.injury.groups = ch.injury.groups && ch.injury.groups.length === n ? ch.injury.groups : ch.segs.map((_, k) => k);
    refresh(); startTestIfOpen();
  };
  $('#insp').querySelectorAll('[data-grp]').forEach(sel => sel.onchange = () => {
    const g = RIG.groupsOf(ch).slice(); g[+sel.dataset.grp] = +sel.value;
    // renumber in order of appearance so limbs are 1, 2, 3... along the part
    const map = new Map(); ch.injury.groups = g.map(x => x < 0 ? -1 : (map.has(x) ? map.get(x) : (map.set(x, map.size), map.get(x))));
    refresh(); startTestIfOpen();
  });
}

// ---- bones
function bonesBox(ch) {
  const n = ch.segs.length, src = ch.source && RIG.layer(doc, ch.source);
  const note = src ? 'Your image is cut into this many pieces along its shape. Your drawing itself isn\'t changed.'
    : n > 1 ? 'Each piece is its own layer now. Changing the number merges them into one image and cuts it into that many pieces.'
    : 'More bones = smoother bending. The image is cut into that many pieces along its shape (your drawing isn\'t changed).';
  return `<div style="border:1px solid var(--line);border-radius:6px;padding:8px;margin-top:8px">
    <div class="row" style="margin-top:0"><label><b>Bones</b></label><button id="bnMinus">−</button><input id="chBones" type="number" min="1" max="40" value="${n}" style="width:54px;text-align:center"><button id="bnPlus">+</button><button id="chBonesSet" class="primary">Apply</button></div>
    <div class="muted" style="margin-bottom:6px">${note}</div>
    <div class="row"><button id="chAuto" title="Put the bones back where the editor thinks they go">Reset bones</button>${src ? '<button id="chRecut" title="Cut the pieces again so they follow the bones as you placed them">Re-cut to bones</button><button id="chUncut">One piece</button>' : ''}</div>
    <div class="muted">Drag the yellow <b>●</b> joints (where it bends) and the <b>◆</b> tip on the canvas.${src ? ' After moving joints, click <i>Re-cut to bones</i> so the pieces follow.' : ''}</div>
  </div>`;
}
function bindBonesBox(ch) {
  const inp = $('#chBones');
  $('#bnMinus').onclick = () => { inp.value = Math.max(1, +inp.value - 1); };
  $('#bnPlus').onclick = () => { inp.value = Math.min(40, +inp.value + 1); };
  $('#chBonesSet').onclick = () => {
    const n = Math.max(1, Math.min(40, Math.round(+inp.value || 1)));
    const extra = RIG.pieceExtras(doc, ch);
    if (extra && !confirm('The pieces of this part have animation frames or injury art. Cutting it again unlinks them (the layers stay). Go on?')) return;
    pushUndo(); RIG.setBoneCount(doc, ch, n); if (ch.injury.groups && ch.injury.groups.length !== ch.segs.length) delete ch.injury.groups; imgCache.clear(); refresh(); startTestIfOpen();
    toast(ch.segs.length + ' bone' + (ch.segs.length === 1 ? '' : 's') + (ch.segs.length < n ? ' (that\'s as many as this image is long enough for)' : '') + '. Drag the ● joints to adjust.', 4500);
  };
  $('#chAuto').onclick = () => {
    const src = ch.source && RIG.layer(doc, ch.source);
    if (src) RIG.cutInto(doc, ch, src, ch.segs.length); else RIG.autoBones(doc, ch);
    imgCache.clear(); refresh(); toast('Bones reset');
  };
  const rc = $('#chRecut'); if (rc) rc.onclick = () => { RIG.recut(doc, ch); imgCache.clear(); refresh(); startTestIfOpen(); toast('Pieces re-cut to follow your bones'); };
  const uc = $('#chUncut'); if (uc) uc.onclick = () => { RIG.uncut(doc, ch); imgCache.clear(); refresh(); startTestIfOpen(); toast('Back to one piece with one bone'); };
}
function moveBox(l) {
  const kind = RIG.kindOf(l.name), K = RIG.KINDS[kind];
  const attachOpts = (sel) => ['tail', ...RIG.PARTS].map(p => `<option value="${p}" ${p === sel ? 'selected' : ''}>${RIG.PART_LABEL[p]}</option>`).join('');
  return `<h2>Make it move</h2><div class="sec">
    <div class="muted" style="margin-bottom:4px">Tail, wings, hair, ears, a scarf… anything that should swing and bend gets bones.${l.role.type === 'part' ? ' <span style="color:var(--warn)">This layer is a body part now; this turns it into a moving part instead.</span>' : ''}</div>
    <div class="row"><label>It's a</label><select id="mmKind" style="flex:1">${Object.entries(RIG.KINDS).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
    <div class="row"><label>Hangs from</label><select id="mmAttach" style="flex:1">${attachOpts(K.attachTo)}</select></div>
    <div class="row"><label>Bones</label><input id="mmBones" type="number" min="1" max="40" value="${K.bones}" style="width:60px"><span class="muted">more = bendier</span></div>
    <div class="row"><button id="mmGo" class="primary" style="flex:1">Add bones</button></div>
  </div>`;
}
function bindMoveBox(l) {
  const go = $('#mmGo'); if (!go) return;
  $('#mmKind').onchange = (e) => { const K = RIG.KINDS[e.target.value]; $('#mmAttach').value = K.attachTo; $('#mmBones').value = K.bones; };
  go.onclick = () => {
    pushUndo();
    const ch = RIG.makeMoving(doc, l, $('#mmKind').value, Math.max(1, Math.min(40, +$('#mmBones').value || 1)), $('#mmAttach').value);
    selChain = ch.id; selLayer = null; imgCache.clear(); refresh(); startTestIfOpen();
    hint('Bones added. Drag the yellow <b>●</b> joints and <b>◆</b> tip to fit your drawing, then try it in the <b>Test</b> tab.');
    toast(ch.segs.length + ' bones added to ' + ch.name, 3500);
  };
}

function refresh() { syncPpu(); renderLayers(); renderInspector(); updateHeadStates(); if (tab === 'test' || tab === 'gear') startTest(); draw(); }

// ---------------------------------------------------------------- canvas: rig view
function resize() { const r = stage.getBoundingClientRect(); const d = window.devicePixelRatio || 1; cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d); draw(); }
window.addEventListener('resize', resize);
function fitView() {
  if (!doc) return; const d = window.devicePixelRatio || 1;
  const W = cv.width / d, H = cv.height / d;
  view.zoom = Math.max(2, Math.floor(Math.min(W / (doc.width + 8), H / (doc.height + 8))));
  view.panX = (W - doc.width * view.zoom) / 2; view.panY = (H - doc.height * view.zoom) / 2;
}
const toScreen = (p) => ({ x: p.x * view.zoom + view.panX, y: p.y * view.zoom + view.panY });
const toCanvas = (sx, sy) => ({ x: (sx - view.panX) / view.zoom, y: (sy - view.panY) / view.zoom });

function drawChecker(W, H) {
  const P = CV(); ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  if (!doc) return;
  const a = toScreen({ x: 0, y: 0 }); ctx.fillStyle = P.sheet; ctx.fillRect(a.x, a.y, doc.width * view.zoom, doc.height * view.zoom);
  ctx.strokeStyle = P.sheetLine; ctx.lineWidth = 1; ctx.strokeRect(a.x + .5, a.y + .5, doc.width * view.zoom, doc.height * view.zoom);
}

function syncPpu() { RIG.PPU = (doc && doc.ppu) || 8; }
function draw() {
  syncPpu();
  const d = window.devicePixelRatio || 1; ctx.setTransform(d, 0, 0, d, 0, 0);
  const W = cv.width / d, H = cv.height / d;
  if (tab === 'test' || tab === 'anim' || tab === 'gear') return; // test loop draws itself
  if (tab === 'health') { drawHealth(W, H); return; }
  drawChecker(W, H);
  if (!doc) return;
  ctx.imageSmoothingEnabled = false;
  // skin sprites (sprite swaps) on parts that have no replacement layer
  const replacedParts = new Set(doc.layers.filter(l => l.role.type === 'part').map(l => l.role.part));
  const skinItems = [];
  for (const part of [...RIG.PARTS, 'tail']) {
    if (replacedParts.has(part) || (part === 'tail' && doc.hideVanillaTail)) continue;
    const im = doc.spriteSwaps[RIG.PART_SPRITE[part]]; if (im) skinItems.push({ part, im, order: RIG.ORDER[part] });
    if (part === 'Head' && doc.spriteSwaps.experimentEyeOpen && !doc.hideObjects.includes('Eyes')) skinItems.push({ part, im: doc.spriteSwaps.experimentEyeOpen, order: 53 });
  }
  skinItems.sort((a, b) => a.order - b.order);
  for (const it of skinItems) {
    const J = RIG.J(doc, it.part), sc = toScreen(J);
    ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate(-RIG.REST[it.part][2] * Math.PI / 180);
    ctx.globalAlpha = 0.9; ctx.drawImage(layerCanvas(it.im), -it.im.w * view.zoom / 2, -it.im.h * view.zoom / 2, it.im.w * view.zoom, it.im.h * view.zoom);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // layers
  const prevFr = animPrevFrames();
  for (const l of doc.layers) {
    if (l.cutSource) continue;
    if (prevFr && l.id === animPrev.id) { // the part plays its frames instead of its own art
      const [cur, before] = prevFr;
      if (before && before !== cur) { const q = toScreen(before); ctx.globalAlpha = 0.3; ctx.drawImage(layerCanvas(before), q.x, q.y, before.w * view.zoom, before.h * view.zoom); }
      if (cur) { const q = toScreen(cur); ctx.globalAlpha = 1; ctx.drawImage(layerCanvas(cur), q.x, q.y, cur.w * view.zoom, cur.h * view.zoom); }
      continue;
    }
    const p = toScreen(l);
    const isArt = l.role.type === 'state' || l.role.type === 'injury' || l.role.type === 'frame' || (l.role.type === 'eye' && l.role.state !== shownEye()) || (l.role.type === 'gear' && !gearShown(l));
    ctx.globalAlpha = l.role.type === 'ignore' ? (manualMode ? 0.7 : 0.25) : (isArt ? 0.0 : 1);
    if (isArt && (l.id === selLayer || selSet.has(l.id))) ctx.globalAlpha = 1;
    if (xray) { ctx.globalAlpha = selSet.has(l.id) || l.id === selLayer ? 1 : (isArt ? 0 : 0.18);
      if (!isArt || selSet.has(l.id)) { const sa = ctx.globalAlpha; ctx.globalAlpha = 0.6; ctx.strokeStyle = l.role.type === 'ignore' ? '#e0a020' : l.role.type === 'chain' ? '#3fbf7f' : '#5aa0ff'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 0.5, p.y + 0.5, l.w * view.zoom - 1, l.h * view.zoom - 1); ctx.globalAlpha = sa; } }
    if (ctx.globalAlpha <= 0) continue;
    if (l.spriteRot && (l.role.type === 'part' || l.role.type === 'gear')) { // drawn the way the game's sprite is: turned with the part
      const J = toScreen(RIG.J(doc, l.role.type === 'gear' ? l.role.limb : l.role.part));
      ctx.save(); ctx.translate(J.x, J.y); ctx.rotate(-l.spriteRot * Math.PI / 180); ctx.drawImage(layerCanvas(l), p.x - J.x, p.y - J.y, l.w * view.zoom, l.h * view.zoom); ctx.restore();
    } else ctx.drawImage(layerCanvas(l), p.x, p.y, l.w * view.zoom, l.h * view.zoom);
  }
  ctx.globalAlpha = 1;
  // game skeleton ghost
  if (showSkel) {
    ctx.lineWidth = 1;
    for (const part of RIG.PARTS) {
      const J = RIG.J(doc, part), k8 = RIG.PPU / 8, sz = RIG.VANILLA_SIZE[part].map(v => v * k8), s = toScreen(J);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(-RIG.REST[part][2] * Math.PI / 180);
      ctx.strokeStyle = part.endsWith('B') ? 'rgba(120,200,255,.35)' : 'rgba(120,200,255,.75)';
      ctx.setLineDash(part.endsWith('B') ? [3, 3] : []);
      ctx.strokeRect(-sz[0] * view.zoom / 2, -sz[1] * view.zoom / 2, sz[0] * view.zoom, sz[1] * view.zoom);
      ctx.restore();
    }
    ctx.setLineDash([]);
    const o = toScreen(doc.align); ctx.fillStyle = 'rgba(120,200,255,.9)'; ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, 7); ctx.fill();
  }
  // selected layer outline
  const sl = selLayer && RIG.layer(doc, selLayer);
  if (selSet.size > 1) for (const id of selSet) { const o = RIG.layer(doc, id); if (!o || o === sl) continue; const p = toScreen(o); ctx.strokeStyle = 'rgba(143,91,255,.8)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.strokeRect(p.x - .5, p.y - .5, o.w * view.zoom + 1, o.h * view.zoom + 1); ctx.setLineDash([]); }
  if (sl) { const p = toScreen(sl); ctx.strokeStyle = '#8f5bff'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x - .5, p.y - .5, sl.w * view.zoom + 1, sl.h * view.zoom + 1); }
  const sc = selChain && RIG.chain(doc, selChain);
  if (sc && !sl) { ctx.strokeStyle = 'rgba(143,91,255,.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); for (const s of sc.segs) { const l = RIG.layer(doc, s.layer); if (!l) continue; const p = toScreen(l); ctx.strokeRect(p.x - .5, p.y - .5, l.w * view.zoom + 1, l.h * view.zoom + 1); } ctx.setLineDash([]); }
  // bones
  for (const ch of doc.chains) drawBones(ch, ch.id === selChain);
}

function gearShown(l) { const sl = selLayer && RIG.layer(doc, selLayer); const wp = $('#wearPrev'); return (sl && sl.role.type === 'gear' && sl.role.item === l.role.item) || (wp && wp.value && wp.value === l.role.item); }
function shownEye() {
  const sl = selLayer && RIG.layer(doc, selLayer); if (sl && sl.role.type === 'eye') return sl.role.state;
  return doc.layers.some(o => o.role.type === 'eye' && o.role.state === 'experimentEyeOpen') ? 'experimentEyeOpen' : (doc.layers.find(o => o.role.type === 'eye') || { role: {} }).role.state;
}
function drawBones(ch, active) {
  const anchor = toScreen(RIG.J(doc, ch.attachTo));
  ctx.globalAlpha = active ? 1 : 0.35;
  ctx.strokeStyle = active ? '#ffcf4a' : '#c9a84a'; ctx.lineWidth = active ? 2 : 1;
  // anchor cross
  ctx.beginPath(); ctx.moveTo(anchor.x - 5, anchor.y); ctx.lineTo(anchor.x + 5, anchor.y); ctx.moveTo(anchor.x, anchor.y - 5); ctx.lineTo(anchor.x, anchor.y + 5); ctx.stroke();
  const pts = ch.segs.map(s => toScreen(s.joint));
  ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.setLineDash([2, 3]); ctx.lineTo(pts[0].x, pts[0].y); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  const last = ch.segs[ch.segs.length - 1];
  if (last.tip) { const t = toScreen(last.tip); ctx.lineTo(t.x, t.y); }
  ctx.stroke();
  ch.segs.forEach((s, i) => {
    if (s.tip && i < ch.segs.length - 1) { const t = toScreen(s.tip); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(t.x, t.y); ctx.stroke(); }
  });
  ctx.fillStyle = active ? '#ffcf4a' : '#c9a84a';
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, active ? 6 : 3, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    if (active && ch.segs.length > 1) { ctx.fillStyle = '#000'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), p.x, p.y + 0.5); ctx.fillStyle = '#ffcf4a'; ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; }
  });
  ch.segs.forEach(s => { if (s.tip) { const t = toScreen(s.tip); ctx.beginPath(); ctx.moveTo(t.x, t.y - 6); ctx.lineTo(t.x + 6, t.y); ctx.lineTo(t.x, t.y + 6); ctx.lineTo(t.x - 6, t.y); ctx.closePath(); ctx.fill(); ctx.stroke(); } });
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- canvas interaction (rig view)
let drag = null;
function handleAt(sx, sy) {
  const chs = doc.chains.filter(c => c.id === selChain).concat(doc.chains.filter(c => c.id !== selChain));
  for (const ch of chs) for (const s of ch.segs) {
    for (const key of ['tip', 'joint']) { const p = s[key]; if (!p) continue; const q = toScreen(p); if (Math.hypot(q.x - sx, q.y - sy) < (ch.id === selChain ? 9 : 6)) return { ch, s, key }; }
  }
  return null;
}
function layerAt(sx, sy) {
  const p = toCanvas(sx, sy);
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i]; if (l.cutSource || l.role.type === 'state' || l.role.type === 'injury' || l.role.type === 'frame' || (l.role.type === 'eye' && l.role.state !== shownEye() && l.id !== selLayer) || (l.role.type === 'gear' && !gearShown(l))) continue;
    if (RIG.alpha(l, Math.floor(p.x - l.x), Math.floor(p.y - l.y)) > 0) return l;
  }
  return null;
}
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (!doc) return; const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
  cv.setPointerCapture(e.pointerId);
  if (tab === 'anim') { animPointerDown(sx, sy, e); return; }
  if (tab === 'gear') { gearPointerDown(sx, sy); return; }
  if (tab === 'test') { grab = { sx, sy }; return; }
  if (tab === 'health') {
    const hit = hsAt(sx, sy);
    selHs = hit ? hit.it.key : null;
    if (hit) hsDrag = { key: hit.it.key, sx, sy, x0: hit.it.x, y0: hit.it.y, z: hit.v.z, mirror: hit.it.mirror };
    renderInspector(); draw(); return;
  }
  if (e.button === 1 || e.button === 2 || e.shiftKey) { drag = { type: 'pan', sx, sy, px: view.panX, py: view.panY }; return; }
  if (moveSkel || e.altKey) { drag = { type: 'skel', start: toCanvas(sx, sy), a: { ...doc.align } }; return; }
  const hnd = handleAt(sx, sy);
  if (hnd) { selChain = hnd.ch.id; drag = { type: 'handle', ...hnd }; renderInspector(); draw(); return; }
  const l = layerAt(sx, sy);
  { // the selection first: a selected frame / state / injury art can be grabbed anywhere inside its box
    const pc = toCanvas(sx, sy); const sel = selSet.size ? selectedLayers() : (selLayer ? [RIG.layer(doc, selLayer)].filter(Boolean) : []);
    const hitSel = sel.find(o => (o.role.type === 'frame' || o.role.type === 'state' || o.role.type === 'injury') && pc.x >= o.x && pc.x < o.x + o.w && pc.y >= o.y && pc.y < o.y + o.h);
    if (hitSel && !(e.ctrlKey || e.metaKey)) { pushUndo(); drag = { type: 'layer', l: hitSel, list: sel.filter(o => o.role.type === hitSel.role.type), sx, sy, start: toCanvas(sx, sy), done: { x: 0, y: 0 }, moved: false, only: true }; return; }
  }
  if (l && (e.ctrlKey || e.metaKey)) { if (selSet.has(l.id)) { selSet.delete(l.id); if (selLayer === l.id) selLayer = [...selSet][0] || null; } else { selSet.add(l.id); selLayer = l.id; } renderLayers(); renderInspector(); draw(); return; }
  if (l) {
    const many = selSet.size > 1 && selSet.has(l.id);
    if (many) { selLayer = l.id; } else if (selLayer !== l.id) { selSet = new Set([l.id]); selectLayer(l.id); }
    pushUndo(); drag = { type: 'layer', l, list: many ? selectedLayers() : [l], sx, sy, start: toCanvas(sx, sy), done: { x: 0, y: 0 }, moved: false }; return;
  }
  selLayer = null; refresh();
  drag = { type: 'pan', sx, sy, px: view.panX, py: view.panY, soft: true };
});
cv.addEventListener('pointermove', (e) => {
  const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (tab === 'anim') { animPointerMove(sx, sy); return; }
  if (tab === 'gear') { gearPointerMove(sx, sy); return; }
  if (tab === 'test') { if (grab) { grab.sx = sx; grab.sy = sy; } return; }
  if (tab === 'health') {
    if (hsDrag) { const e2 = hsEntry(hsDrag.key); e2.x = Math.round(hsDrag.x0 + (sx - hsDrag.sx) / hsDrag.z); e2.y = Math.round(hsDrag.y0 - (sy - hsDrag.sy) / hsDrag.z); if (e2.mirror === undefined) e2.mirror = hsDrag.mirror; draw(); }
    else cv.style.cursor = hsAt(sx, sy) ? 'move' : 'default';
    return;
  }
  if (!drag) { if (doc) cv.style.cursor = handleAt(sx, sy) ? 'grab' : (moveSkel ? 'move' : 'crosshair'); return; }
  if (drag.type === 'pan') { view.panX = drag.px + sx - drag.sx; view.panY = drag.py + sy - drag.sy; draw(); }
  else if (drag.type === 'skel') { const p = toCanvas(sx, sy); doc.align = { x: Math.round((drag.a.x + p.x - drag.start.x) * 2) / 2, y: Math.round((drag.a.y + p.y - drag.start.y) * 2) / 2 }; draw(); }
  else if (drag.type === 'layer') {
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) < 4) return;
    drag.moved = true; const p = toCanvas(sx, sy);
    const tx = Math.round(p.x - drag.start.x), ty = Math.round(p.y - drag.start.y);
    if (tx !== drag.done.x || ty !== drag.done.y) { if (drag.only) for (const o of drag.list) { o.x += tx - drag.done.x; o.y += ty - drag.done.y; } else moveLayersBy(drag.list || [drag.l], tx - drag.done.x, ty - drag.done.y); drag.done = { x: tx, y: ty }; draw(); }
  }
  else if (drag.type === 'handle') { const p = toCanvas(sx, sy); drag.s[drag.key] = { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }; draw(); }
});
// move a layer (and whatever belongs to it: frames, injury art, its bones; a cut image moves as a whole)
function moveLayerBy(l, dx, dy) { moveLayersBy([l], dx, dy); }
// several at once: everything that belongs to any of them moves once (no double moves for shared frames / bones)
function moveLayersBy(list, dx, dy) {
  const G = new Set(), B = new Set();
  for (const l of list) { const r = moveGroupOf(l); r.group.forEach(g => G.add(g)); r.bones.forEach(b => B.add(b)); }
  for (const g of G) { g.x += dx; g.y += dy; }
  for (const s of B) { s.joint = { x: s.joint.x + dx, y: s.joint.y + dy }; if (s.tip) s.tip = { x: s.tip.x + dx, y: s.tip.y + dy }; }
}
function moveGroupOf(l) {
  let group = [l]; const bones = [];
  if (l.role.type === 'chain') {
    const ch = RIG.chain(doc, l.role.chain);
    if (ch && ch.source) { group = ch.segs.map(s => RIG.layer(doc, s.layer)).filter(Boolean); const src = RIG.layer(doc, ch.source); if (src) group.push(src); bones.push(...ch.segs); }
    else if (ch) bones.push(...ch.segs.filter(s => s.layer === l.id));
  }
  const ids = new Set(group.map(g => g.id));
  for (const o of doc.layers) if (o.role.of && ids.has(o.role.of) && !group.includes(o)) group.push(o);
  return { group, bones };
}
document.addEventListener('keydown', (e) => {
  if (!doc || tab !== 'rig' || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
  let l = selLayer && RIG.layer(doc, selLayer);
  if (!l && selChain) { const ch = RIG.chain(doc, selChain); l = ch && RIG.layer(doc, ch.segs[0].layer); }
  if (!l) return;
  e.preventDefault(); const k = e.shiftKey ? 5 : 1; moveLayersBy(selSet.size > 1 ? selectedLayers() : [l], d[0] * k, d[1] * k); draw();
});
cv.addEventListener('pointerup', () => { if (GS.drag) { GS.drag = null; renderInspector(); renderLayers(); } if (AS.drag) { AS.drag = null; renderInspector(); } if (hsDrag) { hsDrag = null; renderInspector(); } if (drag && drag.type === 'skel') hint('Skeleton moved. Body parts follow it automatically.'); drag = null; grab = null; });
cv.addEventListener('wheel', (e) => {
  e.preventDefault(); const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (tab === 'test' || tab === 'gear') { test.zoom = Math.max(6, Math.min(140, test.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); return; }
  const before = toCanvas(sx, sy); view.zoom = Math.max(1, Math.min(48, view.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
  view.panX = sx - before.x * view.zoom; view.panY = sy - before.y * view.zoom; draw();
}, { passive: false });
$('#zoomIn').onclick = () => { if (tab === 'test' || tab === 'gear') test.zoom = Math.min(140, test.zoom * 1.25); else { view.zoom = Math.min(48, view.zoom * 1.25); draw(); } };
$('#zoomOut').onclick = () => { if (tab === 'test' || tab === 'gear') test.zoom = Math.max(6, test.zoom / 1.25); else { view.zoom = Math.max(1, view.zoom / 1.25); draw(); } };
$('#btnSkel').onclick = (e) => { showSkel = !showSkel; e.target.classList.toggle('on', showSkel); draw(); };
$('#btnMoveSkel').onclick = (e) => { moveSkel = !moveSkel; e.target.classList.toggle('on', moveSkel); hint(moveSkel ? 'Drag anywhere to move the game skeleton under your drawing. Click the button again when done.' : rigHint()); };
$('#btnAlign').onclick = () => { if (!doc) return; RIG.autoAlign(doc); draw(); toast('Skeleton lined up with your body parts'); };
const rigHint = () => 'Click a part to select it · <b>drag it</b> (or arrow keys) to move it · drag yellow <b>●</b> joints / <b>◆</b> tips to bend · drag empty space or right-drag to pan · wheel to zoom';

// ---------------------------------------------------------------- test mode
let test = null, grab = null, raf = 0;
function tabTo(t) {
  tab = t; $('#tabRig').classList.toggle('on', t === 'rig'); $('#tabTest').classList.toggle('on', t === 'test'); $('#tabHealth').classList.toggle('on', t === 'health'); $('#tabAnim').classList.toggle('on', t === 'anim'); $('#tabGear').classList.toggle('on', t === 'gear');
  $('#rigTools').style.display = t === 'rig' ? '' : 'none'; $('#testTools').style.display = t === 'test' ? '' : 'none'; $('#gearTools').style.display = t === 'gear' ? '' : 'none';
  $('#healthTools').style.display = t === 'health' ? '' : 'none'; $('#animTools').style.display = t === 'anim' ? '' : 'none';
  $('#dope').style.display = t === 'anim' ? 'flex' : 'none';
  if (t === 'anim') { if (!gameMode()) { toast('Animate needs the game template from your game (the mod saves it; click "no game template" at the top to load it).', 7000); } startTest(); renderInspector(); hint('Pick an animation, pick a bone (click it, or in the list), then turn / move it at any moment of the animation. Your changes are added on top of the game\'s animation, in game too.'); return; }
  if (t === 'gear') { fillGearPoses(); if (!RIG.GAME) toast('Gear needs the game template from your game (click "no game template" at the top to load it).', 7000); startTest(); renderInspector(); hint('Pick an item on the right. It is shown worn on your character: <b>drag it</b> to fit (arrow keys nudge), check it in other poses, then Download → repaint → Replace.'); return; }
  if (t === 'test') { startTest(); renderInspector(); hint('Play with the keyboard (A/D, Space, S, W, F, T…), or pick a demo. <span style="opacity:.8">This is a <b>simulation</b> based on Casualties: Unknown\'s code by Orson — not the game itself.</span>'); }
  else { cancelAnimationFrame(raf); raf = 0; hint(t === 'health' ? 'The in-game health screen. Drag any part to move it; click it to give it your own outline/middle art. Injurable pieces appear here too.' : rigHint()); renderInspector(); draw(); }
}
const startTestIfOpen = () => { if (tab === 'test' || tab === 'gear') startTest(); };
$('#tabGear').onclick = () => tabTo('gear'); $('#tabRig').onclick = () => tabTo('rig'); $('#tabTest').onclick = () => tabTo('test'); $('#tabHealth').onclick = () => tabTo('health'); $('#tabAnim').onclick = () => tabTo('anim');
$('#actPrev').onchange = () => {
  if (!test) return; const A = $('#actPrev').value || 'idle';
  test.mode = A; test.timer = 0; test.dir = test.body.facing; test.vy = 0; test.vx = 0;
  test.down = test.sleep = test.deadT = false; test.climbing = false;
  test.body.x = A === 'play' ? 0 : test.body.x;
  test.body.y = (A === 'fall' || A === 'wallslide') ? 5000 : 0; test.camY = test.body.y; // falling starts high up and never lands
  cv.focus && cv.focus();
};
$('#btnTurn').onclick = () => { if (test) { test.body.facing *= -1; test.dir = test.body.facing; test.timer = 0; } };
// ---- injury tester (Test tab): hurt any part, any state, tear things off. Only for looking; nothing is saved.
let testInj = {}, itSel = 'UpArmF';
function updateInjuryPreview() { // keeps the tester's list in step with the character (pieces renamed / removed)
  const keys = new Set(injTargets().map(t => t.key));
  for (const k in testInj) if (!keys.has(k)) delete testInj[k];
  if (!keys.has(itSel)) itSel = 'UpArmF';
}
// every part you can hurt: the game's 15 + one per injury box of your injurable pieces
function injTargets() {
  const out = RIG.PARTS.map(p => ({ key: p, label: RIG.PART_LABEL[p], game: true, tear: RIG.TEARABLE.includes(p) }));
  if (!doc) return out;
  for (const ch of doc.chains) {
    if (!ch.injury || !ch.injury.enabled) continue;
    const g = RIG.groupsOf(ch), n = RIG.groupCount(ch); const seen = new Set();
    g.forEach((gi, k) => { if (gi < 0 || seen.has(gi)) return; seen.add(gi);
      out.push({ key: 'c:' + ch.name + ':' + gi, label: (ch.injury.name || ch.name) + (n > 1 ? ' ' + (seen.size) : ''), game: false, tear: ch.injury.tearOff !== false, chain: ch, first: k }); });
  }
  return out;
}
// the art layers that would show for a target in a state (your own injury art), so the tester can say what you'll see
function injArtFor(t, st) {
  if (!doc) return false;
  const layers = t.game ? doc.layers.filter(l => l.role.type === 'part' && l.role.part === t.key).map(l => l.id).concat(doc.chains.filter(c => c.attachTo === t.key).flatMap(c => c.segs.map(s => s.layer)))
    : t.chain.segs.filter((s, k) => RIG.groupsOf(t.chain)[k] === +t.key.split(':').pop()).map(s => s.layer);
  return layers.some(id => doc.layers.some(a => a.role.type === 'injury' && a.role.of === id && a.role.state === st) || (doc.anims[id] && doc.anims[id][st]));
}
const GAME_LOOK = { broken: 'game shows a broken bone', bandaged: 'game wraps it', splinted: 'game straps a splint on' };
function injTesterHtml() {
  const T = injTargets(); const t = T.find(x => x.key === itSel) || T[0];
  const e = testInj[t.key] || { states: [], torn: false };
  const hurt = T.filter(x => testInj[x.key] && (testInj[x.key].torn || testInj[x.key].states.length));
  const opt = (x) => `<option value="${esc(x.key)}" ${x.key === t.key ? 'selected' : ''}>${testInj[x.key] && (testInj[x.key].torn || testInj[x.key].states.length) ? '● ' : ''}${esc(x.label)}</option>`;
  const lowers = t.game ? (RIG.LOWER[t.key] || []).map(p => RIG.PART_LABEL[p]) : [];
  return `<h2>Injury tester</h2><div class="sec">
    <div class="muted" style="margin-bottom:6px">Hurt any part and watch it in the test. Only for testing, nothing here is saved or exported.</div>
    <div class="row"><label>Body part</label><select id="itPart" style="flex:1"><optgroup label="Game body parts">${T.filter(x => x.game).map(opt).join('')}</optgroup>${T.some(x => !x.game) ? `<optgroup label="Your injurable pieces">${T.filter(x => !x.game).map(opt).join('')}</optgroup>` : ''}</select></div>
    <div class="row"><label>Torn off</label>${t.tear ? `<input type="checkbox" id="itTorn" ${e.torn ? 'checked' : ''}><span class="muted">${lowers.length ? 'takes ' + esc(lowers.join(' + ')) + ' with it' : t.game ? '' : 'and every piece after it'}</span>` : `<span class="muted">${t.game ? 'the game never tears this off' : 'tearing is off for this piece (Rig tab)'}</span>`}</div>
    <div class="itGrid">${RIG.INJURY_STATES.filter(([k]) => k !== 'stump').map(([k, lab]) => {
      const art = injArtFor(t, k), gl = t.game && GAME_LOOK[k] && !(k === 'splinted' && (t.key === 'Head' || t.key === 'UpTorso' || t.key === 'DownTorso'));
      return `<label class="itRow"><input type="checkbox" data-it="${k}" ${e.states.includes(k) ? 'checked' : ''}><span>${esc(lab.replace(/ \(.*\)$/, ''))}</span>${art ? '<b class="pill ok" title="You drew art for this">your art</b>' : gl ? `<span class="pill" title="${GAME_LOOK[k]}">game look</span>` : ''}</label>`; }).join('')}</div>
    <div class="row"><label>Stump art</label><span class="muted">${injArtFor(t, 'stump') ? 'yours shows when the part below is torn off' : 'tear off the part below to see it'}</span></div>
    <div class="row"><button id="itHeal">Heal this part</button><button id="itHealAll" ${hurt.length ? '' : 'disabled'}>Heal everything</button></div>
    ${hurt.length ? `<div class="muted" style="margin:6px 0 2px">Hurt right now:</div>${hurt.map(x => `<div class="seg"><span><a href="#" data-itgo="${esc(x.key)}">${esc(x.label)}</a>: ${testInj[x.key].torn ? 'torn off' + (testInj[x.key].states.length ? ', ' : '') : ''}${testInj[x.key].states.map(s => esc((RIG.INJURY_STATES.find(z => z[0] === s) || [s, s])[1].replace(/ \(.*\)$/, ''))).join(', ')}</span><button data-itx="${esc(x.key)}" title="Heal">✕</button></div>`).join('')}` : ''}
    <div class="muted" style="margin-top:6px">With several states, the one highest in the list shows (like the mod). No <span class="pill ok">your art</span> = the game shows nothing special for that state on the body, only on the health screen.</div>
  </div>`;
}
function bindInjTester() {
  const ent = () => testInj[itSel] = testInj[itSel] || { states: [], torn: false };
  const tidy = () => { for (const k in testInj) if (!testInj[k].torn && !testInj[k].states.length) delete testInj[k]; renderInspector(); };
  $('#itPart').onchange = (e) => { itSel = e.target.value; renderInspector(); };
  const tn = $('#itTorn'); if (tn) tn.onchange = () => { ent().torn = tn.checked; tidy(); };
  document.querySelectorAll('[data-it]').forEach(c => c.onchange = () => { const e = ent(), k = c.dataset.it; e.states = e.states.filter(s => s !== k); if (c.checked) e.states.push(k); tidy(); });
  $('#itHeal').onclick = () => { delete testInj[itSel]; renderInspector(); };
  $('#itHealAll').onclick = () => { testInj = {}; renderInspector(); };
  document.querySelectorAll('[data-itx]').forEach(b => b.onclick = () => { delete testInj[b.dataset.itx]; renderInspector(); });
  document.querySelectorAll('[data-itgo]').forEach(a => a.onclick = (ev) => { ev.preventDefault(); itSel = a.dataset.itgo; renderInspector(); });
}
function updateHeadStates() {
  updateInjuryPreview(); fillWearList();
  const sel = $('#headState'); const cur = sel.value;
  const states = doc ? [...new Set(doc.layers.filter(l => l.role.type === 'state').map(l => l.role.state))] : [];
  sel.innerHTML = '<option value="">Head: automatic (hold T to talk)</option>' + states.map(s => `<option value="${s}">Head: ${RIG.HEAD_STATE_LABEL[s] || s}</option>`).join('');
  sel.value = states.includes(cur) ? cur : '';
}

function startTest() {
  syncPpu();
  if (!doc) { cancelAnimationFrame(raf); return; }
  const built = RIG.buildRig(doc);
  const images = {}; for (const f in built.files) images[f] = built.files[f];
  const prev = test;
  test = {
    rig: built.rig, images, canv: {}, rt: new RIG.Runtime(built.rig, images),
    body: prev ? prev.body : { x: 0, y: 0, facing: 1, walk: 0, stride: 0, run: 0, crouch: 0, lie: 0, climb: 0, swim: 0, attack: 0, t: 0, tailAngle: 23.6 }, vx: prev ? prev.vx : 0, vy: prev ? prev.vy : 0,
    mode: $('#actPrev').value || 'play', timer: 0, zoom: prev ? prev.zoom : 44, camX: prev ? prev.camX : 0, camY: prev ? prev.camY : 0, last: performance.now(), dir: prev ? prev.dir : 1,
    grounded: true, sinceGround: 0, sinceSlidL: 9, sinceSlidR: 9, firstWallJump: true, lastRight: false, jumpCd: 0, prevVx: 0, blink: 3, idleTime: 0,
    down: prev ? prev.down : false, sleep: prev ? prev.sleep : false, deadT: prev ? prev.deadT : false
  };
  if (prev) for (const k of ['grounded', 'climbing', 'inWater', 'idleTime']) test[k] = prev[k] !== undefined ? prev[k] : test[k];
  test.body.accelRot = test.body.accelRot || 0;
  test.ga = gameMode() ? (prev && prev.ga && prev.ga.tpl === RIG.GAME.tpl ? prev.ga : new RIG.GameAnim(RIG.GAME.tpl, RIG.GAME.clips)) : null;
  for (const f in images) { const im = images[f]; test.canv[f] = layerCanvas(im); }
  if (!raf) raf = requestAnimationFrame(loop);
}
// slider changes: update motion without rebuilding (keeps the motion going)
function liveMotion() {
  if (!test || !doc) return;
  const built = RIG.buildRig(doc);
  test.rt.chains.forEach((c) => { const def = built.rig.chains.find(x => x.name === c.def.name && x.attachTo === c.def.attachTo); if (def) Object.assign(c.motion, def.motion); });
}

// ---- Gear tab: every wearable shown worn on your character, in any pose; drag it to fit, repaint it
const GS = { item: '', piece: '', pose: 'stand', t: 0, playing: false, facing: 1, hits: [], drag: null };
const GEAR_POSES = [['stand', 'ExperimentIdle', 'ArmsIdle', 'Standing'], ['run', 'ExperimentRun', 'ArmsRun', 'Running'], ['crouch', 'ExperimentIdleCrouch', 'ArmsCrouch', 'Crouching'],
  ['jump', 'ExperimentAirUp', 'ArmsAirUp', 'Jumping'], ['fall', 'ExperimentAirDown', 'ArmsAirDown', 'Falling'], ['climb', 'ExperimentClimbUp', 'ArmsClimbUp', 'Climbing'],
  ['sit', 'ExperimentSit', 'ArmsSit', 'Sitting'], ['swing', 'ExperimentIdle', 'ArmsSwing', 'Attacking'], ['lay', 'ExperimentLayDown', 'ArmsLayDown', 'Lying down'],
  ['pushups', 'ExperimentPushups', 'ArmsPushups', 'Push-ups'], ['squats', 'ExperimentSquats', 'ArmsSquats', 'Squats'], ['plank', 'ExperimentPlank', 'ArmsPlank', 'Plank']];
function fillGearPoses() {
  const sel = $('#gearPose'); sel.innerHTML = GEAR_POSES.map(p => `<option value="${p[0]}" ${p[0] === GS.pose ? 'selected' : ''}>Pose: ${p[3]}</option>`).join('');
  sel.onchange = () => { GS.pose = sel.value; GS.t = 0; };
  $('#gearPlay').onclick = (e) => { GS.playing = !GS.playing; e.target.textContent = GS.playing ? '❚❚ Pause' : '▶ Play'; if (!GS.playing) GS.t = 0; };
  $('#gearTurn').onclick = () => { GS.facing *= -1; };
}
// the game's own spot for a worn sprite (its pivot on the limb's joint), in canvas pixels
function gearHome(sprite, limb) {
  const G = RIG.GAME, im = G && G.images[sprite], sp = G && G.sprites[sprite]; if (!im || !sp) return null;
  const c = RIG.crop(im.rgba, im.w, im.h) || { x: 0, y: 0 }; const J = RIG.J(doc, limb);
  const px = sp.pivot ? sp.pivot[0] : im.w / 2, py = sp.pivot ? sp.pivot[1] : im.h / 2;
  return { x: Math.round(J.x - px + c.x), y: Math.round(J.y - (im.h - py) + c.y) };
}
const gearPieces = (g) => [{ limb: g.limb, sprite: g.sprite }, ...(g.extra || [])].filter(w => w.sprite);
const myGear = (sprite) => doc.layers.find(o => o.role.type === 'gear' && o.role.sprite === sprite);
function makeMyGear(g, w) { // your copy of one worn sprite (starts as the game's art, on the game's spot)
  let l = myGear(w.sprite); if (l) return l;
  l = gameLayer(doc, w.sprite, w.sprite, { type: 'gear', sprite: w.sprite, limb: w.limb, item: g.id }, w.limb);
  if (l) { if (RIG.REST[w.limb] && RIG.REST[w.limb][2]) l.spriteRot = RIG.REST[w.limb][2]; doc.layers.forEach((o, i) => o.order = i); }
  return l;
}
const thumbCache = new Map();
function gearThumb(sprite) {
  const l = doc && myGear(sprite); const im = l || (RIG.GAME && RIG.GAME.images[sprite]); if (!im) return '';
  const key = l ? l : sprite; if (!l && thumbCache.has(key)) return thumbCache.get(key);
  let url = ''; try { url = layerCanvas(im).toDataURL(); } catch (e) { }
  if (!l) thumbCache.set(key, url); return url;
}
let gearFilter = '';
function gearTabHtml() {
  if (!RIG.GAME) return `<h2>Gear</h2><div class="sec muted">Load the game template first (click <b>no game template</b> at the top and pick <code>BepInEx\plugins\AdvancedRigs\GameTemplate</code>). The mod writes it the first time you play, or press <b>F10</b> in game.</div>`;
  const list = gearList();
  if (!list.length) return `<h2>Gear</h2><div class="sec muted">Your game template has no wearables in it. Load into a world and press <b>F10</b> in game to save it again, then reload it here.</div>`;
  if (!GS.item || !list.some(g => g.id === GS.item)) { GS.item = list[0].id; GS.piece = list[0].sprite; }
  const g = list.find(x => x.id === GS.item); const pcs = gearPieces(g);
  if (!pcs.some(w => w.sprite === GS.piece)) GS.piece = pcs[0] ? pcs[0].sprite : '';
  const f = gearFilter.toLowerCase();
  const byLimb = {}; for (const x of list) { if (f && !x.id.toLowerCase().includes(f)) continue; (byLimb[x.limb] = byLimb[x.limb] || []).push(x); }
  let h = `<h2>${esc(g.id)}</h2><div class="sec">
    <div class="muted" style="margin-bottom:6px">Worn on the <b>${esc(RIG.PART_LABEL[g.limb] || g.limb)}</b>${g.slot ? ' · slot ' + esc(g.slot) : ''}${g.drawOffset ? ' · drawn ' + (g.drawOffset > 0 ? 'in front of' : 'behind') + ' it' : ''}. Your version shows only while you wear it; everyone sees it.</div>`;
  for (const w of pcs) {
    const l = myGear(w.sprite), home = gearHome(w.sprite, w.limb);
    const off = l && home ? { x: l.x - home.x, y: home.y - l.y } : { x: 0, y: 0 };
    h += `<div class="gearPiece ${w.sprite === GS.piece ? 'on' : ''}" data-gpiece="${esc(w.sprite)}">
      <div class="row" style="margin:0"><img class="gthumb" src="${gearThumb(w.sprite)}"><div style="flex:1"><b>${esc(RIG.PART_LABEL[w.limb] || w.limb)}</b><br><span class="muted">${l ? 'your version' : "game's art"}</span></div></div>
      <div class="row"><label>Position</label><span class="muted">x</span><input type="number" step="1" data-gx="${esc(w.sprite)}" value="${off.x}" style="width:56px"><span class="muted">y</span><input type="number" step="1" data-gy="${esc(w.sprite)}" value="${off.y}" style="width:56px"><span class="muted">px</span></div>
      <div class="row"><button data-gdl="${esc(w.sprite)}" title="Save the sprite as a PNG to repaint">⬇ PNG</button><button data-grep="${esc(w.sprite)}" title="Load your repainted PNG">Replace…</button>${l ? `<button data-gzero="${esc(w.sprite)}" title="Back to the game's spot">Center</button><button data-gdel="${esc(w.sprite)}" title="Use the game's art again">✕ Mine</button>` : ''}</div>
    </div>`;
  }
  h += `<div class="muted">Drag it on the body, or use the arrow keys (Shift = 5 px). Try other poses at the top to check it fits while moving.</div></div>`;
  h += `<h2>All wearables</h2><div class="sec"><input id="gearFind" type="text" placeholder="Search…" value="${esc(gearFilter)}" style="width:100%;margin-bottom:6px">`;
  for (const limb of Object.keys(byLimb).sort((a, b) => RIG.PARTS.indexOf(a) - RIG.PARTS.indexOf(b))) {
    h += `<div class="muted" style="margin:6px 0 2px">${esc(RIG.PART_LABEL[limb] || limb)}</div><div class="gearGrid">`;
    for (const x of byLimb[limb]) { const mine = gearPieces(x).some(w => myGear(w.sprite));
      h += `<button class="gearCell ${x.id === GS.item ? 'on' : ''}" data-gitem="${esc(x.id)}" title="${esc(x.id)}"><img src="${gearThumb(x.sprite)}"><span>${mine ? '✎ ' : ''}${esc(x.id)}</span></button>`; }
    h += `</div>`;
  }
  return h + `</div><input id="gearFile" type="file" accept=".png" hidden>`;
}
function bindGearTab() {
  const box = $('#insp'); const g = gearList().find(x => x.id === GS.item); if (!g) return;
  const pieceOf = (sp) => gearPieces(g).find(w => w.sprite === sp);
  box.querySelectorAll('[data-gitem]').forEach(b => b.onclick = () => { GS.item = b.dataset.gitem; GS.piece = ''; renderInspector(); });
  box.querySelectorAll('[data-gpiece]').forEach(d => d.onclick = (e) => { if (e.target.closest('button,input')) return; GS.piece = d.dataset.gpiece; renderInspector(); });
  const fd = $('#gearFind'); if (fd) fd.oninput = () => { gearFilter = fd.value; const pos = fd.selectionStart; renderInspector(); const n = $('#gearFind'); n.focus(); n.setSelectionRange(pos, pos); };
  const setOff = (sp, ax, v) => { const w = pieceOf(sp); pushUndo(); const l = makeMyGear(g, w); const home = gearHome(sp, w.limb); if (!l || !home) return;
    if (ax === 'x') l.x = home.x + Math.round(v); else l.y = home.y - Math.round(v); GS.piece = sp; renderInspector(); renderLayers(); };
  box.querySelectorAll('[data-gx]').forEach(i => i.onchange = () => setOff(i.dataset.gx, 'x', +i.value));
  box.querySelectorAll('[data-gy]').forEach(i => i.onchange = () => setOff(i.dataset.gy, 'y', +i.value));
  box.querySelectorAll('[data-gzero]').forEach(b => b.onclick = () => { setOff(b.dataset.gzero, 'x', 0); setOff(b.dataset.gzero, 'y', 0); });
  box.querySelectorAll('[data-gdel]').forEach(b => b.onclick = () => { const l = myGear(b.dataset.gdel); if (!l) return; pushUndo(); RIG.removeLayers(doc, [l.id]); imgCache.clear(); renderInspector(); renderLayers(); startTest(); toast('Back to the game\'s art. Ctrl+Z to undo.'); });
  box.querySelectorAll('[data-gdl]').forEach(b => b.onclick = () => { const sp = b.dataset.gdl, l = myGear(sp), im = l || RIG.GAME.images[sp]; if (!im) return;
    layerCanvas(im).toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = sp + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); });
  box.querySelectorAll('[data-grep]').forEach(b => b.onclick = () => { const sp = b.dataset.grep; const inp = $('#gearFile');
    inp.onchange = async () => { const f = inp.files[0]; inp.value = ''; if (!f) return; const d = await decodePng(f); const w = pieceOf(sp);
      const l = makeMyGear(g, w); if (!l) return; replaceLayerImage(l, d); thumbCache.clear(); imgCache.clear(); GS.piece = sp; renderInspector(); renderLayers(); startTest(); toast('Replaced. Drag it to fit if it moved.'); };
    inp.click(); });
}
// drag on the canvas: moves your copy of the picked (or clicked) sprite, in the body part's own pixels
function gearHit(sx, sy) {
  for (let i = GS.hits.length - 1; i >= 0; i--) { const h = GS.hits[i], m = h.m; const det = m[0] * m[3] - m[1] * m[2]; if (!det) continue;
    const x = sx - m[4], y = sy - m[5]; const lx = (m[3] * x - m[2] * y) / det, ly = (-m[1] * x + m[0] * y) / det;
    if (lx >= h.box[0] - 1 && lx <= h.box[0] + h.box[2] + 1 && ly >= h.box[1] - 1 && ly <= h.box[1] + h.box[3] + 1) return h; }
  return null;
}
function gearPointerDown(sx, sy) {
  const h = gearHit(sx, sy); if (!h) return;
  const g = gearList().find(x => x.id === GS.item); const w = g && gearPieces(g).find(p => p.sprite === h.sprite); if (!w) return;
  pushUndo(); const l = makeMyGear(g, w); if (!l) return;
  GS.piece = h.sprite; GS.drag = { sx, sy, m: h.m, x0: l.x, y0: l.y, l }; renderInspector();
}
function gearPointerMove(sx, sy) {
  const D = GS.drag; if (!D) { cv.style.cursor = gearHit(sx, sy) ? 'move' : ''; return; }
  const m = D.m, det = m[0] * m[3] - m[1] * m[2]; const dx = sx - D.sx, dy = sy - D.sy;
  D.l.x = D.x0 + Math.round((m[3] * dx - m[2] * dy) / det); D.l.y = D.y0 + Math.round((-m[1] * dx + m[0] * dy) / det);
}
document.addEventListener('keydown', (e) => {
  if (!doc || tab !== 'gear' || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
  const g = gearList().find(x => x.id === GS.item); const w = g && gearPieces(g).find(p => p.sprite === GS.piece); if (!w) return;
  e.preventDefault(); const l = myGear(w.sprite) || (pushUndo(), makeMyGear(g, w)); if (!l) return;
  const k = e.shiftKey ? 5 : 1; l.x += d[0] * k * (GS.facing < 0 ? -1 : 1); l.y += d[1] * k; clearTimeout(GS.rt); GS.rt = setTimeout(renderInspector, 150);
});

// ---- Animate tab: your own touch on top of the game's animations (saved in the rig, played by the mod in game)
const CLIP_LABEL = {
  ExperimentIdle: 'Standing still', ExperimentRun: 'Running', ExperimentRunBack: 'Running backwards', ExperimentIdleCrouch: 'Crouching still', ExperimentRunCrouch: 'Crouch-walking',
  ExperimentAirUp: 'Jumping up', ExperimentAirUpForward: 'Jumping forward', ExperimentUpAirBack: 'Jumping backwards', ExperimentAirDown: 'Falling',
  ExperimentDownAirForward: 'Falling forward', ExperimentDownAirBackward: 'Falling backwards', ExperimentWallForward: 'Wall slide (facing the wall)',
  ExperimentWallBackward: 'Wall slide (back to the wall)', ExperimentClimbUp: 'Climbing up', ExperimentClimbIdle: 'Holding on (climbing)', ExperimentClimbDown: 'Climbing down',
  ExperimentSit: 'Sitting down (idle)', ExperimentLayDown: 'Lying down', ExperimentLayDownAlt: 'Lying down (other)', ExperimentPushups: 'Push-ups', ExperimentSquats: 'Squats', ExperimentPlank: 'Plank',
  ArmsIdle: 'Arms: standing', ArmsRun: 'Arms: running', ArmsCrouch: 'Arms: crouching', ArmsCrouchMove: 'Arms: crouch-walking', ArmsAirUp: 'Arms: jumping', ArmsAirDown: 'Arms: falling',
  ArmsClimbUp: 'Arms: climbing up', ArmsClimbIdle: 'Arms: holding on', ArmsClimbDown: 'Arms: climbing down', ArmsSwing: 'Arms: attack swing', ArmsSit: 'Arms: sitting',
  ArmsLayDown: 'Arms: lying down', ArmsLayDownAlt: 'Arms: lying down (other)', ArmsPushups: 'Arms: push-ups', ArmsSquats: 'Arms: squats', ArmsPlank: 'Arms: plank',
  ArmsGunStraight: 'Arms: aiming ahead', ArmsGunUp: 'Arms: aiming up', ArmsGunDown: 'Arms: aiming down', ArmsGunUpBack: 'Arms: aiming up behind', ArmsGunDownBack: 'Arms: aiming down behind', ArmsGunSuicide: 'Arms: gun to head'
};
const AS = { clip: 'ExperimentRun', t: 0, playing: false, bone: null, drag: null, speed: 1, onion: false, sel: new Set(), clipboard: null };
function fillAnimClips() {
  const sel = $('#animClip'); if (!sel) return;
  const clips = RIG.GAME ? Object.keys(RIG.GAME.clips) : [];
  const mark = (c) => { const a = doc && doc.animations && doc.animations[c]; return !a || a.mode === 'off' ? '' : a.mode === 'replace' ? ' ★' : ' ✎'; };
  const mk = (list) => list.sort((a, b) => (CLIP_LABEL[a] || a).localeCompare(CLIP_LABEL[b] || b)).map(c => `<option value="${c}">${esc(CLIP_LABEL[c] || c)}${mark(c)}</option>`).join('');
  sel.innerHTML = clips.length ? `<optgroup label="Body">${mk(clips.filter(c => RIG.GAME.clips[c].animator !== 'arms'))}</optgroup><optgroup label="Arms (attack, aiming…)">${mk(clips.filter(c => RIG.GAME.clips[c].animator === 'arms'))}</optgroup>` : '';
  if (clips.includes(AS.clip)) sel.value = AS.clip; else if (clips.length) AS.clip = sel.value;
}
$('#animClip').onchange = (e) => { AS.clip = e.target.value; AS.t = 0; AS.sel.clear(); renderInspector(); drawDope(); };
const clipOf = () => RIG.GAME && RIG.GAME.clips[AS.clip];
const clipLen = () => { const c = clipOf(); return c ? (c.length || 0) : 0; };
const clipFps = () => { const c = clipOf(); return (c && c.fps) || 30; };
function bonesOfClip() {
  const c = clipOf(); if (!c || !RIG.GAME) return [];
  const arms = c.animator === 'arms', ap = (RIG.GAME.tpl.armsPath || 'UpTorso/Arms') + '/';
  return (RIG.GAME.tpl.limbs || []).filter(L => L.anim && (arms ? L.anim.startsWith(ap) : !L.anim.startsWith(ap))).map(L => ({ part: L.name, bone: arms ? L.anim.slice(ap.length) : L.anim }));
}
const animEntry = () => (doc && doc.animations || {})[AS.clip];
const clipMode = () => { const a = animEntry(); return a && a.mode ? a.mode : (a ? 'add' : 'off'); };
function animKeys(bone, create) {
  doc.animations = doc.animations || {};
  let a = doc.animations[AS.clip];
  if (!a && create) a = doc.animations[AS.clip] = { mode: 'add', bones: {} };
  if (!a) return null; a.bones = a.bones || {};
  return a.bones[bone] || (create ? (a.bones[bone] = []) : null);
}
// the bone's current value as shown (game + your changes), in the clip's own terms for the current mode
function boneNow(bone) {
  const c = clipOf(); const ga = test && test.ga; if (!c || !ga) return { r: 0, x: 0, y: 0 };
  const keys = animKeys(bone, false);
  if (keys && keys.length) return RIG.sampleKeys(keys, AS.t);
  if (clipMode() === 'replace') { const g = ga.gameBone(AS.clip, bone, AS.t); return { r: g[2], x: g[0], y: g[1] }; }
  return { r: 0, x: 0, y: 0 };
}
function setKey(bone, vals) {
  const keys = animKeys(bone, true), fps = clipFps();
  if (clipMode() === 'off') doc.animations[AS.clip].mode = 'add';
  const t = Math.round(AS.t * fps) / fps;
  let k = keys.find(x => Math.abs(x.t - t) < 0.5 / fps);
  if (!k) { const cur = boneNow(bone); k = { t, r: cur.r || 0, x: cur.x || 0, y: cur.y || 0 }; keys.push(k); keys.sort((a, b) => a.t - b.t); }
  Object.assign(k, vals); return k;
}
function cleanupAnim() { const a = animEntry(); if (!a) return; for (const b in a.bones) if (!a.bones[b].length) delete a.bones[b]; if (!Object.keys(a.bones).length && a.mode !== 'replace') delete doc.animations[AS.clip]; }
// switching modes keeps the look: adjust offsets <-> your own absolute poses
function setAnimMode(m) {
  const ga = test && test.ga; if (!ga) return;
  const cur = clipMode(); if (m === cur) return;
  pushUndo();
  doc.animations = doc.animations || {};
  const a = doc.animations[AS.clip] || (doc.animations[AS.clip] = { mode: 'add', bones: {} });
  if (m !== 'off' && cur !== 'off' && cur !== m) for (const b in a.bones) for (const k of a.bones[b]) {
    const g = ga.gameBone(AS.clip, b, k.t);
    if (m === 'replace') { k.x = g[0] + (k.x || 0); k.y = g[1] + (k.y || 0); k.r = g[2] + (k.r || 0); }
    else { k.x = (k.x || 0) - g[0]; k.y = (k.y || 0) - g[1]; k.r = RIG.angDiff(g[2], k.r || 0); }
  }
  if (m === 'replace' && !Object.keys(a.bones).length) { // start as an exact copy of the game's animation (baked into keys), then pose it your way
    const L = clipLen(), fps = clipFps(), step = L > 6 ? 0.5 : L > 2 ? 0.2 : 0.1;
    const times = []; if (L > 0) { for (let t = 0; t < L - 1e-6; t += step) times.push(Math.round(t * fps) / fps); times.push(L); } else times.push(0);
    for (const b of bonesOfClip()) a.bones[b.bone] = times.map(t => { const g = ga.gameBone(AS.clip, b.bone, t); return { t, x: +g[0].toFixed(4), y: +g[1].toFixed(4), r: +g[2].toFixed(3) }; });
  }
  a.mode = m;
  renderInspector(); drawDope(); fillAnimClips();
  toast(m === 'off' ? 'Using the game\'s animation (your keys are kept; switch back any time)' : m === 'add' ? 'Adjust: your keys are added on top of the game\'s animation' : 'Replace: keyed bones use your own poses', 4500);
}
function allKeyTimes() { const a = animEntry(); const ts = new Set(); if (a) for (const b in a.bones) for (const k of a.bones[b]) ts.add(+k.t.toFixed(4)); return [...ts].sort((x, y) => x - y); }
function stepKey(dir) { const ts = allKeyTimes(); const cur = AS.t; const nx = dir > 0 ? ts.find(t => t > cur + 1e-4) : [...ts].reverse().find(t => t < cur - 1e-4); if (nx !== undefined) { AS.t = nx; AS.playing = false; renderInspector(); } }
function stepFrame(dir) { const fps = clipFps(), L = clipLen(); AS.playing = false; AS.t = Math.max(0, Math.min(L, Math.round(AS.t * fps + dir) / fps)); renderInspector(); }
function keyAll() { pushUndo(); for (const b of bonesOfClip()) setKey(b.bone, {}); renderInspector(); }
function copyPose() { AS.clipboard = {}; for (const b of bonesOfClip()) AS.clipboard[b.bone] = { ...boneNow(b.bone), mode: clipMode() }; toast('Pose copied'); }
function pastePose() { if (!AS.clipboard) { toast('Copy a pose first'); return; } pushUndo(); for (const b in AS.clipboard) { const v = AS.clipboard[b]; if (v.mode !== clipMode() && clipMode() !== 'off') continue; setKey(b, { r: v.r, x: v.x, y: v.y }); } renderInspector(); toast('Pose pasted'); }
function deleteSelKeys() {
  if (!AS.sel.size) { toast('Select keys in the timeline first (click a ◆, Shift+click for more)'); return; }
  pushUndo(); const a = animEntry(); if (!a) return;
  for (const b in a.bones) a.bones[b] = a.bones[b].filter(k => !AS.sel.has(k));
  AS.sel.clear(); cleanupAnim(); renderInspector();
}
function animInspectorHtml() {
  if (!gameMode()) return `<h2>Animate</h2><div class="sec muted">This needs the <b>game template</b> from your game, which holds the game's animations. The mod saves it to <code>BepInEx\\plugins\\AdvancedRigs\\GameTemplate</code> the first time you play with it (or press <b>F10</b> in game). Then click <b>no game template</b> at the top and pick that folder.</div>`;
  const c = clipOf(); if (!c) return '<div class="empty">Pick an animation</div>';
  const bones = bonesOfClip(), mode = clipMode(), a = animEntry();
  let h = `<h2>${esc(CLIP_LABEL[AS.clip] || AS.clip)}</h2><div class="sec"><span class="muted">${c.length ? c.length.toFixed(2) + ' s, ' + (c.loop ? 'loops' : 'plays once') : 'a single pose (the game blends it by speed)'} · ${c.animator === 'arms' ? 'arms' : 'body'} · <b>${mode === 'off' ? 'game default' : mode === 'add' ? 'adjusted' : 'your own'}</b></span>
    <div class="muted" style="margin:6px 0">${mode === 'replace' ? 'Replace: every bone with keys follows your poses; bones without keys stay the game\'s.' : mode === 'add' ? 'Adjust: your keys are added to the game\'s animation.' : 'Game default. Pick Adjust or Replace under the canvas to change it (or just move a bone).'}</div>`;
  h += bones.map(b => { const has = a && a.bones && a.bones[b.bone] && a.bones[b.bone].length; return `<button data-bone="${b.bone}" class="${AS.bone === b.bone ? 'on' : ''}" style="margin:2px">${esc(RIG.PART_LABEL[b.part] || b.part)}${has ? ' ◆' : ''}</button>`; }).join('');
  h += `</div>`;
  if (AS.bone) {
    const cur = boneNow(AS.bone), rest = test && test.ga ? test.ga.rest(c.animator === 'arms' ? test.ga.armsPath + '/' + AS.bone : AS.bone) : [0, 0, 0];
    const rep = mode === 'replace';
    const xv = rep ? cur.x - rest[0] : cur.x, yv = rep ? cur.y - rest[1] : cur.y;
    h += `<h2>${esc(RIG.PART_LABEL[(bones.find(b => b.bone === AS.bone) || {}).part] || AS.bone)} · ${AS.t.toFixed(2)} s</h2><div class="sec">
      <div class="row"><label>${rep ? 'Angle' : 'Turn'}</label><input type="range" id="akR" min="-180" max="180" step="0.5" value="${(cur.r || 0).toFixed(1)}"><input type="number" id="akRn" step="0.5" value="${(cur.r || 0).toFixed(1)}"></div>
      <div class="row"><label>Move ↔ px</label><input type="range" id="akX" min="-24" max="24" step="0.5" value="${(xv * 8).toFixed(1)}"><input type="number" id="akXn" step="0.5" value="${(xv * 8).toFixed(1)}"></div>
      <div class="row"><label>Move ↕ px</label><input type="range" id="akY" min="-24" max="24" step="0.5" value="${(yv * 8).toFixed(1)}"><input type="number" id="akYn" step="0.5" value="${(yv * 8).toFixed(1)}"></div>
      <div class="muted">Drag the bone on the canvas to turn it (Shift+drag moves it). Changing a value keys it at the playhead.</div>
      <div class="row"><button id="akClearBone">Clear this bone's keys</button><button id="akClearClip">Clear all keys</button></div></div>`;
  }
  h += `<h2>Keys</h2><div class="sec muted"><b>Space</b> play · <b>, .</b> previous / next key · <b>← →</b> one frame · <b>K</b> key bone · <b>Shift+K</b> key all · <b>Delete</b> selected keys · <b>Ctrl+C / Ctrl+V</b> pose · drag ◆ in the timeline to retime, Shift+click to pick several, double-click a row to add a key.</div>`;
  const edited = Object.keys(doc.animations || {}).filter(k => doc.animations[k].mode !== 'off');
  h += `<h2>Your animations</h2><div class="sec muted">${edited.length ? edited.map(e => esc(CLIP_LABEL[e] || e) + (doc.animations[e].mode === 'replace' ? ' (own)' : ' (adjusted)')).join(', ') : 'None: your character moves exactly like the game.'}<br><br>Saved in your rig. The mod plays them in game, and every player who sees you sees them, independently of their own.</div>`;
  return h;
}
function bindAnimateTab() {
  const box = $('#insp');
  box.querySelectorAll('[data-bone]').forEach(b => b.onclick = () => { AS.bone = b.dataset.bone; renderInspector(); });
  const c = clipOf(); const rest = c && test && test.ga ? test.ga.rest(c.animator === 'arms' ? test.ga.armsPath + '/' + AS.bone : AS.bone) : [0, 0, 0];
  const put = (key, v) => { const rep = clipMode() === 'replace'; if (key === 'r') setKey(AS.bone, { r: v }); else setKey(AS.bone, { [key]: (v / 8) + (rep ? (key === 'x' ? rest[0] : rest[1]) : 0) }); AS.playing = false; drawDope(); };
  for (const [id, key] of [['#akR', 'r'], ['#akX', 'x'], ['#akY', 'y']]) {
    const r = $(id), n = $(id + 'n'); if (!r) continue;
    r.onpointerdown = () => pushUndo(); n.onfocus = () => pushUndo();
    r.oninput = () => { n.value = r.value; put(key, +r.value); };
    n.onchange = () => { r.value = n.value; put(key, +n.value); renderInspector(); };
    r.onchange = () => renderInspector();
  }
  const cb = $('#akClearBone'); if (cb) cb.onclick = () => { pushUndo(); const a = animEntry(); if (a) delete a.bones[AS.bone]; cleanupAnim(); renderInspector(); };
  const cc = $('#akClearClip'); if (cc) cc.onclick = () => { if (confirm('Remove every key of this animation (back to the game\'s)?')) { pushUndo(); delete doc.animations[AS.clip]; renderInspector(); } };
  fillAnimClips(); updateDopeBar(); drawDope();
}
// ---- the timeline (dope sheet)
const DOPE = { label: 118, ruler: 20, row: 17 };
function dopeGeom() {
  const cvs = $('#dopeCv'); const d = window.devicePixelRatio || 1; const r = cvs.getBoundingClientRect();
  if (cvs.width !== Math.round(r.width * d) || cvs.height !== Math.round(r.height * d)) { cvs.width = Math.round(r.width * d); cvs.height = Math.round(r.height * d); }
  const L = clipLen(); const W = r.width, H = r.height;
  const x0 = DOPE.label + 10, x1 = W - 14;
  return { cvs, d, W, H, L, x0, x1, tx: (t) => x0 + (L > 0 ? t / L : 0) * (x1 - x0), xt: (x) => L > 0 ? Math.max(0, Math.min(L, (x - x0) / (x1 - x0) * L)) : 0 };
}
function updateDopeBar() {
  document.querySelectorAll('[data-amode]').forEach(b => b.classList.toggle('on', b.dataset.amode === clipMode()));
  $('#dpPlay').textContent = AS.playing ? '❚❚' : '▶'; $('#dpOnion').classList.toggle('on', AS.onion);
}
function drawDope() {
  if (tab !== 'anim' || !doc) return;
  const G = dopeGeom(), g = G.cvs.getContext('2d'); g.setTransform(G.d, 0, 0, G.d, 0, 0);
  const P = CV(); g.fillStyle = P.bg; g.fillRect(0, 0, G.W, G.H);
  if (!clipOf()) return;
  const fps = clipFps(), L = G.L, bones = bonesOfClip(), a = animEntry(), mode = clipMode();
  g.font = '10px ui-monospace, Consolas, monospace'; g.textBaseline = 'middle';
  // ruler
  g.fillStyle = P.sheet; g.fillRect(0, 0, G.W, DOPE.ruler);
  if (L > 0) { const step = L > 4 ? 1 : L > 1.5 ? 0.25 : 0.1; for (let t = 0; t <= L + 1e-6; t += 1 / fps) { const x = G.tx(t); const major = Math.abs(t / step - Math.round(t / step)) < 1e-3; g.strokeStyle = major ? P.groundLine : P.grid; g.beginPath(); g.moveTo(x + .5, major ? 4 : 12); g.lineTo(x + .5, DOPE.ruler); g.stroke(); if (major) { g.fillStyle = P.text; g.fillText(t.toFixed(step < 1 ? 2 : 0), x + 3, 8); } } }
  else { g.fillStyle = P.text; g.fillText('single pose', G.x0, 10); }
  // rows
  bones.forEach((b, i) => {
    const y = DOPE.ruler + i * DOPE.row;
    g.fillStyle = b.bone === AS.bone ? 'rgba(195,39,47,.18)' : (i % 2 ? 'rgba(255,255,255,.02)' : 'transparent'); g.fillRect(0, y, G.W, DOPE.row);
    g.fillStyle = b.bone === AS.bone ? '#fff' : P.text; g.fillText((RIG.PART_LABEL[b.part] || b.part).slice(0, 18), 8, y + DOPE.row / 2);
    const keys = a && a.bones && a.bones[b.bone] || [];
    for (const k of keys) {
      const x = L > 0 ? G.tx(k.t) : G.x0 + 6, cy = y + DOPE.row / 2, s = 5;
      g.beginPath(); g.moveTo(x, cy - s); g.lineTo(x + s, cy); g.lineTo(x, cy + s); g.lineTo(x - s, cy); g.closePath();
      g.fillStyle = AS.sel.has(k) ? '#ffcf4a' : (mode === 'off' ? '#555' : mode === 'replace' ? '#e0475b' : '#4cc38a'); g.fill(); g.strokeStyle = '#000'; g.stroke();
    }
  });
  // playhead
  const px = L > 0 ? G.tx(AS.t) : G.x0; g.strokeStyle = '#e0475b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, G.H); g.stroke(); g.lineWidth = 1;
  $('#dpTime').textContent = AS.t.toFixed(2) + ' / ' + L.toFixed(2) + ' s · frame ' + Math.round(AS.t * fps);
}
function dopeHit(ev) {
  const G = dopeGeom(), r = G.cvs.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
  const bones = bonesOfClip(), a = animEntry(); const row = Math.floor((y - DOPE.ruler) / DOPE.row);
  let key = null, bone = row >= 0 && row < bones.length ? bones[row].bone : null;
  if (bone && a && a.bones && a.bones[bone]) for (const k of a.bones[bone]) { const kx = G.L > 0 ? G.tx(k.t) : G.x0 + 6; if (Math.abs(kx - x) < 7) { key = k; break; } }
  return { G, x, y, bone, key, inLabels: x < DOPE.label, inRuler: y < DOPE.ruler };
}
$('#dopeCv').addEventListener('pointerdown', (ev) => {
  const h = dopeHit(ev); $('#dopeCv').setPointerCapture(ev.pointerId); AS.playing = false;
  if (h.bone && (h.inLabels || h.key)) AS.bone = h.bone;
  if (h.key) {
    if (ev.shiftKey) { if (AS.sel.has(h.key)) AS.sel.delete(h.key); else AS.sel.add(h.key); } else if (!AS.sel.has(h.key)) { AS.sel.clear(); AS.sel.add(h.key); }
    pushUndo(); AS.dopeDrag = { type: 'keys', x0: h.x, orig: [...AS.sel].map(k => [k, k.t]) };
  } else if (!h.inLabels) { if (!ev.shiftKey) AS.sel.clear(); AS.t = h.G.xt(h.x); AS.dopeDrag = { type: 'scrub' }; }
  renderInspector();
});
$('#dopeCv').addEventListener('pointermove', (ev) => {
  if (!AS.dopeDrag) return; const h = dopeHit(ev);
  if (AS.dopeDrag.type === 'scrub') { AS.t = h.G.xt(h.x); drawDope(); return; }
  const fps = clipFps(), L = clipLen(); if (L <= 0) return;
  const dt = (h.x - AS.dopeDrag.x0) / (h.G.x1 - h.G.x0) * L;
  for (const [k, t0] of AS.dopeDrag.orig) k.t = Math.max(0, Math.min(L, Math.round((t0 + dt) * fps) / fps));
  drawDope();
});
$('#dopeCv').addEventListener('pointerup', () => { if (AS.dopeDrag && AS.dopeDrag.type === 'keys') { const a = animEntry(); if (a) for (const b in a.bones) a.bones[b].sort((p, q) => p.t - q.t); } AS.dopeDrag = null; renderInspector(); });
$('#dopeCv').addEventListener('dblclick', (ev) => { const h = dopeHit(ev); if (!h.bone || h.inLabels) return; pushUndo(); AS.t = h.G.xt(h.x); AS.bone = h.bone; setKey(h.bone, {}); renderInspector(); });
document.querySelectorAll('[data-amode]').forEach(b => b.onclick = () => setAnimMode(b.dataset.amode));
$('#dpFirst').onclick = () => { AS.t = 0; AS.playing = false; renderInspector(); };
$('#dpLast').onclick = () => { AS.t = clipLen(); AS.playing = false; renderInspector(); };
$('#dpPrevK').onclick = () => stepKey(-1); $('#dpNextK').onclick = () => stepKey(1);
$('#dpPlay').onclick = () => { AS.playing = !AS.playing; updateDopeBar(); };
$('#dpSpeed').onchange = (e) => { AS.speed = +e.target.value; };
$('#dpKey').onclick = () => { if (!AS.bone) { toast('Pick a bone first'); return; } pushUndo(); setKey(AS.bone, {}); renderInspector(); };
$('#dpKeyAll').onclick = keyAll; $('#dpDel').onclick = deleteSelKeys; $('#dpCopy').onclick = copyPose; $('#dpPaste').onclick = pastePose;
$('#dpOnion').onclick = () => { AS.onion = !AS.onion; updateDopeBar(); };
document.addEventListener('keydown', (e) => {
  if (tab !== 'anim' || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); AS.playing = !AS.playing; updateDopeBar(); }
  else if (k === ',') stepKey(-1); else if (k === '.') stepKey(1);
  else if (k === 'ArrowLeft') { e.preventDefault(); stepFrame(-1); } else if (k === 'ArrowRight') { e.preventDefault(); stepFrame(1); }
  else if (k.toLowerCase() === 'k') { if (e.shiftKey) keyAll(); else if (AS.bone) { pushUndo(); setKey(AS.bone, {}); renderInspector(); } }
  else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelKeys(); }
  else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') { e.preventDefault(); copyPose(); }
  else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'v') { e.preventDefault(); pastePose(); }
});
// click a part on the canvas to pick its bone; drag to turn it (Shift+drag to move it)
function animPointerDown(sx, sy, ev) {
  if (!test || !test.lastFrames || !gameMode()) return;
  const bones = bonesOfClip(); let best = null, bd = 40;
  for (const b of bones) {
    const m = test.lastFrames[b.part]; if (!m) continue;
    const p = RIG.M.pt(test.lastS, { x: m[4], y: m[5] }); const dd = Math.hypot(p.x - sx, p.y - sy);
    if (dd < bd) { bd = dd; best = { ...b, p }; }
  }
  if (!best) return;
  AS.bone = best.bone; AS.playing = false; pushUndo();
  const cur = boneNow(best.bone);
  AS.drag = { bone: best.bone, px: best.p.x, py: best.p.y, sx, sy, a0: Math.atan2(-(sy - best.p.y), sx - best.p.x), r0: cur.r || 0, x0: cur.x || 0, y0: cur.y || 0, move: ev && ev.shiftKey };
  renderInspector();
}
function animPointerMove(sx, sy) {
  if (!AS.drag) return;
  if (AS.drag.move) { const z = test.zoom || 44; setKey(AS.drag.bone, { x: +(AS.drag.x0 + (sx - AS.drag.sx) / z).toFixed(4), y: +(AS.drag.y0 - (sy - AS.drag.sy) / z).toFixed(4) }); drawDope(); return; }
  const a = Math.atan2(-(sy - AS.drag.py), sx - AS.drag.px);
  let d = (a - AS.drag.a0) * 180 / Math.PI; d = ((d + 540) % 360) - 180;
  setKey(AS.drag.bone, { r: +(AS.drag.r0 + d).toFixed(1) }); drawDope();
}

// ---- the test level (units, y up, ground at 0): walls to wall-jump between, a ladder, a crate (no water: it froze the character)
const LEVEL_SMALL = {
  boxes: [{ x0: -60, x1: 60, y0: -6, y1: 0 },
    { x0: -13, x1: -12, y0: 0, y1: 18 }, { x0: 18, x1: 19, y0: 0, y1: 18 }, { x0: 3, x1: 6, y0: 0, y1: 1.6 }],
  ladder: { x0: -8, x1: -7, y0: 0, y1: 9 }
};
// the same level at the game's scale (its character runs at 25 units/s and jumps ~6 units)
const LEVEL_GAME = {
  boxes: [{ x0: -120, x1: 120, y0: -8, y1: 0 },
    { x0: -31, x1: -30, y0: 0, y1: 40 }, { x0: 46, x1: 47, y0: 0, y1: 40 }, { x0: 8, x1: 13, y0: 0, y1: 3 }],
  ladder: { x0: -19, x1: -18, y0: 0, y1: 16 }
};
let LEVEL = LEVEL_SMALL;
const gameMode = () => !!(RIG.GAME && RIG.GAME.clips && RIG.GAME.clips.ExperimentIdle);
// the game's own movement numbers when the game template is loaded (from the player's game)
function moveConsts(T) {
  const g = RIG.GAME && RIG.GAME.tpl && RIG.GAME.tpl.body;
  if (!g || !gameMode()) return Object.assign({}, MOVE, { wallSlide: MOVE.wallSlide, footBottom: 2.415 + 0.7 });
  const cs = g.colSize || [1.6, 5], er = g.edgeRadius || 0.1, m = g.mass || 50;
  return { maxSpeed: g.maxSpeed, walkSpeed: g.maxSpeed * 0.5, crouchSpeed: g.maxSpeed * 0.5, moveForce: g.moveForce / m, slowdown: g.slowdownAmount,
    gravity: Math.abs(g.gravity || 55), jumpSpeed: g.jumpSpeed, wallSlide: g.wallSlideSlowdown * (1 / (1 + (T ? T.slidTime || 0 : 0) * 0.35)),
    climbSpeed: 6, swimSpeed: 6, halfW: cs[0] / 2 + er, height: cs[1] + 2 * er, footBottom: cs[1] / 2 + er, fixedDt: g.fixedDt || 0.02 };
}
// movement, ported from the game's Body.FixedUpdate / Jump at its 50 Hz fixed step and gravity (-55). Speed / jump numbers are
// close guesses: the game keeps them in the player prefab, which the asset rips don't include.
const MOVE = { maxSpeed: 7, walkSpeed: 3.2, crouchSpeed: 2.2, moveForce: 90, slowdown: 0.2, gravity: 55 /* the game's Physics2D gravity */, jumpSpeed: 18, wallSlide: 0.12, climbSpeed: 3.5, swimSpeed: 3, halfW: 0.45, height: 5.4 };
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (tab !== 'test' || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
  const k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if (!keys.has(k) && test) {
    if (k === ' ') test.jumpQueued = 0.15;
    if (k === 'f') test.attackCd = 0.45;
    if (k === 'r') test.down = !test.down;
    if (k === 'z') test.sleep = !test.sleep;
    if (k === 'x') test.deadT = !test.deadT;
  }
  keys.add(k);
});
window.addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (test && e.key === ' ') test.jumpHeld = false; });
window.addEventListener('blur', () => keys.clear());
const boxHit = (x0, x1, y0, y1) => LEVEL.boxes.some(b => x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1);

// one fixed physics step for keyboard play (50 Hz like the game's FixedUpdate)
function playStep(T, dt) {
  const b = T.body, P = moveConsts(T);
  LEVEL = gameMode() ? LEVEL_GAME : LEVEL_SMALL;
  const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const up = keys.has('w') || keys.has('arrowup'), dn = keys.has('s') || keys.has('arrowdown');
  const lying = T.down || T.sleep || T.deadT;
  const onLadder = b.x > LEVEL.ladder.x0 - 0.3 && b.x < LEVEL.ladder.x1 + 0.3 && b.y < LEVEL.ladder.y1 && b.y + 2 > LEVEL.ladder.y0;
  T.inWater = false;
  T.jumpCd = Math.max(0, T.jumpCd - dt); T.jumpQueued = Math.max(0, (T.jumpQueued || 0) - dt);
  T.sinceGround += dt; T.sinceSlidL += dt; T.sinceSlidR += dt;
  if (lying) { T.climbing = false; T.vx *= 0.9; }
  // ladders: W / S grabs it; jumping lets go
  if (!lying && onLadder && (up || dn) && !T.climbing) T.climbing = true;
  if (T.climbing && !onLadder) T.climbing = false;
  T.crouch = !lying && dn && T.grounded && !T.climbing;
  const maxS = T.crouch ? P.crouchSpeed : (keys.has('shift') ? P.walkSpeed : P.maxSpeed);
  const move = lying ? 0 : kx;
  if (T.climbing) { T.vx = move * 1.5; T.vy = ((up ? 1 : 0) - (dn ? 1 : 0)) * P.climbSpeed; }
  else if (T.inWater) {
    T.vx += (move * P.swimSpeed - T.vx) * Math.min(1, dt * 3);
    T.vy += ((up || T.jumpHeld ? 1 : 0) * 4 - (dn ? 3 : 0) - 1.2 - T.vy) * Math.min(1, dt * 3); // buoyant
  } else {
    if (move > 0 && T.vx < maxS) T.vx += P.moveForce * dt;
    if (move < 0 && T.vx > -maxS) T.vx -= P.moveForce * dt;
    if (T.grounded && Math.abs(T.vx) > maxS) T.vx = Math.sign(T.vx) * maxS;
    if (move === 0 || (move > 0 && T.vx < 0) || (move < 0 && T.vx > 0)) T.vx *= 1 - P.slowdown * (T.grounded ? 1 : 0.5);
    const g = (T.vy > 0 && !T.jumpHeld && T.vy <= P.jumpSpeed) ? 2.5 : 1; // let go of jump early = shorter jump
    T.vy -= P.gravity * g * dt;
    if ((T.slidingL || T.slidingR) && T.vy < 0) T.vy *= 1 - P.wallSlide;
  }
  // jump / wall jump (same rules as the game: alternate walls, a short grace time after leaving the ground)
  if (T.jumpQueued > 0 && T.jumpCd <= 0 && !lying) {
    if (T.grounded || T.climbing || T.sinceGround <= 0.11 || T.inWater) {
      if (T.climbing) { T.climbing = false; T.vx = move * P.maxSpeed * 0.5; }
      T.vy = P.jumpSpeed; T.jumpCd = 0.25; T.jumpQueued = 0; T.jumpHeld = true; T.grounded = false;
    } else {
      const canL = T.sinceSlidL < 0.21, canR = T.sinceSlidR < 0.21;
      if ((canL || canR) && (T.firstWallJump || (canL && T.lastRight) || (canR && !T.lastRight))) {
        T.lastRight = canR; T.firstWallJump = false;
        T.vx = (canL ? 1 : -1) * P.jumpSpeed; T.vy = P.jumpSpeed; T.jumpCd = 0.25; T.jumpQueued = 0; T.jumpHeld = true;
      }
    }
  }
  // move and collide (feet at b.y, body P.height tall)
  const lastVx = T.vx;
  let nx = b.x + T.vx * dt;
  if (boxHit(nx - P.halfW, nx + P.halfW, b.y + 0.3, b.y + P.height)) { nx = b.x; T.vx = 0; }
  b.x = nx;
  let ny = b.y + T.vy * dt; T.grounded = false;
  if (boxHit(b.x - P.halfW, b.x + P.halfW, ny, ny + P.height)) {
    if (T.vy <= 0) { // land on top of whatever is under us
      let top = -1e9; for (const bx of LEVEL.boxes) if (b.x + P.halfW > bx.x0 && b.x - P.halfW < bx.x1 && bx.y1 <= b.y + 0.05) top = Math.max(top, bx.y1);
      ny = top > -1e8 ? top : b.y; T.grounded = true; T.sinceGround = 0; T.firstWallJump = true;
    } else ny = b.y;
    T.vy = 0;
  }
  b.y = ny;
  if (T.climbing) { T.grounded = false; T.firstWallJump = true; }
  // wall sliding: pushing into a wall
  T.slidingR = move > 0 && boxHit(b.x + P.halfW, b.x + P.halfW + 0.12, b.y + 0.5, b.y + P.height);
  T.slidingL = move < 0 && boxHit(b.x - P.halfW - 0.12, b.x - P.halfW, b.y + 0.5, b.y + P.height);
  if (T.slidingR) T.sinceSlidR = 0; if (T.slidingL) T.sinceSlidL = 0;
  T.slidTime = (T.slidingL || T.slidingR) && T.vy < 0 ? (T.slidTime || 0) + dt : 0;
  if (move !== 0 && !lying) b.facing = move;
  // the game's lean: speeding up / slowing down tilts the standing body (Body.accelRot)
  b.accelRot += ((T.prevVx - T.vx) * 15 - b.accelRot) * Math.min(1, dt * 5);
  T.prevVx = T.vx;
  if (b.y < -40) { b.x = 0; b.y = 0; T.vx = T.vy = 0; }
  void lastVx;
}

// which state the mod would pick (same priority as the mod's Actions.Of)
function playAction(T) {
  if (T.deadT) return 'dead'; if (T.sleep) return 'sleep'; if (T.down) return 'down';
  if (T.inWater) return 'swim'; if (T.climbing) return 'climb'; if (T.attackCd > 0) return 'attack';
  if (!T.grounded) { if (T.vy < 0 && (T.slidingL || T.slidingR)) return 'wallslide'; return T.vy > 0.5 ? 'jump' : 'fall'; }
  if (T.crouch) return 'crouch';
  if (T.idleTime > 12 && Math.abs(T.vx) < 1) return 'sit';
  const vx = Math.abs(T.vx); if (vx > 4.5) return 'run'; if (vx > 1.2) return 'walk'; return 'idle';
}

// eyes the game would show right now (FacialExpression.Update, simplified to what the test can know)
function autoEye(T, act) {
  T.blink -= T.dtLast; if (T.blink <= 0) T.blink = 2 + Math.random() * 2.2;
  let e = 'experimentEyeOpen', strong = false;
  if (T.vy < -MOVE.jumpSpeed * 2.25 && !T.grounded) { e = 'experimentEyePanic'; strong = true; }
  else if ((act === 'fall' && T.vy < -MOVE.jumpSpeed * 1.5) || act === 'down') e = 'experimentEyeScared';
  if (!strong) { if (T.blink < 0.04) e = 'experimentEyeHalfClosed'; else if (T.blink < 0.08) e = 'experimentEyeClosed'; else if (T.blink < 0.12) e = 'experimentEyeHalfClosed'; }
  if (act === 'sleep' || act === 'down' || act === 'dead' || act === 'swim') e = 'experimentEyeClosed';
  return e;
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!test) return;
  const dt = Math.min(0.05, (now - test.last) / 1000); test.last = now; test.timer += dt; test.dtLast = dt;
  const T = test, b = T.body, A = T.mode;
  const d = window.devicePixelRatio || 1; const W = cv.width / d, H = cv.height / d;
  const ease = (cur, to, k) => cur + (to - cur) * Math.min(1, dt * k);
  b.t += dt;
  let act = A;
  const gearMode = tab === 'gear';
  const animMode = tab === 'anim';
  if (gearMode) { T.vx = 0; T.vy = 0; b.x = 0; b.y = 0; b.facing = GS.facing; b.accelRot = 0; T.grounded = true; act = 'idle'; if (GS.playing) GS.t += dt; }
  else if (animMode) { T.vx = 0; T.vy = 0; b.x = 0; b.y = 0; b.facing = 1; b.accelRot = 0; T.grounded = true; act = 'idle';
    const c = clipOf(); if (c && AS.playing && c.length > 0) { AS.t += dt * AS.speed; if (AS.t > c.length) AS.t = c.loop ? AS.t % c.length : 0; }
    drawDope();
  } else if (A === 'play') {
    T.acc = (T.acc || 0) + dt; while (T.acc >= 0.02) { T.acc -= 0.02; playStep(T, 0.02); }
    T.attackCd = Math.max(0, (T.attackCd || 0) - dt);
    const stillNow = Math.abs(T.vx) < 0.1 && T.grounded && !keys.size;
    T.idleTime = stillNow ? (T.idleTime || 0) + dt : 0;
    act = playAction(T);
    T.jumpHeld = T.jumpHeld && keys.has(' ');
  } else if (grab) {
    const tx = T.camX + (grab.sx - W / 2) / T.zoom, ty = (H * 0.72 - grab.sy) / T.zoom + T.camY;
    const nx = b.x + (tx - b.x) * Math.min(1, dt * 18), ny = Math.max(0, b.y + (ty - b.y) * Math.min(1, dt * 18));
    T.vx = (nx - b.x) / Math.max(dt, 1e-3); T.vy = (ny - b.y) / Math.max(dt, 1e-3); b.x = nx; b.y = ny;
  } else { // demo of one action
    const speed = { walk: 3, run: 7, crouch: 1.6, swim: 2 }[A] || 0;
    if (speed) { if (T.timer > 2.8) { T.timer = 0; T.dir *= -1; } b.facing = T.dir; }
    T.vx = ease(T.vx, speed * T.dir, 6);
    b.x += T.vx * dt;
    if (A === 'fall' || A === 'wallslide') { T.vy = ease(T.vy, A === 'wallslide' ? -4 : -14, 3); b.y += T.vy * dt; if (b.y < 20) { b.y = 5000; T.camY = b.y; } }
    else if (A === 'climb') { T.vy = 1.6; b.y += T.vy * dt; }
    else {
      if (b.y > 30) { b.y = 0; T.vy = 0; }
      if (A === 'jump' && b.y <= 0 && T.timer > 0.6) { T.timer = 0; T.vy = 9.5; }
      if (b.y > 0 || T.vy > 0) { T.vy -= 22 * dt; b.y = Math.max(0, b.y + T.vy * dt); if (b.y <= 0) T.vy = 0; }
    }
    if (A === 'attack') T.attackCd = (b.t % 0.9) < 0.45 ? 0.3 : 0;
    T.grounded = b.y <= 0.01 && A !== 'fall' && A !== 'climb' && A !== 'wallslide';
    b.accelRot = 0;
  }
  // pose for the state
  const lying = act === 'sleep' || act === 'down' || act === 'dead';
  const alive = act !== 'dead';
  const moving = Math.abs(T.vx) > 1.2;
  const onGround = A === 'play' ? T.grounded : (b.y <= 0.01 && A !== 'fall' && A !== 'climb');
  b.stride = ease(b.stride, onGround && moving && !lying ? Math.min(1, Math.abs(T.vx) / 5) + 0.25 : (act === 'swim' ? 0.4 : 0), 8);
  b.run = ease(b.run, Math.max(0, Math.min(1, (Math.abs(T.vx) - 3) / 4)), 6);
  b.crouch = ease(b.crouch, act === 'crouch' || act === 'sit' ? 1 : (!onGround && !lying && act !== 'climb' && act !== 'swim' ? 0.25 : 0), 8);
  b.lie = ease(b.lie, lying ? 1 : 0, 5);
  b.climb = ease(b.climb, act === 'climb' ? 1 : (act === 'wallslide' ? 0.5 : 0), 8);
  b.swim = ease(b.swim, act === 'swim' ? 1 : 0, 6);
  if (act === 'attack') { const p = 1 - Math.min(1, (T.attackCd || 0) / 0.45); b.attack = p < 0.3 ? p / 0.3 : Math.max(0, 1 - (p - 0.3) / 0.7); } else b.attack = ease(b.attack, 0, 10);
  if (act === 'climb' || act === 'swim') b.walk += dt * (act === 'climb' ? (A === 'play' ? Math.abs(T.vy) * 1.6 : 5) : 4);
  else b.walk += dt * Math.abs(T.vx) * 2.2;
  b.tailAngle = ease(b.tailAngle, Math.abs(T.vx) > 1.4 ? -6 : 23.6, 3);
  let frames;
  const useGame = gameMode() && T.ga && !lying;
  if (gearMode && gameMode() && T.ga) {
    T.ga.overrides = doc.animations || {};
    const P = GEAR_POSES.find(x => x[0] === GS.pose) || GEAR_POSES[0], ga = T.ga;
    const tb = ga.clips[P[1]] ? GS.t % Math.max(0.001, ga.clips[P[1]].length || 0.001) : 0, ta = ga.clips[P[2]] ? GS.t % Math.max(0.001, ga.clips[P[2]].length || 0.001) : 0;
    frames = RIG.gameFrames(ga, ga.combine(ga.clipPose(P[1], tb), ga.clipPose(P[2], ta)), { x: 0, y: 0, facing: GS.facing, accelRot: 0, crouchAmount: 0, grounded: true, tailAngle: b.tailAngle });
  } else if (animMode && gameMode() && T.ga) {
    T.ga.overrides = doc.animations || {};
    frames = RIG.gameFrames(T.ga, T.ga.single(AS.clip, AS.t), { x: 0, y: 0, facing: 1, accelRot: 0, crouchAmount: 0, grounded: true, tailAngle: b.tailAngle });
  } else if (useGame) {
    // the game's Animator: same parameters Body.cs feeds it, same clips, same blend trees
    const crouchT = act === 'crouch' ? 1 : 0;
    T.crouchAmt = (T.crouchAmt || 0) + (crouchT - (T.crouchAmt || 0)) * Math.min(1, dt * 8);
    const sine = (t) => (Math.cos(t * Math.PI) - 1) / -2;
    const G = {
      fwd: T.vx * b.facing, up: act === 'climb' ? (A === 'play' ? T.vy : 4) : T.vy, armsUp: T.vy,
      grounded: onGround || act === 'sit' || act === 'exercise', crouch: sine(T.crouchAmt) * 10000, climbing: act === 'climb',
      wallSide: act === 'wallslide' ? 1 : 0,
      force: act === 'sit' ? 'ExperimentSit' : act === 'exercise' ? 'ExperimentPushups' : null,
      armsForce: act === 'attack' ? 'ArmsSwing' : act === 'sit' ? 'ArmsSit' : act === 'exercise' ? 'ArmsPushups' : null,
      swingDone: act !== 'attack'
    };
    if (act === 'swim') G.grounded = false;
    T.ga.overrides = doc.animations || {};
    const pose = T.ga.update(dt, G);
    frames = RIG.gameFrames(T.ga, pose, { x: b.x, y: b.y, facing: b.facing, accelRot: b.accelRot || 0, crouchAmount: T.crouchAmt, grounded: G.grounded, tailAngle: b.tailAngle });
  } else frames = RIG.bodyFrames(b);
  const airborne = !onGround && act !== 'climb' && act !== 'swim';
  T.rt.update(dt, { frames, alive, moving, airborne });
  // mouth: hold T to talk (the game opens the mouth from body.eatTime: half above 0, open above 0.15)
  T.eat = Math.max(0, (T.eat || 0) - dt);
  if (keys.has('t') && T.eat <= 0) T.eat = (0.05 + Math.random() * 0.05) * (Math.random() < 0.3 ? 2.5 : 1);
  let headState = $('#headState').value;
  if (!headState) headState = T.eat > 0.15 ? 'experimentHeadBackMouth' : (T.eat > 0 ? 'experimentHeadBackMouthMini' : '');
  const eyeState = $('#eyePrev').value || autoEye(T, act);
  // camera
  const follow = A === 'play' || A === 'fall' || A === 'climb' || A === 'wallslide';
  T.camX += (b.x - T.camX) * Math.min(1, dt * 4);
  T.camY += ((follow ? Math.max(0, b.y - 1) : 0) - T.camY) * Math.min(1, dt * (A === 'fall' || A === 'wallslide' ? 10 : 4));
  const z = T.zoom;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const PAL = CV(); ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
  if (gearMode) { T.camX = 0; T.camY = 0; }
  const groundY = (animMode ? Math.max(120, (H - 206) * 0.86) : gearMode ? H * 0.8 : H * 0.72) + T.camY * z; // screen y of world y = 0 (above the timeline in Animate)
  const x0 = W / 2 - T.camX * z;
  const sx = (x) => x0 + x * z, sy = (y) => groundY - y * z;
  ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1;
  for (let gx = Math.floor((T.camX - W / 2 / z) / 2) * 2; gx < T.camX + W / 2 / z; gx += 2) { ctx.beginPath(); ctx.moveTo(sx(gx), 0); ctx.lineTo(sx(gx), H); ctx.stroke(); }
  for (let gy = Math.floor(T.camY / 2) * 2 - 14; gy < T.camY + 16; gy += 2) { const y = sy(gy); if (y < 0 || y > H) continue; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (A === 'play' && !gearMode && !animMode) { // the level
    
    const L = LEVEL.ladder; ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = Math.max(1, z * 0.08);
    ctx.beginPath(); ctx.moveTo(sx(L.x0), sy(L.y0)); ctx.lineTo(sx(L.x0), sy(L.y1)); ctx.moveTo(sx(L.x1), sy(L.y0)); ctx.lineTo(sx(L.x1), sy(L.y1));
    for (let y = L.y0 + 0.6; y < L.y1; y += 0.9) { ctx.moveTo(sx(L.x0), sy(y)); ctx.lineTo(sx(L.x1), sy(y)); } ctx.stroke();
    ctx.fillStyle = PAL.box; for (const bx of LEVEL.boxes) ctx.fillRect(sx(bx.x0), sy(bx.y1), (bx.x1 - bx.x0) * z, (bx.y1 - bx.y0) * z);
    ctx.strokeStyle = PAL.groundLine; ctx.lineWidth = 1; for (const bx of LEVEL.boxes) ctx.strokeRect(sx(bx.x0) + .5, sy(bx.y1) + .5, (bx.x1 - bx.x0) * z, (bx.y1 - bx.y0) * z);
  } else {
    if (act === 'climb') { ctx.fillStyle = '#1a1c22'; ctx.fillRect(sx(b.x + 0.9 * b.facing) - (b.facing > 0 ? 0 : 0.6 * z), 0, 0.6 * z, Math.min(H, groundY)); }
    if (groundY < H + 2) { ctx.fillStyle = PAL.ground; ctx.fillRect(0, groundY, W, H - groundY); ctx.strokeStyle = PAL.groundLine; ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke(); }
  }
  const footBottom = (useGame || animMode || gearMode) && gameMode() ? moveConsts(T).footBottom : 2.415 + 0.7;
  const S = [z, 0, 0, -z, x0, groundY - footBottom * z];
  T.lastS = S; T.lastFrames = frames;
  ctx.imageSmoothingEnabled = false;
  const ppu = RIG.PPU, pix = [1 / ppu, 0, 0, -1 / ppu, 0, 0];
  const replaced = new Set(T.rig.chains.filter(c => c.hideTarget).map(c => c.attachTo));
  const inj = tab === 'test' ? testInj : {}; const hv = RIG.hurtView(inj);
  const items = T.rt.drawList({ frames, action: act, headState, injuries: inj });
  // the game's own parts this rig doesn't replace (drawn with the game's sprites, or your skin swaps)
  for (const part of RIG.PARTS) if (!replaced.has(part) && !hv.hidden.has(part)) items.push({ ghost: part, order: RIG.ORDER[part], m: frames[part] });
  // what the game itself puts on a hurt limb (Limb.MakeBoneSprite, CreateTemporarySprite): broken bone, bandage wrap, splint
  for (const part of RIG.PARTS) { if (hv.hidden.has(part) || !frames[part]) continue; const sts = RIG.statesOf(inj, part);
    if (sts.includes('broken')) items.push({ fx: 'brokenBone', part, order: RIG.ORDER[part] + 1, m: frames[part], angle: (part.length * 47 + part.charCodeAt(0) * 13) % 360 });
    if (sts.includes('bandaged')) items.push({ fx: 'bandageWrap', part, order: RIG.ORDER[part] + 2, m: frames[part], angle: 0, wrap: true });
    if (sts.includes('splinted') && !/Head|Torso/.test(part)) items.push({ fx: 'splint', part, order: RIG.ORDER[part] + 2.1, m: frames[part], angle: -90 }); }
  if (!T.rig.hideVanillaTail) items.push({ ghost: 'tail', order: RIG.ORDER.tail, m: frames.tail });
  // eyes: drawn on the head, above it
  const headItem = items.find(it => !it.ghost && it.chainAttach === 'Head' && it.isPart);
  const eyesHidden = T.rig.hideObjects.includes('Eyes');
  if (!eyesHidden && !hv.hidden.has('Head')) items.push({ eyes: true, order: (headItem ? headItem.order : RIG.ORDER.Head) + 0.5, m: frames.Head });
  // an item worn in the test: your version if you drew one, the game's otherwise, on its body part (like Body.WearItem)
  const wearId = gearMode ? GS.item : ($('#wearPrev') ? $('#wearPrev').value : '');
  const wearG = wearId && RIG.GAME ? (RIG.GAME.tpl.gear || []).find(g => g.id === wearId) : null;
  if (wearG) {
    const partOrder = (part) => { const pc = T.rig.chains.find(c => c.hideTarget && c.attachTo === part); return (RIG.ORDER[part] || 0) + (pc ? pc.sortingOrderOffset || 0 : 0); };
    for (const w of [{ limb: wearG.limb, sprite: wearG.sprite }, ...(wearG.extra || [])]) if (w.sprite && frames[w.limb] && !hv.hidden.has(w.limb)) items.push({ wear: w.sprite, order: partOrder(w.limb) + (wearG.drawOffset || 0) * 0.1 + 0.05, m: frames[w.limb], limb: w.limb });
  }
  items.sort((a, b2) => a.order - b2.order);
  // the game's own sprites (from the game template) for anything the rig doesn't replace, drawn on their real pivots
  const tplDraw = (name) => {
    const G = RIG.GAME; if (!G || !G.images[name]) return false;
    const im = G.images[name], sp = G.sprites[name] || {}, pv = sp.pivot || [im.w / 2, im.h / 2];
    ctx.drawImage(layerCanvas(im), -pv[0], -(im.h - pv[1])); return true;
  };
  const setM = (m) => ctx.setTransform(d * m[0], d * m[1], d * m[2], d * m[3], d * m[4], d * m[5]);
  if (animMode && AS.onion && gameMode() && T.ga && clipLen() > 0) { // onion skin: the poses a few frames before (red) and after (green)
    for (const [off, tint] of [[-4, 'rgba(224,71,91,.30)'], [4, 'rgba(76,195,138,.30)']]) {
      const tt = Math.max(0, Math.min(clipLen(), AS.t + off / clipFps()));
      const f2 = RIG.gameFrames(T.ga, T.ga.single(AS.clip, tt), { x: 0, y: 0, facing: 1, accelRot: 0, crouchAmount: 0, grounded: true, tailAngle: b.tailAngle });
      ctx.globalAlpha = 0.35;
      for (const L of RIG.PARTS) { const m0 = f2[L]; if (!m0) continue; const m = RIG.M.mul(RIG.M.mul(S, m0), pix); setM(m);
        const pc = T.rig.chains.find(c => c.hideTarget && c.attachTo === L);
        if (pc) { const sg = pc.segments[0]; const cimg = T.canv[sg.file]; if (cimg) ctx.drawImage(cimg, sg.x - sg.joint.x, sg.y - sg.joint.y); }
        else { const GL = RIG.GAME && (RIG.GAME.tpl.limbs || []).find(x => x.name === L); if (GL) tplDraw(GL.sprite); } }
      ctx.globalAlpha = 1; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.globalCompositeOperation = 'source-over';
      void tint;
    }
  }
  if (gearMode) GS.hits = [];
  for (const it of items) {
    if (it.fx) { // the game's effect sprite, or a plain stand-in when the template is older than the mod's v0.1 template 2
      const G = RIG.GAME, fxName = G && G.tpl.effects && G.tpl.effects[it.fx];
      const L = G && (G.tpl.limbs || []).find(x => x.name === it.part); const sx = it.wrap && L && L.tempScale ? L.tempScale : 1;
      const m = RIG.M.mul(RIG.M.mul(RIG.M.mul(S, it.m), RIG.M.mul(RIG.M.R(it.angle || 0), [sx, 0, 0, 1, 0, 0])), pix); setM(m);
      if (fxName && tplDraw(fxName)) continue;
      ctx.fillStyle = it.fx === 'brokenBone' ? 'rgba(240,235,220,.95)' : it.fx === 'splint' ? '#8a6a3c' : 'rgba(245,245,245,.92)';
      if (it.fx === 'brokenBone') { ctx.fillRect(-3, -0.5, 6, 1); ctx.fillRect(-0.5, -3, 1, 6); } else if (it.fx === 'splint') ctx.fillRect(-1, -6, 2, 12); else ctx.fillRect(-3.5, -2, 7, 4);
      continue;
    }
    if (it.wear) {
      const m = RIG.M.mul(RIG.M.mul(S, it.m), pix); setM(m);
      const gl = doc.layers.find(o => o.role.type === 'gear' && o.role.sprite === it.wear);
      let box;
      if (gl) { const J = RIG.J(doc, it.limb); ctx.drawImage(layerCanvas(gl), gl.x - J.x, gl.y - J.y); box = [gl.x - J.x, gl.y - J.y, gl.w, gl.h]; }
      else { tplDraw(it.wear); const im = RIG.GAME.images[it.wear], sp = RIG.GAME.sprites[it.wear] || {}; if (im) { const pv = sp.pivot || [im.w / 2, im.h / 2]; box = [-pv[0], -(im.h - pv[1]), im.w, im.h]; } }
      if (gearMode && box) { GS.hits.push({ sprite: it.wear, limb: it.limb, m: m.slice(), box });
        if (it.wear === GS.piece) { ctx.save(); ctx.setLineDash([3 * RIG.PPU / z, 3 * RIG.PPU / z]); ctx.lineWidth = 1.5 * RIG.PPU / z; ctx.strokeStyle = '#ffcf4a'; ctx.strokeRect(box[0] - 0.5, box[1] - 0.5, box[2] + 1, box[3] + 1); ctx.restore(); } }
      continue;
    }
    if (it.eyes) {
      const m = RIG.M.mul(RIG.M.mul(S, it.m), pix); setM(m);
      const el = doc.layers.find(o => o.role.type === 'eye' && o.role.state === eyeState) || doc.layers.find(o => o.role.type === 'eye' && o.role.state === 'experimentEyeOpen');
      if (el) { const J = RIG.J(doc, 'Head'); ctx.drawImage(layerCanvas(el), el.x - J.x, el.y - J.y); }
      else if (doc.spriteSwaps[eyeState]) { const im = doc.spriteSwaps[eyeState]; ctx.drawImage(layerCanvas(im), -im.w / 2, -im.h / 2); }
      else if (!tplDraw(eyeState)) tplDraw('experimentEyeOpen');
      continue;
    }
    if (it.ghost) {
      const m = RIG.M.mul(RIG.M.mul(S, it.m), pix); setM(m);
      let sprite = RIG.PART_SPRITE[it.ghost];
      if (it.ghost === 'Head') { const f = (RIG.GAME && RIG.GAME.tpl.face) || {}; sprite = headState && headState.startsWith('experimentHead') ? headState : (f.head || 'experimentHeadBack'); }
      if (RIG.GAME && it.ghost !== 'Head' && it.ghost !== 'tail') { const L = (RIG.GAME.tpl.limbs || []).find(x => x.name === it.ghost); if (L && L.sprite) sprite = L.sprite; }
      if (RIG.GAME && it.ghost === 'tail' && RIG.GAME.tpl.tail) sprite = RIG.GAME.tpl.tail;
      const skin = doc.spriteSwaps[sprite];
      if (skin) { ctx.drawImage(layerCanvas(skin), -skin.w / 2, -skin.h / 2); continue; }
      if (!tplDraw(sprite)) { // no game template: a grey stand-in where the game's part is
        ctx.fillStyle = 'rgba(150,150,160,.35)';
        if (it.ghost === 'tail') ctx.fillRect(-24, -4, 24, 8); else { const sz = RIG.VANILLA_SIZE[it.ghost]; if (sz) ctx.fillRect(-sz[0] / 2, -sz[1] / 2, sz[0], sz[1]); }
      }
      continue;
    }
    const c = T.canv[it.file]; if (!c) continue;
    const m = RIG.M.mul(RIG.M.mul(S, it.m), pix); setM(m);
    ctx.drawImage(c, it.x - it.joint.x, it.y - it.joint.y);
  }
  ctx.setTransform(d, 0, 0, d, 0, 0);
  if (animMode && gameMode()) { // the bones you can pick, and the picked one
    for (const bb of bonesOfClip()) { const m = frames[bb.part]; if (!m) continue; const p = RIG.M.pt(S, { x: m[4], y: m[5] });
      ctx.beginPath(); ctx.arc(p.x, p.y, bb.bone === AS.bone ? 7 : 4, 0, 7); ctx.fillStyle = bb.bone === AS.bone ? '#ffcf4a' : 'rgba(255,207,74,.45)'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke(); }
  }
  ctx.fillStyle = alive ? PAL.text : '#e0475b'; ctx.font = '12px ui-monospace, Consolas, monospace';
  const lab = (RIG.ACTIONS.find(x => x[0] === act) || [act, act])[1];
  if (!gearMode) ctx.fillText('State: ' + lab + (A === 'play' ? '' : '  (demo)') + '   ·   eyes: ' + (RIG.EYE_LABEL[eyeState] || eyeState) + (headState ? '   ·   head: ' + (RIG.HEAD_STATE_LABEL[headState] || headState) : ''), 12, 20);
  if (A === 'play' && !gearMode) {
    ctx.fillStyle = '#6f7280';
    ctx.fillText('A/D move · Shift walk · Space jump (hold = higher; jump off walls) · S crouch · W/S ladder · F attack · T talk · R ragdoll · Z sleep · X dead', 12, H - 12);
  }
}

// ---------------------------------------------------------------- custom sounds
function soundsInspector() {
  doc.sounds = doc.sounds || {};
  const keys = Object.keys(doc.sounds);
  let h = '<div style="margin:4px 0 8px">';
  for (const k of keys) {
    const lab = (RIG.SOUNDS.find(x => x[0] === k) || [k, k])[1];
    h += `<div style="border:1px solid var(--line);border-radius:6px;padding:5px;margin:4px 0"><div class="row" style="margin:0"><b style="flex:1">${esc(lab)}</b><button data-sadd="${k}" title="Add sound files">+ files</button><button data-sdel="${k}">✕</button></div>
      ${doc.sounds[k].map((f, i) => `<div class="seg"><span>${esc(f.file)}</span><button data-splay="${k}:${i}" title="Play">▶</button><button data-sx="${k}:${i}">✕</button></div>`).join('') || '<span class="muted">no files yet</span>'}</div>`;
  }
  const free = RIG.SOUNDS.filter(([k]) => !doc.sounds[k]);
  h += `<div class="row"><select id="sndNew" style="flex:1"><option value="">+ replace a sound…</option>${free.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}<option value="__custom">Other (exact game sound name)…</option></select></div>
    <input id="sndFile" type="file" accept=".wav,.ogg,.mp3" multiple hidden>
    <div class="muted">.wav, .ogg or .mp3. Several files = one is picked at random each time. Only your character's own sounds change, and other players hear them too.</div></div>`;
  return h;
}
function bindSounds() {
  const sel = $('#sndNew'); if (!sel) return;
  let target = null;
  const pick = (k) => { target = k; $('#sndFile').click(); };
  sel.onchange = () => {
    let k = sel.value; if (!k) return;
    if (k === '__custom') { showCustomSound(); return; }
    pick(k);
  };
  $('#sndFile').onchange = async (e) => {
    const fs = [...e.target.files]; e.target.value = ''; if (!fs.length || !target) { renderInspector(); return; }
    const list = doc.sounds[target] = doc.sounds[target] || [];
    for (const f of fs) list.push({ file: f.name, data: new Uint8Array(await f.arrayBuffer()) });
    renderInspector();
  };
  const box = $('#insp');
  box.querySelectorAll('[data-sadd]').forEach(b => b.onclick = () => pick(b.dataset.sadd));
  box.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { delete doc.sounds[b.dataset.sdel]; renderInspector(); });
  box.querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.sx.split(':'); doc.sounds[k].splice(+i, 1); if (!doc.sounds[k].length) delete doc.sounds[k]; renderInspector(); });
  box.querySelectorAll('[data-splay]').forEach(b => b.onclick = () => {
    const [k, i] = b.dataset.splay.split(':'); const f = doc.sounds[k][+i];
    try { const a = new Audio(URL.createObjectURL(new Blob([f.data]))); a.play().catch(() => toast('Your browser blocked playback')); } catch (err) { toast('Can\'t play this file here'); }
  });
}
function showCustomSound() {
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<input id="sndCustom" type="text" placeholder="e.g. growl3 or vomit" style="flex:1"><button id="sndCustomOk">Add</button>`;
  $('#sndNew').parentElement.after(row);
  $('#sndCustomOk').onclick = () => { const v = $('#sndCustom').value.trim(); if (!v) return; doc.sounds[v] = doc.sounds[v] || []; renderInspector(); };
}

// ---------------------------------------------------------------- animated sprites
let animFocus = false;
function frameCandidates(l) { // layers that can become frames: unused ones or frames of this layer
  return doc.layers.filter(o => o.id !== l.id && (o.role.type === 'ignore' || (o.role.type === 'frame' && o.role.of === l.id)));
}
function animInspector(l) {
  const sets = doc.anims[l.id] || {};
  const keys = Object.keys(sets);
  const used = new Set(keys);
  let h = `<h2>Animated sprite</h2><div class="sec">
    <div class="row"><label>Animated</label><input id="animOn" type="checkbox" ${keys.length ? 'checked' : ''}><span class="muted">frames per action or injury</span></div>
    <div class="row"><label>Animated loop</label><button id="loopGif" title="Turn a GIF / animated WebP, or several PNG frames (full transparency), into a looping animation for this part">Import GIF / WebP / PNG frames…</button></div>`;
  if (keys.length) {
    h += `<div class="muted" style="margin-bottom:6px">Draw each frame as its own layer on the same canvas spot. If the character does something this part has no set for, it uses a close one (falling → jumping → idle → always).</div>`;
    for (const k of keys) {
      const st = sets[k];
      h += `<div style="border:1px solid var(--line);border-radius:6px;padding:6px;margin:6px 0">
        <div class="row"><select data-akey="${k}" style="flex:1">${RIG.ANIM_KEYS.map(([kk, lab]) => `<option value="${kk}" ${kk === k ? 'selected' : ''} ${kk !== k && used.has(kk) ? 'disabled' : ''}>${lab}</option>`).join('')}</select><button data-adel="${k}" title="Remove this set">✕</button></div>
        <div class="row"><button data-asnap="${k}" title="Put every frame of this set exactly on the part (keeps the movement between frames)">⤓ Snap frames onto the part</button></div>
        <div class="row"><button data-aprev="${k}" title="Play these frames here on the canvas (the frame before shows faintly)">${animPrev && animPrev.id === l.id && animPrev.key === k ? '■ Stop' : '▶ Preview'}</button></div>
        <div class="row"><label>Frames / sec</label><input data-afps="${k}" type="number" min="0.5" max="60" step="0.5" value="${st.fps}" style="width:64px"><label style="flex:0 0 auto;margin-left:8px">Loop</label><input data-aloop="${k}" type="checkbox" ${st.loop !== false ? 'checked' : ''}></div>
        ${st.frames.map((id, i) => { const fl = RIG.layer(doc, id); return `<div class="seg"><span>${i + 1}. ${esc(fl ? fl.name : '?')}${id === l.id ? ' <span class="muted">(the part itself)</span>' : ''}</span><button data-afu="${k}:${i}">↑</button><button data-afd="${k}:${i}">↓</button><button data-afx="${k}:${i}">✕</button></div>`; }).join('')}
        <div class="row"><select data-aadd="${k}" style="flex:1"><option value="">+ add a frame…</option><option value="${l.id}">${esc(l.name)} (the part itself)</option>${frameCandidates(l).filter(o => !st.frames.includes(o.id)).map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>
        <div class="muted">${st.frames.length} frame${st.frames.length === 1 ? '' : 's'}${st.loop === false ? ', plays once then holds the last frame' : ''}</div>
      </div>`;
    }
    h += `<div class="row"><button id="animAdd">+ Add a set for another action</button></div>`;
  }
  h += `<div class="muted">Tip: name layers like <code>${esc(l.name)}_fall_1</code>, <code>${esc(l.name)}_fall_2</code>, <code>${esc(l.name)}_idle_1</code> or <code>${esc(l.name)}_frame_1</code> and <b>Auto setup</b> builds the sets for you.</div></div>`;
  return h;
}
// frames that drifted away from their part: line the first one up with the part (same size: exactly on it; else centred,
// bottoms lined up) and move the rest by the same amount, so the movement inside the animation is kept
function snapFrames(l, frames) {
  if (!frames.length) return; const f0 = frames[0];
  const dx = Math.abs(f0.w - l.w) <= 1 && Math.abs(f0.h - l.h) <= 1 ? l.x - f0.x : Math.round(l.x + l.w / 2 - (f0.x + f0.w / 2));
  const dy = Math.abs(f0.w - l.w) <= 1 && Math.abs(f0.h - l.h) <= 1 ? l.y - f0.y : (l.y + l.h) - (f0.y + f0.h);
  for (const f of frames) { f.x += dx; f.y += dy; }
}
// ---- quick loops: frames made for you, played all the time ("always"), in game too (other players see them)
function addLoopFrames(l, frames, fps, tag) { // frames: [{w,h,rgba}] the size of the part, or the canvas, or any size (centred on the part)
  pushUndo();
  for (const o of doc.layers.filter(o => o.role.type === 'frame' && o.role.of === l.id && (o.loopTag === tag || (doc.anims[l.id] && doc.anims[l.id].always && doc.anims[l.id].always.frames.includes(o.id))))) RIG.removeLayers(doc, [o.id]);
  const ids = []; const at = doc.layers.indexOf(l);
  frames.forEach((f, i) => {
    let x, y, w = f.w, h = f.h, rgba = f.rgba;
    const src = doc.srcSize, org = doc.origin || { x: 0, y: 0 };
    if ((src && w === src.w && h === src.h) || (w === doc.width && h === doc.height)) { // a whole-canvas frame (exported from the same PSD): keep its spot
      const c = RIG.crop(rgba, w, h); if (!c) return; const sameAsSrc = src && w === src.w && h === src.h;
      ({ x, y, w, h, rgba } = c); if (sameAsSrc) { x += org.x; y += org.y; } }
    else { x = Math.round(l.x + l.w / 2 - w / 2); y = Math.round(l.y + l.h / 2 - h / 2); }
    const fl = { id: RIG.newId(), name: l.name + '_always_' + (i + 1), x, y, w, h, rgba, hidden: false, order: 0, role: { type: 'frame', of: l.id }, loopTag: tag };
    doc.layers.splice(at + 1 + i, 0, fl); ids.push(fl.id);
  });
  doc.layers.forEach((o, i) => o.order = i);
  // wherever the GIF was drawn, the frames go on the part as it is now (you may have moved it since)
  const made = ids.map(id => RIG.layer(doc, id)).filter(Boolean);
  if (made.length && !(made[0].x < l.x + l.w && made[0].x + made[0].w > l.x && made[0].y < l.y + l.h && made[0].y + made[0].h > l.y && Math.abs(made[0].x - l.x) <= 2 && Math.abs(made[0].y - l.y) <= 2)) snapFrames(l, made);
  // the frames go in their own folder (closed), so the layer list stays short
  doc.folders = (doc.folders || []).filter(f => !(f.name === l.name + ' animation' && !doc.layers.some(o => o.folder === f.id))); // the old frames' folder
  if (ids.length) { const f = newFolderFrom(ids.map(id => RIG.layer(doc, id)), l.name + ' animation'); f.open = false; }
  doc.anims[l.id] = doc.anims[l.id] || {}; doc.anims[l.id].always = { fps, loop: true, frames: ids };
  imgCache.clear(); refresh(); startTestIfOpen();
  toast(ids.length + ' frames added in the folder "' + l.name + ' animation", looping at ' + fps + ' fps all the time. ▶ Preview it here or in the Test tab. (Ctrl+Z to undo)', 7000);
}
// ▶ Preview: a part's frames play on the Rig canvas, with the frame before drawn faintly (onion skin)
let animPrev = null, animPrevTimer = 0;
function startAnimPrev(id, key) { stopAnimPrev(); animPrev = { id, key, t0: performance.now() }; animPrevTimer = setInterval(() => { if (tab !== 'rig' || !doc || !doc.anims[animPrev.id] || !doc.anims[animPrev.id][animPrev.key]) { stopAnimPrev(); return; } draw(); }, 40); draw(); }
function stopAnimPrev() { if (animPrevTimer) clearInterval(animPrevTimer); animPrevTimer = 0; animPrev = null; if (doc) draw(); }
function animPrevFrames() { // [current frame layer, previous frame layer] or null
  if (!animPrev || !doc) return null; const set = doc.anims[animPrev.id] && doc.anims[animPrev.id][animPrev.key]; if (!set || !set.frames.length) return null;
  const n = set.frames.length, i = Math.floor((performance.now() - animPrev.t0) / 1000 * Math.max(0.5, set.fps || 8));
  const k = set.loop === false ? Math.min(i, n - 1) : i % n;
  return [RIG.layer(doc, set.frames[k]), n > 1 ? RIG.layer(doc, set.frames[(k - 1 + n) % n]) : null];
}
async function gifLoop(l) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.gif,.png,.webp,image/gif,image/png'; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files]; if (!files.length) return;
    try {
      const gif = files.find(f => /\.(gif|webp)$/i.test(f.name));
      if (gif) {
        if (!('ImageDecoder' in window)) { toast('Your browser can\'t read GIF frames. Use Chrome or Edge, or export the GIF as PNG frames and pick those.', 8000); return; }
        const dec = new ImageDecoder({ data: await gif.arrayBuffer(), type: gif.type || 'image/gif' }); await dec.tracks.ready;
        const n = dec.tracks.selectedTrack.frameCount; const frames = []; let dur = 0;
        for (let i = 0; i < n; i++) {
          const { image } = await dec.decode({ frameIndex: i }); const w = image.displayWidth, h = image.displayHeight;
          const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(image, 0, 0);
          frames.push({ w, h, rgba: x.getImageData(0, 0, w, h).data }); dur += (image.duration || 100000); image.close();
        }
        const fps = Math.max(1, Math.min(60, Math.round(n / (dur / 1e6) * 2) / 2 || 10));
        addLoopFrames(l, frames, fps, 'gif');
      } else {
        const pngs = files.filter(f => /\.png$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const frames = []; for (const f of pngs) { const d = await decodePng(f); frames.push({ w: d.w, h: d.h, rgba: d.rgba }); }
        const fps = Math.max(1, Math.min(60, parseFloat(prompt(frames.length + ' frames. Frames per second?', '12')) || 12));
        addLoopFrames(l, frames, fps, 'gif');
      }
    } catch (e) { console.error(e); toast('Couldn\'t read that: ' + e.message, 6000); }
  };
  inp.click();
}
function bindAnimInspector(l) {
  const sets = () => (doc.anims[l.id] = doc.anims[l.id] || {});
  const lg = $('#loopGif'); if (lg) lg.onclick = () => gifLoop(l);
  document.querySelectorAll('[data-asnap]').forEach(b => b.onclick = () => { const set = doc.anims[l.id] && doc.anims[l.id][b.dataset.asnap]; if (!set) return; pushUndo(); snapFrames(l, set.frames.map(id => RIG.layer(doc, id)).filter(o => o && o !== l)); draw(); toast('Frames put on ' + l.name + '. Ctrl+Z to undo.'); });
    document.querySelectorAll('[data-aprev]').forEach(b => b.onclick = () => { const k = b.dataset.aprev; if (animPrev && animPrev.id === l.id && animPrev.key === k) stopAnimPrev(); else startAnimPrev(l.id, k); renderInspector(); });
  const on = $('#animOn'); if (!on) return;
  const markFrame = (id) => { const fl = RIG.layer(doc, id); if (fl && fl.id !== l.id && fl.role.type === 'ignore') fl.role = { type: 'frame', of: l.id }; };
  const unmark = (id) => { const still = Object.values(sets()).some(st => st.frames.includes(id)); const fl = RIG.layer(doc, id); if (!still && fl && fl.id !== l.id && fl.role.type === 'frame') fl.role = { type: 'ignore' }; };
  on.onchange = () => {
    if (on.checked) { sets().always = { fps: 8, loop: true, frames: [l.id] }; }
    else { const ids = Object.values(sets()).flatMap(st => st.frames); delete doc.anims[l.id]; ids.forEach(unmark); }
    refresh(); startTestIfOpen();
  };
  const box = $('#insp');
  box.querySelectorAll('[data-akey]').forEach(sel => sel.onchange = () => { const s0 = sets(); const old = sel.dataset.akey; s0[sel.value] = s0[old]; delete s0[old]; refresh(); startTestIfOpen(); });
  box.querySelectorAll('[data-adel]').forEach(b => b.onclick = () => { const s0 = sets(); const ids = s0[b.dataset.adel].frames; delete s0[b.dataset.adel]; ids.forEach(unmark); if (!Object.keys(s0).length) delete doc.anims[l.id]; refresh(); startTestIfOpen(); });
  box.querySelectorAll('[data-afps]').forEach(i => i.oninput = () => { sets()[i.dataset.afps].fps = +i.value || 8; startTestIfOpen(); });
  box.querySelectorAll('[data-aloop]').forEach(i => i.onchange = () => { sets()[i.dataset.aloop].loop = i.checked; refresh(); startTestIfOpen(); });
  const mv = (attr, d) => box.querySelectorAll('[' + attr + ']').forEach(b => b.onclick = () => {
    const [k, i] = b.getAttribute(attr).split(':'); const fr = sets()[k].frames; const j = +i + d;
    if (d === 0) { const id = fr.splice(+i, 1)[0]; unmark(id); } else if (j >= 0 && j < fr.length) [fr[i], fr[j]] = [fr[j], fr[i]];
    refresh(); startTestIfOpen();
  });
  mv('data-afu', -1); mv('data-afd', 1); mv('data-afx', 0);
  box.querySelectorAll('[data-aadd]').forEach(sel => sel.onchange = () => { if (!sel.value) return; sets()[sel.dataset.aadd].frames.push(sel.value); markFrame(sel.value); refresh(); startTestIfOpen(); });
  const add = $('#animAdd'); if (add) add.onclick = () => {
    const s0 = sets(); const free = RIG.ANIM_KEYS.map(k => k[0]).find(k => !s0[k]); if (!free) return;
    s0[free] = { fps: 8, loop: true, frames: [l.id] }; refresh(); startTestIfOpen();
  };
}

// ---------------------------------------------------------------- health screen
let selHs = null, hsDrag = null;
// the game's own health screen art comes from the game template (written by the mod from the player's game)
const hsArt = (name) => (RIG.GAME && RIG.GAME.images[name]) ? layerCanvas(RIG.GAME.images[name]) : null;
// every item on the health screen: the game's 15 parts + one per injurable piece (same default spots as the mod)
function hsItems() {
  if (!doc) return [];
  const ths = RIG.GAME && RIG.GAME.tpl.healthScreen || {};
  const items = RIG.HS_LAYOUT.map(L0 => {
    const t = ths[L0.part]; // the player's own game wins over the built-in numbers
    const L = t && t.outline ? Object.assign({}, L0, { outline: t.outline, middle: t.middle || L0.middle, x: t.x, y: t.y, w: t.w || L0.w, h: t.h || L0.h, mirror: !!t.mirror }) : L0;
    const c = doc.healthScreen[L.part];
    const hasArt = c && c.outline;
    return { key: L.part, label: RIG.PART_LABEL[L.part], x: c && c.x !== undefined ? c.x : L.x, y: c && c.y !== undefined ? c.y : L.y,
      w: hasArt ? c.outline.w * (c.scale || 3) : L.w, h: hasArt ? c.outline.h * (c.scale || 3) : L.h,
      mirror: c ? !!c.mirror && (hasArt || true) : L.mirror, rot: c ? (c.rotation || 0) : 0,
      outline: hasArt ? c.outline : null, middle: c && c.middle ? c.middle : null, vOutline: L.outline, vMiddle: L.middle, custom: !!c, vanillaMirror: L.mirror };
  });
  let ci = 0;
  for (const ch of doc.chains) {
    if (!ch.injury || !ch.injury.enabled) continue;
    const nG = RIG.groupCount(ch); let gi = 0;
    ch.segs.forEach((sg, k) => {
      if (!RIG.isGroupLeader(ch, k)) return;
      const key = 'seg:' + sg.layer, c = doc.healthScreen[key], hasArt = c && c.outline; const n = gi++;
      items.push({ key, label: (ch.injury.name || ch.name) + (nG > 1 ? ' ' + (n + 1) : ''), extra: true,
        x: c && c.x !== undefined ? c.x : -150 - ci * 58, y: c && c.y !== undefined ? c.y : 20 - n * 62, injKey: 'c:' + ch.name + ':' + RIG.groupsOf(ch)[k], chainName: ch.name, firstK: k,
        w: hasArt ? c.outline.w * (c.scale || 3) : (c ? 72 : 54), h: hasArt ? c.outline.h * (c.scale || 3) : (c ? 75 : 56),
        mirror: c ? !!c.mirror : false, rot: c ? (c.rotation || 0) : 0, outline: hasArt ? c.outline : null, middle: c && c.middle ? c.middle : null,
        vOutline: 'crusOutline', vMiddle: 'crusMiddle', custom: !!c });
    });
    ci++;
  }
  return items;
}
function hsView(W, H) { const z = Math.min(W, H) / 780; return { z, cx: W / 2, cy: H / 2 }; }
// tinting like Unity UI (sprite colour x image colour)
const tintCache = new Map();
function tinted(src, r, g, b) {
  if (!src) return null; const key = src; let per = tintCache.get(key); if (!per) { per = new Map(); tintCache.set(key, per); }
  const k = (r * 255 | 0) + ',' + (g * 255 | 0) + ',' + (b * 255 | 0); if (per.has(k)) return per.get(k);
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${Math.max(0, r) * 255 | 0},${Math.max(0, g) * 255 | 0},${Math.max(0, b) * 255 | 0})`; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0); per.set(k, c); if (per.size > 40) per.delete(per.keys().next().value); return c;
}
// what a limb would look like on the health screen with the injury tester's injuries (WoundView.UpdateView)
function hsLook(states) {
  let skin = 100, muscle = 100; const icons = [];
  if (states.includes('scratched')) skin = 60; if (states.includes('wounded')) skin = 30; if (states.includes('broken')) skin = Math.min(skin, 67);
  if (states.includes('mangled')) muscle = 25;
  if (states.includes('bleeding')) icons.push([states.includes('bandaged') ? 12 : 7, [0.85, 0.1, 0.1]]);
  if (states.includes('infected')) icons.push([10, [0.85, 0.5, 0.9]]);
  if (states.includes('broken')) icons.push([2, [1, 0, 0]]);
  if (states.includes('dislocated')) icons.push([1, [1, 0, 0]]);
  if (states.includes('disinfected')) icons.push([4, [0.65, 0.65, 0.65]]);
  if (states.includes('shrapnel')) icons.push([5, [0.68, 0.42, 0.21]]);
  if (states.includes('frostbite')) icons.push([6, [0.21, 0.54, 1]]);
  return { skin, muscle, icons, tourniquet: states.includes('tourniquet') };
}
function drawHealth(W, H) {
  ctx.fillStyle = CV().bg; ctx.fillRect(0, 0, W, H);
  if (!doc) return;
  const v = hsView(W, H);
  ctx.strokeStyle = '#2a2c34'; ctx.strokeRect(v.cx - 342 * v.z, v.cy - 342 * v.z, 684 * v.z, 684 * v.z);
  ctx.imageSmoothingEnabled = false;
  const hv = RIG.hurtView(testInj); const G = RIG.GAME;
  const tornChain = {}; // pieces at / after a torn one are gone
  for (const k in testInj) if (testInj[k].torn && k.startsWith('c:')) { const [, nm, g] = k.split(':'); const ch = doc.chains.find(c => c.name === nm); if (ch) { const k0 = RIG.groupsOf(ch).indexOf(+g); if (k0 >= 0) tornChain[nm] = Math.min(tornChain[nm] === undefined ? 1e9 : tornChain[nm], k0); } }
  const noArt = !hsItems().some(it => it.outline || hsArt(it.vOutline));
  for (const it of hsItems()) {
    if (!it.extra && hv.hidden.has(it.key)) continue;
    if (it.extra && tornChain[it.chainName] !== undefined && it.firstK >= tornChain[it.chainName]) continue;
    const look = hsLook(it.extra ? RIG.statesOf(testInj, it.injKey) : RIG.statesOf(testInj, it.key));
    ctx.save(); ctx.translate(v.cx + it.x * v.z, v.cy - it.y * v.z); ctx.rotate(-it.rot * Math.PI / 180); ctx.scale(it.mirror ? -1 : 1, 1);
    const w = it.w * v.z, h = it.h * v.z;
    const mid = it.middle ? layerCanvas(it.middle) : (it.outline ? null : hsArt(it.vMiddle));
    const out = it.outline ? layerCanvas(it.outline) : hsArt(it.vOutline);
    if (!mid && !out) { // no game template art: a plain shape where the part goes
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.strokeStyle = `rgb(255,${look.skin * 2.55 | 0},${look.skin * 2.55 | 0})`; ctx.lineWidth = 2;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.3); else ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
    }
    // the game: the outline image tinted (1, skin, skin), its child "middle" image on top tinted (1 - muscle, 0, 0)
    if (out) ctx.drawImage(tinted(out, 1, look.skin / 100, look.skin / 100), -w / 2, -h / 2, w, h);
    if (mid) ctx.drawImage(tinted(mid, 1 - look.muscle / 100, 0, 0), -w / 2, -h / 2, w, h);
    if (look.tourniquet && G && G.tpl.effects && G.tpl.effects.tourniquetIcon && G.images[G.tpl.effects.tourniquetIcon]) { const im = G.images[G.tpl.effects.tourniquetIcon], sp = G.sprites[G.tpl.effects.tourniquetIcon] || {}; const s = 100 / (sp.ppu || 100) * v.z; ctx.drawImage(layerCanvas(im), -im.w * s / 2, -im.h * s / 2, im.w * s, im.h * s); }
    ctx.restore();
    // status icons over the part, like WoundView (bleeding, infection, broken bone…)
    const ic = G && G.tpl.hsIcons;
    look.icons.forEach(([idx, col], m) => {
      const off = (m * 50 - (look.icons.length - 1) * 25) * 0.6 * v.z; const px = v.cx + it.x * v.z + off, py = v.cy - it.y * v.z - off * 0.2;
      const nm = ic && ic[idx], im = nm && G.images[nm];
      if (im) { const sp = G.sprites[nm] || {}; const s = 100 / (sp.ppu || 100) * v.z; ctx.drawImage(tinted(layerCanvas(im), col[0], col[1], col[2]), px - im.w * s / 2, py - im.h * s / 2, im.w * s, im.h * s); }
      else { ctx.fillStyle = `rgb(${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0})`; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill(); }
    });
    if (it.extra || it.key === selHs) {
      ctx.strokeStyle = it.key === selHs ? '#8f5bff' : 'rgba(255,207,74,.6)'; ctx.lineWidth = it.key === selHs ? 2 : 1;
      ctx.strokeRect(v.cx + it.x * v.z - w / 2 - 2, v.cy - it.y * v.z - h / 2 - 2, w + 4, h + 4);
      ctx.fillStyle = '#ffcf4a'; ctx.font = '11px system-ui'; if (it.extra) ctx.fillText(it.label, v.cx + it.x * v.z - w / 2, v.cy - it.y * v.z - h / 2 - 5);
    }
  }
  ctx.font = '12px ui-monospace, Consolas, monospace'; ctx.fillStyle = '#8a8f98';
  const nHurt = Object.keys(testInj).length;
  if (noArt) ctx.fillText('No health screen art in your game template: press F10 in game (with the mod updated) and load the template again.', 12, H - 14);
  else ctx.fillText(nHurt ? 'Showing the injuries from the Test tab’s injury tester.' : 'Healthy. Hurt parts in Test → Injury tester to see them here.', 12, H - 14);
}
function hsAt(sx, sy) {
  const d = window.devicePixelRatio || 1, v = hsView(cv.width / d, cv.height / d);
  const items = hsItems();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]; const x = v.cx + it.x * v.z, y = v.cy - it.y * v.z;
    if (Math.abs(sx - x) <= it.w * v.z / 2 && Math.abs(sy - y) <= it.h * v.z / 2) return { it, v };
  }
  return null;
}
function hsEntry(key) { return doc.healthScreen[key] = doc.healthScreen[key] || { scale: 3 }; }
function hsInspector() {
  const it = hsItems().find(i => i.key === selHs);
  if (!it) return `<h2>Health screen</h2><div class="sec muted">Click a part to give it your own art or move it. Injurable pieces (tail, wings…) show up here once you tick <i>Can be injured</i> on them.<br><br>To see how hurt parts look here, injure them in <b>Test → Injury tester</b>.<br><br>Tip: press <b>F9</b> in game to save the game's own health screen art, repaint it, and load it with <b>Add sprites…</b> (files named <code>health_Head_outline.png</code> etc. are placed automatically).</div>`;
  const c = doc.healthScreen[it.key] || {};
  return `<h2>Health screen: ${esc(it.label)}</h2><div class="sec">
    <div class="row"><label>Outline image</label><button id="hsOut">${c.outline ? 'Replace…' : 'Load…'}</button>${c.outline ? `<span class="pill">${c.outline.w}×${c.outline.h}</span>` : '<span class="muted">game art</span>'}</div>
    <div class="row"><label>Middle image</label><button id="hsMid">${c.middle ? 'Replace…' : 'Load…'}</button>${c.middle ? `<span class="pill">${c.middle.w}×${c.middle.h}</span>` : '<span class="muted">same as outline</span>'}</div>
    <div class="muted">The outline is tinted by skin health, the middle by muscle health and infection, just like the game's parts. Draw both the same size.</div>
    <div class="row"><label>Pixel scale</label><input id="hsScale" type="number" min="1" max="8" step="0.5" value="${c.scale || 3}" style="width:70px"><span class="muted">the game uses 3</span></div>
    <div class="row"><label>Rotation°</label><input id="hsRot" type="number" step="5" value="${c.rotation || 0}" style="width:70px"></div>
    <div class="row"><label>Mirror</label><input id="hsMir" type="checkbox" ${it.mirror ? 'checked' : ''}></div>
    <div class="row"><label>Position</label><span class="muted">${Math.round(it.x)}, ${Math.round(it.y)} — drag it on the canvas</span></div>
    <div class="row"><button id="hsReset">Reset to default</button></div>
    <input id="hsFile" type="file" accept=".png" hidden>
  </div>`;
}
function bindHsInspector() {
  const it = hsItems().find(i => i.key === selHs); if (!it) return;
  let slot = null;
  $('#hsOut').onclick = () => { slot = 'outline'; $('#hsFile').click(); };
  $('#hsMid').onclick = () => { slot = 'middle'; $('#hsFile').click(); };
  $('#hsFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const e2 = hsEntry(it.key);
    if (e2.x === undefined) { e2.x = it.x; e2.y = it.y; e2.mirror = it.mirror; }
    e2[slot] = await decodePng(f); renderInspector(); draw();
  };
  $('#hsScale').oninput = (e) => { hsEntry(it.key).scale = +e.target.value || 3; draw(); };
  $('#hsRot').oninput = (e) => { hsEntry(it.key).rotation = +e.target.value || 0; draw(); };
  $('#hsMir').onchange = (e) => { const e2 = hsEntry(it.key); e2.mirror = e.target.checked; if (e2.x === undefined) { e2.x = it.x; e2.y = it.y; } draw(); };
  $('#hsReset').onclick = () => { delete doc.healthScreen[it.key]; renderInspector(); draw(); };
}

// ---------------------------------------------------------------- export
async function pngBytes(img) {
  const c = layerCanvas(img);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
$('#btnExport').onclick = async () => {
  if (!doc) { toast('Open a character first'); return; }
  const { rig, files } = RIG.buildRig(doc);
  if (!rig.chains.length && !rig.spriteSwaps) { toast('Nothing to export yet: give some layers a role first.'); return; }
  const folder = (doc.name || 'MyCharacter').replace(/[^A-Za-z0-9_\-]+/g, '_');
  const entries = [{ name: folder + '/rig.json', data: new TextEncoder().encode(JSON.stringify(rig, null, 2)) }];
  for (const f in files) entries.push({ name: folder + '/' + f, data: files[f].raw ? files[f].raw : await pngBytes(files[f]) });
  const zip = RIG.zip(entries);
  const fname = folder + '.zip';
  let saved = false;
  try {
    if (window.claude && window.claude.use) {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename: fname, data: new Blob([zip]) }); saved = true; toast('Saved ' + fname + ' — unzip it into BepInEx\\plugins\\AdvancedRigs\\Rigs\\', 6000); }
    }
  } catch (e) { if (e && e.code === 'declined') { toast('Export cancelled'); return; } }
  if (!saved) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' })); a.download = fname;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast('Exported ' + fname + ' — unzip it into BepInEx\\plugins\\AdvancedRigs\\Rigs\\', 6000);
  }
};

$('#actPrev').innerHTML = '<option value="play">🎮 Play it (keyboard)</option>' + RIG.ACTIONS.filter(([k]) => k !== 'always').map(([k, lab]) => `<option value="${k}">Demo: ${lab}</option>`).join('');
$('#eyePrev').innerHTML = '<option value="">Eyes: automatic</option>' + RIG.EYE_STATES.map(([k, lab]) => `<option value="${k}">Eyes: ${lab}</option>`).join('');

// ---------------------------------------------------------------- start
resize(); renderInspector(); hint('Open your character to begin. New here? Click <b>How to</b>. <span style="opacity:.7">Fan-made, not affiliated with Casualties: Unknown. The Test tab is a simulation based on Orson\'s game code.</span>');
window.__rigEditor = { get view() { return view; }, addLoopFrames, exportLayersFor, undo, redo, updateFromPsd, loadGameTemplateFiles, newFromGame, setDoc, saveProject, loadProject, openFiles, addSprites, refresh, get doc() { return doc; }, tabTo, startTest, get test() { return test; }, selectHs: (k) => { selHs = k; renderInspector(); draw(); } };
})();
