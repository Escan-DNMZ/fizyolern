"""Erzeugt die App-Icons (PNG) ohne externe Bibliotheken.
Aufruf: python tools/make_icons.py
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')

# Thema „Adaçayı“: flaches Salbeigrün, Figur in gebrochenem Weiß
TOP = (79, 122, 99)
BOTTOM = (79, 122, 99)
FG = (247, 250, 246)


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def inside_figure(x, y):
    # Koordinaten 0..1 – stilisierte Figur mit erhobenen Armen (Bewegung/Physio)
    if math.hypot(x - 0.5, y - 0.22) < 0.085:
        return True
    w = 0.055
    segs = [
        (0.5, 0.34, 0.5, 0.6),     # Rumpf
        (0.5, 0.40, 0.3, 0.27),    # linker Arm
        (0.5, 0.40, 0.7, 0.27),    # rechter Arm
        (0.5, 0.6, 0.36, 0.82),    # linkes Bein
        (0.5, 0.6, 0.64, 0.82),    # rechtes Bein
    ]
    return any(seg_dist(x, y, *s) < w for s in segs)


def make(size):
    ss = 3  # Supersampling
    rows = []
    for py in range(size):
        row = bytearray([0])
        t = py / (size - 1)
        bg = tuple(round(TOP[i] * (1 - t) + BOTTOM[i] * t) for i in range(3))
        for px in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size
                    y = (py + (sy + 0.5) / ss) / size
                    hits += inside_figure(x, y)
            a = hits / (ss * ss)
            row += bytes(round(bg[i] * (1 - a) + FG[i] * a) for i in range(3))
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(os.path.join(OUT, f'icon-{size}.png'), 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for s in (180, 192, 512):
        make(s)
    print('Icons erstellt in', os.path.abspath(OUT))
