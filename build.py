"""Bundles src/ into one self-contained index.html (works offline and on GitHub Pages).
    python build.py
"""
import os
import sys
import shutil
from datetime import datetime

here = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(here, 'src')
out = os.path.join(here, 'index.html')
backup_dir = os.path.join(here, '.build-backups')

def src(f):
    path = os.path.join(src_dir, f)
    if not os.path.exists(path):
        print(f"ERROR: missing source file: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding='utf-8') as fh:
        return fh.read()

def main():
    # Validate all source files exist
    for f in ['ui.html', 'core.js', 'vanilla_hs.js', 'ui.js', 'props.js', 'paint.js']:
        src(f)  # will exit if missing

    # Back up previous index.html if it exists
    if os.path.exists(out):
        os.makedirs(backup_dir, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup_path = os.path.join(backup_dir, f'index-{ts}.html')
        shutil.copy2(out, backup_path)
        print(f'backed up previous build to {backup_path}')

    # Nothing from the game is bundled: the game template (sprites, wearables, animations) is loaded from the player's
    # own game, where the mod writes it (BepInEx/plugins/AdvancedRigs/GameTemplate).
    html = (src('ui.html')
            .replace('/*__CORE__*/', src('core.js') + '\n' + src('vanilla_hs.js'))
            .replace('/*__UI__*/', src('ui.js'))
            .replace('/*__PROPS__*/', src('props.js'))
            .replace('/*__PAINT__*/', src('paint.js')))

    # Sanity check: every marker replaced
    for marker in ('/*__CORE__*/', '/*__UI__*/', '/*__PROPS__*/', '/*__PAINT__*/'):
        if marker in html:
            print(f"ERROR: {marker} marker not replaced in ui.html", file=sys.stderr)
            sys.exit(1)

    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('built index.html')

if __name__ == '__main__':
    main()
