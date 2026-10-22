"""Low-frame-rate looping animated WebP (GIF-like) teaser clips from the frames written by make_clips.py.
Animated images play without JavaScript and regardless of the reduced-motion setting, unlike <video>.

  python make_slides.py --out ../../static/teaser
"""
import argparse, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--frames', default=os.path.join(HERE, 'frames_route'))
ap.add_argument('--out', required=True)
a = ap.parse_args()
# key frames of the FO-0003 route (24 fps schedule): start, walk 1, arrival 1, walk 2, arrival 2, the turn, final view + box
PICKS = [0, 28, 60, 82, 112, 124, 132, 140, 148, 195]
MS = [900, 650, 650, 650, 650, 500, 500, 500, 500, 2200]
for name in ('clip_rgb', 'clip_depth'):
    ims = [Image.open(os.path.join(a.frames, name, f'{i:04d}.png')).convert('RGB').resize((480, 360), Image.LANCZOS) for i in PICKS]
    out = os.path.join(a.out, name + '.webp')
    ims[0].save(out, save_all=True, append_images=ims[1:], duration=MS, loop=0, quality=82, method=6)
    print(out, os.path.getsize(out) // 1024, 'KB,', len(ims), 'frames,', sum(MS) / 1000, 's loop')
