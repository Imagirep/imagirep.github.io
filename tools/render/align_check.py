"""Residual yaw between the skybox photo view and the mesh render at the same pose (edge correlation).
Run from tools/render after render_route.py --still renders mesh_<name>.png for each pose."""
import math, os, sys, json
import numpy as np, cv2

src = open('make_clips.py', encoding='utf-8').read()
head = src[:src.index('def smooth')]
sys.argv = ['make_clips.py', '--out', 'unused']
g = {'__name__': 'align', '__file__': os.path.abspath('make_clips.py')}
exec(head.replace("S = json.load(open(os.path.join(a.frames, 'schedule.json')))",
                  "S = dict(width=640, height=480, fps=24, vfov=60.0)"), g)
POSES = {'S': ('687fece4613a4bc3b1504783bd73aff0', 81.4263, 0.0),
         'P1': ('12027c1e43dd4e808d58137ddb8e293b', 90.3246, 0.0),
         'P2': ('3731cd0ad6784067a5a3819f071d7878', 265.4071, -0.1162)}


def edges(img):
    e = cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (5, 5), 0), 40, 120).astype(np.float32)
    return cv2.GaussianBlur(e, (9, 9), 0)


for name, (vp, h, el) in POSES.items():
    ref = edges(cv2.imread(f'mesh_{name}.png'))
    best = max(((float((edges(g['photo'](vp, h + d, el)) * ref).sum()), d) for d in np.arange(-12, 12.1, 1.0)))
    fine = max(((float((edges(g['photo'](vp, h + d, el)) * ref).sum()), d) for d in np.arange(best[1] - 1, best[1] + 1.01, 0.25)))
    print(name, 'residual yaw (deg)', fine[1])
