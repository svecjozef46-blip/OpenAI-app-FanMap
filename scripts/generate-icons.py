"""Generates the app icons (favicon, Apple touch icon, PWA icons).

Run from the project root:  python scripts/generate-icons.py

Plain Python, no extra packages: the icon is simple enough (a green globe on
a near-black tile) to draw pixel by pixel. Change the colors or proportions
below and run again to restyle every icon at once. The same shapes are in
src/app/icon.svg (the sharp favicon modern browsers use) — keep them in sync.
"""

import math
import struct
import zlib

BACKGROUND = (10, 10, 12)  # near-black tile
GLOBE = (52, 211, 153)  # brand green (--accent in dark mode)


def coverage(distance):
    """Anti-aliased coverage of a shape edge: 1 inside, 0 outside."""
    return max(0.0, min(1.0, 0.5 - distance))


def render(size, globe_scale, corner_radius):
    """Returns RGBA rows. globe_scale = globe diameter as a share of the tile."""
    cx = cy = size / 2
    radius = size * globe_scale / 2
    stroke = max(size * 0.055, 1.6)
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            px, py = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(px, py)

            # Outer circle of the globe.
            ink = coverage(abs(r - radius) - stroke / 2)
            if r < radius:
                # Equator.
                ink = max(ink, coverage(abs(py) - stroke / 2))
                # Meridian: an ellipse through both poles.
                a, b = radius * 0.42, radius
                f = math.hypot(px / a, py / b)
                grad = math.hypot(px / (a * a), py / (b * b)) / max(f, 1e-6)
                ink = max(ink, coverage(abs(f - 1) / max(grad, 1e-6) - stroke / 2))

            # Rounded-square tile (corner_radius 0 = full square).
            qx = abs(px) - (size / 2 - corner_radius)
            qy = abs(py) - (size / 2 - corner_radius)
            outside = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - corner_radius
            alpha = coverage(outside)

            color = [round(BACKGROUND[i] + (GLOBE[i] - BACKGROUND[i]) * ink) for i in range(3)]
            row += bytes(color + [round(alpha * 255)])
        rows.append(bytes(row))
    return rows


def png(size, globe_scale, corner_radius):
    raw = b"".join(b"\x00" + row for row in render(size, globe_scale, corner_radius))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def ico(sizes):
    """A .ico file holding one PNG per size (supported by all current browsers)."""
    images = [png(s, 0.62, s * 0.22) for s in sizes]
    out = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    for s, image in zip(sizes, images):
        out += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(image), offset)
        offset += len(image)
    return out + b"".join(images)


def write(path, data):
    with open(path, "wb") as f:
        f.write(data)
    print("wrote", path)


write("src/app/favicon.ico", ico([16, 32, 48]))
# Apple adds its own rounded mask, so this one is a full square.
write("src/app/apple-icon.png", png(180, 0.62, 0))
write("public/icons/icon-192.png", png(192, 0.62, 192 * 0.22))
write("public/icons/icon-512.png", png(512, 0.62, 512 * 0.22))
# "Maskable": Android crops it to a circle or squircle, so the tile is a
# full square and the globe stays inside the central safe area.
write("public/icons/icon-maskable-512.png", png(512, 0.5, 0))
