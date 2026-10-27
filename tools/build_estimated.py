"""Add the estimated representations of each explorer question to static/data/examples.json.

The assets are exactly what GPT-6.1-sol received in the paper's estimated runs, exported on the server by
export_est_inputs.py into tools/data/raw_est_gpt/<uid>/ with index.json (block text + file per representation):
  Viewpoint Imagination  03_estimated_viewpoint_gpt61sol/gpt_runs/tasks.jsonl + images/ (HY-World 2.0 scene; the top-down is
                         the re-rendered larger-arrow map); the video is the request's mp4, from which GPT got 16 frames.
  Cross-view Integration 04_estimated_crossview_gpt61sol/gpt_runs/tasks.jsonl + images/ (SEVA view, MoGe-2 depth; only RGB and
                         depth are estimated in this setting).
Text is shown like the oracle text: the block without its title line. Run after build_examples.py --build.
"""
import hashlib, json, os, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'tools', 'data', 'raw_est_gpt')
OUT_IMG = os.path.join(ROOT, 'static', 'img', 'ex'); OUT_VID = os.path.join(ROOT, 'static', 'video', 'ex')
EX = os.path.join(ROOT, 'static', 'data', 'examples.json')


def web(uid, f, max_side=720):
    src = os.path.join(RAW, uid, f)
    stem = 'est_' + hashlib.md5(open(src, 'rb').read()).hexdigest()[:12]      # content-addressed: a changed input gets a new file
    if f.endswith('.mp4'):
        out = os.path.join(OUT_VID, stem + '.mp4')
        if not os.path.exists(out):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=w=min(640\\,iw):h=-2', '-c:v', 'libx264',
                            '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out], check=True)
        return f'static/video/ex/{stem}.mp4'
    out = os.path.join(OUT_IMG, stem + '.webp')
    if not os.path.exists(out):
        im = Image.open(src).convert('RGB')
        s = max_side / max(im.size)
        if s < 1:
            im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im.save(out, quality=82, method=6)
    return f'static/img/ex/{stem}.webp'


index = json.load(open(os.path.join(RAW, 'index.json'), encoding='utf-8'))
data = json.load(open(EX, encoding='utf-8'))
used = set()
for ex in data['examples']:
    est = {}
    for m, v in index[ex['uid']].items():
        if m == 'text':
            est[m] = dict(text=v['text'].split('\n', 1)[1].strip())
        else:
            est[m] = dict(src=[web(ex['uid'], v['file'], 1280 if m == 'panorama' else 720)])
            used.add(os.path.basename(est[m]['src'][0]))
    ex['est'] = est
    print(ex['uid'], sorted(est))
json.dump(data, open(EX, 'w', encoding='utf-8'), indent=1)
# drop estimated assets no example points to any more
for d in (OUT_IMG, OUT_VID):
    for f in os.listdir(d):
        if f.startswith('est_') and f not in used:
            os.remove(os.path.join(d, f)); print('removed stale', f)
