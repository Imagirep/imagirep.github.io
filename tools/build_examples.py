"""Select benchmark examples for the website explorer and prepare web-sized assets.

Selection rule (stated on the page): for each of the 9 question types (7 distinct types across 2 settings), 1 question drawn uniformly at random with
seed 2026. No model outputs are shown on the website.
Step 1 (default): write tools/data/example_assets.txt (files to fetch from benchmark922/{images,videos}).
Step 2 (--build): convert fetched files from tools/data/raw/ and write static/data/examples.json.
"""
import json, os, random, re, subprocess, sys
from collections import defaultdict
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'tools', 'data')
OUT_IMG = os.path.join(ROOT, 'static', 'img', 'ex'); OUT_VID = os.path.join(ROOT, 'static', 'video', 'ex')
SEED, DRAW, PER_TYPE = 2026, 2, 1   # draw 2 per type (keeps the seeded sequence), show the first
TYPE_LABEL = {
    'open_space_direction': 'Open-space Direction', 'nearest_obstacle_direction': 'Nearest-obstacle Direction',
    'visibility': 'Visibility', 'nearest_object': 'Nearest Object', 'farthest_object': 'Farthest Object',
    'object_relative_direction': 'Object-relative Direction', 'cross_view_closest': 'Nearest Object',
    'cross_view_farthest': 'Farthest Object', 'ordering': 'Spatial Ordering'}
ORDER = list(TYPE_LABEL)
REPS = ['topdown', 'text', 'video', 'depth', 'surface_normals', 'panorama']
# wording shown on the website only; the benchmark files keep the original options
DISPLAY_FIX = {'last50__MVC-159-Q3': [('painting', 'large painting')]}

Q = [json.loads(l) for l in open(os.path.join(D, 'questions.jsonl'), encoding='utf-8')]
by = defaultdict(list)
for q in Q:
    by[q['category']].append(q)
rng = random.Random(SEED)
picked = []
for t in ORDER:
    pool = sorted(by[t], key=lambda q: q['uid'])
    picked += rng.sample(pool, DRAW)[:PER_TYPE]


def split_parts(parts):
    """-> list of (header_text, [files]) blocks in order."""
    blocks, cur = [], None
    for p in parts:
        if isinstance(p, dict):
            cur = [p['text'], []]; blocks.append(cur)
        else:
            if cur is None:
                cur = ['', []]; blocks.append(cur)
            cur[1].append(p)
    return blocks


def parse(q):
    obs = [(h.strip().rstrip(':'), f) for h, fs in split_parts(q['conditions']['observed']) for f in fs]
    ora = split_parts(q['conditions']['oracle'])
    end = [(h.split('\n')[0].strip().rstrip(':'), f) for h, fs in ora[len(split_parts(q['conditions']['observed'])):] for f in fs]
    reps = {}
    for m in REPS:
        bl = split_parts(q['conditions']['oracle_' + m])[len(ora):]
        head = bl[0][0] if bl else ''
        files = [f for _, fs in bl for f in fs]
        title, _, body = head.partition('\n')
        reps[m] = dict(title=title.strip().rstrip(':'), caption=body.strip(), files=files)
    m = re.search(r'Question:\s*(.*?)\n(A\..*)\nAnswer:', q['question_prompt'], re.S)
    question = m.group(1).strip()
    opts = dict(re.findall(r'^([ABCD])\.\s*(.*)$', m.group(2), re.M))
    return obs, end, reps, question, opts


if '--build' not in sys.argv:
    need = set()
    for q in picked:
        obs, end, reps, _, _ = parse(q)
        need |= {f for _, f in obs} | {f for _, f in end} | {f for r in reps.values() for f in r['files']}
    open(os.path.join(D, 'example_assets.txt'), 'w').write('\n'.join(sorted(need)) + '\n')
    print(len(picked), 'questions;', len(need), 'files ->', 'tools/data/example_assets.txt')
    for q in picked:
        print(' ', q['uid'], q['category'])
    sys.exit()

os.makedirs(OUT_IMG, exist_ok=True); os.makedirs(OUT_VID, exist_ok=True)
RAW = os.path.join(D, 'raw')


def web(f, max_side=720):
    stem, ext = os.path.splitext(f)
    if ext == '.mp4':
        out = os.path.join(OUT_VID, stem + '.mp4')
        if not os.path.exists(out):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(RAW, f), '-vf',
                            'scale=w=min(640\\,iw):h=-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
                            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out], check=True)
        return f'static/video/ex/{stem}.mp4'
    out = os.path.join(OUT_IMG, stem + '.webp')
    if not os.path.exists(out):
        im = Image.open(os.path.join(RAW, f)).convert('RGB')
        s = max_side / max(im.size)
        if s < 1:
            im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im.save(out, quality=82, method=6)
    return f'static/img/ex/{stem}.webp'


examples = []
for q in picked:
    obs, end, reps, question, opts = parse(q)
    setting = 'Viewpoint Imagination' if q['benchmark'] == 'FO622' else 'Cross-view Integration'
    rep_out = {}
    for m, r in reps.items():
        if m == 'text':
            rep_out[m] = dict(title=r['title'], text=r['caption'])
        else:
            big = 1280 if m == 'panorama' else 720
            files, caption = r['files'], r['caption']
            if m == 'topdown' and setting == 'Cross-view Integration':
                # website shows the View-arrow-only map (no Oracle arrow), re-rendered by
                # tools/render_mvc_topdown_two_arrows.py into raw/td2_<uid>.png
                files = [f'td2_{q["uid"]}.png']
                caption = caption.replace('; the arrow labeled Oracle shows the facing direction of Oracle RGB from its camera position.', '.')
            rep_out[m] = dict(title=r['title'], caption=caption, src=[web(f, big) for f in files])
    for old, new in DISPLAY_FIX.get(q['uid'], []):
        opts = {k: re.sub(rf'(?<!large ){old}', new, v) for k, v in opts.items()}
    examples.append(dict(uid=q['uid'], setting=setting, type=TYPE_LABEL[q['category']], category=q['category'],
                         question=question, options=opts, gold=q['gold'],
                         observed=[dict(label=l or 'Start', src=web(f)) for l, f in obs],
                         endpoint=[dict(label=l, src=web(f)) for l, f in end], reps=rep_out))
json.dump(dict(rule=f'{PER_TYPE} question per question type in each setting, drawn uniformly at random (seed {SEED})',
               examples=examples), open(os.path.join(ROOT, 'static', 'data', 'examples.json'), 'w'), indent=1)
print('examples.json:', len(examples))
