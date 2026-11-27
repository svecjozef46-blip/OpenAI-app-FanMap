#!/usr/bin/env python3
"""python3 compose-hero.py <dir from hero-shots.cjs> <output dir>

Side-by-side before/after images from hero-shots.cjs: the whole window
(scaled down) and the close-ups, magnified with whole pixels (no smoothing)
so the shape of each coastline pixel is visible.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
crops = json.load(open(os.path.join(src, "crops.json")))
try:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 22)
except OSError:
    font = ImageFont.load_default()


def labelled(img, text):
    canvas = Image.new("RGB", (img.width, img.height + 34), (24, 24, 27))
    canvas.paste(img, (0, 34))
    ImageDraw.Draw(canvas).text((8, 5), text, fill=(240, 240, 240), font=font)
    return canvas


def pair(a, b, gap=12):
    canvas = Image.new("RGB", (a.width + b.width + gap, max(a.height, b.height)), (24, 24, 27))
    canvas.paste(a, (0, 0))
    canvas.paste(b, (a.width + gap, 0))
    return canvas


for name in sorted(os.listdir(src)):
    if not name.endswith("-before.png"):
        continue
    stem = name[: -len("-before.png")]  # hero-<size>-<theme>
    size = stem.split("-")[1]
    dpr = float(size.split("@")[1])
    before = Image.open(os.path.join(src, name)).convert("RGB")
    after = Image.open(os.path.join(src, f"{stem}-after.png")).convert("RGB")

    # Whole window, at most 1600 px wide per side.
    scale = min(1.0, 1600 / before.width)
    small = lambda im: im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    pair(labelled(small(before), "Before (production)"), labelled(small(after), "After")).save(
        os.path.join(out, f"{stem}.jpg"), quality=88
    )

    # Close-ups at device pixels, magnified to ~700 px wide per side.
    for region, (x0, y0, x1, y1) in crops[size].items():
        box = [round(v * dpr) for v in (x0, y0, x1, y1)]
        box = [max(0, box[0]), max(0, box[1]), min(before.width, box[2]), min(before.height, box[3])]
        if box[2] - box[0] < 10 or box[3] - box[1] < 10:
            continue
        a, b = before.crop(box), after.crop(box)
        zoom = max(1, round(700 / a.width))
        big = lambda im: im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
        pair(labelled(big(a), f"Before · {region} · {zoom}×"), labelled(big(b), f"After · {region} · {zoom}×")).save(
            os.path.join(out, f"{stem}-{region}.png")
        )
    print(stem)
