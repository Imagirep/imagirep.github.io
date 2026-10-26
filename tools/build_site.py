"""Assemble index.html from index.src.html: insert the teaser fragment and inline the data as JSON scripts.

  python tools/build_teaser.py && python tools/build_site.py
"""
import hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'index.src.html'), encoding='utf-8').read()
teaser = open(os.path.join(ROOT, 'partials', 'teaser.html'), encoding='utf-8').read()
results = json.load(open(os.path.join(ROOT, 'static', 'data', 'results.json'), encoding='utf-8'))
examples = json.load(open(os.path.join(ROOT, 'static', 'data', 'examples.json'), encoding='utf-8'))
data = ('<script>window.RESULTS = ' + json.dumps(results, separators=(',', ':')) + ';\n'
        'window.EXAMPLES = ' + json.dumps(examples, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/') + ';</script>')
out = src.replace('<!--TEASER-->', teaser).replace('<!--DATA-->', data)
# cache-bust css/js and figures so a redeploy is picked up immediately
def _bust(m):
    h = hashlib.md5(open(os.path.join(ROOT, m.group(2)), 'rb').read()).hexdigest()[:8]
    return f'{m.group(1)}="{m.group(2)}?v={h}"'
out = re.sub(r'(href|src)="(static/(?:css|js|fig|teaser)/[\w.-]+)"', _bust, out)
CJK = re.compile('[　-〿㐀-䶿一-鿿＀-￯]')
assert not CJK.search(out), 'CJK characters in the page'
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(out)
print('index.html', round(len(out) / 1024), 'KB')
