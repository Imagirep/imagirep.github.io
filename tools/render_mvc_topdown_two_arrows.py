"""Re-render MVC top-down maps with only the View k arrows (no Oracle arrow) for website examples.
Uses the same renderer and arrow convention as build_eval_assets.per_order; also renders the original
three-arrow version to verify the reproduction matches the benchmark image pixel-for-pixel."""
import os, sys, math, json, shutil
from pathlib import Path
import numpy as np, cv2

REPO = Path(os.environ['RESEARCH_REPO'])   # checkout of the experiment repository
sys.path.insert(0, str(REPO / 'docs/experiments/mvc_oracle_modalities_325_20261006'))
import build_eval_assets as E  # noqa: E402

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
want = sys.argv[2:]                       # uids like ready100__MVC-091-Q1
res = E.B.resources()
rows = {}
for r in E.rows():
    pref = 'ready100' if 'ready100' in r['cohort'] else 'last50'
    rows[f"{pref}__{r['question_id']}"] = r
for uid in want:
    r = rows[uid]; rid = r['resource_id']; order = E.display_order(r)
    s = E.B.spec(rid, res[rid])
    head = {n: h for n, h, _, _ in s['views']}
    disp = [(i + 1, head[src]) for i, src in enumerate(order)]
    cam = s['pose'][:3, 3]
    for tag, with_oracle in (('three', True), ('two', False)):
        arrows = {f'View {k}': (cam, math.radians(h)) for k, h in disp}
        if with_oracle:
            arrows['Oracle'] = (s['opose'][:3, 3], math.radians(s['oh']))
        tmp = OUT / f'_td_{uid}_{tag}'; tmp.mkdir(exist_ok=True)
        E.make_dense_topdown(s['scan'], cam, arrows, tmp).replace(OUT / f'{uid}_{tag}.png'); shutil.rmtree(tmp, ignore_errors=True)
    ref = cv2.imread(str(E.OUT / rid / f"order_{''.join(map(str, order))}" / 'topdown.png'))
    mine = cv2.imread(str(OUT / f'{uid}_three.png'))
    print(uid, rid, order, 'three-arrow vs benchmark MAE', float(np.abs(ref.astype(float) - mine.astype(float)).mean()) if ref is not None and ref.shape == mine.shape else 'shape/missing')
