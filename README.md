# Luna Advanced Rig Systems Editor - Casualties Release V0.1 Alpha

A browser-based character rig editor for **Luna Advanced Rig Systems**, the BepInEx mod for *Casualties: Unknown* (get the mod on Nexus).
Turn a layered drawing into a fully custom character, with moving tails, ears, hair floof and wings, and test it with the same physics as the mod.

**No install:** open `index.html` in any modern browser. It also works offline, or hosted on GitHub Pages.

## Features

- **Open** `.psd` / `.psb` files directly (8-bit RGB), full-canvas PNG layers, an existing rig (`rig.json` + its PNGs), or a skin in the sprite-replacer format (`experiment*.png`, e.g. a Husk skin). A skin and a PSD can be opened together.
- **Automatic setup:** body parts are matched from layer names (Head, Chest, Abdomen, Shoulder/Arm/Hand Front/Back, Thigh, Calf, Foot/Hoof, Tail1..N, Ear, Fringe, Hair, Wing, Antler...), lined up on the game's skeleton, and given bones.
- **Bones:** drag joints (●) and tips (◆) on the canvas, or click *Auto bones*. Chains can have any number of pieces.
- **Spring-bone physics** with presets (fluffy tail, whip tail, hair/ears, wings, rigid) and sliders for damping, springiness, stiffness, gravity, drag, wag and wing flap.
- **Live test:** idle, walk, run, jump, turn, play dead, or grab the character with the mouse and shake it. The simulation is the same as the mod's.
- **Injurable parts** (optional, off by default): tick *Can be injured* on any tail, wing or hair part. Each piece then works like a real limb in game: it can be hit, bleed, get infected, have shards pulled out, and be bandaged, splinted, amputated or torn off.
- **Injury art:** art for every state of injurable pieces (scratched, wounded, mangled, bleeding, bandaged, tourniquet, infected, shrapnel, broken, dislocated, splinted, stump), plus the head's states (jaw ripped off, healed scars...). Preview any state, or a part torn off, in the Test tab.
- **Health screen editor:** the game's health screen with every part. Drag parts to place them, and give any part (the game's own 15 or your injurable pieces) its own outline/middle art.
- **Animated sprites:** frame sets for any part, per action (idle, walk, run, jump, fall, climb, swim, attack, sleep, knocked down, dead, always) or per injury state, with their own speed and loop or play-once. Layers named `Wing_fall_1`, `Head_frame_2`... are set up automatically. Preview any action in the Test tab.
- **Skins & gear:** *Add sprites…* loads PNGs named like the game's sprites (body parts, eyes, worn gear like backpacks and helmets, bandages) and health-screen art. In game, the mod's **F9** key saves all of these from your character, ready to repaint.
- **Game template (from your own game):** the mod writes `BepInEx/plugins/AdvancedRigs/GameTemplate` the first time you play (or F10). Load that folder once (click the template badge): you get the game's character put together exactly like the game (real pivots, near and far limbs, every mouth / jaw state and eye), every wearable to redraw, the health screen art, and the game's real animations and movement numbers for testing.
- **Gear tab:** every backpack, bag, helmet, glove… from your game with pictures. Pick one and it's shown worn on your character: drag it (or arrow keys) to fit, check it running, crouching, climbing, sitting…, then *⬇ PNG* → repaint → *Replace…*. Your version shows only while you wear it.
- **Injury tester (Test tab):** hurt any body part or injurable piece with any state (broken, bandaged, splinted, bleeding, infected…) or tear it off (takes the parts below with it), and see it on the character and on the health screen.
- **Animate:** change any game animation (running, jumping, the attack swing, sitting…) for your character by keying bone turns / moves; everything else stays the game's. Saved in the rig and played by the mod.
- **Bends with:** extra pieces between two game parts (5-piece legs, knee pads) turn part-way toward the next part.
- **Themes:** the Casualties lab-terminal look, or plain (*Theme* button). A PSD/PSB or PNGs named like the game's sprites (`experimentHeadBack`, `experimentUpArm`, `experimentEyeOpen`…) is put together the same way, even if the layers are scattered.
- **Whole character as a PSD / PSB:** *Character → All layers → ⬇ PSD / ⬇ PSB* saves every layer in one file (extra art hidden). Repaint, add or rename layers in Photoshop, Krita, GIMP or Photopea, then *⬆ Update from PSD…* (or just open it again): same-named layers update in place and keep their bones, roles and animations; new layers are added where you drew them, recognised by name when possible (antlers, ears, tail pieces, frames like `Wing_fall_3`…), and anything the editor can't guess is marked **NEW** for you to pick.
- **Edit in any art program:** *Download PNG* on any layer (or *Download all as PNGs*), paint it in Photoshop, Krita, Aseprite, Paint…, then *Replace…* (or drop the PNGs back in: layers with the same name are updated).
- **Extra art for any part:** *Extra art for this part* → pick a state (any injury state, mouth / jaw for the head, any eye) → *Add* makes a copy to repaint.
- **Folders & multi-select:** Ctrl/Shift-click to pick several layers, then *📁 New folder*, *🗑 Delete* or drag them together. Drop layers on a folder to put them in it. Folders only keep the list tidy (nothing changes in game), are saved in projects and come and go with PSD/PSB layer groups. Imported GIF frames get their own folder.
- **Animated loops:** *Import GIF / WebP / PNG frames…* on a part makes a looping animation; *▶ Preview* plays it on the Rig canvas with the previous frame faint (onion skin).
- **Undo / redo:** Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z).
- **Layer order:** drag layers in the list (top = in front) or use *▲ Forward / ▼ Back*. The export keeps your stacking in game.
- **Injury groups:** pick which pieces of a moving part can be hurt and which pieces form one limb.
- **Test it like the game:** with the game template loaded, the test uses the game's own animations, blend trees and movement numbers; play with the keyboard (A/D, Shift to walk, Space to jump and wall-jump, S crouch, W/S ladders, swim in the pool, F attack, T talk, R ragdoll, Z sleep, X dead). The state picked, the eyes and the mouth follow the same rules as the game and the mod. Demos for every state too.
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

## Rig format

See the mod's README for the full `rig.json` reference. When you change the physics in `src/core.js`, change `RigInstance.cs` in the mod to match, or the preview will stop matching the game.

## Disclaimer & credits

Luna Advanced Rig Systems is a fan-made mod and tool. It is **not made by or affiliated with** the developer of *Casualties: Unknown*.

* **The editor's Test tab is a simulation.** Its movement, wall jumps, states, eyes, mouth and injury rules are re-created from *Casualties: Unknown*'s code by **Orson**, to preview characters outside the game. It is not the game and won't match it exactly (the game's own animations and movement numbers aren't included).
* **Nothing from the game is included.** The game template (the character's sprites, every wearable, the health screen art and the animations) is written by the mod from the player's own copy of the game, and loaded into the editor from there. *Casualties: Unknown*, its code and its art belong to Orson.
