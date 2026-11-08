"""Ghost-lap scene for Blender: two real laps on one 3D track, rendered as a
frame sequence for the video (tools/ghost-lap/README.md).

  Blender -b --factory-startup --python scene.py -- DATA_DIR OUT_DIR [--still T] [--fps 30]

DATA_DIR holds fetch.py's lap_a.json, lap_b.json and track.json. The track is
worked out from the session's fast laps: where twenty cars ran shows where the
road is and how wide, so each car can drive its own real line through it (in
on the brakes, the apex, out to the kerb). Everything is built from code: our
own car and scenery, no models or liveries from anywhere else. Coordinates
from OpenF1 are decimetres; the scene works in metres.
"""
import bisect, bpy, bmesh, json, math, os, random, sys
from datetime import datetime
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:]
DATA, OUT = argv[0], argv[1]
STILL = float(argv[argv.index("--still") + 1]) if "--still" in argv else None
FPS = int(argv[argv.index("--fps") + 1]) if "--fps" in argv else 30
LEAD_IN, LEAD_OUT = 1.0, 0.6  # seconds before the line and after the slower car's finish
random.seed(7)


# ---------------------------------------------------------------- data
def iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def load_lap(name):
    d = json.load(open(os.path.join(DATA, name)))
    t0 = iso(d["start"])
    pts = sorted(((iso(p["date"]) - t0, Vector((p["x"] / 10, p["y"] / 10, p["z"] / 10))) for p in d["loc"] if p["x"] or p["y"]), key=lambda q: q[0])
    car = sorted(((iso(c["date"]) - t0, c) for c in d["car"]), key=lambda q: q[0])
    d["pts"], d["cars"] = pts, car
    return d


A, B = load_lap("lap_a.json"), load_lap("lap_b.json")
TRACK = [[Vector((p[0] / 10, p[1] / 10, p[2] / 10)) for p in lap] for lap in json.load(open(os.path.join(DATA, "track.json")))]


def catmull(p0, p1, p2, p3, f):
    f2, f3 = f * f, f * f * f
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3)


class Path:
    """A car's real line, and where on it the car is at each moment.

    OpenF1's position timestamps wander (0.04 to 0.5 s apart, so speeds worked
    out from them swing from 50 to 550 km/h), but the positions themselves
    trace the line well and the reported speed is smooth. So the line comes
    from the positions alone (in order, smoothed), and the car's place on it
    from the speed: distance = integral of speed, scaled so the car crosses
    the start line at 0 and again at its lap time.
    """

    def __init__(self, lap, start_point=None, start_dir=None):
        ps = [p[1] for p in lap["pts"]]
        # dense line through the samples by index, every ~0.5 m, then smoothed
        dense = []
        for i in range(len(ps) - 1):
            p0, p1, p2, p3 = ps[max(i - 1, 0)], ps[i], ps[i + 1], ps[min(i + 2, len(ps) - 1)]
            n = max(1, int((p2 - p1).length / 0.5))
            dense += [catmull(p0, p1, p2, p3, k / n) for k in range(n)]
        dense.append(ps[-1])
        for _ in range(3):
            dense = [dense[0]] + [(dense[i - 3] + dense[i - 2] + dense[i - 1] + dense[i] + dense[i + 1] + dense[i + 2] + dense[i + 3]) / 7
                                  for i in range(3, len(dense) - 3)] + [dense[-1]]
        self.p = dense
        self.s = [0.0]
        for i in range(1, len(dense)):
            self.s.append(self.s[-1] + (dense[i] - dense[i - 1]).length)
        # distance driven from the speed, from the first car sample
        self.ct = [c[0] for c in lap["cars"]]
        self.c = [c[1] for c in lap["cars"]]
        self.d = [0.0]
        for i in range(1, len(self.ct)):
            v = (self.c[i]["speed"] + self.c[i - 1]["speed"]) / 2 / 3.6
            self.d.append(self.d[-1] + v * max(0.0, self.ct[i] - self.ct[i - 1]))
        self.dur = lap["duration"]
        if start_point is None:  # this lap draws the start line where it was at time 0
            start_point = self.raw_at(lap, 0.0)
            start_dir = (self.raw_at(lap, 0.3) - start_point).normalized()
        self.start_point, self.start_dir = start_point, start_dir
        # the two crossings of the start line: lap start and lap end
        cross = []
        for i in range(1, len(dense)):
            a = (dense[i - 1] - start_point).dot(start_dir)
            b = (dense[i] - start_point).dot(start_dir)
            if a < 0 <= b and (dense[i] - start_point).length < 40:
                cross.append(self.s[i - 1] + (self.s[i] - self.s[i - 1]) * (-a / ((b - a) or 1)))
        self.s0 = cross[0] if cross else 0.0
        self.s1 = cross[-1] if len(cross) > 1 else self.s[-1]
        self.d0, self.d1 = self._dist(0.0), self._dist(self.dur)

    @staticmethod
    def raw_at(lap, t):
        pts = lap["pts"]
        ts = [p[0] for p in pts]
        i = max(0, min(len(ts) - 2, bisect.bisect_right(ts, t) - 1))
        f = (t - ts[i]) / ((ts[i + 1] - ts[i]) or 1)
        return pts[i][1].lerp(pts[i + 1][1], max(0.0, min(1.0, f)))

    def _dist(self, t):
        ct, d = self.ct, self.d
        if t <= ct[0]:
            return d[0] + (t - ct[0]) * self.c[0]["speed"] / 3.6
        if t >= ct[-1]:
            return d[-1] + (t - ct[-1]) * self.c[-1]["speed"] / 3.6
        i = bisect.bisect_right(ct, t) - 1
        f = (t - ct[i]) / ((ct[i + 1] - ct[i]) or 1)
        return d[i] + f * (d[i + 1] - d[i])

    def s_at(self, t):
        """Distance along the line at time t (start line crossed at 0 and at the lap time)."""
        return self.s0 + (self.s1 - self.s0) * (self._dist(t) - self.d0) / ((self.d1 - self.d0) or 1)

    def frac(self, t):
        return (self.s_at(t) - self.s0) / ((self.s1 - self.s0) or 1)

    def point(self, s):
        ss, ps = self.s, self.p
        if s <= ss[0]:
            return ps[0] + (ps[1] - ps[0]).normalized() * (s - ss[0])
        if s >= ss[-1]:
            return ps[-1] + (ps[-1] - ps[-2]).normalized() * (s - ss[-1])
        i = bisect.bisect_right(ss, s) - 1
        f = (s - ss[i]) / ((ss[i + 1] - ss[i]) or 1)
        return ps[i].lerp(ps[i + 1], f)

    def at(self, t):
        return self.point(self.s_at(t))

    def car(self, t, key):
        i = max(0, bisect.bisect_right(self.ct, t) - 1)
        j = min(i + 1, len(self.ct) - 1)
        a, b = self.c[i][key], self.c[j][key]
        f = 0 if j == i else max(0, min(1, (t - self.ct[i]) / ((self.ct[j] - self.ct[i]) or 1)))
        return a + (b - a) * f


PA = Path(A)
PB = Path(B, PA.start_point, PA.start_dir)  # the same start line for both

if os.environ.get("GHOST_CHECK"):  # print each car's speed from frame to frame, then stop
    for nm, pth in (("A", PA), ("B", PB)):
        v = [round((pth.at(t + 1 / 30) - pth.at(t)).length * 30 * 3.6) for t in (k / 30 for k in range(0, 300, 3))]
        print("CHECK", nm, "s0 %.1f s1 %.1f" % (pth.s0, pth.s1), "lap m %.0f" % (pth.s1 - pth.s0), v[:40])
    sys.exit(0)


# ---------------------------------------------------------------- track
def resample(points, step):
    out, acc = [points[0]], 0.0
    for i in range(1, len(points)):
        seg = (points[i] - points[i - 1]).length
        if seg == 0:
            continue
        acc += seg
        while acc >= step:
            out.append(points[i - 1].lerp(points[i], 1 - (acc - step) / seg))
            acc -= step
    return out


def smooth_loop(v, k, n):
    m = len(v)
    for _ in range(n):
        v = [sum((v[(i + j) % m] for j in range(-k, k + 1)), v[0] * 0) / (2 * k + 1) for i in range(m)]
    return v


# Reference: lap A over its own lap (start line to start line), every 2 m.
ref = resample([PA.point(PA.s0 + k * 0.5) for k in range(int((PA.s1 - PA.s0) / 0.5) + 1)], 2.0)
ref = smooth_loop(ref, 2, 2)
N = len(ref)


def frames_of(line):
    tang = [(line[(i + 1) % N] - line[i - 1]).normalized() for i in range(N)]
    side = [Vector((-t.y, t.x, 0)).normalized() for t in tang]
    return tang, side


tang, side = frames_of(ref)
kd = KDTree(N)
for i, p in enumerate(ref):
    kd.insert(Vector((p.x, p.y, 0)), i)
kd.balance()

# Where the cars ran, per stretch of 2 m: lateral offsets of every sample.
offs = [[] for _ in range(N)]
heights = [[] for _ in range(N)]
for lap in TRACK + [[p for _, p in A["pts"]], [p for _, p in B["pts"]]]:
    for p in resample(lap, 1.0):
        _, i, d = kd.find(Vector((p.x, p.y, 0)))
        if d > 25:
            continue
        o = (Vector((p.x, p.y, 0)) - Vector((ref[i].x, ref[i].y, 0))).dot(side[i])
        offs[i].append(o)
        heights[i].append(p.z)


def window_pct(i, q, span=10):
    vals = sorted(x for j in range(i - span, i + span + 1) for x in offs[j % N])
    return vals[int(q * (len(vals) - 1))] if vals else 0.0


lo = smooth_loop([window_pct(i, 0.03) for i in range(N)], 6, 3)
hi = smooth_loop([window_pct(i, 0.97) for i in range(N)], 6, 3)
zs = smooth_loop([(sum(h) / len(h) if h else ref[i].z) for i, h in enumerate(heights)], 4, 3)
# The road: centred on where the cars ran, as wide as they used plus a margin.
centre = [ref[i] + side[i] * ((lo[i] + hi[i]) / 2) for i in range(N)]
for i in range(N):
    centre[i].z = zs[i]
centre = smooth_loop(centre, 3, 2)
half = smooth_loop([max(6.5, min(9.5, (hi[i] - lo[i]) / 2 + 2.5)) for i in range(N)], 8, 2)
tang, side = frames_of(centre)
line = centre
zmin = min(p.z for p in line)
# curvature (1/m, signed: > 0 turning left)
curv = []
for i in range(N):
    a, b = tang[i - 1], tang[(i + 1) % N]
    curv.append(math.atan2(a.x * b.y - a.y * b.x, a.dot(b)) / 4.0)
curv = smooth_loop(curv, 3, 2)
dist = [0.0]
for i in range(1, N):
    dist.append(dist[-1] + (line[i] - line[i - 1]).length)
LAP_LEN = dist[-1] + (line[0] - line[-1]).length


# ---------------------------------------------------------------- scene setup
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.fps = FPS
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.view_settings.exposure = -0.7
ee = sc.eevee
ee.taa_render_samples = int(os.environ.get("GHOST_SAMPLES", "8"))
for attr, val in (("use_shadows", True), ("shadow_ray_count", 1), ("shadow_step_count", 6), ("use_raytracing", False)):
    if hasattr(ee, attr):
        setattr(ee, attr, val)
sc.render.use_motion_blur = os.environ.get("GHOST_BLUR") == "1"  # 3-4x the render time
if hasattr(sc.render, "motion_blur_shutter"):
    sc.render.motion_blur_shutter = 0.35
col = sc.collection


def link(ob):
    col.objects.link(ob)
    return ob


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def material(name, rgb, rough=0.6, metal=0.0, alpha=1.0, coat=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    if coat and "Coat Weight" in bs.inputs:
        bs.inputs["Coat Weight"].default_value = coat
    if emit:
        bs.inputs["Emission Color"].default_value = (*rgb, 1)
        bs.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        bs.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    return m


def noisy(name, c1, c2, scale, rough=0.8, detail=6.0, bump=0.0):
    """A surface whose colour varies between c1 and c2 with procedural noise."""
    m = material(name, c1, rough)
    nt = m.node_tree
    bs = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bs.inputs["Base Color"])
    if bump:
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump
        nt.links.new(nz.outputs["Fac"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], bs.inputs["Normal"])
    return m


WET = os.environ.get("GHOST_WET") == "1"  # a wet track under cloud, cars on intermediates
M = {
    "asphalt": (noisy("asphalt", (0.006, 0.006, 0.008), (0.016, 0.016, 0.019), 9.0, 0.28, bump=0.03) if WET
                else noisy("asphalt", (0.018, 0.018, 0.021), (0.04, 0.04, 0.045), 9.0, 0.82, bump=0.08)),
    "rubber": material("rubber", (0.008, 0.008, 0.01), 0.7, alpha=0.4),
    "runoff": noisy("runoff", (0.07, 0.07, 0.075), (0.11, 0.11, 0.115), 5.0, 0.9),
    "gravel": noisy("gravel", (0.33, 0.27, 0.19), (0.5, 0.43, 0.32), 40.0, 0.95, bump=0.25),
    "grass": noisy("grass", (0.03, 0.13, 0.025), (0.06, 0.2, 0.04), 0.35, 0.95),
    "white": material("white", (0.82, 0.82, 0.82), 0.6),
    "red": material("red", srgb("#d2141b"), 0.6),
    "tyrewall": noisy("tyrewall", srgb("#1d4ea8"), srgb("#e8e8e8"), 0.9, 0.7),
    "concrete": noisy("concrete", (0.42, 0.42, 0.43), (0.55, 0.55, 0.56), 3.0, 0.85),
    "fence": material("fence", (0.4, 0.42, 0.45), 0.5, metal=0.6, alpha=0.25),
    "pole": material("pole", (0.35, 0.36, 0.38), 0.4, metal=0.8),
    "glass": material("glass", (0.05, 0.09, 0.13), 0.08, metal=0.6),
    "building": noisy("building", (0.62, 0.63, 0.66), (0.74, 0.75, 0.78), 2.0, 0.7),
    "roof": material("roof", (0.2, 0.21, 0.23), 0.5, metal=0.4),
    "crowd": noisy("crowd", (0.5, 0.06, 0.06), (0.12, 0.25, 0.6), 35.0, 0.9, detail=2.0),
    "seat": material("seat", (0.12, 0.13, 0.15), 0.6),
    "leaf": noisy("leaf", (0.02, 0.09, 0.02), (0.05, 0.16, 0.03), 3.0, 0.9),
    "leaf2": noisy("leaf2", (0.04, 0.12, 0.03), (0.09, 0.2, 0.05), 3.0, 0.9),
    "trunk": material("trunk", (0.12, 0.08, 0.05), 0.9),
    "city": noisy("city", (0.38, 0.43, 0.5), (0.55, 0.6, 0.66), 0.08, 0.8),
    "board": None,  # set below (our own banner)
}


def strip(name, offsets, mat, dz=0.0, mask=None, mats=None, stripe=None, uv_len=None):
    """A band along the track between lateral offsets (constant or per index).
    `mask(i)` keeps only some stretches; `stripe(i)` picks a material slot."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new() if uv_len else None
    rows = []
    for i in range(N):
        o = [x(i) if callable(x) else x for x in offsets]
        rows.append([bm.verts.new(line[i] + side[i] * v + Vector((0, 0, dz))) for v in o])
    for i in range(N):
        j = (i + 1) % N
        if mask and not (mask(i) and mask(j)):
            continue
        for k in range(len(offsets) - 1):
            f = bm.faces.new((rows[i][k], rows[i][k + 1], rows[j][k + 1], rows[j][k]))
            f.smooth = True
            if stripe:
                f.material_index = stripe(i)
            if uv:
                u0, u1 = dist[i] / uv_len, (dist[i] + 2.0) / uv_len
                for loop, (u, v) in zip(f.loops, ((u0, 0), (u0, 1), (u1, 1), (u1, 0))):
                    loop[uv].uv = (u, v)
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    for m in (mats or [mat]):
        ob.data.materials.append(m)
    return ob


def wall(name, off, thick, height, mat, mask=None, dz=-0.05, uv_len=None):
    """A vertical wall along the track at lateral `off` (sign = side)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new() if uv_len else None
    rows = []
    for i in range(N):
        b = line[i] + Vector((0, 0, dz))
        o0 = off(i) if callable(off) else off
        o1 = o0 + math.copysign(thick, o0)
        rows.append([bm.verts.new(b + side[i] * o0), bm.verts.new(b + side[i] * o1),
                     bm.verts.new(b + side[i] * o1 + Vector((0, 0, height))), bm.verts.new(b + side[i] * o0 + Vector((0, 0, height)))])
    for i in range(N):
        j = (i + 1) % N
        if mask and not (mask(i) and mask(j)):
            continue
        for k in range(4):
            f = bm.faces.new((rows[i][k], rows[i][(k + 1) % 4], rows[j][(k + 1) % 4], rows[j][k]))
            if uv and k == 3:  # the face towards the track carries the banner
                u0, u1 = dist[i] / uv_len, (dist[i] + 2.0) / uv_len
                for loop, (u, v) in zip(f.loops, ((u0, 1), (u0, 0), (u1, 0), (u1, 1))):
                    loop[uv].uv = (u, v)
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    ob.data.materials.append(mat)
    return ob


# ---------------------------------------------------------------- the road
corner = lambda i: abs(curv[i]) > 1 / 180  # tighter than a 180 m radius
left_turn = lambda i: curv[i] > 0
strip("asphalt", [lambda i: -half[i], lambda i: half[i]], M["asphalt"])
# rubbered-in racing line: where car A actually drove
rub_off = []
kd_a = KDTree(len(PA.p))
for k, q in enumerate(PA.p):
    kd_a.insert(q, k)
kd_a.balance()
for i in range(N):
    p = line[i]
    best = PA.p[kd_a.find(p)[1]]
    rub_off.append((Vector((best.x, best.y, 0)) - Vector((p.x, p.y, 0))).dot(side[i]))
rub_off = smooth_loop(rub_off, 4, 2)
strip("rubber", [lambda i: rub_off[i] - 1.3, lambda i: rub_off[i] + 1.3], M["rubber"], dz=0.012)
for sgn in (-1, 1):
    strip(f"edge_{sgn}", [lambda i, s=sgn: s * (half[i] - 0.45), lambda i, s=sgn: s * (half[i] - 0.2)], M["white"], dz=0.01)
    # kerbs on corners, both sides; striped every metre
    strip(f"kerb_{sgn}", [lambda i, s=sgn: s * half[i], lambda i, s=sgn: s * (half[i] + 1.5)], None, dz=0.04,
          mask=corner, mats=[M["red"], M["white"]], stripe=lambda i: (i // 1) % 2)
    # run-off: gravel outside the corners, asphalt elsewhere
    outside = (lambda i, s=sgn: corner(i) and ((s < 0) == left_turn(i)))
    strip(f"gravel_{sgn}", [lambda i, s=sgn: s * (half[i] + 1.5), lambda i, s=sgn: s * (half[i] + 14)], M["gravel"], dz=-0.02, mask=outside)
    strip(f"runoff_{sgn}", [lambda i, s=sgn: s * (half[i] + 1.5), lambda i, s=sgn: s * (half[i] + 7)], M["runoff"], dz=-0.03,
          mask=lambda i, o=outside: not o(i))

# start/finish line and grid boxes
sl = strip("startline", [lambda i: -half[i], lambda i: half[i]], M["white"], dz=0.015, mask=lambda i: i in (0, 1) or i == N - 1)


# ---------------------------------------------------------------- terrain
xs_ = [p.x for p in line]
ys_ = [p.y for p in line]
cx, cy = (min(xs_) + max(xs_)) / 2, (min(ys_) + max(ys_)) / 2
SPAN, STEP = 3400.0, 14.0
n = int(SPAN / STEP)
me = bpy.data.meshes.new("terrain")
bm = bmesh.new()
grid = []
for gy in range(n + 1):
    row = []
    for gx in range(n + 1):
        x, y = cx - SPAN / 2 + gx * STEP, cy - SPAN / 2 + gy * STEP
        near = kd.find_n(Vector((x, y, 0)), 8)
        w = [1 / (d + 6) ** 2 for _, _, d in near]
        z = sum(zs[i] * wi for (_, i, _), wi in zip(near, w)) / sum(w)
        dmin = near[0][2]
        z -= 0.4 + max(0, dmin - 40) * 0.01 * (1 + 0.5 * math.sin(x * 0.004) * math.cos(y * 0.005))
        row.append(bm.verts.new((x, y, z)))
    grid.append(row)
for gy in range(n):
    for gx in range(n):
        bm.faces.new((grid[gy][gx], grid[gy][gx + 1], grid[gy + 1][gx + 1], grid[gy + 1][gx])).smooth = True
bm.to_mesh(me)
link(bpy.data.objects.new("terrain", me)).data.materials.append(M["grass"])


def ground_z(x, y):
    near = kd.find_n(Vector((x, y, 0)), 8)
    w = [1 / (d + 6) ** 2 for _, _, d in near]
    z = sum(zs[i] * wi for (_, i, _), wi in zip(near, w)) / sum(w)
    return z - 0.4 - max(0, near[0][2] - 40) * 0.01, near[0][2]


# ---------------------------------------------------------------- barriers
banner_png = os.path.join(DATA, "banner.png")
if os.path.exists(banner_png):  # made by hud.ts: our own "PADDOCK TIMES" board
    m = material("board", (1, 1, 1), 0.5)
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(banner_png)
    nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    M["board"] = m
else:
    M["board"] = M["tyrewall"]
for sgn in (-1, 1):
    outside = (lambda i, s=sgn: corner(i) and ((s < 0) == left_turn(i)))
    dist_wall = lambda i, s=sgn, o=outside: s * (half[i] + (16 if o(i) else 9))
    wall(f"tyres_{sgn}", dist_wall, 1.0, 1.0, M["tyrewall"])
    wall(f"boards_{sgn}", lambda i, f=dist_wall, s=sgn: f(i) + s * 1.05, 0.15, 1.2, M["board"], uv_len=12.0)
    wall(f"wall_{sgn}", lambda i, f=dist_wall, s=sgn: f(i) + s * 1.25, 0.4, 1.4, M["concrete"])
    wall(f"fence_{sgn}", lambda i, f=dist_wall, s=sgn: f(i) + s * 1.6, 0.03, 4.2, M["fence"], dz=1.3)
# fence posts every 10 m
post = bpy.data.meshes.new("post")
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.07, radius2=0.07, depth=5.5)
bm.to_mesh(post)
for sgn in (-1, 1):
    for i in range(0, N, 5):
        o = half[i] + (16 if (corner(i) and ((sgn < 0) == left_turn(i))) else 9) + 1.65
        p = line[i] + side[i] * (sgn * o) + Vector((0, 0, 2.7))
        ob = link(bpy.data.objects.new("post", post))
        ob.location = p
        ob.data.materials.append(M["pole"]) if not ob.data.materials else None


# ---------------------------------------------------------------- start straight
def block(name, size, loc, rot_z, mat, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    ob.scale = size
    ob.location = loc
    ob.rotation_euler = (0, 0, rot_z)
    ob.data.materials.append(mat)
    ob.parent = parent
    return ob


yaw0 = math.atan2(tang[0].y, tang[0].x)
# the straight before the line: pit building on one side, grandstands on the other
for k, i in enumerate(range(N - 120, N, 12)):
    i %= N
    yaw = math.atan2(tang[i].y, tang[i].x)
    base = line[i]
    # pit building (inside: the side away from turn 1)
    pit = base + side[i] * (half[i] + 30)
    block(f"pit_{k}", (24.5, 16, 13), pit + Vector((0, 0, 6.0)), yaw, M["building"])
    block(f"pitglass_{k}", (24.6, 16.1, 3.2), pit + Vector((0, 0, 9.0)), yaw, M["glass"])
    block(f"pitroof_{k}", (24.6, 17, 0.6), pit + Vector((0, 0, 12.8)), yaw, M["roof"])
    # grandstand (outside)
    gs = base - side[i] * (half[i] + 24)
    for r in range(8):
        block(f"stand_{k}_{r}", (24.2, 1.6, 0.9), gs - side[i] * (r * 1.6) + Vector((0, 0, 0.6 + r * 0.95)), yaw, M["crowd"] if r % 1 == 0 else M["seat"])
    block(f"standroof_{k}", (24.4, 15, 0.5), gs - side[i] * 6 + Vector((0, 0, 11.5)), yaw, M["roof"])
    block(f"standpost_{k}", (0.4, 0.4, 11), gs - side[i] * 13 + Vector((0, 0, 6)), yaw, M["pole"])
# start gantry over the line
g0 = line[0]
for sgn in (-1, 1):
    block(f"gantry_post_{sgn}", (0.8, 0.8, 9), g0 + side[0] * (sgn * (half[0] + 1.5)) + Vector((0, 0, 4.5)), yaw0, M["roof"])
block("gantry_beam", (1.2, 2 * half[0] + 4, 1.6), g0 + Vector((0, 0, 8.6)), yaw0, M["roof"])
block("gantry_lights", (0.2, 2 * half[0], 0.6), g0 - tang[0] * 0.7 + Vector((0, 0, 8.4)), yaw0, material("lights", (0.9, 0.05, 0.03), emit=2.0))


# ---------------------------------------------------------------- trees and city
def tree_mesh(name, kind):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.25, radius2=0.18, depth=3.0, matrix=Matrix.Translation((0, 0, 1.5)))
    trunk_faces = len(bm.faces)
    if kind == 0:
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=3.2, matrix=Matrix.Translation((0, 0, 5.2)))
    elif kind == 1:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=2.6, radius2=0.0, depth=9.0, matrix=Matrix.Translation((0, 0, 7.0)))
    else:
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=2.4, matrix=Matrix.Translation((0.8, 0.3, 4.6)))
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=2.2, matrix=Matrix.Translation((-0.9, -0.2, 5.4)))
    for f in bm.faces:
        f.material_index = 0 if f.index < trunk_faces else 1
        f.smooth = True
    bm.to_mesh(me)
    me.materials.append(M["trunk"])
    me.materials.append(M["leaf"] if kind != 2 else M["leaf2"])
    return me


trees = [tree_mesh(f"tree{k}", k) for k in range(3)]
placed = 0
for _ in range(9000):
    x = cx + random.uniform(-SPAN / 2.3, SPAN / 2.3)
    y = cy + random.uniform(-SPAN / 2.3, SPAN / 2.3)
    z, d = ground_z(x, y)
    if d < 34 or (d > 400 and random.random() < 0.6):
        continue
    ob = link(bpy.data.objects.new("tree", random.choice(trees)))
    ob.location = (x, y, z)
    s = random.uniform(0.8, 1.6)
    ob.scale = (s, s, s * random.uniform(0.9, 1.3))
    ob.rotation_euler = (0, 0, random.uniform(0, 6.3))
    placed += 1
    if placed >= 2600:
        break
# São Paulo on the horizon
for _ in range(260):
    ang = random.uniform(0, 2 * math.pi)
    r = random.uniform(1500, 2900)
    x, y = cx + r * math.cos(ang), cy + r * math.sin(ang)
    h = random.uniform(18, 110) * (1.6 if random.random() < 0.1 else 1)
    block("tower", (random.uniform(18, 45), random.uniform(18, 45), h), Vector((x, y, zmin - 20 + h / 2)), random.uniform(0, 3), M["city"])


# ---------------------------------------------------------------- the cars
def loft(name, sections, mat, parent, smooth_lvl=1):
    """A body lofted through cross-sections: (x, half-width, z-bottom, z-top, roundness)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    seg = 16
    for x, hw, zb, zt, rnd in sections:
        ring = []
        zc, hz = (zb + zt) / 2, (zt - zb) / 2
        for k in range(seg):
            a = 2 * math.pi * k / seg
            c, s = math.cos(a), math.sin(a)
            # superellipse: rnd 2 = ellipse, higher = boxier
            e = 2 / rnd
            y = hw * math.copysign(abs(c) ** e, c)
            z = zc + hz * math.copysign(abs(s) ** e, s)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    ob.data.materials.append(mat)
    ob.parent = parent
    if smooth_lvl:
        mod = ob.modifiers.new("smooth", "SUBSURF")
        mod.levels = mod.render_levels = smooth_lvl
    return ob


def plate(name, size, loc, mat, parent, rot=(0, 0, 0), bevel=0.01):
    ob = block(name, size, loc, 0, mat, parent)
    ob.rotation_euler = rot
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return ob


def rod(name, a, b, r, mat, parent):
    a, b = Vector(a), Vector(b)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r, depth=(b - a).length)
    bm.to_mesh(me)
    ob = link(bpy.data.objects.new(name, me))
    ob.data.materials.append(mat)
    ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    ob.parent = parent
    return ob


def wheel(name, x, y, front, mats, parent):
    """Tyre with rounded shoulders, rim and a coloured sidewall band (soft: red)."""
    hub = bpy.data.objects.new(name, None)
    link(hub)
    hub.parent = parent
    hub.location = (x, y, 0.36)
    w = 0.32 if front else 0.42
    me = bpy.data.meshes.new(name + "_tyre")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.36, radius2=0.36, depth=w)
    bm.to_mesh(me)
    tyre = link(bpy.data.objects.new(name + "_tyre", me))
    tyre.data.materials.append(mats["tyre"])
    tyre.rotation_euler = (math.pi / 2, 0, 0)
    tyre.parent = hub
    bv = tyre.modifiers.new("bevel", "BEVEL")
    bv.width = 0.07
    bv.segments = 4
    for f in tyre.data.polygons:
        f.use_smooth = True
    for sgn in (-1, 1):
        for rr, mm, dz in ((0.25, mats["rim"], 0.004), (0.3, mats["band"], 0.002)):
            me2 = bpy.data.meshes.new(name + "_disc")
            bm2 = bmesh.new()
            bmesh.ops.create_cone(bm2, cap_ends=True, segments=32, radius1=rr, radius2=rr, depth=0.01)
            bm2.to_mesh(me2)
            d = link(bpy.data.objects.new(name + "_disc", me2))
            d.data.materials.append(mm)
            d.rotation_euler = (math.pi / 2, 0, 0)
            d.location = (0, sgn * (w / 2 + dz), 0)
            d.parent = hub
    return hub


def build_car(tag, lap, ghost):
    a = 0.62 if ghost else 1.0
    paint = material(tag + "_paint", srgb(lap["colour"]), 0.22, metal=0.35, alpha=a, coat=0.8, emit=0.25 if ghost else 0.0)
    carbon = noisy(tag + "_carbon", (0.012, 0.012, 0.014), (0.03, 0.03, 0.034), 60.0, 0.35)
    if ghost:
        carbon.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = a
        carbon.surface_render_method = "BLENDED"
    mats = {
        "tyre": material(tag + "_tyre", (0.015, 0.015, 0.016), 0.85, alpha=a),
        "rim": material(tag + "_rim", (0.08, 0.08, 0.09), 0.3, metal=0.9, alpha=a),
        "band": material(tag + "_band", srgb("#e0141e"), 0.5, alpha=a),
    }
    helmet = material(tag + "_helmet", (0.9, 0.9, 0.9), 0.25, alpha=a, coat=1.0)
    root = link(bpy.data.objects.new(tag, None))
    body = link(bpy.data.objects.new(tag + "_body", None))
    body.parent = root
    # monocoque and nose: x forward from the rear axle area to the nose tip
    loft(tag + "_tub", [
        (-0.9, 0.42, 0.18, 0.72, 3.0), (0.0, 0.45, 0.17, 0.74, 3.2), (0.7, 0.42, 0.17, 0.7, 3.0),
        (1.3, 0.33, 0.17, 0.62, 2.8), (2.0, 0.22, 0.17, 0.5, 2.5), (2.8, 0.14, 0.16, 0.38, 2.3), (3.35, 0.08, 0.17, 0.27, 2.2)], paint, body)
    # sidepods with an undercut and the engine cover / airbox down to the rear
    for sgn in (-1, 1):
        loft(tag + f"_pod{sgn}", [
            (0.75, 0.12, 0.3, 0.55, 2.4), (0.45, 0.3, 0.22, 0.6, 3.0), (-0.2, 0.32, 0.2, 0.58, 3.0),
            (-0.9, 0.22, 0.2, 0.48, 2.6), (-1.5, 0.1, 0.22, 0.36, 2.2)], paint, body).location = (0, sgn * 0.5, 0)
    loft(tag + "_cover", [
        (0.35, 0.16, 0.6, 1.08, 2.4), (0.0, 0.22, 0.55, 1.12, 2.6), (-0.6, 0.24, 0.5, 1.0, 2.6),
        (-1.4, 0.16, 0.38, 0.78, 2.4), (-2.05, 0.08, 0.3, 0.55, 2.2)], paint, body)
    plate(tag + "_fin", (1.3, 0.015, 0.32), (-1.25, 0, 0.9), paint, body, rot=(0, math.radians(-8), 0), bevel=0.004)
    plate(tag + "_airbox", (0.22, 0.2, 0.16), (0.12, 0, 1.06), carbon, body, bevel=0.03)
    # floor and diffuser
    plate(tag + "_floor", (3.9, 1.62, 0.04), (-0.2, 0, 0.1), carbon, body, bevel=0.02)
    plate(tag + "_diffuser", (0.6, 1.1, 0.04), (-2.3, 0, 0.2), carbon, body, rot=(0, math.radians(14), 0))
    # front wing: three elements, endplates, nose pylons
    for k, (dx, dz, ang) in enumerate(((0.0, 0.0, 2), (-0.18, 0.07, 10), (-0.33, 0.15, 20))):
        plate(tag + f"_fw{k}", (0.26, 1.9 - k * 0.12, 0.018), (3.42 + dx, 0, 0.1 + dz), carbon if k == 0 else paint, body, rot=(0, math.radians(-ang), 0), bevel=0.006)
    for sgn in (-1, 1):
        plate(tag + f"_fwend{sgn}", (0.6, 0.02, 0.24), (3.3, sgn * 0.96, 0.18), carbon, body, bevel=0.005)
        rod(tag + f"_pylon{sgn}", (3.25, sgn * 0.06, 0.25), (3.3, sgn * 0.12, 0.13), 0.015, carbon, body)
    # rear wing: main plane + flap, tall endplates, beam wing, pylon
    plate(tag + "_rw_main", (0.32, 1.02, 0.02), (-2.38, 0, 0.97), carbon, body, rot=(0, math.radians(-8), 0), bevel=0.006)
    plate(tag + "_rw_flap", (0.22, 1.0, 0.02), (-2.2, 0, 1.08), paint, body, rot=(0, math.radians(-30), 0), bevel=0.006)
    for sgn in (-1, 1):
        plate(tag + f"_rwend{sgn}", (0.62, 0.02, 0.62), (-2.32, sgn * 0.52, 0.86), paint, body, bevel=0.01)
    plate(tag + "_beam", (0.2, 0.9, 0.02), (-2.3, 0, 0.5), carbon, body, rot=(0, math.radians(-12), 0))
    rod(tag + "_rwpylon", (-2.05, 0, 0.5), (-2.3, 0, 0.95), 0.025, carbon, body)
    # halo (front pillar and the ring), helmet and visor, mirrors
    rod(tag + "_halo_pillar", (1.05, 0, 0.72), (0.95, 0, 0.95), 0.03, carbon, body)
    prev = None
    for k in range(13):
        ang = math.pi * k / 12
        pnt = Vector((0.95 - 0.55 * math.sin(ang), 0.34 * math.cos(ang), 0.95 - 0.06 * math.sin(ang)))
        if prev is not None:
            rod(tag + "_halo", prev, pnt, 0.028, carbon, body)
        prev = pnt
    hm = bpy.data.meshes.new(tag + "_helmet")
    bmh = bmesh.new()
    bmesh.ops.create_uvsphere(bmh, u_segments=24, v_segments=12, radius=0.17)
    for f in bmh.faces:
        f.smooth = True
    bmh.to_mesh(hm)
    h = link(bpy.data.objects.new(tag + "_helmet", hm))
    h.data.materials.append(helmet)
    h.location = (0.45, 0, 0.86)
    h.parent = body
    plate(tag + "_visor", (0.06, 0.24, 0.06), (0.6, 0, 0.88), material(tag + "_visorm", (0.01, 0.01, 0.02), 0.05, metal=0.5, alpha=a), body, bevel=0.02)
    for sgn in (-1, 1):
        rod(tag + f"_mirstem{sgn}", (0.85, sgn * 0.42, 0.62), (0.9, sgn * 0.5, 0.78), 0.012, carbon, body)
        plate(tag + f"_mirror{sgn}", (0.06, 0.16, 0.08), (0.9, sgn * 0.54, 0.8), paint, body, bevel=0.015)
    # wheels with suspension arms
    wheels = {}
    for nm, x, y, front in (("fl", 2.05, 0.82, True), ("fr", 2.05, -0.82, True), ("rl", -1.6, 0.8, False), ("rr", -1.6, -0.8, False)):
        steer = link(bpy.data.objects.new(f"{tag}_{nm}_steer", None))
        steer.parent = root
        steer.location = (x, y, 0)
        wheels[nm] = (steer, wheel(f"{tag}_{nm}", 0, 0, front, mats, steer))
        cx0 = x - 0.05 if front else x + 0.05
        for dz in (0.26, 0.5):
            for dx in (-0.18, 0.18):
                rod(f"{tag}_arm", (cx0 + dx, math.copysign(0.3, y), dz), (x, y - math.copysign(0.12, y), 0.36 + (dz - 0.38) * 0.4), 0.014, carbon, body)
    # car number on the nose, white
    cu = bpy.data.curves.new(tag + "_num", "FONT")
    cu.body = str(lap["number"])
    cu.size = 0.22
    cu.align_x = "CENTER"
    for sgn in (-1, 1):
        tx = link(bpy.data.objects.new(tag + "_num", cu))
        tx.data.materials.append(material(tag + "_white", (0.95, 0.95, 0.95), 0.4, alpha=a))
        tx.parent = body
        tx.location = (2.3, sgn * 0.2, 0.33)
        tx.rotation_euler = (math.pi / 2, 0, 0 if sgn > 0 else math.pi)
    return root, wheels


# ---------------------------------------------------------------- a real 2026 car model
# GHOST_MODEL: a .glb of a livery-free 2026-regulation car (e.g. "F1 2026
# concept" by Qvist_designs, CC BY 4.0: credit it). It comes as one grey CAD
# mesh in millimetres, nose to -X; here it is scaled, turned nose-forward,
# lightened, its four wheels cut out to spin (the fronts also steer), and
# painted by zones in the team's colours. Colours and layout only: no team or
# sponsor logos, which are trademarks.
LIVERY = {
    # primary (upper body), secondary (lower body, sidepods), wing, accent (stripe), [wing flaps and endplates]
    "McLaren": ("#ff7a00", "#1c1d21", "#1c1d21", "#ff7a00"),
    "Mercedes": ("#c6cbd1", "#0c0d0f", "#0c0d0f", "#27f4d2", "#0c0d0f"),
    "Ferrari": ("#d40010", "#d40010", "#111111", "#f4f4f4"),
    "Red Bull Racing": ("#1b2a5b", "#1b2a5b", "#121a33", "#e10600"),
    "Racing Bulls": ("#f2f2f5", "#1d4ed8", "#111111", "#e10600"),
    "Aston Martin": ("#006f62", "#006f62", "#111111", "#cedc00"),
    "Williams": ("#1868db", "#0b1b3f", "#0b1b3f", "#00a3e0"),
    "Alpine": ("#ff87bc", "#0a54c1", "#111111", "#ffffff"),
    "Haas F1 Team": ("#f0f0f0", "#111111", "#111111", "#e10600"),
    "Audi": ("#a0a5ab", "#111111", "#111111", "#f50537"),
    "Cadillac": ("#111111", "#c9a227", "#111111", "#f4f4f4"),
}


def livery_of(lap):
    """(primary, secondary, wing, accent, endplates) of the lap's team."""
    for k, v in LIVERY.items():
        if k.lower() in lap["team"].lower() or lap["team"].lower() in k.lower():
            return v if len(v) == 5 else (*v, v[3])
    c = lap["colour"]
    return (c, "#1a1a1a", "#111111", "#f4f4f4", "#f4f4f4")


MODEL_MESH = None


def model_mesh():
    """The model, imported once: joined, in metres, nose to +X, lightened."""
    global MODEL_MESH
    if MODEL_MESH:
        return MODEL_MESH
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.environ["GHOST_MODEL"])
    obs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    for o in obs:  # keep the importer's parent rotation (glTF is Y-up) before dropping the parents
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in bpy.data.objects:
        if o not in before and o.type != "MESH":
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data
    mat = Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Scale(0.001, 4)
    me.transform(mat)
    zs_ = [v.co.z for v in me.vertices]
    xs_ = [v.co.x for v in me.vertices]
    me.transform(Matrix.Translation((-(max(xs_) + min(xs_)) / 2 + 0.25, 0, -min(zs_))))
    dec = ob.modifiers.new("lighter", "DECIMATE")
    dec.ratio = float(os.environ.get("GHOST_DECIMATE", "0.4"))
    bpy.ops.object.modifier_apply(modifier=dec.name)
    col.objects.unlink(ob) if ob.name in col.objects else None
    MODEL_MESH = ob.data
    return MODEL_MESH


def livery_paint(name, primary, secondary, accent, front_x):
    """Body paint split by height in the car's own space, so the line between
    the colours runs straight and clean whatever the mesh's triangles: the
    secondary colour below, a thin accent stripe, the primary above. The line
    sits low on the nose and steps up to the sidepods' shoulder behind it."""
    m = material(name, primary, 0.3, metal=0.2, coat=0.35)  # today's cars are satin, not gloss
    nt = m.node_tree
    bs = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    split = nt.nodes.new("ShaderNodeMapRange")  # x -> height of the line
    split.inputs["From Min"].default_value = front_x - 1.0
    split.inputs["From Max"].default_value = front_x - 0.5
    split.inputs["To Min"].default_value = 0.5
    split.inputs["To Max"].default_value = 0.32
    nt.links.new(sep.outputs["X"], split.inputs["Value"])
    d = nt.nodes.new("ShaderNodeMath")
    d.operation = "SUBTRACT"
    nt.links.new(sep.outputs["Z"], d.inputs[0])
    nt.links.new(split.outputs["Result"], d.inputs[1])
    off = nt.nodes.new("ShaderNodeMath")
    off.operation = "ADD"
    off.inputs[1].default_value = 0.5
    nt.links.new(d.outputs["Value"], off.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (*secondary, 1)
    els[1].position, els[1].color = 0.5, (*primary, 1)
    nt.links.new(off.outputs["Value"], ramp.inputs["Fac"])
    # the stripe: within 22 mm of the line, on the car's sides only
    near = nt.nodes.new("ShaderNodeMath")
    near.operation = "COMPARE"
    near.inputs[1].default_value = 0.0
    near.inputs[2].default_value = 0.022
    nt.links.new(d.outputs["Value"], near.inputs[0])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    to_obj = nt.nodes.new("ShaderNodeVectorTransform")
    to_obj.vector_type = "NORMAL"
    to_obj.convert_from, to_obj.convert_to = "WORLD", "OBJECT"
    nt.links.new(geo.outputs["Normal"], to_obj.inputs["Vector"])
    nsep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(to_obj.outputs["Vector"], nsep.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeMath")
    nz.operation = "ABSOLUTE"
    nt.links.new(nsep.outputs["Z"], nz.inputs[0])
    side = nt.nodes.new("ShaderNodeMath")
    side.operation = "LESS_THAN"
    side.inputs[1].default_value = 0.6
    nt.links.new(nz.outputs["Value"], side.inputs[0])
    both = nt.nodes.new("ShaderNodeMath")
    both.operation = "MULTIPLY"
    nt.links.new(near.outputs["Value"], both.inputs[0])
    nt.links.new(side.outputs["Value"], both.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = (*accent, 1)
    nt.links.new(ramp.outputs["Color"], mix.inputs["A"])
    nt.links.new(both.outputs["Value"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bs.inputs["Base Color"])
    return m


def wing_paint(name, base, flaps):
    """Front wing: dark planes, the upper flaps and the endplates in the
    accent colour, split in the shader for clean edges."""
    m = material(name, base, 0.35, metal=0.2)
    nt = m.node_tree
    bs = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    hi = nt.nodes.new("ShaderNodeMath")
    hi.operation = "GREATER_THAN"
    hi.inputs[1].default_value = 0.24
    nt.links.new(sep.outputs["Z"], hi.inputs[0])
    ay = nt.nodes.new("ShaderNodeMath")
    ay.operation = "ABSOLUTE"
    nt.links.new(sep.outputs["Y"], ay.inputs[0])
    out = nt.nodes.new("ShaderNodeMath")
    out.operation = "GREATER_THAN"
    out.inputs[1].default_value = 0.82
    nt.links.new(ay.outputs["Value"], out.inputs[0])
    either = nt.nodes.new("ShaderNodeMath")
    either.operation = "MAXIMUM"
    nt.links.new(hi.outputs["Value"], either.inputs[0])
    nt.links.new(out.outputs["Value"], either.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*base, 1)
    mix.inputs["B"].default_value = (*flaps, 1)
    nt.links.new(either.outputs["Value"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bs.inputs["Base Color"])
    return m


def model_car(tag, lap):
    primary, secondary, wing, accent, ends = (srgb(c) for c in livery_of(lap))
    paint = lambda nm, c, coat=0.9: material(f"{tag}_{nm}", c, 0.22, metal=0.25, coat=coat)
    mats = [paint("primary", primary), paint("secondary", secondary), material(tag + "_wing", wing, 0.35, metal=0.2),
            paint("accent", ends), noisy(tag + "_carbon", (0.008, 0.008, 0.009), (0.02, 0.02, 0.023), 60.0, 0.55),
            material(tag + "_tyre", (0.015, 0.015, 0.016), 0.85), material(tag + "_rim", (0.06, 0.06, 0.07), 0.3, metal=0.9),
            material(tag + "_band", srgb("#43b02a" if WET else "#e0141e"), 0.5)]  # intermediate green, soft red
    P, S, WG, AC, CB, TY, RM, BD, FW = range(9)
    me = model_mesh().copy()
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    # the wheels: only the tyres reach this far out this high up (the wings'
    # endplates sit lower, the sidepods further in); the caps above half
    # height are symmetric about the axle, which gives each wheel's x; its
    # own top and bottom edge straight through that axle give z and the radius
    tyre_v = [v.co.copy() for v in bm.verts if abs(v.co.y) > 0.88 and v.co.z > 0.5]
    xs_t = sorted(v.x for v in tyre_v)
    gap = max(range(1, len(xs_t)), key=lambda i: xs_t[i] - xs_t[i - 1])
    mid = (xs_t[gap - 1] + xs_t[gap]) / 2
    centres, radii = {}, {}
    for nm, front, sy in (("fl", True, 1), ("fr", True, -1), ("rl", False, 1), ("rr", False, -1)):
        pts = [v for v in tyre_v if (v.x > mid) == front and (v.y > 0) == (sy > 0)]
        cx = (max(p.x for p in pts) + min(p.x for p in pts)) / 2
        col_z = [v.co.z for v in bm.verts if abs(v.co.x - cx) < 0.04 and abs(v.co.y) > 0.6 and (v.co.y > 0) == (sy > 0)
                 and (v.co.z > 0.5 or v.co.z < 0.05)]
        cz, r = (max(col_z) + min(col_z)) / 2, (max(col_z) - min(col_z)) / 2
        inner = [abs(v.co.y) for v in bm.verts if (v.co.y > 0) == (sy > 0) and v.co.z > cz + r * 0.6 and abs(v.co.x - cx) < r * 0.5]
        cy = sy * (min(y for y in inner if y > 0.5) + max(inner)) / 2
        centres[nm] = Vector((cx, cy, cz))
        radii[nm] = r
    if os.environ.get("GHOST_DEBUG"):
        print("WHEELS", {k: tuple(round(c, 3) for c in v) for k, v in centres.items()}, {k: round(v, 3) for k, v in radii.items()})
    front_x = (centres["fl"].x + centres["fr"].x) / 2
    rear_x = (centres["rl"].x + centres["rr"].x) / 2
    wheel_faces = {k: [] for k in centres}
    for f in bm.faces:
        c = f.calc_center_median()
        for nm, wc in centres.items():
            if abs(c.y - wc.y) < 0.26 and math.hypot(c.x - wc.x, c.z - wc.z) < radii[nm] * 1.05:
                r = math.hypot(c.x - wc.x, c.z - wc.z) / radii[nm]
                f.material_index = TY if r > 0.68 else (BD if r > 0.6 and abs(c.y) > abs(wc.y) + 0.12 else RM)
                wheel_faces[nm].append(f)
                break
        else:
            x, y, z = c.x, abs(c.y), c.z
            if z < 0.07:
                f.material_index = CB  # floor
            elif x > front_x + 0.35 and z < 0.42:  # front wing: black planes, coloured flaps and endplates
                f.material_index = FW
            elif x < rear_x - 0.25 and z > 0.5:  # rear wing
                f.material_index = AC if y > 0.43 else WG
            elif z > 0.82 and front_x - 1.9 < x < front_x - 0.9:
                f.material_index = CB  # halo
            else:
                f.material_index = P  # the body: colours split in the shader
    mats[P] = livery_paint(tag + "_livery", primary, secondary, accent, front_x)
    mats.append(wing_paint(tag + "_frontwing", wing, ends))
    root = link(bpy.data.objects.new(tag, None))
    # body = everything but the wheels; each wheel its own object around its axle
    wheel_set = {f for fs in wheel_faces.values() for f in fs}
    body_bm = bm.copy()
    body_bm.faces.ensure_lookup_table()
    bmesh.ops.delete(body_bm, geom=[body_bm.faces[f.index] for f in wheel_set], context="FACES")
    body_me = bpy.data.meshes.new(tag + "_body")
    body_bm.to_mesh(body_me)
    for m in mats:
        body_me.materials.append(m)
    body = link(bpy.data.objects.new(tag + "_body", body_me))
    body.parent = root
    for poly in body_me.polygons:
        poly.use_smooth = True
    wheels = {}
    for nm, fs in wheel_faces.items():
        wb = bm.copy()
        wb.faces.ensure_lookup_table()
        keep = {f.index for f in fs}
        bmesh.ops.delete(wb, geom=[f for f in wb.faces if f.index not in keep], context="FACES")
        wc = centres[nm]
        bmesh.ops.translate(wb, verts=wb.verts, vec=-wc)
        wme = bpy.data.meshes.new(f"{tag}_{nm}")
        wb.to_mesh(wme)
        for m in mats:
            wme.materials.append(m)
        for poly in wme.polygons:
            poly.use_smooth = True
        steer = link(bpy.data.objects.new(f"{tag}_{nm}_steer", None))
        steer.parent = root
        steer.location = wc
        hub = link(bpy.data.objects.new(f"{tag}_{nm}", wme))
        hub.parent = steer
        wheels[nm] = (steer, hub)
    # the car number, white on the nose
    cu = bpy.data.curves.new(tag + "_num", "FONT")
    cu.body = str(lap["number"])
    cu.size = 0.2
    cu.align_x = "CENTER"
    for sgn in (-1, 1):
        tx = link(bpy.data.objects.new(tag + "_num", cu))
        tx.data.materials.append(material(tag + "_white", (0.95, 0.95, 0.95), 0.4))
        tx.parent = root
        tx.location = (front_x + 0.15, sgn * 0.13, 0.36)
        tx.rotation_euler = (math.pi / 2, 0, 0 if sgn > 0 else math.pi)
    return root, wheels


if os.environ.get("GHOST_MODEL"):
    CAR_A, WHEELS_A = model_car("carA", A)
    CAR_B, WHEELS_B = model_car("carB", B)
else:
    CAR_A, WHEELS_A = build_car("carA", A, False)
    CAR_B, WHEELS_B = build_car("carB", B, True)


# ---------------------------------------------------------------- light and sky
sun = link(bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")))
sun.data.energy = 0.9 if WET else 3.6
sun.data.angle = math.radians(25 if WET else 1.5)  # cloud: soft, faint shadows
sun.rotation_euler = (math.radians(42), math.radians(8), math.radians(140))
world = bpy.data.worlds.new("world")
sc.world = world
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes["Background"]
if WET:  # low grey cloud, lighter towards the horizon
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.30, 0.32, 0.35, 1)
    ramp.color_ramp.elements[1].color = (0.12, 0.13, 0.15, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.6
else:
    try:
        sky = nt.nodes.new("ShaderNodeTexSky")
        sky.sun_elevation = math.radians(48)
        sky.sun_rotation = math.radians(140)
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.22
    except Exception:
        bg.inputs["Color"].default_value = (0.35, 0.5, 0.7, 1)


# ---------------------------------------------------------------- animation
def heading(path, t):
    st = path.s_at(t)
    d = path.point(st + 2.0) - path.point(st - 2.0)
    return math.atan2(d.y, d.x), -math.atan2(d.z, max(0.01, math.hypot(d.x, d.y)))


def progress_of(path, t):
    p = path.at(t)
    _, i, _ = kd.find(Vector((p.x, p.y, 0)))
    return i


def pose(root, wheels, path, t, spin):
    p = path.at(t)
    yaw, pitch = heading(path, t)
    root.location = p
    root.rotation_euler = (0, pitch, yaw)
    # front-wheel steer from the yaw rate (bicycle model, wheelbase 3.65 m)
    y0, _ = heading(path, t - 0.15)
    y1, _ = heading(path, t + 0.15)
    dyaw = (y1 - y0 + math.pi) % (2 * math.pi) - math.pi
    speed = max(5.0, path.car(t, "speed") / 3.6)
    steer = max(-0.35, min(0.35, math.atan(3.65 * (dyaw / 0.3) / speed)))
    for nm, (st, hub) in wheels.items():
        st.rotation_euler = (0, 0, steer if nm in ("fl", "fr") else 0)
        hub.rotation_euler = (0, spin, 0)


def unwrap(prev, cur):
    while cur - prev > math.pi:
        cur -= 2 * math.pi
    while cur - prev < -math.pi:
        cur += 2 * math.pi
    return cur


cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 30
cam_data.shift_y = -0.14  # the cars sit in the upper middle, clear of the data panels at the bottom
cam_data.clip_end = 6000
cam = link(bpy.data.objects.new("cam", cam_data))
sc.camera = cam

t_end = max(A["duration"], B["duration"]) + LEAD_OUT
times = [STILL] if STILL is not None else [-LEAD_IN + f / FPS for f in range(int((t_end + LEAD_IN) * FPS) + 1)]
spin_a = spin_b = 0.0
cam_pos = cam_look = None
prev_rot = {}
for f, t in enumerate(times):
    frame = f + 1
    sc.frame_set(frame)
    if f:
        spin_a -= PA.car(t, "speed") / 3.6 / FPS / 0.36
        spin_b -= PB.car(t, "speed") / 3.6 / FPS / 0.36
    pose(CAR_A, WHEELS_A, PA, t, spin_a)
    pose(CAR_B, WHEELS_B, PB, t, spin_b)
    # camera: behind the car that is behind, looking past the one ahead
    ia, ib = progress_of(PA, t), progress_of(PB, t)
    ahead_a = ((ia - ib + N // 2) % N) - N // 2 >= 0
    back, front = (PB, PA) if ahead_a else (PA, PB)
    bp = back.at(t)
    byaw, _ = heading(back, t)
    bdir = Vector((math.cos(byaw), math.sin(byaw), 0))
    want_pos = bp - bdir * 11.5 + Vector((0, 0, 4.0))
    want_look = (bp + front.at(t)) / 2 + bdir * 9 + Vector((0, 0, 0.6))
    k = 1.0 if cam_pos is None else 0.22  # smooth the camera between frames
    cam_pos = want_pos if cam_pos is None else cam_pos.lerp(want_pos, k)
    cam_look = want_look if cam_look is None else cam_look.lerp(want_look, k)
    cam.location = cam_pos
    cam.rotation_euler = (cam_look - cam_pos).to_track_quat("-Z", "Y").to_euler()
    objs = [CAR_A, CAR_B, cam] + [o for w in (WHEELS_A, WHEELS_B) for st, hub in w.values() for o in (st, hub)]
    for ob in objs:
        r = ob.rotation_euler.copy()
        if ob.name in prev_rot:  # keep angles continuous so motion blur doesn't spin
            pr = prev_rot[ob.name]
            r = type(r)((unwrap(pr[0], r[0]), unwrap(pr[1], r[1]), unwrap(pr[2], r[2])))
            ob.rotation_euler = r
        prev_rot[ob.name] = tuple(r)
        if STILL is None:
            ob.keyframe_insert("location", frame=frame)
            ob.keyframe_insert("rotation_euler", frame=frame)

if STILL is None:
    for ob in bpy.data.objects:
        if ob.animation_data and ob.animation_data.action:
            act = ob.animation_data.action
            curves = getattr(act, "fcurves", None)
            if curves is None:  # Blender 5: layered actions
                curves = [c for layer in act.layers for strip_ in layer.strips for bag in strip_.channelbags for c in bag.fcurves]
            for fc in curves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
    sc.frame_start, sc.frame_end = 1, len(times)
    sc.render.filepath = os.path.join(OUT, "")
    sc.render.image_settings.file_format = "PNG"
    with open(os.path.join(OUT, "frames.json"), "w") as fh:
        json.dump({"fps": FPS, "lead_in": LEAD_IN, "frames": len(times)}, fh)
    bpy.ops.render.render(animation=True)
else:
    if os.environ.get("GHOST_CLOSE"):  # a close look for checking the livery: GHOST_CLOSE=[b:]<degrees around car A or B>
        which, _, deg = os.environ["GHOST_CLOSE"].rpartition(":")
        pc = PB if which == "b" else PA
        ap = pc.at(STILL)
        ayaw, _ = heading(pc, STILL)
        ang = ayaw + math.radians(float(deg))
        cam_data.shift_y = 0
        cam.location = ap + Vector((math.cos(ang) * 6.5, math.sin(ang) * 6.5, 1.8))
        cam.rotation_euler = (ap + Vector((0, 0, 0.45)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.use_motion_blur = False
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
print("DONE", len(times))
