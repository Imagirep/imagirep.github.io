"""First-person RGB + depth along the FO-0003 route (teaser clips), from the official textured MP3D mesh.

Camera convention follows MatterSim: heading clockwise from +y, elevation positive up, vfov 60 deg, 4:3.
Poses come from the released camera_poses/viewpoint_imagination_poses.jsonl (FO-0003).

  python render_route.py --still 7.55961,3.85059,4.79337,265.4,-0.1 --out test.png
  python render_route.py --route --out frames_route/        # depth_XXXX.npy + schedule.json (per-frame poses)
The mesh is used locally only and is never published (Matterport3D Terms of Use).
"""
import argparse, glob, json, math, os
from pathlib import Path
import numpy as np, moderngl, trimesh
from PIL import Image

HERE = Path(__file__).resolve().parent
SCAN = '5q7pvUzZiYa'
ap = argparse.ArgumentParser()
ap.add_argument('--size', default='640x480'); ap.add_argument('--ss', type=int, default=2)
ap.add_argument('--vfov', type=float, default=60.0)
ap.add_argument('--still', default='', help='x,y,z,heading,elev')
ap.add_argument('--route', action='store_true')
ap.add_argument('--fps', type=int, default=24)
ap.add_argument('--out', required=True)
a = ap.parse_args()
W, H = map(int, a.size.split('x')); SW, SH = W * a.ss, H * a.ss

obj = glob.glob(str(HERE / 'mesh' / SCAN / 'matterport_mesh' / '*' / '*.obj'))[0]
scene = trimesh.load(obj, process=False)
ctx = moderngl.create_standalone_context()
prog = ctx.program(
    vertex_shader='''#version 330
uniform mat4 mvp; in vec3 in_pos; in vec2 in_uv; out vec2 uv;
void main(){ uv = in_uv; gl_Position = mvp * vec4(in_pos, 1.0); }''',
    fragment_shader='''#version 330
uniform sampler2D tex; in vec2 uv; out vec4 color;
void main(){ color = vec4(texture(tex, uv).rgb, 1.0); }''')
draws = []
for g in scene.geometry.values():
    if g.visual.uv is None or g.visual.material.image is None:
        continue
    v = np.asarray(g.vertices, np.float32); f = np.asarray(g.faces); uv = np.asarray(g.visual.uv, np.float32)
    data = np.hstack([v[f.ravel()], uv[f.ravel()]]).astype('f4')
    img = g.visual.material.image.convert('RGB')
    tex = ctx.texture(img.size, 3, img.transpose(Image.FLIP_TOP_BOTTOM).tobytes())
    tex.build_mipmaps(); tex.filter = (moderngl.LINEAR_MIPMAP_LINEAR, moderngl.LINEAR); tex.anisotropy = 16.0
    draws.append((ctx.vertex_array(prog, [(ctx.buffer(data.tobytes()), '3f 2f', 'in_pos', 'in_uv')]), tex))
fbo = ctx.framebuffer(ctx.renderbuffer((SW, SH)), ctx.depth_renderbuffer((SW, SH)))
NEAR, FAR = 0.05, 60.0


def camera(pos, heading, elev):
    h, e = math.radians(heading), math.radians(elev)
    fwd = np.array([math.sin(h) * math.cos(e), math.cos(h) * math.cos(e), math.sin(e)])
    s = np.cross(fwd, [0, 0, 1]); s /= np.linalg.norm(s); u = np.cross(s, fwd)
    view = np.eye(4); view[0, :3], view[1, :3], view[2, :3] = s, u, -fwd; view[:3, 3] = -view[:3, :3] @ np.asarray(pos)
    t = 1 / math.tan(math.radians(a.vfov) / 2)
    proj = np.array([[t * H / W, 0, 0, 0], [0, t, 0, 0], [0, 0, (FAR + NEAR) / (NEAR - FAR), 2 * FAR * NEAR / (NEAR - FAR)], [0, 0, -1, 0]])
    return proj @ view


def render(pos, heading, elev):
    mvp = camera(pos, heading, elev)
    fbo.use(); ctx.enable(moderngl.DEPTH_TEST); ctx.clear(1, 1, 1, 1.0)
    prog['mvp'].write(mvp.T.astype('f4').tobytes())
    for vao, tex in draws:
        tex.use(0); vao.render()
    rgb = Image.frombytes('RGB', (SW, SH), fbo.read(components=3)).transpose(Image.FLIP_TOP_BOTTOM).resize((W, H), Image.LANCZOS)
    zb = np.frombuffer(fbo.read(components=1, attachment=-1, dtype='f4'), 'f4').reshape(SH, SW)[::-1]
    z = 2 * NEAR * FAR / (FAR + NEAR - (2 * zb - 1) * (FAR - NEAR))            # metres along the view axis
    z[zb >= 1.0] = 0
    z = z.reshape(H, a.ss, W, a.ss).max(axis=(1, 3))    # nearest-neighbour style downsample keeps edges crisp
    return rgb, z, mvp


def ease(t):
    return t * t * (3 - 2 * t)


VP = {'S': '687fece4613a4bc3b1504783bd73aff0', 'P1': '12027c1e43dd4e808d58137ddb8e293b', 'P2': '3731cd0ad6784067a5a3819f071d7878'}
POS = {'S': (-0.06603, 3.238, 4.77785), 'P1': (4.12615, 3.87004, 4.79477), 'P2': (7.55961, 3.85059, 4.79337)}


def route_keys():
    """(viewpoint, heading, elev, seconds-to-reach) keyframes for FO-0003, ending on the look-back view."""
    return [('S', 81.43, 0.0, 0.0),
            ('S', 81.43, 0.0, 0.5),           # hold on the start view
            ('P1', 81.43, 0.0, 2.0),          # walk 4.24 m
            ('P1', 90.32, 0.0, 0.35),         # small right turn
            ('P2', 90.32, 0.0, 1.8),          # walk 3.43 m
            ('P2', 265.41, -0.1, 1.9),        # turn right ~175 deg to face the start
            ('P2', 265.41, -0.1, 1.6)]        # hold on the final view


def schedule(fps):
    """Per-frame poses; walking segments also carry the from/to viewpoints for the photo (skybox) clip."""
    keys = route_keys(); out = []
    for si, (k0, k1) in enumerate(zip(keys, keys[1:])):
        n = max(1, round(k1[3] * fps))
        dh = (k1[1] - k0[1] + 180) % 360 - 180
        if k1[1] - k0[1] > 170:                  # the final turn goes right (clockwise) as in the instruction
            dh = k1[1] - k0[1]
        for j in (range(1, n + 1) if out else range(0, n + 1)):
            t = ease(j / n)
            p = [POS[k0[0]][c] + (POS[k1[0]][c] - POS[k0[0]][c]) * t for c in range(3)]
            out.append(dict(seg=si, t=t, pos=p, heading=k0[1] + dh * t, elev=k0[2] + (k1[2] - k0[2]) * t,
                            vp0=VP[k0[0]], vp1=VP[k1[0]], walk=k0[0] != k1[0]))
    return out


if a.still:
    x, y, z, hd, el = map(float, a.still.split(','))
    rgb, d, mvp = render((x, y, z), hd, el); rgb.save(a.out)
    np.save(a.out.replace('.png', '_depth.npy'), d); print('saved', a.out, 'depth range', d[d > 0].min(), d.max())
elif a.route:
    os.makedirs(a.out, exist_ok=True)
    frames = schedule(a.fps)
    for i, f in enumerate(frames):
        rgb, d, mvp = render(f['pos'], f['heading'], f['elev'])
        np.save(os.path.join(a.out, f'depth_{i:04d}.npy'), d.astype('f2'))
        if i == len(frames) - 1:
            rgb.save(os.path.join(a.out, 'mesh_last.png'))
    json.dump(dict(frames=frames, mvp_last=mvp.tolist(), width=W, height=H, fps=a.fps, vfov=a.vfov),
              open(os.path.join(a.out, 'schedule.json'), 'w'))
    print('frames', len(frames), '->', a.out)
