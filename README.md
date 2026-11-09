# Luna Advanced Rig Systems Editor - Casualties Release V0.4 Alpha

A browser-based character rig editor for **Luna Advanced Rig Systems**, the BepInEx mod for *Casualties: Unknown* (get the mod on Nexus).
Turn a layered drawing into a fully custom character, with moving tails, ears, hair floof and wings, and test it with the same physics as the mod.

**No install:** open `index.html` in any modern browser. It also works offline, or hosted on GitHub Pages.

## Features

- **Sprite Paint (new, by Silvasta):** draw and repaint sprites right in the editor. **🖌 Sprite Paint** in the top bar, or **double-click any layer** to paint it.
- **Clothes & overlays (new):** tick **Over the limb** on any part layer to draw it *over* the body instead of replacing it (clothes, sleeves, armbands, patches). Tick **Above worn gear** too and nothing worn in game (a hoodie, jacket, gloves…) covers it.
- **Try on wearables (new):** **👕 Wearing** in the Test tab puts on any mix of the game's wearables (one per slot, like the game), and **👕 Also wearing** in the Gear tab shows the item you're redrawing together with other gear and your clothes.
- **Sprite Paint** follows the editor's theme.
  - **Tools:** pencil, crisp pixel brush (with optional tone variation), eraser, pixel eraser, fill, colour picker (or right-click), rectangle select with copy / cut / paste / nudge, flip and rotate. Also a palette, recent colours, layers with opacity, blend modes and isolation, and undo / redo.
  - **Straight to the rig:** paint a rig layer and it updates on the character as you go, even when you paint past its old edges. New paint layers are added to the rig (named *Ear*, *Tail*… they're set up as moving parts).
  - **Game sprites too:** *Other image assets* opens any game sprite, wearable, health-screen art or skin swap at its real size. What you paint becomes the rig's own version of it. *Head variants* copies your head art onto the other head states.
  - **Previews:** the whole rig next to your painting, or playing any of the game's animations.
  - **Paint session recovery:** the painting is kept in the browser, so a closed tab can be restored.
- **Props (new, for the Luna Props mod):** the **Props** button opens a pack maker for furniture and set dressing: load PNGs, drag the picture onto its pivot, add seats for chairs, make it solid or put it in front of / behind characters, animate it, and build **screens** (vending machines, terminals, notes) by placing text, pictures, boxes and buttons on pages. Buttons can go to another page, close, give an item, run a console command, make the character talk, show a message or play a sound. **Preview** lets you click through them. Export gives the pack zip for `BepInEx\plugins\LunaProps\Props`; **Open pack…** loads one back.

- **Open** `.psd` / `.psb` files directly (8-bit RGB), full-canvas PNG layers, an existing rig (`rig.json` + its PNGs), or a skin in the sprite-replacer format (`experiment*.png`, e.g. a Husk skin). A skin and a PSD can be opened together.
- **Automatic setup:** body parts are matched from layer names (Head, Chest, Abdomen, Shoulder/Arm/Hand Front/Back, Thigh, Calf, Foot/Hoof, Tail1..N, Ear, Fringe, Hair, Wing, Antler...), lined up on the game's skeleton, and given bones.
- **Bones:** drag joints (●) and tips (◆) on the canvas, or click *Auto bones*. Chains can have any number of pieces.
- **Spring-bone physics** with presets (fluffy tail, whip tail, hair/ears, wings, rigid) and sliders for damping, springiness, stiffness, gravity, drag, wag and wing flap.
- **Live test:** idle, walk, run, jump, turn, play dead, or grab the character with the mouse and shake it. The simulation is the same as the mod's.
- **Injurable parts** (optional, off by default): tick *Can be injured* on any tail, wing or hair part. Each piece then works like a real limb in game: it can be hit, bleed, get infected, have shards pulled out, and be bandaged, splinted, amputated or torn off.
- **Injury art:** art for every state of injurable pieces (scratched, wounded, mangled, bleeding, bandaged, tourniquet, infected, shrapnel, broken, dislocated, splinted, stump), plus the head's states (jaw ripped off, healed scars...). Preview any state, or a part torn off, in the Test tab.
- **Health screen editor:** the game's health screen with every part. Drag parts to place them, **resize any part** (V0.4: *Size* in the inspector, the purple corner handle, or scroll over a part; the game's own art too), and give any part (the game's own 15 or your injurable pieces) its own outline/middle art. Needs the mod V0.4+ for sizes to show in game.
- **Animated sprites:** frame sets for any part, per action (idle, walk, run, jump, fall, climb, swim, attack, sleep, knocked down, dead, always) or per injury state, with their own speed and loop or play-once. Layers named `Wing_fall_1`, `Head_frame_2`... are set up automatically. Preview any action in the Test tab.
- **Skins & gear:** *Add sprites…* loads PNGs named like the game's sprites (body parts, eyes, worn gear like backpacks and helmets, bandages) and health-screen art. In game, the mod's **F4** key (F9 before V0.4) saves all of these from your character, ready to repaint.
- **Game template (from your own game):** the mod writes `BepInEx/plugins/AdvancedRigs/GameTemplate` the first time you play (or F10). Load that folder once (click the template badge): you get the game's character put together exactly like the game (real pivots, near and far limbs, every mouth / jaw state and eye), every wearable to redraw, the health screen art, and the game's real animations and movement numbers for testing.
- **Gear tab:** every backpack, bag, helmet, glove… from your game with pictures. Pick one and it's shown worn on your character: drag it (or arrow keys) to fit, check it running, crouching, climbing, sitting…, then *⬇ PNG* → repaint → *Replace…*. Your version shows only while you wear it.
- **Injury tester (Test tab):** hurt any body part or injurable piece with any state (broken, bandaged, splinted, bleeding, infected…) or tear it off (takes the parts below with it), and see it on the character and on the health screen.
- **Animate:** change any game animation (running, jumping, the attack swing, sitting…) for your character by keying bone turns / moves; everything else stays the game's. Saved in the rig and played by the mod.
- **Bends with:** extra pieces between two game parts (5-piece legs, knee pads) turn part-way toward the next part.
- **Themes:** the Casualties lab-terminal look, or plain (*Theme* button). A PSD/PSB or PNGs named like the game's sprites (`experimentHeadBack`, `experimentUpArm`, `experimentEyeOpen`…) is put together the same way, even if the layers are scattered.
- **Whole character as a PSD / PSB:** *Character → All layers → ⬇ PSD / ⬇ PSB* saves every layer in one file (extra art hidden). Repaint, add or rename layers in Photoshop, Krita, GIMP or Photopea, then *⬆ Update from PSD…* (or just open it again): same-named layers update in place and keep their bones, roles and animations; new layers are added where you drew them, recognised by name when possible (antlers, ears, tail pieces, frames like `Wing_fall_3`…), and anything the editor can't guess is marked **NEW** for you to pick.
- **Edit in any art program:** *Download PNG* on any layer (or *Download all as PNGs*), paint it in Photoshop, Krita, Aseprite, Paint…, then *Replace…* (or drop the PNGs back in: layers with the same name are updated).
- **Extra art for any part:** *Extra art for this part* → pick a state (any injury state, mouth / jaw for the head, any eye) → *Add* makes a copy to repaint.
- **Any layer names:** besides the game's names (with your own prefix, like *FaolonHeadBack*) and words like head / thigh / tail / ear (plus short forms like *upr leg*, *L/R*, and Spanish, German, French, Italian words), folder names count (*upper* in a folder *Left Leg*). Names that mean nothing get a guess from where they sit on the body, shown as *Thigh (near)? ✓ ✗* (or *✓ Use all guesses*). Every role you set by hand is remembered, so your own naming style is set up for you next time (the same name, or the same pattern with other numbers).
- **Any art size:** art drawn bigger than the game's (2×, 3×, 4×…) is detected and kept sharp, exported with more pixels per unit so it's the right size in game. Change it or shrink it pixel-perfectly to game size under *Character → Art scale*. Canvas size never matters: every layer is trimmed to its pixels and keeps its spot.
- **Manual setup (top bar):** opening or adding files assigns nothing and moves nothing; select several layers and use *Set role…* to assign them together, move parts and place bones yourself. Bones you placed stay put when you add pieces.
- **Search, filter, X-ray:** search layers by name, show only one kind (body parts, moving parts, eyes / mouth / jaw, injury art, frames, gear, not assigned), and *X-ray* fades everything but the selection and outlines every layer.
- **Folders & multi-select:** Ctrl/Shift-click to pick several layers, then *📁 New folder*, *🗑 Delete* or drag them together. Drop layers on a folder to put them in it. Folders only keep the list tidy (nothing changes in game), are saved in projects and come and go with PSD/PSB layer groups. Imported GIF frames get their own folder.
- **Joining moving parts:** *Join with…* on a moving part makes another one hang off its tip (a scarf knot with loose ends, a tail in parts). *📌* on a piece makes it rigid (no bending, no swinging) while the pieces after it still swing; joining a still part with a swinging one pins the still pieces for you.
- **Animated loops:** *Import GIF / WebP / PNG frames…* on a part makes a looping animation; *▶ Preview* plays it on the Rig canvas with the previous frame faint (onion skin). Frames always land on the part as it is now; *⤓ Snap frames onto the part* puts drifted frames back. Select frames in the layer list to drag them on their own.
- **Undo / redo:** Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z).
- **Layer order:** drag layers in the list (top = in front) or use *▲ Forward / ▼ Back*. The export keeps your stacking in game.
- **Injury groups:** pick which pieces of a moving part can be hurt and which pieces form one limb.
- **Test it like the game:** with the game template loaded, the test uses the game's own animations, blend trees and movement numbers; play with the keyboard (A/D, Shift to walk, Space to jump and wall-jump, S crouch, W/S ladders, F attack, T talk, R ragdoll, Z sleep, X dead). The state picked, the eyes and the mouth follow the same rules as the game and the mod. Demos for every state too.
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
| `src/props.js` | The Props pack maker (Luna Props mod) |
| `src/paint.js` | Sprite Paint (by Silvasta): its panel, and its link to the rig through `window.__rigEditor` |
| `build.py` | `python build.py` bundles `src/` into `index.html` |
| `test/test_core.js` | `node test/test_core.js MyChar.psb ...` checks parsing, auto-setup, simulation stability and export/import round-trips |

## Rig format

See the mod's README for the full `rig.json` reference. When you change the physics in `src/core.js`, change `RigInstance.cs` in the mod to match, or the preview will stop matching the game.

## Disclaimer & credits

Luna Advanced Rig Systems is a fan-made mod and tool. Sprite Paint was made by **Silvasta** (with help from an AI assistant), inspired by Faolonrose's main project. It is **not made by or affiliated with** the developer of *Casualties: Unknown*.

* **The editor's Test tab is a simulation.** Its movement, wall jumps, states, eyes, mouth and injury rules are re-created from *Casualties: Unknown*'s code by **Orson**, to preview characters outside the game. It is not the game and won't match it exactly (the game's own animations and movement numbers aren't included).
* **Nothing from the game is included.** The game template (the character's sprites, every wearable, the health screen art and the animations) is written by the mod from the player's own copy of the game, and loaded into the editor from there. *Casualties: Unknown*, its code and its art belong to Orson.
