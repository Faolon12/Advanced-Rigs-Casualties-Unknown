# Handoff — AdvancedRigs Sprite Paint Editor

## Project
Combined rig editor + sprite paint editor as single self-contained index.html (bundled via build.py).

## Repository
- Fork: https://github.com/SilvastaTheProot/Sprite-Paint-Editor
- Branch: sprite-paint-editor
- Upstream: Faolon12/Advanced-Rigs-Casualties-Unknown (no write access — forked)
- Local clone: C:\Users\maksy\gh-fork-work
- Steam sync copy: C:\Program Files (x86)\Steam\steamapps\common\Casualties Unknown Demo\BepInEx\plugins\AdvancedRigs/index.html

## Files
| File | Path | Purpose |
|------|------|---------|
| Combined editor | C:\Users\maksy\gh-fork-work/index.html | 372KB self-contained rig + paint editor |
| Source JS | C:\Users\maksy\gh-fork-work/src/ui.js | Image loading error handling, ARIA |
| Source core | C:\Users\maksy\gh-fork-work/src/core.js | PSD reader, bone placement, physics |
| Paint source | C:\Users\maksy\gh-fork-work/sprite-paint.html | Original paint editor (merged into index.html) |
| Build script | C:\Users\maksy\gh-fork-work/build.py | Bundles src/ into index.html |
| Handoff | C:\Users\maksy\gh-fork-work/HANDOFF.md | This file |

## Git State
- Branch sprite-paint-editor is ahead of main by 17+ commits
- Last commit: 93e9d69 — fix: paint canvas sizing and preview visibility
- All commits signed with SSH key (SSH signing, not GPG — GPG crashes on this Windows/MSYS setup)
- Signing key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPK7eI1eVC8CCfOgmHXcvhLusEc4yNqSIUWhBigjcDXU — DO NOT CHANGE
- user.signingkey, gpg.format=ssh, commit.gpgsign=true configured locally
- GitHub Verified badge NOT showing — API returns verified=null. Key is registered as authentication, not signing key.

## What Works (verified in browser)
- Zero JS errors
- Rig Editor mode loads and functions
- Paint Editor mode loads and functions
- Mode switching: Rig ↔ Paint works
- Context preserved across mode switches (layers, tool, brushSize, color, zoom, viewTab)
- Paint canvas fills viewport (928×303px)
- Paint/Preview/Export tabs work
- Blend mode selector + layer opacity slider
- Live composite preview in Preview tab
- All paint ops: addLayer, deleteLayer, toggleVisibility, setOpacity, setColor, composite, updateUI

## Cross-Integration Bridge (just added — NOT YET TESTED)
Added bridge code in index.html before </script>:

1. Double-click rig layer → switch to paint mode + import that layer (row.ondblclick in layerRow())
2. importRigLayer(layerId) — import single rig layer into paint as paint layer with rigLayerId, rigX, rigY metadata
3. importAllRigAssets() — import all non-ignore rig layers as paint layers
4. pushPaintToRig() — push paint canvas composite back to matching rig layers by rigLayerId
5. renderRigPreview() — render rig composite onto paint preview canvas
6. UI buttons in paint header: "Import Rig Assets", "Rig Preview", "Push to Rig", plus status div rigIntegrationStatus
7. Buttons wired via initRigIntegration() called at end of script

NOT YET VERIFIED — the bridge functions exist in the file (verified typeof checks return ok) but the full flow hasn't been tested interactively.

## Known Issues / Risks
- GitHub Verified badge — SSH signing key added as auth key not signing key; API shows verified=null. User claims key added at GitHub Settings but not reflected.
- Bridge not tested — cross-integration code added but not verified end-to-end.
- MSYS bash fork-crashes — use execute_code (Python subprocess) or native PowerShell, not terminal with bash.
- gh CLI at C:\Users\maksy\AppData\Local\Programs\gh\gh.exe (not on PATH)

## Next Steps for New AI
1. Test bridge end-to-end: open rig → double-click layer → verify switch to paint → verify layer imported → edit → push back → verify rig updated
2. Fix GitHub Verified badge (signing key registration)
3. Consider adding live sync (paint edits update rig preview in real-time, not just on push)

## Environment
- Windows 11, no PowerShell (user dislikes it), uses POSIX/bash + Python execute_code
- Browser: local Chromium via browser_exec(local=True) for visible testing
- Python 3.14.9, no pip, uv installed
