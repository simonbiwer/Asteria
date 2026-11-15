"""Reprojects the Clementine south pole mosaic onto the map's projection.

The source image ("Clementine Mission, Uncontrolled Image Mosaic, Lunar South
Polar Region, Orthographic Projection") is a square greyscale JPEG with the
pole at the centre, 0° longitude up, 90°E right, and its disc edge at 70°S.
The map (src/lib/projection.ts) uses a south polar stereographic projection
with the same orientation, so only the radial scale differs.

The output is a square image centred on the pole that covers latitudes
poleward of OUT_EDGE_LAT (BASEMAP_EDGE_LAT in SouthPoleMap.tsx).

Run (needs Pillow):
    python scripts/reproject-basemap.py path/to/moon_pic.jpg
"""

import math
import os
import sys

from PIL import Image

MOON_RADIUS_KM = 1737.4  # Same as MOON_RADIUS_KM in src/lib/projection.ts.
SOURCE_EDGE_LAT = -70.0  # Latitude of the source mosaic's disc edge.
OUT_EDGE_LAT = -83.0  # Must match BASEMAP_EDGE_LAT in SouthPoleMap.tsx.
OUT_SIZE = 2560  # Output width and height in pixels.
MESH_CELLS = 64  # Piecewise approximation of the warp; error is far below 1 px.
OUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "public", "basemap", "south-pole-clementine.jpg"
)


def stereo_radius_km(lat):
    """Distance from the pole on the map, in km (src/lib/projection.ts)."""
    return 2 * MOON_RADIUS_KM * math.tan(math.pi / 4 + math.radians(lat) / 2)


def find_disc(img):
    """Fits a circle to the mosaic's outer edge. Returns (cx, cy, radius_px)."""
    n = img.size[0]
    px = img.load()
    c = n / 2
    pts = []
    for deg in range(0, 360, 3):
        t = math.radians(deg)
        last = None
        for r in range(int(n * 0.38), int(n * 0.5)):
            x, y = int(c + r * math.sin(t)), int(c - r * math.cos(t))
            if 0 <= x < n and 0 <= y < n and px[x, y] > 25:
                last = r
            elif last is not None and r - last > 15:
                break
        if last is not None:
            pts.append((c + last * math.sin(t), c - last * math.cos(t)))

    def fit(points):
        # Least squares: x² + y² = 2ax + 2by + k.
        s = [[0.0] * 3 for _ in range(3)]
        b = [0.0] * 3
        for x, y in points:
            row = (2 * x, 2 * y, 1.0)
            v = x * x + y * y
            for i in range(3):
                b[i] += row[i] * v
                for j in range(3):
                    s[i][j] += row[i] * row[j]
        m = [s[i] + [b[i]] for i in range(3)]
        for i in range(3):
            for k in range(i + 1, 3):
                f = m[k][i] / m[i][i]
                m[k] = [p - f * q for p, q in zip(m[k], m[i])]
        sol = [0.0] * 3
        for i in (2, 1, 0):
            sol[i] = (m[i][3] - sum(m[i][j] * sol[j] for j in range(i + 1, 3))) / m[i][i]
        a, bb, k = sol
        return a, bb, math.sqrt(k + a * a + bb * bb)

    # Gaps and labels at the mosaic's rim give outliers; drop them and refit.
    for _ in range(6):
        cx, cy, r = fit(pts)
        res = sorted(abs(math.hypot(x - cx, y - cy) - r) for x, y in pts)
        threshold = max(3 * res[len(res) // 2], 4)
        pts = [p for p in pts if abs(math.hypot(p[0] - cx, p[1] - cy) - r) <= threshold]
    return fit(pts)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Image.open(sys.argv[1]).convert("L")
    cx, cy, r_px = find_disc(src)
    # Orthographic: distance from the pole = R * sin(colatitude).
    px_per_km = r_px / (MOON_RADIUS_KM * math.cos(math.radians(SOURCE_EDGE_LAT)))
    print(f"disc centre ({cx:.1f}, {cy:.1f}), radius {r_px:.1f} px, {px_per_km:.3f} px/km")

    half_km = stereo_radius_km(OUT_EDGE_LAT)

    def source_xy(ox, oy):
        """Output pixel -> source pixel."""
        x = (ox / OUT_SIZE * 2 - 1) * half_km
        y = (1 - oy / OUT_SIZE * 2) * half_km  # Map y points up.
        rho = math.hypot(x, y)
        if rho == 0:
            return cx, cy
        colat = 2 * math.atan(rho / (2 * MOON_RADIUS_KM))
        scale = MOON_RADIUS_KM * math.sin(colat) / rho * px_per_km
        return cx + x * scale, cy - y * scale

    step = OUT_SIZE / MESH_CELLS
    mesh = []
    for i in range(MESH_CELLS):
        for j in range(MESH_CELLS):
            x0, y0, x1, y1 = i * step, j * step, (i + 1) * step, (j + 1) * step
            quad = (*source_xy(x0, y0), *source_xy(x0, y1), *source_xy(x1, y1), *source_xy(x1, y0))
            mesh.append(((round(x0), round(y0), round(x1), round(y1)), quad))

    out = src.transform((OUT_SIZE, OUT_SIZE), Image.MESH, mesh, Image.BICUBIC)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    out.save(OUT_PATH, quality=85, optimize=True, progressive=True)
    print(f"wrote {os.path.normpath(OUT_PATH)} ({half_km:.1f} km from pole to edge)")


if __name__ == "__main__":
    main()
