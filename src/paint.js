/* ===== Sprite Paint Editor script ===== */

/*============================================================
  Sprite Paint Editor — self-contained
  Tools: pencil, eraser, fill, color picker
  Layers: add/delete/select, rename, duplicate, visibility, opacity, move
  Preview: live composite of all layers with effects
  Export: PNG download
  Tabs: Paint / Preview / Export
  Context: state preserved across mode switches
============================================================*/

const paint_cv = document.getElementById('paintCv');
const paint_ctx = paint_cv.getContext('2d', {willReadFrequently:true});
const paint_preview = document.getElementById('paintPreview');
const paint_pctx = paint_preview.getContext('2d', {willReadFrequently:true});
const paint_wrap = document.getElementById('paintCanvasWrap');
const paint_coord = document.getElementById('paintCoord');

let layers = [];
let active = null;
let zoom = 1;
let pan = {x:0, y:0};          // kept for saved contexts; rendering is 1:1 and CSS handles zoom
let autoFit = true;            // canvas follows the browser size until the user zooms
let isDown = false;
let lastPos = null;
let tool = 'pencil';
let brushSize = 4;
let color = '#e0475b';
let dirty = false;
let viewTab = 'paint'; // 'paint' | 'preview' | 'export'
let previewMode = 'paint'; // what the Preview tab shows: 'paint' | 'rig'
let rigShot = null;        // last rendered rig canvas, for the rig preview

const paint_quickColors = ['#e0475b','#8f5bff','#4cc38a','#e9b44c','#ffffff','#000000','#33363f','#1d1f25'];
const qc = document.getElementById('paintQuickColors');
paint_quickColors.forEach(c => {
  const s = document.createElement('div');
  s.className = 'color-swatch';
  s.style.background = c;
  s.title = c;
  s.onclick = () => { setColor(c); };
  qc.appendChild(s);
});

// Context preservation across mode switches
const paintContext = {
  saved: false,
  layers: null,
  active: null,
  zoom: null,
  pan: null,
  tool: null,
  brushSize: null,
  color: null,
  viewTab: null
};

function savePaintContext(){
  // canvases can't survive JSON: keep the live objects, they are never torn down
  paintContext.layers = layers;
  paintContext.active = active;
  paintContext.zoom = zoom;
  paintContext.pan = {x:pan.x, y:pan.y};
  paintContext.tool = tool;
  paintContext.brushSize = brushSize;
  paintContext.color = color;
  paintContext.viewTab = viewTab;
  paintContext.saved = true;
}

function restorePaintContext(){
  if(!paintContext.saved) return;
  if(paintContext.layers) layers = paintContext.layers;
  active = paintContext.active;
  zoom = paintContext.zoom;
  pan = {x:paintContext.pan.x, y:paintContext.pan.y};
  tool = paintContext.tool;
  brushSize = paintContext.brushSize;
  color = paintContext.color;
  viewTab = paintContext.viewTab;
  document.getElementById('paintToolSel').value = tool;
  document.getElementById('paintBrushSize').value = brushSize;
  document.getElementById('paintBrushSizeVal').textContent = brushSize+'px';
  document.getElementById('paintColorPick').value = color;
  switchPaintTab(viewTab);
  dirty = true;
  updateUI(); composite();
}

function toast(msg, ms=2600){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(()=>t.classList.remove('show'), ms);
}

function newLayerCanvas(w,h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#00000000';
  g.fillRect(0,0,w,h);
  return c;
}

function composite(){
  paint_ctx.setTransform(1, 0, 0, 1, 0, 0);
  paint_ctx.globalAlpha = 1;
  paint_ctx.fillStyle = '#0a0a0f';
  paint_ctx.fillRect(0, 0, paint_cv.width, paint_cv.height);
  layers.forEach(l=>{
    paint_ctx.globalAlpha = l.opacity;
    if(l.visible) paint_ctx.drawImage(l.canvas, 0, 0);
  });
  paint_ctx.globalAlpha = 1;
  updatePreview();
}

function updatePreview(){
  if (previewMode === 'rig' && (animPreviewOn || lastAnimShot)) { drawAnimPreview(lastAnimShot, lastAnimCrop); return; }
  const scale = parseInt(document.getElementById('paintPreviewScale').value);
  document.getElementById('paintPreviewScaleVal').textContent = scale+'x';
  paint_pctx.fillStyle = '#0a0a0f';
  paint_pctx.fillRect(0,0,paint_preview.width,paint_preview.height);
  paint_pctx.save();
  const pw = paint_preview.width, ph = paint_preview.height;
  const lw = paint_cv.width, lh = paint_cv.height;
  const fit = Math.min(pw/lw, ph/lh);
  paint_pctx.translate((pw - lw*fit)/2, (ph - lh*fit)/2);
  paint_pctx.scale(fit*scale, fit*scale);
  layers.forEach(l=>{
    paint_pctx.globalAlpha = l.opacity;
    if(l.visible) paint_pctx.drawImage(l.canvas, 0, 0);
  });
  paint_pctx.globalAlpha = 1;
  paint_pctx.restore();
  if (previewMode === 'rig') drawRigShot(paint_pctx, paint_preview);
}

function drawRigShot(g, el){
  g.fillStyle = '#0a0a0f';
  g.fillRect(0, 0, el.width, el.height);
  if (!rigShot) return;
  const fit = Math.min(el.width / rigShot.width, el.height / rigShot.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(rigShot, (el.width - rigShot.width * fit) / 2, (el.height - rigShot.height * fit) / 2, rigShot.width * fit, rigShot.height * fit);
}

// ---------------------------------------------------------------- view fitting
// The canvas bitmap is always the sprite's real size; CSS scales it uniformly so
// it fills the browser instead of sitting in a fixed rectangle.
function fitZoom(){
  const vp = document.getElementById('viewport');
  const r = vp ? vp.getBoundingClientRect() : { width: 0, height: 0 };
  if (r.width < 2 || r.height < 2) return zoom;
  const availW = Math.max(64, r.width - 32);
  const availH = Math.max(64, r.height - 32);
  return Math.max(0.1, Math.min(availW / paint_cv.width, availH / paint_cv.height, 32));
}

function syncCanvasScale(){
  if (autoFit) zoom = fitZoom();
  paint_cv.style.width = Math.max(1, Math.round(paint_cv.width * zoom)) + 'px';
  paint_cv.style.height = Math.max(1, Math.round(paint_cv.height * zoom)) + 'px';
  const z = document.getElementById('paintInfoZoom');
  if (z) z.textContent = Math.round(zoom * 100) + '%';
}

function resetPaintView(){ autoFit = true; syncCanvasScale(); }

window.addEventListener('resize', ()=>{
  if (document.body.dataset.mode === 'paint' && viewTab === 'paint') syncCanvasScale();
});
window.__paintModeShown = ()=>{ populateAnimClips(); syncCanvasScale(); };

// ---------------------------------------------------------------- undo / redo
const undoStack = [], redoStack = [];
const UNDO_LIMIT = 40;
let restoringPaint = false;

function clonePaintLayers(src){
  return src.map(l=>{
    const c = newLayerCanvas(l.canvas.width, l.canvas.height);
    c.getContext('2d').drawImage(l.canvas, 0, 0);
    return Object.assign({}, l, { canvas: c });
  });
}

function paintState(){
  return { layers: clonePaintLayers(layers), active, w: paint_cv.width, h: paint_cv.height };
}

function pushPaintUndo(){
  if (restoringPaint) return;
  undoStack.push(paintState());
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function applyPaintState(s){
  restoringPaint = true;
  paint_cv.width = s.w; paint_cv.height = s.h;
  layers = clonePaintLayers(s.layers);
  active = (s.active === null || s.active === undefined || !layers.length)
    ? (layers.length ? 0 : null)
    : Math.min(s.active, layers.length - 1);
  dirty = true;
  updateUI(); composite();
  restoringPaint = false;
  scheduleAutoPush();
}

function undoPaint(){
  if (!undoStack.length) { toast('Nothing to undo'); return; }
  redoStack.push(paintState());
  applyPaintState(undoStack.pop());
  updateUndoButtons();
  toast('Undo');
}

function redoPaint(){
  if (!redoStack.length) { toast('Nothing to redo'); return; }
  undoStack.push(paintState());
  applyPaintState(redoStack.pop());
  updateUndoButtons();
  toast('Redo');
}

function updateUndoButtons(){
  const u = document.getElementById('paintBtnUndo');
  const r = document.getElementById('paintBtnRedo');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

// ---------------------------------------------------------------- automatic push
let autoPushTimer = null;

function rigPushTargets(){
  const R = window.__rigEditor, doc = R && R.doc;
  if (!doc) return null;
  if (paint_cv.width !== doc.width || paint_cv.height !== doc.height) return null;
  const targets = layers.filter(p => p.rigLayerId);
  return targets.length ? { R, targets } : null;
}

function scheduleAutoPush(){
  if (restoringPaint) return;
  if (!rigPushTargets()) return;
  clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(autoPushNow, 250);
}

function autoPushNow(){
  clearTimeout(autoPushTimer);
  const g = rigPushTargets();
  if (!g) return 0;
  let pushed = 0, failed = 0;
  for (const p of g.targets) {
    const l = g.R.layerById(p.rigLayerId);
    if (!l || !p.canvas) { failed++; continue; }
    const sx = Math.round(l.x), sy = Math.round(l.y);
    let data;
    try { data = p.canvas.getContext('2d').getImageData(sx, sy, l.w, l.h).data; }
    catch (e) { failed++; continue; }
    if (g.R.setLayerPixels(l.id, data)) pushed++; else failed++;
  }
  g.R.redraw();
  rigBridgeStatus('Auto-synced ' + pushed + ' layer' + (pushed === 1 ? '' : 's') + (failed ? '  (' + failed + ' skipped)' : ''));
  if (previewMode === 'rig' && viewTab === 'preview' && !animPreviewOn) {
    rigShot = g.R.snapshot();
    updatePreview();
  }
  return pushed;
}

// ---------------------------------------------------------------- animated rig preview
let animPreviewOn = false;
let animFrame = 0;
let lastAnimShot = null, lastAnimCrop = null;

function populateAnimClips(){
  const sel = document.getElementById('paintAnimClip');
  if (!sel) return;
  const R = window.__rigEditor;
  const clips = (R && R.animClips) ? R.animClips() : [];
  const cur = sel.value;
  sel.innerHTML = clips.length
    ? clips.map(c => '<option value="' + c.replace(/"/g, '&quot;') + '">' + c + '</option>').join('')
    : '<option value="">No animations</option>';
  if (cur && clips.includes(cur)) sel.value = cur;
}

function drawAnimPreview(shot, crop){
  paint_pctx.setTransform(1, 0, 0, 1, 0, 0);
  paint_pctx.globalAlpha = 1;
  paint_pctx.fillStyle = '#0a0a0f';
  paint_pctx.fillRect(0, 0, paint_preview.width, paint_preview.height);
  if (!shot) return;
  const src = crop || { x: 0, y: 0, w: shot.width, h: shot.height };
  const fit = Math.min(paint_preview.width / src.w, paint_preview.height / src.h);
  paint_pctx.imageSmoothingEnabled = false;
  paint_pctx.drawImage(shot, src.x, src.y, src.w, src.h,
    (paint_preview.width - src.w * fit) / 2, (paint_preview.height - src.h * fit) / 2,
    src.w * fit, src.h * fit);
}

function animPreviewTick(){
  animFrame = requestAnimationFrame(animPreviewTick);
  if (!animPreviewOn) return;
  if (document.body.dataset.mode !== 'paint' || viewTab === 'export') return;
  const R = window.__rigEditor;
  if (!R || !R.copyCanvas) return;
  lastAnimShot = R.copyCanvas();
  lastAnimCrop = R.animCrop ? R.animCrop() : null;
  drawAnimPreview(lastAnimShot, lastAnimCrop);
}

function startRigAnimPreview(){
  const R = window.__rigEditor;
  if (!R || !R.doc) { toast('Open a rig first'); return; }
  const clips = R.animClips ? R.animClips() : [];
  if (!clips.length) { toast('Animation needs the game template: click Game template first', 7000); return; }
  populateAnimClips();
  const sel = document.getElementById('paintAnimClip');
  const clip = sel && sel.value ? sel.value : clips[0];
  if (R.snapshot) R.snapshot();       // give the hidden rig canvas a real size
  if (!R.startAnim || !R.startAnim(clip)) { toast('Could not start the animation preview', 6000); return; }
  animPreviewOn = true;
  previewMode = 'rig';
  // stay on the Paint tab so you can keep painting while the rig animates on the right
  switchPaintTab(viewTab === 'export' ? 'paint' : viewTab);
  const btn = document.getElementById('paintBtnAnimPlay');
  if (btn) btn.textContent = '⏸ Pause';
  if (!animFrame) animFrame = requestAnimationFrame(animPreviewTick);
}

function stopRigAnimPreview(){
  animPreviewOn = false;
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = 0; }
  const R = window.__rigEditor;
  if (R && R.stopAnim) R.stopAnim();
  const btn = document.getElementById('paintBtnAnimPlay');
  if (btn) btn.textContent = '▶ Play';
  if (previewMode === 'rig') updatePreview();
}
window.__stopAnimPreview = stopRigAnimPreview;

function toggleRigAnimPreview(){
  const R = window.__rigEditor;
  if (!animPreviewOn) { startRigAnimPreview(); return; }
  if (!R || !R.setAnimPlaying) return;
  const playing = R.isAnimPlaying ? R.isAnimPlaying() : true;
  R.setAnimPlaying(!playing);
  const btn = document.getElementById('paintBtnAnimPlay');
  if (btn) btn.textContent = playing ? '▶ Play' : '⏸ Pause';
}

function setAnimPreviewClip(name){
  const R = window.__rigEditor;
  if (!R || !name) return;
  if (R.setAnimClip) R.setAnimClip(name);
  const sel = document.getElementById('paintAnimClip');
  if (sel) sel.value = name;
  if (animPreviewOn) {
    if (R.setAnimPlaying) R.setAnimPlaying(true);
    const btn = document.getElementById('paintBtnAnimPlay');
    if (btn) btn.textContent = '⏸ Pause';
  }
}

function stepAnimPreview(dir){
  const sel = document.getElementById('paintAnimClip');
  if (!sel || sel.options.length < 1 || !sel.value) return;
  let i = sel.selectedIndex;
  i = (i + dir + sel.options.length) % sel.options.length;
  sel.selectedIndex = i;
  setAnimPreviewClip(sel.value);
}

function updateUI(){
  document.getElementById('paintInfoSize').textContent = paint_cv.width+'×'+paint_cv.height;
  document.getElementById('paintInfoLayers').textContent = layers.length;
  document.getElementById('paintBrushSizeVal').textContent = brushSize+'px';
  document.getElementById('paintLayerOpacityVal').textContent = Math.round((active!==null?layers[active].opacity:1)*100)+'%';
  document.getElementById('paintLayerOpacity').value = active!==null?Math.round(layers[active].opacity*100):100;
  syncCanvasScale();
  updateUndoButtons();
  renderLayers();
  switchPaintTab(viewTab);
}

function renderLayers(){
  const list = document.getElementById('paintLayerList');
  if(layers.length===0){
    list.innerHTML = '<div class="empty">No layers<br>Add one to start painting</div>';
    return;
  }
  list.innerHTML = '';
  layers.forEach((l,i)=>{
    const el = document.createElement('div');
    el.className = 'layer-item'+(i===active?' active':'' );
    el.onclick = (ev)=>{ if(!ev.target.closest('button,input,select')) setActive(i); };

    const vis = document.createElement('div');
    vis.className = 'layer-vis';
    vis.style.background = i===active ? color : '#33363f';
    el.appendChild(vis);

    const name = document.createElement('div');
    name.className = 'layer-name';
    name.textContent = l.name;
    el.appendChild(name);

    // one compact menu instead of four icons + an opacity slider per row
    const menuBtn = document.createElement('button');
    menuBtn.className = 'layer-menu-btn';
    menuBtn.title = 'Layer options';
    menuBtn.textContent = '⋮';
    menuBtn.onclick = (ev)=>{
      ev.stopPropagation();
      if (layerMenuIdx === i && layerMenu.classList.contains('open')) closeLayerMenu();
      else openLayerMenu(i, menuBtn);
    };
    el.appendChild(menuBtn);

    list.appendChild(el);
  });
  // keep an open menu pointing at the right row after a re-render
  if (layerMenuIdx >= 0 && layerMenuIdx < layers.length) {
    const a = list.children[layerMenuIdx] && list.children[layerMenuIdx].querySelector('.layer-menu-btn');
    if (a && layerMenu.classList.contains('open')) positionLayerMenu(a);
  } else if (layerMenuIdx >= 0) closeLayerMenu();
}

// ---------------------------------------------------------------- layer options menu
const layerMenu = (() => {
  const d = document.createElement('div');
  d.id = 'layerMenu';
  document.body.appendChild(d);
  return d;
})();
let layerMenuIdx = -1;

function closeLayerMenu(){ layerMenu.classList.remove('open'); layerMenuIdx = -1; }

function positionLayerMenu(anchor){
  const r = anchor.getBoundingClientRect();
  const mw = layerMenu.offsetWidth, mh = layerMenu.offsetHeight;
  let x = r.right - mw; if (x < 6) x = 6;
  let y = r.bottom + 4;
  if (y + mh > window.innerHeight - 6) y = r.top - mh - 4;
  layerMenu.style.left = x + 'px';
  layerMenu.style.top = Math.max(6, y) + 'px';
}

function openLayerMenu(i, anchor){
  const l = layers[i];
  if (!l) return;
  layerMenuIdx = i;
  layerMenu.innerHTML = '';

  const item = (label, fn, danger) => {
    const b = document.createElement('button');
    b.className = 'mi';
    b.textContent = label;
    if (danger) b.style.color = 'var(--bad, #ff6b6b)';
    b.onclick = (ev)=>{ ev.stopPropagation(); closeLayerMenu(); fn(); };
    layerMenu.appendChild(b);
  };

  item(l.visible ? '🙈 Hide layer' : '👁 Show layer', ()=>toggleVisibility(i));
  item('✎ Rename', ()=>renameLayer(i));
  item('📋 Duplicate', ()=>duplicateLayer(i));

  const sep = document.createElement('div'); sep.className = 'sep'; layerMenu.appendChild(sep);

  const op = document.createElement('div'); op.className = 'op';
  const lab = document.createElement('span'); lab.textContent = 'Opacity';
  const rng = document.createElement('input');
  rng.type = 'range'; rng.min = '0'; rng.max = '100'; rng.value = Math.round(l.opacity * 100);
  const val = document.createElement('span'); val.textContent = Math.round(l.opacity * 100) + '%';
  rng.onclick = (ev)=>ev.stopPropagation();
  rng.onpointerdown = ()=>pushPaintUndo();
  rng.oninput = (ev)=>{ val.textContent = ev.target.value + '%'; setOpacity(i, parseInt(ev.target.value) / 100); };
  op.append(lab, rng, val);
  layerMenu.appendChild(op);

  const sep2 = document.createElement('div'); sep2.className = 'sep'; layerMenu.appendChild(sep2);
  item('🗑 Delete layer', ()=>deleteLayer(i), true);

  layerMenu.classList.add('open');
  positionLayerMenu(anchor);
}

document.addEventListener('mousedown', (e)=>{
  if (!layerMenu.classList.contains('open')) return;
  if (layerMenu.contains(e.target) || (e.target.closest && e.target.closest('.layer-menu-btn'))) return;
  closeLayerMenu();
});
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeLayerMenu(); });
window.addEventListener('resize', closeLayerMenu);

function setActive(i){
  active = i;
  updateUI();
  composite();
}

function addLayer(name=null, silent=false){
  if(!silent) pushPaintUndo();
  const c = newLayerCanvas(paint_cv.width, paint_cv.height);
  layers.push({name:name||('Layer '+(layers.length+1)), canvas:c, visible:true, opacity:1});
  active = layers.length-1;
  dirty = true;
  updateUI(); composite();
  if(!silent) toast('Layer added');
}

function deleteLayer(idx=null){
  if(idx===null) idx = active;
  if(layers.length<=1){ toast('Cannot delete last layer'); return; }
  pushPaintUndo();
  layers.splice(idx,1);
  if(active>=layers.length) active = layers.length-1;
  if(active===null) active = 0;
  dirty = true;
  updateUI(); composite();
  toast('Layer deleted');
}

function duplicateLayer(idx){
  const l = layers[idx];
  if(!l) return;
  pushPaintUndo();
  const c = newLayerCanvas(paint_cv.width, paint_cv.height);
  c.getContext('2d').drawImage(l.canvas, 0, 0);
  const copy = {name:l.name+' copy', canvas:c, visible:l.visible, opacity:l.opacity};
  layers.splice(idx+1, 0, copy);
  active = idx+1;
  dirty = true;
  updateUI(); composite();
  toast('Layer duplicated');
}

function toggleVisibility(idx){
  if(!layers[idx]) return;
  pushPaintUndo();
  layers[idx].visible = !layers[idx].visible;
  dirty = true;
  composite(); updateUI();
}

function setOpacity(idx, val){
  layers[idx].opacity = val;
  dirty = true;
  composite(); updateUI();
}

function renameLayer(idx){
  if(!layers[idx]) return;
  const name = prompt('Rename layer:', layers[idx].name);
  if(name!==null){
    const nn = name.trim()||'Layer';
    if(nn!==layers[idx].name) pushPaintUndo();
    layers[idx].name = nn;
    dirty = true;
    updateUI();
  }
}

function setColor(c){
  color = c;
  document.getElementById('paintColorPick').value = c;
  updateUI(); composite();
}

function getCanvasPos(e){
  // the canvas bitmap is the real sprite; CSS only scales it, so map screen px -> canvas px
  const rect = paint_cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return {x:0, y:0};
  const x = (e.clientX - rect.left) * (paint_cv.width / rect.width);
  const y = (e.clientY - rect.top) * (paint_cv.height / rect.height);
  return {x:Math.floor(x), y:Math.floor(y)};
}

function paint(x,y){
  if(active===null) return;
  const g = layers[active].canvas.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if(tool==='pencil'){
    g.strokeStyle = color;
    g.lineWidth = brushSize;
    if(lastPos){
      g.beginPath(); g.moveTo(lastPos.x,lastPos.y); g.lineTo(x,y); g.stroke();
    } else {
      g.beginPath(); g.arc(x,y,brushSize/2,0,Math.PI*2); g.fill();
    }
  } else if(tool==='eraser'){
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = '#000';
    g.lineWidth = brushSize;
    if(lastPos){
      g.beginPath(); g.moveTo(lastPos.x,lastPos.y); g.lineTo(x,y); g.stroke();
    } else {
      g.clearRect(x-brushSize/2, y-brushSize/2, brushSize, brushSize);
    }
    g.globalCompositeOperation = 'source-over';
  } else if(tool==='fill'){
    floodFill(g, x, y, color);
  } else if(tool==='picker'){
    const px = g.getImageData(x,y,1,1).data;
    setColor('#'+px[0].toString(16).padStart(2,'0')+px[1].toString(16).padStart(2,'0')+px[2].toString(16).padStart(2,'0'));
  }
  dirty = true;
  composite();
  if (tool !== 'picker') scheduleAutoPush();
}

function floodFill(g, sx, sy, newColor){
  const w = g.canvas.width, h = g.canvas.height;
  const id = g.getImageData(0,0,w,h);
  const data = id.data;
  const get = (x,y)=>(y*w+x)*4;
  const target = [data[get(sx,sy)], data[get(sx,sy)+1], data[get(sx,sy)+2], data[get(sx,sy)+3]];
  const nc = hexToRgb(newColor);
  if(colorsEqual(target,nc)) return;
  const stack=[{x:sx,y:sy}];
  while(stack.length){
    const p = stack.pop();
    const idx = get(p.x,p.y);
    if(!colorsEqual([data[idx],data[idx+1],data[idx+2],data[idx+3]],target)) continue;
    data[idx]=nc.r; data[idx+1]=nc.g; data[idx+2]=nc.b;
    for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=p.x+d[0], ny=p.y+d[1];
      if(nx>=0&&nx<w&&ny>=0&&ny<h) stack.push({x:nx,y:ny});
    }
  }
  g.putImageData(id,0,0);
}

function hexToRgb(h){
  const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
  return {r,g,b,a:255};
}
function colorsEqual(a,b){ return a[0]===b.r&&a[1]===b.g&&a[2]===b.b&&a[3]===b.a; }

// Tab switching within paint editor
function switchPaintTab(tab){
  viewTab = tab;
  if (tab === 'export' && animPreviewOn) stopRigAnimPreview();
  // Update tab buttons
  ['paint','preview','export'].forEach(t=>{
    const btn = document.getElementById('paintTab'+t.charAt(0).toUpperCase()+t.slice(1));
    const active = t === tab;
    if(btn) btn.classList.toggle('on', active);
  });
  
  // Update visibility of main areas
  const paintArea = document.getElementById('viewport');
  const previewArea = document.getElementById('previewWrap').parentElement;
  
  if(tab === 'paint'){
    paintArea.style.display = 'block';
    previewArea.style.display = 'block';   // keep the live preview on the right while painting
    syncCanvasScale();
    updatePreview();
    document.getElementById('paintCv').focus();
  } else if(tab === 'preview'){
    paintArea.style.display = 'none';
    previewArea.style.display = 'block';
    updatePreview();
  } else if(tab === 'export'){
    paintArea.style.display = 'block';
    previewArea.style.display = 'block';
    syncCanvasScale();
  }
}

paint_cv.addEventListener('mousedown', e=>{
  if(e.button!==0||active===null) return;
  pushPaintUndo();                 // one snapshot per stroke
  isDown = true;
  lastPos = getCanvasPos(e);
  paint(lastPos.x, lastPos.y);
  paint_wrap.classList.add('painting');
});
window.addEventListener('mouseup', e=>{
  if(!isDown) return;
  isDown = false;
  lastPos = null;
  paint_wrap.classList.remove('painting');
});
paint_cv.addEventListener('mousemove', e=>{
  if(!isDown) return;
  const pos = getCanvasPos(e);
  paint(pos.x, pos.y);
  lastPos = pos;
});
paint_cv.addEventListener('mousemove', e=>{
  const pos = getCanvasPos(e);
  paint_coord.textContent = pos.x+', '+pos.y;
});
paint_wrap.addEventListener('wheel', e=>{
  e.preventDefault();
  const delta = -e.deltaY * 0.001;
  autoFit = false;
  zoom = Math.min(Math.max(zoom*(1+delta), 0.1), 32);
  syncCanvasScale();
}, {passive:false});

document.getElementById('paintToolSel').onchange = e=>{ tool = e.target.value; };
document.getElementById('paintBrushSize').oninput = e=>{
  brushSize = parseInt(e.target.value);
  document.getElementById('paintBrushSizeVal').textContent = brushSize+'px';
};
document.getElementById('paintColorPick').oninput = e=>setColor(e.target.value);
document.getElementById('paintBlendMode').onchange = e=>{
  paint_ctx.globalCompositeOperation = e.target.value;
  paint_pctx.globalCompositeOperation = e.target.value;
  composite();
};
document.getElementById('paintLayerOpacity').oninput = e=>{
  const val = parseInt(e.target.value)/100;
  document.getElementById('paintLayerOpacityVal').textContent = Math.round(val*100)+'%';
  if(active!==null) setOpacity(active, val);
};

document.getElementById('paintBtnNew').onclick = ()=>{
  if(confirm('New sprite will clear all layers. Continue?')){
    pushPaintUndo();
    layers = []; active = null; zoom = 1; pan = {x:0,y:0};
    paint_cv.width = 256; paint_cv.height = 256;
    autoFit = true;
    updateUI(); composite();
    toast('New sprite');
  }
};
document.getElementById('paintBtnOpen').onclick = ()=>document.getElementById('paintFileOpen').click();
document.getElementById('paintFileOpen').onchange = async e=>{
  const f = e.target.files[0]; if(!f) return;
  const img = await loadImage(f);
  pushPaintUndo();
  paint_cv.width = img.width; paint_cv.height = img.height;
  layers = [{name:f.name.replace(/\.[^/.]+$/,''), canvas:img, visible:true, opacity:1}];
  active = 0;
  zoom = 1; pan = {x:0,y:0};
  autoFit = true;
  dirty = true;
  updateUI(); composite();
  toast('Opened '+f.name);
};
document.getElementById('paintBtnSave').onclick = ()=>{
  const link = document.createElement('a');
  link.download = 'sprite.png';
  link.href = paint_cv.toDataURL('image/png');
  link.click();
  toast('Exported sprite.png');
};
document.getElementById('paintBtnAddLayer').onclick = addLayer;
document.getElementById('paintBtnDelLayer').onclick = ()=>deleteLayer(null);
document.getElementById('paintToolZoomIn').onclick = ()=>{ autoFit=false; zoom=Math.min(zoom+0.25,32); syncCanvasScale(); };
document.getElementById('paintToolZoomOut').onclick = ()=>{ autoFit=false; zoom=Math.max(zoom-0.25,0.1); syncCanvasScale(); };
document.getElementById('paintToolFit').onclick = ()=>{ resetPaintView(); };
document.getElementById('paintPreviewScale').oninput = e=>{
  document.getElementById('paintPreviewScaleVal').textContent = e.target.value+'x';
  updatePreview();
};

// undo / redo
document.getElementById('paintBtnUndo').onclick = undoPaint;
document.getElementById('paintBtnRedo').onclick = redoPaint;
document.addEventListener('keydown', (e)=>{
  if (document.body.dataset.mode !== 'paint') return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoPaint(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoPaint(); }
});
document.getElementById('paintLayerOpacity').addEventListener('pointerdown', ()=>pushPaintUndo());

// animated rig preview
document.getElementById('paintBtnAnimPlay').onclick = toggleRigAnimPreview;
document.getElementById('paintBtnAnimPrev').onclick = ()=>stepAnimPreview(-1);
document.getElementById('paintBtnAnimNext').onclick = ()=>stepAnimPreview(1);
document.getElementById('paintAnimClip').onchange = e=>setAnimPreviewClip(e.target.value);
document.getElementById('paintBtnFlipH').onclick = ()=>{
  if(active===null) return;
  pushPaintUndo();
  const g = layers[active].canvas.getContext('2d');
  const id = g.getImageData(0,0,paint_cv.width,paint_cv.height);
  g.clearRect(0,0,paint_cv.width,paint_cv.height);
  for(let y=0;y<paint_cv.height;y++) for(let x=0;x<paint_cv.width;x++){
    const src = (y*paint_cv.width+x)*4;
    const dst = (y*paint_cv.width+(paint_cv.width-1-x))*4;
    id.data[dst]=id.data[src]; id.data[dst+1]=id.data[src+1]; id.data[dst+2]=id.data[src+2]; id.data[dst+3]=id.data[src+3];
  }
  g.putImageData(id,0,0);
  dirty = true; composite(); scheduleAutoPush(); toast('Flipped horizontal');
};
document.getElementById('paintBtnFlipV').onclick = ()=>{
  if(active===null) return;
  pushPaintUndo();
  const g = layers[active].canvas.getContext('2d');
  const id = g.getImageData(0,0,paint_cv.width,paint_cv.height);
  g.clearRect(0,0,paint_cv.width,paint_cv.height);
  for(let y=0;y<paint_cv.height;y++) for(let x=0;x<paint_cv.width;x++){
    const src = (y*paint_cv.width+x)*4;
    const dst = ((paint_cv.height-1-y)*paint_cv.width+x)*4;
    id.data[dst]=id.data[src]; id.data[dst+1]=id.data[src+1]; id.data[dst+2]=id.data[src+2]; id.data[dst+3]=id.data[src+3];
  }
  g.putImageData(id,0,0);
  dirty = true; composite(); scheduleAutoPush(); toast('Flipped vertical');
};
document.getElementById('paintBtnRotate').onclick = ()=>{
  if(active===null) return;
  pushPaintUndo();
  const c = layers[active].canvas;
  const tmp = document.createElement('canvas');
  tmp.width = c.height; tmp.height = c.width;
  const tg = tmp.getContext('2d');
  tg.translate(c.height/2, c.width/2);
  tg.rotate(Math.PI/2);
  tg.drawImage(c, -c.width/2, -c.height/2);
  layers[active].canvas = tmp;
  paint_cv.width = tmp.width; paint_cv.height = tmp.height;
  autoFit = true;
  dirty = true; composite(); scheduleAutoPush(); toast('Rotated 90°');
};

function loadImage(file){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img,0,0);
      res(c);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// Tab button handlers
document.getElementById('paintTabPaint').onclick = ()=>{ previewMode = 'paint'; switchPaintTab('paint'); };
document.getElementById('paintTabPreview').onclick = ()=>{ previewMode = 'paint'; switchPaintTab('preview'); };
document.getElementById('paintTabExport').onclick = ()=>{ previewMode = 'paint'; switchPaintTab('export'); };

addLayer(null, true);
restorePaintContext();
populateAnimClips();
updateUI(); composite();



// ============================================================================
// Rig <-> Paint bridge
// The rig editor lives in its own closure, so everything here goes through the
// small API it publishes on window.__rigEditor (layerById / layersForPaint /
// setLayerPixels / snapshot / redraw / toastMsg).
// ============================================================================
const rigAPI = () => window.__rigEditor || null;

function rigBridgeStatus(msg) {
  const el = document.getElementById('rigIntegrationStatus');
  if (el) el.textContent = msg || '';
}

function isBlankCanvas(c) {
  try {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  } catch (e) { return false; }
}

function paintCanvasIsBlank() {
  return layers.length === 0 || (layers.length === 1 && !layers[0].rigLayerId && isBlankCanvas(layers[0].canvas));
}

// The paint canvas is the sprite canvas: it must match the rig document or
// nothing lines up when pushing back. Only resize while there is nothing worth keeping.
function fitPaintToRig(doc) {
  if (paint_cv.width === doc.width && paint_cv.height === doc.height) return true;
  if (!paintCanvasIsBlank()) {
    toast('Paint canvas is ' + paint_cv.width + 'x' + paint_cv.height + ' but the rig is ' + doc.width + 'x' + doc.height + '. Press New first, then import again.', 8000);
    return false;
  }
  paint_cv.width = doc.width;
  paint_cv.height = doc.height;
  layers = []; active = null; zoom = 1; pan = { x: 0, y: 0 };
  autoFit = true;
  return true;
}

function makePaintLayer(l) {
  const c = newLayerCanvas(paint_cv.width, paint_cv.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(l.rgba), l.w, l.h), l.x, l.y);
  return { name: l.name || 'Rig Layer', canvas: c, visible: true, opacity: 1,
    rigLayerId: l.id, rigX: l.x, rigY: l.y, rigW: l.w, rigH: l.h };
}

// Import one rig layer (double-click in the rig layer list) or all of them.
function importRigLayer(layerId) {
  const R = rigAPI(), doc = R && R.doc;
  if (!doc) { toast('Open a rig first'); return; }
  const l = R.layerById(layerId);
  if (!l) { toast('Layer not found in the rig'); return; }
  if (!fitPaintToRig(doc)) return;
  if (paintCanvasIsBlank()) { layers = []; active = null; }
  pushPaintUndo();
  const idx = layers.findIndex(p => p.rigLayerId === layerId);
  const pl = makePaintLayer(l);
  if (idx >= 0) layers[idx] = pl; else layers.push(pl);
  active = idx >= 0 ? idx : layers.length - 1;
  dirty = true;
  populateAnimClips();
  updateUI(); composite();
  rigBridgeStatus('Imported "' + pl.name + '" (' + l.w + 'x' + l.h + ')');
  toast('Imported rig layer: ' + pl.name);
}

function importAllRigAssets() {
  const R = rigAPI(), doc = R && R.doc;
  if (!doc) { toast('Open a rig first'); return; }
  const flat = R.layersForPaint();
  if (!flat.length) { toast('The rig has no layers to import'); return; }
  if (!fitPaintToRig(doc)) return;
  if (paintCanvasIsBlank()) { layers = []; active = null; }
  pushPaintUndo();
  let n = 0;
  for (const l of flat) {
    const idx = layers.findIndex(p => p.rigLayerId === l.id);
    const pl = makePaintLayer(l);
    if (idx >= 0) layers[idx] = pl; else layers.push(pl);
    n++;
  }
  active = layers.length - 1;
  dirty = true;
  populateAnimClips();
  updateUI(); composite();
  rigBridgeStatus('Imported ' + n + ' rig layer(s) at ' + paint_cv.width + 'x' + paint_cv.height);
  toast('Imported ' + n + ' rig layer(s)');
}

function pushPaintToRig() {
  const R = window.__rigEditor, doc = R && R.doc;
  if (!doc) { toast('Open a rig first'); return; }
  if (paint_cv.width !== doc.width || paint_cv.height !== doc.height) {
    toast('Paint canvas (' + paint_cv.width + 'x' + paint_cv.height + ') does not match the rig (' + doc.width + 'x' + doc.height + '). Import the rig assets first.', 8000);
    return;
  }
  if (!layers.some(p => p.rigLayerId)) { toast('Nothing to push: import the rig assets first'); return; }
  const n = autoPushNow();
  toast(n ? 'Pushed ' + n + ' layer(s) to the rig' : 'Could not push: layer sizes do not match', n ? 2500 : 7000);
}

// Show the rig itself on the paint Preview tab.
function renderRigPreview() {
  const R = rigAPI();
  if (!R || !R.doc) { toast('Open a rig first'); return; }
  if (animPreviewOn) stopRigAnimPreview();
  lastAnimShot = null; lastAnimCrop = null;
  rigShot = R.snapshot();
  previewMode = 'rig';
  switchPaintTab('preview');
  updatePreview();
  rigBridgeStatus('Previewing the rig');
}

function initRigIntegration() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('paintBtnImportRig', importAllRigAssets);
  on('paintBtnPushRig', pushPaintToRig);
  on('paintBtnRigPreview', renderRigPreview);
}

initRigIntegration();
