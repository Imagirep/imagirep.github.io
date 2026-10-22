"""Project Matterport3D object boxes into the canonical teaser frame -> rotated rectangles (fractions of the image)."""
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw

HOUSE = os.path.join(os.environ['MP3D_SCANS'], '5q7pvUzZiYa', 'house_segmentations', '5q7pvUzZiYa.house')   # MP3D v1/scans
cam = json.load(open('cam_canonical.json')); M = np.array(cam['mvp']); W, H = cam['width'], cam['height']
objs = {}
for line in open(HOUSE):
    t = line.split()
    if t and t[0] == 'O':
        objs[int(t[1])] = np.array(list(map(float, t[4:16])))


def corners(o):
    c, a0, a1, r = o[0:3], o[3:6], o[6:9], o[9:12]
    a2 = np.cross(a0, a1)
    return np.array([c + sx * r[0] * a0 + sy * r[1] * a1 + sz * r[2] * a2 for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)])


def project(pts):
    p = np.c_[pts, np.ones(len(pts))] @ M.T
    ndc = p[:, :3] / p[:, 3:4]
    return np.c_[(ndc[:, 0] + 1) / 2 * W, (1 - ndc[:, 1]) / 2 * H]


GROUPS = {'table': [44], 'sofa': [75], 'pillows': [67, 74, 78, 80, 82, 83, 86]}
out = {}
for name, ids in GROUPS.items():
    pts = project(np.concatenate([corners(objs[i]) for i in ids]))
    (cx, cy), (w, h), ang = cv2.minAreaRect(pts.astype(np.float32))
    out[name] = dict(cx=cx / W, cy=cy / H, w=w / W, h=h / H, angle=ang, poly=(cv2.boxPoints(((cx, cy), (w, h), ang)) / [W, H]).tolist())
json.dump(out, open('boxes_canonical.json', 'w'), indent=1)
im = Image.open(sys.argv[1]).convert('RGB'); d = ImageDraw.Draw(im)
col = {'table': (60, 120, 230), 'sofa': (60, 170, 80), 'pillows': (255, 0, 255)}
for k, v in out.items():
    d.polygon([(x * W, y * H) for x, y in v['poly']], outline=col[k], width=4)
im.save('boxes_check.png'); print({k: (round(v['cx'], 3), round(v['cy'], 3)) for k, v in out.items()})
