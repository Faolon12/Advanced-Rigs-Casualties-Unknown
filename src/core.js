// ===================== Advanced Rigs editor: core (no DOM) =====================
// Everything here must match the mod (RigDefinition.cs / RigInstance.cs).
'use strict';

const RIG = {};

// ---------- game skeleton (from the game's scene: rest pose of Experiment/Body) ----------
RIG.PPU = 8;
RIG.PARTS = ['Head', 'UpTorso', 'DownTorso', 'UpArmF', 'DownArmF', 'HandF', 'UpArmB', 'DownArmB', 'HandB',
  'ThighF', 'CrusF', 'FootF', 'ThighB', 'CrusB', 'FootB'];
RIG.PART_LABEL = {
  Head: 'Head', UpTorso: 'Chest (upper torso)', DownTorso: 'Belly (lower torso)',
  UpArmF: 'Upper arm (near)', DownArmF: 'Forearm (near)', HandF: 'Hand (near)',
  UpArmB: 'Upper arm (far)', DownArmB: 'Forearm (far)', HandB: 'Hand (far)',
  ThighF: 'Thigh (near)', CrusF: 'Shin (near)', FootF: 'Foot (near)',
  ThighB: 'Thigh (far)', CrusB: 'Shin (far)', FootB: 'Foot (far)', tail: 'Tail base (game tail)'
};
// units, y up, degrees
RIG.REST = {
  Head: [0, 2.5, 0], UpTorso: [0, 1.25, 0], DownTorso: [0, 0.25, 0],
  UpArmF: [-0.118, 0.876, 0], DownArmF: [-0.118, -0.373, 0], HandF: [-0.118, -1.24, 0],
  UpArmB: [-0.118, 0.876, 0], DownArmB: [-0.118, -0.373, 0], HandB: [-0.118, -1.24, 0],
  ThighF: [-0.119, -0.563, 0], CrusF: [-0.005, -1.501, 0], FootF: [0.157, -2.415, 30],
  ThighB: [-0.119, -0.563, 0], CrusB: [-0.005, -1.501, 0], FootB: [0.157, -2.415, 30],
  tail: [0, -0.103, 23.6]
};
RIG.ORDER = {
  Head: 50, UpTorso: 20, DownTorso: 10, UpArmF: 150, DownArmF: 160, HandF: 170, UpArmB: -50, DownArmB: -60, HandB: -40,
  ThighF: 100, CrusF: 90, FootF: 80, ThighB: -10, CrusB: -20, FootB: -30, tail: 0
};
// size of the game's own sprites (for the ghost skeleton)
RIG.VANILLA_SIZE = {
  Head: [26, 12], UpTorso: [8, 10], DownTorso: [8, 10], UpArmF: [4, 12], DownArmF: [4, 14], HandF: [6, 4],
  UpArmB: [4, 12], DownArmB: [4, 14], HandB: [5, 4], ThighF: [6, 11], CrusF: [4, 8], FootF: [6, 11],
  ThighB: [6, 11], CrusB: [4, 8], FootB: [6, 11]
};
// rough joint (hinge) positions, units – only used for the walk animation in the preview
RIG.HINGE = { UpArm: [-0.118, 1.5], DownArm: [-0.118, 0.45], Hand: [-0.118, -1.0], Thigh: [-0.119, 0.05], Crus: [-0.005, -1.1], Foot: [0.05, -1.95] };
RIG.HEAD_STATES = ['experimentHeadBackMouth', 'experimentHeadBackMouthMini', 'experimentHeadDisfigured1', 'experimentHeadDisfigured1Healed', 'experimentHeadDisfigured2',
  'experimentHeadDisfigured2Healed', 'experimentHeadDisfigured3', 'experimentHeadDisfigured3Healed'];
RIG.HIDEABLE = ['Eyes', 'Nosebleed'];
// the game's eye sprites (a 26x12 overlay drawn at the head's centre). The game picks one every frame from the
// character's state: pain, fear, falling, tiredness, happiness, blinking, looking back, an eye torn out.
RIG.EYE_STATES = [
  ['experimentEyeOpen', 'Open (normal)'], ['experimentEyeLookBack', 'Open, looking back'],
  ['experimentEyeHalfClosed', 'Half closed (tired, mid-blink)'], ['experimentEyeHalfClosedBack', 'Half closed, looking back'],
  ['experimentEyeClosed', 'Closed (blink, asleep, unconscious, in water)'],
  ['experimentEyeScared', 'Scared (shock, bleeding, falling)'], ['experimentEyeScaredBack', 'Scared, looking back'],
  ['experimentEyePanic', 'Panic (agony, falling fast)'], ['experimentEyeSad', 'Sad / crying'], ['experimentEyeSadBack', 'Sad, looking back'],
  ['experimentEyeHappy', 'Happy'], ['experimentEyeGone', 'Eye torn out'], ['experimentEyeGoneHealed', 'Eye torn out (healed)']];
RIG.EYE_LABEL = Object.fromEntries(RIG.EYE_STATES);
RIG.isEyeState = (k) => !!RIG.EYE_LABEL[k];
// the game's own sprites: frame size and where the drawing sits in it (from the game files), so a PSD/PNGs with
// layers named like them can be put together exactly like the game does
RIG.STOCK = {
  experimentHeadBack: { part: 'Head', w: 26, h: 12, bb: [0, 0, 20, 12] }, experimentHead: { part: 'Head', w: 26, h: 12, bb: [0, 0, 20, 12], alt: true },
  experimentUpTorso: { part: 'UpTorso', w: 8, h: 10, bb: [0, 0, 7, 10] }, experimentDownTorso: { part: 'DownTorso', w: 8, h: 10, bb: [0, 0, 7, 10] },
  experimentUpArm: { part: 'UpArm', both: true, w: 4, h: 12, bb: [0, 0, 4, 11] }, experimentDownArm: { part: 'DownArm', both: true, w: 4, h: 14, bb: [0, 0, 4, 13] },
  experimentHandF: { part: 'HandF', w: 6, h: 4, bb: [0, 0, 5, 4] }, experimentHandB: { part: 'HandB', w: 5, h: 4, bb: [0, 0, 5, 4] },
  experimentThigh: { part: 'Thigh', both: true, w: 6, h: 11, bb: [0, 0, 6, 11] }, experimentCrus: { part: 'Crus', both: true, w: 4, h: 8, bb: [0, 0, 4, 8] },
  experimentFoot: { part: 'Foot', both: true, w: 6, h: 11, bb: [0, 0, 6, 11], spriteRot: true },
  experimentTail: { tail: true, w: 48, h: 20, bb: [0, 0, 22, 20] },
  experimentHeadBackMouth: { state: 'experimentHeadBackMouth', w: 26, h: 18, bb: [0, 3, 20, 16] },
  experimentHeadBackMouthMini: { state: 'experimentHeadBackMouthMini', w: 26, h: 18, bb: [0, 3, 20, 15] },
  experimentHeadDisfigured1: { state: 'experimentHeadDisfigured1', w: 26, h: 12, bb: [0, 0, 20, 12] }, experimentHeadDisfigured1Healed: { state: 'experimentHeadDisfigured1Healed', w: 26, h: 12, bb: [0, 0, 20, 12] },
  experimentHeadDisfigured2: { state: 'experimentHeadDisfigured2', w: 26, h: 12, bb: [0, 0, 19, 12] }, experimentHeadDisfigured2Healed: { state: 'experimentHeadDisfigured2Healed', w: 26, h: 12, bb: [0, 0, 19, 12] },
  experimentHeadDisfigured3: { state: 'experimentHeadDisfigured3', w: 26, h: 12, bb: [0, 0, 20, 12] }, experimentHeadDisfigured3Healed: { state: 'experimentHeadDisfigured3Healed', w: 26, h: 12, bb: [0, 0, 20, 12] },
  experimentEyeOpen: { eye: 1, bb: [12, 6, 16, 9] }, experimentEyeLookBack: { eye: 1, bb: [12, 6, 16, 9] }, experimentEyeHalfClosed: { eye: 1, bb: [11, 6, 16, 9] },
  experimentEyeHalfClosedBack: { eye: 1, bb: [11, 6, 16, 9] }, experimentEyeClosed: { eye: 1, bb: [11, 7, 16, 9] }, experimentEyeScared: { eye: 1, bb: [10, 4, 16, 10] },
  experimentEyeScaredBack: { eye: 1, bb: [10, 4, 16, 10] }, experimentEyePanic: { eye: 1, bb: [11, 5, 18, 12] }, experimentEyeSad: { eye: 1, bb: [11, 4, 17, 11] },
  experimentEyeSadBack: { eye: 1, bb: [11, 4, 17, 11] }, experimentEyeHappy: { eye: 1, bb: [10, 3, 18, 10] }, experimentEyeGone: { eye: 1, bb: [11, 6, 16, 11] },
  experimentEyeGoneHealed: { eye: 1, bb: [11, 6, 17, 10] }
};
for (const k in RIG.STOCK) if (RIG.STOCK[k].eye) Object.assign(RIG.STOCK[k], { w: 26, h: 12 });
RIG.stockName = (name) => { const n = String(name).replace(/\.png$/i, '').replace(/[\s_\-]*(\(?copy\)?|\d+)?$/i, '').trim(); return RIG.STOCK[n] ? n : (RIG.STOCK[name] ? name : null); };
// character sounds a rig can replace (the mod also accepts any exact game sound name)
RIG.SOUNDS = [['pain', 'Whimper / pain'], ['bark', 'Bark'], ['growl', 'Growl'], ['speech', 'Talking blips'], ['speechbad', 'Talking blips (impaired)'],
  ['yawn', 'Yawn'], ['pant', 'Panting / breathing loop'], ['exert', 'Effort grunt'], ['vomit', 'Vomit'], ['dogshake', 'Shake off water'],
  ['stretch', 'Stretch'], ['gore', 'Gore (getting hurt)'], ['disfigure', 'Disfigured']];
RIG.HEAD_STATE_LABEL = { experimentHeadBack: 'Normal head (the game\'s default)', experimentHeadBackMouth: 'Mouth open (talking, eating, whimpering, barking)',
  experimentHeadBackMouthMini: 'Mouth half open (talking, eating)', experimentHeadDisfigured1: 'Jaw ripped off 1', experimentHeadDisfigured2: 'Jaw ripped off 2',
  experimentHeadDisfigured3: 'Jaw ripped off 3', experimentHeadDisfigured1Healed: 'Jaw ripped off 1 (healed)', experimentHeadDisfigured2Healed: 'Jaw ripped off 2 (healed)',
  experimentHeadDisfigured3Healed: 'Jaw ripped off 3 (healed)' };
// injury states an injurable piece can show art for (most important first, same order as the mod)
RIG.INJURY_STATES = [
  ['stump', 'Stump (what is below it was cut / torn off)'], ['broken', 'Broken bone'], ['dislocated', 'Dislocated'], ['splinted', 'Splinted'],
  ['shrapnel', 'Shards / shrapnel in it'], ['tourniquet', 'Tourniquet on it'], ['bandaged', 'Bandaged (bandage, gauze, alginate, ash…)'],
  ['frostbite', 'Frostbitten (chilled)'], ['infected', 'Infected (infection 25%+)'], ['disinfected', 'Disinfected'],
  ['bleeding', 'Bleeding'], ['mangled', 'Mangled (muscle under 35%)'], ['wounded', 'Wounded (skin under 40%)'], ['scratched', 'Scratched (skin under 75%)']];
// actions a part can have animation frames for (same as the mod), and what each falls back to
// the states the game itself has (the mod picks one every frame, in this priority: dead, sleep, down, swim, climb,
// attack, exercise, wall slide / jump / fall, crouch, sit, run, walk, idle)
RIG.ACTIONS = [['always', 'Always (loops all the time)'], ['idle', 'Standing still'], ['walk', 'Walking'], ['run', 'Running'], ['crouch', 'Crouching'],
  ['jump', 'Jumping (going up)'], ['fall', 'Falling'], ['wallslide', 'Sliding down a wall'], ['climb', 'Climbing (ladder / rope)'], ['swim', 'In water'],
  ['attack', 'Attacking (swing)'], ['sit', 'Sitting (idle 12 s)'], ['exercise', 'Exercising'], ['sleep', 'Sleeping'],
  ['down', 'Knocked down / ragdoll'], ['dead', 'Dead']];
RIG.ACTION_FALLBACK = { jump: ['fall', 'idle'], fall: ['jump', 'idle'], wallslide: ['fall', 'jump', 'idle'], run: ['walk', 'idle'], walk: ['idle'], crouch: ['idle'], climb: ['idle'],
  swim: ['idle'], attack: ['idle'], sit: ['idle'], exercise: ['idle'], sleep: ['down', 'idle'], down: ['idle'], dead: ['down', 'idle'], idle: [] };
// every key an animation set can have: actions, then injury states (an injury animation beats the action one)
RIG.ANIM_KEYS = [...RIG.ACTIONS, ...RIG.INJURY_STATES.map(([k, l]) => [k, 'When injured: ' + l])];
RIG.isInjuryKey = (k) => RIG.INJURY_STATES.some(([s]) => s === k);
RIG.resolveAction = function (sets, action) {
  if (!sets) return null;
  if (sets[action]) return action;
  for (const f of (RIG.ACTION_FALLBACK[action] || [])) if (sets[f]) return f;
  return sets.always ? 'always' : null;
};
RIG.FRAME_RE = /^(.*?)[\s_\-]*(always|idle|walk|walking|run|running|crouch|jump|jumping|fall|falling|wallslide|climb|swim|attack|sit|exercise|sleep|down|dead|stump|broken|dislocated|splinted|shrapnel|bandaged|tourniquet|frostbite|infected|disinfected|bleeding|mangled|wounded|scratched|frame|f|anim)[\s_\-]*(\d+)$/i;
RIG.defaultInjury = (name) => ({ enabled: false, name: name || 'Part', tearOff: true, gameShading: true, vital: false });
// which game sprite each part shows (for drawing skins / sprite swaps)
RIG.PART_SPRITE = { Head: 'experimentHead', UpTorso: 'experimentUpTorso', DownTorso: 'experimentDownTorso', UpArmF: 'experimentUpArm', UpArmB: 'experimentUpArm',
  DownArmF: 'experimentDownArm', DownArmB: 'experimentDownArm', HandF: 'experimentHandF', HandB: 'experimentHandB', ThighF: 'experimentThigh', ThighB: 'experimentThigh',
  CrusF: 'experimentCrus', CrusB: 'experimentCrus', FootF: 'experimentFoot', FootB: 'experimentFoot', tail: 'experimentTail' };

RIG.PRESETS = {
  'Fluffy tail': { damping: 0.15, elasticity: 0.06, elasticityFalloff: 0.5, stiffness: 0.1, stiffnessFalloff: 0.5, gravity: 4, drag: 2, inertia: 0.3, maxBend: 55, wagAmplitude: 10, wagSpeed: 1.4, wagPhase: 0.9, wagWhileMoving: 0.3, flapAmplitude: 0, flapSpeed: 2.5, flapPhase: 0.5, flapWhen: 'never', deadGravity: 2.5 },
  'Long whip tail': { damping: 0.2, elasticity: 0.1, elasticityFalloff: 0.4, stiffness: 0.1, stiffnessFalloff: 0.4, gravity: 4, drag: 2, inertia: 0.3, maxBend: 25, wagAmplitude: 4, wagSpeed: 1.2, wagPhase: 0.4, wagWhileMoving: 0.3, flapAmplitude: 0, flapSpeed: 2.5, flapPhase: 0.5, flapWhen: 'never', deadGravity: 2.5 },
  'Stiff tail': { damping: 0.2, elasticity: 0.2, elasticityFalloff: 0.7, stiffness: 0.4, stiffnessFalloff: 0.7, gravity: 2, drag: 1, inertia: 0.5, maxBend: 30, wagAmplitude: 6, wagSpeed: 2, wagPhase: 0.6, wagWhileMoving: 0.3, flapAmplitude: 0, flapSpeed: 2.5, flapPhase: 0.5, flapWhen: 'never', deadGravity: 2.5 },
  'Hair / ears floof': { damping: 0.22, elasticity: 0.2, elasticityFalloff: 1, stiffness: 0.35, stiffnessFalloff: 1, gravity: 2.5, drag: 1.5, inertia: 0.4, maxBend: 20, wagAmplitude: 0, wagSpeed: 1.5, wagPhase: 0.7, wagWhileMoving: 0.3, flapAmplitude: 0, flapSpeed: 2.5, flapPhase: 0.5, flapWhen: 'never', deadGravity: 2.5 },
  'Wings': { damping: 0.2, elasticity: 0.25, elasticityFalloff: 0.8, stiffness: 0.5, stiffnessFalloff: 0.8, gravity: 1.5, drag: 1, inertia: 0.5, maxBend: 40, wagAmplitude: 3, wagSpeed: 0.5, wagPhase: 0.4, wagWhileMoving: 1, flapAmplitude: 30, flapSpeed: 3, flapPhase: 0.5, flapWhen: 'air', deadGravity: 2.5 },
  'Rigid (no physics)': null
};
RIG.MOTION_KEYS = ['damping', 'elasticity', 'elasticityFalloff', 'stiffness', 'stiffnessFalloff', 'gravity', 'drag', 'inertia',
  'maxBend', 'wagAmplitude', 'wagSpeed', 'wagPhase', 'wagWhileMoving', 'flapAmplitude', 'flapSpeed', 'flapPhase', 'deadGravity'];
RIG.defaultMotion = () => Object.assign({}, RIG.PRESETS['Fluffy tail']);

// body-space rest position of a part in canvas pixels (relative to the body origin, y down)
RIG.restPx = (part) => { const r = RIG.REST[part]; return { x: r[0] * RIG.PPU, y: -r[1] * RIG.PPU }; };
RIG.J = (doc, part) => { const r = RIG.restPx(part); return { x: +(r.x + doc.align.x).toFixed(3), y: +(r.y + doc.align.y).toFixed(3) }; };

// ===================== PSD / PSB reader =====================
RIG.readPSD = function (buf) {
  const dv = new DataView(buf); let p = 0;
  const u8 = () => dv.getUint8(p++);
  const u16 = () => { const v = dv.getUint16(p); p += 2; return v; };
  const i16 = () => { const v = dv.getInt16(p); p += 2; return v; };
  const u32 = () => { const v = dv.getUint32(p); p += 4; return v; };
  const i32 = () => { const v = dv.getInt32(p); p += 4; return v; };
  const u64 = () => { const hi = u32(), lo = u32(); return hi * 4294967296 + lo; };
  const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u8()); return s; };
  if (str(4) !== '8BPS') throw new Error('Not a PSD/PSB file');
  const ver = u16(); const big = ver === 2; p += 6;
  const channels = u16(), H = u32(), W = u32(), depth = u16(), mode = u16();
  if (depth !== 8) throw new Error('Only 8-bit PSD/PSB files are supported (this one is ' + depth + '-bit). In Photoshop: Image > Mode > 8 Bits/Channel.');
  if (mode !== 3) throw new Error('Only RGB colour mode is supported. In Photoshop: Image > Mode > RGB Color.');
  const L = big ? u64 : u32;
  { const n = u32(); p += n; } // colour mode data
  { const n = u32(); p += n; } // image resources
  const lmLen = L(); if (lmLen === 0) throw new Error('This file has no layers.');
  L(); // layer info length
  const count = Math.abs(i16());
  const recs = [];
  for (let n = 0; n < count; n++) {
    const top = i32(), left = i32(), bottom = i32(), right = i32();
    const nch = u16(); const chans = [];
    for (let c = 0; c < nch; c++) chans.push({ id: i16(), len: L() });
    p += 4; p += 4; // blend sig + key
    const opacity = u8(); u8(); const flags = u8(); u8();
    const extra = u32(); const end = p + extra;
    { const n = u32(); p += n; } { const n = u32(); p += n; } // mask, blending ranges
    const nl = u8(); let name = str(nl); p += (4 - (nl + 1) % 4) % 4;
    let isDivider = false;
    while (p < end - 12) {
      const sig = str(4), key = str(4);
      if (sig !== '8BIM' && sig !== '8B64') break;
      const ln = (big && ['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD'].includes(key)) ? u64() : u32();
      const start = p;
      if (key === 'luni') { const n2 = u32(); let s = ''; for (let i = 0; i < n2; i++) s += String.fromCharCode(u16()); name = s.replace(/\0+$/, ''); }
      if (key === 'lsct' || key === 'lsdk') { const t = u32(); if (t === 1 || t === 2 || t === 3) isDivider = true; }
      p = start + ln + (ln % 2);
    }
    p = end;
    recs.push({ name, top, left, bottom, right, chans, hidden: !!(flags & 2), opacity, isDivider });
  }
  const layers = [];
  recs.forEach((r, idx) => {
    const w = r.right - r.left, h = r.bottom - r.top;
    const planes = {};
    for (const ch of r.chans) {
      const start = p; const comp = u16();
      if (w > 0 && h > 0 && ch.id >= -1) {
        if (comp === 0) planes[ch.id] = new Uint8Array(buf, p, w * h);
        else if (comp === 1) {
          const counts = []; for (let y = 0; y < h; y++) counts.push(big ? u32() : u16());
          const out = new Uint8Array(w * h); let o = 0;
          for (let y = 0; y < h; y++) {
            const rowEnd = p + counts[y]; let x = 0;
            while (p < rowEnd && x < w) {
              let hdr = dv.getInt8(p++);
              if (hdr >= 0) { for (let i = 0; i <= hdr && x < w; i++, x++) out[o++] = dv.getUint8(p++); }
              else if (hdr !== -128) { const v = dv.getUint8(p++); for (let i = 0; i < 1 - hdr && x < w; i++, x++) out[o++] = v; }
            }
            o = (y + 1) * w; p = rowEnd;
          }
          planes[ch.id] = out;
        } else throw new Error('This PSD uses ZIP compression, which isn\'t supported yet. Re-save it without compression or export the layers as PNGs.');
      }
      p = start + ch.len;
    }
    if (w <= 0 || h <= 0 || r.isDivider) return;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const R = planes[0], G = planes[1], B = planes[2], A = planes[-1];
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = R ? R[i] : 0; rgba[i * 4 + 1] = G ? G[i] : 0; rgba[i * 4 + 2] = B ? B[i] : 0; rgba[i * 4 + 3] = A ? A[i] : 255;
    }
    layers.push({ name: r.name, x: r.left, y: r.top, w, h, rgba, hidden: r.hidden, order: idx });
  });
  return { width: W, height: H, layers };
};

// crop an RGBA image to its visible pixels
RIG.crop = function (rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 0) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1; const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) out.set(rgba.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + cw) * 4), y * cw * 4);
  return { x: x0, y: y0, w: cw, h: ch, rgba: out };
};

RIG.alpha = (l, x, y) => (x >= 0 && y >= 0 && x < l.w && y < l.h) ? l.rgba[(y * l.w + x) * 4 + 3] : 0;

// ===================== auto-assign layers by name =====================
RIG.classify = function (name) {
  const st = RIG.STOCK[String(name).trim()];
  if (st) {
    if (st.eye) return { kind: 'eye', state: String(name).trim() };
    if (st.state) return { kind: 'headState', state: st.state };
    if (st.tail) return { kind: 'tail', num: 0 };
    if (st.both) return { kind: 'limb', base: st.part, side: null, stock: true };
    if (st.part.length > 4 && /[FB]$/.test(st.part) && st.part !== 'Head') return { kind: 'limb', base: st.part.slice(0, -1), side: st.part.slice(-1) };
    return { kind: 'part', base: st.part };
  }
  const n = name.toLowerCase().replace(/[\s_\-.]+/g, '');
  let side = null;
  if (/(back|far|behind|rear)/.test(n)) side = 'B';
  else if (/(front|near)/.test(n)) side = 'F';
  const has = (re) => re.test(n);
  if (has(/wing/)) return { kind: 'wing', side };
  if (has(/tail/)) return { kind: 'tail', num: parseFloat((name.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]) || 0 };
  if (has(/(antler|horn)/)) return { kind: 'rigidHead', side };
  if (has(/(head|face|skull)/)) return { kind: 'part', base: 'Head' };
  if (has(/(chest|thorax|uppertorso|uptorso|torso|ribs)/) && !has(/(lower|down|belly|abdomen)/)) return { kind: 'part', base: 'UpTorso' };
  if (has(/(abdomen|belly|stomach|hip|pelvis|lowertorso|downtorso|waist)/)) return { kind: 'part', base: 'DownTorso' };
  if (has(/(shoulder|upperarm|uparm|bicep)/)) return { kind: 'limb', base: 'UpArm', side };
  if (has(/(hand|paw|claw|fist)/)) return { kind: 'limb', base: 'Hand', side };
  if (has(/(forearm|forarm|lowerarm|downarm|arm)/)) return { kind: 'limb', base: 'DownArm', side };
  if (has(/(thigh|theigh|upperleg|upleg)/)) return { kind: 'limb', base: 'Thigh', side };
  if (has(/(calf|crus|shin|lowerleg|downleg)/)) return { kind: 'limb', base: 'Crus', side };
  if (has(/(foot|feet|hoof|hooves|toe)/)) return { kind: 'limb', base: 'Foot', side };
  if (has(/(ear|fringe|hair|bang|floof|mane|tuft|cheek|whisker|ponytail)/)) return { kind: 'floof', side };
  return { kind: 'ignore' };
};

// ===================== document =====================
let _id = 1;
RIG.newId = () => 'i' + (_id++);

RIG.newDoc = function (name, width, height, layers) {
  const doc = { name: name || 'MyCharacter', width, height, layers: [], chains: [], align: { x: width / 2, y: height * 0.56 },
    hideObjects: [], hideVanillaTail: true, spriteSwaps: {}, healthScreen: {}, anims: {}, sounds: {}, animations: {} };
  for (const l of layers) {
    const c = RIG.crop(l.rgba, l.w, l.h);
    if (!c) continue;
    doc.layers.push({ id: RIG.newId(), name: l.name, x: l.x + c.x, y: l.y + c.y, w: c.w, h: c.h, rgba: c.rgba, order: l.order, hidden: !!l.hidden,
      role: { type: 'ignore' } });
  }
  doc.layers.sort((a, b) => a.order - b.order);
  doc.layers.forEach((l, i) => l.order = i);
  return doc;
};

RIG.layer = (doc, id) => doc.layers.find(l => l.id === id);
RIG.chain = (doc, id) => doc.chains.find(c => c.id === id);
RIG.center = (l) => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });

RIG.autoAssign = function (doc) {
  // undo any cuts first: the original images come back and get sorted out by name again
  const cutPieces = []; for (const ch of doc.chains) if (ch.source) ch.segs.forEach(s => cutPieces.push(s.layer));
  if (cutPieces.length) RIG.removeLayers(doc, cutPieces);
  doc.layers.forEach(l => delete l.cutSource);
  doc.chains = [];
  const groups = {}; // base -> layers needing a side
  const tails = [], wings = [];
  const frames = [];
  doc.anims = {};
  for (const l of doc.layers) {
    if (l.role && l.role.type === 'gear') continue; // redrawn gear keeps its item
    l.role = { type: 'ignore' };
    const fm = l.name.match(RIG.FRAME_RE);
    if (fm) { frames.push({ l, base: fm[1], key: fm[2].toLowerCase(), n: +fm[3] }); l.role = { type: 'frame', of: null }; continue; }
    if (l.hidden) continue;
    const c = RIG.classify(l.name);
    if (c.kind === 'part') l.role = { type: 'part', part: c.base };
    else if (c.kind === 'limb') (groups[c.base] = groups[c.base] || []).push({ l, side: c.side });
    else if (c.kind === 'tail') tails.push({ l, num: c.num });
    else if (c.kind === 'wing') wings.push({ l, side: c.side });
    else if (c.kind === 'floof' || c.kind === 'rigidHead') {
      const ch = RIG.addChain(doc, l.name, 'Head', [l.id], c.kind === 'rigidHead' ? 'Rigid (no physics)' : 'Hair / ears floof');
      l.role = { type: 'chain', chain: ch.id };
    }
    else if (c.kind === 'eye') l.role = { type: 'eye', state: c.state };
    else if (c.kind === 'headState') l.role = { type: 'state', of: null, state: c.state };
  }
  // near/far: keep explicit sides unless they clash; otherwise lower layer = far side, higher = near side
  for (const base in groups) {
    const g = groups[base].sort((a, b) => a.l.order - b.l.order);
    const f = g.filter(x => x.side === 'F').length, b = g.filter(x => x.side === 'B').length;
    const clean = g.length <= 2 && f <= 1 && b <= 1 && (f + b === g.length);
    g.forEach((x, i) => {
      let side = clean ? x.side : (g.length === 1 ? (x.side || 'F') : (i === 0 ? 'B' : 'F'));
      x.l.role = { type: 'part', part: base + side };
    });
  }
  // head states / eyes need the head layer
  const headL = () => doc.layers.find(o => o.role.type === 'part' && o.role.part === 'Head' && !(RIG.STOCK[o.name] && RIG.STOCK[o.name].alt && doc.layers.some(p => p.name === 'experimentHeadBack')));
  // two heads named like the game's (experimentHead + experimentHeadBack): the game shows experimentHeadBack
  if (doc.layers.some(o => o.name === 'experimentHeadBack')) for (const o of doc.layers) if (o.name === 'experimentHead' && o.role.type === 'part') o.role = { type: 'ignore' };
  for (const l of doc.layers) if (l.role.type === 'state' && !l.role.of) { const h = headL(); if (h) l.role.of = h.id; else l.role = { type: 'ignore' }; }
  if (tails.length) {
    tails.sort((a, b) => a.num - b.num || b.l.order - a.l.order);
    const ch = RIG.addChain(doc, 'Tail', 'tail', tails.map(t => t.l.id), 'Fluffy tail');
    tails.forEach(t => t.l.role = { type: 'chain', chain: ch.id });
  }
  wings.sort((a, b) => a.l.order - b.l.order);
  wings.forEach((w, i) => {
    const side = w.side || (wings.length > 1 && i === 0 ? 'B' : 'F');
    const ch = RIG.addChain(doc, 'Wing ' + (side === 'B' ? 'far' : 'near'), 'UpTorso', [w.l.id], 'Wings');
    w.l.role = { type: 'chain', chain: ch.id };
  });
  // limbs drawn once for both sides (the game reuses experimentUpArm etc. for the far side): add the far copy
  RIG.addFarCopies(doc);
  if (RIG.isStockDoc(doc)) RIG.assembleStock(doc); else RIG.autoAlign(doc);
  for (const ch of doc.chains) RIG.autoBones(doc, ch);
  // link animation frames ("Wing_fall_2", "Head frame 3"...) to the layer they animate
  const norm = (x) => x.toLowerCase().replace(/[\s_\-.]+/g, '');
  const alias = { walking: 'walk', running: 'run', jumping: 'jump', falling: 'fall', frame: 'always', f: 'always', anim: 'always' };
  frames.sort((a, b) => a.n - b.n);
  for (const fr of frames) {
    const target = doc.layers.find(o => o.role.type !== 'frame' && norm(o.name) === norm(fr.base));
    if (!target) { fr.l.role = { type: 'ignore' }; continue; }
    const key = alias[fr.key] || fr.key;
    const sets = doc.anims[target.id] = doc.anims[target.id] || {};
    const set = sets[key] = sets[key] || { fps: 8, loop: !['dead', 'down'].includes(key), frames: key === 'always' ? [target.id] : [] };
    set.frames.push(fr.l.id);
    fr.l.role = { type: 'frame', of: target.id };
  }
  if (doc.layers.some(l => l.role.type === 'part' && l.role.part === 'Head')) doc.hideObjects = doc.layers.some(l => l.role.type === 'eye') ? ['Nosebleed'] : ['Eyes', 'Nosebleed'];
  doc.hideVanillaTail = doc.chains.some(c => c.attachTo === 'tail');
};

// ---- characters drawn with the game's own sprite names
RIG.isStockDoc = (doc) => doc.layers.filter(l => RIG.STOCK[l.name] || RIG.STOCK[(l.name || '').replace(/ \(far\)$/, '')]).length >= 3;
RIG.addFarCopies = function (doc) {
  for (const l of [...doc.layers]) {
    const st = RIG.STOCK[l.name]; if (!st || !st.both || l.role.type !== 'part') continue;
    const far = st.part + 'B';
    if (doc.layers.some(o => o.role.type === 'part' && o.role.part === far)) continue;
    l.role = { type: 'part', part: st.part + 'F' };
    const copy = { id: RIG.newId(), name: l.name + ' (far)', x: l.x, y: l.y, w: l.w, h: l.h, rgba: new Uint8ClampedArray(l.rgba), order: l.order - 0.5, hidden: false, role: { type: 'part', part: far } };
    if (l.spriteRot !== undefined) copy.spriteRot = l.spriteRot;
    doc.layers.push(copy);
  }
  doc.layers.sort((a, b) => a.order - b.order); doc.layers.forEach((l, i) => l.order = i);
};
// put every layer named like a game sprite exactly where the game draws that sprite (same centre pivot), using
// where the drawing sits inside the game's sprite frame; redrawn art of another size is centred on the same spot
RIG.stockPlace = function (doc, l) {
  const base = l.name.replace(/ \(far\)$/, ''); const st = RIG.STOCK[base]; if (!st) return false;
  let C;
  if (l.role.type === 'part') C = RIG.J(doc, l.role.part);
  else if (l.role.type === 'state' || l.role.type === 'eye') C = RIG.J(doc, 'Head');
  else if (l.role.type === 'chain' && st.tail) C = RIG.J(doc, 'tail');
  else return false;
  const bx = (st.bb[0] + st.bb[2]) / 2 - st.w / 2, by = (st.bb[1] + st.bb[3]) / 2 - st.h / 2; // drawing centre relative to the pivot
  l.x = Math.round(C.x + bx - l.w / 2); l.y = Math.round(C.y + by - l.h / 2);
  if (st.spriteRot && l.role.type === 'part') l.spriteRot = RIG.REST[l.role.part][2];
  return true;
};
RIG.assembleStock = function (doc) {
  // start from the game's own skeleton in the middle of the canvas, then place every game-named layer on it
  doc.align = { x: Math.round(doc.width / 2), y: Math.round(doc.height * 0.56) };
  for (const l of doc.layers) RIG.stockPlace(doc, l);
  // an unassembled file's layer order means nothing: stack like the game does (change it in the layer list)
  const key = new Map(doc.layers.map((l, i) => [l.id, RIG.sortKey(doc, l) + i * 1e-6]));
  doc.layers.sort((a, b) => key.get(a.id) - key.get(b.id)); doc.layers.forEach((l, i) => l.order = i);
  RIG.fitCanvas(doc);
};

// injury groups: groups[k] = which injurable limb piece k belongs to (-1 = can't be hurt); missing = one limb per piece
RIG.groupsOf = (ch) => (ch.injury && Array.isArray(ch.injury.groups) && ch.injury.groups.length === ch.segs.length) ? ch.injury.groups : ch.segs.map((_, k) => k);
RIG.isGroupLeader = (ch, k) => { const g = RIG.groupsOf(ch); return g[k] >= 0 && g.indexOf(g[k]) === k; };
RIG.groupCount = (ch) => new Set(RIG.groupsOf(ch).filter(g => g >= 0)).size;
RIG.addChain = function (doc, name, attachTo, layerIds, preset) {
  const m = RIG.PRESETS[preset];
  const ch = { id: RIG.newId(), name, attachTo, segs: layerIds.map(id => ({ layer: id, joint: { x: 0, y: 0 }, tip: null, restAngle: 0, maxBend: -1 })),
    physics: !!m, motion: Object.assign(RIG.defaultMotion(), m || {}), preset, offset: { x: 0, y: 0 }, injury: RIG.defaultInjury(name) };
  doc.chains.push(ch);
  return ch;
};

// one translation that puts the drawing on the game's skeleton (fit on near-side parts)
RIG.autoAlign = function (doc) {
  const use = ['Head', 'UpTorso', 'DownTorso', 'UpArmF', 'DownArmF', 'HandF', 'ThighF', 'CrusF', 'FootF'];
  let sx = 0, sy = 0, n = 0;
  for (const l of doc.layers) if (l.role.type === 'part' && use.includes(l.role.part)) {
    const c = RIG.center(l), r = RIG.restPx(l.role.part); sx += c.x - r.x; sy += c.y - r.y; n++;
  }
  if (!n) for (const l of doc.layers) if (l.role.type === 'part') { const c = RIG.center(l), r = RIG.restPx(l.role.part); sx += c.x - r.x; sy += c.y - r.y; n++; }
  if (n) doc.align = { x: Math.round(sx / n * 2) / 2, y: Math.round(sy / n * 2) / 2 };
};

// centre of the opaque pixels of layer l lying across the axis at "t" (projection along unit dir d from origin o)
function crossCenter(l, o, d, t) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    if (!RIG.alpha(l, x, y)) continue;
    const px = l.x + x + 0.5, py = l.y + y + 0.5;
    const pr = (px - o.x) * d.x + (py - o.y) * d.y;
    if (Math.abs(pr - t) <= 1.0) { sx += px; sy += py; n++; }
  }
  return n ? { x: sx / n, y: sy / n } : null;
}
function extent(l, o, d) {
  let lo = 1e9, hi = -1e9;
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
    if (!RIG.alpha(l, x, y)) continue;
    const pr = (l.x + x + 0.5 - o.x) * d.x + (l.y + y + 0.5 - o.y) * d.y;
    if (pr < lo) lo = pr; if (pr > hi) hi = pr;
  }
  return [lo, hi];
}
const r1 = (v) => Math.round(v * 2) / 2;

// place joints automatically
RIG.autoBones = function (doc, ch) {
  const base = RIG.J(doc, ch.attachTo === 'tail' ? 'DownTorso' : ch.attachTo);
  const segs = ch.segs.map(s => RIG.layer(doc, s.layer)).filter(Boolean);
  if (!segs.length) return;
  const restRot = (RIG.REST[ch.attachTo] || [0, 0, 0])[2];
  ch.segs.forEach(s => { s.restAngle = 0; s.tip = null; });
  ch.segs[0].restAngle = -restRot;
  if (segs.length === 1) {
    // single piece (ear, hair, wing): joint = its pixel nearest the body part, tip = farthest pixel from there
    const l = segs[0]; let best = null, bd = 1e9;
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (RIG.alpha(l, x, y)) {
      const px = l.x + x + 0.5, py = l.y + y + 0.5, d = (px - base.x) ** 2 + (py - base.y) ** 2;
      if (d < bd) { bd = d; best = { x: px, y: py }; }
    }
    let far = null, fd = -1;
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (RIG.alpha(l, x, y)) {
      const px = l.x + x + 0.5, py = l.y + y + 0.5, d = (px - best.x) ** 2 + (py - best.y) ** 2;
      if (d > fd) { fd = d; far = { x: px, y: py }; }
    }
    ch.segs[0].joint = { x: r1(best.x), y: r1(best.y) };
    ch.segs[0].tip = { x: r1(far.x), y: r1(far.y) };
    return;
  }
  // chain: axis from the first piece toward the last
  const c0 = RIG.center(segs[0]), cN = RIG.center(segs[segs.length - 1]);
  let d = { x: cN.x - c0.x, y: cN.y - c0.y }; const dl = Math.hypot(d.x, d.y) || 1; d = { x: d.x / dl, y: d.y / dl };
  const ext = segs.map(l => extent(l, c0, d));
  segs.forEach((l, k) => {
    let t = k === 0 ? ext[0][0] + 1.5 : (ext[k - 1][1] + ext[k][0]) / 2;
    const p = crossCenter(l, c0, d, t) || RIG.center(l);
    ch.segs[k].joint = { x: r1(p.x), y: r1(p.y) };
  });
  // the last piece points to its far end
  const lastT = ext[segs.length - 1][1] - 0.5;
  const tp = crossCenter(segs[segs.length - 1], c0, d, lastT) || RIG.center(segs[segs.length - 1]);
  ch.segs[segs.length - 1].tip = { x: r1(tp.x), y: r1(tp.y) };
};

// ===================== loose images (cropped PNGs) & adding images to a character =====================
const normName = (x) => x.toLowerCase().replace(/[\s_\-.]+/g, '');
RIG.isSideB = (name) => /(back|far|behind|rear)/.test(normName(name));
// stacking key, so loose images land in a sensible front-to-back order
RIG.sortKey = function (doc, l) {
  const r = l.role;
  if (r.type === 'part') return RIG.ORDER[r.part];
  if (r.type === 'chain') {
    const ch = RIG.chain(doc, r.chain); if (!ch) return 300;
    const k = ch.segs.findIndex(s => s.layer === l.id) * 0.01;
    if (ch.attachTo === 'tail') return 5 + k;
    if (ch.attachTo === 'Head') return (RIG.isSideB(ch.name) ? 45 : 55) + k;
    if (ch.attachTo === 'UpTorso' && /wing/i.test(ch.name)) return (RIG.isSideB(ch.name) ? -100 : -5) + k;
    return (RIG.ORDER[ch.attachTo] || 0) + 1 + k;
  }
  if (r.of) { const t = RIG.layer(doc, r.of); if (t && t !== l) return RIG.sortKey(doc, t) + 0.001; }
  if (r.type === 'eye') return 53;
  return 300;
};
// put a cropped image where it belongs on the game skeleton
RIG.placeLoose = function (doc, l) {
  if (RIG.stockPlace(doc, l)) return;
  const r = l.role, rd = Math.round;
  const at = (cx, cy) => { l.x = rd(cx - l.w / 2); l.y = rd(cy - l.h / 2); };
  if (r.type === 'part') { const J = RIG.J(doc, r.part); at(J.x, J.y); return; }
  if (r.type === 'chain') {
    const ch = RIG.chain(doc, r.chain); const k = ch.segs.findIndex(s => s.layer === l.id);
    const prev = k > 0 ? RIG.layer(doc, ch.segs[k - 1].layer) : null;
    if (ch.attachTo === 'tail') {
      if (prev) { l.x = prev.x + 1 - l.w; l.y = rd(prev.y + prev.h / 2 - l.h / 2); }
      else { const A = RIG.J(doc, 'tail'); l.x = rd(A.x + 1 - l.w); l.y = rd(A.y - l.h / 2); }
      return;
    }
    if (ch.attachTo === 'Head') {
      const H = RIG.J(doc, 'Head'); const head = doc.layers.find(o => o.role.type === 'part' && o.role.part === 'Head');
      const top = head ? head.y : H.y - 6;
      if (prev) { l.x = rd(prev.x + prev.w / 2 - l.w / 2); l.y = prev.y - l.h + 1; return; }
      l.x = rd(H.x - l.w / 2 + (RIG.isSideB(ch.name) ? -2 : 1)); l.y = top - l.h + 3; return;
    }
    if (ch.attachTo === 'UpTorso') { const U = RIG.J(doc, 'UpTorso'); if (prev) { l.x = prev.x - l.w + 1; l.y = prev.y; return; } l.x = rd(U.x - l.w + 2); l.y = rd(U.y - l.h + 3); return; }
    const J = RIG.J(doc, ch.attachTo); if (prev) { l.x = rd(prev.x + prev.w / 2 - l.w / 2); l.y = prev.y + prev.h - 1; return; } at(J.x, J.y); return;
  }
  if (r.of) { const t = RIG.layer(doc, r.of); if (t) { at(t.x + t.w / 2, t.y + t.h / 2); return; } }
  // not recognised: park it beside the character so it can be picked up and used
  const parked = doc.layers.filter(o => o._parked && o !== l);
  const y0 = parked.length ? Math.max(...parked.map(o => o.y + o.h)) + 2 : RIG.J(doc, 'Head').y - 8;
  l.x = rd(doc.align.x + 18); l.y = y0; l._parked = true;
};
// grow / shift the canvas so every layer is inside it (everything moves together, nothing changes visually)
RIG.fitCanvas = function (doc, margin) {
  margin = margin === undefined ? 4 : margin;
  let x0 = doc.align.x - 16, y0 = RIG.J(doc, 'Head').y - 12, x1 = doc.align.x + 16, y1 = RIG.J(doc, 'FootF').y + 8;
  for (const l of doc.layers) { if (l.cutSource) continue; x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y); x1 = Math.max(x1, l.x + l.w); y1 = Math.max(y1, l.y + l.h); }
  const dx = Math.round(margin - x0), dy = Math.round(margin - y0);
  if (dx || dy) RIG.shiftAll(doc, dx, dy);
  doc.width = Math.max(doc.width, Math.ceil(x1 - x0 + margin * 2)); doc.height = Math.max(doc.height, Math.ceil(y1 - y0 + margin * 2));
  if (x0 < 0 || y0 < 0 || dx || dy) { doc.width = Math.ceil(x1 - x0 + margin * 2); doc.height = Math.ceil(y1 - y0 + margin * 2); }
};
RIG.shiftAll = function (doc, dx, dy) {
  for (const l of doc.layers) { l.x += dx; l.y += dy; }
  for (const ch of doc.chains) for (const s of ch.segs) { s.joint = { x: s.joint.x + dx, y: s.joint.y + dy }; if (s.tip) s.tip = { x: s.tip.x + dx, y: s.tip.y + dy }; }
  doc.align = { x: doc.align.x + dx, y: doc.align.y + dy };
};
// give one new layer a role from its name (without touching the rest of the character)
RIG.assignOne = function (doc, l) {
  const fm = l.name.match(RIG.FRAME_RE);
  if (fm) {
    const target = doc.layers.find(o => o !== l && o.role.type !== 'frame' && !o.cutSource && normName(o.name) === normName(fm[1]));
    if (target) {
      const alias = { walking: 'walk', running: 'run', jumping: 'jump', falling: 'fall', frame: 'always', f: 'always', anim: 'always' };
      const key = alias[fm[2].toLowerCase()] || fm[2].toLowerCase();
      const sets = doc.anims[target.id] = doc.anims[target.id] || {};
      const set = sets[key] = sets[key] || { fps: 8, loop: !['dead', 'down'].includes(key), frames: key === 'always' ? [target.id] : [] };
      set.frames.push(l.id); l.role = { type: 'frame', of: target.id }; return null;
    }
  }
  const c = RIG.classify(l.name);
  if (c.kind === 'eye') { l.role = { type: 'eye', state: c.state }; doc.hideObjects = doc.hideObjects.filter(o => o !== 'Eyes'); return null; }
  if (c.kind === 'headState') { const h = doc.layers.find(o => o.role.type === 'part' && o.role.part === 'Head'); l.role = h ? { type: 'state', of: h.id, state: c.state } : { type: 'ignore' }; return null; }
  if (c.stock && c.kind === 'limb') {
    const usedF = doc.layers.some(o => o !== l && o.role.type === 'part' && o.role.part === c.base + 'F');
    const takeP = (part) => { for (const o of doc.layers) if (o !== l && o.role.type === 'part' && o.role.part === part) o.role = { type: 'ignore' }; l.role = { type: 'part', part }; };
    takeP(c.base + (usedF && /\(far\)/.test(l.name) ? 'B' : 'F')); return null;
  }
  const takePart = (part) => { for (const o of doc.layers) if (o !== l && o.role.type === 'part' && o.role.part === part) o.role = { type: 'ignore' }; l.role = { type: 'part', part }; };
  if (c.kind === 'part') { takePart(c.base); return null; }
  if (c.kind === 'limb') {
    const used = (sd) => doc.layers.some(o => o !== l && o.role.type === 'part' && o.role.part === c.base + sd);
    takePart(c.base + (c.side || (!used('F') ? 'F' : !used('B') ? 'B' : 'F'))); return null;
  }
  if (c.kind === 'tail') {
    let ch = doc.chains.find(x => x.attachTo === 'tail' && !x.source);
    if (!ch) ch = RIG.addChain(doc, 'Tail', 'tail', [], 'Fluffy tail');
    ch.segs.push({ layer: l.id, joint: { x: 0, y: 0 }, tip: null, restAngle: 0, maxBend: -1 }); l.role = { type: 'chain', chain: ch.id };
    const num = (s) => { const x = RIG.layer(doc, s.layer); return x ? (RIG.classify(x.name).num || 0) : 0; };
    ch.segs.sort((a, b) => num(a) - num(b));
    doc.hideVanillaTail = true; return ch;
  }
  if (c.kind === 'wing') {
    const n = doc.chains.filter(x => /wing/i.test(x.name)).length;
    const far = c.side === 'B' || (!c.side && n === 1);
    const ch = RIG.addChain(doc, 'Wing ' + (far ? 'far' : 'near'), 'UpTorso', [l.id], 'Wings'); l.role = { type: 'chain', chain: ch.id }; return ch;
  }
  if (c.kind === 'floof' || c.kind === 'rigidHead') {
    const ch = RIG.addChain(doc, l.name, 'Head', [l.id], c.kind === 'rigidHead' ? 'Rigid (no physics)' : 'Hair / ears floof'); l.role = { type: 'chain', chain: ch.id }; return ch;
  }
  l.role = { type: 'ignore' }; return null;
};
// add images ({name, w, h, rgba}) to a character. Full-canvas images keep their spot; smaller (cropped) ones are placed by name.
RIG.addImages = function (doc, imgs) {
  const added = [];
  const isFull = (im) => im.w === doc.width && im.h === doc.height;
  const isFrame = (im) => RIG.FRAME_RE.test(im.name);
  const sorted = [...imgs].sort((a, b) => (isFrame(a) - isFrame(b)) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const touched = new Set();
  for (const im of sorted) {
    const c = RIG.crop(im.rgba, im.w, im.h); if (!c) continue;
    const loose = !isFull(im);
    const l = { id: RIG.newId(), name: im.name, x: loose ? 0 : c.x, y: loose ? 0 : c.y, w: c.w, h: c.h, rgba: c.rgba, order: doc.layers.length, hidden: false, role: { type: 'ignore' } };
    doc.layers.push(l); added.push(l);
    const ch = RIG.assignOne(doc, l); if (ch) touched.add(ch);
    l._loose = loose;
  }
  // place loose ones (chain pieces in chain order so each one hangs off the previous)
  const place = [...added.filter(l => l._loose && l.role.type !== 'chain' && l.role.type !== 'frame'),
    ...doc.chains.flatMap(ch => ch.segs.map(s => RIG.layer(doc, s.layer)).filter(l => l && added.includes(l) && l._loose)),
    ...added.filter(l => l._loose && l.role.type === 'frame')];
  for (const l of place) RIG.placeLoose(doc, l);
  added.forEach(l => { delete l._loose; delete l._parked; });
  // game-named limbs used for both sides: add the far side copy
  const before = doc.layers.length; RIG.addFarCopies(doc);
  if (doc.layers.length > before) for (const l of doc.layers) if (!added.includes(l) && / \(far\)$/.test(l.name) && l.role.type === 'part') { added.push(l); RIG.stockPlace(doc, l); }
  // stacking: slot each new layer in by its key
  const fresh = new Set(added);
  const old = doc.layers.filter(l => !fresh.has(l));
  for (const l of added.sort((a, b) => RIG.sortKey(doc, a) - RIG.sortKey(doc, b))) {
    const k = RIG.sortKey(doc, l); let i = old.length;
    while (i > 0 && RIG.sortKey(doc, old[i - 1]) > k && old[i - 1].role.type !== 'ignore') i--;
    if (k === 300) i = old.length;
    old.splice(i, 0, l);
  }
  doc.layers = old; doc.layers.forEach((l, i) => l.order = i);
  for (const ch of touched) RIG.autoBones(doc, ch);
  RIG.fitCanvas(doc);
  if (doc.layers.some(l => l.role.type === 'part' && l.role.part === 'Head') && !doc.hideObjects.includes('Eyes')) doc.hideObjects = ['Eyes', 'Nosebleed'];
  return added;
};
// a character from separate (cropped) PNG files
RIG.docFromLoose = function (name, imgs) {
  const doc = RIG.newDoc(name, 96, 96, []);
  doc.align = { x: 48, y: 48 };
  RIG.addImages(doc, imgs);
  return doc;
};

// ===================== bones on one image: cut it into pieces that bend =====================
RIG.removeLayers = function (doc, ids) {
  const set = new Set(ids);
  for (const id of ids) { delete doc.anims[id]; delete doc.healthScreen['seg:' + id]; }
  for (const k in doc.anims) for (const a in doc.anims[k]) { const st = doc.anims[k][a]; st.frames = st.frames.filter(f => !set.has(f)); if (!st.frames.length) delete doc.anims[k][a]; }
  for (const l of doc.layers) if (l.role.of && set.has(l.role.of)) l.role = { type: 'ignore' };
  doc.layers = doc.layers.filter(l => !set.has(l.id)); doc.layers.forEach((l, i) => l.order = i);
};
// things attached to pieces that a re-cut would drop (frames, injury art)
RIG.pieceExtras = function (doc, ch) {
  const ids = new Set(ch.segs.map(s => s.layer));
  return doc.layers.filter(l => (l.role.type === 'injury' || l.role.type === 'frame') && ids.has(l.role.of)).length + ch.segs.filter(s => doc.anims[s.layer]).length;
};
function opaquePixels(l) { const px = []; for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.rgba[(y * l.w + x) * 4 + 3]) px.push(x, y); return px; }
function makePiece(src, name, pick) { // pick(i) -> include pixel #i
  const rgba = new Uint8ClampedArray(src.w * src.h * 4); let any = false;
  const px = opaquePixels(src);
  for (let i = 0; i < px.length; i += 2) if (pick(i / 2)) { const o = (px[i + 1] * src.w + px[i]) * 4; rgba.set(src.rgba.subarray(o, o + 4), o); any = true; }
  const c = any ? RIG.crop(rgba, src.w, src.h) : null;
  return c ? { x: src.x + c.x, y: src.y + c.y, w: c.w, h: c.h, rgba: c.rgba } : { x: src.x, y: src.y, w: 1, h: 1, rgba: new Uint8ClampedArray(4) };
}
// distance along the shape (8-connected) from the opaque pixel nearest to point "from"
function shapeDistances(src, from) {
  const px = opaquePixels(src), n = px.length / 2; const idx = new Int32Array(src.w * src.h).fill(-1);
  for (let i = 0; i < n; i++) idx[px[2 * i + 1] * src.w + px[2 * i]] = i;
  let start = 0, bd = 1e18;
  for (let i = 0; i < n; i++) { const d = (src.x + px[2 * i] + 0.5 - from.x) ** 2 + (src.y + px[2 * i + 1] + 0.5 - from.y) ** 2; if (d < bd) { bd = d; start = i; } }
  const dist = new Float64Array(n).fill(Infinity); dist[start] = 0;
  // Dijkstra with a simple bucket queue (steps 1 and 1.414)
  const q = [[start, 0]]; let head = 0;
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (head < q.length) {
    // pick the smallest of a small window (good enough, near-BFS order)
    const [i, d] = q[head++]; if (d > dist[i]) continue;
    const x = px[2 * i], y = px[2 * i + 1];
    for (const [ox, oy, w] of nb) {
      const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= src.w || Y >= src.h) continue;
      const j = idx[Y * src.w + X]; if (j < 0) continue;
      if (d + w < dist[j] - 1e-9) { dist[j] = d + w; q.push([j, d + w]); }
    }
  }
  for (let i = 0; i < n; i++) if (!isFinite(dist[i])) dist[i] = Math.hypot(px[2 * i] - px[2 * start], px[2 * i + 1] - px[2 * start + 1]);
  return { px, n, dist, start };
}
// cut "src" into n pieces along its shape, starting at the end nearest the body; fills ch.segs with new piece layers
RIG.cutInto = function (doc, ch, src, n) {
  const from = RIG.J(doc, ch.attachTo === 'tail' ? 'tail' : ch.attachTo);
  const { px, n: np, dist } = shapeDistances(src, from);
  let Lmax = 0; for (let i = 0; i < np; i++) Lmax = Math.max(Lmax, dist[i]);
  n = Math.max(1, Math.min(n | 0, Math.floor(Lmax / 2) || 1, 40));
  const band = (lo, hi) => { let sx = 0, sy = 0, c = 0; for (let i = 0; i < np; i++) if (dist[i] >= lo && dist[i] <= hi) { sx += px[2 * i]; sy += px[2 * i + 1]; c++; } return c ? { x: r1(src.x + sx / c + 0.5), y: r1(src.y + sy / c + 0.5) } : null; };
  const seg = Lmax / n;
  const pieceOf = (i) => Math.min(n - 1, Math.floor(dist[i] / seg));
  // old pieces go away
  const oldIds = ch.segs.map(s => s.layer).filter(id => id !== src.id);
  const at = doc.layers.indexOf(src);
  const pieces = [];
  for (let k = 0; k < n; k++) {
    // each piece also keeps a thin strip of the next one underneath it, so bends don't open gaps
    const p = makePiece(src, '', (i) => pieceOf(i) === k || (pieceOf(i) === k + 1 && dist[i] < (k + 1) * seg + 1.5));
    pieces.push(Object.assign({ id: RIG.newId(), name: n === 1 ? src.name : src.name + ' ' + (k + 1), hidden: false, role: { type: 'chain', chain: ch.id }, order: 0 }, p));
  }
  RIG.removeLayers(doc, oldIds);
  doc.layers.splice(doc.layers.indexOf(src) + 1, 0, ...pieces);
  doc.layers.forEach((l, i) => l.order = i);
  src.role = { type: 'ignore' }; src.cutSource = ch.id; ch.source = src.id;
  const restRot = (RIG.REST[ch.attachTo] || [0, 0, 0])[2];
  ch.segs = pieces.map((p, k) => ({ layer: p.id, joint: band(k === 0 ? 0 : k * seg - 1, k === 0 ? 1.5 : k * seg + 1) || RIG.center(p), tip: null, restAngle: k === 0 ? -restRot : 0, maxBend: -1 }));
  ch.segs[n - 1].tip = band(Lmax - 1.5, Lmax + 1) || RIG.center(pieces[n - 1]);
  return ch;
};
// re-cut the original image by the bones as they are now (after dragging joints)
RIG.recut = function (doc, ch) {
  const src = ch.source && RIG.layer(doc, ch.source); if (!src) return false;
  const pts = ch.segs.map(s => s.joint).concat([ch.segs[ch.segs.length - 1].tip || ch.segs[ch.segs.length - 1].joint]);
  const px = opaquePixels(src), np = px.length / 2, n = ch.segs.length;
  const dseg = (p, a, b) => { const ab = V.sub(b, a), l2 = ab.x * ab.x + ab.y * ab.y; let t = l2 ? ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t); };
  const best = new Int32Array(np), dd = [];
  for (let i = 0; i < np; i++) {
    const p = { x: src.x + px[2 * i] + 0.5, y: src.y + px[2 * i + 1] + 0.5 }; const d = [];
    for (let k = 0; k < n; k++) d.push(dseg(p, pts[k], pts[k + 1]));
    let b = 0; for (let k = 1; k < n; k++) if (d[k] < d[b] - 1e-6) b = k;
    best[i] = b; dd.push(d);
  }
  ch.segs.forEach((s, k) => {
    const l = RIG.layer(doc, s.layer); if (!l) return;
    const p = makePiece(src, '', (i) => best[i] === k || (best[i] === k + 1 && dd[i][k] <= dd[i][k + 1] + 1.2));
    Object.assign(l, p);
  });
  return true;
};
// change the number of bones: re-cuts the original image (merging separate pieces into one first if needed)
RIG.setBoneCount = function (doc, ch, n) {
  let src = ch.source && RIG.layer(doc, ch.source);
  if (!src) {
    const ls = ch.segs.map(s => RIG.layer(doc, s.layer)).filter(Boolean);
    if (ls.length === 1) { src = ls[0]; }
    else { // merge the pieces into one image, in drawing order
      const x0 = Math.min(...ls.map(l => l.x)), y0 = Math.min(...ls.map(l => l.y));
      const w = Math.max(...ls.map(l => l.x + l.w)) - x0, h = Math.max(...ls.map(l => l.y + l.h)) - y0;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (const l of [...ls].sort((a, b) => a.order - b.order)) for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
        const o = (y * l.w + x) * 4, a = l.rgba[o + 3] / 255; if (!a) continue;
        const d = ((l.y - y0 + y) * w + (l.x - x0 + x)) * 4, da = rgba[d + 3] / 255, oa = a + da * (1 - a);
        for (let c = 0; c < 3; c++) rgba[d + c] = (l.rgba[o + c] * a + rgba[d + c] * da * (1 - a)) / oa;
        rgba[d + 3] = oa * 255;
      }
      const first = ls.reduce((a, b) => a.order < b.order ? a : b);
      src = { id: RIG.newId(), name: ch.name, x: x0, y: y0, w, h, rgba, hidden: false, role: { type: 'ignore' }, order: first.order };
      doc.layers.splice(doc.layers.indexOf(first), 0, src);
    }
    ch.segs.forEach(s => { if (s.layer === src.id) s.layer = null; });
  }
  RIG.cutInto(doc, ch, src, n);
  return ch;
};
// back to a single image with one bone
RIG.uncut = function (doc, ch) {
  const src = ch.source && RIG.layer(doc, ch.source); if (!src) return;
  RIG.removeLayers(doc, ch.segs.map(s => s.layer));
  delete src.cutSource; delete ch.source; src.role = { type: 'chain', chain: ch.id };
  ch.segs = [{ layer: src.id, joint: { x: 0, y: 0 }, tip: null, restAngle: 0, maxBend: -1 }];
  RIG.autoBones(doc, ch);
};
// make any layer a moving part (tail, wing, hair...) with n bones
RIG.KINDS = {
  tail: { label: 'Tail', attachTo: 'tail', preset: 'Fluffy tail', bones: 6 },
  wing: { label: 'Wing', attachTo: 'UpTorso', preset: 'Wings', bones: 3 },
  hair: { label: 'Hair / ear / floof', attachTo: 'Head', preset: 'Hair / ears floof', bones: 3 },
  other: { label: 'Something else that dangles', attachTo: 'UpTorso', preset: 'Fluffy tail', bones: 3 }
};
RIG.kindOf = (name) => { const c = RIG.classify(name); return c.kind === 'tail' ? 'tail' : c.kind === 'wing' ? 'wing' : (c.kind === 'floof' || c.kind === 'rigidHead') ? 'hair' : 'other'; };
RIG.makeMoving = function (doc, l, kind, n, attachTo) {
  const K = RIG.KINDS[kind] || RIG.KINDS.other;
  for (const c of doc.chains) c.segs = c.segs.filter(s => s.layer !== l.id);
  doc.chains = doc.chains.filter(c => c.segs.length || c.source);
  const name = kind === 'wing' ? (RIG.isSideB(l.name) ? 'Wing far' : 'Wing near') : l.name;
  const ch = RIG.addChain(doc, name, attachTo || K.attachTo, [l.id], K.preset);
  l.role = { type: 'chain', chain: ch.id };
  if (n > 1) RIG.cutInto(doc, ch, l, n); else RIG.autoBones(doc, ch);
  if (ch.attachTo === 'tail') doc.hideVanillaTail = true;
  return ch;
};

// ===================== export to rig.json =====================
RIG.fileName = function (doc, l) {
  if (l._file) return l._file;
  const used = new Set(doc.layers.filter(x => x._file).map(x => x._file.toLowerCase()));
  let base = (l.name || 'layer').replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '') || 'layer', f = base + '.png', i = 2;
  while (used.has(f.toLowerCase())) f = base + '_' + (i++) + '.png';
  l._file = f; return f;
};

// absolute draw order for a layer, keeping the drawing's stacking as far as the game's fixed part order allows
function absOrder(doc, l) {
  if (l.role.type === 'part') return RIG.ORDER[l.role.part];
  // above every game part that is below it in the drawing
  let below = null;
  for (const o of doc.layers) if (o.order < l.order && o.role.type === 'part') below = below === null ? RIG.ORDER[o.role.part] : Math.max(below, RIG.ORDER[o.role.part]);
  if (below === null) {
    let lowest = null;
    for (const o of doc.layers) if (o.role.type === 'part') lowest = lowest === null ? RIG.ORDER[o.role.part] : Math.min(lowest, RIG.ORDER[o.role.part]);
    return lowest === null ? 0 : lowest - 5;
  }
  return below + 1;
}

RIG.exportAnims = function (doc, layerId, seg, add) {
  const sets = doc.anims && doc.anims[layerId];
  if (!sets) return;
  const out = {};
  for (const key in sets) {
    const st = sets[key];
    const fr = st.frames.map(id => RIG.layer(doc, id)).filter(Boolean);
    if (!fr.length) continue;
    out[key] = { fps: +st.fps || 8, loop: st.loop !== false, frames: fr.map(f => ({ file: add(f), x: f.x, y: f.y })) };
  }
  if (Object.keys(out).length) seg.animations = out;
};

// Draw order: the game draws its parts in a fixed order (RIG.ORDER). Your layer list says how YOU want them stacked.
// Every drawn layer gets the in-game order closest to the game's own that still keeps your stacking (weighted
// isotonic fit: body parts stay as close to the game's order as possible so worn gear and bandages still sit right).
RIG.layerOrders = function (doc) {
  const drawn = doc.layers.filter(l => !l.cutSource && (l.role.type === 'part' || l.role.type === 'chain'));
  const g = drawn.map(l => {
    if (l.role.type === 'part') return RIG.ORDER[l.role.part];
    const ch = RIG.chain(doc, l.role.chain); return ch ? (RIG.ORDER[ch.attachTo] || 0) : 0;
  });
  const w = drawn.map(l => l.role.type === 'part' ? 10 : 1);
  // pool-adjacent-violators on g[i] - i (non-decreasing), then add i back: strictly increasing integers
  const blocks = [];
  for (let i = 0; i < drawn.length; i++) {
    blocks.push({ v: g[i] - i, w: w[i], n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
      const b = blocks.pop(), a = blocks.pop();
      blocks.push({ v: (a.v * a.w + b.v * b.w) / (a.w + b.w), w: a.w + b.w, n: a.n + b.n });
    }
  }
  const out = new Map(); let i = 0;
  for (const b of blocks) for (let k = 0; k < b.n; k++, i++) out.set(drawn[i].id, Math.round(b.v) + i);
  return out;
};

RIG.buildRig = function (doc) {
  doc.layers.forEach(l => delete l._file);
  const ord = RIG.layerOrders(doc);
  const files = {};
  const chains = [];
  const add = (l) => { const f = RIG.fileName(doc, l); files[f] = l; return f; };
  const addImg = (name, img) => { files[name] = img; return name; };
  const hsOut = (key, d) => {
    if (!d) return null;
    const o = { scale: d.scale || 3 };
    const tag = key.replace(/[^A-Za-z0-9]+/g, '_');
    if (d.outline) o.outline = addImg('hs_' + tag + '_outline.png', d.outline);
    if (d.middle) o.middle = addImg('hs_' + tag + '_middle.png', d.middle);
    if (d.x !== undefined && d.y !== undefined) { o.x = +(+d.x).toFixed(1); o.y = +(+d.y).toFixed(1); }
    if (d.rotation) o.rotation = +d.rotation; if (d.mirror) o.mirror = true;
    return o;
  };
  // rigid body parts, in drawing order
  for (const l of doc.layers) {
    if (l.role.type !== 'part') continue;
    const part = l.role.part, J = RIG.J(doc, part);
    const seg = { file: add(l), x: l.x, y: l.y, joint: J, restAngle: -(RIG.REST[part][2] - (l.spriteRot || 0)) };
    RIG.exportAnims(doc, l.id, seg, add);
    const arts = doc.layers.filter(a => a.role.type === 'injury' && a.role.of === l.id);
    if (arts.length) { seg.injuryArt = {}; for (const a of arts) seg.injuryArt[a.role.state] = { file: add(a), x: a.x, y: a.y }; }
    const states = doc.layers.filter(s => s.role.type === 'state' && s.role.of === l.id);
    if (states.length) { seg.states = {}; for (const s of states) seg.states[s.role.state] = { file: add(s), x: s.x, y: s.y }; }
    const pc = { name: l.name, attachTo: part, anchor: J, hideTarget: true, physics: false, sortingOrderOffset: ord.get(l.id) - RIG.ORDER[part], segments: [seg] };
    if (l.blendWith && l.blendWith !== part) { pc.blendWith = l.blendWith; pc.blendWeight = +(l.blendWeight !== undefined ? l.blendWeight : 0.5).toFixed(3); pc.hideTarget = !doc.layers.some(o => o !== l && o.role.type === 'part' && o.role.part === part && !o.blendWith) ? true : false; }
    chains.push(pc);
  }
  for (const ch of doc.chains) {
    const ls = ch.segs.map(s => RIG.layer(doc, s.layer)).filter(Boolean);
    if (!ls.length) continue;
    const anchor = RIG.J(doc, ch.attachTo);
    const minOrder = Math.min(...ls.map(l => l.order));
    const lowest = ls.find(l => l.order === minOrder);
    // in-game order from the layer list (see RIG.layerOrders): relative to the game part it hangs on
    const sortOff = ord.get(lowest.id) - (RIG.ORDER[ch.attachTo] || 0);
    const groups = ch.injury && ch.injury.enabled && Array.isArray(ch.injury.groups) && ch.injury.groups.length === ch.segs.length ? ch.injury.groups : null;
    const segs = ch.segs.filter(s => RIG.layer(doc, s.layer)).map((s, k) => {
      const l = RIG.layer(doc, s.layer);
      const o = { file: add(l), x: l.x, y: l.y, joint: { x: s.joint.x, y: s.joint.y }, order: ord.get(l.id) - ord.get(lowest.id) };
      if (s.tip) o.tip = { x: s.tip.x, y: s.tip.y };
      if (s.restAngle) o.restAngle = +(+s.restAngle).toFixed(2);
      if (s.maxBend >= 0) o.maxBend = s.maxBend;
      const arts = doc.layers.filter(a => a.role.type === 'injury' && a.role.of === s.layer);
      if (arts.length) { o.injuryArt = {}; for (const a of arts) o.injuryArt[a.role.state] = { file: add(a), x: a.x, y: a.y }; }
      if (ch.injury && ch.injury.enabled && RIG.isGroupLeader(ch, k)) { const h = hsOut('seg_' + ch.name + '_' + k, doc.healthScreen['seg:' + s.layer]); if (h) o.healthScreen = h; }
      RIG.exportAnims(doc, s.layer, o, add);
      return o;
    });
    const motion = {}; for (const k of RIG.MOTION_KEYS) motion[k] = +ch.motion[k]; motion.flapWhen = ch.motion.flapWhen || 'never';
    const out = { name: ch.name, attachTo: ch.attachTo, anchor, offset: { x: ch.offset.x, y: ch.offset.y },
      sortingOrderOffset: sortOff, physics: !!ch.physics, motion, segments: segs };
    if (ch.injury && ch.injury.enabled) {
      out.injury = { enabled: true, name: ch.injury.name || ch.name, tearOff: !!ch.injury.tearOff, gameShading: !!ch.injury.gameShading, vital: !!ch.injury.vital };
      if (groups && groups.some((g, k) => g !== k)) out.injury.groups = groups.slice();
    }
    chains.push(out);
  }
  const rig = { name: doc.name, pixelsPerUnit: RIG.PPU, hideVanillaTail: !!doc.hideVanillaTail, hideObjects: doc.hideObjects.slice(), chains,
    editor: { width: doc.width, height: doc.height, align: doc.align } };
  const hsParts = {};
  for (const p of RIG.PARTS) { const h = hsOut(p, doc.healthScreen[p]); if (h) hsParts[p] = h; }
  if (Object.keys(hsParts).length) rig.healthScreen = { parts: hsParts };
  if (doc.sounds) {
    const snd = {};
    for (const key in doc.sounds) {
      const list = doc.sounds[key].map(f => { const name = 'snd_' + key + '_' + f.file.replace(/[^A-Za-z0-9_.\-]+/g, '_'); files[name] = { raw: f.data }; return name; });
      if (list.length) snd[key] = list;
    }
    if (Object.keys(snd).length) rig.sounds = snd;
  }
  const swaps = Object.keys(doc.spriteSwaps);
  if (swaps.length) { rig.spriteSwaps = {}; for (const k of swaps) { rig.spriteSwaps[k] = k + '.png'; files[k + '.png'] = doc.spriteSwaps[k]; } }
  // worn gear the player redrew: swapped only while worn, sitting where it's drawn on its body part
  const gearL = doc.layers.filter(l => l.role.type === 'gear' && l.role.sprite);
  if (gearL.length) {
    rig.spriteSwaps = rig.spriteSwaps || {}; rig.editor.gear = [];
    for (const l of gearL) {
      const J = RIG.J(doc, l.role.limb), f = add(l);
      rig.spriteSwaps[l.role.sprite] = { file: f, pivot: { x: +((J.x - l.x) / l.w).toFixed(4), y: +((l.y + l.h - J.y) / l.h).toFixed(4) } };
      rig.editor.gear.push({ sprite: l.role.sprite, limb: l.role.limb, item: l.role.item || null });
    }
  }
  // custom animations: offsets on top of the game's own clips
  const anims = {};
  for (const clip in doc.animations || {}) {
    const bones = {};
    for (const b in (doc.animations[clip].bones || {})) { const k = doc.animations[clip].bones[b]; if (k && k.length) bones[b] = k.map(x => ({ t: +(+x.t).toFixed(4), r: +(+x.r || 0).toFixed(3), x: +(+x.x || 0).toFixed(4), y: +(+x.y || 0).toFixed(4) })); }
    if (Object.keys(bones).length) anims[clip] = doc.animations[clip].mode === 'replace' ? { mode: 'replace', bones } : { bones };
  }
  if (Object.keys(anims).length) rig.animations = anims;
  const eyes = doc.layers.filter(l => l.role.type === 'eye' && l.role.state);
  if (eyes.length) {
    rig.spriteSwaps = rig.spriteSwaps || {};
    const H = RIG.J(doc, 'Head');
    for (const l of eyes) {
      const f = add(l); // the game draws the eyes centred on the head; this pivot keeps them where they're drawn
      rig.spriteSwaps[l.role.state] = { file: f, pivot: { x: +((H.x - l.x) / l.w).toFixed(4), y: +((l.y + l.h - H.y) / l.h).toFixed(4) } };
    }
    rig.hideObjects = rig.hideObjects.filter(o => o !== 'Eyes');
  }
  return { rig, files };
};

// rebuild an editor document from an exported rig (rig.json + its images, already decoded to {w,h,rgba})
RIG.docFromRig = function (rig, images) {
  const ed = rig.editor || {};
  const doc = { name: rig.name || 'Rig', width: ed.width || 64, height: ed.height || 64, layers: [], chains: [], align: ed.align || { x: 32, y: 36 },
    hideObjects: rig.hideObjects || [], hideVanillaTail: rig.hideVanillaTail !== false, spriteSwaps: {}, healthScreen: {}, anims: {}, sounds: {} };
  if (rig.sounds) for (const k in rig.sounds) doc.sounds[k] = [].concat(rig.sounds[k]).filter(f => images[f] && images[f].raw).map(f => ({ file: f.replace(/^snd_[^_]+_/, ''), data: images[f].raw }));
  const importAnims = (s, l) => {
    if (!s.animations) return;
    const sets = doc.anims[l.id] = {};
    for (const key in s.animations) {
      const a = s.animations[key];
      const ids = (a.frames || []).map((f, i) => {
        const file = typeof f === 'string' ? f : f.file;
        const fl = mk(file, typeof f === 'string' ? s.x : f.x, typeof f === 'string' ? s.y : f.y);
        if (fl !== l) { fl.role = { type: 'frame', of: l.id }; fl._abs = (l._abs || 0) + 0.0001 * (i + 1); }
        return fl.id;
      });
      sets[key] = { fps: a.fps || 8, loop: a.loop !== false, frames: ids };
    }
  };
  let order = 0; const byFile = {};
  const hsIn = (h) => h ? { outline: h.outline ? images[h.outline] : null, middle: h.middle ? images[h.middle] : null,
    x: h.x, y: h.y, scale: h.scale || 3, rotation: h.rotation || 0, mirror: !!h.mirror } : null;
  const mk = (file, x, y) => {
    const key = file + '@' + x + ',' + y; if (byFile[key]) return byFile[key];
    const img = images[file]; if (!img) throw new Error('Missing image ' + file);
    const l = { id: RIG.newId(), name: file.replace(/\.png$/i, ''), x, y, w: img.w, h: img.h, rgba: img.rgba, order: 0, hidden: false, role: { type: 'ignore' } };
    doc.layers.push(l); byFile[key] = l; return l;
  };
  const pending = [];
  for (const c of rig.chains || []) {
    const base = RIG.ORDER[c.attachTo] !== undefined ? RIG.ORDER[c.attachTo] : 0;
    if (c.hideTarget && c.physics === false && RIG.PARTS.includes(c.attachTo) && c.segments.length === 1) {
      const s = c.segments[0]; const l = mk(s.file, s.x, s.y); l.role = { type: 'part', part: c.attachTo }; l._abs = base + (c.sortingOrderOffset || 0);
      if (s.restAngle !== undefined && Math.abs(s.restAngle + RIG.REST[c.attachTo][2]) > 0.01) l.spriteRot = +(RIG.REST[c.attachTo][2] + s.restAngle).toFixed(3);
      if (c.blendWith) { l.blendWith = c.blendWith; l.blendWeight = c.blendWeight !== undefined ? c.blendWeight : 0.5; }
      if (c.name) l.name = c.name;
      if (!rig.editor && s.joint && c.anchor) doc.align = { x: s.joint.x - RIG.restPx(c.attachTo).x, y: s.joint.y - RIG.restPx(c.attachTo).y };
      importAnims(s, l);
      if (s.injuryArt) for (const st in s.injuryArt) { const v = s.injuryArt[st]; const f = typeof v === 'string' ? v : v.file;
        const al = mk(f, typeof v === 'string' ? s.x : v.x, typeof v === 'string' ? s.y : v.y); al.role = { type: 'injury', of: l.id, state: st }; al._abs = l._abs + 0.002; }
      if (s.states) for (const st in s.states) { const v = s.states[st]; const f = typeof v === 'string' ? v : v.file;
        const sl = mk(f, typeof v === 'string' ? s.x : v.x, typeof v === 'string' ? s.y : v.y); sl.role = { type: 'state', of: l.id, state: st }; sl._abs = l._abs + 0.5; }
      continue;
    }
    pending.push(c);
  }
  for (const c of pending) {
    const base = RIG.ORDER[c.attachTo] !== undefined ? RIG.ORDER[c.attachTo] : 0;
    const ch = { id: RIG.newId(), name: c.name || 'Chain', attachTo: c.attachTo || 'tail', segs: [], physics: c.physics !== false,
      motion: Object.assign(RIG.defaultMotion(), c.motion || {}), preset: 'Custom', offset: c.offset || { x: 0, y: 0 },
      injury: Object.assign(RIG.defaultInjury(c.name), c.injury || {}) };
    c.segments.forEach((s, k) => {
      const l = mk(s.file, s.x, s.y); l.role = { type: 'chain', chain: ch.id }; l._abs = base + (c.sortingOrderOffset || 0) + (s.order !== undefined ? s.order : k) + k * 0.001;
      if (c.segments.length === 1 && c.name) l.name = c.name;
      ch.segs.push({ layer: l.id, joint: s.joint || { x: s.x, y: s.y }, tip: s.tip || null, restAngle: s.restAngle || 0, maxBend: s.maxBend !== undefined ? s.maxBend : -1 });
      if (s.injuryArt) for (const st in s.injuryArt) { const v = s.injuryArt[st]; const f = typeof v === 'string' ? v : v.file;
        const al = mk(f, typeof v === 'string' ? s.x : v.x, typeof v === 'string' ? s.y : v.y); al.role = { type: 'injury', of: l.id, state: st }; al._abs = l._abs + 0.001; }
      if (s.healthScreen) doc.healthScreen['seg:' + l.id] = hsIn(s.healthScreen);
      importAnims(s, l);
    });
    doc.chains.push(ch);
  }
  doc.layers.sort((a, b) => (a._abs || 0) - (b._abs || 0)); doc.layers.forEach((l, i) => { l.order = i; delete l._abs; });
  if (rig.healthScreen && rig.healthScreen.parts) for (const p in rig.healthScreen.parts) doc.healthScreen[p] = hsIn(rig.healthScreen.parts[p]);
  doc.animations = rig.animations ? JSON.parse(JSON.stringify(rig.animations)) : {};
  if (rig.spriteSwaps) for (const k in rig.spriteSwaps) {
    const v = rig.spriteSwaps[k]; const f = typeof v === 'string' ? v : v.file; if (!images[f]) continue;
    const gearInfo = ((rig.editor || {}).gear || []).find(g => g.sprite === k);
    if (gearInfo && v && v.pivot) { // redrawn gear: back to a layer on its body part
      const im = images[f], J = RIG.J(doc, gearInfo.limb);
      const gl = { id: RIG.newId(), name: k, x: Math.round(J.x - v.pivot.x * im.w), y: Math.round(J.y - (1 - v.pivot.y) * im.h), w: im.w, h: im.h, rgba: im.rgba,
        order: doc.layers.length, hidden: false, role: { type: 'gear', sprite: k, limb: gearInfo.limb, item: gearInfo.item } };
      if (RIG.REST[gearInfo.limb] && RIG.REST[gearInfo.limb][2]) gl.spriteRot = RIG.REST[gearInfo.limb][2];
      doc.layers.push(gl); continue;
    }
    if (RIG.isEyeState(k) && v && v.pivot) { // eyes drawn on the head: back to a layer at its spot
      const im = images[f], H = RIG.J(doc, 'Head');
      doc.layers.push({ id: RIG.newId(), name: k, x: Math.round(H.x - v.pivot.x * im.w), y: Math.round(H.y - (1 - v.pivot.y) * im.h), w: im.w, h: im.h, rgba: im.rgba,
        order: doc.layers.length, hidden: false, role: { type: 'eye', state: k } });
      continue;
    }
    doc.spriteSwaps[k] = images[f];
  }
  return doc;
};

// ===================== PSD writer (8-bit RGB, raw), so artists can edit every layer at once and bring it back =====================
// layers: [{name, x, y, w, h, rgba, hidden}] bottom first. Big = PSB (version 2) for huge canvases.
RIG.writePSD = function (width, height, layers, big) {
  const out = []; let size = 0;
  const push = (u8) => { out.push(u8); size += u8.length; };
  const be = (n, bytes) => { const b = new Uint8Array(bytes); let v = BigInt(Math.max(0, Math.round(n))); for (let i = bytes - 1; i >= 0; i--) { b[i] = Number(v & 0xffn); v >>= 8n; } return b; };
  const i16 = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, n); return b; };
  const i32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n); return b; };
  const str = (s) => new Uint8Array([...s].map(c => c.charCodeAt(0)));
  const lenW = big ? 8 : 4;
  // header
  push(str('8BPS')); push(be(big ? 2 : 1, 2)); push(new Uint8Array(6)); push(be(4, 2)); push(be(height, 4)); push(be(width, 4)); push(be(8, 2)); push(be(3, 2));
  push(be(0, 4)); // color mode data
  push(be(0, 4)); // image resources
  // ---- layer records + channel data
  const recs = [], chans = [];
  for (const l of layers) {
    const w = Math.max(1, l.w), h = Math.max(1, l.h), n = w * h;
    const planes = [3, 0, 1, 2].map(c => { const p = new Uint8Array(n); for (let i = 0; i < n; i++) p[i] = l.rgba[i * 4 + c] || 0; return p; }); // alpha, r, g, b
    const ids = [-1, 0, 1, 2];
    const name = String(l.name || 'layer').replace(/[^\x20-\x7e]/g, '_').slice(0, 250);
    const nameLen = name.length; const pad = (4 - (nameLen + 1) % 4) % 4;
    const nameBytes = new Uint8Array(1 + nameLen + pad); nameBytes[0] = nameLen; nameBytes.set(str(name), 1);
    // 'luni' (unicode name) so long / special names come back exactly
    const uni = String(l.name || 'layer'); const luniData = new Uint8Array(4 + uni.length * 2 + (uni.length % 2 ? 2 : 0));
    new DataView(luniData.buffer).setUint32(0, uni.length); for (let i = 0; i < uni.length; i++) new DataView(luniData.buffer).setUint16(4 + i * 2, uni.charCodeAt(i));
    const luni = [str('8BIM'), str('luni'), be(luniData.length, 4), luniData];
    const extra = [be(0, 4), be(0, 4), nameBytes, ...luni];
    const extraLen = extra.reduce((a, b) => a + b.length, 0);
    const rec = [i32(l.y), i32(l.x), i32(l.y + h), i32(l.x + w), be(4, 2)];
    for (let k = 0; k < 4; k++) { rec.push(i16(ids[k])); rec.push(be(2 + n, lenW)); }
    rec.push(str('8BIM'), str('norm'), new Uint8Array([255, 0, l.hidden ? 2 : 0, 0]), be(extraLen, 4), ...extra);
    recs.push(...rec);
    for (const p of planes) { chans.push(be(0, 2), p); }
  }
  const recBytes = recs.reduce((a, b) => a + b.length, 0), chanBytes = chans.reduce((a, b) => a + b.length, 0);
  let layerInfoLen = 2 + recBytes + chanBytes; const layerPad = layerInfoLen % 2; layerInfoLen += layerPad;
  push(be(layerInfoLen + lenW + 4, lenW)); // layer and mask info section
  push(be(layerInfoLen, lenW)); push(i16(-layers.length)); // negative: first alpha channel is the merged result's transparency
  for (const r of recs) push(r); for (const c of chans) push(c); if (layerPad) push(new Uint8Array(1));
  push(be(0, 4)); // global layer mask info
  // ---- merged image (visible layers flattened), raw RGBA planes
  const comp = new Float32Array(width * height * 4);
  for (const l of layers) {
    if (l.hidden) continue;
    for (let y = 0; y < l.h; y++) { const Y = l.y + y; if (Y < 0 || Y >= height) continue;
      for (let x = 0; x < l.w; x++) { const X = l.x + x; if (X < 0 || X >= width) continue;
        const o = (y * l.w + x) * 4, a = l.rgba[o + 3] / 255; if (!a) continue; const d = (Y * width + X) * 4, da = comp[d + 3], oa = a + da * (1 - a);
        for (let c = 0; c < 3; c++) comp[d + c] = (l.rgba[o + c] * a + comp[d + c] * da * (1 - a)) / oa; comp[d + 3] = oa; } }
  }
  push(be(0, 2));
  for (const c of [0, 1, 2, 3]) { const p = new Uint8Array(width * height); for (let i = 0; i < width * height; i++) p[i] = c === 3 ? Math.round(comp[i * 4 + 3] * 255) : Math.round(comp[i * 4 + c]); push(p); }
  const all = new Uint8Array(size); let o = 0; for (const u of out) { all.set(u, o); o += u.length; }
  return all;
};

// ===================== project files (.luna): the whole editor document =====================
const b64enc = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')); };
const b64dec = (b) => { const s = typeof atob !== 'undefined' ? atob(b) : Buffer.from(b, 'base64').toString('binary'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
RIG.serialize = function (doc) {
  return JSON.stringify({ format: 'luna-ars-project', version: 1, doc }, (k, v) => {
    if (k.startsWith('_')) return undefined;
    if (v instanceof Uint8ClampedArray) return { $b64: b64enc(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)), t: 'c' };
    if (v instanceof Uint8Array) return { $b64: b64enc(v), t: 'u' };
    return v;
  });
};
RIG.deserialize = function (text) {
  const o = JSON.parse(text, (k, v) => (v && typeof v === 'object' && v.$b64 !== undefined) ? (v.t === 'c' ? new Uint8ClampedArray(b64dec(v.$b64).buffer) : b64dec(v.$b64)) : v);
  if (!o || o.format !== 'luna-ars-project' || !o.doc) throw new Error('not a Luna Advanced Rig Systems project');
  const doc = o.doc;
  // new ids must not clash with the loaded ones
  let max = 0; const scan = (x) => { const m = /^i(\d+)$/.exec(x || ''); if (m) max = Math.max(max, +m[1]); };
  doc.layers.forEach(l => scan(l.id)); doc.chains.forEach(c => scan(c.id));
  if (_id <= max) _id = max + 1;
  for (const k of ['spriteSwaps', 'healthScreen', 'anims', 'sounds']) doc[k] = doc[k] || {};
  doc.hideObjects = doc.hideObjects || [];
  return doc;
};

// ===================== tiny zip writer (store) =====================
RIG.crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
RIG.crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = RIG.crcTable[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
RIG.zip = function (entries) { // [{name, data:Uint8Array}]
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name), crc = RIG.crc32(e.data), size = e.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, e.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let o = 0; for (const a of all) { out.set(a, o); o += a.length; }
  return out;
};

// ===================== 2D transforms (same maths as Unity's Transform for our use) =====================
// matrix [a,b,c,d,e,f]: x' = a*x + c*y + e, y' = b*x + d*y + f
const M = {
  I: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  T: (x, y) => [1, 0, 0, 1, x, y],
  R: (deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; },
  S: (x, y) => [x, 0, 0, y, 0, 0],
  vec: (m, v) => ({ x: m[0] * v.x + m[2] * v.y, y: m[1] * v.x + m[3] * v.y }),
  pt: (m, v) => ({ x: m[0] * v.x + m[2] * v.y + m[4], y: m[1] * v.x + m[3] * v.y + m[5] }),
  ivec: (m, v) => { const det = m[0] * m[3] - m[2] * m[1]; return { x: (m[3] * v.x - m[2] * v.y) / det, y: (-m[1] * v.x + m[0] * v.y) / det }; }
};
RIG.M = M;
const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }), sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), mul: (a, k) => ({ x: a.x * k, y: a.y * k }),
  len: (a) => Math.hypot(a.x, a.y), norm: (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  rot: (a, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }; },
  sang: (a, b) => Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180 / Math.PI
};
RIG.V = V;
const deltaAngle = (a, b) => { let d = ((b - a) % 360 + 540) % 360 - 180; return d; };

// ===================== runtime: same simulation as the mod =====================
// rig = output of buildRig().rig ; frames(part) -> world matrix of a body part
RIG.Runtime = class {
  constructor(rig, images) {
    this.rig = rig; this.images = images; this.chains = []; this.acc = 0; this.time = 0; this.clock = 0; this.animState = new Map();
    const ppu = rig.pixelsPerUnit || 8;
    for (const c of rig.chains) {
      const segs = c.segments.map((s, k) => {
        let dir;
        if (s.tip) dir = V.sub(s.tip, s.joint);
        else if (k + 1 < c.segments.length) dir = V.sub(c.segments[k + 1].joint, s.joint);
        else { dir = k > 0 ? V.sub(s.joint, c.segments[k - 1].joint) : { x: -1, y: 0 }; const img = images[s.file]; dir = V.mul(V.norm(dir), Math.max(img.w, img.h) * 0.6); }
        if (V.len(dir) < 0.1) dir = { x: -1, y: 0 };
        const prevJ = k === 0 ? c.anchor : c.segments[k - 1].joint;
        return { def: s, local: { x: (s.joint.x - prevJ.x) / ppu, y: -(s.joint.y - prevJ.y) / ppu }, dirLocal: V.norm({ x: dir.x, y: -dir.y }),
          len: V.len(dir) / ppu, angle: s.restAngle || 0, p: { x: 0, y: 0 }, prev: { x: 0, y: 0 } };
      });
      const off = c.offset || { x: 0, y: 0 };
      this.chains.push({ def: c, segs, offset: { x: off.x / ppu, y: off.y / ppu }, init: false, lastRoot: null, wagBlend: 1, flapBlend: 0,
        motion: Object.assign(RIG.defaultMotion(), c.motion || {}) });
    }
  }
  // the frame a chain hangs from: its game part, or turned part-way toward a second part ("bends with")
  attachOf(c, frames) {
    const A = frames[c.def.attachTo]; if (!A) return null;
    if (!c.def.blendWith || !frames[c.def.blendWith]) return A;
    return RIG.blendM(A, frames[c.def.blendWith], c.def.blendWeight !== undefined ? c.def.blendWeight : 0.5);
  }
  // world matrices of every segment for the current angles
  segMatrices(c, attachM) {
    let parent = M.mul(attachM, M.T(c.offset.x, c.offset.y)); const out = [];
    for (const s of c.segs) { const m = M.mul(M.mul(parent, M.T(s.local.x, s.local.y)), M.R(s.angle)); out.push({ parent, m }); parent = m; }
    return out;
  }
  restTip(parentM, s, angle) {
    const pos = M.pt(parentM, s.local);
    return V.add(pos, M.vec(parentM, V.mul(V.rot(s.dirLocal, angle), s.len)));
  }
  reset(c, attachM) {
    for (const s of c.segs) s.angle = s.def.restAngle || 0;
    const ms = this.segMatrices(c, attachM);
    c.segs.forEach((s, i) => { s.p = this.restTip(ms[i].parent, s, s.angle); s.prev = { ...s.p }; });
    c.lastRoot = M.pt(ms[0].parent, c.segs[0].local); c.init = true;
  }
  // state: {frames: part->matrix, alive, moving, airborne}
  update(dt, state) {
    this.clock += dt;
    const STEP = 1 / 60;
    this.acc = Math.min(this.acc + dt, STEP * 5); let steps = 0;
    while (this.acc >= STEP) { this.acc -= STEP; steps++; }
    for (const c of this.chains) {
      const attachM = this.attachOf(c, state.frames); if (!attachM) continue;
      const root = M.pt(M.mul(attachM, M.T(c.offset.x, c.offset.y)), c.segs[0].local);
      if (!c.def.physics) { c.segs.forEach(s => s.angle = s.def.restAngle || 0); continue; }
      if (!c.init || (c.lastRoot && V.len(V.sub(root, c.lastRoot)) > 3)) this.reset(c, attachM);
      if (!steps) continue;
      const stepDelta = V.mul(V.sub(root, c.lastRoot), 1 / steps);
      const m = c.motion;
      const flapping = m.flapAmplitude !== 0 && state.alive && (m.flapWhen === 'always' || (m.flapWhen === 'air' && state.airborne));
      for (let k = 0; k < steps; k++) {
        this.time += STEP;
        const tw = state.alive ? (state.moving ? m.wagWhileMoving : 1) : 0;
        c.wagBlend += Math.max(-STEP * 2, Math.min(STEP * 2, tw - c.wagBlend));
        c.flapBlend += Math.max(-STEP * 3, Math.min(STEP * 3, (flapping ? 1 : 0) - c.flapBlend));
        this.simulate(c, m, state.alive, stepDelta, attachM);
      }
      c.lastRoot = root;
    }
  }
  simulate(c, m, alive, rootDelta, attachM) {
    const STEP = 1 / 60, t = this.time;
    const accel = V.sub({ x: 0, y: -(m.gravity * (alive ? 1 : m.deadGravity)) }, V.mul(rootDelta, m.drag / STEP));
    const a = V.mul(accel, STEP * STEP);
    for (const s of c.segs) {
      const vel = V.mul(V.sub(s.p, s.prev), 1 - m.damping);
      s.prev = V.add(s.p, V.mul(rootDelta, m.inertia));
      s.p = V.add(V.add(V.add(s.p, vel), a), V.mul(rootDelta, m.inertia));
    }
    const frame = M.mul(attachM, M.T(c.offset.x, c.offset.y));
    let parent = frame, restAbs = 0; const n = c.segs.length;
    for (let i = 0; i < n; i++) {
      const s = c.segs[i];
      const u = n > 1 ? i / (n - 1) : 0;
      const elast = m.elasticity * (1 + (m.elasticityFalloff - 1) * u);
      const stiff = m.stiffness * (1 + (m.stiffnessFalloff - 1) * u);
      const rest = (s.def.restAngle || 0)
        + Math.sin(t * m.wagSpeed * Math.PI * 2 - i * m.wagPhase) * m.wagAmplitude * c.wagBlend
        + Math.sin(t * m.flapSpeed * Math.PI * 2 - i * m.flapPhase) * m.flapAmplitude * c.flapBlend;
      restAbs += rest;
      const joint = M.pt(parent, s.local);
      const toTarget = M.vec(frame, V.mul(V.rot(s.dirLocal, restAbs), s.len));
      const target = V.add(joint, toTarget); const len = V.len(toTarget);
      let q = s.p;
      q = V.add(q, V.mul(V.sub(target, q), elast));
      if (stiff > 0) { const maxDev = len * 2 * (1 - stiff); const d = V.sub(q, target); const dl = V.len(d); if (dl > maxDev) q = V.add(target, V.mul(d, maxDev / dl)); }
      let dq = V.sub(q, joint); if (V.len(dq) < 1e-5) dq = toTarget;
      q = V.add(joint, V.mul(V.norm(dq), len));
      const v = M.ivec(parent, V.sub(q, joint));
      let ang = V.sang(s.dirLocal, v);
      const bend = (s.def.maxBend !== undefined && s.def.maxBend >= 0) ? s.def.maxBend : m.maxBend;
      ang = rest + Math.max(-bend, Math.min(bend, deltaAngle(rest, ang)));
      s.angle = ang;
      const segM = M.mul(M.mul(parent, M.T(s.local.x, s.local.y)), M.R(ang));
      s.p = this.restTip(parent, s, ang);
      parent = segM;
    }
  }
  // draw list: [{file, matrix(units), pivot px, order}]
  drawList(state) {
    const out = [];
    for (const c of this.chains) {
      const attachM = this.attachOf(c, state.frames); if (!attachM) continue;
      const base = (RIG.ORDER[c.def.attachTo] || 0) + (c.def.sortingOrderOffset || 0);
      const ms = this.segMatrices(c, attachM);
      const inj = c.def.injury && c.def.injury.enabled;
      const cut = inj && state.tornAt !== undefined && state.tornAt !== null ? Math.max(1, Math.min(c.segs.length, state.tornAt)) : c.segs.length + 1;
      c.segs.forEach((s, k) => {
        if (k >= cut) return;
        let file = s.def.file;
        // injuries apply to injurable pieces and to anything riding on a game limb (custom body parts...)
        const canHurt = (inj || c.def.attachTo !== 'tail') && (!state.injuryOnly || state.injuryOnly === c.def.name);
        const art = canHurt && s.def.injuryArt ? s.def.injuryArt : null;
        const anims = s.def.animations || null;
        const pick = (st) => { const v = art && art[st]; return v ? (typeof v === 'string' ? v : v.file) : null; };
        const play = (key) => { // frame of an animation set; restarts when the set changes
          const set = anims && anims[key]; if (!set || !set.frames || !set.frames.length) return null;
          const id = s; let st = this.animState.get(id);
          if (!st || st.key !== key) { st = { key, start: this.clock }; this.animState.set(id, st); }
          const n = set.frames.length, f = Math.floor((this.clock - st.start) * Math.max(0.01, set.fps || 8));
          return set.frames[set.loop === false ? Math.min(f, n - 1) : f % n];
        };
        let chosen = null;
        const stumpHere = inj && k === cut - 1 && cut <= c.segs.length;
        const hurtKey = stumpHere ? 'stump' : (canHurt ? state.injury : null);
        if (hurtKey) { const fr = play(hurtKey); if (fr) chosen = fr; else { const f = pick(hurtKey); if (f) file = f; else if (hurtKey === 'stump' && state.injury) { const fr2 = play(state.injury); if (fr2) chosen = fr2; else if (pick(state.injury)) file = pick(state.injury); } } }
        if (!chosen && file === s.def.file && !(state.headState && s.def.states && s.def.states[state.headState]) && anims) {
          const key = RIG.resolveAction(anims, state.action || 'idle'); if (key) chosen = play(key);
        }
        if (chosen) file = typeof chosen === 'string' ? chosen : chosen.file;
        if (state.headState && s.def.states && s.def.states[state.headState] && c.def.attachTo === 'Head') { const v = s.def.states[state.headState]; file = typeof v === 'string' ? v : v.file; }
        let px = s.def.x, py = s.def.y; // art for a state may sit at its own spot on the canvas
        for (const src of [s.def.injuryArt, s.def.states]) if (src) for (const st in src) { const v = src[st]; if (v && typeof v === 'object' && v.file === file) { px = v.x; py = v.y; } }
        if (chosen && typeof chosen === 'object') { px = chosen.x; py = chosen.y; }
        out.push({ file, m: ms[k].m, joint: s.def.joint, x: px, y: py, order: base + (s.def.order !== undefined ? s.def.order : k), chainAttach: c.def.attachTo, isPart: !!c.def.hideTarget });
      });
    }
    out.sort((a, b) => a.order - b.order);
    return out;
  }
};

// ===================== simple body animation for the preview =====================
RIG.bodyFrames = function (body) {
  // body: {x, y, facing(+1/-1), walk(phase), stride 0..1, run 0..1, crouch 0..1, lie 0..1, climb 0..1, swim 0..1, attack 0..1, t(seconds), tailAngle}
  const st = body.stride || 0, run = body.run || 0, cr = body.crouch || 0, lie = body.lie || 0, cl = body.climb || 0, sw = body.swim || 0, at = body.attack || 0, t = body.t || 0;
  const ph = body.walk || 0, s1 = Math.sin(ph);
  const idle = Math.max(0, 1 - st - cl - sw - lie);
  const breath = Math.sin(t * 2.2) * 0.05 * idle;
  const bob = -Math.abs(s1) * (0.1 + 0.14 * run) * st + breath + Math.sin(t * 3) * 0.12 * sw + Math.sin(ph * 2) * 0.06 * cl;
  const drop = 0.95 * cr + 2.55 * lie;
  const lean = -(3 + 10 * run) * st - 14 * cr - 8 * at + Math.sin(t * 1.1) * 0.8 * idle;
  // the game tilts the whole standing body around the belly when speeding up / slowing down (Body.accelRot)
  const tilt = M.mul(M.mul(M.T(0, 0.25), M.R(body.accelRot || 0)), M.T(0, -0.25));
  const root = M.mul(M.mul(M.mul(M.T(body.x, body.y), tilt), M.S(body.facing, 1)), M.mul(M.T(0, bob - drop), M.R(90 * lie)));
  const pivot = 0.75; // chest, head and arms lean around this point; belly, legs and tail don't
  const L = M.mul(M.mul(M.T(0, pivot), M.R(lean)), M.T(0, -pivot));
  const bend = {};
  const legAmp = (28 + 14 * run) * st, knee = (30 + 45 * run) * st;
  const leg = (side, p) => {
    const s = Math.sin(p), c = Math.cos(p);
    const th = legAmp * s + 68 * cr + 25 * lie + cl * (25 + 35 * Math.max(0, s)) + sw * 22 * s;
    const kn = -knee * Math.max(0, c) - 6 * st - 110 * cr - 25 * lie - cl * (40 + 45 * Math.max(0, s)) - sw * (20 + 18 * Math.max(0, c));
    bend['Thigh' + side] = th; bend['Crus' + side] = kn; bend['Foot' + side] = -(th + kn) * 0.6;
  };
  leg('F', ph); leg('B', ph + Math.PI);
  const arm = (side, p, near) => {
    const s = Math.sin(p);
    let ua = -(22 + 20 * run) * s * st + Math.sin(t * 1.3 + (near ? 0 : 1)) * 2.5 * idle + 25 * cr + cl * (150 + 22 * s) + sw * (70 + 55 * s) + 30 * lie;
    let da = (12 + 60 * run) * st + 15 * cr + 18 * cl + 25 * sw + 8 * idle + 10 * lie;
    if (near) { ua += 95 * at; da *= (1 - at); }
    bend['UpArm' + side] = ua; bend['DownArm' + side] = da; bend['Hand' + side] = 0.3 * da;
  };
  arm('F', ph + Math.PI, true); arm('B', ph, false);
  const pose = {};
  const nod = s1 * 1.5 * st;
  pose.Head = { x: RIG.REST.Head[0], y: RIG.REST.Head[1], r: -lean * 0.5 + nod, up: true };
  pose.UpTorso = { x: RIG.REST.UpTorso[0], y: RIG.REST.UpTorso[1], r: 0, up: true };
  pose.DownTorso = { x: RIG.REST.DownTorso[0], y: RIG.REST.DownTorso[1], r: lean * 0.25, up: false };
  const chains = [['UpArm', 'DownArm', 'Hand'], ['Thigh', 'Crus', 'Foot']];
  for (const side of ['F', 'B']) for (const names of chains) {
    let total = 0, h = null; const up = names[0] === 'UpArm';
    names.forEach((n, i) => {
      const key = n + side; total += bend[key] || 0;
      const hinge = h || { x: RIG.HINGE[n][0], y: RIG.HINGE[n][1] };
      const off = V.rot({ x: RIG.REST[key][0] - RIG.HINGE[n][0], y: RIG.REST[key][1] - RIG.HINGE[n][1] }, total);
      pose[key] = { x: hinge.x + off.x, y: hinge.y + off.y, r: RIG.REST[key][2] + total, up };
      if (i + 1 < names.length) { const nh = RIG.HINGE[names[i + 1]]; const d = V.rot({ x: nh[0] - RIG.HINGE[n][0], y: nh[1] - RIG.HINGE[n][1] }, total); h = { x: hinge.x + d.x, y: hinge.y + d.y }; }
    });
  }
  const frames = {};
  for (const k in pose) frames[k] = M.mul(root, M.mul(pose[k].up ? L : M.T(0, 0), M.mul(M.T(pose[k].x, pose[k].y), M.R(pose[k].r))));
  const dt = pose.DownTorso;
  frames.tail = M.mul(root, M.mul(M.mul(M.T(dt.x, dt.y), M.T(0, -0.353)), M.R((body.tailAngle !== undefined ? body.tailAngle : 23.6) + dt.r)));
  return frames;
};

// ===================== the game's own animation (from the player's game template) =====================
// tpl = template.json (skeleton, limbs, body numbers), clips = animations.json (sampled clips), overrides = custom animations
RIG.GameAnim = class {
  constructor(tpl, clips) {
    this.tpl = tpl; this.clips = clips || {}; this.skel = tpl.skeleton || {}; this.armsPath = tpl.armsPath || 'UpTorso/Arms';
    this.overrides = {};
    this.layers = { body: { st: null, prev: null }, arms: { st: null, prev: null } };
  }
  has(name) { return !!this.clips[name]; }
  // one clip at a time in seconds (looping or held), plus the rig's custom offsets for it
  clipPose(name, t) {
    const c = this.clips[name]; const out = {}; if (!c) return out;
    const len = c.length || 0, fps = c.fps || 30;
    let tt = len > 0 ? (c.loop ? ((t % len) + len) % len : Math.max(0, Math.min(len, t))) : 0;
    const fi = tt * fps;
    for (const path in c.tracks) {
      const fr = c.tracks[path]; const i0 = Math.min(fr.length - 1, Math.floor(fi)), i1 = Math.min(fr.length - 1, i0 + 1), u = fi - Math.floor(fi);
      const a = fr[i0], b = fr[i1];
      out[path] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + RIG.angDiff(a[2], b[2]) * u];
    }
    const ov = this.overrides[name];
    if (ov && ov.bones) for (const path in ov.bones) {
      if (!ov.bones[path] || !ov.bones[path].length) continue;
      const k = RIG.sampleKeys(ov.bones[path], tt);
      if (ov.mode === 'replace') { out[path] = [k.x || 0, k.y || 0, k.r || 0]; continue; } // the player's own pose for this bone
      const base = out[path] || this.rest(c.animator === 'arms' ? this.armsPath + '/' + path : path);
      out[path] = [base[0] + (k.x || 0), base[1] + (k.y || 0), base[2] + (k.r || 0)];
    }
    return out;
  }
  rest(path) { const s = this.skel[path]; return s ? [s.p[0], s.p[1], s.r] : [0, 0, 0]; }
  // the game's own value for one bone of a clip at time t (no custom animation)
  gameBone(name, path, t) {
    const keep = this.overrides; this.overrides = {}; const p = this.clipPose(name, t); this.overrides = keep;
    const c = this.clips[name];
    return p[path] || this.rest(c && c.animator === 'arms' ? this.armsPath + '/' + path : path);
  }
  // weighted list of {clip, w, ts} played together with one shared normalized time (like a Unity blend tree)
  treePose(list, u) {
    const out = {}; let wsum = 0;
    for (const it of list) {
      if (it.w <= 1e-4 || !this.clips[it.clip]) continue;
      const c = this.clips[it.clip]; const len = c.length || 0;
      let uu = it.ts < 0 ? 1 - (u - Math.floor(u)) : u;
      const p = this.clipPose(it.clip, uu * len);
      for (const k in p) { const o = out[k] || (out[k] = [0, 0, 0, 0]); o[0] += p[k][0] * it.w; o[1] += p[k][1] * it.w; o[2] += p[k][2] * it.w; o[3] += it.w; }
      wsum += it.w;
    }
    for (const k in out) { const o = out[k]; if (o[3] > 0) out[k] = [o[0] / o[3], o[1] / o[3], o[2] / o[3]]; }
    return out;
  }
  treeDuration(list) {
    let d = 0, w = 0;
    for (const it of list) { const c = this.clips[it.clip]; if (!c || it.w <= 1e-4) continue; d += it.w * ((c.length || 0) / Math.max(1e-3, Math.abs(it.ts || 1))); w += it.w; }
    return w > 0 ? d / w : 0;
  }
  // ---- the two Animator controllers (Anim.controller / Arms.controller), as blend trees + transitions
  bodyTree(state, P) {
    const row = RIG.blendRow;
    const mul = (l, k) => l.map(o => ({ ...o, w: o.w * k }));
    switch (state) {
      case 'Grounded': {
        const cy = Math.max(0, Math.min(1, P.crouch / 10000));
        const stand = row([{ x: -25, clip: 'ExperimentRunBack', ts: 1.6 }, { x: 0, clip: 'ExperimentIdle', ts: 1 }, { x: 25, clip: 'ExperimentRun', ts: 1.6 }], P.fwd);
        const crouch = row([{ x: -25, clip: 'ExperimentRunCrouch', ts: -4 }, { x: -12.5, clip: 'ExperimentRunCrouch', ts: -2 }, { x: 0, clip: 'ExperimentIdleCrouch', ts: 1 }, { x: 12.5, clip: 'ExperimentRunCrouch', ts: 2 }, { x: 25, clip: 'ExperimentRunCrouch', ts: 4 }], P.fwd);
        return [...mul(stand, 1 - cy), ...mul(crouch, cy)];
      }
      case 'Air': {
        const x = Math.max(-25, Math.min(25, P.fwd)), y = Math.max(-22, Math.min(16, P.up)), v = (y + 22) / 38;
        const cols = row([{ x: -25 }, { x: 0 }, { x: 25 }].map((p, i) => ({ ...p, clip: i, ts: 1 })), x);
        const up = ['ExperimentUpAirBack', 'ExperimentAirUp', 'ExperimentAirUpForward'], dn = ['ExperimentDownAirBackward', 'ExperimentAirDown', 'ExperimentDownAirForward'];
        return cols.flatMap(c => [{ clip: up[c.clip], ts: 1, w: c.w * v }, { clip: dn[c.clip], ts: 1, w: c.w * (1 - v) }]);
      }
      case 'Wall': return row([{ x: -1, clip: 'ExperimentWallBackward', ts: 1 }, { x: 1, clip: 'ExperimentWallForward', ts: 1 }], P.wallSide);
      case 'Climb': return row([{ x: -12, clip: 'ExperimentClimbDown', ts: 1 }, { x: 0, clip: 'ExperimentClimbIdle', ts: 1 }, { x: 4, clip: 'ExperimentClimbUp', ts: 1.66 }, { x: 12, clip: 'ExperimentClimbUp', ts: 5 }], P.up);
      default: return [{ clip: state, ts: 1, w: 1 }]; // a single clip state (ExperimentSit, ExperimentPushups...)
    }
  }
  armsTree(state, P) {
    const row = RIG.blendRow;
    const mul = (l, k) => l.map(o => ({ ...o, w: o.w * k }));
    switch (state) {
      case 'Grounded': {
        const cy = Math.max(0, Math.min(1, P.crouch / 10000));
        return [...mul(row([{ x: -25, clip: 'ArmsRun', ts: 1.6 }, { x: 0, clip: 'ArmsIdle', ts: 1 }, { x: 25, clip: 'ArmsRun', ts: 1.6 }], P.fwd), 1 - cy),
          ...mul(row([{ x: -25, clip: 'ArmsCrouchMove', ts: 1 }, { x: 0, clip: 'ArmsCrouch', ts: 1 }, { x: 25, clip: 'ArmsCrouchMove', ts: 1 }], P.fwd), cy)];
      }
      case 'Air': return row([{ x: -25, clip: 'ArmsAirDown', ts: 1 }, { x: 16, clip: 'ArmsAirUp', ts: 1 }], P.armsUp);
      case 'Climb': return row([{ x: -12, clip: 'ArmsClimbDown', ts: 1 }, { x: 0, clip: 'ArmsClimbIdle', ts: 1 }, { x: 4, clip: 'ArmsClimbUp', ts: 1.66 }, { x: 12, clip: 'ArmsClimbUp', ts: 5 }], P.up);
      default: return [{ clip: state, ts: 1, w: 1 }];
    }
  }
  // transitions (destination, fade seconds) from the controllers
  nextBody(cur, P) {
    if (P.force) return P.force === cur ? null : [P.force, 0.25];
    switch (cur) {
      case 'Grounded': if (P.climbing) return ['Climb', 0.19]; if (!P.grounded) return ['Air', P.up > 0 ? 0.083 : 0.347]; return null;
      case 'Air': if (P.climbing) return ['Climb', 0.165]; if (P.grounded) return ['Grounded', 0.054]; if (P.wallSide) return ['Wall', 0.1]; return null;
      case 'Wall': if (P.grounded) return ['Grounded', 0.18]; if (!P.wallSide) return ['Air', 0.15]; return null;
      case 'Climb': if (!P.climbing) return P.grounded ? ['Grounded', 0.136] : ['Air', 0.192]; return null;
      default: return ['Grounded', 0.25]; // a played clip state ends when the game asks for another
    }
  }
  nextArms(cur, P) {
    if (P.armsForce) return P.armsForce === cur ? null : [P.armsForce, 0.1];
    switch (cur) {
      case 'Grounded': if (P.climbing) return ['Climb', 0.12]; if (!P.grounded) return ['Air', 0.1]; return null;
      case 'Air': if (P.climbing) return ['Climb', 0.108]; if (P.grounded) return ['Grounded', 0.09]; return null;
      case 'Climb': if (!P.climbing) return P.grounded ? ['Grounded', 0.119] : ['Air', 0.119]; return null;
      case 'ArmsSwing': return P.swingDone ? (P.climbing ? ['Climb', 0.25] : P.grounded ? ['Grounded', 0.166] : ['Air', 0.166]) : null;
      default: return ['Grounded', 0.2];
    }
  }
  stepLayer(L, which, P, dt) {
    const treeOf = (s) => which === 'body' ? this.bodyTree(s, P) : this.armsTree(s, P);
    if (!L.st) L.st = { name: 'Grounded', u: 0 };
    const nx = which === 'body' ? this.nextBody(L.st.name, P) : this.nextArms(L.st.name, P);
    if (nx && nx[0] !== L.st.name) { L.prev = { st: L.st, fade: 0, dur: nx[1] }; L.st = { name: nx[0], u: 0 }; }
    const adv = (st) => { const tree = treeOf(st.name); const d = this.treeDuration(tree); st.u += d > 0 ? dt / d : 0; st.tree = tree; };
    adv(L.st); if (L.prev) { adv(L.prev.st); L.prev.fade += dt; if (L.prev.fade >= L.prev.dur) L.prev = null; }
    let pose = this.treePose(L.st.tree, L.st.u);
    if (L.prev) { const w = Math.min(1, L.prev.fade / Math.max(1e-3, L.prev.dur)); const pp = this.treePose(L.prev.st.tree, L.prev.st.u); pose = RIG.mixPose(pp, pose, w); }
    return pose;
  }
  // P: {fwd, up, armsUp, grounded, crouch(0..10000), climbing, wallSide, force (body clip/state), armsForce, swingDone}
  update(dt, P) {
    const body = this.stepLayer(this.layers.body, 'body', P, dt);
    const arms = this.stepLayer(this.layers.arms, 'arms', P, dt);
    return this.combine(body, arms);
  }
  // a single clip shown on its own (Animate tab)
  single(name, t) {
    const c = this.clips[name]; if (!c) return {};
    const p = this.clipPose(name, t);
    return c.animator === 'arms' ? this.combine({}, p) : this.combine(p, this.clipPose('ArmsIdle', 0));
  }
  combine(body, arms) { const out = Object.assign({}, body); for (const k in arms) out[this.armsPath + '/' + k] = arms[k]; return out; }
  // where each body part ends up (body-local, before facing), following Body.cs: parts copy their anim twin's position and angle
  partLocal(pose) {
    const out = {};
    for (const L of this.tpl.limbs || []) {
      if (!L.anim) continue;
      let m = M.I(), acc = '';
      for (const seg of L.anim.split('/')) { acc = acc ? acc + '/' + seg : seg; const v = pose[acc] || this.rest(acc); m = M.mul(m, M.mul(M.T(v[0], v[1]), M.R(v[2]))); }
      out[L.name] = m;
    }
    return out;
  }
};
// 1D blend weights over points [{x, clip, ts}] (piecewise linear, clamped), like a Unity 1D blend tree
RIG.blendRow = (pts, x) => {
  const r = pts.map(p => ({ clip: p.clip, ts: p.ts, w: 0 })); x = Math.max(pts[0].x, Math.min(pts[pts.length - 1].x, x));
  for (let i = 0; i + 1 < pts.length; i++) if (x <= pts[i + 1].x) { const u = (x - pts[i].x) / (pts[i + 1].x - pts[i].x || 1); r[i].w = 1 - u; r[i + 1].w = u; return r; }
  r[r.length - 1].w = 1; return r;
};
// a frame turned part-way from A toward B (same origin as A), keeping A's mirroring
RIG.blendM = (A, B, w) => {
  // frames are S(f)·R(θ): [f·cosθ, sinθ, -f·sinθ, cosθ, x, y] with f = ±1 (facing)
  const f = Math.sign(A[0] * A[3] - A[1] * A[2]) || 1;
  const angA = Math.atan2(A[1], A[0] * f), angB = Math.atan2(B[1], B[0] * f);
  let d = angB - angA; d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = angA + d * w, c = Math.cos(a), s2 = Math.sin(a);
  return [f * c, s2, -f * s2, c, A[4], A[5]];
};
RIG.angDiff = (a, b) => ((b - a) % 360 + 540) % 360 - 180;
RIG.mixPose = (a, b, w) => { const out = {}; const keys = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of keys) { const x = a[k] || b[k], y = b[k] || a[k]; out[k] = [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + RIG.angDiff(x[2], y[2]) * w]; } return out; };
RIG.sampleKeys = function (keys, t) {
  if (!keys || !keys.length) return { r: 0, x: 0, y: 0 };
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i + 1 < keys.length; i++) if (t <= keys[i + 1].t) {
    const a = keys[i], b = keys[i + 1]; let u = (t - a.t) / Math.max(1e-5, b.t - a.t); u = u * u * (3 - 2 * u);
    return { r: (a.r || 0) + ((b.r || 0) - (a.r || 0)) * u, x: (a.x || 0) + ((b.x || 0) - (a.x || 0)) * u, y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * u };
  }
  return keys[keys.length - 1];
};
// body part frames from the game animation, with Body.cs's standing extras (lean, head kept level, arms swing with the lean)
RIG.gameFrames = function (GA, pose, b) {
  const num = b.facing, local = GA.partLocal(pose);
  const acc = b.accelRot || 0, crouch = b.crouchAmount || 0, grounded = b.grounded !== false, attack = b.attackRot || 0;
  const about = (m, p, deg) => M.mul(M.mul(M.mul(M.T(p.x, p.y), M.R(deg * num)), M.T(-p.x, -p.y)), m); // a world-space turn, done in body space
  const pos = (m) => ({ x: m[4], y: m[5] });
  const drop = Math.abs(acc * 0.015);
  for (const n in local) local[n] = M.mul(M.T(0, -drop), local[n]);
  const limbs = GA.tpl.limbs || [];
  const dtP = local.DownTorso ? pos(local.DownTorso) : { x: 0, y: 0.25 };
  const head = limbs.find(l => l.isHead);
  if (head && local[head.name]) { // head stays level against the lean
    const bonus = -(acc + attack) + (grounded ? 0 : crouch * 45 * num);
    const a = head.anchor || [0, 0]; const ap = M.pt(local[head.name], { x: a[0], y: a[1] });
    if (bonus) local[head.name] = about(local[head.name], ap, bonus);
  }
  for (const L of limbs) {
    const m = local[L.name]; if (!m) continue;
    const isDT = L.name === 'DownTorso';
    const ang = acc + ((L.isLeg && !isDT) ? (grounded ? 0 : crouch * 15 * num) : (attack - (grounded ? 0 : crouch * 45 * num)));
    local[L.name] = about(m, dtP, ang);
  }
  const up = local.UpTorso ? pos(local.UpTorso) : { x: 0, y: 1.25 };
  for (const L of limbs) if (L.isArm && local[L.name]) local[L.name] = about(local[L.name], up, (acc + (grounded ? 0 : crouch * 45) + attack) * -num);
  const root = M.mul(M.T(b.x, b.y), M.S(num, 1));
  const frames = {};
  for (const n in local) frames[n] = M.mul(root, local[n]);
  if (frames.DownTorso) frames.tail = M.mul(frames.DownTorso, M.mul(M.T(0, -0.353), M.R(b.tailAngle !== undefined ? b.tailAngle : 23.6)));
  return frames;
};

if (typeof module !== 'undefined') module.exports = RIG;
