const RIG = require('../src/core.js'); const fs = require('fs');
const files = Object.fromEntries(process.argv.slice(2).map(f => [require('path').basename(f).replace(/\.ps[db]$/i, ''), f]));
if (!Object.keys(files).length) { console.log('usage: node test/test_core.js Character1.psb [Character2.psb ...]'); process.exit(0); }
for (const [name, f] of Object.entries(files)) {
  const b = fs.readFileSync(f); const psd = RIG.readPSD(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const doc = RIG.newDoc(name, psd.width, psd.height, psd.layers);
  RIG.autoAssign(doc);
  console.log(`\n== ${name} ${psd.width}x${psd.height} layers=${doc.layers.length} align=${JSON.stringify(doc.align)}`);
  for (const l of doc.layers) console.log('  ', l.order, l.name.padEnd(16), JSON.stringify(l.role.type === 'chain' ? { chain: RIG.chain(doc, l.role.chain).name } : l.role));
  for (const c of doc.chains) console.log('  chain', c.name, c.attachTo, c.segs.map(s => JSON.stringify(s.joint) + (s.tip ? '->' + JSON.stringify(s.tip) : '')).join(' '));
  const { rig, files: fl } = RIG.buildRig(doc);
  const images = {}; for (const k in fl) images[k] = fl[k];
  const rt = new RIG.Runtime(rig, images);
  let body = { x: 0, y: 0, facing: 1, walk: 0, stride: 0, tailAngle: 23.6 };
  let bad = false;
  for (let f = 0; f < 600; f++) {
    const t = f / 60; const running = f > 120 && f < 300;
    if (running) { body.x += 6 / 60; body.walk += 0.25; body.stride = 1; body.tailAngle = -6; } else { body.stride = 0; body.tailAngle = 23.6; }
    if (f >= 360 && f < 408) body.y = 8 * ((f - 360) / 60) - 10 * ((f - 360) / 60) ** 2;
    if (f === 450) body.facing = -1;
    rt.update(1 / 60, { frames: RIG.bodyFrames(body), alive: true, moving: running, airborne: body.y > 0.01 });
    for (const c of rt.chains) for (const s of c.segs) if (!isFinite(s.angle) || !isFinite(s.p.x)) bad = true;
  }
  console.log('  sim ok:', !bad, ' tail angles:', (rt.chains.find(c => c.def.attachTo === 'tail') || { segs: [] }).segs.map(s => s.angle.toFixed(1)).join(','));
  }
// round trip: build -> docFromRig -> build
{
  const b = fs.readFileSync(Object.values(files)[0]); const psd = RIG.readPSD(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const doc = RIG.newDoc('Rig', psd.width, psd.height, psd.layers); RIG.autoAssign(doc);
  const a = RIG.buildRig(doc);
  const images = {}; for (const k in a.files) images[k] = a.files[k];
  const doc2 = RIG.docFromRig(JSON.parse(JSON.stringify(a.rig)), images);
  const b2 = RIG.buildRig(doc2);
  const strip = (r) => JSON.stringify(r.chains.map(c => [c.attachTo, c.sortingOrderOffset, c.segments.map(s => [s.x, s.y, s.joint, s.tip || null])]).sort());
  console.log('\nroundtrip identical:', strip(a.rig) === strip(b2.rig));
  console.log('orders:', a.rig.chains.filter(c => c.physics).map(c => c.name + ':' + c.sortingOrderOffset).join(' '));
}
// injury + health screen round trip
{
  const b = fs.readFileSync(Object.values(files)[0]); const psd = RIG.readPSD(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const doc = RIG.newDoc('Rig', psd.width, psd.height, psd.layers); RIG.autoAssign(doc);
  const tail = doc.chains.find(c => c.attachTo === 'tail');
  if (tail) {
    tail.injury.enabled = true; tail.injury.name = 'Tail';
    // pretend the "Head" layer is injury art for tail piece 2, and give piece 1 health screen art
    const art = doc.layers.find(l => l.role.type === 'ignore') || doc.layers[0];
    const extra = { ...doc.layers[0], id: RIG.newId(), name: 'TailWound', order: 99, role: { type: 'injury', of: tail.segs[1].layer, state: 'wounded' } };
    doc.layers.push(extra);
    const img = { w: 4, h: 4, rgba: new Uint8ClampedArray(64).fill(255) };
    doc.healthScreen['seg:' + tail.segs[0].layer] = { outline: img, middle: img, x: -150, y: 20, scale: 3 };
    doc.healthScreen.Head = { outline: img, x: 0, y: 240, scale: 3 };
    const a = RIG.buildRig(doc);
    const t = a.rig.chains.find(c => c.attachTo === 'tail');
    console.log('injury exported:', JSON.stringify(t.injury), '| art on piece 2:', JSON.stringify(t.segments[1].injuryArt), '| hs piece 1:', !!t.segments[0].healthScreen, '| hs Head:', !!(a.rig.healthScreen && a.rig.healthScreen.parts.Head));
    const images = {}; for (const k in a.files) images[k] = a.files[k];
    const d2 = RIG.docFromRig(JSON.parse(JSON.stringify(a.rig)), images); const b2 = RIG.buildRig(d2);
    const pick = (r) => JSON.stringify([r.healthScreen, r.chains.map(c => [c.attachTo + ':' + c.name, c.injury || null, c.segments.map(s => [s.injuryArt || null, s.healthScreen || null])]).sort()]);
    console.log('injury round trip identical:', pick(a.rig) === pick(b2.rig));
    // preview with injury state + torn off
    const rt = new RIG.Runtime(a.rig, images);
    const fr = RIG.bodyFrames({ x: 0, y: 0, facing: 1, walk: 0, stride: 0, tailAngle: 23.6 });
    rt.update(1 / 30, { frames: fr, alive: true, moving: false, airborne: false });
    const n1 = rt.drawList({ frames: fr, injury: 'wounded' }).filter(i => i.file === t.segments[1].injuryArt.wounded.file).length;
    const n2 = rt.drawList({ frames: fr, tornAt: 2 }).filter(i => t.segments.slice(2).some(s => s.file === i.file)).length;
    console.log('preview: wounded art drawn', n1, '| pieces after the tear drawn', n2);
  }
}
// animations: frames found by name, export/import, action + injury selection
{
  const b = fs.readFileSync(Object.values(files)[0]); const psd = RIG.readPSD(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const head = psd.layers.find(l => /^head$/i.test(l.name)), t1 = psd.layers.find(l => /^tail1$/i.test(l.name));
  const extra = [];
  if (head) ['Head_frame_1', 'Head_frame_2', 'Head_dead_1', 'Head_bleeding_1'].forEach((n, i) => extra.push({ ...head, name: n, order: 100 + i }));
  if (t1) ['Tail1_fall_1', 'Tail1_fall_2', 'Tail1_idle_1'].forEach((n, i) => extra.push({ ...t1, name: n, order: 200 + i }));
  const doc = RIG.newDoc('Rig', psd.width, psd.height, psd.layers.concat(extra)); RIG.autoAssign(doc);
  const nm = (id) => RIG.layer(doc, id).name;
  for (const id in doc.anims) console.log('anim sets for', nm(id), JSON.stringify(Object.fromEntries(Object.entries(doc.anims[id]).map(([k, v]) => [k, v.frames.map(nm)]))));
  const a = RIG.buildRig(doc);
  const images = {}; for (const k in a.files) images[k] = a.files[k];
  const d2 = RIG.docFromRig(JSON.parse(JSON.stringify(a.rig)), images); const b2 = RIG.buildRig(d2);
  const pick = (r) => JSON.stringify(r.chains.map(c => [c.attachTo + ':' + c.name, c.segments.map(s => s.animations || null)]).sort());
  console.log('animation round trip identical:', pick(a.rig) === pick(b2.rig));
  const rt = new RIG.Runtime(a.rig, images);
  const fr = RIG.bodyFrames({ x: 0, y: 0, facing: 1, walk: 0, stride: 0, tailAngle: 23.6 });
  const headFile = (st) => { const it = rt.drawList(Object.assign({ frames: fr }, st)).filter(i => i.order === 50); return it.map(i => i.file).join(','); };
  const tailFile = (st) => rt.drawList(Object.assign({ frames: fr }, st)).filter(i => i.order >= 101 && i.order < 102).map(i => i.file)[0];
  rt.update(0.01, { frames: fr, alive: true });
  console.log('head idle (falls back to always):', headFile({ action: 'idle' }));
  rt.update(0.13, { frames: fr, alive: true });
  console.log('head after 0.14s (next frame):', headFile({ action: 'idle' }));
  console.log('head dead:', headFile({ action: 'dead' }), '| head bleeding:', headFile({ action: 'idle', injury: 'bleeding' }));
  console.log('tail piece 1 jumping (falls back to fall):', tailFile({ action: 'jump' }), '| running (falls back to idle):', tailFile({ action: 'run' }));
}
// sounds survive export/import
{
  const doc = RIG.newDoc('S', 10, 10, []); doc.sounds = { pain: [{ file: 'whine.wav', data: new Uint8Array([1, 2, 3]) }] };
  const a = RIG.buildRig(doc); const files = {}; for (const k in a.files) files[k] = a.files[k];
  const d2 = RIG.docFromRig(JSON.parse(JSON.stringify(a.rig)), files);
  console.log('sounds exported:', JSON.stringify(a.rig.sounds), '| round trip:', JSON.stringify(d2.sounds.pain.map(f => [f.file, [...f.data]])));
}
