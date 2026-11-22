"""
Draws the app icons (a gold shield with a check mark) into public/icons.

    python scripts/make-icons.py

Needs Pillow. Everything is drawn at 4x and shrunk, for smooth edges.
"""
from pathlib import Path

from PIL import Image, ImageDraw

INK = '#2b1b3d'
CREAM = '#fff3d9'
GOLD = '#FFB300'
LILAC = '#8B5CF6'
TEAL = '#22B573'

OUT = Path(__file__).resolve().parent.parent / 'public' / 'icons'
SCALE = 4  # supersampling
SIZE = 512  # drawing coordinates


def bezier(p0, p1, p2, p3, steps=40):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        ))
    return out


def shield(dx=0, dy=0):
    pts = [(256, 84), (400, 130), (400, 250)]
    pts += bezier((400, 250), (400, 340), (330, 400), (256, 430))
    pts += bezier((256, 430), (182, 400), (112, 340), (112, 250))
    pts += [(112, 130)]
    return [((x + dx) * SCALE, (y + dy) * SCALE) for x, y in pts]


def thick_line(draw, points, width, fill):
    s = [(x * SCALE, y * SCALE) for x, y in points]
    draw.line(s, fill=fill, width=width * SCALE, joint='curve')
    r = width * SCALE / 2
    for x, y in (s[0], s[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def draw_icon():
    img = Image.new('RGB', (SIZE * SCALE, SIZE * SCALE), INK)
    d = ImageDraw.Draw(img)
    d.polygon(shield(18, 18), fill=LILAC, outline=INK, width=14 * SCALE)
    d.polygon(shield(), fill=GOLD, outline=CREAM, width=14 * SCALE)
    check = [(186, 262), (238, 314), (334, 196)]
    thick_line(d, check, 62, INK)
    thick_line(d, check, 36, TEAL)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    big = draw_icon()
    for name, px in [('icon-192.png', 192), ('icon-512.png', 512), ('icon-maskable-512.png', 512), ('apple-touch-icon.png', 180)]:
        big.resize((px, px), Image.LANCZOS).save(OUT / name, optimize=True)
        print('wrote', name)


if __name__ == '__main__':
    main()
