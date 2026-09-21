"""Parametric vector reconstruction of the server box, rendered at arbitrary yaw.

Camera: the Figma frame's isometric projection (x-axis → (cos30, sin30), y-axis → (-cos30, sin30), z up).
Plan units are the frame's own (800px scene): half-side a=120.5, corner radius r=43, slab height 40.
"""
import math, os, sys

COS30, SIN30 = math.cos(math.pi / 6), 0.5
A, R, H = 120.5, 43.0, 40.0
CX, CY = 400.0, 320.0          # screen anchor of the lid's top-face center
N_SLABS = 4
N_SAMPLES = 288

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def rgbhex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)
def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def lerpc(h1, h2, t):
    return rgbhex(lerp(hexrgb(h1), hexrgb(h2), t))

def proj(x, y, z):
    return (CX + COS30 * (x - y), CY + SIN30 * (x + y) - z)

def rot(x, y, th):
    c, s = math.cos(th), math.sin(th)
    return (c * x - s * y, s * x + c * y)

def rounded_square(a, r, n):
    """Perimeter samples (counter-clockwise in plan) with outward normals."""
    pts = []
    per_corner = n // 4
    centers = [(a - r, a - r), (-(a - r), a - r), (-(a - r), -(a - r)), (a - r, -(a - r))]
    starts = [0, math.pi / 2, math.pi, 3 * math.pi / 2]
    for (cx, cy), s0 in zip(centers, starts):
        for k in range(per_corner):
            ang = s0 + (math.pi / 2) * k / (per_corner - 1)
            nx, ny = math.cos(ang), math.sin(ang)
            pts.append((cx + r * nx, cy + r * ny, nx, ny))
    return pts

PERIM = rounded_square(A, R, N_SAMPLES)

def fmt(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')

def poly_path(points, close=True):
    d = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in points)
    return d + (' Z' if close else '')

# --- palettes (from the Figma gradients) -------------------------------------------------------
DARK = dict(left='#1E1F22', mid='#28292C', right='#303134', rim='#525356', far='#19191c')
BASE = dict(left='#4D956A', mid='#4C5E6B', right='#84907E', rim='#DAFF9F', far='#3f7a58')

def shade(nx, ny, pal):
    """Color for a wall normal (already rotated into camera plan space)."""
    alpha = math.degrees(math.atan2(nx, ny))   # 0 = left face (+y), 90 = right face (+x)
    if alpha <= 0:
        t = max(0.0, min(1.0, -alpha / 45.0)); return lerpc(pal['left'], pal['far'], t)
    if alpha <= 45:
        return lerpc(pal['left'], pal['mid'], alpha / 45.0)
    if alpha <= 90:
        return lerpc(pal['mid'], pal['right'], (alpha - 45) / 45.0)
    t = max(0.0, min(1.0, (alpha - 118) / 17.0))
    return lerpc(pal['right'], pal['rim'], t * t)

def visible(nx, ny):
    return nx + ny > 1e-6

def slab_svg(theta, ztop, pal, uid, is_base=False):
    out = []; defs = []
    rp = [(*rot(x, y, theta), *rot(nx, ny, theta)) for x, y, nx, ny in PERIM]
    n = len(rp)
    vis = [visible(nx, ny) for _, _, nx, ny in rp]
    # find start of the visible run (circular)
    start = next(i for i in range(n) if vis[i] and not vis[i - 1])
    arc = [rp[(start + k) % n] for k in range(n) if vis[(start + k) % n]]
    top = [proj(x, y, ztop) for x, y, _, _ in arc]
    bot = [proj(x, y, ztop - H) for x, y, _, _ in arc]
    xs = [p[0] for p in top]; x0, x1 = min(xs), max(xs)
    # wall gradient across screen x, stops from per-sample shading
    stops = []
    step = max(1, len(arc) // 72)
    for i in range(0, len(arc), step):
        f = (top[i][0] - x0) / max(1e-6, (x1 - x0))
        stops.append((f, shade(arc[i][2], arc[i][3], pal)))
    stops.append((1.0, shade(arc[-1][2], arc[-1][3], pal)))
    stops.sort(key=lambda s: s[0])
    gid = f'wall{uid}'
    defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{fmt(x0)}" y1="0" x2="{fmt(x1)}" y2="0">' +
                ''.join(f'<stop offset="{fmt(f)}" stop-color="{c}"/>' for f, c in stops) + '</linearGradient>')
    wall = poly_path(top + bot[::-1])
    out.append(f'<path d="{wall}" fill="url(#{gid})"/>')
    if is_base:
        vg = f'vg{uid}'
        defs.append(f'<linearGradient id="{vg}" gradientUnits="userSpaceOnUse" x1="0" y1="{fmt(min(p[1] for p in top))}" x2="0" y2="{fmt(max(p[1] for p in bot))}">'
                    '<stop offset="0" stop-color="#5CB85C" stop-opacity="0.28"/><stop offset="0.4" stop-color="#5CB85C" stop-opacity="0"/><stop offset="1" stop-color="#5CB85C" stop-opacity="0.28"/></linearGradient>')
        out.append(f'<path d="{wall}" fill="url(#{vg})"/>')
    out.append(f'<path d="{wall}" fill="white" fill-opacity="0.02"/>')
    # slots: 4 faces; (face normal in plan, along-axis range, z range). Faces +y/-y long & low, +x/-x short & mid.
    faces = [
        ((0, 1), (-78, 52), (-26, -40)), ((0, -1), (-52, 78), (-26, -40)),
        ((1, 0), (-52, 25), (-12, -25.5)), ((-1, 0), (-25, 52), (-12, -25.5)),
    ]
    for (fnx, fny), (u0, u1), (zt, zb) in faces:
        rnx, rny = rot(fnx, fny, theta)
        if not visible(rnx, rny):
            continue
        # points along the face: face at distance A along normal; tangent = (-fny, fnx)
        tx, ty = -fny, fnx
        corners_plan = [(fnx * A + tx * u, fny * A + ty * u) for u in (u0, u1)]
        cp = [rot(x, y, theta) for x, y in corners_plan]
        p_top = [proj(x, y, ztop + zt) for x, y in cp]
        p_bot = [proj(x, y, ztop + zb) for x, y in cp]
        slot = poly_path([p_top[0], p_top[1], p_bot[1], p_bot[0]])
        out.append(f'<path d="{slot}" fill="black" fill-opacity="0.2"/>')
        out.append(f'<path d="{poly_path(p_top, False)}" stroke="black" stroke-opacity="0.6" stroke-width="1"/>')
        out.append(f'<path d="{poly_path(p_bot, False)}" stroke="white" stroke-opacity="0.22" stroke-width="1"/>')
    # rims
    out.append(f'<path d="{poly_path(bot, False)}" stroke="black" stroke-opacity="0.55" stroke-width="1"/>')
    out.append(f'<path d="{poly_path(top, False)}" stroke="white" stroke-opacity="0.3" stroke-width="1"/>')
    # top face
    topface = [proj(*rot(x, y, theta), ztop) for x, y, _, _ in PERIM]
    tg = f'top{uid}'
    ty0 = min(p[1] for p in topface); ty1 = max(p[1] for p in topface)
    defs.append(f'<linearGradient id="{tg}" gradientUnits="userSpaceOnUse" x1="{fmt(CX - 209)}" y1="{fmt(ty0 - 13)}" x2="{fmt(CX + 209)}" y2="{fmt(ty1 + 12)}">'
                '<stop offset="0" stop-color="#34363B"/><stop offset="0.5" stop-color="#2B2D31"/><stop offset="1" stop-color="#24262A"/></linearGradient>')
    if is_base:
        # base top rim carries the glow ring color (only its edge peeks out under tray 1)
        out.append(f'<path d="{poly_path(topface)}" fill="#5FB3A0"/>')
    else:
        out.append(f'<path d="{poly_path(topface)}" fill="url(#{tg})"/>')
    out.append(f'<path d="{poly_path(topface)}" fill="white" fill-opacity="0.02" stroke="white" stroke-opacity="0.14" stroke-width="1"/>')
    return out, defs

def lid_details(theta):
    out = []
    # inset panel ring
    inset = rounded_square(101.3, 36.5, 160)
    ring = [proj(*rot(x, y, theta), 0) for x, y, _, _ in inset]
    out.append(f'<path d="{poly_path(ring)}" stroke="black" stroke-opacity="0.55" stroke-width="1" transform="translate(0 -1)"/>')
    out.append(f'<path d="{poly_path(ring)}" stroke="white" stroke-opacity="0.14" stroke-width="1"/>')
    # asterisk: 8 arms, axis arms 48, diagonal arms 40, rotates with the box
    arms = []
    for k in range(8):
        ang = k * math.pi / 4
        L = 48 if k % 2 == 0 else 40
        ex, ey = rot(L * math.cos(ang), L * math.sin(ang), theta)
        arms.append(proj(ex, ey, 0))
    c = proj(0, 0, 0)
    d = ' '.join(f'M{fmt(c[0])} {fmt(c[1])} L{fmt(x)} {fmt(y)}' for x, y in arms)
    out.append(f'<path d="{d}" stroke="black" stroke-opacity="0.75" stroke-width="15" stroke-linecap="round" transform="translate(0 -1.6)"/>')
    out.append(f'<path d="{d}" stroke="white" stroke-opacity="0.22" stroke-width="14" stroke-linecap="round" transform="translate(0 1.6)"/>')
    out.append(f'<path d="{d}" stroke="url(#aster)" stroke-width="13" stroke-linecap="round"/>')
    out.append(f'<path d="{d}" stroke="black" stroke-opacity="0.35" stroke-width="13" stroke-linecap="round" opacity="0.5" transform="translate(0 1)"/>')
    # screws at the four edge midpoints, 20 in from the edge
    for sx, sy in ((100.7, 0), (-100.7, 0), (0, 100.7), (0, -100.7)):
        cx, cy = rot(sx, sy, theta)
        pts = [proj(cx + 7 * math.cos(t), cy + 7 * math.sin(t), 0) for t in [i * 2 * math.pi / 24 for i in range(24)]]
        out.append(f'<path d="{poly_path(pts)}" stroke="white" stroke-opacity="0.35" stroke-width="1" transform="translate(0 1)"/>')
        out.append(f'<path d="{poly_path(pts)}" fill="#0C0D0F" stroke="black" stroke-opacity="0.35" stroke-width="0.75"/>')
    return out

def render(theta_deg, size=800):
    theta = math.radians(theta_deg)
    body = []; defs = []
    base_bottom_y = CY + SIN30 * 0 + (N_SLABS * H)  # screen y of the box's bottom vertex row center
    ground_y = base_bottom_y + 107 + 9  # bottom vertex is at x+y = 2a-ish ≈ 214 → +107, plus the frame's 9px offset
    defs.append(f'<radialGradient id="gnd0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(400 {fmt(ground_y)}) scale(252 62.4)"><stop stop-color="#3A5A40" stop-opacity="0.95"/><stop offset="0.45" stop-color="#3A5A40" stop-opacity="0.4"/><stop offset="1" stop-color="#3A5A40" stop-opacity="0"/></radialGradient>')
    defs.append(f'<radialGradient id="gnd1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(400 {fmt(ground_y - 2)}) scale(120 24)"><stop stop-color="#3A5A40" stop-opacity="0.95"/><stop offset="0.45" stop-color="#3A5A40" stop-opacity="0.4"/><stop offset="1" stop-color="#3A5A40" stop-opacity="0"/></radialGradient>')
    defs.append('<filter id="blur28" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>')
    defs.append('<filter id="blur10" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>')
    defs.append(f'<linearGradient id="aster" gradientUnits="userSpaceOnUse" x1="400" y1="{fmt(CY - 33.6)}" x2="400" y2="{fmt(CY + 33.6)}"><stop stop-color="#C9CBCF"/><stop offset="0.38" stop-color="#7C7F85"/><stop offset="0.55" stop-color="#2F3135"/><stop offset="0.8" stop-color="#5D6066"/><stop offset="1" stop-color="#9A9DA2"/></linearGradient>')
    body.append(f'<g filter="url(#blur28)"><ellipse cx="400" cy="{fmt(ground_y)}" rx="252" ry="62.4" fill="url(#gnd0)"/></g>')
    body.append(f'<g opacity="0.8" filter="url(#blur10)"><ellipse cx="400" cy="{fmt(ground_y - 2)}" rx="120" ry="24" fill="url(#gnd1)"/></g>')
    # slabs bottom-up: base (index 3) → lid (index 0)
    for i in range(N_SLABS - 1, -1, -1):
        ztop = -H * i
        is_base = i == N_SLABS - 1
        o, d = slab_svg(theta, ztop, BASE if is_base else DARK, f'{i}', is_base)
        body += o; defs += d
    body += lid_details(theta)
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">'
            f'<defs>{"".join(defs)}</defs>{"".join(body)}</svg>')

if __name__ == '__main__':
    outdir = sys.argv[1] if len(sys.argv) > 1 else 'turntable'
    os.makedirs(outdir, exist_ok=True)
    for deg in range(0, 360, 15):
        open(os.path.join(outdir, f'server-box_{deg:03d}.svg'), 'w').write(render(deg))
    print('ok')
