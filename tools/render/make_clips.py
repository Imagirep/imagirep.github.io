"""Teaser clips for FO-0003: photo RGB (MP3D skyboxes) and depth (textured mesh) along the same route,
ending on the look-back view with a yellow box on the target object.

Needs: frames_route/ from `render_route.py --route`, skybox faces in sky/ (<viewpoint>_skybox{0..5}_sami.jpg).
RGB: in-place turns are exact perspective views of the skybox; a walk between two viewpoints is a
street-view transition (zoom into the first panorama, cross-fade into the second while it settles).
Depth: camera-axis metres from the mesh, reversed TURBO (red near, blue far), fixed range for the whole clip.

  python make_clips.py --out ../../static/video
"""
import argparse, json, math, os, subprocess
from pathlib import Path
import numpy as np, cv2

HERE = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('--frames', default=str(HERE / 'frames_route'))
ap.add_argument('--sky', default=str(HERE / 'sky'))
ap.add_argument('--zoom', type=float, default=1.9, help='street-view zoom over one walk segment')
ap.add_argument('--near', type=float, default=1.0); ap.add_argument('--far', type=float, default=9.0)
ap.add_argument('--out', required=True)
a = ap.parse_args()
S = json.load(open(os.path.join(a.frames, 'schedule.json')))
W, H, FPS, VFOV = S['width'], S['height'], S['fps'], S['vfov']
SS = 2
FACE = {270: 1, 0: 2, 90: 3, 180: 4}          # skybox side face -> heading at the start viewpoint (checked visually)
CONN = os.environ.get('MP3D_CONNECTIVITY', '')  # <scan>_connectivity.json: per-viewpoint pose; the skybox turns with its yaw
_yaw = {}
if CONN:
    for nd in json.load(open(CONN)):
        P = np.array(nd['pose']).reshape(4, 4); z = P[:3, 2]
        _yaw[nd['image_id']] = math.degrees(math.atan2(z[0], z[1]))
YAW_REF = _yaw.get('687fece4613a4bc3b1504783bd73aff0', 0.0)
YAW_FIX = float(os.environ.get('YAW_FIX', '12.3'))   # constant offset, fitted against mesh renders (align_check.py)
_faces = {}


def faces(vp):
    if vp not in _faces:
        _faces[vp] = {k: cv2.imread(os.path.join(a.sky, f'{vp}_skybox{k}_sami.jpg')) for k in range(6)}
    return _faces[vp]


def photo(vp, heading, elev, zoom=1.0):
    """Perspective view (W x H, vfov VFOV / zoom) from the skybox of viewpoint vp."""
    w, h = W * SS, H * SS
    ty = math.tan(math.radians(VFOV) / 2) / zoom; tx = ty * w / h
    u, v = np.meshgrid((np.arange(w) + .5) / w * 2 - 1, 1 - (np.arange(h) + .5) / h * 2)
    hh, ee = math.radians(heading), math.radians(elev)
    fwd = np.array([math.sin(hh) * math.cos(ee), math.cos(hh) * math.cos(ee), math.sin(ee)])
    right = np.array([math.cos(hh), -math.sin(hh), 0.0])
    up = np.cross(right, fwd)
    d = fwd[None, None] + (u * tx)[..., None] * right + (v * ty)[..., None] * up
    out = np.zeros((h, w, 3), np.float32); best = np.full((h, w), -1e9)
    F = faces(vp)
    off = _yaw.get(vp, YAW_REF) - YAW_REF + YAW_FIX
    for hf, k in FACE.items():
        r = math.radians(hf + off)
        f = np.array([math.sin(r), math.cos(r), 0.0]); rt = np.array([math.cos(r), -math.sin(r), 0.0])
        df = d @ f
        m = (df > 0) & (df > best) & (np.abs(d[..., 2]) <= df * 1.0001)
        if not m.any():
            continue
        N = F[k].shape[0]
        mx = ((d @ rt) / np.maximum(df, 1e-6) + 1) / 2 * N - .5
        my = (1 - d[..., 2] / np.maximum(df, 1e-6)) / 2 * N - .5
        s = cv2.remap(F[k], mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        out[m] = s[m]; best = np.where(m, df, best)
    return cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA).astype(np.uint8)


def smooth(x, a0, a1):
    t = min(1, max(0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t)


def rgb_frame(f):
    if not f['walk']:
        return photo(f['vp1'] if f['t'] >= 1 else f['vp0'], f['heading'], f['elev'])
    t = f['t']
    A = photo(f['vp0'], f['heading'], f['elev'], 1 + (a.zoom - 1) * t)
    B = photo(f['vp1'], f['heading'], f['elev'], 1 / a.zoom + (1 - 1 / a.zoom) * t)
    al = smooth(t, .3, .7)
    return cv2.addWeighted(A, 1 - al, B, al, 0)


def depth_frame(z):
    z = z.astype(np.float32)
    n = np.clip((z - a.near) / (a.far - a.near), 0, 1)
    c = cv2.applyColorMap(((1 - n) * 255).astype(np.uint8), cv2.COLORMAP_TURBO)    # red near, blue far
    c[z <= 0] = 0
    return c


# ---- yellow boxes on the last frame (MP3D object boxes projected with the final camera)
HOUSE = os.path.join(os.environ['MP3D_SCANS'], '5q7pvUzZiYa', 'house_segmentations', '5q7pvUzZiYa.house')
objs = {int(t[1]): np.array(list(map(float, t[4:16]))) for t in (l.split() for l in open(HOUSE)) if t and t[0] == 'O'}
M = np.array(S['mvp_last'])


def box(ids, depth, pad=6):
    pts = []
    for i in ids:
        o = objs[i]; c, a0, a1, r = o[0:3], o[3:6], o[6:9], o[9:12]; a2 = np.cross(a0, a1)
        cs = np.array([c + sx * r[0] * a0 + sy * r[1] * a1 + sz * r[2] * a2 for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)])
        p = np.c_[cs, np.ones(8)] @ M.T
        ndc = p[:, :3] / p[:, 3:4]; xy = np.c_[(ndc[:, 0] + 1) / 2 * W, (1 - ndc[:, 1]) / 2 * H]
        # keep objects whose centre is in view and not hidden behind nearer geometry
        pc = np.r_[c, 1] @ M.T; nc = pc[:3] / pc[3]; cx, cy = (nc[0] + 1) / 2 * W, (1 - nc[1]) / 2 * H
        dist = (pc[3])
        if 0 <= cx < W and 0 <= cy < H and pc[3] > 0:
            zc = float(depth[int(cy), int(cx)])
            if zc <= 0 or zc > dist - (float(r.max()) + 0.4):   # front surface may sit up to the box radius nearer
                pts.append(xy)
    if not pts:
        return None
    pts = np.concatenate(pts)
    x0, y0 = np.clip(pts.min(0) - pad, 0, [W - 1, H - 1]); x1, y1 = np.clip(pts.max(0) + pad, 0, [W - 1, H - 1])
    return int(x0), int(y0), int(x1), int(y1)


def draw(img, b, k):
    if b and k > 0:
        x0, y0, x1, y1 = b
        ov = img.copy(); cv2.rectangle(ov, (x0, y0), (x1, y1), (0, 255, 255), 3, cv2.LINE_AA)
        img[:] = cv2.addWeighted(ov, k, img, 1 - k, 0)
    return img


def encode(frames_dir, name):
    """H.264 MP4 only (plays everywhere), 480 px wide: the clips are shown small inside the teaser."""
    os.makedirs(a.out, exist_ok=True)
    src = os.path.join(frames_dir, '%04d.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', src, '-vf', 'scale=480:-2:flags=lanczos',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                    os.path.join(a.out, name + '.mp4')], check=True)
    last = cv2.resize(cv2.imread(os.path.join(frames_dir, f'{len(fr) - 1:04d}.png')), (480, 360), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(a.out, name + '_poster.jpg'), last, [cv2.IMWRITE_JPEG_QUALITY, 85])


fr = S['frames']; n = len(fr)
last_depth = np.load(os.path.join(a.frames, f'depth_{n - 1:04d}.npy')).astype(np.float32)
B_RGB = box([67, 74, 78, 80, 82, 83, 86], last_depth)     # black-and-white pillows (Q4 visibility)
B_DEP = box([75], last_depth)                              # grey sofa (Q2 farthest object, as in the teaser)
if B_DEP:                                                  # the left half of the sofa box is hidden behind the fireplace
    B_DEP = ((B_DEP[0] + B_DEP[2]) // 2,) + B_DEP[1:]
print('boxes rgb', B_RGB, 'depth', B_DEP)
hold0 = n - round(1.6 * FPS)                               # the final hold starts here; the box fades in
for name, make, bx in (('clip_rgb', lambda i: rgb_frame(fr[i]), B_RGB),
                       ('clip_depth', lambda i: depth_frame(np.load(os.path.join(a.frames, f'depth_{i:04d}.npy'))), B_DEP)):
    d = os.path.join(a.frames, name); os.makedirs(d, exist_ok=True)
    for i in range(n):
        img = make(i)
        draw(img, bx, smooth(i, hold0, hold0 + 6))
        cv2.imwrite(os.path.join(d, f'{i:04d}.png'), img)
    encode(d, name); print(name, n, 'frames')
