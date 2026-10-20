# PayWatch SaaS promo — code-driven motion graphics renderer (pycairo -> ffmpeg)
import cairo, math, subprocess, sys, os
import numpy as np

W, H, FPS = 1920, 1080, 30
DIR = os.path.dirname(os.path.abspath(__file__))
PREVIEW = '--preview' in sys.argv  # render a few stills only

def hexc(h, a=1.0):
    h = h.lstrip('#'); return (int(h[0:2], 16)/255, int(h[2:4], 16)/255, int(h[4:6], 16)/255, a)

PINE950, PINE900, PINE800, PINE700 = '#07211D', '#0B2F2A', '#10403A', '#16544B'
MINT, MINT300, MINT100 = '#2FBC9B', '#83DEC7', '#DFF5EE'
PAPER, PAPER100, PAPER200 = '#F7F5F0', '#F2EFE8', '#E7E2D6'
INK, INKSOFT, INKFAINT = '#1A2421', '#48544F', '#7C8782'
RED, AMBER, WHITE = '#E5484D', '#F5A524', '#FFFFFF'

# ---------- easing ----------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, t0, d): return clamp((t - t0) / d) if d > 0 else (1.0 if t >= t0 else 0.0)
def eo_cubic(p): return 1 - (1 - p) ** 3
def eo_expo(p): return 1.0 if p >= 1 else 1 - 2 ** (-10 * p)
def eio_cubic(p): return 4*p*p*p if p < .5 else 1 - (-2*p + 2) ** 3 / 2
def eo_back(p, s=1.7):
    p -= 1; return p*p*((s+1)*p + s) + 1
def lerp(a, b, p): return a + (b - a) * p

# ---------- drawing helpers ----------
def setc(ctx, h, a=1.0):
    r, g, b, aa = hexc(h, a); ctx.set_source_rgba(r, g, b, aa)

def rrect(ctx, x, y, w, h, r):
    r = min(r, w/2, h/2)
    ctx.new_sub_path()
    ctx.arc(x+w-r, y+r, r, -math.pi/2, 0); ctx.arc(x+w-r, y+h-r, r, 0, math.pi/2)
    ctx.arc(x+r, y+h-r, r, math.pi/2, math.pi); ctx.arc(x+r, y+r, r, math.pi, 1.5*math.pi)
    ctx.close_path()

def shadow(ctx, x, y, w, h, r, a=0.18, spread=26, dy=18):
    for i in range(10):
        k = i/9
        rrect(ctx, x - spread*k + 0, y - spread*k + dy, w + 2*spread*k, h + 2*spread*k, r + spread*k)
        ctx.set_source_rgba(0, 0, 0, a*(1-k)**2/4); ctx.fill()

def card(ctx, x, y, w, h, r=28, fill=WHITE, a=1.0, sh=True):
    if sh: shadow(ctx, x, y, w, h, r, a=0.22*a)
    rrect(ctx, x, y, w, h, r); setc(ctx, fill, a); ctx.fill()

FONTS = {}
def font(ctx, name, size):
    ctx.select_font_face(name, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL); ctx.set_font_size(size)

from fontTools.ttLib import TTFont
_CMAPS = {}
def has_glyph(fname, ch):
    if fname not in _CMAPS:
        p = os.path.expanduser(f'~/.fonts/{fname}.ttf')
        _CMAPS[fname] = set(TTFont(p).getBestCmap().keys()) if os.path.exists(p) else None
    cm = _CMAPS[fname]
    return True if cm is None else (ord(ch) in cm)

def runs(s, fname):
    """Split into runs; glyphs missing from the brand font (₹ ✓ ▲ …) fall back to DejaVu Sans."""
    out, cur, curf = [], '', None
    for ch in s:
        f = fname if (ch == ' ' or has_glyph(fname, ch)) else 'DejaVu Sans'
        if f != curf and cur: out.append((cur, curf)); cur = ''
        cur += ch; curf = f
    if cur: out.append((cur, curf))
    return out

def text_w(ctx, s, fname, size, track=0):
    w = 0
    for seg, f in runs(s, fname):
        font(ctx, f, size * (0.86 if f == 'DejaVu Sans' else 1)); w += ctx.text_extents(seg).x_advance
    return w + track * max(0, len(s)-1)

def text(ctx, s, x, y, fname, size, color, a=1.0, align='left', track=0):
    w = text_w(ctx, s, fname, size, track)
    if align == 'center': x -= w/2
    elif align == 'right': x -= w
    setc(ctx, color, a)
    for seg, f in runs(s, fname):
        font(ctx, f, size * (0.86 if f == 'DejaVu Sans' else 1))
        if track:
            for ch in seg:
                ctx.move_to(x, y); ctx.show_text(ch); x += ctx.text_extents(ch).x_advance + track
        else:
            ctx.move_to(x, y); ctx.show_text(seg); x += ctx.text_extents(seg).x_advance
    return w

SANS5, SANS6, SANS7, SANS8 = 'PWManrope500', 'PWManrope600', 'PWManrope700', 'PWManrope800'
SERIF, SERIFB, SERIFI = 'PWFraunces500', 'PWFraunces700', 'PWFrauncesItalic500'

def kinetic(ctx, words, x, y, size, t, start, stagger=0.07, dur=0.55, align='left', rise=34, out_t=None):
    """words: list of (text, font, color). Each word rises + fades in, staggered."""
    space = size * 0.26
    widths = [text_w(ctx, w, f, size) for w, f, c in words]
    total = sum(widths) + space * (len(words)-1)
    cx = x - total/2 if align == 'center' else x
    for i, (w, f, c) in enumerate(words):
        p = eo_expo(prog(t, start + i*stagger, dur))
        a = p
        if out_t is not None:
            q = eio_cubic(prog(t, out_t + i*0.02, 0.35)); a *= (1-q)
        if a > 0.001:
            ctx.save(); text(ctx, w, cx, y + rise*(1-p), f, size, c, a); ctx.restore()
        cx += widths[i] + space
    return total

def eyebrow(ctx, s, x, y, a=1.0, color=MINT):
    text(ctx, s.upper(), x, y, SANS8, 20, color, a, track=4)

def logo_mark(ctx, cx, cy, size, pbg=1.0, pbars=(1, 1, 1), bg=MINT, fg=PINE900):
    u = size / 100
    s = eo_back(clamp(pbg), 1.6) if pbg < 1 else 1
    if s <= 0: return
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-size/2, -size/2)
    rrect(ctx, 2*u, 2*u, 96*u, 96*u, 26*u); setc(ctx, bg); ctx.fill()
    bars = [(21.5, 26), (42.5, 40), (63.5, 54)]
    for (bx, bh), p in zip(bars, pbars):
        p = eo_back(clamp(p), 1.3) if p < 1 else 1
        if p <= 0: continue
        h = bh * p
        rrect(ctx, bx*u, (76 - h)*u, 15*u, h*u, 4.5*u); setc(ctx, fg); ctx.fill()
    ctx.restore()

def wordmark(ctx, x, y, size, a=1.0, color=PAPER, align='left'):
    w1 = text_w(ctx, 'Pay', SERIFB, size); w2 = text_w(ctx, 'Watch', SERIFI, size)
    if align == 'center': x -= (w1 + w2)/2
    text(ctx, 'Pay', x, y, SERIFB, size, color, a); text(ctx, 'Watch', x + w1 - size*0.06, y, SERIFI, size, color, a)
    return w1 + w2

def aurora(ctx, t, base=PINE950, a=1.0):
    g = cairo.LinearGradient(0, 0, W, H)
    g.add_color_stop_rgba(0, *hexc(PINE900)); g.add_color_stop_rgba(1, *hexc(base))
    ctx.set_source(g); ctx.paint()
    blobs = [(0.22, 0.30, 620, MINT, 0.20, 0.13), (0.82, 0.72, 700, '#258274', 0.30, 0.09), (0.70, 0.18, 480, MINT300, 0.12, 0.17)]
    for i, (bx, by, r, c, al, sp) in enumerate(blobs):
        x = W*bx + math.sin(t*sp*2 + i*2) * 120; y = H*by + math.cos(t*sp*1.6 + i) * 80
        rg = cairo.RadialGradient(x, y, 0, x, y, r)
        rg.add_color_stop_rgba(0, *hexc(c, al*a)); rg.add_color_stop_rgba(1, *hexc(c, 0))
        ctx.set_source(rg); ctx.paint()
    # subtle grid dots
    setc(ctx, WHITE, 0.035 * a)
    for gx in range(0, W, 48):
        for gy in range(0, H, 48):
            ctx.rectangle(gx, gy, 2, 2)
    ctx.fill()

def paper_bg(ctx, t):
    setc(ctx, PAPER); ctx.paint()
    rg = cairo.RadialGradient(W*0.75, H*0.4, 0, W*0.75, H*0.4, 900)
    rg.add_color_stop_rgba(0, *hexc(MINT100, 0.9)); rg.add_color_stop_rgba(1, *hexc(MINT100, 0))
    ctx.set_source(rg); ctx.paint()

def wipe(ctx, p):
    """Diagonal mint+pine panel sweep. Fully covers screen at p=0.5."""
    if p <= 0 or p >= 1: return
    e = eio_cubic(p)
    off = lerp(-W*1.6, W*1.6, e)
    for col, lag in ((MINT, 0.0), (PINE900, 180)):
        ctx.save(); ctx.translate(off - lag, 0)
        ctx.move_to(-300, 0); ctx.line_to(W + 300, 0); ctx.line_to(W, H); ctx.line_to(-600, H); ctx.close_path()
        setc(ctx, col); ctx.fill(); ctx.restore()

# ---------- video clip source ----------
class Clip:
    def __init__(self, path):
        self.path = path; self.proc = None; self.frame = None
        self.surf = None
    def open(self):
        self.proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', self.path, '-vf',
            f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}',
            '-f', 'rawvideo', '-pix_fmt', 'bgra', '-'], stdout=subprocess.PIPE)
    def next(self):
        if self.proc is None: self.open()
        buf = self.proc.stdout.read(W*H*4)
        if len(buf) == W*H*4:
            self.frame = bytearray(buf)
            self.surf = cairo.ImageSurface.create_for_data(self.frame, cairo.FORMAT_ARGB32, W, H, W*4)
        return self.surf

def draw_clip(ctx, clip, lt, dur, zoom=(1.0, 1.08), dark=0.0):
    s = clip.next()
    if s is None: return
    z = lerp(zoom[0], zoom[1], lt/dur)
    ctx.save(); ctx.translate(W/2, H/2); ctx.scale(z, z); ctx.translate(-W/2, -H/2)
    ctx.set_source_surface(s, 0, 0); ctx.paint(); ctx.restore()
    # cinematic grade: bottom gradient + vignette
    g = cairo.LinearGradient(0, H*0.35, 0, H)
    g.add_color_stop_rgba(0, 0, 0, 0, 0); g.add_color_stop_rgba(1, *hexc(PINE950, 0.88))
    ctx.set_source(g); ctx.paint()
    if dark: ctx.set_source_rgba(0, 0, 0, dark); ctx.paint()
    vg = cairo.RadialGradient(W/2, H/2, H*0.45, W/2, H/2, W*0.75)
    vg.add_color_stop_rgba(0, 0, 0, 0, 0); vg.add_color_stop_rgba(1, 0, 0, 0, 0.45)
    ctx.set_source(vg); ctx.paint()
    # letterbox bars
    ctx.set_source_rgba(0, 0, 0, 1); ctx.rectangle(0, 0, W, 54); ctx.rectangle(0, H-54, W, 54); ctx.fill()

# ---------- scenes ----------
# each scene: fn(ctx, lt, dur)
CLIPS = {}

NOTIFS = [
    ('BANK', 'Debited ₹2,499', 'Food delivery · Available bal ₹11,240', RED),
    ('CREDIT CARD', 'Bill of ₹48,210 due in 3 days', 'Minimum due ₹2,410', AMBER),
    ('LOAN', 'EMI ₹18,400 auto-debit tomorrow', 'Keep sufficient balance', AMBER),
    ('INCOME TAX', 'ITR filing deadline approaching', 'Have you filed your return?', RED),
    ('INSURANCE', 'Your health policy expires in 7 days', 'Renew to stay covered', AMBER),
    ('BANK', 'Debited ₹1,299', 'Subscription renewal', RED),
    ('INVESTMENTS', 'Markets down 2.1% today', 'Your portfolio: −₹8,930', RED),
    ('BANK', 'Debited ₹6,750', 'Shopping · Available bal ₹4,490', RED),
]

def notif_card(ctx, cx, cy, n, a, rot=0.0, s=1.0):
    src, t1, t2, col = n
    w, h = 720, 132
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s)
    shadow(ctx, -w/2, -h/2, w, h, 30, a=0.35*a)
    rrect(ctx, -w/2, -h/2, w, h, 30); ctx.set_source_rgba(0.96, 0.96, 0.95, 0.96*a); ctx.fill()
    rrect(ctx, -w/2+26, -h/2+28, 76, 76, 20); setc(ctx, col, 0.16*a); ctx.fill()
    text(ctx, '!', -w/2+64, -h/2+82, SANS8, 40, col, a, 'center')
    text(ctx, src, -w/2+124, -h/2+44, SANS8, 17, INKFAINT, a, track=2)
    text(ctx, 'now', w/2-28, -h/2+44, SANS6, 17, INKFAINT, a, 'right')
    text(ctx, t1, -w/2+124, -h/2+82, SANS8, 27, INK, a)
    text(ctx, t2, -w/2+124, -h/2+114, SANS5, 21, INKSOFT, a)
    ctx.restore()

def notif_scene(ctx, T, chaos=0.0):
    """Notifications piling up — the money-anxiety opener (no-clip fallback)."""
    g = cairo.LinearGradient(0, 0, W, H); g.add_color_stop_rgba(0, 0.03, 0.06, 0.07, 1); g.add_color_stop_rgba(1, 0.01, 0.02, 0.03, 1)
    ctx.set_source(g); ctx.paint()
    rg = cairo.RadialGradient(W*0.68, H*0.45, 0, W*0.68, H*0.45, 700)
    rg.add_color_stop_rgba(0, 0.35, 0.45, 0.75, 0.22); rg.add_color_stop_rgba(1, 0, 0, 0, 0)
    ctx.set_source(rg); ctx.paint()
    notif_cards(ctx, T, chaos)
    g2 = cairo.LinearGradient(0, H*0.45, 0, H); g2.add_color_stop_rgba(0, 0, 0, 0, 0); g2.add_color_stop_rgba(1, *hexc(PINE950, 0.9))
    ctx.set_source(g2); ctx.paint()

def notif_cards(ctx, T, chaos=0.0, maxn=99, xc=W*0.66, alpha=1.0):
    for i, n in enumerate(NOTIFS[:maxn]):
        t0 = 0.35 + i*0.95
        p = prog(T, t0, 0.5)
        if p <= 0: continue
        e = eo_back(p, 1.5)
        depth = sum(1 for j in range(min(maxn, len(NOTIFS))) if 0.35 + j*0.95 <= T) - 1 - i  # how many came after
        y = 150 + lerp(-160, 0, e) + depth*150
        s = 1 - depth*0.03
        a = clamp(p*3) * (1 - clamp((depth-2)*1.0))
        shake = math.sin(T*40 + i)*chaos*6 if depth == 0 else 0
        rot = math.radians((i % 3 - 1) * 1.6 * chaos)
        if a > 0: notif_card(ctx, xc + shake, y + 160, n, a*alpha, rot, s)
    cnt = sum(1 for j in range(min(maxn, len(NOTIFS))) if 0.35 + j*0.95 <= T)
    if cnt:
        cx, cy = xc + 350, 245
        ctx.set_source_rgba(*hexc(RED, alpha)); ctx.new_sub_path(); ctx.arc(cx, cy, 30, 0, 2*math.pi); ctx.fill()
        text(ctx, str(cnt), cx, cy+11, SANS8, 30, WHITE, alpha, 'center')

def calm_scene(ctx, lt):
    aurora(ctx, lt + 40)
    p = eo_expo(prog(lt, 0.1, 0.9))
    x, y, w, h = 1040, 230, 700, 520
    ctx.save(); ctx.translate(0, 80*(1-p))
    card(ctx, x, y, w, h, 40, WHITE, p)
    logo_mark(ctx, x+80, y+86, 64)
    text(ctx, 'Good morning, Ananya', x+130, y+82, SANS8, 28, INK, p)
    text(ctx, 'Here’s where you stand', x+130, y+114, SANS5, 21, INKFAINT, p)
    sc = int(78*eo_cubic(prog(lt, 0.5, 1.2)))
    text(ctx, str(sc), x+60, y+290, SERIFB, 150, PINE900, p)
    text(ctx, '/100  Money Health', x+60+text_w(ctx, str(sc), SERIFB, 150)+16, y+290, SANS7, 26, INKFAINT, p)
    cp = prog(lt, 1.6, 0.5)
    if cp > 0:
        s = eo_back(cp)
        ctx.save(); ctx.translate(x+60, y+360); ctx.scale(s, s)
        rrect(ctx, 0, 0, 560, 100, 26); setc(ctx, MINT100, p); ctx.fill()
        text(ctx, '✓  You’re on track this month', 30, 62, SANS8, 30, PINE700, p)
        ctx.restore()
    ctx.restore()
    g2 = cairo.LinearGradient(0, H*0.55, 0, H); g2.add_color_stop_rgba(0, 0, 0, 0, 0); g2.add_color_stop_rgba(1, *hexc(PINE950, 0.85))
    ctx.set_source(g2); ctx.paint()

def s_clip_a(ctx, lt, dur):
    if CLIPS.get('a') is None: notif_scene(ctx, lt, 0.0)
    else:
        draw_clip(ctx, CLIPS['a'], lt, dur)
        notif_cards(ctx, lt, 0.0, maxn=4, xc=W*0.70, alpha=0.92*(1-eio_cubic(prog(lt, dur-0.4, 0.35))))
    eyebrow(ctx, 'Every month, the same question', 150, 820, eo_cubic(prog(lt, 0.4, 0.6)), MINT300)
    kinetic(ctx, [('Every', SERIF, PAPER), ('app', SERIF, PAPER), ('shows', SERIF, PAPER), ('where', SERIF, PAPER),
                  ('your', SERIF, PAPER), ('money', SERIF, PAPER), ('went.', SERIFI, MINT300)], 150, 905, 72, lt, 0.7, out_t=dur-0.35)

def s_clip_b(ctx, lt, dur):
    if CLIPS.get('b') is None: notif_scene(ctx, lt + 4.6, clamp(lt/2.5))
    else: draw_clip(ctx, CLIPS['b'], lt, dur)
    kinetic(ctx, [('None', SERIF, PAPER), ('of', SERIF, PAPER), ('them', SERIF, PAPER), ('tell', SERIF, PAPER),
                  ('you', SERIF, PAPER), ('what', SERIFI, MINT300), ('to', SERIFI, MINT300), ('do', SERIFI, MINT300), ('next.', SERIFI, MINT300)],
            150, 905, 72, lt, 0.35, out_t=dur-0.3)
    p = prog(lt, dur-0.55, 0.9); wipe(ctx, p)

def s_question(ctx, lt, dur):
    aurora(ctx, lt + 9)
    pin = prog(lt, 0, 0.0)
    eyebrow(ctx, 'So, honestly —', W/2 - text_w(ctx, 'SO, HONESTLY —', SANS8, 20, 4)/2, 400, eo_cubic(prog(lt, 0.25, 0.5)))
    kinetic(ctx, [('Are', SERIF, PAPER), ('you', SERIF, PAPER), ('on', SERIF, PAPER), ('the', SERIF, PAPER), ('right', SERIF, PAPER)],
            W/2, 540, 104, lt, 0.4, stagger=0.09, align='center', out_t=dur-0.4)
    kinetic(ctx, [('financial', SERIFI, MINT), ('track?', SERIFI, MINT)], W/2, 680, 104, lt, 0.9, stagger=0.12, align='center', out_t=dur-0.4)
    # underline sweep
    p = eo_expo(prog(lt, 1.6, 0.8)) * (1 - eio_cubic(prog(lt, dur-0.4, 0.3)))
    if p > 0:
        w = 640 * p; setc(ctx, MINT, 0.9); rrect(ctx, W/2 - 320, 712, w, 8, 4); ctx.fill()

def s_logo(ctx, lt, dur):
    aurora(ctx, lt + 12)
    # burst rings
    for i in range(3):
        p = prog(lt, 0.15 + i*0.12, 1.1)
        if 0 < p < 1:
            r = lerp(60, 520, eo_cubic(p)); setc(ctx, MINT, 0.35*(1-p)); ctx.set_line_width(3); ctx.new_sub_path(); ctx.arc(W/2, 430, r, 0, 2*math.pi); ctx.stroke()
    pb = prog(lt, 0.1, 0.7)
    bars = tuple(prog(lt, 0.55 + i*0.13, 0.55) for i in range(3))
    # mark glides up after reveal
    up = eo_cubic(prog(lt, 1.5, 0.7))
    logo_mark(ctx, W/2, lerp(500, 400, up), 230, pb, bars)
    a = eo_cubic(prog(lt, 1.6, 0.6))
    ctx.save(); ctx.translate(0, 30*(1-a)); wordmark(ctx, W/2, 640, 110, a, PAPER, 'center'); ctx.restore()
    kinetic(ctx, [('Your', SANS6, MINT300), ('private', SANS6, MINT300), ('CFO.', SANS6, MINT300), ('In', SANS6, PAPER), ('your', SANS6, PAPER), ('pocket.', SANS6, PAPER)],
            W/2, 730, 40, lt, 2.1, stagger=0.06, align='center')
    wipe(ctx, prog(lt, dur-0.55, 0.9))

def feature_frame(ctx, lt, dur, eyebrow_s, head1, head2, sub):
    paper_bg(ctx, lt)
    out = eio_cubic(prog(lt, dur-0.4, 0.4))
    ctx.save(); ctx.translate(-60*out, 0)
    a = (1 - out)
    eyebrow(ctx, eyebrow_s, 140, 380, eo_cubic(prog(lt, 0.15, 0.5)) * a)
    kinetic(ctx, head1, 140, 480, 76, lt, 0.25, stagger=0.06)
    kinetic(ctx, head2, 140, 570, 76, lt, 0.45, stagger=0.06)
    pa = eo_cubic(prog(lt, 0.8, 0.6)) * a
    y = 650
    for line in sub:
        text(ctx, line, 140, y, SANS5, 28, INKSOFT, pa); y += 42
    ctx.restore()
    if out > 0:
        setc(ctx, PAPER, out); ctx.paint()

def ui_enter(lt, delay=0.2):
    p = eo_expo(prog(lt, delay, 0.9)); return p

def s_score(ctx, lt, dur):
    feature_frame(ctx, lt, dur, '01 · Money Health Score',
        [('Know', SERIF, INK), ('exactly', SERIF, INK)], [('where', SERIF, INK), ('you', SERIF, INK), ('stand.', SERIFI, PINE700)],
        ['One score across savings, insurance,', 'debt, tax & investments — updated', 'every time you act.'])
    p = ui_enter(lt); out = eio_cubic(prog(lt, dur-0.4, 0.4))
    ctx.save(); ctx.translate(lerp(160, 0, p) - 60*out, 0); a = p*(1-out)
    x, y, w, h = 960, 170, 820, 740
    card(ctx, x, y, w, h, 36, WHITE, a)
    text(ctx, 'Money Health Score', x+56, y+86, SANS8, 30, INK, a)
    text(ctx, 'Updated just now', x+56, y+124, SANS5, 22, INKFAINT, a)
    # gauge
    gx, gy, R = x + 260, y + 370, 170
    a0, a1 = math.radians(135), math.radians(405)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.set_line_width(30)
    setc(ctx, PAPER200, a); ctx.new_sub_path(); ctx.arc(gx, gy, R, a0, a1); ctx.stroke()
    sc = 78 * eo_cubic(prog(lt, 0.7, 1.8))
    ang = a0 + (a1 - a0) * sc/100
    if sc > 0.5:
        grad = cairo.LinearGradient(gx-R, gy, gx+R, gy); grad.add_color_stop_rgba(0, *hexc(AMBER, a)); grad.add_color_stop_rgba(0.6, *hexc(MINT, a)); grad.add_color_stop_rgba(1, *hexc(PINE700, a))
        ctx.set_source(grad); ctx.new_sub_path(); ctx.arc(gx, gy, R, a0, ang); ctx.stroke()
        # glowing tip
        tx, ty = gx + R*math.cos(ang), gy + R*math.sin(ang)
        for k in range(4): setc(ctx, MINT, 0.12*a); ctx.new_sub_path(); ctx.arc(tx, ty, 16+k*7, 0, 2*math.pi); ctx.fill()
        setc(ctx, WHITE, a); ctx.new_sub_path(); ctx.arc(tx, ty, 9, 0, 2*math.pi); ctx.fill()
    text(ctx, f'{int(round(sc))}', gx, gy+38, SERIFB, 120, INK, a, 'center')
    text(ctx, '/ 100', gx, gy+88, SANS6, 24, INKFAINT, a, 'center')
    pill_a = eo_back(prog(lt, 2.4, 0.5)) if prog(lt, 2.4, 0.5) > 0 else 0
    if pill_a > 0:
        ctx.save(); ctx.translate(gx, gy+150); ctx.scale(pill_a, pill_a)
        rrect(ctx, -110, -24, 220, 48, 24); setc(ctx, MINT100, a); ctx.fill()
        text(ctx, '▲ 6 this month', 0, 9, SANS8, 22, PINE700, a, 'center'); ctx.restore()
    # dimensions
    dims = [('Savings', 86), ('Insurance', 62), ('Diversification', 74), ('Emergency fund', 91), ('Debt', 80), ('Tax efficiency', 68)]
    dx, dy = x + 500, y + 200
    for i, (n, v) in enumerate(dims):
        pp = eo_expo(prog(lt, 0.9 + i*0.12, 1.0))
        yy = dy + i*82
        text(ctx, n, dx, yy, SANS7, 21, INKSOFT, a*pp)
        text(ctx, str(int(v*pp)), dx+270, yy, SANS8, 21, INK, a*pp, 'right')
        rrect(ctx, dx, yy+14, 270, 10, 5); setc(ctx, PAPER100, a); ctx.fill()
        col = MINT if v >= 75 else (AMBER if v < 65 else '#58C5A8')
        rrect(ctx, dx, yy+14, 270*v/100*pp, 10, 5); setc(ctx, col, a); ctx.fill()
    ctx.restore()

def bubble(ctx, x, y, w, lines, fname, size, fg, bg, a, align='left', lh=1.45, pad=26, r=26, tail='left'):
    h = len(lines)*size*lh + pad*1.4
    bx = x if align == 'left' else x - w
    rrect(ctx, bx, y, w, h, r); setc(ctx, bg, a); ctx.fill()
    yy = y + pad + size*0.95
    for ln in lines:
        if not isinstance(ln, str):
            xx = bx + pad
            for seg, f, c in ln: xx += text(ctx, seg, xx, yy, f, size, c, a)
        else:
            text(ctx, ln, bx + pad, yy, fname, size, fg, a)
        yy += size*lh
    return h

def s_chat(ctx, lt, dur):
    feature_frame(ctx, lt, dur, '02 · Ask PayWatch',
        [('An', SERIF, INK), ('AI', SERIF, INK), ('CFO', SERIF, INK), ('that', SERIF, INK)], [('knows', SERIF, INK), ('your', SERIFI, PINE700), ('numbers.', SERIFI, PINE700)],
        ['Ask anything in plain language.', 'Answers come from your real data —', 'not generic internet advice.'])
    p = ui_enter(lt); out = eio_cubic(prog(lt, dur-0.4, 0.4))
    ctx.save(); ctx.translate(lerp(160, 0, p) - 60*out, 0); a = p*(1-out)
    x, y, w, h = 960, 200, 820, 660
    card(ctx, x, y, w, h, 36, WHITE, a)
    # header
    logo_mark(ctx, x+70, y+70, 52)
    text(ctx, 'Ask PayWatch', x+112, y+66, SANS8, 26, INK, a); text(ctx, '● grounded in your data', x+112, y+96, SANS6, 18, MINT, a)
    setc(ctx, PAPER200, a); ctx.rectangle(x+40, y+128, w-80, 2); ctx.fill()
    q = 'Can I afford a ₹15L car next year?'
    n = int(len(q) * prog(lt, 0.9, 1.3))
    if n > 0:
        qa = eo_cubic(prog(lt, 0.8, 0.3)) * a
        caret = '▏' if (n < len(q) and int(lt*6) % 2 == 0) else ''
        bubble(ctx, x+w-40, y+170, 540, [q[:n] + caret], SANS7, 25, WHITE, PINE900, qa, 'right')
    # typing dots
    if 2.35 < lt < 3.0:
        bx, by = x+40, y+300
        rrect(ctx, bx, by, 120, 56, 28); setc(ctx, PAPER100, a); ctx.fill()
        for i in range(3):
            bob = math.sin(lt*12 - i*0.9)*5
            setc(ctx, INKFAINT, a); ctx.new_sub_path(); ctx.arc(bx+36+i*24, by+28+bob, 6, 0, 2*math.pi); ctx.fill()
    if lt >= 3.0:
        lines = [
            [('Yes — ', SANS8, PINE700), ('with room to spare, if you plan it.', SANS6, INK)],
            [('Your monthly surplus after SIPs is ', SANS5, INKSOFT), ('₹62,000', SANS8, INK), ('.', SANS5, INKSOFT)],
            [('With 20% down, the EMI stays at ', SANS5, INKSOFT), ('14%', SANS8, INK), (' of take-home.', SANS5, INKSOFT)],
            [('Keep your ', SANS5, INKSOFT), ('₹3.6L', SANS8, INK), (' emergency fund untouched.', SANS5, INKSOFT)],
        ]
        k = prog(lt, 3.0, 1.8) * len(lines)
        shown = [ln for i, ln in enumerate(lines) if k > i]
        ba = eo_cubic(prog(lt, 3.0, 0.35)) * a
        if shown:
            hh = bubble(ctx, x+40, y+300, 700, shown, SANS5, 24, INK, MINT100, ba)
            setc(ctx, MINT, ba); rrect(ctx, x+40, y+300, 8, hh, 4); ctx.fill()
    # chips
    ca = eo_cubic(prog(lt, 5.0, 0.5)) * a
    if ca > 0:
        cx = x+40
        for c in ['Show the EMI math', 'Add as a goal', 'What about insurance?']:
            cw = text_w(ctx, c, SANS7, 20) + 40
            rrect(ctx, cx, y+h-110, cw, 50, 25); setc(ctx, PAPER200, ca); ctx.set_line_width(2); ctx.stroke()
            text(ctx, c, cx+20, y+h-78, SANS7, 20, PINE700, ca); cx += cw + 14
    ctx.restore()

def s_actions(ctx, lt, dur):
    feature_frame(ctx, lt, dur, '03 · Your action plan',
        [('Not', SERIF, INK), ('charts.', SERIF, INK)], [('Next', SERIFI, PINE700), ('moves.', SERIFI, PINE700)],
        ['Every step is ranked by priority and', 'shows the rupee impact. Tap done —', 'your score moves.'])
    p = ui_enter(lt); out = eio_cubic(prog(lt, dur-0.4, 0.4))
    ctx.save(); ctx.translate(-60*out, 0); a = (1-out)
    items = [('HIGH', RED, 'Top up your emergency fund', 'Reach 6 months of expenses', '+₹1.2L safety net'),
             ('HIGH', RED, 'Switch to the new tax regime', 'Based on your deductions', 'Save ₹38,400 / yr'),
             ('MEDIUM', AMBER, 'Raise your SIP by ₹5,000', 'Step-up keeps pace with salary', '+₹14L in 10 yrs*'),]
    x, w = 960, 820
    for i, (pr, pc, t1, t2, chip) in enumerate(items):
        pp = eo_expo(prog(lt, 0.3 + i*0.18, 0.9))
        yy = 200 + i*230
        ctx.save(); ctx.translate(lerp(220, 0, pp), 0)
        ca = pp*a
        card(ctx, x, yy, w, 200, 30, WHITE, ca)
        done = (i == 1) and lt > 2.6
        # check circle
        cxp, cyp = x+70, yy+100
        cp = eo_back(prog(lt, 2.6, 0.45)) if i == 1 else 0
        ctx.set_line_width(4); setc(ctx, PAPER200, ca); ctx.new_sub_path(); ctx.arc(cxp, cyp, 26, 0, 2*math.pi); ctx.stroke()
        if cp > 0:
            setc(ctx, MINT, ca); ctx.new_sub_path(); ctx.arc(cxp, cyp, 26*min(cp, 1.1), 0, 2*math.pi); ctx.fill()
            dp = prog(lt, 2.75, 0.3)
            ctx.set_line_width(6); ctx.set_line_cap(cairo.LINE_CAP_ROUND); setc(ctx, WHITE, ca)
            pts = [(cxp-11, cyp+1), (cxp-3, cyp+10), (cxp+13, cyp-9)]
            ctx.move_to(*pts[0])
            if dp < 0.4: ctx.line_to(lerp(pts[0][0], pts[1][0], dp/0.4), lerp(pts[0][1], pts[1][1], dp/0.4))
            else:
                ctx.line_to(*pts[1]); q = (dp-0.4)/0.6; ctx.line_to(lerp(pts[1][0], pts[2][0], q), lerp(pts[1][1], pts[2][1], q))
            ctx.stroke()
        tw = text_w(ctx, pr, SANS8, 16, 2) + 28
        rrect(ctx, x+130, yy+40, tw, 34, 17); setc(ctx, pc, 0.14*ca); ctx.fill()
        text(ctx, pr, x+144, yy+63, SANS8, 16, pc, ca, track=2)
        text(ctx, t1, x+130, yy+120, SANS8, 30, INK if not done else INKFAINT, ca)
        if done:
            setc(ctx, INKFAINT, ca); ctx.rectangle(x+130, yy+109, text_w(ctx, t1, SANS8, 30)*eo_cubic(prog(lt, 2.8, 0.4)), 3); ctx.fill()
        text(ctx, t2, x+130, yy+158, SANS5, 22, INKFAINT, ca)
        cw = text_w(ctx, chip, SANS8, 22) + 40
        rrect(ctx, x+w-40-cw, yy+32, cw, 50, 25); setc(ctx, MINT100, ca); ctx.fill()
        text(ctx, chip, x+w-40-cw/2, yy+65, SANS8, 21, PINE700, ca, 'center')
        ctx.restore()
    # score toast
    tp = prog(lt, 3.1, 0.5)
    if tp > 0:
        s = eo_back(tp); ta = a*clamp(tp*3)
        ctx.save(); ctx.translate(1370, 920); ctx.scale(s, s)
        card(ctx, -230, -42, 460, 84, 42, PINE900, ta)
        logo_mark(ctx, -180, 0, 46)
        sc = int(lerp(72, 78, eo_cubic(prog(lt, 3.3, 0.8))))
        text(ctx, f'Score  72  →  {sc}', -140, 11, SANS8, 28, WHITE, ta)
        ctx.restore()
    text(ctx, '*Illustrative', 1780, 1050, SANS5, 16, INKFAINT, 0.8*a*p, 'right')
    ctx.restore()

def s_tax(ctx, lt, dur):
    feature_frame(ctx, lt, dur, '04 · Tax copilot',
        [('Your', SERIF, INK), ('taxes,', SERIF, INK)], [('already', SERIFI, PINE700), ('worked', SERIFI, PINE700), ('out.', SERIFI, PINE700)],
        ['Every income head, both regimes,', 'TDS reconciled — ready for self-filing', 'or to hand to your CA.'])
    p = ui_enter(lt); out = eio_cubic(prog(lt, dur-0.4, 0.4))
    ctx.save(); ctx.translate(lerp(160, 0, p) - 60*out, 0); a = p*(1-out)
    x, y, w, h = 960, 190, 820, 700
    card(ctx, x, y, w, h, 36, WHITE, a)
    text(ctx, 'FY 2025-26 · Regime comparison', x+56, y+84, SANS8, 28, INK, a)
    text(ctx, 'Computed from your payslips & Form 16', x+56, y+122, SANS5, 21, INKFAINT, a)
    rows = [('Old regime', 246800, PAPER200, INKSOFT), ('New regime', 208400, MINT, PINE900)]
    mx = 260000
    for i, (n, v, col, tc) in enumerate(rows):
        pp = eo_expo(prog(lt, 0.7 + i*0.3, 1.1))
        yy = y + 200 + i*140
        text(ctx, n, x+56, yy, SANS7, 24, INKSOFT, a)
        bw = (w-112) * v/mx * pp
        rrect(ctx, x+56, yy+20, bw, 70, 18); setc(ctx, col, a); ctx.fill()
        val = int(v*pp)
        if pp > 0.15:
            text(ctx, f'₹{val:,}'.replace(',', ','), x+56+bw-24, yy+68, SANS8, 28, tc, a*clamp((pp-0.15)*3), 'right')
    sp = prog(lt, 2.2, 0.55)
    if sp > 0:
        s = eo_back(sp)
        ctx.save(); ctx.translate(x+w/2, y+560); ctx.scale(s, s)
        rrect(ctx, -300, -62, 600, 124, 30); setc(ctx, PINE900, a); ctx.fill()
        text(ctx, 'You save', -250, 14, SANS7, 28, MINT300, a)
        text(ctx, '₹38,400', 250, 22, SERIFB, 58, WHITE, a, 'right')
        ctx.restore()
    ctx.restore()

def s_grid(ctx, lt, dur):
    aurora(ctx, lt + 30)
    out = eio_cubic(prog(lt, dur-0.4, 0.4)); a0 = 1-out
    kinetic(ctx, [('One', SERIF, PAPER), ('app.', SERIF, PAPER), ('Your', SERIFI, MINT300), ('whole', SERIFI, MINT300), ('financial', SERIFI, MINT300), ('life.', SERIFI, MINT300)],
            W/2, 250, 78, lt, 0.1, stagger=0.06, align='center', out_t=dur-0.4)
    tiles = [('Money Health Score', 'Score'), ('Ask PayWatch AI', 'Chat'), ('Tax & ITR prep', 'Tax'), ('Insurance cover check', 'Shield'),
             ('Investment guidance', 'Invest'), ('Net worth tracker', 'Net'), ('Document vault', 'Vault'), ('Works with your CA', 'CA')]
    tw, th, gap = 380, 190, 28
    gx0 = W/2 - (4*tw + 3*gap)/2
    for i, (lab, ic) in enumerate(tiles):
        r, c = divmod(i, 4)
        pp = prog(lt, 0.45 + i*0.07, 0.6)
        if pp <= 0: continue
        s = eo_back(pp, 1.4); ta = clamp(pp*2.5)*a0
        cx = gx0 + c*(tw+gap) + tw/2; cy = 400 + r*(th+gap) + th/2
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s)
        rrect(ctx, -tw/2, -th/2, tw, th, 28); setc(ctx, WHITE, 0.07*ta); ctx.fill()
        rrect(ctx, -tw/2, -th/2, tw, th, 28); setc(ctx, MINT300, 0.25*ta); ctx.set_line_width(2); ctx.stroke()
        rrect(ctx, -tw/2+30, -th/2+30, 64, 64, 18); setc(ctx, MINT, ta); ctx.fill()
        icon(ctx, ic, -tw/2+62, -th/2+62, ta)
        text(ctx, lab, -tw/2+30, th/2-36, SANS8, 25, PAPER, ta)
        ctx.restore()
    wipe(ctx, prog(lt, dur-0.55, 0.9))

def icon(ctx, kind, cx, cy, a):
    setc(ctx, PINE900, a); ctx.set_line_width(4.5); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if kind == 'Score':
        ctx.new_sub_path(); ctx.arc(cx, cy+4, 17, math.radians(150), math.radians(390)); ctx.stroke(); ctx.move_to(cx, cy+4); ctx.line_to(cx+9, cy-6); ctx.stroke()
    elif kind == 'Chat':
        rrect(ctx, cx-18, cy-15, 36, 26, 8); ctx.stroke(); ctx.move_to(cx-8, cy+11); ctx.line_to(cx-12, cy+19); ctx.line_to(cx+2, cy+11); ctx.stroke()
    elif kind == 'Tax':
        rrect(ctx, cx-14, cy-18, 28, 36, 5); ctx.stroke()
        for k in range(3): ctx.move_to(cx-7, cy-8+k*8); ctx.line_to(cx+7, cy-8+k*8)
        ctx.stroke()
    elif kind == 'Shield':
        ctx.move_to(cx, cy-19); ctx.line_to(cx+16, cy-12); ctx.line_to(cx+14, cy+6); ctx.line_to(cx, cy+19); ctx.line_to(cx-14, cy+6); ctx.line_to(cx-16, cy-12); ctx.close_path(); ctx.stroke()
    elif kind == 'Invest':
        ctx.move_to(cx-17, cy+12); ctx.line_to(cx-5, cy); ctx.line_to(cx+3, cy+7); ctx.line_to(cx+17, cy-11); ctx.stroke()
        ctx.move_to(cx+7, cy-11); ctx.line_to(cx+17, cy-11); ctx.line_to(cx+17, cy-1); ctx.stroke()
    elif kind == 'Net':
        for k, hh in enumerate((12, 22, 32)): rrect(ctx, cx-17+k*13, cy+16-hh, 8, hh, 3); ctx.fill()
    elif kind == 'Vault':
        rrect(ctx, cx-16, cy-6, 32, 24, 5); ctx.stroke(); ctx.new_sub_path(); ctx.arc(cx, cy-6, 10, math.pi, 2*math.pi); ctx.stroke()
    elif kind == 'CA':
        ctx.new_sub_path(); ctx.arc(cx-7, cy-6, 7, 0, 2*math.pi); ctx.stroke(); ctx.new_sub_path(); ctx.arc(cx+9, cy-4, 6, 0, 2*math.pi); ctx.stroke()
        ctx.new_sub_path(); ctx.arc(cx-7, cy+16, 12, math.pi*1.1, math.pi*1.9); ctx.stroke(); ctx.new_sub_path(); ctx.arc(cx+10, cy+16, 10, math.pi*1.15, math.pi*1.9); ctx.stroke()

def s_networth(ctx, lt, dur):
    paper_bg(ctx, lt)
    out = eio_cubic(prog(lt, dur-0.4, 0.4)); a0 = 1-out
    eyebrow(ctx, 'Net worth, projected', 140, 170, eo_cubic(prog(lt, 0.1, 0.5))*a0)
    kinetic(ctx, [('Watch', SERIF, INK), ('your', SERIF, INK), ('money', SERIF, INK), ('grow.', SERIFI, PINE700)], 140, 265, 84, lt, 0.2, stagger=0.07, out_t=dur-0.4)
    x0, y0, cw, ch = 160, 360, 1600, 560
    setc(ctx, PAPER200, a0); ctx.set_line_width(2)
    for k in range(5):
        yy = y0 + ch - k*ch/4; ctx.move_to(x0, yy); ctx.line_to(x0+cw, yy); ctx.stroke()
    for k, lab in enumerate(['Today', '5 yrs', '10 yrs', '15 yrs', '20 yrs']):
        text(ctx, lab, x0 + k*cw/4, y0+ch+44, SANS6, 22, INKFAINT, a0, 'center')
    def curve(rate, sip_growth):
        pts = []
        for i in range(81):
            yr = i/4
            v = 6 + yr*2.2*rate + (yr**2)*0.13*sip_growth
            pts.append((x0 + cw*yr/20, y0 + ch - v/115*ch))
        return pts
    base = curve(1.0, 0.55); imp = curve(1.25, 1.8)
    pd = eio_cubic(prog(lt, 0.8, 2.4))
    for pts, col, wdt, dash, fill in ((base, INKFAINT, 4, True, False), (imp, MINT, 7, False, True)):
        n = max(2, int(len(pts)*pd))
        if fill and pd > 0:
            g = cairo.LinearGradient(0, y0, 0, y0+ch); g.add_color_stop_rgba(0, *hexc(MINT, 0.32*a0)); g.add_color_stop_rgba(1, *hexc(MINT, 0))
            ctx.move_to(pts[0][0], y0+ch)
            for px, py in pts[:n]: ctx.line_to(px, py)
            ctx.line_to(pts[n-1][0], y0+ch); ctx.close_path(); ctx.set_source(g); ctx.fill()
        ctx.set_dash([14, 12] if dash else []); ctx.set_line_width(wdt); ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.move_to(*pts[0])
        for px, py in pts[1:n]: ctx.line_to(px, py)
        setc(ctx, col, a0); ctx.stroke(); ctx.set_dash([])
        if pd > 0.02:
            ex, ey = pts[n-1]; setc(ctx, col, a0); ctx.new_sub_path(); ctx.arc(ex, ey, 11, 0, 2*math.pi); ctx.fill()
    la = eo_back(prog(lt, 3.1, 0.5)) if prog(lt, 3.1, 0.5) > 0 else 0
    if la > 0:
        ex, ey = imp[-1]; bx, by = base[-1]
        for (px, py, lab, val, bg, fg) in ((ex, ey, 'Acting on your plan', '₹3.4 Cr', PINE900, WHITE), (bx, by, 'Doing nothing', '₹1.1 Cr', PAPER200, INK)):
            ctx.save(); ctx.translate(px-30, py); ctx.scale(la, la)
            rrect(ctx, -330, -50, 300, 100, 24); setc(ctx, bg, a0); ctx.fill()
            text(ctx, lab, -305, -12, SANS7, 20, MINT300 if bg == PINE900 else INKSOFT, a0)
            text(ctx, val, -305, 30, SERIFB, 36, fg, a0)
            ctx.restore()
    text(ctx, 'Illustrative projection · moderate risk · not a guarantee of returns', x0+cw, 1040, SANS5, 18, INKFAINT, 0.9*a0, 'right')

def s_clip_c(ctx, lt, dur):
    if CLIPS.get('c') is None: calm_scene(ctx, lt)
    else: draw_clip(ctx, CLIPS['c'], lt, dur, zoom=(1.04, 1.0))
    kinetic(ctx, [('From', SERIF, PAPER), ('anxious', SERIF, PAPER), ('to', SERIF, PAPER), ('in', SERIFI, MINT300), ('control.', SERIFI, MINT300)],
            150, 905, 80, lt, 0.4, out_t=dur-0.35)
    # fade in from white wipe
    fa = 1 - eo_cubic(prog(lt, 0, 0.35))
    if fa > 0: setc(ctx, PAPER, fa); ctx.paint()
    fo = eio_cubic(prog(lt, dur-0.5, 0.5))
    if fo > 0: setc(ctx, PINE950, fo); ctx.paint()

def s_end(ctx, lt, dur):
    aurora(ctx, lt + 50)
    pb = prog(lt, 0.1, 0.6); bars = tuple(prog(lt, 0.45 + i*0.12, 0.5) for i in range(3))
    logo_mark(ctx, W/2, 330, 170, pb, bars)
    a = eo_cubic(prog(lt, 0.9, 0.6))
    ctx.save(); ctx.translate(0, 26*(1-a)); wordmark(ctx, W/2, 545, 100, a, PAPER, 'center'); ctx.restore()
    kinetic(ctx, [('Watch', SERIF, PAPER), ('your', SERIF, PAPER), ('money', SERIF, PAPER), ('grow.', SERIFI, MINT)], W/2, 650, 54, lt, 1.3, stagger=0.08, align='center')
    cp = prog(lt, 2.0, 0.6)
    if cp > 0:
        s = eo_back(cp); ca = clamp(cp*2)
        ctx.save(); ctx.translate(W/2, 780); ctx.scale(s, s)
        lab = 'Try the live demo  →  paywatch.in'
        tw = text_w(ctx, lab, SANS8, 30) + 80
        # shimmer
        rrect(ctx, -tw/2, -42, tw, 84, 42); setc(ctx, MINT, ca); ctx.fill()
        sx = lerp(-tw/2 - 100, tw/2 + 100, (lt*0.6) % 1)
        g = cairo.LinearGradient(sx-80, 0, sx+80, 0); g.add_color_stop_rgba(0, 1, 1, 1, 0); g.add_color_stop_rgba(0.5, 1, 1, 1, 0.35*ca); g.add_color_stop_rgba(1, 1, 1, 1, 0)
        rrect(ctx, -tw/2, -42, tw, 84, 42); ctx.set_source(g); ctx.fill()
        text(ctx, lab, 0, 11, SANS8, 30, PINE950, ca, 'center')
        ctx.restore()
    fa = eo_cubic(prog(lt, 2.6, 0.6))
    text(ctx, 'Educational & organisation tool · Not investment advice · Works alongside your CA', W/2, 1010, SANS5, 19, MINT300, 0.55*fa, 'center')
    fi = 1 - eo_cubic(prog(lt, 0, 0.4))
    if fi > 0: setc(ctx, PINE950, fi); ctx.paint()

SCENES = [
    (s_clip_a, 4.6), (s_clip_b, 4.4), (s_question, 3.6), (s_logo, 4.0),
    (s_score, 6.0), (s_chat, 6.6), (s_actions, 5.2), (s_tax, 4.8),
    (s_grid, 3.8), (s_networth, 5.0), (s_clip_c, 4.4), (s_end, 5.2),
]

def main():
    for k in 'abc':
        cands = ['/sessions/blissful-gifted-volta/mnt/PersonalCFO/video-assets/clip_%s.mp4' % k, os.path.join(DIR, f'clip_{k}.mp4')]
        found = [c for c in cands if os.path.exists(c)] if '--noclips' not in sys.argv else []
        CLIPS[k] = Clip(found[0]) if found else None
    print('clips:', {k: (v.path if v else None) for k, v in CLIPS.items()})
    total = sum(d for _, d in SCENES)
    print('total seconds', total)
    starts = []; acc = 0
    for fn, d in SCENES: starts.append(acc); acc += d
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    ctx.set_antialias(cairo.ANTIALIAS_BEST)
    fo = cairo.FontOptions(); fo.set_antialias(cairo.ANTIALIAS_GRAY); fo.set_hint_style(cairo.HINT_STYLE_NONE); fo.set_hint_metrics(cairo.HINT_METRICS_OFF)
    ctx.set_font_options(fo)
    if PREVIEW:
        stills = [float(x) for x in sys.argv[sys.argv.index('--preview')+1].split(',')]
        for T in stills:
            i = max(j for j, s in enumerate(starts) if s <= T); fn, d = SCENES[i]
            if fn in (s_clip_a, s_clip_b, s_clip_c) and CLIPS.get({s_clip_a: 'a', s_clip_b: 'b', s_clip_c: 'c'}[fn]) is not None:
                key = {s_clip_a: 'a', s_clip_b: 'b', s_clip_c: 'c'}[fn]; c = Clip(CLIPS[key].path)
                for _ in range(int((T-starts[i])*FPS)+1): c.next()
                CLIPS[key] = c
            ctx.save(); setc(ctx, '#000000'); ctx.paint(); fn(ctx, T - starts[i], d); ctx.restore()
            surf.write_to_png(os.path.join(DIR, f'preview_{T:05.1f}.png'))
        return
    out = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-i', os.path.join(DIR, 'music.wav'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
                            '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', os.path.join(DIR, 'PayWatch-Promo.mp4')], stdin=subprocess.PIPE)
    nf = int(round(total*FPS))
    for f in range(nf):
        T = f/FPS
        i = max(j for j, s in enumerate(starts) if s <= T + 1e-9); fn, d = SCENES[i]
        ctx.save(); setc(ctx, '#000000'); ctx.paint(); fn(ctx, T - starts[i], d); ctx.restore()
        surf.flush(); out.stdin.write(bytes(surf.get_data()))
        if f % 150 == 0: print('frame', f, '/', nf, flush=True)
    out.stdin.close(); out.wait(); print('done')

if __name__ == '__main__':
    main()
