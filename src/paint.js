/* ===== Sprite Paint Editor script ===== */

/*============================================================
  Sprite Paint Editor — self-contained
  Tools: pencil, opaque pixel brush, eraser, fill, color picker
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
let activeWorkspaceId = null;
let layerIsolationOpacities = null;
let isolatedLayer = null;
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
let previewPan = { x: 0, y: 0 };
let previewRenderTransform = null;
let previewPointer = null;

const paint_quickColors = [
  '#e0475b','#ff6b6b','#ff9f43','#ffd166','#f7f779','#4cc38a','#00b894','#00cec9',
  '#54a0ff','#2e86de','#8f5bff','#c56cf0','#ffffff','#c8c8d0','#777780','#33363f','#111216','#000000'
];
const paintRecentColors = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('spritePaintRecentColors') || '[]');
    return Array.isArray(saved) ? saved.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8) : [];
  } catch (e) { return []; }
})();

function renderColorSwatches(containerId, colors, emptyText=''){
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  if (!colors.length && emptyText) {
    const note = document.createElement('span');
    note.className = 'muted';
    note.style.fontSize = '10px';
    note.textContent = emptyText;
    container.appendChild(note);
    return;
  }
  colors.forEach(c => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch' + (c.toLowerCase() === color.toLowerCase() ? ' active' : '');
    swatch.style.background = c;
    swatch.title = c.toUpperCase();
    swatch.setAttribute('aria-label', 'Use color ' + c.toUpperCase());
    swatch.setAttribute('aria-pressed', String(c.toLowerCase() === color.toLowerCase()));
    swatch.onclick = () => setColor(c);
    container.appendChild(swatch);
  });
}

function renderColorPalettes(){
  renderColorSwatches('paintQuickColors', paint_quickColors);
  renderColorSwatches('paintRecentColors', paintRecentColors, 'Colors you pick will appear here');
}

// Context preservation across mode switches
const paintContext = {
  saved: false,
  layers: null,
  active: null,
  workspaceId: null,
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
  paintContext.workspaceId = activeWorkspaceId;
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
  activeWorkspaceId = paintContext.workspaceId || null;
  zoom = paintContext.zoom;
  pan = {x:paintContext.pan.x, y:paintContext.pan.y};
  tool = paintContext.tool;
  brushSize = paintContext.brushSize;
  color = paintContext.color;
  viewTab = paintContext.viewTab;
  setPaintTool(tool, false);
  document.getElementById('paintBrushSize').value = brushSize;
  document.getElementById('paintBrushSizeVal').textContent = brushSize+'px';
  document.getElementById('paintColorPick').value = color;
  document.getElementById('paintColorValue').textContent = color.toUpperCase();
  renderColorPalettes();
  switchPaintTab(viewTab);
  dirty = true;
  updateUI(); composite();
  scheduleAutoPush();
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
  paint_ctx.globalCompositeOperation = 'source-over';
  paint_ctx.clearRect(0, 0, paint_cv.width, paint_cv.height);
  layers.forEach(l=>{
    if (activeWorkspaceId ? l.assetWorkspaceId !== activeWorkspaceId : !!l.assetWorkspaceId) return;
    paint_ctx.globalCompositeOperation = blendOperation(l.blendMode);
    paint_ctx.globalAlpha = l.opacity;
    if(l.visible) paint_ctx.drawImage(l.canvas, 0, 0);
  });
  paint_ctx.globalAlpha = 1;
  paint_ctx.globalCompositeOperation = 'source-over';
  updatePreview();
}

function blendOperation(mode){
  return mode === 'normal' || !mode ? 'source-over' : mode;
}

function updatePreview(){
  if (previewMode === 'rig' && (animPreviewOn || lastAnimShot)) { drawAnimPreview(lastAnimShot, lastAnimCrop); return; }
  const zoomLevel = parseFloat(document.getElementById('paintPreviewScale').value) || 1;
  document.getElementById('paintPreviewScaleVal').textContent = zoomLevel.toFixed(1)+'x';
  paint_pctx.clearRect(0,0,paint_preview.width,paint_preview.height);
  if (previewMode === 'rig' && rigShot) {
    const fitScale = Math.min(paint_preview.width / rigShot.width, paint_preview.height / rigShot.height);
    const scale = fitScale * zoomLevel;
    const baseX = (paint_preview.width - rigShot.width * fitScale) / 2;
    const baseY = (paint_preview.height - rigShot.height * fitScale) / 2;
    const offsetX = baseX + previewPan.x, offsetY = baseY + previewPan.y;
    previewRenderTransform = { kind: 'rig', scale, fitScale, baseX, baseY, offsetX, offsetY,
      rig: rigShot.rigTransform || null };
    paint_pctx.imageSmoothingEnabled = false;
    paint_pctx.drawImage(rigShot, offsetX, offsetY, rigShot.width * scale, rigShot.height * scale);
    drawPreviewEditingLayer();
    return;
  }
  paint_pctx.save();
  const pw = paint_preview.width, ph = paint_preview.height;
  const lw = paint_cv.width, lh = paint_cv.height;
  const fit = Math.min(pw/lw, ph/lh);
  const previewScale = fit * zoomLevel;
  const baseX = (pw - lw*fit)/2, baseY = (ph - lh*fit)/2;
  const offsetX = baseX + previewPan.x, offsetY = baseY + previewPan.y;
  previewRenderTransform = { kind: 'paint', scale: previewScale, fitScale: fit, baseX, baseY, offsetX, offsetY };
  paint_pctx.translate(offsetX, offsetY);
  paint_pctx.scale(previewScale, previewScale);
  layers.forEach(l=>{
    if (activeWorkspaceId ? l.assetWorkspaceId !== activeWorkspaceId : !!l.assetWorkspaceId) return;
    paint_pctx.globalCompositeOperation = blendOperation(l.blendMode);
    paint_pctx.globalAlpha = l.opacity;
    if(l.visible) paint_pctx.drawImage(l.canvas, 0, 0);
  });
  paint_pctx.globalAlpha = 1;
  paint_pctx.globalCompositeOperation = 'source-over';
  paint_pctx.restore();
}

function drawPreviewEditingLayer(){
  const onTop = document.getElementById('paintPreviewOnTop').checked;
  const layer = active === null ? null : layers[active];
  const t = previewRenderTransform;
  if (!onTop || !layer || !layer.visible || !t || !t.rig) return;
  const opacity = parseInt(document.getElementById('paintPreviewOpacity').value, 10) / 100;
  const transform = t.rig;
  paint_pctx.save();
  paint_pctx.setTransform(t.scale * transform.scale, 0, 0, t.scale * transform.scale,
    t.offsetX + t.scale * (transform.x - (t.sourceX || 0)),
    t.offsetY + t.scale * (transform.y - (t.sourceY || 0)));
  paint_pctx.globalAlpha = opacity;
  paint_pctx.globalCompositeOperation = 'source-over';
  paint_pctx.imageSmoothingEnabled = false;
  paint_pctx.drawImage(layer.canvas, 0, 0);
  paint_pctx.restore();
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
window.__paintModeShown = ()=>{ populateAnimClips(); populateImageAssets(); syncCanvasScale(); };

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
  return { layers: clonePaintLayers(layers), active, w: paint_cv.width, h: paint_cv.height,
    workspaceId: activeWorkspaceId, layerIsolationOpacities: layerIsolationOpacities && [...layerIsolationOpacities], isolatedLayer };
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
  activeWorkspaceId = s.workspaceId || null;
  active = (s.active === null || s.active === undefined || !layers.length)
    ? (layers.length ? 0 : null)
    : Math.min(s.active, layers.length - 1);
  layerIsolationOpacities = s.layerIsolationOpacities ? [...s.layerIsolationOpacities] : null;
  isolatedLayer = layerIsolationOpacities && s.isolatedLayer < layers.length ? s.isolatedLayer : null;
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

function rigPushTargets(workspaceId=activeWorkspaceId){
  const R = window.__rigEditor, doc = R && R.doc;
  if (!doc) return null;
  const targets = workspaceId ? [] : layers.filter(p => p.rigLayerId);
  const assetLayers = workspaceId ? layers.filter(p => p.assetWorkspaceId === workspaceId && p.assetBase) : [];
  return targets.length || assetLayers.length ? { R, doc, targets, assetLayers, assetWorkspaceId: workspaceId } : null;
}

function scheduleAutoPush(){
  if (restoringPaint) return;
  const workspaceId = activeWorkspaceId;
  if (!rigPushTargets(workspaceId)) return;
  clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(() => autoPushNow(workspaceId), 250);
}

function opaqueBounds(canvas){
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < minX ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function autoPushNow(workspaceId=activeWorkspaceId){
  clearTimeout(autoPushTimer);
  const g = rigPushTargets(workspaceId);
  if (!g) return 0;
  let pushed = 0, failed = 0;
  for (const p of g.targets) {
    const l = g.R.layerById(p.rigLayerId);
    if (!l || !p.canvas) { failed++; continue; }
    let sx = Math.round(l.x), sy = Math.round(l.y), sw = l.w, sh = l.h;
    if (p.needsExpand) {
      try {
        const bounds = opaqueBounds(p.canvas);
        if (bounds) {
          const right = Math.max(sx + sw, bounds.x + bounds.w);
          const bottom = Math.max(sy + sh, bounds.y + bounds.h);
          sx = Math.min(sx, bounds.x); sy = Math.min(sy, bounds.y);
          sw = right - sx; sh = bottom - sy;
        }
        p.needsExpand = false;
      } catch (e) { failed++; continue; }
    }
    let data;
    try { data = p.canvas.getContext('2d').getImageData(sx, sy, sw, sh).data; }
    catch (e) { failed++; continue; }
    const bounds = sx === l.x && sy === l.y && sw === l.w && sh === l.h ? null : { x: sx, y: sy, w: sw, h: sh };
    if (g.R.setLayerPixels(l.id, data, bounds)) {
      p.rigX = sx; p.rigY = sy; p.rigW = sw; p.rigH = sh;
      pushed++;
    } else failed++;
  }
  if (g.assetLayers.length) {
    const base = g.assetLayers[0];
    const canvas = newLayerCanvas(base.canvas.width, base.canvas.height);
    const ctx = canvas.getContext('2d');
    for (const p of layers) {
      if (p.assetWorkspaceId !== g.assetWorkspaceId || !p.visible) continue;
      ctx.globalCompositeOperation = blendOperation(p.blendMode);
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(p.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    if (g.R.setImageAssetPixels(g.assetWorkspaceId, canvas.width, canvas.height, pixels)) pushed++;
    else failed++;
  }
  if (pushed) g.R.redraw();
  rigBridgeStatus('Auto-synced ' + pushed + ' image' + (pushed === 1 ? '' : 's') + (failed ? '  (' + failed + ' skipped)' : ''));
  if (previewMode === 'rig' && !animPreviewOn) {
    refreshRigPreview();
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
  const zoomLevel = parseFloat(document.getElementById('paintPreviewScale').value) || 1;
  document.getElementById('paintPreviewScaleVal').textContent = zoomLevel.toFixed(1)+'x';
  const fitScale = Math.min(paint_preview.width / src.w, paint_preview.height / src.h);
  const scale = fitScale * zoomLevel;
  const baseX = (paint_preview.width - src.w * fitScale) / 2;
  const baseY = (paint_preview.height - src.h * fitScale) / 2;
  const offsetX = baseX + previewPan.x, offsetY = baseY + previewPan.y;
  previewRenderTransform = { kind: 'rig', scale, fitScale, baseX, baseY, offsetX, offsetY,
    sourceX: src.x, sourceY: src.y, rig: shot.rigTransform || null };
  paint_pctx.imageSmoothingEnabled = false;
  paint_pctx.drawImage(shot, src.x, src.y, src.w, src.h,
    offsetX, offsetY, src.w * scale, src.h * scale);
  if (!animPreviewOn) drawPreviewEditingLayer();
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

function stopRigAnimPreview(refreshRig=true){
  animPreviewOn = false;
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = 0; }
  const R = window.__rigEditor;
  if (R && R.stopAnim) R.stopAnim();
  const btn = document.getElementById('paintBtnAnimPlay');
  if (btn) btn.textContent = '▶ Play';
  if (previewMode === 'rig') {
    lastAnimShot = null; lastAnimCrop = null;
    if (refreshRig) refreshRigPreview();
    else updatePreview();
  } else updatePreview();
}
window.__stopAnimPreview = ()=>stopRigAnimPreview(false);

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
  document.getElementById('paintInfoLayers').textContent = layers.filter(l =>
    activeWorkspaceId ? l.assetWorkspaceId === activeWorkspaceId : !l.assetWorkspaceId).length;
  document.getElementById('paintBrushSizeVal').textContent = brushSize+'px';
  const activeLayer = active!==null ? layers[active] : null;
  const opacity = activeLayer ? Math.round(activeLayer.opacity*100) : 100;
  document.getElementById('paintActiveLayerName').textContent = activeLayer ? activeLayer.name : 'No layer selected';
  document.getElementById('paintActiveLayerOpacity').value = opacity;
  document.getElementById('paintActiveLayerOpacity').disabled = !activeLayer;
  document.getElementById('paintActiveLayerOpacityVal').textContent = opacity+'%';
  document.getElementById('paintLayerOpacityVal').textContent = opacity+'%';
  document.getElementById('paintLayerOpacity').value = opacity;
  document.getElementById('paintLayerOpacity').disabled = !activeLayer;
  document.getElementById('paintBlendMode').value = active!==null ? (layers[active].blendMode || 'normal') : 'normal';
  syncCanvasScale();
  updateUndoButtons();
  renderLayers();
  switchPaintTab(viewTab);
}

function renderLayers(){
  const list = document.getElementById('paintLayerList');
  const query = document.getElementById('paintLayerFilter').value.trim().toLocaleLowerCase();
  if(layers.length===0){
    list.innerHTML = '<div class="empty">No layers<br>Add one to start painting</div>';
    return;
  }
  list.innerHTML = '';
  const matches = layers.map((layer, index)=>({ layer, index }))
    .filter(({ layer })=>layer.name.toLocaleLowerCase().includes(query));
  if (!matches.length) {
    list.innerHTML = '<div class="empty">No paint layers match.</div>';
    return;
  }
  matches.forEach(({ layer: l, index: i })=>{
    const el = document.createElement('div');
    el.className = 'layer-item'+(i===active?' active':'' );
    el.dataset.layerIndex = i;
    el.onclick = (ev)=>{ if(!ev.target.closest('button,input,select')) setActive(i); };
    el.ondblclick = (ev)=>{
      if(ev.target.closest('button,input,select')) return;
      ev.preventDefault();
      isolateLayer(i);
    };
    el.title = 'Click to select; double-click to isolate this layer; double-click again to restore';

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
    const row = list.querySelector('[data-layer-index="'+layerMenuIdx+'"]');
    const a = row && row.querySelector('.layer-menu-btn');
    if (a && layerMenu.classList.contains('open')) positionLayerMenu(a);
    else if (layerMenu.classList.contains('open')) closeLayerMenu();
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
  if (!layers[i]) return;
  const workspaceId = layers[i].assetWorkspaceId || null;
  if (workspaceId !== activeWorkspaceId) restoreLayerIsolation();
  active = i;
  activeWorkspaceId = workspaceId;
  const R = rigAPI(), doc = R && R.doc;
  const useLayerCanvas = !!workspaceId || !layers[i].rigLayerId;
  const w = useLayerCanvas ? layers[i].canvas.width : doc ? doc.width : layers[i].canvas.width;
  const h = useLayerCanvas ? layers[i].canvas.height : doc ? doc.height : layers[i].canvas.height;
  if (paint_cv.width !== w || paint_cv.height !== h) {
    paint_cv.width = w; paint_cv.height = h; autoFit = true;
  }
  if (workspaceId) {
    previewMode = 'paint';
    rigShot = null;
  }
  if (previewMode === 'rig') refreshRigPreview();
  const layerAside = document.querySelector('#panelPaint main>aside:not(.right)');
  const layerScrollTop = layerAside ? layerAside.scrollTop : 0;
  updateUI();
  if (layerAside) layerAside.scrollTop = layerScrollTop;
  composite();
}

function restoreLayerIsolation(){
  if (!layerIsolationOpacities) return;
  layers.forEach((layer, i)=>{
    if (layerIsolationOpacities[i] !== undefined) layer.opacity = layerIsolationOpacities[i];
  });
  layerIsolationOpacities = null;
  isolatedLayer = null;
}

function similarLayerName(name){
  return String(name).normalize('NFKD').replace(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\b(copy|duplicate|layer|front|back|near|far|left|right|l|r|experiment|disfigured|healed|mouth|mini|jaw|open|half|closed|scared|panic|sad|happy|look|gone)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function applyLayerIsolation(){
  if (!layerIsolationOpacities || isolatedLayer === null || !layers[isolatedLayer]) return;
  const activeName = similarLayerName(layers[isolatedLayer].name);
  const workspaceId = layers[isolatedLayer].assetWorkspaceId || null;
  const hideSimilar = document.getElementById('paintHideSimilarLayers').checked && activeName;
  layers.forEach((layer, index)=>{
    if ((layer.assetWorkspaceId || null) !== workspaceId) return;
    if (index === isolatedLayer) {
      layer.opacity = layerIsolationOpacities[index];
      return;
    }
    const sameName = hideSimilar && similarLayerName(layer.name) === activeName;
    layer.opacity = sameName ? 0 : 0.05;
  });
}

function isolateLayer(i){
  if (!layers[i]) return;
  pushPaintUndo();
  if (layerIsolationOpacities && isolatedLayer === i) {
    restoreLayerIsolation();
  } else {
    if (!layerIsolationOpacities) layerIsolationOpacities = layers.map(layer=>layer.opacity);
    isolatedLayer = i;
    applyLayerIsolation();
  }
  active = i;
  dirty = true;
  if (previewMode === 'rig') refreshRigPreview();
  updateUI();
  composite();
  toast(layerIsolationOpacities ? 'Layer isolated; double-click again to restore other opacities' : 'Layer opacities restored');
}

function addLayer(name=null, silent=false){
  if(!silent) pushPaintUndo();
  restoreLayerIsolation();
  const c = newLayerCanvas(paint_cv.width, paint_cv.height);
  layers.push({name:name||('Layer '+(layers.length+1)), canvas:c, visible:true, opacity:1, blendMode:'normal',
    ...(activeWorkspaceId ? { assetWorkspaceId: activeWorkspaceId } : {})});
  active = layers.length-1;
  dirty = true;
  if (previewMode === 'rig') refreshRigPreview();
  updateUI(); composite();
  scheduleAutoPush();
  if(!silent) toast('Layer added');
}

function deleteLayer(idx=null){
  if(idx===null) idx = active;
  const workspaceId = layers[idx] && layers[idx].assetWorkspaceId;
  const workspaceCount = layers.filter(l => (l.assetWorkspaceId || null) === (workspaceId || null)).length;
  if(workspaceCount<=1){ toast('Cannot delete the last layer in this image'); return; }
  pushPaintUndo();
  restoreLayerIsolation();
  layers.splice(idx,1);
  if(active>=layers.length) active = layers.length-1;
  if(active===null) active = 0;
  if (layers[active]) setActive(active);
  dirty = true;
  if (previewMode === 'rig') refreshRigPreview();
  updateUI(); composite();
  scheduleAutoPush();
  toast('Layer deleted');
}

function duplicateLayer(idx){
  const l = layers[idx];
  if(!l) return;
  pushPaintUndo();
  restoreLayerIsolation();
  const c = newLayerCanvas(l.canvas.width, l.canvas.height);
  c.getContext('2d').drawImage(l.canvas, 0, 0);
  const copy = {name:l.name+' copy', canvas:c, visible:l.visible, opacity:l.opacity, blendMode:l.blendMode || 'normal',
    ...(l.assetWorkspaceId ? { assetWorkspaceId: l.assetWorkspaceId } : {})};
  layers.splice(idx+1, 0, copy);
  active = idx+1;
  dirty = true;
  if (previewMode === 'rig') refreshRigPreview();
  updateUI(); composite();
  scheduleAutoPush();
  toast('Layer duplicated');
}

function toggleVisibility(idx){
  if(!layers[idx]) return;
  pushPaintUndo();
  layers[idx].visible = !layers[idx].visible;
  dirty = true;
  if (previewMode === 'rig') refreshRigPreview();
  composite(); updateUI();
  scheduleAutoPush();
}

function setOpacity(idx, val){
  restoreLayerIsolation();
  layers[idx].opacity = val;
  dirty = true;
  composite(); updateUI();
  scheduleAutoPush();
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

function setColor(c, remember=true){
  if (!/^#[0-9a-f]{6}$/i.test(c)) return;
  color = c.toLowerCase();
  document.getElementById('paintColorPick').value = color;
  document.getElementById('paintColorValue').textContent = color.toUpperCase();
  if (remember) {
    const previous = paintRecentColors.indexOf(color);
    if (previous >= 0) paintRecentColors.splice(previous, 1);
    paintRecentColors.unshift(color);
    paintRecentColors.splice(8);
    try { localStorage.setItem('spritePaintRecentColors', JSON.stringify(paintRecentColors)); } catch (e) {}
  }
  renderColorPalettes();
  updateUI(); composite();
}

function setPaintTool(nextTool, resetPixelSize=true){
  if (!['pencil','pixel','pixel-eraser','eraser','fill','picker'].includes(nextTool)) return;
  tool = nextTool;
  document.querySelectorAll('#paintToolButtons [data-paint-tool]').forEach(button => {
    const selected = button.dataset.paintTool === tool;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (resetPixelSize && (tool === 'pixel' || tool === 'pixel-eraser')) {
    brushSize = 1;
    document.getElementById('paintBrushSize').value = '1';
    document.getElementById('paintBrushSizeVal').textContent = '1px';
  }
}

function getCanvasPos(e){
  // the canvas bitmap is the real sprite; CSS only scales it, so map screen px -> canvas px
  const rect = paint_cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return {x:0, y:0};
  const x = (e.clientX - rect.left) * (paint_cv.width / rect.width);
  const y = (e.clientY - rect.top) * (paint_cv.height / rect.height);
  return {x:Math.floor(x), y:Math.floor(y)};
}

function paintPixelLine(g, from, to, erase=false){
  const dx = to.x - from.x, dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const leftOffset = Math.floor(brushSize / 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  g.fillStyle = erase ? '#000' : color;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(from.x + dx * i / steps);
    const y = Math.round(from.y + dy * i / steps);
    g.fillRect(x - leftOffset, y - leftOffset, brushSize, brushSize);
  }
  g.globalCompositeOperation = 'source-over';
}

function paint(x,y){
  if(active===null) return;
  const g = layers[active].canvas.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if(tool==='pencil'){
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = brushSize;
    if(lastPos){
      g.beginPath(); g.moveTo(lastPos.x,lastPos.y); g.lineTo(x,y); g.stroke();
    } else {
      g.beginPath(); g.arc(x,y,brushSize/2,0,Math.PI*2); g.fill();
    }
  } else if(tool==='pixel'){
    paintPixelLine(g, lastPos || {x,y}, {x,y});
  } else if(tool==='pixel-eraser'){
    paintPixelLine(g, lastPos || {x,y}, {x,y}, true);
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
  if (active !== null && layers[active].rigLayerId) {
    const p = layers[active];
    if (tool === 'fill' || ((tool === 'pencil' || tool === 'pixel') && (x - brushSize / 2 < p.rigX || y - brushSize / 2 < p.rigY ||
        x + brushSize / 2 > p.rigX + p.rigW || y + brushSize / 2 > p.rigY + p.rigH))) p.needsExpand = true;
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
  const target = { r:data[get(sx,sy)], g:data[get(sx,sy)+1], b:data[get(sx,sy)+2], a:data[get(sx,sy)+3] };
  const nc = hexToRgb(newColor);
  if(colorsEqual([target.r,target.g,target.b,target.a],nc)) return;
  const stack=[{x:sx,y:sy}];
  while(stack.length){
    const p = stack.pop();
    const idx = get(p.x,p.y);
    if(!colorsEqual([data[idx],data[idx+1],data[idx+2],data[idx+3]],target)) continue;
    data[idx]=nc.r; data[idx+1]=nc.g; data[idx+2]=nc.b;
    data[idx+3]=nc.a;
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

document.querySelectorAll('#paintToolButtons [data-paint-tool]').forEach(button => {
  button.onclick = () => setPaintTool(button.dataset.paintTool);
});
document.getElementById('paintLayerFilter').oninput = ()=>renderLayers();
document.getElementById('paintHideSimilarLayers').onchange = ()=>{
  if (!layerIsolationOpacities) return;
  applyLayerIsolation();
  dirty = true;
  composite();
};
document.getElementById('paintBrushSize').oninput = e=>{
  brushSize = parseInt(e.target.value);
  document.getElementById('paintBrushSizeVal').textContent = brushSize+'px';
};
document.getElementById('paintColorPick').oninput = e=>setColor(e.target.value, false);
document.getElementById('paintColorPick').onchange = e=>setColor(e.target.value, true);
document.getElementById('paintBlendMode').onchange = e=>{
  if(active===null) return;
  pushPaintUndo();
  layers[active].blendMode = e.target.value;
  composite();
  scheduleAutoPush();
};
document.getElementById('paintLayerOpacity').oninput = e=>{
  const val = parseInt(e.target.value)/100;
  document.getElementById('paintLayerOpacityVal').textContent = Math.round(val*100)+'%';
  if(active!==null) setOpacity(active, val);
};
document.getElementById('paintActiveLayerOpacity').oninput = e=>{
  if(active!==null) setOpacity(active, parseInt(e.target.value)/100);
};

document.getElementById('paintBtnNew').onclick = ()=>{
  if(confirm('New sprite will clear all layers. Continue?')){
    pushPaintUndo();
    restoreLayerIsolation();
    layers = [{name:'Layer 1', canvas:newLayerCanvas(256, 256), visible:true, opacity:1, blendMode:'normal'}];
    active = 0; activeWorkspaceId = null; zoom = 1; pan = {x:0,y:0};
    previewMode = 'paint'; rigShot = null; previewPan = { x: 0, y: 0 };
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
  restoreLayerIsolation();
  paint_cv.width = img.width; paint_cv.height = img.height;
  layers = [{name:f.name.replace(/\.[^/.]+$/,''), canvas:img, visible:true, opacity:1}];
  active = 0; activeWorkspaceId = null;
  previewMode = 'paint'; rigShot = null; previewPan = { x: 0, y: 0 };
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
document.getElementById('paintBtnAddLayer').onclick = ()=>addLayer();
document.getElementById('paintBtnDelLayer').onclick = ()=>deleteLayer(null);
document.getElementById('paintToolZoomIn').onclick = ()=>{ autoFit=false; zoom=Math.min(zoom+0.25,32); syncCanvasScale(); };
document.getElementById('paintToolZoomOut').onclick = ()=>{ autoFit=false; zoom=Math.max(zoom-0.25,0.1); syncCanvasScale(); };
document.getElementById('paintToolFit').onclick = ()=>{ resetPaintView(); };
document.getElementById('paintPreviewScale').oninput = e=>{
  document.getElementById('paintPreviewScaleVal').textContent = parseFloat(e.target.value).toFixed(1)+'x';
  updatePreview();
};
document.getElementById('paintPreviewOnTop').onchange = ()=>{
  document.getElementById('paintPreviewOpacity').disabled = !document.getElementById('paintPreviewOnTop').checked;
  if (previewMode === 'rig') refreshRigPreview();
  else updatePreview();
};
document.getElementById('paintPreviewOpacity').oninput = e=>{
  document.getElementById('paintPreviewOpacityVal').textContent = e.target.value+'%';
  updatePreview();
};
document.getElementById('paintPreviewCenter').onclick = ()=>{
  previewPan = { x: 0, y: 0 };
  document.getElementById('paintPreviewScale').value = '1';
  updatePreview();
};

function previewPoint(e){
  const rect = paint_preview.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * paint_preview.width / rect.width,
    y: (e.clientY - rect.top) * paint_preview.height / rect.height
  };
}

paint_preview.addEventListener('pointerdown', e=>{
  if (e.button !== 0) return;
  e.preventDefault();
  const point = previewPoint(e);
  previewPointer = { point, pan: { ...previewPan } };
  paint_preview.classList.add('panning');
  paint_preview.setPointerCapture(e.pointerId);
});
paint_preview.addEventListener('pointermove', e=>{
  if (!previewPointer) return;
  const point = previewPoint(e);
  previewPan.x = previewPointer.pan.x + point.x - previewPointer.point.x;
  previewPan.y = previewPointer.pan.y + point.y - previewPointer.point.y;
  updatePreview();
});
const finishPreviewPointer = e=>{
  if (!previewPointer) return;
  paint_preview.classList.remove('panning');
  previewPointer = null;
  if (paint_preview.hasPointerCapture(e.pointerId)) paint_preview.releasePointerCapture(e.pointerId);
};
paint_preview.addEventListener('pointerup', finishPreviewPointer);
paint_preview.addEventListener('pointercancel', finishPreviewPointer);
paint_preview.addEventListener('wheel', e=>{
  e.preventDefault();
  const t = previewRenderTransform;
  if (!t) return;
  const point = previewPoint(e);
  const input = document.getElementById('paintPreviewScale');
  const oldZoom = parseFloat(input.value) || 1;
  const nextZoom = Math.max(1, Math.min(8, oldZoom * Math.exp(-e.deltaY * 0.001)));
  if (nextZoom === oldZoom) return;
  const nextScale = t.fitScale * nextZoom;
  previewPan.x = point.x - ((point.x - t.offsetX) / t.scale) * nextScale - t.baseX;
  previewPan.y = point.y - ((point.y - t.offsetY) / t.scale) * nextScale - t.baseY;
  input.value = String(nextZoom);
  updatePreview();
}, { passive: false });

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
document.getElementById('paintActiveLayerOpacity').addEventListener('pointerdown', ()=>pushPaintUndo());

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
document.getElementById('paintTabPaint').onclick = ()=>{ useWholeRigPreview(); switchPaintTab('paint'); };
document.getElementById('paintTabPreview').onclick = ()=>{ useWholeRigPreview(); switchPaintTab('preview'); };
document.getElementById('paintTabExport').onclick = ()=>{ previewMode = 'paint'; switchPaintTab('export'); };

addLayer(null, true);
restorePaintContext();
renderColorPalettes();
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

function refreshRigPreview() {
  const R = rigAPI();
  if (!R || !R.doc) return;
  const layer = active === null ? null : layers[active];
  const excludeId = document.getElementById('paintPreviewOnTop').checked && layer && layer.visible && layer.rigLayerId
    ? layer.rigLayerId : null;
  rigShot = R.snapshot(excludeId);
  updatePreview();
}

function isBlankCanvas(c) {
  try {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  } catch (e) { return false; }
}

function paintCanvasIsBlank() {
  return layers.length === 0 || (layers.length === 1 && !layers[0].rigLayerId &&
    !layers[0].assetWorkspaceId && isBlankCanvas(layers[0].canvas));
}

// Layer canvases are independent; the main canvas is resized to the current workspace.
function fitPaintToRig(doc) {
  if (paint_cv.width === doc.width && paint_cv.height === doc.height) return true;
  paint_cv.width = doc.width;
  paint_cv.height = doc.height;
  activeWorkspaceId = null;
  restoreLayerIsolation();
  zoom = 1; pan = { x: 0, y: 0 };
  autoFit = true;
  return true;
}

function makePaintLayer(l) {
  const c = newLayerCanvas(paint_cv.width, paint_cv.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(l.rgba), l.w, l.h), l.x, l.y);
  return { name: l.name || 'Rig Layer', canvas: c, visible: !l.hidden, opacity: 1,
    rigLayerId: l.id, rigX: l.x, rigY: l.y, rigW: l.w, rigH: l.h };
}

function useWholeRigPreview() {
  const R = rigAPI();
  if (activeWorkspaceId) {
    previewMode = 'paint';
    return;
  }
  if (!R || !R.doc || !layers.some(p => p.rigLayerId)) {
    previewMode = 'paint';
    return;
  }
  previewMode = 'rig';
  if (!animPreviewOn) {
    lastAnimShot = null;
    lastAnimCrop = null;
    refreshRigPreview();
  }
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
  restoreLayerIsolation();
  activeWorkspaceId = null;
  const idx = layers.findIndex(p => p.rigLayerId === layerId);
  const pl = makePaintLayer(l);
  if (idx >= 0) layers[idx] = pl; else layers.push(pl);
  active = idx >= 0 ? idx : layers.length - 1;
  setActive(active);
  dirty = true;
  populateAnimClips();
  useWholeRigPreview();
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
  restoreLayerIsolation();
  let n = 0;
  let lastRigIndex = -1;
  for (const l of flat) {
    const idx = layers.findIndex(p => p.rigLayerId === l.id);
    const pl = makePaintLayer(l);
    if (idx >= 0) layers[idx] = pl; else layers.push(pl);
    lastRigIndex = idx >= 0 ? idx : layers.length - 1;
    n++;
  }
  active = lastRigIndex;
  setActive(active);
  dirty = true;
  populateAnimClips();
  useWholeRigPreview();
  updateUI(); composite();
  rigBridgeStatus('Imported ' + n + ' rig layer(s) at ' + paint_cv.width + 'x' + paint_cv.height);
  toast('Imported ' + n + ' rig layer(s)');
}

function pushPaintToRig() {
  const R = window.__rigEditor, doc = R && R.doc;
  if (!doc) { toast('Open a rig first'); return; }
  if (!rigPushTargets()) { toast('Nothing to push: import a rig layer or open an image asset first'); return; }
  const n = autoPushNow();
  toast(n ? 'Pushed ' + n + ' image(s) to the rig' : 'Could not push: check the linked image sizes', n ? 2500 : 7000);
}

function populateImageAssets(){
  const select = document.getElementById('paintImageAssetSelect');
  const hint = document.getElementById('paintImageAssetHint');
  const filter = document.getElementById('paintImageAssetFilter');
  const R = rigAPI();
  if (!select) return;
  const previous = select.value;
  const query = filter ? filter.value.trim().toLocaleLowerCase() : '';
  const assets = (R && R.imageAssetsForPaint ? R.imageAssetsForPaint() : [])
    .filter(asset => !query || (asset.name + ' ' + asset.source).toLocaleLowerCase().includes(query));
  select.replaceChildren();
  if (!assets.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = query ? 'No image assets match' : 'Load a rig to browse images';
    select.appendChild(option);
    if (hint) hint.textContent = query ? 'Try another asset name or clear the filter.' : 'Load a game template or rig containing image assets first.';
    return;
  }
  const groups = new Map();
  for (const asset of assets) {
    if (!groups.has(asset.source)) {
      const group = document.createElement('optgroup');
      group.label = asset.source;
      groups.set(asset.source, group);
      select.appendChild(group);
    }
    const option = document.createElement('option');
    option.value = asset.id;
    option.textContent = asset.name + ' (' + asset.w + '×' + asset.h + ')';
    groups.get(asset.source).appendChild(option);
  }
  if (assets.some(asset => asset.id === previous)) select.value = previous;
  if (hint) hint.textContent = assets.length + ' image asset(s) available. Open one to edit at native size; changes sync to the rig.';
}

function importImageAsset(){
  const R = rigAPI(), select = document.getElementById('paintImageAssetSelect');
  if (!R || !R.doc) { toast('Open a rig or load the game template first'); return; }
  const asset = (R.imageAssetsForPaint ? R.imageAssetsForPaint() : []).find(item => item.id === select.value);
  if (!asset) { populateImageAssets(); toast('Choose an available image asset'); return; }
  if (!Number.isInteger(asset.w) || !Number.isInteger(asset.h) || !asset.rgba || asset.rgba.length !== asset.w * asset.h * 4) {
    toast('Could not open "' + asset.name + '": its image data is invalid', 6000);
    return;
  }
  restoreLayerIsolation();
  let existing = -1;
  for (let i = 0; i < layers.length; i++) if (layers[i].assetWorkspaceId === asset.id) existing = i;
  if (existing >= 0) {
    setActive(existing);
    toast('Opened image asset: ' + asset.name);
    return;
  }
  pushPaintUndo();
  const canvas = newLayerCanvas(asset.w, asset.h);
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(asset.rgba), asset.w, asset.h), 0, 0);
  layers.push({ name: asset.name, canvas, visible: true, opacity: 1, blendMode: 'normal',
    assetWorkspaceId: asset.id, assetBase: true });
  active = layers.length - 1;
  activeWorkspaceId = asset.id;
  paint_cv.width = asset.w; paint_cv.height = asset.h;
  autoFit = true; previewMode = 'paint'; rigShot = null;
  dirty = true;
  updateUI(); composite();
  rigBridgeStatus('Opened "' + asset.name + '" (' + asset.w + '×' + asset.h + ')');
  toast('Opened image asset: ' + asset.name);
}

// Show the rig itself on the paint Preview tab.
function renderRigPreview() {
  const R = rigAPI();
  if (!R || !R.doc) { toast('Open a rig first'); return; }
  if (animPreviewOn) stopRigAnimPreview();
  lastAnimShot = null; lastAnimCrop = null;
  previewMode = 'rig';
  refreshRigPreview();
  switchPaintTab('preview');
  updatePreview();
  rigBridgeStatus('Previewing the rig');
}

function initRigIntegration() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('paintBtnImportRig', importAllRigAssets);
  on('paintBtnImportImageAsset', importImageAsset);
  on('paintBtnPushRig', pushPaintToRig);
  on('paintBtnRigPreview', renderRigPreview);
  const filter = document.getElementById('paintImageAssetFilter');
  if (filter) filter.oninput = populateImageAssets;
  populateImageAssets();
}

initRigIntegration();
