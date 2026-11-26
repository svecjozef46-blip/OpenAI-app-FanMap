import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
except: font = ImageFont.load_default()
for f in sorted(os.listdir(src)):
    if not f.startswith("mapbox-") or not f.endswith(".png"): continue
    other = os.path.join(src, "maplibre-" + f[len("mapbox-"):])
    if not os.path.exists(other): continue
    a, b = Image.open(os.path.join(src, f)), Image.open(other)
    if a.width > 1000:  # desktop: map area only
        box = (320, 49, a.width, a.height); a, b = a.crop(box), b.crop(box)
    gap = 12; bar = 36
    o = Image.new("RGB", (a.width * 2 + gap, a.height + bar), (128, 128, 128))
    o.paste(a, (0, bar)); o.paste(b, (a.width + gap, bar))
    d = ImageDraw.Draw(o)
    d.text((10, 6), "Mapbox (production)", fill="white", font=font)
    d.text((a.width + gap + 10, 6), "MapLibre (this PR)", fill="white", font=font)
    o.save(os.path.join(out, f[len("mapbox-"):]))
print("ok")
