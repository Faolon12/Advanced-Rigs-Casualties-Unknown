# Advanced Rigs Editor

A browser-based character rig editor for **Advanced Rigs**, the BepInEx mod for *Casualties: Unknown* (get the mod on Nexus).
Turn a layered drawing into a fully custom character, with moving tails, ears, hair floof and wings, and test it with the same physics as the mod.

**No install:** open `index.html` in any modern browser. It also works offline, or hosted on GitHub Pages.

## Features

- **Open** `.psd` / `.psb` files directly (8-bit RGB), full-canvas PNG layers, an existing rig (`rig.json` + its PNGs), or a skin in the sprite-replacer format (`experiment*.png`, e.g. a Husk skin). A skin and a PSD can be opened together.
- **Automatic setup:** body parts are matched from layer names (Head, Chest, Abdomen, Shoulder/Arm/Hand Front/Back, Thigh, Calf, Foot/Hoof, Tail1..N, Ear, Fringe, Hair, Wing, Antler...), lined up on the game's skeleton, and given bones.
- **Bones:** drag joints (●) and tips (◆) on the canvas, or click *Auto bones*. Chains can have any number of pieces.
- **Spring-bone physics** with presets (fluffy tail, whip tail, hair/ears, wings, rigid) and sliders for damping, springiness, stiffness, gravity, drag, wag and wing flap.
- **Live test:** idle, walk, run, jump, turn, play dead, or grab the character with the mouse and shake it. The simulation is the same as the mod's mostly, some issues and bugs.
- **Injurable parts** (optional, off by default): tick *Can be injured* on any tail, wing or hair part. Each piece then works like a real limb in game: it can be hit, bleed, get infected, have shards pulled out, and be bandaged, splinted, amputated or torn off.
- **Injury art:** art for every state of injurable pieces (scratched, wounded, mangled, bleeding, bandaged, tourniquet, infected, shrapnel, broken, dislocated, splinted, stump), plus the head's states (jaw ripped off, healed scars...). Preview any state, or a part torn off, in the Test tab.
- **Health screen editor:** the game's health screen with every part. Drag parts to place them, and give any part (the game's own 15 or your injurable pieces) its own outline/middle art.
- **Animated sprites:** frame sets for any part, per action (idle, walk, run, jump, fall, climb, swim, attack, sleep, knocked down, dead, always) or per injury state, with their own speed and loop or play-once. Layers named `Wing_fall_1`, `Head_frame_2`... are set up automatically. Preview any action in the Test tab.
- **Skins & gear:** *Add sprites…* loads PNGs named like the game's sprites (body parts, eyes, worn gear like backpacks and helmets, bandages) and health-screen art. In game, the mod's **F9** key saves all of these from your character, ready to repaint.
- **Mouth & eyes:** give the head *Mouth half open* / *Mouth open* art and it moves when the character talks, whimpers, barks, yawns or pants in game.
- **Sounds:** keep the game's character sounds, or pick your own `.wav`/`.ogg`/`.mp3` files for pain, bark, pant, growl, yawn and more (or any game sound by name). Preview them in the character panel.
- **Export** a ready-to-use rig folder as a `.zip`.

## Using it

1. Draw your character standing and **facing right**, at the game's scale (8 px = 1 unit; the game's character is about 50 px tall). Put each part on its own layer.
2. Open it here. Check the dropdown next to each layer, and use *Auto-align* or *Move skeleton* so your parts sit on the game's body boxes.
3. Click tail, ear or wing layers to adjust bones and motion, then try it in the **Test** tab.
4. **Export** and unzip into `BepInEx\plugins\AdvancedRigs\Rigs\`. In game, press **F7** to pick the rig and **F8** to reload after changes.

## Repository layout

| Path | What it is |
|------|------------|
| `index.html` | The editor: one self-contained file, built from `src/` |
| `src/core.js` | PSD/PSB reader, auto-matching, bone placement, rig export, zip writer, and the spring-bone simulation (kept identical to the mod's `RigInstance.cs`) |
| `src/ui.js`, `src/ui.html` | Interface |
| `build.py` | `python build.py` bundles `src/` into `index.html` |
| `test/test_core.js` | `node test/test_core.js MyChar.psb ...` checks parsing, auto-setup, simulation stability and export/import round-trips |
| `tools/` | Command-line alternatives (Python + Pillow): `psb_extract.py`, `make_rig.py`, `preview_rig.py` |

## Rig format

See the mod's README for the full `rig.json` reference. When you change the physics in `src/core.js`, change `RigInstance.cs` in the mod to match, or the preview will stop matching the game.
