"""Bundles src/ into one self-contained index.html (works offline and on GitHub Pages).
    python build.py"""
import os
here = os.path.dirname(os.path.abspath(__file__))
src = lambda f: open(os.path.join(here, 'src', f), encoding='utf-8').read()
html = src('ui.html').replace('/*__CORE__*/', src('core.js') + '\n' + src('vanilla_hs.js')).replace('/*__UI__*/', src('ui.js'))
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(html)
print('built index.html')
