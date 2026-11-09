// ===================== Sprite Paint: draw and repaint sprites right in the editor =====================
// By Silvasta (made with help from an AI assistant), brought into the editor as its own panel, like the Props editor.
// It talks to the rig through window.__rigEditor (ui.js): import layers or game sprites, paint, and they go straight back to the rig.
(function () {
  'use strict';
  const st = document.createElement('style'); st.textContent = `#panelPaint{position:fixed;inset:0;z-index:40;display:none;flex-direction:column;background:var(--bg,#15161a);color:var(--text,#e6e6ea);font:inherit}#panelPaint.active{display:flex}#panelPaint *{box-sizing:border-box}#panelPaint main{flex:1;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr) minmax(280px,340px);gap:0}
#panelPaint header{flex:none}
#panelPaint #viewport{flex:1;min-height:0;min-width:0;overflow:auto}
#panelPaint aside{flex:none}
#panelPaint .right{flex:none}
#panelPaint button,#panelPaint select,#panelPaint input{font:inherit;color:var(--text)}
#panelPaint button{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:5px 10px;cursor:pointer}
#panelPaint button:hover{border-color:var(--dim)}
#panelPaint button.primary{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
#panelPaint button.primary:hover{filter:brightness(1.1)}
#panelPaint button.on{background:var(--acc2);border-color:var(--acc2);color:#fff}
#panelPaint button.secondary{background:var(--panel2);border-color:var(--line);color:var(--dim)}
#panelPaint button.secondary:hover{border-color:var(--text);color:var(--text)}
#panelPaint button.danger{background:rgba(224,71,91,0.2);border-color:var(--acc);color:var(--acc)}
#panelPaint button.danger:hover{background:var(--acc);color:#fff}
#panelPaint select,#panelPaint input[type=text],#panelPaint input[type=number],#panelPaint input[type=search]{background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:4px 6px}
#panelPaint input[type=color]{border:none;background:none;width:26px;height:26px;cursor:pointer}
#panelPaint header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;row-gap:4px;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--panel);z-index:10}
#panelPaint header h1{font-size:15px;margin:0 10px 0 0;white-space:nowrap}
#panelPaint header h1 span{color:var(--acc)}
#panelPaint header .grow{flex:1}
#panelPaint main{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr) minmax(280px,340px);min-height:0;gap:0;overflow:hidden}
#panelPaint aside{background:var(--panel);overflow:auto;min-height:0;min-width:0;border-right:1px solid var(--line)}
#panelPaint aside.right{border-left:1px solid var(--line);border-right:none}
#panelPaint #viewport{position:relative;background:var(--bg);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:auto}
#panelPaint #canvas-wrap{position:relative;display:inline-block;cursor:crosshair}
#panelPaint canvas#cv{image-rendering:pixelated;box-shadow:0 0 20px rgba(0,0,0,0.5)}
#panelPaint canvas#preview{image-rendering:pixelated;box-shadow:0 0 10px rgba(0,0,0,0.3)}
#panelPaint .crosshair{position:absolute;top:50%;left:50%;width:20px;height:20px;transform:translate(-50%,-50%);pointer-events:none;border:1px dashed var(--acc2);border-radius:50%;display:none}
#panelPaint #canvas-wrap.painting .crosshair{display:block}
#panelPaint h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:14px 12px 6px;padding-top:10px;border-top:1px solid var(--line)}
#panelPaint .section{padding:0 12px 10px}
#panelPaint .row{display:flex;gap:6px;align-items:center;margin-bottom:8px}
#panelPaint .row label{flex:0 0 90px;font-size:12px;color:var(--dim)}
#panelPaint .row input[type=range]{flex:1}
#panelPaint .toolbar{display:flex;gap:4px;flex-wrap:wrap}
#panelPaint .toolbar button{flex:1;min-width:56px}
#panelPaint .paint-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
#panelPaint .paint-tools button{min-width:0;padding:7px 3px;font-size:11px}
#panelPaint .paint-tools button .tool-icon{display:block;font-size:17px;line-height:1.2}
#panelPaint .paint-tools button[aria-pressed=true]{border-color:var(--acc2);box-shadow:inset 0 0 0 1px var(--acc2);background:var(--panel2)}
#panelPaint #paintSelectionOverlay{position:absolute;display:none;pointer-events:none;image-rendering:pixelated}
#panelPaint .color-swatch{width:25px;height:25px;padding:0;border:1px solid var(--line);border-radius:5px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
#panelPaint .color-swatch:hover,#panelPaint .color-swatch.active{border-color:var(--text);box-shadow:0 0 0 2px var(--acc2)}
#panelPaint .color-pick-wrap{position:relative;width:42px;height:34px;flex:0 0 42px;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--panel2)}
#panelPaint .color-pick-wrap input[type=color]{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;cursor:pointer}
#panelPaint .paint-palette{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
#panelPaint .paint-palette-label{font-size:10px;color:var(--dim);margin-top:7px}
#panelPaint .paint-layer-opacity{position:sticky;top:0;z-index:4;padding:7px 12px 2px;background:var(--panel);border-bottom:1px solid var(--line)}
#panelPaint .paint-layer-opacity .row{margin-bottom:5px}
#panelPaint .paint-active-layer-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;margin-bottom:3px}
#panelPaint .layer-item{display:flex;align-items:center;gap:6px;padding:4px 5px 4px 8px;border:1px solid var(--line);border-radius:6px;margin-bottom:4px;cursor:pointer;background:var(--panel2);min-width:0}
#panelPaint .layer-item.active{border-color:var(--acc2);background:var(--panel2)}
#panelPaint .layer-item .layer-vis{width:14px;height:14px;border:1px solid var(--line);border-radius:3px;flex:0 0 14px}
#panelPaint .layer-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;min-width:0}
#panelPaint .layer-actions{display:flex;gap:3px;align-items:center}
#panelPaint .layer-actions button{padding:2px 6px;font-size:11px;min-width:0}
#panelPaint .layer-menu-btn{padding:0 7px;font-size:15px;line-height:1.5;min-width:0;flex:none;background:none;border:none;color:var(--dim);cursor:pointer;border-radius:4px}
#panelPaint .layer-menu-btn:hover{background:var(--panel2);color:var(--text)}
#panelPaint #layerMenu{position:fixed;z-index:80;display:none;min-width:186px;padding:5px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 26px rgba(0,0,0,.55)}
#panelPaint #layerMenu.open{display:block}
#panelPaint #layerMenu .mi{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;border-radius:5px;background:none;color:var(--text);font-size:12px;text-align:left;cursor:pointer}
#panelPaint #layerMenu .mi:hover{background:var(--panel2)}
#panelPaint #layerMenu .sep{height:1px;margin:4px 2px;background:var(--line)}
#panelPaint #layerMenu .op{display:flex;align-items:center;gap:6px;padding:4px 8px 3px;font-size:11px;color:var(--dim)}
#panelPaint #layerMenu .op input[type=range]{flex:1;min-width:84px}
#panelPaint #layerMenu .op span:last-child{min-width:32px;text-align:right;color:var(--text)}
#panelPaint .btn-row{display:flex;gap:4px;margin-top:8px}
#panelPaint .btn-row button{flex:1}
#panelPaint .toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);color:var(--text);padding:8px 14px;border-radius:6px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:50;white-space:nowrap}
#panelPaint .toast.show{opacity:1}
#panelPaint .empty{padding:30px;text-align:center;color:var(--dim)}
#panelPaint .empty b{color:var(--text)}
#panelPaint .input-small{width:70px}
#panelPaint #paintViewport{position:relative;background:var(--bg);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:auto}
#panelPaint #paintCanvasWrap{position:relative;display:flex;align-items:center;justify-content:center;padding:12px;min-width:100%;min-height:100%}
#panelPaint canvas#paintCv{image-rendering:pixelated;box-shadow:0 0 20px rgba(0,0,0,0.5);display:block;flex:none;background-color:#eee;background-image:linear-gradient(45deg,#bbb 25%,transparent 25%,transparent 75%,#bbb 75%),linear-gradient(45deg,#bbb 25%,#eee 25%,#eee 75%,#bbb 75%);background-size:12px 12px;background-position:0 0,6px 6px}
#panelPaint canvas#paintPreview{image-rendering:pixelated;box-shadow:0 0 10px rgba(0,0,0,0.3);max-width:100%;max-height:100%;display:block;background-color:#eee;background-image:linear-gradient(45deg,#bbb 25%,transparent 25%,transparent 75%,#bbb 75%),linear-gradient(45deg,#bbb 25%,#eee 25%,#eee 75%,#bbb 75%);background-size:12px 12px;background-position:0 0,6px 6px;touch-action:none;cursor:grab}
#panelPaint canvas#paintPreview.panning{cursor:grabbing}
#panelPaint canvas#paintPreview{cursor:grab;touch-action:none}
#panelPaint #paintCoord{position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,0.6);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--dim);pointer-events:none}`; document.head.appendChild(st);
  // Sprite Paint wears the editor's theme: every "[data-theme=…] x" rule of the main page also applies inside the panel
  // (its own #panelPaint rules would otherwise win). Built from the page's stylesheets, so new themes just work.
  try {
    const out = [];
    for (const sh of document.styleSheets) { if (sh.ownerNode === st) continue; let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) { if (!r.selectorText || !/\[data-theme/.test(r.selectorText) || /#panelPaint/.test(r.selectorText)) continue;
        const sel = r.selectorText.split(',').map(x => x.trim()).filter(x => !/body::(after|before)/.test(x)).map(x => {
          const m = /^(\[data-theme[^\]]*\])\s*(.*)$/.exec(x); if (!m) return null;
          if (!m[2]) return m[1] + ' #panelPaint';                               // the theme's colours
          if (/^body\b/.test(m[2])) return m[1] + ' #panelPaint' + m[2].slice(4);   // its font and background
          return m[1] + ' #panelPaint ' + m[2];
        }).filter(Boolean);
        const tx = /input\[type="?text"?\]/; sel.push(...sel.filter(x => tx.test(x)).map(x => x.replace(tx, 'input[type=search]')));
        if (sel.length) out.push(sel.join(',') + '{' + r.style.cssText + '}'); } }
    const th = document.createElement('style'); th.id = 'paintTheme'; th.textContent = out.join('\n'); document.head.appendChild(th);
  } catch (e) { console.warn('Sprite Paint theme', e); }
  const holder = document.createElement('div');
  holder.innerHTML = `<div id="panelPaint" role="application" aria-label="Sprite Paint">
<header>
<button id="paintBtnBack" title="Back to the rig editor (your painting stays here; it's already on the rig)">← Rig editor</button>
<h1>Sprite Paint <span>Luna Advanced Rig Systems</span></h1>
<div class="grow"></div>
<button id="paintBtnNew" title="New sprite">New</button>
<button id="paintBtnOpen" title="Load PNG">Open…</button>
<input id="paintFileOpen" type="file" accept=".png" hidden>
<button id="paintBtnSave" class="primary" title="Export PNG">Save PNG</button>
<button id="paintBtnUndo" title="Undo (Ctrl+Z)">↶ Undo</button>
<button id="paintBtnRedo" title="Redo (Ctrl+Y)">↷ Redo</button>
</header>

<main>
<aside>
<div id="paintRecoveryNotice" class="section" role="status" aria-live="polite" hidden>
<div id="paintRecoveryMessage" class="muted" style="font-size:11px;margin-bottom:6px"></div>
<div class="btn-row">
<button id="paintRestoreAutosave" class="primary">Restore Paint</button>
<button id="paintDiscardAutosave">Discard</button>
</div>
</div>
<div id="paintCredit" class="muted" style="font-size:10px;padding:4px 12px 0">made by SilvastaDaProot</div>
<div id="paintAutosaveStatus" class="muted" style="font-size:10px;padding:4px 12px" aria-live="polite"></div>
<h2>Tools</h2>
<div class="section">
<div id="paintToolButtons" class="paint-tools" role="toolbar" aria-label="Paint tools">
<button type="button" class="on" data-paint-tool="pencil" aria-pressed="true" title="Pencil"><span class="tool-icon">✎</span>Pencil</button>
<button type="button" data-paint-tool="pixel" aria-pressed="false" title="Opaque square pixel brush"><span class="tool-icon">▪</span>Pixel</button>
<button type="button" data-paint-tool="eraser" aria-pressed="false" title="Soft eraser"><span class="tool-icon">◩</span>Eraser</button>
<button type="button" data-paint-tool="pixel-eraser" aria-pressed="false" title="Square pixel eraser"><span class="tool-icon">□</span>Pixel erase</button>
<button type="button" data-paint-tool="fill" aria-pressed="false" title="Fill connected area"><span class="tool-icon">▨</span>Fill</button>
<button type="button" data-paint-tool="picker" aria-pressed="false" title="Pick a color from the canvas"><span class="tool-icon">◉</span>Picker</button>
<button type="button" data-paint-tool="select" aria-pressed="false" title="Select a rectangular pixel area"><span class="tool-icon">▧</span>Select</button>
</div>
<div class="toolbar" style="margin-top:7px">
<button id="paintSelectionCopy" title="Copy selection (Ctrl+C)" disabled>Copy</button>
<button id="paintSelectionCut" title="Cut selection (Ctrl+X)" disabled>Cut</button>
<button id="paintSelectionPaste" title="Paste into the active layer (Ctrl+V)" disabled>Paste</button>
</div>
<div class="toolbar" style="margin-top:4px">
<button id="paintSelectionConfirm" title="Place pasted pixels (Enter)" disabled>Place</button>
<button id="paintSelectionCancel" title="Cancel floating paste (Esc)" disabled>Cancel paste</button>
</div>
<div class="muted" style="font-size:10px;margin:4px 0 8px">Drag to select or reposition a paste; Enter places it, Esc cancels. Arrow keys nudge selected or pasted pixels; Ctrl+arrows nudges 1 px, Shift+arrows 10 px. Ctrl+A selects all.</div>
<div class="row"><label>Size</label>
<input id="paintBrushSize" type="range" min="1" max="32" value="4">
<span id="paintBrushSizeVal">4px</span></div>
<div style="display:flex;align-items:center;gap:6px;margin:0 0 8px 96px">
<label class="muted" style="display:flex;align-items:center;gap:6px;font-size:11px"><input id="paintPixelNoise" type="checkbox" disabled> Vary color tone</label>
<select id="paintPixelNoiseStrength" aria-label="Pixel brush tone variation strength" title="Adjust how much lighter or darker each pixel mark can be" disabled style="font-size:10px;padding:2px 4px">
<option value="4">Low</option><option value="8">Medium</option><option value="12">High</option><option value="20">Extreme</option>
</select>
<span class="muted" title="Varies color only; mark positions do not move" style="font-size:10px">ⓘ</span>
</div>
<div class="row" style="align-items:center">
<label>Color</label>
<div class="color-pick-wrap" title="Choose a custom color"><input id="paintColorPick" type="color" value="#e0475b" aria-label="Choose paint color"></div>
<output id="paintColorValue" style="font:12px ui-monospace,monospace;color:var(--text)">#e0475b</output>
</div>
<div class="paint-palette-label">Palette</div>
<div class="paint-palette" id="paintQuickColors" aria-label="Color palette"></div>
<div class="paint-palette-label">Recent</div>
<div class="paint-palette" id="paintRecentColors" aria-label="Recently used colors"></div>
<div class="toolbar" style="margin-top:8px">
<button id="paintToolZoomIn" title="Zoom in">+</button>
<button id="paintToolZoomOut" title="Zoom out">-</button>
<button id="paintToolFit" title="Fit to window">Fit</button>
</div>
<div class="muted" style="font-size:10px;margin-top:5px">Right-click the canvas to pick a visible color. Pixel tools draw crisp squares; Size sets their width.</div>
</div>

<h2>Layers</h2>
<div class="tabs">
<button id="paintTabPaint" class="on">Paint</button>
<button id="paintTabPreview">Preview</button>
<button id="paintTabExport">Export</button>
</div>
<div class="section" style="padding-bottom:0">
<input id="paintLayerFilter" type="search" placeholder="Filter paint layers…" aria-label="Filter paint layers by name" style="width:100%;box-sizing:border-box">
<label class="muted" style="display:flex;align-items:center;gap:5px;font-size:10px;margin-top:5px"><input id="paintHideSimilarLayers" type="checkbox" checked> Hide similar layers when isolating</label>
</div>
<div id="paintLayerView">
<div id="paintLayerSection">
<div class="paint-layer-opacity">
<div id="paintActiveLayerName" class="paint-active-layer-name muted" aria-live="polite">No layer selected</div>
<div class="row"><label for="paintActiveLayerOpacity">Layer opacity</label>
<input id="paintActiveLayerOpacity" type="range" min="0" max="100" value="100" aria-label="Active layer opacity">
<span id="paintActiveLayerOpacityVal">100%</span></div>
</div>
<div class="section" id="paintLayerList">
<div class="empty">No layers<br>Add one to start painting</div>
</div>
<div class="btn-row">
<button id="paintBtnAddLayer" class="primary">+ Layer</button>
<button id="paintBtnDelLayer" class="danger">- Delete</button>
</div>
<div class="muted" style="font-size:10px;margin:2px 2px 8px">Double-click to fade other layers to 5%; similar names can be hidden entirely.</div>
</div>
<h2>Rig &harr; Paint</h2>
<div class="section">
<div class="btn-row" style="flex-direction:column;margin-top:0">
<button id="paintBtnImportRig" class="primary" title="Import every layer of the open rig as paint layers">Import rig assets</button>
<button id="paintBtnPushRig" class="danger" title="Sync linked layers and add new Paint layers to the rig">Push to rig</button>
<button id="paintBtnRigPreview" title="Show the rig on the Preview tab">Rig preview</button>
</div>
<div id="rigIntegrationStatus" style="font-size:10px;color:var(--dim);margin-top:4px;line-height:1.3"></div>
<div style="font-size:10px;color:var(--dim);margin-top:4px">Double-click a rig layer to paint it. New Paint layers named Ear / Ears are added as moving parts attached to the head; other names are guessed or can be assigned in the Rig editor.</div>
</div>
<h2>Other image assets</h2>
<div class="section">
<input id="paintImageAssetFilter" type="search" placeholder="Filter image assets…" aria-label="Filter available image assets by name" style="width:100%;margin-bottom:5px">
<select id="paintImageAssetSelect" aria-label="Choose a game or rig image asset" style="width:100%;margin-bottom:5px">
<option value="">Load a rig to browse images</option>
</select>
<button id="paintBtnImportImageAsset" style="width:100%">Open image asset</button>
<div id="paintImageAssetHint" class="muted" style="font-size:10px;margin-top:4px">Game sprites, tools, wearables, health-screen art and rig swaps open at their original size.</div>
<div id="paintHeadVariantTools" hidden style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">
<div class="paint-palette-label" style="margin-top:0">Head variants</div>
<div id="paintHeadVariantList" style="display:grid;gap:3px;margin:5px 0 7px"></div>
<select id="paintHeadVariantAction" aria-label="Head variant action" style="width:100%;margin-bottom:5px">
<option value="copy">Replace selected with current art</option>
<option value="scratch">Add quick scratches</option>
<option value="wound">Add a quick wound</option>
<option value="bruise">Add a quick bruise</option>
<option value="default">Restore selected game defaults</option>
</select>
<button id="paintBtnApplyHeadVariants" style="width:100%">Apply to selected variants</button>
<div class="muted" style="font-size:10px;margin-top:4px">Copies preserve each sprite's frame size. Default restores the game's original art.</div>
</div>
</div>
</aside>

<div id="paintViewport">
<div id="paintCanvasWrap">
<canvas id="paintCv" width="256" height="256" tabindex="0" title="Right-click to pick the visible color; focus here for keyboard shortcuts"></canvas>
<canvas id="paintSelectionOverlay" aria-hidden="true"></canvas>
<div class="crosshair" id="crosshair"></div>
</div>
<div class="coord" id="paintCoord">0, 0</div>
</div>

<aside class="right">
<h2>Preview</h2>
<div class="section">
<div id="previewWrap" aria-label="Read-only sprite preview" title="Read-only preview: scroll to zoom; drag to move. Preview controls do not edit the sprite." style="display:flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--line);border-radius:8px;height:220px;overflow:hidden">
<canvas id="paintPreview" width="256" height="256" style="max-width:100%;max-height:100%"></canvas>
</div>
<div class="row" style="margin-top:8px"><label>Scale</label>
<input id="paintPreviewScale" type="range" min="1" max="8" step="0.1" value="1">
<span id="paintPreviewScaleVal">1x</span></div>
<div class="row"><label>Show active layer on top</label><input id="paintPreviewOnTop" type="checkbox" checked></div>
<div class="row"><label>Preview opacity</label><input id="paintPreviewOpacity" type="range" min="0" max="100" value="100"><span id="paintPreviewOpacityVal">100%</span></div>
<div class="btn-row"><button id="paintPreviewCenter" title="Reset preview zoom and position">Center preview</button></div>
<div class="row" style="margin-top:8px"><label>Rig anim</label>
<select id="paintAnimClip" style="flex:1;min-width:0;max-width:160px" title="Pick the game animation to preview on the whole rig"></select></div>
<div class="btn-row">
<button id="paintBtnAnimPlay" title="Play / pause the animation">⏸ Pause</button>
<button id="paintBtnAnimPrev" title="Previous animation">◀</button>
<button id="paintBtnAnimNext" title="Next animation">▶</button>
</div>
</div>

<h2>Effects</h2>
<div class="section">
<div class="row"><label>Blend</label>
<select id="paintBlendMode">
<option value="normal">Normal</option>
<option value="multiply">Multiply</option>
<option value="screen">Screen</option>
<option value="overlay">Overlay</option>
</select></div>
<div class="row"><label>Opacity</label>
<input id="paintLayerOpacity" type="range" min="0" max="100" value="100">
<span id="paintLayerOpacityVal">100%</span></div>
</div>

<h2>Info</h2>
<div class="section">
<div class="row"><label>Size</label><span id="paintInfoSize">256×256</span></div>
<div class="row"><label>Layers</label><span id="paintInfoLayers">0</span></div>
<div class="row"><label>Zoom</label><span id="paintInfoZoom">100%</span></div>
</div>

<div class="btn-row" style="margin-top:12px">
<button id="paintBtnFlipH" title="Flip horizontal">Flip H</button>
<button id="paintBtnFlipV" title="Flip vertical">Flip V</button>
<button id="paintBtnRotate" title="Rotate 90°">Rotate</button>
</div>
</aside>
</main>
</div>`;
  document.body.appendChild(holder.firstElementChild);

  // the paint panel covers the rig editor; the rig editor keeps running underneath (it renders the previews)
  window.switchMode = function (mode) {
    const paint = mode === 'paint';
    document.body.dataset.mode = paint ? 'paint' : 'rig';
    document.getElementById('panelPaint').classList.toggle('active', paint);
    const b = document.getElementById('btnPaint'); if (b) b.classList.toggle('on', paint);
    if (paint) { if (window.__paintModeShown) window.__paintModeShown(); }
    else { if (window.__stopAnimPreview) window.__stopAnimPreview(); if (window.__rigEditor && window.__rigEditor.redraw) window.__rigEditor.redraw(); }
  };
  if (!document.body.dataset.mode) document.body.dataset.mode = 'rig';

/* ===== Sprite Paint Editor script ===== */

/*============================================================
  Sprite Paint Editor — self-contained
  Tools: pencil, opaque pixel brush, eraser, fill, color picker, selection
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
const paint_selection_overlay = document.getElementById('paintSelectionOverlay');
const paint_selection_ctx = paint_selection_overlay.getContext('2d');
const paint_coord = document.getElementById('paintCoord');
const rigAPI = () => window.__rigEditor || null;

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
let pixelBrushNoise = false;
let pixelBrushNoiseStrength = 4;
let selectionRect = null;
let selectionDrag = null;
let selectionClipboard = null;
let pendingPaste = null;
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
  '#54a0ff','#2e86de','#8f5bff','#c56cf0','#ffffff','#c8c8d0','#777780','#33363f','var(--panel2)','#000000'
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
let paintAutosaveReady = false;
let paintAutosaveTimer = null;
let paintAutosaveVersion = 0;
let paintAutosaveQueue = Promise.resolve();
let paintAutosaveWarningShown = false;
let recoveredPaintWaitingForRig = false;

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
  const R = window.__rigEditor; if (R && R.toastMsg) { R.toastMsg(msg, ms); return; }
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(()=>t.classList.remove('show'), ms);
}

function newLayerCanvas(w,h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', {willReadFrequently:true});
  g.fillStyle = '#00000000';
  g.fillRect(0,0,w,h);
  return c;
}

function paintCanvasBlob(canvas){
  return new Promise((resolve, reject)=>{
    try {
      canvas.toBlob(blob=>{
        if (blob) resolve(blob);
        else reject(new Error('Could not encode a paint layer for autosave'));
      }, 'image/png');
    } catch (e) { reject(e); }
  });
}

async function createPaintAutosave(){
  const savedLayers = await Promise.all(layers.map(async layer=>{
    const metadata = Object.assign({}, layer);
    delete metadata.canvas;
    return { metadata, image: await paintCanvasBlob(layer.canvas) };
  }));
  return {
    version: 1,
    savedAt: Date.now(),
    width: paint_cv.width,
    height: paint_cv.height,
    active,
    workspaceId: activeWorkspaceId,
    layers: savedLayers,
    layerIsolationOpacities: layerIsolationOpacities && [...layerIsolationOpacities],
    isolatedLayer,
    settings: {
      tool, brushSize, color, pixelBrushNoise, pixelBrushNoiseStrength, zoom, autoFit,
      pan: { x: pan.x, y: pan.y },
      previewPan: { x: previewPan.x, y: previewPan.y },
      viewTab: viewTab === 'export' ? 'paint' : viewTab,
      previewScale: document.getElementById('paintPreviewScale').value,
      previewOnTop: document.getElementById('paintPreviewOnTop').checked,
      previewOpacity: document.getElementById('paintPreviewOpacity').value,
      hideSimilarLayers: document.getElementById('paintHideSimilarLayers').checked
    }
  };
}

function showPaintRecovery(saved, error=null){
  const notice = document.getElementById('paintRecoveryNotice');
  const message = document.getElementById('paintRecoveryMessage');
  const restore = document.getElementById('paintRestoreAutosave');
  notice.hidden = false;
  message.textContent = error || ('Paint recovery is available' +
    (saved && saved.savedAt ? ' from ' + new Date(saved.savedAt).toLocaleString() : '') + '.');
  restore.disabled = !!error;
  document.getElementById('paintAutosaveStatus').textContent = 'A saved Paint session is waiting.';
}

function setPaintAutosaveReady(){
  paintAutosaveReady = true;
  document.getElementById('paintRecoveryNotice').hidden = true;
  document.getElementById('paintAutosaveStatus').textContent = 'Paint autosave is on';
  schedulePaintAutosave();
}

function queuePaintAutosave(version){
  paintAutosaveQueue = paintAutosaveQueue.then(async ()=>{
    if (!paintAutosaveReady || !dirty || !layers.length || version !== paintAutosaveVersion) return;
    const snapshot = await createPaintAutosave();
    if (version !== paintAutosaveVersion) return;
    await RIG.recoveryStore.put('paint', snapshot);
    if (version === paintAutosaveVersion) {
      document.getElementById('paintAutosaveStatus').textContent =
        'Paint autosaved ' + new Date(snapshot.savedAt).toLocaleTimeString();
    }
  }).catch(e=>{
    console.error('Paint autosave failed', e);
    document.getElementById('paintAutosaveStatus').textContent = 'Paint autosave failed: ' + e.message;
    if (!paintAutosaveWarningShown) {
      paintAutosaveWarningShown = true;
      toast('Paint autosave failed: ' + e.message, 7000);
    }
  });
}

function schedulePaintAutosave(){
  if (!paintAutosaveReady || !dirty || !layers.length) return;
  clearTimeout(paintAutosaveTimer);
  const version = ++paintAutosaveVersion;
  paintAutosaveTimer = setTimeout(()=>queuePaintAutosave(version), 500);
}

function flushPaintAutosave(){
  if (!paintAutosaveReady || !dirty || !layers.length) return;
  clearTimeout(paintAutosaveTimer);
  queuePaintAutosave(++paintAutosaveVersion);
}

async function restorePaintAutosave(){
  const button = document.getElementById('paintRestoreAutosave');
  button.disabled = true;
  try {
    const saved = await RIG.recoveryStore.get('paint');
    if (!saved || saved.version !== 1 || !Array.isArray(saved.layers) || !saved.layers.length ||
        !Number.isInteger(saved.width) || !Number.isInteger(saved.height) || saved.width < 1 || saved.height < 1) {
      throw new Error('The saved Paint session is missing or has an unsupported format');
    }
    const restoredLayers = await Promise.all(saved.layers.map(async entry=>{
      const meta = entry && entry.metadata;
      if (!meta || !(entry.image instanceof Blob)) throw new Error('A saved paint layer is incomplete');
      const image = await createImageBitmap(entry.image);
      const canvas = newLayerCanvas(image.width, image.height);
      canvas.getContext('2d').drawImage(image, 0, 0);
      image.close();
      return Object.assign({}, meta, { canvas });
    }));
    paintAutosaveVersion++;
    paint_cv.width = saved.width;
    paint_cv.height = saved.height;
    layers = restoredLayers;
    activeWorkspaceId = saved.workspaceId || null;
    active = Number.isInteger(saved.active) ? Math.min(Math.max(0, saved.active), layers.length - 1) : 0;
    layerIsolationOpacities = Array.isArray(saved.layerIsolationOpacities) ? [...saved.layerIsolationOpacities] : null;
    isolatedLayer = layerIsolationOpacities && Number.isInteger(saved.isolatedLayer) ? saved.isolatedLayer : null;
    const settings = saved.settings || {};
    tool = ['pencil','pixel','pixel-eraser','eraser','fill','picker'].includes(settings.tool) ? settings.tool : 'pencil';
    brushSize = Number.isInteger(settings.brushSize) ? Math.min(32, Math.max(1, settings.brushSize)) : 4;
    color = /^#[0-9a-f]{6}$/i.test(settings.color || '') ? settings.color : '#e0475b';
    pixelBrushNoise = !!settings.pixelBrushNoise;
    pixelBrushNoiseStrength = ({ 3: 4, 6: 8, 9: 12, 4: 4, 8: 8, 12: 12, 20: 20 })[settings.pixelBrushNoiseStrength] || 4;
    zoom = Number.isFinite(settings.zoom) ? settings.zoom : 1;
    autoFit = settings.autoFit !== false;
    pan = settings.pan && Number.isFinite(settings.pan.x) && Number.isFinite(settings.pan.y)
      ? { x: settings.pan.x, y: settings.pan.y } : { x: 0, y: 0 };
    previewPan = settings.previewPan && Number.isFinite(settings.previewPan.x) && Number.isFinite(settings.previewPan.y)
      ? { x: settings.previewPan.x, y: settings.previewPan.y } : { x: 0, y: 0 };
    viewTab = settings.viewTab === 'preview' ? 'preview' : 'paint';
    previewMode = 'paint';
    rigShot = null;
    document.getElementById('paintBrushSize').value = String(brushSize);
    document.getElementById('paintBrushSizeVal').textContent = brushSize + 'px';
    document.getElementById('paintColorPick').value = color;
    document.getElementById('paintColorValue').textContent = color.toUpperCase();
    document.getElementById('paintPixelNoise').checked = pixelBrushNoise;
    document.getElementById('paintPixelNoiseStrength').value = String(pixelBrushNoiseStrength);
    document.getElementById('paintPreviewScale').value = settings.previewScale || '1';
    document.getElementById('paintPreviewOnTop').checked = settings.previewOnTop !== false;
    document.getElementById('paintPreviewOpacity').value = settings.previewOpacity || '100';
    document.getElementById('paintHideSimilarLayers').checked = settings.hideSimilarLayers !== false;
    undoStack.length = 0;
    redoStack.length = 0;
    dirty = true;
    setPaintTool(tool, false);
    renderColorPalettes();
    updateUI();
    composite();
    recoveredPaintWaitingForRig = layers.some(layer => layer.rigLayerId || layer.assetWorkspaceId);
    setPaintAutosaveReady();
    syncRecoveredPaintAfterRigRestore();
    toast('Recovered Paint session');
  } catch (e) {
    console.error('Could not restore the Paint recovery draft', e);
    showPaintRecovery(null, 'Could not restore Paint: ' + e.message);
    button.disabled = true;
    toast('Could not restore Paint: ' + e.message, 7000);
  }
}

async function discardPaintAutosave(){
  const button = document.getElementById('paintDiscardAutosave');
  button.disabled = true;
  try {
    await RIG.recoveryStore.delete('paint');
    document.getElementById('paintRestoreAutosave').disabled = false;
    setPaintAutosaveReady();
  } catch (e) {
    button.disabled = false;
    document.getElementById('paintAutosaveStatus').textContent = 'Could not discard recovery draft: ' + e.message;
    console.error('Could not discard the Paint recovery draft', e);
    toast('Could not discard Paint recovery: ' + e.message, 7000);
  }
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
  schedulePaintAutosave();
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
  const vp = document.getElementById('paintViewport');
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
  renderSelectionOverlay();
}

function updateSelectionControls(){
  const hasSelection = !!selectionRect && active !== null;
  document.getElementById('paintSelectionCopy').disabled = !hasSelection;
  document.getElementById('paintSelectionCut').disabled = !hasSelection;
  document.getElementById('paintSelectionPaste').disabled = !selectionClipboard || active === null;
  document.getElementById('paintSelectionConfirm').disabled = !pendingPaste;
  document.getElementById('paintSelectionCancel').disabled = !pendingPaste;
}

function renderSelectionOverlay(preview=null){
  if (!paint_selection_overlay) return;
  if (paint_selection_overlay.width !== paint_cv.width || paint_selection_overlay.height !== paint_cv.height) {
    paint_selection_overlay.width = paint_cv.width;
    paint_selection_overlay.height = paint_cv.height;
  }
  paint_selection_overlay.style.width = paint_cv.style.width || paint_cv.width + 'px';
  paint_selection_overlay.style.height = paint_cv.style.height || paint_cv.height + 'px';
  const canvasRect = paint_cv.getBoundingClientRect();
  const wrapRect = paint_wrap.getBoundingClientRect();
  paint_selection_overlay.style.left = canvasRect.left - wrapRect.left + 'px';
  paint_selection_overlay.style.top = canvasRect.top - wrapRect.top + 'px';
  paint_selection_ctx.clearRect(0, 0, paint_selection_overlay.width, paint_selection_overlay.height);
  const activePreview = preview || (pendingPaste ? {
    rect: { x: pendingPaste.x, y: pendingPaste.y, w: pendingPaste.canvas.width, h: pendingPaste.canvas.height },
    image: pendingPaste.canvas, x: pendingPaste.x, y: pendingPaste.y
  } : null);
  const shown = activePreview && activePreview.rect ? activePreview.rect : selectionRect;
  if (activePreview && activePreview.image) {
    paint_selection_ctx.drawImage(activePreview.image, activePreview.x, activePreview.y);
  }
  if (shown && shown.w > 0 && shown.h > 0) {
    paint_selection_ctx.save();
    paint_selection_ctx.lineWidth = 1;
    paint_selection_ctx.setLineDash([1, 1]);
    paint_selection_ctx.strokeStyle = '#fff';
    paint_selection_ctx.strokeRect(shown.x + 0.5, shown.y + 0.5, Math.max(0, shown.w - 1), Math.max(0, shown.h - 1));
    paint_selection_ctx.lineDashOffset = 1;
    paint_selection_ctx.strokeStyle = '#111';
    paint_selection_ctx.strokeRect(shown.x + 0.5, shown.y + 0.5, Math.max(0, shown.w - 1), Math.max(0, shown.h - 1));
    paint_selection_ctx.restore();
  }
  paint_selection_overlay.style.display = shown || (preview && preview.image) ? 'block' : 'none';
  updateSelectionControls();
}

function focusPaintLayer(i){
  const layer = layers[i];
  const viewport = document.getElementById('paintViewport');
  if (!layer || !layer.rigLayerId || !viewport) return;
  const R = rigAPI(), rigLayer = R && R.layerById(layer.rigLayerId);
  if (!rigLayer) return;
  const bounds = { x: rigLayer.x, y: rigLayer.y, w: rigLayer.w, h: rigLayer.h };
  const availableWidth = Math.max(1, viewport.clientWidth - 56);
  const availableHeight = Math.max(1, viewport.clientHeight - 56);
  autoFit = false;
  zoom = Math.max(0.1, Math.min(32, availableWidth / bounds.w, availableHeight / bounds.h));
  syncCanvasScale();
  requestAnimationFrame(()=>{
    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const centerX = 12 + (bounds.x + bounds.w / 2) * zoom;
    const centerY = 12 + (bounds.y + bounds.h / 2) * zoom;
    viewport.scrollLeft = Math.min(maxX, Math.max(0, centerX - viewport.clientWidth / 2));
    viewport.scrollTop = Math.min(maxY, Math.max(0, centerY - viewport.clientHeight / 2));
  });
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
    workspaceId: activeWorkspaceId, layerIsolationOpacities: layerIsolationOpacities && [...layerIsolationOpacities], isolatedLayer,
    selectionRect: selectionRect && { ...selectionRect } };
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
  selectionRect = s.selectionRect ? { ...s.selectionRect } : null;
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
  const cutLayerIds = new Set(doc.chains.filter(chain => chain.source)
    .flatMap(chain => chain.segs.map(seg => seg.layer)));
  const targets = workspaceId ? [] : layers.filter(p =>
    !p.assetWorkspaceId && (!p.rigLayerId || !cutLayerIds.has(p.rigLayerId)));
  const assetLayers = workspaceId ? layers.filter(p => p.assetWorkspaceId === workspaceId && p.assetBase) : [];
  const only = !pushAllPending && pushOnlyPending.size ? targets.filter(p => pushOnlyPending.has(p)) : targets;
  return only.length || assetLayers.length ? { R, doc, targets: only, assetLayers, assetWorkspaceId: workspaceId } : null;
}

let pushAllPending = false;
const pushOnlyPending = new Set();
function scheduleAutoPush(onlyLayer){
  if (restoringPaint) return;
  if (onlyLayer) pushOnlyPending.add(onlyLayer); else pushAllPending = true;
  const workspaceId = activeWorkspaceId;
  if (!rigPushTargets(workspaceId)) return;
  clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(() => autoPushNow(workspaceId), 250);
}

function syncRecoveredPaintAfterRigRestore(){
  if (!recoveredPaintWaitingForRig || !rigAPI()?.doc) return;
  recoveredPaintWaitingForRig = false;
  scheduleAutoPush();
}

window.addEventListener('rig-recovered', syncRecoveredPaintAfterRigRestore);

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
  pushAllPending = false; pushOnlyPending.clear();
  if (!g) return { pushed: 0, failed: 0, added: 0 };
  let pushed = 0, failed = 0, added = 0;
  const failures = [];
  const fail = (name, reason) => {
    failed++;
    failures.push(name + ': ' + reason);
  };
  for (const p of g.targets) {
    if (p.rigLayerId && !g.R.layerById(p.rigLayerId)) p.rigLayerId = null;
    if (!p.rigLayerId) {
      if (!p.canvas) { fail(p.name, 'Paint layer has no canvas'); continue; }
      let bounds;
      try { bounds = opaqueBounds(p.canvas); }
      catch (e) { fail(p.name, 'could not read Paint pixels (' + e.message + ')'); continue; }
      if (!bounds) continue;
      if (bounds.x + bounds.w > g.doc.width || bounds.y + bounds.h > g.doc.height) {
        fail(p.name, 'painted bounds ' + bounds.x + ',' + bounds.y + ' ' + bounds.w + '×' + bounds.h +
          ' exceed rig canvas ' + g.doc.width + '×' + g.doc.height);
        continue;
      }
      let data;
      try { data = p.canvas.getContext('2d').getImageData(bounds.x, bounds.y, bounds.w, bounds.h).data; }
      catch (e) { fail(p.name, 'could not read Paint pixels (' + e.message + ')'); continue; }
      const linked = g.R.addPaintLayer(p.name, bounds.x, bounds.y, bounds.w, bounds.h, data);
      if (!linked) {
        fail(p.name, 'rig rejected bounds ' + bounds.x + ',' + bounds.y + ' ' + bounds.w + '×' + bounds.h);
        continue;
      }
      p.rigLayerId = linked.id;
      p.rigX = linked.x; p.rigY = linked.y; p.rigW = linked.w; p.rigH = linked.h;
      pushed++; added++;
      rigBridgeStatus('Added "' + p.name + '" to the rig; choose its role in the Rig editor');
      continue;
    }
    const l = g.R.layerById(p.rigLayerId);
    if (!p.canvas) { fail(p.name, 'Paint layer has no canvas'); continue; }
    let sx = Math.round(l.x), sy = Math.round(l.y), sw = l.w, sh = l.h;
    const clearNeedsExpand = !!p.needsExpand;
    if (p.needsExpand) {
      try {
        const bounds = opaqueBounds(p.canvas);
        if (bounds) {
          const right = Math.max(sx + sw, bounds.x + bounds.w);
          const bottom = Math.max(sy + sh, bounds.y + bounds.h);
          sx = Math.min(sx, bounds.x); sy = Math.min(sy, bounds.y);
          sw = right - sx; sh = bottom - sy;
        }
      } catch (e) { fail(p.name, 'could not read expanded Paint bounds (' + e.message + ')'); continue; }
    }
    let data;
    try { data = p.canvas.getContext('2d').getImageData(sx, sy, sw, sh).data; }
    catch (e) { fail(p.name, 'could not read Paint pixels at ' + sx + ',' + sy + ' (' + e.message + ')'); continue; }
    const bounds = sx === l.x && sy === l.y && sw === l.w && sh === l.h ? null : { x: sx, y: sy, w: sw, h: sh };
    if (g.R.setLayerPixels(l.id, data, bounds)) {
      p.rigX = sx; p.rigY = sy; p.rigW = sw; p.rigH = sh;
      if (clearNeedsExpand) p.needsExpand = false;
      pushed++;
    } else {
      const outside = sx < 0 || sy < 0 || sx + sw > g.doc.width || sy + sh > g.doc.height;
      fail(p.name, outside
        ? 'sync bounds ' + sx + ',' + sy + ' ' + sw + '×' + sh + ' exceed rig canvas ' + g.doc.width + '×' + g.doc.height
        : 'rig rejected pixels for bounds ' + sx + ',' + sy + ' ' + sw + '×' + sh);
    }
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
    let pixels;
    try { pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data; }
    catch (e) { fail(base.name, 'could not read image asset pixels (' + e.message + ')'); }
    if (pixels) {
      if (g.R.setImageAssetPixels(g.assetWorkspaceId, canvas.width, canvas.height, pixels)) pushed++;
      else fail(base.name, 'rig rejected image asset size ' + canvas.width + '×' + canvas.height);
    }
  }
  if (pushed) g.R.redraw();
  if (pushed || failed) {
    const details = failures.slice(0, 3).join('; ') + (failures.length > 3 ? '; +' + (failures.length - 3) + ' more' : '');
    rigBridgeStatus((added ? 'Added ' + added + ' new rig layer' + (added === 1 ? '' : 's') + '; synced ' : 'Auto-synced ') +
      pushed + ' image' + (pushed === 1 ? '' : 's') + (failed ? ' (' + failed + ' failed: ' + details + ')' : ''));
  }
  if (previewMode === 'rig' && !animPreviewOn) {
    refreshRigPreview();
  }
  return { pushed, failed, added };
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
  paint_pctx.fillStyle = 'var(--bg)';
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
  updateHeadVariantControls();
  switchPaintTab(viewTab);
  schedulePaintAutosave();
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
  if (pendingPaste && pendingPaste.target !== layers[i]) cancelPendingPaste();
  const workspaceId = layers[i].assetWorkspaceId || null;
  if (workspaceId !== activeWorkspaceId) restoreLayerIsolation();
  if (i !== active) selectionRect = null;
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
  const layerAside = document.querySelector('#panelPaint main>aside:not(.right)');
  const layerScrollTop = layerAside ? layerAside.scrollTop : 0;
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
  if (layerAside) layerAside.scrollTop = layerScrollTop;
  composite();
  toast(layerIsolationOpacities ? 'Layer isolated; double-click again to restore other opacities' : 'Layer opacities restored');
}

function addLayer(name=null, silent=false){
  if(!silent) pushPaintUndo();
  restoreLayerIsolation();
  selectionRect = null;
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
  selectionRect = null;
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
    const R = rigAPI();
    const result = layers[idx].rigLayerId && R && R.renamePaintLayer
      ? R.renamePaintLayer(layers[idx].rigLayerId, nn) : null;
    dirty = true;
    if (previewMode === 'rig') refreshRigPreview();
    updateUI();
    if (result && result.chainName) toast('Added "' + nn + '" as a moving part attached to the head');
    else if (result && result.role !== 'ignore') toast('Renamed and assigned "' + nn + '" in the rig');
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
  if (!['pencil','pixel','pixel-eraser','eraser','fill','picker','select'].includes(nextTool)) return;
  tool = nextTool;
  document.querySelectorAll('#paintToolButtons [data-paint-tool]').forEach(button => {
    const selected = button.dataset.paintTool === tool;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.getElementById('paintPixelNoise').disabled = tool !== 'pixel';
  document.getElementById('paintPixelNoiseStrength').disabled = tool !== 'pixel' || !pixelBrushNoise;
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

function rectFromPoints(a, b){
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

function selectionPatch(rect){
  if (!rect || active === null) return null;
  const canvas = newLayerCanvas(rect.w, rect.h);
  canvas.getContext('2d').drawImage(layers[active].canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas;
}

function copySelection(cut=false){
  if (!selectionRect || active === null) return;
  const patch = selectionPatch(selectionRect);
  if (!patch) return;
  selectionClipboard = { canvas: patch, x: selectionRect.x, y: selectionRect.y };
  if (cut) {
    pushPaintUndo();
    layers[active].canvas.getContext('2d').clearRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    dirty = true;
    composite();
    scheduleAutoPush();
  }
  updateSelectionControls();
  toast(cut ? 'Selection cut' : 'Selection copied');
}

function pasteSelection(){
  if (!selectionClipboard || active === null) return;
  const template = layers[active];
  const maxX = Math.max(0, template.canvas.width - selectionClipboard.canvas.width);
  const maxY = Math.max(0, template.canvas.height - selectionClipboard.canvas.height);
  const x = Math.max(0, Math.min(maxX, selectionClipboard.x));
  const y = Math.max(0, Math.min(maxY, selectionClipboard.y));
  pendingPaste = { canvas: selectionClipboard.canvas, x, y, target: template };
  selectionRect = null;
  setPaintTool('select', false);
  renderSelectionOverlay();
  paint_cv.focus();
  toast('Move the pasted pixels, then press Enter to place them');
}

function movePendingPaste(dx, dy){
  if (!pendingPaste || pendingPaste.target !== layers[active]) return false;
  return movePendingPasteTo(pendingPaste.x + dx, pendingPaste.y + dy);
}

function movePendingPasteTo(x, y){
  if (!pendingPaste || pendingPaste.target !== layers[active]) return false;
  const maxX = Math.max(0, pendingPaste.target.canvas.width - pendingPaste.canvas.width);
  const maxY = Math.max(0, pendingPaste.target.canvas.height - pendingPaste.canvas.height);
  x = Math.max(0, Math.min(maxX, x));
  y = Math.max(0, Math.min(maxY, y));
  if (x === pendingPaste.x && y === pendingPaste.y) return false;
  pendingPaste.x = x;
  pendingPaste.y = y;
  renderSelectionOverlay();
  return true;
}

function commitPendingPaste(){
  if (!pendingPaste || pendingPaste.target !== layers[active]) return false;
  const paste = pendingPaste;
  pushPaintUndo();
  paste.target.canvas.getContext('2d').drawImage(paste.canvas, paste.x, paste.y);
  selectionRect = { x: paste.x, y: paste.y,
    w: Math.min(paste.canvas.width, paste.target.canvas.width - paste.x),
    h: Math.min(paste.canvas.height, paste.target.canvas.height - paste.y) };
  pendingPaste = null;
  markSelectionExpansion(selectionRect);
  dirty = true;
  composite();
  scheduleAutoPush();
  renderSelectionOverlay();
  toast('Pasted into "' + layers[active].name + '"');
  return true;
}

function cancelPendingPaste(){
  if (!pendingPaste) return false;
  pendingPaste = null;
  renderSelectionOverlay();
  toast('Paste cancelled');
  return true;
}

function nudgeSelection(dx, dy){
  if (!selectionRect || active === null || (!dx && !dy)) return false;
  const rect = selectionRect;
  const moveX = Math.max(-rect.x, Math.min(paint_cv.width - rect.x - rect.w, dx));
  const moveY = Math.max(-rect.y, Math.min(paint_cv.height - rect.y - rect.h, dy));
  if (!moveX && !moveY) return false;
  const patch = selectionPatch(rect);
  if (!patch) return false;
  pushPaintUndo();
  const ctx = layers[active].canvas.getContext('2d');
  ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
  ctx.drawImage(patch, rect.x + moveX, rect.y + moveY);
  selectionRect = { ...rect, x: rect.x + moveX, y: rect.y + moveY };
  markSelectionExpansion(selectionRect);
  dirty = true;
  composite();
  renderSelectionOverlay();
  scheduleAutoPush();
  return true;
}

function markSelectionExpansion(rect){
  const layer = active === null ? null : layers[active];
  if (layer && layer.rigLayerId && (rect.x < layer.rigX || rect.y < layer.rigY ||
      rect.x + rect.w > layer.rigX + layer.rigW || rect.y + rect.h > layer.rigY + layer.rigH)) {
    layer.needsExpand = true;
  }
}

function selectionMouseDown(pos){
  if (pos.x < 0 || pos.y < 0 || pos.x >= paint_cv.width || pos.y >= paint_cv.height) return;
  paint_cv.focus();
  if (pendingPaste) {
    selectionDrag = { mode: 'paste', start: pos, x: pendingPaste.x, y: pendingPaste.y };
    return;
  }
  const current = selectionRect;
  const inside = current && pos.x >= current.x && pos.y >= current.y &&
    pos.x < current.x + current.w && pos.y < current.y + current.h;
  selectionDrag = inside
    ? { mode: 'move', start: pos, rect: current, image: selectionPatch(current) }
    : { mode: 'select', start: pos, rect: rectFromPoints(pos, pos) };
  if (selectionDrag.mode === 'select') renderSelectionOverlay({ rect: selectionDrag.rect });
}

function selectionMouseMove(pos){
  if (!selectionDrag) return;
  pos = { x: Math.max(0, Math.min(paint_cv.width - 1, pos.x)),
    y: Math.max(0, Math.min(paint_cv.height - 1, pos.y)) };
  if (selectionDrag.mode === 'select') {
    selectionDrag.rect = rectFromPoints(selectionDrag.start, pos);
    renderSelectionOverlay({ rect: selectionDrag.rect });
    return;
  }
  if (selectionDrag.mode === 'paste') {
    const dx = pos.x - selectionDrag.start.x, dy = pos.y - selectionDrag.start.y;
    movePendingPasteTo(selectionDrag.x + dx, selectionDrag.y + dy);
    return;
  }
  const dx = Math.max(-selectionDrag.rect.x, Math.min(paint_cv.width - selectionDrag.rect.x - selectionDrag.rect.w,
    pos.x - selectionDrag.start.x));
  const dy = Math.max(-selectionDrag.rect.y, Math.min(paint_cv.height - selectionDrag.rect.y - selectionDrag.rect.h,
    pos.y - selectionDrag.start.y));
  selectionDrag.dx = dx;
  selectionDrag.dy = dy;
  const rect = { ...selectionDrag.rect, x: selectionDrag.rect.x + dx, y: selectionDrag.rect.y + dy };
  renderSelectionOverlay({ rect, image: selectionDrag.image, x: rect.x, y: rect.y });
}

function finishSelectionDrag(){
  if (!selectionDrag) return;
  const drag = selectionDrag;
  selectionDrag = null;
  if (drag.mode === 'select') selectionRect = drag.rect;
  else if (drag.mode === 'paste') return;
  else if ((drag.dx || drag.dy) && active !== null) {
    pushPaintUndo();
    const ctx = layers[active].canvas.getContext('2d');
    ctx.clearRect(drag.rect.x, drag.rect.y, drag.rect.w, drag.rect.h);
    ctx.drawImage(drag.image, drag.rect.x + drag.dx, drag.rect.y + drag.dy);
    selectionRect = { ...drag.rect, x: drag.rect.x + drag.dx, y: drag.rect.y + drag.dy };
    markSelectionExpansion(selectionRect);
    dirty = true;
    composite();
    scheduleAutoPush();
  }
  renderSelectionOverlay();
}

function pickCanvasColor(x, y){
  if (x < 0 || y < 0 || x >= paint_cv.width || y >= paint_cv.height) return;
  const pixel = paint_ctx.getImageData(x, y, 1, 1).data;
  if (pixel[3] === 0) return;
  setColor('#' + [pixel[0], pixel[1], pixel[2]]
    .map(channel=>channel.toString(16).padStart(2, '0')).join(''));
}

function varyPixelBrushColor(hex, amount){
  const tone = 1 + (Math.random() * 2 - 1) * amount / 100;
  const channels = [1, 3, 5].map(offset=>Math.max(0, Math.min(255,
    Math.round(parseInt(hex.slice(offset, offset + 2), 16) * tone))));
  return '#' + channels.map(channel=>channel.toString(16).padStart(2, '0')).join('');
}

function paintPixelLine(g, from, to, erase=false, noisy=false){
  const dx = to.x - from.x, dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const leftOffset = Math.floor(brushSize / 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(from.x + dx * i / steps);
    const y = Math.round(from.y + dy * i / steps);
    g.fillStyle = erase ? '#000' : noisy ? varyPixelBrushColor(color, pixelBrushNoiseStrength) : color;
    g.fillRect(x - leftOffset, y - leftOffset, brushSize, brushSize);
  }
  g.globalCompositeOperation = 'source-over';
}

function paint(x,y){
  if(active===null) return;
  const g = layers[active].canvas.getContext('2d');
  const clipSelection = selectionRect && tool !== 'fill' && tool !== 'picker';
  if (clipSelection) {
    g.save();
    g.beginPath();
    g.rect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    g.clip();
  }
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
    paintPixelLine(g, lastPos || {x,y}, {x,y}, false, pixelBrushNoise);
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
    floodFill(g, x, y, color, selectionRect);
  } else if(tool==='picker'){
    const px = g.getImageData(x,y,1,1).data;
    setColor('#'+px[0].toString(16).padStart(2,'0')+px[1].toString(16).padStart(2,'0')+px[2].toString(16).padStart(2,'0'));
  }
  if (clipSelection) g.restore();
  if (active !== null && layers[active].rigLayerId) {
    const p = layers[active];
    if (tool === 'fill' || ((tool === 'pencil' || tool === 'pixel') && (x - brushSize / 2 < p.rigX ||
        y - brushSize / 2 < p.rigY || x + brushSize / 2 > p.rigX + p.rigW ||
        y + brushSize / 2 > p.rigY + p.rigH))) p.needsExpand = true;
  }
  dirty = true;
  composite();
  if (tool !== 'picker') scheduleAutoPush(layers[active]);
}

function floodFill(g, sx, sy, newColor, bounds=null){
  const w = g.canvas.width, h = g.canvas.height;
  if (bounds && (sx < bounds.x || sy < bounds.y || sx >= bounds.x + bounds.w || sy >= bounds.y + bounds.h)) return;
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
      if(nx>=0&&nx<w&&ny>=0&&ny<h&&(!bounds||
          (nx>=bounds.x&&nx<bounds.x+bounds.w&&ny>=bounds.y&&ny<bounds.y+bounds.h))) stack.push({x:nx,y:ny});
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
  const paintArea = document.getElementById('paintViewport');
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
  if (e.button === 2) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    pickCanvasColor(pos.x, pos.y);
    return;
  }
  if(e.button!==0||active===null) return;
  if (tool === 'select') {
    e.preventDefault();
    isDown = true;
    selectionMouseDown(getCanvasPos(e));
    paint_wrap.classList.add('painting');
    return;
  }
  pushPaintUndo();                 // one snapshot per stroke
  isDown = true;
  lastPos = getCanvasPos(e);
  paint(lastPos.x, lastPos.y);
  paint_wrap.classList.add('painting');
});
paint_cv.addEventListener('contextmenu', e=>e.preventDefault());
window.addEventListener('mouseup', e=>{
  if(!isDown) return;
  isDown = false;
  lastPos = null;
  finishSelectionDrag();
  paint_wrap.classList.remove('painting');
});
paint_cv.addEventListener('mousemove', e=>{
  if(!isDown) return;
  const pos = getCanvasPos(e);
  if (selectionDrag) {
    selectionMouseMove(pos);
    return;
  }
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
document.getElementById('paintSelectionCopy').onclick = ()=>copySelection(false);
document.getElementById('paintSelectionCut').onclick = ()=>copySelection(true);
document.getElementById('paintSelectionPaste').onclick = pasteSelection;
document.getElementById('paintSelectionConfirm').onclick = commitPendingPaste;
document.getElementById('paintSelectionCancel').onclick = cancelPendingPaste;
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
document.getElementById('paintPixelNoise').onchange = e=>{
  pixelBrushNoise = e.target.checked;
  document.getElementById('paintPixelNoiseStrength').disabled = tool !== 'pixel' || !pixelBrushNoise;
  dirty = true;
  schedulePaintAutosave();
};
document.getElementById('paintPixelNoiseStrength').onchange = e=>{
  pixelBrushNoiseStrength = [4, 8, 12, 20].includes(Number(e.target.value)) ? Number(e.target.value) : 4;
  dirty = true;
  schedulePaintAutosave();
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
    dirty = true;
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
  selectionRect = null;
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
document.getElementById('paintRestoreAutosave').onclick = restorePaintAutosave;
document.getElementById('paintDiscardAutosave').onclick = discardPaintAutosave;
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
window.addEventListener('keydown', (e)=>{
  if (document.body.dataset.mode !== 'paint') return;
  // the rig editor underneath must not see keys while painting (its Ctrl+Z would undo the rig, arrows would move rig layers)
  if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) e.stopPropagation();
  if (e.key === 'Escape') closeLayerMenu();
  if (viewTab !== 'paint') return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
  const k = e.key.toLowerCase();
  const directions = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
  };
  if (directions[e.key] && active !== null &&
      ((pendingPaste && pendingPaste.target === layers[active]) || (selectionRect && (e.ctrlKey || e.metaKey || e.shiftKey)))) {
    e.preventDefault();
    const [dx, dy] = directions[e.key];
    const distance = e.shiftKey && !(e.ctrlKey || e.metaKey) ? 10 : 1;
    if (pendingPaste) movePendingPaste(dx * distance, dy * distance);
    else nudgeSelection(dx * distance, dy * distance);
    return;
  }
  if (pendingPaste && e.key === 'Enter') {
    e.preventDefault();
    commitPendingPaste();
    return;
  }
  if (pendingPaste && e.key === 'Escape') {
    e.preventDefault();
    cancelPendingPaste();
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (!cancelPendingPaste()) undoPaint();
    }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoPaint(); }
    else if (k === 'a' && active !== null) {
      e.preventDefault();
      selectionRect = { x: 0, y: 0, w: paint_cv.width, h: paint_cv.height };
      setPaintTool('select', false);
      renderSelectionOverlay();
    } else if (k === 'c' && selectionRect) { e.preventDefault(); copySelection(false); }
    else if (k === 'x' && selectionRect) { e.preventDefault(); copySelection(true); }
    else if (k === 'v' && selectionClipboard && active !== null) { e.preventDefault(); pasteSelection(); }
    return;
  }
  if (e.key === 'Escape' && selectionRect) {
    selectionRect = null;
    renderSelectionOverlay();
  } else if (selectionRect && active !== null &&
      ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const distance = e.shiftKey ? 10 : 1;
    nudgeSelection(e.key === 'ArrowLeft' ? -distance : e.key === 'ArrowRight' ? distance : 0,
      e.key === 'ArrowUp' ? -distance : e.key === 'ArrowDown' ? distance : 0);
  }
}, true);
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
  dirty = true; composite(); scheduleAutoPush(layers[active]); toast('Flipped horizontal');
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
  dirty = true; composite(); scheduleAutoPush(layers[active]); toast('Flipped vertical');
};
document.getElementById('paintBtnRotate').onclick = ()=>{
  if(active===null) return;
  pushPaintUndo();
  const c = layers[active].canvas;
  const tmp = newLayerCanvas(c.height, c.width);
  const tg = tmp.getContext('2d');
  tg.translate(c.height/2, c.width/2);
  tg.rotate(Math.PI/2);
  tg.drawImage(c, -c.width/2, -c.height/2);
  layers[active].canvas = tmp;
  paint_cv.width = tmp.width; paint_cv.height = tmp.height;
  autoFit = true;
  dirty = true; composite(); scheduleAutoPush(layers[active]); toast('Rotated 90°');
};

function loadImage(file){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = newLayerCanvas(img.width, img.height);
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
dirty = false;
restorePaintContext();
renderColorPalettes();
populateAnimClips();
updateUI(); composite();
window.addEventListener('pagehide', flushPaintAutosave);
RIG.recoveryStore.get('paint').then(saved=>{
  if (saved) showPaintRecovery(saved);
  else setPaintAutosaveReady();
}).catch(e=>{
  console.error('Could not check the Paint recovery draft', e);
  document.getElementById('paintAutosaveStatus').textContent = 'Paint autosave unavailable: ' + e.message;
  toast('Paint autosave unavailable: ' + e.message, 7000);
  paintAutosaveReady = true;
});



// ============================================================================
// Rig <-> Paint bridge
// The rig editor lives in its own closure, so everything here goes through the
// small API it publishes on window.__rigEditor (layerById / layersForPaint /
// setLayerPixels / snapshot / redraw / toastMsg).
// ============================================================================
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
    rigLayerId: l.id, rigX: l.x, rigY: l.y, rigW: l.w, rigH: l.h,
    ...(l.paintReplacedLayerIds ? { rigReplacedLayerIds: [...l.paintReplacedLayerIds] } : {}) };
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
  const sourceChain = doc.chains.find(chain => chain.source && chain.segs.some(seg => seg.layer === layerId));
  const sourceId = sourceChain ? sourceChain.source : layerId;
  const l = R.layersForPaint().find(layer => layer.id === sourceId) || R.layerById(sourceId);
  if (!l) { toast('Layer not found in the rig'); return; }
  if (!fitPaintToRig(doc)) return;
  selectionRect = null;
  if (paintCanvasIsBlank()) { layers = []; active = null; }
  pushPaintUndo();
  restoreLayerIsolation();
  activeWorkspaceId = null;
  const replacedIds = new Set(l.paintReplacedLayerIds || []);
  const activeLayer = active === null ? null : layers[active];
  if (replacedIds.size) {
    layers = layers.filter(layer => !replacedIds.has(layer.rigLayerId));
    active = activeLayer ? layers.indexOf(activeLayer) : null;
    if (active < 0) active = null;
  }
  const pl = makePaintLayer(l);
  const existingIndex = layers.findIndex(p => p.rigLayerId === l.id);
  if (existingIndex >= 0) layers[existingIndex] = pl; else layers.push(pl);
  active = existingIndex >= 0 ? existingIndex : layers.length - 1;
  setActive(active);
  dirty = true;
  populateAnimClips();
  useWholeRigPreview();
  updateUI(); focusPaintLayer(active); composite();
  rigBridgeStatus('Imported "' + pl.name + '" (' + l.w + 'x' + l.h + ')');
  toast('Imported rig layer: ' + pl.name);
}

function importAllRigAssets() {
  const R = rigAPI(), doc = R && R.doc;
  if (!doc) { toast('Open a rig first'); return; }
  const flat = R.layersForPaint();
  if (!flat.length) { toast('The rig has no layers to import'); return; }
  const mb = Math.round(flat.length * doc.width * doc.height * 4 / 1048576);
  if (mb > 1200 && !confirm('Importing all ' + flat.length + ' layers of this ' + doc.width + '×' + doc.height + ' character needs about ' + mb + ' MB of memory, which can crash the browser tab.\n\nTip: double-click a single layer in the rig editor to paint just that one.\n\nImport them all anyway?')) return;
  if (!fitPaintToRig(doc)) return;
  selectionRect = null;
  if (paintCanvasIsBlank()) { layers = []; active = null; }
  pushPaintUndo();
  restoreLayerIsolation();
  const replacedIds = new Set(flat.flatMap(layer => layer.paintReplacedLayerIds || []));
  if (replacedIds.size) {
    const activeLayer = active === null ? null : layers[active];
    layers = layers.filter(layer => !replacedIds.has(layer.rigLayerId));
    active = activeLayer ? layers.indexOf(activeLayer) : null;
    if (active < 0) active = null;
  }
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
  updateUI(); focusPaintLayer(active); composite();
  rigBridgeStatus('Imported ' + n + ' rig layer(s) at ' + paint_cv.width + 'x' + paint_cv.height);
  toast('Imported ' + n + ' rig layer(s)');
}

function pushPaintToRig() {
  const R = window.__rigEditor, doc = R && R.doc;
  if (!doc) { toast('Open a rig first'); return; }
  if (!rigPushTargets()) { toast('Nothing to push: import a rig layer or open an image asset first'); return; }
  pushAllPending = true;
  const result = autoPushNow();
  if (result.pushed) toast('Pushed ' + result.pushed + ' image(s) to the rig', 2500);
  else if (result.failed) toast('Could not push: check that the painted pixels fit inside the rig canvas', 7000);
  else toast('Nothing to push: draw visible pixels on a Paint layer first');
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

function updateHeadVariantControls(){
  const tools = document.getElementById('paintHeadVariantTools');
  const list = document.getElementById('paintHeadVariantList');
  const action = document.getElementById('paintHeadVariantAction');
  if (!tools || !list || !action) return;
  const R = rigAPI();
  const variants = R && R.headVariantsForPaint && activeWorkspaceId
    ? R.headVariantsForPaint(activeWorkspaceId) : [];
  const available = variants.filter(variant => !variant.isCurrent);
  tools.hidden = !available.length;
  if (!available.length) { list.replaceChildren(); return; }
  const checked = new Set([...list.querySelectorAll('input:checked')].map(input=>input.value));
  const visible = available.filter(variant => action.value !== 'default' || variant.hasDefault);
  list.replaceChildren();
  if (!visible.length) {
    const note = document.createElement('span');
    note.className = 'muted';
    note.style.fontSize = '10px';
    note.textContent = 'No head variants have a game default to restore.';
    list.appendChild(note);
    return;
  }
  visible.forEach(variant=>{
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0;font-size:10px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = variant.id;
    checkbox.checked = checked.has(variant.id);
    const name = document.createElement('span');
    name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    name.textContent = variant.name + (variant.isCustomized ? ' · custom' : '');
    label.title = variant.name + ' (' + variant.w + '×' + variant.h + ')';
    label.append(checkbox, name);
    list.appendChild(label);
  });
}

function applyHeadVariantAction(){
  const R = rigAPI();
  if (!R || !R.applyHeadVariants || !activeWorkspaceId) return;
  const targets = [...document.querySelectorAll('#paintHeadVariantList input:checked')].map(input=>input.value);
  if (!targets.length) { toast('Select at least one head variant'); return; }
  const variants = R.headVariantsForPaint(activeWorkspaceId);
  const names = targets.map(id=>variants.find(variant=>variant.id===id)?.name).filter(Boolean);
  const action = document.getElementById('paintHeadVariantAction').value;
  if (action === 'default' && !confirm('Restore the game default art for ' + names.join(', ') + '?')) return;
  let source = null;
  if (action !== 'default') {
    source = { w: paint_cv.width, h: paint_cv.height, rgba: paint_ctx.getImageData(0, 0, paint_cv.width, paint_cv.height).data };
  }
  if (!R.applyHeadVariants(activeWorkspaceId, targets, action, source)) {
    toast('Could not update the selected head variants', 6000);
    return;
  }
  populateImageAssets();
  updateUI();
  composite();
  toast(action === 'default' ? 'Restored game defaults for ' + targets.length + ' head variant(s)' :
    'Updated ' + targets.length + ' head variant(s)');
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
  selectionRect = null;
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
  on('paintBtnApplyHeadVariants', applyHeadVariantAction);
  on('paintBtnPushRig', pushPaintToRig);
  on('paintBtnRigPreview', renderRigPreview);
  const filter = document.getElementById('paintImageAssetFilter');
  if (filter) filter.oninput = populateImageAssets;
  const variantAction = document.getElementById('paintHeadVariantAction');
  if (variantAction) variantAction.onchange = updateHeadVariantControls;
  populateImageAssets();
}

initRigIntegration();


  document.getElementById('paintBtnBack').onclick = () => window.switchMode('rig');
  window.LunaPaint = {
    open: () => window.switchMode('paint'),
    close: () => window.switchMode('rig'),
    /** paint one rig layer (double-click in the layer list) */
    paintLayer: (id) => { window.switchMode('paint'); importRigLayer(id); },
    /** read-only look at the paint session (for testing and bug reports) */
    state: () => ({ layers: layers.map(l => ({ name: l.name, rigLayerId: l.rigLayerId || null, rig: [l.rigX, l.rigY, l.rigW, l.rigH], expand: !!l.needsExpand, w: l.canvas && l.canvas.width, h: l.canvas && l.canvas.height })), active, tool, canvas: [paint_cv.width, paint_cv.height] })
  };
  // the button in the editor's top bar
  const btn = document.createElement('button'); btn.id = 'btnPaint'; btn.textContent = '🖌 Sprite Paint';
  btn.title = 'Draw and repaint sprites right here: rig layers, game sprites, gear, health-screen art. Double-click a layer to paint it.';
  btn.onclick = () => window.switchMode(document.body.dataset.mode === 'paint' ? 'rig' : 'paint');
  const anchor = document.getElementById('btnHelp'); if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor);
})();
