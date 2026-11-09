"""Bundles src/ into one self-contained index.html (works offline and on GitHub Pages).
    python build.py"""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))

def src(f):
    path = os.path.join(here, 'src', f)
    if not os.path.exists(path):
        sys.exit('ERROR: missing source file: ' + path)
    with open(path, encoding='utf-8') as fh:
        return fh.read()

# Nothing from the game is bundled: the game template (sprites, wearables, animations) is loaded from the player's
# own game, where the mod writes it (BepInEx/plugins/AdvancedRigs/GameTemplate).
html = (src('ui.html')
        .replace('/*__CORE__*/', src('core.js') + '\n' + src('vanilla_hs.js'))
        .replace('/*__UI__*/', src('ui.js'))
        .replace('/*__PROPS__*/', src('props.js'))
        .replace('/*__PAINT__*/', src('paint.js')))
for marker in ('/*__CORE__*/', '/*__UI__*/', '/*__PROPS__*/', '/*__PAINT__*/'):
    if marker in html:
        sys.exit('ERROR: ' + marker + ' was not replaced: check src/ui.html')
with open(os.path.join(here, 'index.html'), 'w', encoding='utf-8') as fh:
    fh.write(html)
print('built index.html')
