// ================================================================ Luna Props pack editor (the "Props" button)
// Makes prop packs for the Luna Props mod: PNG props with a pivot, seats, solid / front-back, animation frames,
// and custom screens (pages of text, images, boxes and buttons with actions). Exports a pack zip for BepInEx\plugins\LunaProps\Props.
(function () {
  const PX = 8; // the game's pixels per block
  // game items that make good bases for custom items (any game item id works; the console's "spawn" lists them all)
  const BASES = [['sodacan', 'drink: soda can'], ['sodabottle', 'drink: soda bottle'], ['energydrink', 'drink: energy drink'], ['waterbottle', 'drink: water bottle'],
    ['chocolatemilk', 'drink: chocolate milk'], ['chips', 'food: chips'], ['candybar', 'food: candy bar'], ['chocolatebar', 'food: chocolate bar'],
    ['nutrientbar', 'food: nutrient bar'], ['plushie', 'toy: plushie'], ['bandage', 'medical: bandage']];
  const ACTIONS = [
    ['page', 'Go to page', 'page name'], ['close', 'Close the screen', ''], ['drop', 'Drop an item out of the prop', 'custom item or game item id, e.g. sodacan'],
    ['spawn', 'Give an item (into your hands)', 'custom item or game item id, e.g. sodacan'],
    ['command', 'Run a console command', 'e.g. heal'], ['say', 'Character says', 'text'], ['alert', 'Show a message', 'text'],
    ['sound', 'Play a sound', 'pack sound or game sound name'], ['sit', 'Sit on this prop', '']];
  const css = `
#propsEd{position:fixed;inset:0;z-index:50;background:var(--bg);display:none;grid-template-columns:250px 1fr 300px;grid-template-rows:auto 1fr;font:13px/1.4 system-ui,"Segoe UI",sans-serif}
#propsEd.show{display:grid}
#propsEd .pbar{grid-column:1/4;display:flex;gap:6px;align-items:center;padding:8px 10px;background:var(--panel);border-bottom:1px solid var(--line)}
#propsEd .pbar h2{margin:0 10px 0 0;font-size:14px}#propsEd .pbar h2 span{color:var(--acc)}
#propsEd .pcol{overflow:auto;padding:8px 10px;background:var(--panel);border-right:1px solid var(--line)}
#propsEd .pins{overflow:auto;padding:8px 12px;background:var(--panel);border-left:1px solid var(--line)}
#propsEd .pmain{position:relative;overflow:hidden}#propsEd canvas{display:block;width:100%;height:100%}
#propsEd h3{font-size:11px;letter-spacing:.06em;color:var(--acc);margin:12px 0 4px;text-transform:uppercase}
#propsEd .item{display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid transparent;border-radius:4px;cursor:pointer}
#propsEd .item:hover{background:var(--panel2)}#propsEd .item.sel{border-color:var(--acc2);background:#2b2236}
#propsEd .item img{width:28px;height:28px;object-fit:contain;image-rendering:pixelated;background:#0003}
#propsEd .row{display:flex;gap:6px;align-items:center;margin:4px 0}#propsEd .row label{width:96px;color:var(--dim);flex:none}
#propsEd input[type=text],#propsEd input[type=number],#propsEd select,#propsEd textarea{background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:3px;padding:3px 5px;min-width:0;flex:1}
#propsEd textarea{min-height:44px;font:inherit}
#propsEd .muted{color:var(--dim);font-size:12px}#propsEd .act{display:flex;gap:4px;margin:3px 0}#propsEd .act select{flex:0 0 120px}
#propsEd .phint{position:absolute;left:10px;bottom:8px;color:var(--dim);font-size:12px;pointer-events:none;max-width:90%}
#propsEd .pagebar{position:absolute;left:10px;top:8px;display:flex;gap:4px;align-items:center}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'propsEd';
  root.innerHTML = `
<div class="pbar"><h2>LUNA <span>PROPS</span></h2><span class="muted" style="margin-right:8px">Packs for the <b>Luna Props</b> mod (furniture &amp; set dressing): needs <code>BepInEx\\plugins\\LunaProps</code> in game</span>
  <button id="pNew" title="Start a new, empty pack">New pack</button>
  <button id="pImport" title="Open a pack: its .zip, or its props.json together with its PNG / WAV files">Open pack…</button>
  <span style="flex:1"></span>
  <button id="pHelp">How to</button>
  <button id="pExport" class="primary" title="Its own export, separate from Export rig: a zip for BepInEx\\plugins\\LunaProps\\Props">Export props pack (.zip)</button>
  <button id="pClose" title="Back to the rig editor">✕ Close</button></div>
<div class="pcol" id="pLeft"></div>
<div class="pmain"><canvas id="pCv"></canvas><div class="pagebar" id="pPages"></div><div class="phint" id="pHint"></div></div>
<div class="pins" id="pRight"></div>
<input type="file" id="pFile" hidden><input type="file" id="pImportFile" multiple accept=".zip,.json,.png,.wav" hidden>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const cv = q('#pCv'), ctx = cv.getContext('2d');
  const E = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const safe = (s) => (String(s || 'x').trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, '_') || 'x');
  const say = (m, ms) => (typeof toast === 'function' ? toast(m, ms) : alert(m));

  // ---------------------------------------------------------------- the pack being edited
  let pack = null, sel = null, mode = 'prop', selEl = null, curPage = 'main', preview = false, drag = null, view = null;
  // animation preview: plays the prop's frames at its fps (paused = shows animFrame)
  let animPlay = true, animFrame = 0, animT0 = performance.now();
  const newPack = () => ({ id: 'mypack', name: 'My Props', author: '', props: [], uis: {}, sounds: {}, items: [] });
  const newItem = (img, name) => ({ id: safe(name || 'item'), name: name || 'Item', base: 'sodacan', description: '', image: img || null });
  const newProp = (img, name) => ({ id: safe(name || 'prop'), name: name || 'Prop', description: '', frames: img ? [img] : [], fps: 6, ppu: PX,
    pivot: { x: 0.5, y: 0 }, scale: 1, layer: 'back', order: 0, solid: false, seats: [], interact: { type: 'none', ui: '', text: '', actions: [] } });
  const newUi = (id) => ({ id, title: id.toUpperCase(), width: 260, height: 240, background: '#1d1f25', backgroundImage: null, titleBar: true, start: 'main',
    pages: { main: [{ type: 'text', x: 10, y: 12, w: 240, h: 30, text: 'Hello!', size: 16, color: '#e6e6ea', align: 'center', bold: true },
      { type: 'button', x: 50, y: 170, w: 160, h: 40, text: 'Close', fill: '#e0475b', color: '#ffffff', size: 14, align: 'center', actions: [{ type: 'close', value: '' }] }] } });

  // images: {w,h,rgba,name}; canvases cached
  const cache = new WeakMap();
  const canv = (img) => { if (!img) return null; let c = cache.get(img); if (!c) { c = document.createElement('canvas'); c.width = img.w; c.height = img.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.rgba), img.w, img.h), 0, 0); cache.set(img, c); } return c; };
  const dataUrl = (img) => { const c = canv(img); return c ? c.toDataURL() : ''; };
  async function readImg(file) {
    const bmp = await createImageBitmap(file); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return { w: c.width, h: c.height, rgba: g.getImageData(0, 0, c.width, c.height).data, name: file.name };
  }
  const pickFile = (accept, multiple) => new Promise(res => { const f = q('#pFile'); f.accept = accept; f.multiple = !!multiple; f.value = ''; f.onchange = () => res([...f.files]); f.click(); });

  // ---------------------------------------------------------------- left column
  function renderLeft() {
    if (!pack) { q('#pLeft').innerHTML = '<p class="muted">Start a <b>New pack</b>, or <b>Open pack…</b></p><p class="muted">These packs are for the <b>Luna Props</b> mod, not for rigs.</p>'; return; }
    let h = `<h3>Pack</h3>
      <div class="row"><label>Name</label><input type="text" id="pkName" value="${E(pack.name)}"></div>
      <div class="row"><label>Folder id</label><input type="text" id="pkId" value="${E(pack.id)}"></div>
      <div class="row"><label>Made by</label><input type="text" id="pkAuthor" value="${E(pack.author)}"></div>
      <h3>Props (${pack.props.length})</h3>`;
    pack.props.forEach((p, i) => { h += `<div class="item ${mode === 'prop' && sel === p ? 'sel' : ''}" data-p="${i}"><img src="${p.frames[0] ? dataUrl(p.frames[0]) : ''}"><div><b>${E(p.name)}</b><div class="muted">${E(p.id)} · ${p.interact.type === 'none' ? (p.solid ? 'solid' : 'decor') : p.interact.type === 'ui' ? 'screen' : p.interact.type}</div></div></div>`; });
    h += `<div class="row"><button id="pAddProp" class="primary" title="One PNG per prop (several at once is fine). 8 pixels = 1 block, like the game.">+ Props from PNG…</button></div>`;
    h += `<h3>Screens (${Object.keys(pack.uis).length})</h3>`;
    for (const id in pack.uis) h += `<div class="item ${mode === 'ui' && sel === pack.uis[id] ? 'sel' : ''}" data-u="${E(id)}"><div><b>${E(pack.uis[id].title || id)}</b><div class="muted">${E(id)} · ${Object.keys(pack.uis[id].pages).length} page(s)</div></div></div>`;
    h += `<div class="row"><button id="pAddUi" title="A window a prop opens when used: text, pictures and buttons">+ New screen</button></div>`;
    h += `<h3>Custom items (${pack.items.length})</h3>`;
    pack.items.forEach((it, i) => { h += `<div class="item ${mode === 'item' && sel === it ? 'sel' : ''}" data-it="${i}"><img src="${it.image ? dataUrl(it.image) : ''}"><div><b>${E(it.name)}</b><div class="muted">${E(it.id)} · like ${E(it.base)}</div></div></div>`; });
    h += `<div class="row"><button id="pAddItem" title="Your own item (a soda, a plushie…): a game item with your name and picture. Machines can drop it.">+ Custom item from PNG…</button></div>`;
    h += `<h3>Sounds (${Object.keys(pack.sounds).length})</h3>`;
    for (const n in pack.sounds) h += `<div class="row"><span style="flex:1">${E(n)}</span><button data-snd="${E(n)}" title="Remove">✕</button></div>`;
    h += `<div class="row"><button id="pAddSnd" title="Plain PCM .wav files; buttons play them by name">+ Sounds (.wav)…</button></div>`;
    q('#pLeft').innerHTML = h;
    q('#pkName').oninput = (e) => { pack.name = e.target.value; };
    q('#pkId').onchange = (e) => { pack.id = safe(e.target.value); e.target.value = pack.id; };
    q('#pkAuthor').oninput = (e) => { pack.author = e.target.value; };
    root.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { mode = 'prop'; sel = pack.props[+el.dataset.p]; selEl = null; renderAll(); });
    root.querySelectorAll('[data-u]').forEach(el => el.onclick = () => { mode = 'ui'; sel = pack.uis[el.dataset.u]; selEl = null; curPage = sel.start; renderAll(); });
    root.querySelectorAll('[data-snd]').forEach(el => el.onclick = () => { delete pack.sounds[el.dataset.snd]; renderLeft(); });
    root.querySelectorAll('[data-it]').forEach(el => el.onclick = () => { mode = 'item'; sel = pack.items[+el.dataset.it]; selEl = null; renderAll(); });
    q('#pAddItem').onclick = async () => {
      const files = await pickFile('.png', true); let last = null;
      for (const f of files) { const img = await readImg(f); const base = f.name.replace(/\.png$/i, ''); let id = safe(base); while (pack.items.some(x => x.id === id)) id += '_2'; const it = newItem(img, base.replace(/[_\-]+/g, ' ')); it.id = id; pack.items.push(it); last = it; }
      if (last) { mode = 'item'; sel = last; selEl = null; renderAll(); }
    };
    q('#pAddProp').onclick = async () => {
      const files = await pickFile('.png', true); let last = null;
      for (const f of files) { const img = await readImg(f); const base = f.name.replace(/\.png$/i, ''); let id = safe(base); while (pack.props.some(p => p.id === id)) id += '_2'; const p = newProp(img, base.replace(/[_\-]+/g, ' ')); p.id = id; pack.props.push(p); last = p; }
      if (last) { mode = 'prop'; sel = last; selEl = null; renderAll(); }
    };
    q('#pAddUi').onclick = () => { let id = 'screen'; let n = 1; while (pack.uis[id]) id = 'screen' + (++n); pack.uis[id] = newUi(id); mode = 'ui'; sel = pack.uis[id]; curPage = 'main'; selEl = null; renderAll(); };
    q('#pAddSnd').onclick = async () => { for (const f of await pickFile('.wav', true)) pack.sounds[safe(f.name.replace(/\.wav$/i, ''))] = { file: safe(f.name.replace(/\.wav$/i, '')) + '.wav', bytes: new Uint8Array(await f.arrayBuffer()) }; renderLeft(); };
  }

  // ---------------------------------------------------------------- right column (inspector)
  const actionsHtml = (list, tag) => list.map((a, i) => `<div class="act"><select data-${tag}t="${i}">${ACTIONS.map(x => `<option value="${x[0]}" ${x[0] === a.type ? 'selected' : ''}>${x[1]}</option>`).join('')}</select><input type="text" data-${tag}v="${i}" value="${E(a.value)}" ${a.type === 'drop' || a.type === 'spawn' ? 'list="pItemIds"' : ''} placeholder="${E((ACTIONS.find(x => x[0] === a.type) || [, , ''])[2])}"><button data-${tag}x="${i}">✕</button></div>`).join('') + `<button data-${tag}add="1">+ Action</button>`;
  function bindActions(list, tag, after) {
    root.querySelectorAll(`[data-${tag}t]`).forEach(el => el.onchange = () => { list[+el.dataset[tag + 't']].type = el.value; after(true); });
    root.querySelectorAll(`[data-${tag}v]`).forEach(el => el.oninput = () => { list[+el.dataset[tag + 'v']].value = el.value; });
    root.querySelectorAll(`[data-${tag}x]`).forEach(el => el.onclick = () => { list.splice(+el.dataset[tag + 'x'], 1); after(true); });
    root.querySelectorAll(`[data-${tag}add]`).forEach(el => el.onclick = () => { list.push({ type: 'close', value: '' }); after(true); });
  }

  function itemIdsList() {
    let dl = document.getElementById('pItemIds');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'pItemIds'; document.body.appendChild(dl); }
    dl.innerHTML = (pack ? pack.items : []).map(it => `<option value="${E(it.id)}">${E(it.name)} (your item)</option>`).join('') + BASES.map(b => `<option value="${b[0]}">${E(b[1])}</option>`).join('');
  }
  function renderRight() {
    const R = q('#pRight'); itemIdsList();
    if (!pack || !sel) { R.innerHTML = '<h3>Props</h3><p class="muted">Pick a prop or a screen on the left.</p>'; return; }
    if (mode === 'prop') return renderPropInspector(R);
    if (mode === 'item') return renderItemInspector(R);
    if (selEl) return renderElInspector(R);
    return renderUiInspector(R);
  }

  function renderPropInspector(R) {
    const p = sel; const uiOpts = Object.keys(pack.uis);
    R.innerHTML = `<h3>Prop</h3>
      <div class="row"><label>Name</label><input type="text" id="ppName" value="${E(p.name)}"></div>
      <div class="row"><label>Id</label><input type="text" id="ppId" value="${E(p.id)}" title="Used in the console: prop spawn ${E(p.id)}"></div>
      <div class="row"><label>Description</label><textarea id="ppDesc">${E(p.description)}</textarea></div>
      <h3>Look</h3>
      <div class="row"><label>Pixels / block</label><input type="number" id="ppPpu" min="1" max="64" value="${p.ppu}"><span class="muted">game: 8</span></div>
      <div class="row"><label>Size</label><input type="number" id="ppScale" min="0.05" max="20" step="0.05" value="${p.scale}"></div>
      <div class="row"><label>Drawn</label><select id="ppLayer"><option value="back" ${p.layer === 'back' ? 'selected' : ''}>behind characters</option><option value="front" ${p.layer === 'front' ? 'selected' : ''}>in front of characters</option></select></div>
      <div class="row"><label>Order nudge</label><input type="number" id="ppOrder" step="1" value="${p.order}"></div>
      <div class="row"><label>Solid</label><input type="checkbox" id="ppSolid" ${p.solid ? 'checked' : ''}><span class="muted">stand on it, bump into it</span></div>
      <div class="row"><label>Pivot</label><span class="muted">${p.pivot.x.toFixed(2)}, ${p.pivot.y.toFixed(2)} — drag the picture onto the red cross</span></div>
      <h3>Animation (${p.frames.length} frame${p.frames.length === 1 ? '' : 's'})</h3>
      ${p.frames.map((f, i) => `<div class="row"><img src="${dataUrl(f)}" style="width:24px;height:24px;object-fit:contain;image-rendering:pixelated"><span style="flex:1" class="muted">${E(f.name || 'frame ' + (i + 1))} · ${f.w}×${f.h}</span><button data-fu="${i}" title="Earlier">▲</button><button data-fx="${i}" title="Remove">✕</button></div>`).join('')}
      ${p.frames.length > 1 ? `<div class="row"><button id="ppPlay" title="Play / pause the preview">${animPlay ? '⏸ Pause' : '▶ Play'}</button><button id="ppPrev" title="Previous frame">◀</button><button id="ppNext" title="Next frame">▶</button><span class="muted" id="ppFrameNo"></span></div>` : ''}
      <div class="row"><button id="ppAddFrame">+ Frames…</button><label style="width:auto">Speed</label><input type="number" id="ppFps" min="0.1" max="60" step="0.5" value="${p.fps}" style="width:60px"><span class="muted">fps</span></div>
      <h3>When clicked</h3>
      <div class="row"><label>Does</label><select id="ppType">
        <option value="none" ${p.interact.type === 'none' ? 'selected' : ''}>nothing (decoration)</option>
        <option value="sit" ${p.interact.type === 'sit' ? 'selected' : ''}>sit on it</option>
        <option value="ui" ${p.interact.type === 'ui' ? 'selected' : ''}>open a screen</option>
        <option value="actions" ${p.interact.type === 'actions' ? 'selected' : ''}>do actions right away</option></select></div>
      ${p.interact.type !== 'none' ? `<div class="row"><label>Hover text</label><input type="text" id="ppText" value="${E(p.interact.text)}" placeholder="${p.interact.type === 'sit' ? 'Sit down' : 'Use'}"></div>` : ''}
      ${p.interact.type === 'ui' ? `<div class="row"><label>Screen</label><select id="ppUi"><option value="">— pick —</option>${uiOpts.map(u => `<option value="${E(u)}" ${u === p.interact.ui ? 'selected' : ''}>${E(pack.uis[u].title || u)}</option>`).join('')}</select></div>${uiOpts.length ? '' : '<p class="muted">Make a screen first (left, "+ New screen").</p>'}` : ''}
      ${p.interact.type === 'actions' ? actionsHtml(p.interact.actions, 'pa') : ''}
      <h3>Seats (${p.seats.length})</h3>
      <p class="muted">Double-click the picture to add a seat; drag the green circles; right-click one to remove it. A seat is where the character's bottom rests when sitting: put it on top of the cushion.</p>
      ${p.seats.map((s, i) => `<div class="row"><span class="muted" style="flex:1">Seat ${i + 1}: ${s.x.toFixed(2)}, ${s.y.toFixed(2)} blocks</span><button data-sx="${i}">✕</button></div>`).join('')}
      <div class="row" style="margin-top:14px"><button id="ppDup">Duplicate</button><button id="ppDel">Delete prop</button></div>`;
    const re = () => { renderLeft(); renderRight(); draw(); };
    q('#ppName').oninput = (e) => { p.name = e.target.value; renderLeft(); };
    q('#ppId').onchange = (e) => { p.id = safe(e.target.value); e.target.value = p.id; renderLeft(); };
    q('#ppDesc').oninput = (e) => { p.description = e.target.value; };
    q('#ppPpu').oninput = (e) => { p.ppu = Math.max(1, +e.target.value || PX); draw(); };
    q('#ppScale').oninput = (e) => { p.scale = Math.max(0.05, +e.target.value || 1); draw(); };
    q('#ppLayer').onchange = (e) => { p.layer = e.target.value; };
    q('#ppOrder').oninput = (e) => { p.order = Math.round(+e.target.value || 0); };
    q('#ppSolid').onchange = (e) => { p.solid = e.target.checked; renderLeft(); };
    q('#ppFps').oninput = (e) => { p.fps = Math.max(0.1, +e.target.value || 6); animT0 = performance.now() - curFrame(p) * 1000 / p.fps; };
    if (q('#ppPlay')) {
      q('#ppPlay').onclick = () => { if (animPlay) animFrame = curFrame(p); else animT0 = performance.now() - animFrame * 1000 / p.fps; animPlay = !animPlay; renderRight(); draw(); };
      const step = (d) => { animFrame = (curFrame(p) + d + p.frames.length) % p.frames.length; animPlay = false; renderRight(); draw(); };
      q('#ppPrev').onclick = () => step(-1); q('#ppNext').onclick = () => step(1);
    }
    q('#ppType').onchange = (e) => { p.interact.type = e.target.value; if (p.interact.type === 'sit' && !p.seats.length) p.seats.push({ x: 0, y: 1.6 }); re(); };
    if (q('#ppText')) q('#ppText').oninput = (e) => { p.interact.text = e.target.value; };
    if (q('#ppUi')) q('#ppUi').onchange = (e) => { p.interact.ui = e.target.value; };
    if (p.interact.type === 'actions') bindActions(p.interact.actions, 'pa', () => renderRight());
    q('#ppAddFrame').onclick = async () => { for (const f of await pickFile('.png', true)) p.frames.push(await readImg(f)); re(); };
    root.querySelectorAll('[data-fx]').forEach(el => el.onclick = () => { p.frames.splice(+el.dataset.fx, 1); re(); });
    root.querySelectorAll('[data-fu]').forEach(el => el.onclick = () => { const i = +el.dataset.fu; if (i > 0) { const t = p.frames[i]; p.frames[i] = p.frames[i - 1]; p.frames[i - 1] = t; re(); } });
    root.querySelectorAll('[data-sx]').forEach(el => el.onclick = () => { p.seats.splice(+el.dataset.sx, 1); re(); });
    q('#ppDup').onclick = () => { const c = JSON.parse(JSON.stringify({ ...p, frames: [] })); c.frames = p.frames.slice(); c.id = p.id + '_copy'; c.name = p.name + ' copy'; pack.props.push(c); sel = c; re(); };
    q('#ppDel').onclick = () => { if (!confirm('Delete "' + p.name + '"?')) return; pack.props.splice(pack.props.indexOf(p), 1); sel = null; re(); };
  }

  function renderItemInspector(R) {
    const it = sel;
    R.innerHTML = `<h3>Custom item</h3>
      <p class="muted">Your own item for machines to drop (Luna Props). It's a game item with your name and picture: it works exactly like its base, so a soda based on a soda can is drunk like one.</p>
      <div class="row"><label>Name</label><input type="text" id="piName" value="${E(it.name)}" title="What players see. Renaming it in game turns it back into the plain base item."></div>
      <div class="row"><label>Id</label><input type="text" id="piId" value="${E(it.id)}" title="Used in actions (Drop / Give) and the console: prop item ${E(it.id)}"></div>
      <div class="row"><label>Works like</label><input type="text" id="piBase" list="pBaseIds" value="${E(it.base)}"></div>
      <datalist id="pBaseIds">${BASES.map(b => `<option value="${b[0]}">${E(b[1])}</option>`).join('')}</datalist>
      <p class="muted">Any game item id works (type <b>spawn</b> in the game console to see them).</p>
      <div class="row"><label>Notes</label><textarea id="piDesc" placeholder="Just for you: the game shows the base item's description">${E(it.description)}</textarea></div>
      <h3>Picture</h3>
      <div class="row">${it.image ? `<img src="${dataUrl(it.image)}" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated;background:var(--panel)"><span class="muted" style="flex:1">${it.image.w}×${it.image.h} px</span>` : '<span class="muted" style="flex:1">none: it looks like its base</span>'}<button id="piPic">Change…</button></div>
      <p class="muted">Draw it about the size of the base item's own picture (most small items are 8–16 pixels). It's drawn at the same scale.</p>
      <h3>Use it</h3>
      <p class="muted">On a screen button: <b>Drop an item out of the prop</b> → <code>${E(it.id)}</code>. Console: <code>prop item ${E(it.id)}</code>.</p>
      <div class="row" style="margin-top:14px"><button id="piDup">Duplicate</button><button id="piDel">Delete item</button></div>`;
    const re = () => { renderLeft(); renderRight(); draw(); };
    q('#piName').oninput = (e) => { it.name = e.target.value; renderLeft(); };
    q('#piId').onchange = (e) => { it.id = safe(e.target.value); e.target.value = it.id; re(); };
    q('#piBase').onchange = (e) => { it.base = String(e.target.value || '').trim().toLowerCase(); e.target.value = it.base; renderLeft(); };
    q('#piDesc').oninput = (e) => { it.description = e.target.value; };
    q('#piPic').onclick = async () => { const f = (await pickFile('.png'))[0]; if (f) { it.image = await readImg(f); re(); } };
    q('#piDup').onclick = () => { const c = { ...it, id: it.id + '_copy', name: it.name + ' copy' }; pack.items.push(c); sel = c; re(); };
    q('#piDel').onclick = () => { if (!confirm('Delete "' + it.name + '"?')) return; pack.items.splice(pack.items.indexOf(it), 1); sel = null; re(); };
  }

  function renderUiInspector(R) {
    const u = sel;
    R.innerHTML = `<h3>Screen</h3>
      <div class="row"><label>Title</label><input type="text" id="puTitle" value="${E(u.title)}"></div>
      <div class="row"><label>Id</label><input type="text" id="puId" value="${E(u.id)}"></div>
      <div class="row"><label>Size</label><input type="number" id="puW" min="80" max="1600" value="${u.width}"><span>×</span><input type="number" id="puH" min="60" max="1000" value="${u.height}"></div>
      <div class="row"><label>Background</label><input type="color" id="puBg" value="${u.background.slice(0, 7)}"><button id="puBgImg">${u.backgroundImage ? 'Replace picture' : 'Picture…'}</button>${u.backgroundImage ? '<button id="puBgX">✕</button>' : ''}</div>
      <div class="row"><label>Title bar</label><input type="checkbox" id="puBar" ${u.titleBar ? 'checked' : ''}></div>
      <div class="row"><label>First page</label><select id="puStart">${Object.keys(u.pages).map(p => `<option ${p === u.start ? 'selected' : ''}>${E(p)}</option>`).join('')}</select></div>
      <h3>Add to page "${E(curPage)}"</h3>
      <div class="row"><button data-add="text">Text</button><button data-add="button">Button</button><button data-add="image">Picture</button><button data-add="box">Box</button></div>
      <p class="muted">Click something on the screen to edit it, drag it to move it, drag its corner to resize it. Arrow keys nudge, Delete removes. <b>Preview</b> (top left) lets you click the buttons.</p>
      <div class="row" style="margin-top:14px"><button id="puDel">Delete screen</button></div>`;
    q('#puTitle').oninput = (e) => { u.title = e.target.value; renderLeft(); draw(); };
    q('#puId').onchange = (e) => {
      const id = safe(e.target.value); if (id === u.id || pack.uis[id]) { e.target.value = u.id; return; }
      delete pack.uis[u.id]; pack.props.forEach(p => { if (p.interact.ui === u.id) p.interact.ui = id; }); u.id = id; pack.uis[id] = u; renderLeft();
    };
    q('#puW').oninput = (e) => { u.width = Math.max(80, +e.target.value || 260); draw(); };
    q('#puH').oninput = (e) => { u.height = Math.max(60, +e.target.value || 240); draw(); };
    q('#puBg').oninput = (e) => { u.background = e.target.value; draw(); };
    q('#puBgImg').onclick = async () => { const f = (await pickFile('.png'))[0]; if (f) { u.backgroundImage = await readImg(f); renderRight(); draw(); } };
    if (q('#puBgX')) q('#puBgX').onclick = () => { u.backgroundImage = null; renderRight(); draw(); };
    q('#puBar').onchange = (e) => { u.titleBar = e.target.checked; draw(); };
    q('#puStart').onchange = (e) => { u.start = e.target.value; };
    root.querySelectorAll('[data-add]').forEach(el => el.onclick = async () => {
      const t = el.dataset.add; const n = { type: t, x: 20, y: 20, w: t === 'text' ? 200 : 120, h: t === 'text' ? 28 : 40, text: t === 'text' ? 'Text' : t === 'button' ? 'Button' : '', size: 14, color: '#ffffff', align: 'center', bold: false, actions: [] };
      if (t === 'button') { n.fill = '#e0475b'; n.actions.push({ type: 'close', value: '' }); }
      if (t === 'box') n.fill = '#252830';
      if (t === 'image') { const f = (await pickFile('.png'))[0]; if (!f) return; n.image = await readImg(f); n.w = n.image.w * 2; n.h = n.image.h * 2; }
      u.pages[curPage].push(n); selEl = n; renderRight(); draw();
    });
    q('#puDel').onclick = () => { if (!confirm('Delete the screen "' + (u.title || u.id) + '"?')) return; delete pack.uis[u.id]; sel = null; renderAll(); };
  }

  function renderElInspector(R) {
    const el = selEl; const u = sel;
    R.innerHTML = `<h3>${E(el.type)} <button id="peBack" style="float:right">← Screen</button></h3>
      <div class="row"><label>Position</label><input type="number" id="peX" value="${Math.round(el.x)}"><input type="number" id="peY" value="${Math.round(el.y)}"></div>
      <div class="row"><label>Size</label><input type="number" id="peW" value="${Math.round(el.w)}"><input type="number" id="peH" value="${Math.round(el.h)}"></div>
      ${el.type === 'text' || el.type === 'button' ? `
      <div class="row"><label>Text</label><textarea id="peText">${E(el.text)}</textarea></div>
      <div class="row"><label>Text size</label><input type="number" id="peSize" min="6" max="80" value="${el.size}"><label style="width:auto">Bold</label><input type="checkbox" id="peBold" ${el.bold ? 'checked' : ''}></div>
      <div class="row"><label>Align</label><select id="peAlign">${['left', 'center', 'right'].map(a => `<option ${a === el.align ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <div class="row"><label>Text colour</label><input type="color" id="peColor" value="${(el.color || '#ffffff').slice(0, 7)}"></div>` : ''}
      ${el.type === 'button' || el.type === 'box' ? `<div class="row"><label>Fill</label><input type="color" id="peFill" value="${(el.fill || '#252830').slice(0, 7)}"><button id="peFillX" title="Use the Luna look">default</button></div>` : ''}
      ${el.type === 'image' || el.type === 'button' || el.type === 'box' ? `<div class="row"><label>Picture</label><button id="peImg">${el.image ? 'Replace…' : 'Load…'}</button>${el.image ? '<button id="peImgX">✕</button>' : ''}</div>` : ''}
      ${el.type === 'button' ? `<h3>When clicked</h3>${actionsHtml(el.actions, 'ea')}<p class="muted">Actions run top to bottom. "Give an item" uses the game's item ids (the console's spawn command lists them).</p>` : ''}
      <div class="row" style="margin-top:14px"><button id="peUp">Bring forward</button><button id="peDup">Duplicate</button><button id="peDel">Delete</button></div>`;
    const num = (id, k) => { q(id).oninput = (e) => { el[k] = +e.target.value || 0; draw(); }; };
    num('#peX', 'x'); num('#peY', 'y'); num('#peW', 'w'); num('#peH', 'h');
    q('#peBack').onclick = () => { selEl = null; renderRight(); draw(); };
    if (q('#peText')) { q('#peText').oninput = (e) => { el.text = e.target.value; draw(); }; q('#peSize').oninput = (e) => { el.size = +e.target.value || 14; draw(); }; q('#peBold').onchange = (e) => { el.bold = e.target.checked; draw(); }; q('#peAlign').onchange = (e) => { el.align = e.target.value; draw(); }; q('#peColor').oninput = (e) => { el.color = e.target.value; draw(); }; }
    if (q('#peFill')) { q('#peFill').oninput = (e) => { el.fill = e.target.value; draw(); }; q('#peFillX').onclick = () => { delete el.fill; draw(); }; }
    if (q('#peImg')) q('#peImg').onclick = async () => { const f = (await pickFile('.png'))[0]; if (f) { el.image = await readImg(f); renderRight(); draw(); } };
    if (q('#peImgX')) q('#peImgX').onclick = () => { delete el.image; renderRight(); draw(); };
    if (el.type === 'button') bindActions(el.actions, 'ea', () => renderRight());
    const list = u.pages[curPage];
    q('#peUp').onclick = () => { const i = list.indexOf(el); if (i < list.length - 1) { list.splice(i, 1); list.push(el); draw(); } };
    q('#peDup').onclick = () => { const c = JSON.parse(JSON.stringify({ ...el, image: null })); c.image = el.image; c.x += 10; c.y += 10; list.push(c); selEl = c; renderRight(); draw(); };
    q('#peDel').onclick = () => { list.splice(list.indexOf(el), 1); selEl = null; renderRight(); draw(); };
  }

  // ---------------------------------------------------------------- page bar (screens)
  function renderPages() {
    const P = q('#pPages');
    if (!pack || mode !== 'ui' || !sel) { P.innerHTML = ''; return; }
    P.innerHTML = `<select id="pgSel">${Object.keys(sel.pages).map(p => `<option ${p === curPage ? 'selected' : ''}>${E(p)}</option>`).join('')}</select>
      <button id="pgAdd">+ Page</button><button id="pgRen">Rename</button><button id="pgDel">Delete page</button>
      <button id="pgPrev" class="${preview ? 'on' : ''}" title="Click the buttons like a player would">Preview</button>`;
    q('#pgSel').onchange = (e) => { curPage = e.target.value; selEl = null; renderAll(); };
    q('#pgAdd').onclick = () => { let n = 'page' + (Object.keys(sel.pages).length + 1); const name = safe(prompt('Name of the new page (buttons go to it with "Go to page"):', n) || ''); if (!name || sel.pages[name]) return; sel.pages[name] = []; curPage = name; selEl = null; renderAll(); };
    q('#pgRen').onclick = () => {
      const name = safe(prompt('New name for page "' + curPage + '":', curPage) || ''); if (!name || name === curPage || sel.pages[name]) return;
      sel.pages[name] = sel.pages[curPage]; delete sel.pages[curPage];
      for (const p in sel.pages) for (const el of sel.pages[p]) for (const a of el.actions || []) if (a.type === 'page' && a.value === curPage) a.value = name;
      if (sel.start === curPage) sel.start = name; curPage = name; renderAll();
    };
    q('#pgDel').onclick = () => { if (Object.keys(sel.pages).length < 2) { say('A screen needs at least one page.'); return; } if (!confirm('Delete page "' + curPage + '"?')) return; delete sel.pages[curPage]; curPage = Object.keys(sel.pages)[0]; if (!sel.pages[sel.start]) sel.start = curPage; selEl = null; renderAll(); };
    q('#pgPrev').onclick = () => { preview = !preview; selEl = null; renderAll(); };
  }

  // ---------------------------------------------------------------- canvas
  const css2 = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  function size() { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); } ctx.setTransform(d, 0, 0, d, 0, 0); return { W: r.width, H: r.height }; }
  function draw() {
    if (!root.classList.contains('show')) return;
    const { W, H } = size();
    ctx.fillStyle = css2('--bg'); ctx.fillRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
    view = null;
    if (!pack || !sel) { hintText('Pick or add a prop or a screen on the left.'); return; }
    if (mode === 'prop') drawProp(W, H); else if (mode === 'item') drawItem(W, H); else drawUi(W, H);
  }
  const hintText = (t) => { q('#pHint').innerHTML = t; };

  // the frame the preview shows now (the game plays them in a loop at the prop's fps)
  function curFrame(p) {
    const n = p.frames.length; if (n < 2) return 0;
    if (!animPlay) return ((animFrame % n) + n) % n;
    return Math.floor((performance.now() - animT0) / 1000 * Math.max(0.1, p.fps)) % n;
  }
  function drawProp(W, H) {
    const p = sel, fi = curFrame(p), img = p.frames[fi];
    const fn = q('#ppFrameNo'); if (fn) fn.textContent = 'frame ' + (fi + 1) + ' / ' + p.frames.length + (animPlay ? '' : ' (paused)');
    const pw = img ? img.w : 16, ph = img ? img.h : 16;
    const k = p.scale * PX / p.ppu; // game pixels per image pixel
    const charH = 50; // the game's character is about 50 pixels tall
    const z = Math.max(1, Math.floor(Math.min((W - 160) / (pw * k + 60), (H - 80) / (Math.max(ph * k, charH) + 30))));
    const ox = Math.round(W / 2 - 40), gy = Math.round(H - 50); // pivot spot
    const px0 = ox - p.pivot.x * pw * k * z, py0 = gy - (1 - p.pivot.y) * ph * k * z; // image top-left
    view = { z, k, ox, gy, px0, py0, pw, ph };
    // checker + ground line
    ctx.fillStyle = css2('--panel'); ctx.fillRect(px0, py0, pw * k * z, ph * k * z);
    ctx.strokeStyle = css2('--line'); ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke();
    // the game character for scale, standing beside it
    const cx = px0 + pw * k * z + 30 * 1; ctx.fillStyle = 'rgba(154,156,170,.25)';
    ctx.fillRect(cx, gy - charH * z, 12 * z, charH * z); ctx.fillRect(cx - 1 * z, gy - charH * z, 14 * z, 12 * z);
    ctx.fillStyle = css2('--dim'); ctx.font = '11px system-ui'; ctx.fillText('the character (for size)', cx, gy + 14);
    if (img) ctx.drawImage(canv(img), px0, py0, pw * k * z, ph * k * z);
    ctx.strokeStyle = 'rgba(143,91,255,.6)'; ctx.strokeRect(px0 - 0.5, py0 - 0.5, pw * k * z + 1, ph * k * z + 1);
    // pivot
    ctx.strokeStyle = '#e0475b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox - 8, gy); ctx.lineTo(ox + 8, gy); ctx.moveTo(ox, gy - 8); ctx.lineTo(ox, gy + 8); ctx.stroke(); ctx.lineWidth = 1;
    // seats: blocks from the pivot (1 block = 8 game pixels)
    p.seats.forEach((s, i) => {
      const sx = ox + s.x * PX * z, sy = gy - s.y * PX * z;
      ctx.fillStyle = 'rgba(76,195,138,.2)'; ctx.fillRect(sx - 4 * z, sy - 20 * z, 8 * z, 20 * z); ctx.fillRect(sx - 4 * z, sy - 4 * z, 14 * z, 4 * z); ctx.fillRect(sx + 7 * z, sy - 4 * z, 3 * z, 13 * z); // a sitting body, roughly: hips on the seat
      ctx.fillStyle = '#4cc38a'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.font = 'bold 9px system-ui'; ctx.fillText(i + 1, sx - 3, sy + 3);
    });
    hintText(`<b>${E(p.name)}</b> · ${pw}×${ph} px = ${(pw * k / PX).toFixed(2)}×${(ph * k / PX).toFixed(2)} blocks · drag the picture so the red cross is at the point that should go where you click in game (usually the bottom middle)` + (p.interact.type === 'sit' ? ' · double-click to add a seat' : ''));
  }

  // a custom item: big, and at game size next to the character
  function drawItem(W, H) {
    const it = sel, img = it.image; view = null;
    const gy = Math.round(H - 50);
    ctx.strokeStyle = css2('--line'); ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke();
    if (img) {
      const big = Math.max(1, Math.floor(Math.min((W * 0.45) / img.w, (H - 140) / img.h)));
      const bx = Math.round(W * 0.3 - img.w * big / 2), by = Math.round((gy - 30) / 2 - img.h * big / 2 + 10);
      ctx.fillStyle = css2('--panel'); ctx.fillRect(bx, by, img.w * big, img.h * big);
      ctx.drawImage(canv(img), bx, by, img.w * big, img.h * big);
      const z = 3, cx = Math.round(W * 0.7);   // game size, 3x zoom
      ctx.fillStyle = 'rgba(154,156,170,.25)'; ctx.fillRect(cx, gy - 50 * z, 12 * z, 50 * z); ctx.fillRect(cx - z, gy - 50 * z, 14 * z, 12 * z);
      ctx.drawImage(canv(img), cx + 16 * z, gy - img.h * z, img.w * z, img.h * z);
      ctx.fillStyle = css2('--dim'); ctx.font = '11px system-ui'; ctx.fillText('on the ground beside the character (3× zoom)', cx - 40, gy + 14);
    }
    hintText(`<b>${E(it.name)}</b> · works like <b>${E(it.base)}</b>` + (img ? ` · ${img.w}×${img.h} px` : ' · no picture: it looks like its base'));
  }
  function uiRect(W, H) { const u = sel, bar = u.titleBar ? 26 : 0; const x = Math.round((W - u.width) / 2), y = Math.round((H - u.height - bar) / 2) + 10; return { x, y: y + bar, bar, top: y }; }
  function drawUi(W, H) {
    const u = sel, r = uiRect(W, H);
    ctx.fillStyle = css2('--line'); ctx.fillRect(r.x - 1, r.top - 1, u.width + 2, u.height + r.bar + 2);
    if (r.bar) { ctx.fillStyle = '#1d1f25'; ctx.fillRect(r.x, r.top, u.width, r.bar); ctx.fillStyle = '#e6e6ea'; ctx.font = 'bold 13px system-ui'; ctx.fillText(u.title || '', r.x + 10, r.top + 17); ctx.fillStyle = '#9a9caa'; ctx.fillText('✕', r.x + u.width - 18, r.top + 17); }
    ctx.fillStyle = u.background || '#1d1f25'; ctx.fillRect(r.x, r.y, u.width, u.height);
    if (u.backgroundImage) ctx.drawImage(canv(u.backgroundImage), r.x, r.y, u.width, u.height);
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, u.width, u.height); ctx.clip();
    for (const el of sel.pages[curPage] || []) drawEl(el, r.x, r.y);
    ctx.restore();
    if (selEl && !preview) {
      ctx.strokeStyle = '#8f5bff'; ctx.lineWidth = 2; ctx.strokeRect(r.x + selEl.x - 1, r.y + selEl.y - 1, selEl.w + 2, selEl.h + 2); ctx.lineWidth = 1;
      ctx.fillStyle = '#8f5bff'; ctx.fillRect(r.x + selEl.x + selEl.w - 4, r.y + selEl.y + selEl.h - 4, 8, 8);
    }
    view = r;
    hintText(preview ? 'Preview: click the buttons. "Go to page" and "Close" work here; other actions show what they would do.' : `Screen <b>${E(u.title || u.id)}</b>, page <b>${E(curPage)}</b> · ${u.width}×${u.height} px (as big as it shows in game)`);
  }
  function fitImg(img, x, y, w, h) { const c = canv(img); const s = Math.min(w / img.w, h / img.h); const dw = img.w * s, dh = img.h * s; ctx.drawImage(c, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
  function wrapText(el, x, y) {
    ctx.fillStyle = el.color || '#ffffff'; ctx.font = (el.bold ? 'bold ' : '') + el.size + 'px system-ui'; ctx.textBaseline = 'top';
    const lines = []; for (const para of String(el.text || '').split('\n')) { let line = ''; for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > el.w - 4 && line) { lines.push(line); line = w; } else line = t; } lines.push(line); }
    const lh = el.size * 1.25, total = lines.length * lh; let ty = el.type === 'button' ? y + (el.h - total) / 2 : y;
    for (const l of lines) { const tw = ctx.measureText(l).width; const tx = el.align === 'left' ? x + 4 : el.align === 'right' ? x + el.w - tw - 4 : x + (el.w - tw) / 2; ctx.fillText(l, tx, ty); ty += lh; }
    ctx.textBaseline = 'alphabetic';
  }
  function drawEl(el, ox, oy) {
    const x = ox + el.x, y = oy + el.y;
    if (el.type === 'box') { ctx.fillStyle = el.fill || 'rgba(0,0,0,.3)'; ctx.fillRect(x, y, el.w, el.h); if (el.image) fitImg(el.image, x, y, el.w, el.h); return; }
    if (el.type === 'image') { if (el.image) fitImg(el.image, x, y, el.w, el.h); else { ctx.strokeStyle = '#9a9caa'; ctx.strokeRect(x, y, el.w, el.h); } return; }
    if (el.type === 'button') {
      if (el.image) fitImg(el.image, x, y, el.w, el.h);
      else { ctx.fillStyle = el.fill || '#252830'; ctx.fillRect(x, y, el.w, el.h); ctx.strokeStyle = el.fill ? 'rgba(0,0,0,.3)' : '#33363f'; ctx.strokeRect(x + 0.5, y + 0.5, el.w - 1, el.h - 1); }
    }
    wrapText(el, x, y);
  }

  // ---------------------------------------------------------------- mouse
  const mpos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', (e) => {
    if (!pack || !sel || !view) return; const m = mpos(e); cv.setPointerCapture(e.pointerId);
    if (mode === 'prop') {
      const v = view, p = sel;
      if (e.button === 2) { const i = p.seats.findIndex(s => Math.hypot(v.ox + s.x * PX * v.z - m.x, v.gy - s.y * PX * v.z - m.y) < 9); if (i >= 0) { p.seats.splice(i, 1); renderRight(); draw(); } return; }
      const si = p.seats.findIndex(s => Math.hypot(v.ox + s.x * PX * v.z - m.x, v.gy - s.y * PX * v.z - m.y) < 9);
      if (si >= 0) { drag = { seat: p.seats[si] }; return; }
      // drag the picture: the red cross (the pivot) stays put, so this sets which point of the picture sits on it
      if (m.x >= v.px0 && m.x <= v.px0 + v.pw * v.k * v.z && m.y >= v.py0 && m.y <= v.py0 + v.ph * v.k * v.z) { drag = { pivot: true, m0: m, p0: { ...p.pivot } }; return; }
      return;
    }
    const r = view, list = sel.pages[curPage] || [];
    const hit = [...list].reverse().find(el => m.x >= r.x + el.x && m.x <= r.x + el.x + el.w && m.y >= r.y + el.y && m.y <= r.y + el.y + el.h);
    if (preview) {
      if (hit && hit.type === 'button') for (const a of hit.actions || []) {
        if (a.type === 'page' && sel.pages[a.value]) { curPage = a.value; renderPages(); }
        else if (a.type === 'close') { say('(the screen closes)'); curPage = sel.start; renderPages(); break; }
        else say('In game: ' + (ACTIONS.find(x => x[0] === a.type) || [, a.type])[1] + (a.value ? ' → ' + a.value : ''), 2500);
      }
      draw(); return;
    }
    if (selEl && Math.abs(m.x - (r.x + selEl.x + selEl.w)) < 7 && Math.abs(m.y - (r.y + selEl.y + selEl.h)) < 7) { drag = { resize: selEl, m0: m, w0: selEl.w, h0: selEl.h }; return; }
    selEl = hit || null;
    if (hit) drag = { move: hit, m0: m, x0: hit.x, y0: hit.y };
    renderRight(); draw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || !view) return; const m = mpos(e), v = view;
    if (drag.seat) { drag.seat.x = Math.round((m.x - v.ox) / (PX * v.z) * 20) / 20; drag.seat.y = Math.round((v.gy - m.y) / (PX * v.z) * 20) / 20; draw(); }
    else if (drag.pivot) {
      const p = sel, wpx = v.pw * v.k * v.z, hpx = v.ph * v.k * v.z;
      p.pivot.x = Math.min(1, Math.max(0, Math.round((drag.p0.x - (m.x - drag.m0.x) / wpx) * 100) / 100));
      p.pivot.y = Math.min(1, Math.max(0, Math.round((drag.p0.y + (m.y - drag.m0.y) / hpx) * 100) / 100)); draw();
    }
    else if (drag.move) { drag.move.x = Math.round(drag.x0 + m.x - drag.m0.x); drag.move.y = Math.round(drag.y0 + m.y - drag.m0.y); draw(); }
    else if (drag.resize) { drag.resize.w = Math.max(8, Math.round(drag.w0 + m.x - drag.m0.x)); drag.resize.h = Math.max(8, Math.round(drag.h0 + m.y - drag.m0.y)); draw(); }
  });
  cv.addEventListener('pointerup', () => { if (drag) { drag = null; renderRight(); } });
  cv.addEventListener('dblclick', (e) => {
    if (!pack || mode !== 'prop' || !sel || !view) return; const m = mpos(e), v = view;
    sel.seats.push({ x: Math.round((m.x - v.ox) / (PX * v.z) * 20) / 20, y: Math.round((v.gy - m.y) / (PX * v.z) * 20) / 20 });
    if (sel.interact.type === 'none') sel.interact.type = 'sit';
    renderAll();
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (!root.classList.contains('show') || mode !== 'ui' || !selEl || preview) return;
    if (/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
    const d = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') selEl.x -= d; else if (e.key === 'ArrowRight') selEl.x += d; else if (e.key === 'ArrowUp') selEl.y -= d; else if (e.key === 'ArrowDown') selEl.y += d;
    else if (e.key === 'Delete') { const l = sel.pages[curPage]; l.splice(l.indexOf(selEl), 1); selEl = null; renderRight(); }
    else return;
    e.preventDefault(); draw();
  });
  window.addEventListener('resize', draw);

  // ---------------------------------------------------------------- export (same format the mod reads; see its README)
  async function png(img) { const b = await new Promise(r => canv(img).toBlob(r, 'image/png')); return new Uint8Array(await b.arrayBuffer()); }
  async function exportPack() {
    if (!pack || !pack.props.length) { say('Add at least one prop first.'); return; }
    const ids = new Set(); for (const p of pack.props) { if (ids.has(p.id)) { say('Two props share the id "' + p.id + '": give one another id.', 5000); return; } ids.add(p.id); }
    const folder = safe(pack.id); const files = []; const imgName = new Map(); let n = 0;
    const addImg = async (img, base) => { if (!img) return null; if (imgName.has(img)) return imgName.get(img); let name = safe(base) + '.png'; while (files.some(f => f.name === folder + '/' + name)) name = safe(base) + '_' + (++n) + '.png'; imgName.set(img, name); files.push({ name: folder + '/' + name, data: await png(img) }); return name; };
    const iids = new Set(); for (const it of pack.items) { if (iids.has(it.id)) { say('Two custom items share the id "' + it.id + '": give one another id.', 5000); return; } if (!it.base) { say('"' + it.name + '" needs a base item ("Works like").', 5000); return; } iids.add(it.id); }
    const out = { format: 1, id: folder, name: pack.name, author: pack.author, props: [], items: [], uis: {}, sounds: {} };
    for (const it of pack.items) out.items.push({ id: it.id, name: it.name, base: it.base, sprite: it.image ? await addImg(it.image, 'item_' + it.id) : undefined, description: it.description || undefined });
    for (const p of pack.props) {
      const frames = []; for (let i = 0; i < p.frames.length; i++) frames.push(await addImg(p.frames[i], p.id + (p.frames.length > 1 ? '_' + (i + 1) : '')));
      const o = { id: p.id, name: p.name, description: p.description, frames, fps: p.fps, ppu: p.ppu, pivot: p.pivot, scale: p.scale, layer: p.layer, order: p.order, solid: p.solid, seats: p.seats.map(st => ({ x: st.x, y: st.y, hips: true })) };
      if (p.interact.type !== 'none') o.interact = { type: p.interact.type, ui: p.interact.ui || undefined, text: p.interact.text || undefined, actions: p.interact.type === 'actions' ? p.interact.actions : undefined };
      out.props.push(o);
    }
    for (const id in pack.uis) {
      const u = pack.uis[id]; const pages = {};
      for (const pg in u.pages) {
        pages[pg] = [];
        for (const el of u.pages[pg]) {
          const o = { type: el.type, x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.w), h: Math.round(el.h) };
          if (el.type === 'text' || el.type === 'button') Object.assign(o, { text: el.text, size: el.size, bold: !!el.bold, align: el.align, textColor: el.color });
          if (el.fill) o.color = el.fill;
          if (el.image) o.image = await addImg(el.image, 'ui_' + id + '_' + pg);
          if (el.type === 'button') o.actions = el.actions;
          pages[pg].push(o);
        }
      }
      out.uis[id] = { title: u.title, width: u.width, height: u.height, background: u.background, backgroundImage: u.backgroundImage ? await addImg(u.backgroundImage, 'ui_' + id + '_bg') : undefined, titleBar: u.titleBar, start: u.start, pages };
    }
    for (const nme in pack.sounds) { out.sounds[nme] = pack.sounds[nme].file; files.push({ name: folder + '/' + pack.sounds[nme].file, data: pack.sounds[nme].bytes }); }
    files.unshift({ name: folder + '/props.json', data: new TextEncoder().encode(JSON.stringify(out, null, 2)) });
    const blob = new Blob([RIG.zip(files)], { type: 'application/zip' });
    if (typeof downloadBlob === 'function') await downloadBlob(blob, folder + '.zip');
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
    say('Exported ' + folder + '.zip — unzip it into BepInEx\\plugins\\LunaProps\\Props\\, then "prop reload" in game.', 7000);
  }

  // ---------------------------------------------------------------- import (a pack zip, or props.json + its files)
  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {};
    for (let k = 0; k < count; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
      if (name.endsWith('/')) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true); const raw = u8.subarray(start, start + csize);
      let data = raw;
      if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else if (method !== 0) continue;
      out[name.split('/').pop()] = data;
    }
    return out;
  }
  async function importFiles(fileList) {
    let files = {};
    for (const f of fileList) {
      if (/\.zip$/i.test(f.name)) Object.assign(files, await unzip(await f.arrayBuffer()));
      else files[f.name] = new Uint8Array(await f.arrayBuffer());
    }
    if (!files['props.json']) { say('No props.json found: pick the pack zip, or its props.json with its PNG files.', 5000); return; }
    const j = JSON.parse(new TextDecoder().decode(files['props.json']));
    const imgs = {};
    const img = async (nm) => { if (!nm) return null; if (imgs[nm]) return imgs[nm]; if (!files[nm]) { say('Missing picture: ' + nm, 4000); return null; } const r = await readImg(new File([files[nm]], nm, { type: 'image/png' })); imgs[nm] = r; return r; };
    const pk = { id: j.id || 'mypack', name: j.name || 'Props', author: j.author || '', props: [], uis: {}, sounds: {}, items: [] };
    for (const it of j.items || []) pk.items.push({ id: it.id || 'item', name: it.name || it.id || 'Item', base: it.base || '', description: it.description || '', image: await img(it.sprite) });
    for (const id in j.uis || {}) {
      const u = j.uis[id]; const ui = { id, title: u.title || '', width: u.width || 260, height: u.height || 240, background: u.background || '#1d1f25', backgroundImage: await img(u.backgroundImage), titleBar: u.titleBar !== false, start: u.start || 'main', pages: {} };
      for (const pg in u.pages || {}) ui.pages[pg] = await Promise.all((u.pages[pg] || []).map(async e => ({ type: e.type || 'text', x: e.x || 0, y: e.y || 0, w: e.w || 100, h: e.h || 30, text: e.text || '', size: e.size || 14, bold: !!e.bold, align: e.align || 'center',
        color: e.textColor || (e.type === 'text' || !e.type ? e.color : null) || '#ffffff', fill: e.type !== 'text' && e.color ? e.color : undefined, image: await img(e.image), actions: e.actions || [] })));
      if (!Object.keys(ui.pages).length) ui.pages.main = [];
      pk.uis[id] = ui;
    }
    for (const p of j.props || []) {
      const frames = []; for (const f of (p.frames && p.frames.length ? p.frames : [p.sprite])) { const r = await img(f); if (r) frames.push(r); }
      pk.props.push({ id: p.id || 'prop', name: p.name || p.id || 'Prop', description: p.description || '', frames, fps: p.fps || 6, ppu: p.ppu || PX, pivot: p.pivot || { x: 0.5, y: 0 }, scale: p.scale || 1,
        layer: p.layer || 'back', order: p.order || 0, solid: !!p.solid, seats: (p.seats || []).map(st => ({ x: st.x, y: st.hips ? st.y : Math.round((st.y - 0.8) * 20) / 20 })), interact: Object.assign({ type: (p.seats && p.seats.length) ? 'sit' : 'none', ui: '', text: '', actions: [] }, p.interact || {}) });
    }
    for (const n in j.sounds || {}) if (files[j.sounds[n]]) pk.sounds[n] = { file: j.sounds[n], bytes: files[j.sounds[n]] };
    pack = pk; sel = pk.props[0] || null; mode = 'prop'; selEl = null; renderAll();
    say('Opened "' + pk.name + '": ' + pk.props.length + ' prop(s), ' + Object.keys(pk.uis).length + ' screen(s).');
  }

  // ---------------------------------------------------------------- wiring
  function renderAll() { renderLeft(); renderRight(); renderPages(); draw(); }
  // keep redrawing while an animated prop is shown and playing (skipped while dragging so it doesn't fight the mouse)
  (function tick() {
    if (root.classList.contains('show') && mode === 'prop' && sel && sel.frames && sel.frames.length > 1 && animPlay && !drag) draw();
    requestAnimationFrame(tick);
  })();
  q('#pNew').onclick = () => { if (pack && !confirm('Start a new pack? Export this one first if you want to keep it.')) return; pack = newPack(); sel = null; selEl = null; renderAll(); };
  q('#pImport').onclick = () => { const f = q('#pImportFile'); f.value = ''; f.onchange = async () => { try { await importFiles([...f.files]); } catch (err) { say('Could not open the pack: ' + err.message, 5000); } }; f.click(); };
  q('#pExport').onclick = () => exportPack().catch(err => say('Export failed: ' + err.message, 5000));
  q('#pClose').onclick = () => { root.classList.remove('show'); };
  q('#pHelp').onclick = () => alert('Luna Props packs\n\nThese are for the separate Luna Props mod (furniture & set dressing), not for your rig. Players need the Luna Props mod installed and the same pack in BepInEx\\plugins\\LunaProps\\Props.\n\n' +
    '1. "+ Props from PNG…": one PNG per prop, drawn at the game\'s scale (8 pixels = 1 block; the character is about 50 pixels tall).\n' +
    '2. Drag the picture so the red cross is at the point that should go where you click in game (usually the bottom middle).\n' +
    '3. Chairs: "When clicked → sit on it", then drag the green seat to where the body goes.\n' +
    '4. Machines and terminals: "+ New screen", add text, pictures and buttons, give buttons actions (go to page, give an item, run a command…). Then on the prop: "When clicked → open a screen".\n' +
    '   Custom items (a soda, a plushie…): "+ Custom item from PNG…", pick what it works like, then give a button "Drop an item out of the prop" with its id.\n' +
    '5. "Export pack" and unzip it into BepInEx\\plugins\\LunaProps\\Props. In game: F3 opens the placement tool, or type "prop list" in the console.');
  window.LunaProps = { open: () => { root.classList.add('show'); if (!pack) { pack = newPack(); } renderAll(); } };
  // the button in the editor's top bar
  const btn = document.createElement('button'); btn.textContent = 'Props (Luna Props mod)'; btn.title = 'Make furniture / prop packs for the separate Luna Props mod (not part of your rig)';
  btn.onclick = () => window.LunaProps.open();
  const anchor = document.getElementById('btnHelp'); if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor);
})();
