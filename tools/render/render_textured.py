"""Textured 'dollhouse' render of the Matterport3D scene used in the ImagiRep teaser (scan 5q7pvUzZiYa, FO-0003).

Renders the official textured mesh, keeps only the given regions, removes each region's ceiling, and orbits an
oblique camera around the scene. Output: one PNG (--frame) or a numbered PNG sequence for an orbit video.
The mesh is used locally only and is never published (Matterport3D Terms of Use).

  python render_textured.py --azim 150 --elev 58 --out test.png
  python render_textured.py --orbit 180 --amp 14 --out frames/      # 180 frames, azimuth = azim + amp*sin(...)
"""
import argparse, glob, math, os
from pathlib import Path
import numpy as np, moderngl, trimesh
from PIL import Image

HERE = Path(__file__).resolve().parent
SCAN = '5q7pvUzZiYa'
HOUSE = Path(os.environ['MP3D_SCANS']) / SCAN   # MP3D v1/scans / 'house_segmentations' / f'{SCAN}.house'
ap = argparse.ArgumentParser()
ap.add_argument('--regions', default='0,1,2')
ap.add_argument('--azim', type=float, default=150); ap.add_argument('--elev', type=float, default=58)
ap.add_argument('--fov', type=float, default=28); ap.add_argument('--cut_gap', type=float, default=0.35)
ap.add_argument('--size', default='1100x1020'); ap.add_argument('--ss', type=int, default=2)
ap.add_argument('--margin', type=float, default=1.06, help='framing margin (>1 = more space around the scene)')
ap.add_argument('--orbit', type=int, default=0, help='number of frames for a looping orbit (0 = single frame)')
ap.add_argument('--amp', type=float, default=14.0, help='orbit half-amplitude in degrees of azimuth')
ap.add_argument('--elev_amp', type=float, default=3.0, help='orbit elevation swing in degrees')
ap.add_argument('--sweep', default='', help='"AZ0,EL0,N": N frames easing from (AZ0,EL0) to (--azim,--elev)')
ap.add_argument('--cam_json', default='', help='write the final camera (mvp, size) here')
ap.add_argument('--bg', default='ffffff')
ap.add_argument('--out', required=True)
a = ap.parse_args()
W, H = map(int, a.size.split('x')); SW, SH = W * a.ss, H * a.ss
bg = tuple(int(a.bg[i:i + 2], 16) / 255 for i in (0, 2, 4))

# ---- regions: bounding boxes and ceilings from the .house file
regions = [int(r) for r in a.regions.split(',')]
boxes = {}
for line in open(HOUSE):
    t = line.split()
    if t and t[0] == 'R' and int(t[1]) in regions:
        lo = np.array(list(map(float, t[9:12]))); hi = np.array(list(map(float, t[12:15])))
        boxes[int(t[1])] = (lo, hi)

# ---- mesh: one geometry per material
obj = glob.glob(str(HERE / 'mesh' / SCAN / 'matterport_mesh' / '*' / '*.obj'))[0]
scene = trimesh.load(obj, process=False)
parts = []
for g in scene.geometry.values():
    v = np.asarray(g.vertices, np.float32); f = np.asarray(g.faces)
    c = v[f].mean(1); top = v[f][:, :, 2].max(1)
    keep = np.zeros(len(f), bool)
    for lo, hi in boxes.values():
        inside = np.all((c[:, :2] >= lo[:2] - 0.15) & (c[:, :2] <= hi[:2] + 0.15), 1)
        keep |= inside & (top < hi[2] - a.cut_gap) & (c[:, 2] > lo[2] - 0.3)
    if not keep.any() or g.visual.uv is None:
        continue
    f = f[keep]
    uv = np.asarray(g.visual.uv, np.float32)
    img = g.visual.material.image
    if img is None:
        continue
    parts.append((v, uv, f, img.convert('RGB')))
allv = np.concatenate([p[0][p[2].ravel()] for p in parts])
center = (allv.min(0) + allv.max(0)) / 2
radius = np.linalg.norm(allv - center, axis=1).max()
print('parts', len(parts), 'faces', sum(len(p[2]) for p in parts), 'center', center.round(2), 'radius', round(float(radius), 2))

ctx = moderngl.create_standalone_context()
prog = ctx.program(
    vertex_shader='''#version 330
uniform mat4 mvp; in vec3 in_pos; in vec2 in_uv; out vec2 uv;
void main(){ uv = in_uv; gl_Position = mvp * vec4(in_pos, 1.0); }''',
    fragment_shader='''#version 330
uniform sampler2D tex; in vec2 uv; out vec4 color;
void main(){ color = vec4(texture(tex, vec2(uv.x, uv.y)).rgb, 1.0); }''')
draws = []
for v, uv, f, img in parts:
    data = np.hstack([v[f.ravel()], uv[f.ravel()]]).astype('f4')
    tex = ctx.texture(img.size, 3, img.transpose(Image.FLIP_TOP_BOTTOM).tobytes())
    tex.build_mipmaps(); tex.filter = (moderngl.LINEAR_MIPMAP_LINEAR, moderngl.LINEAR); tex.anisotropy = 16.0
    vbo = ctx.buffer(data.tobytes())
    draws.append((ctx.vertex_array(prog, [(vbo, '3f 2f', 'in_pos', 'in_uv')]), tex))
fbo = ctx.framebuffer(ctx.renderbuffer((SW, SH), samples=0), ctx.depth_renderbuffer((SW, SH)))


def look_at(eye, tgt, up=(0, 0, 1)):
    f = tgt - eye; f /= np.linalg.norm(f); s = np.cross(f, up); s /= np.linalg.norm(s); u = np.cross(s, f)
    m = np.eye(4, dtype='f4'); m[0, :3], m[1, :3], m[2, :3] = s, u, -f; m[:3, 3] = -m[:3, :3] @ eye
    return m


def persp(fov, aspect, n, fa):
    t = 1 / math.tan(math.radians(fov) / 2)
    return np.array([[t / aspect, 0, 0, 0], [0, t, 0, 0], [0, 0, (fa + n) / (n - fa), 2 * fa * n / (n - fa)], [0, 0, -1, 0]], 'f4')


def render(azim, elev, path):
    az, el = math.radians(azim), math.radians(elev)
    d = radius * a.margin / math.sin(math.radians(a.fov) / 2)
    eye = center + d * np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
    mvp = persp(a.fov, SW / SH, 0.1, d * 3) @ look_at(eye.astype('f4'), center.astype('f4'))
    fbo.use(); ctx.enable(moderngl.DEPTH_TEST); ctx.clear(*bg, 1.0)
    prog['mvp'].write(mvp.T.astype('f4').tobytes())
    for vao, tex in draws:
        tex.use(0); vao.render()
    im = Image.frombytes('RGB', (SW, SH), fbo.read(components=3)).transpose(Image.FLIP_TOP_BOTTOM)
    im.resize((W, H), Image.LANCZOS).save(path)
    return mvp


if a.sweep:
    az0, el0, n = a.sweep.split(','); az0, el0, n = float(az0), float(el0), int(n)
    os.makedirs(a.out, exist_ok=True)
    for i in range(n):
        t = i / (n - 1); e = 1 - (1 - t) ** 3            # ease-out cubic: lands softly on the final view
        mvp = render(az0 + (a.azim - az0) * e, el0 + (a.elev - el0) * e, os.path.join(a.out, f'f{i:04d}.png'))
    print('frames', n, '->', a.out)
    if a.cam_json:
        import json
        json.dump(dict(mvp=mvp.tolist(), width=W, height=H, azim=a.azim, elev=a.elev), open(a.cam_json, 'w'))
elif a.orbit:
    os.makedirs(a.out, exist_ok=True)
    for i in range(a.orbit):
        ph = 2 * math.pi * i / a.orbit          # seamless loop
        render(a.azim + a.amp * math.sin(ph), a.elev + a.elev_amp * math.sin(2 * ph + math.pi / 2) * 0.5,
               os.path.join(a.out, f'f{i:04d}.png'))
    print('frames', a.orbit, '->', a.out)
else:
    render(a.azim, a.elev, a.out); print('saved', a.out)
