# PayWatch promo v2 — stronger problem, many fast feature scenes, net-worth aftermath, SFX-only audio.
import sys, os, math, subprocess, cairo
_argv = sys.argv; sys.argv = [sys.argv[0]]
import render as R
sys.argv = _argv
from render import (W, H, FPS, hexc, setc, rrect, shadow, card, text, text_w, kinetic, eyebrow, logo_mark, aurora,
                    paper_bg, wipe, draw_clip, Clip, clamp, prog, eo_cubic, eo_expo, eio_cubic, eo_back, lerp, icon,
                    PINE950, PINE900, PINE800, PINE700, MINT, MINT300, MINT100, PAPER, PAPER100, PAPER200, INK, INKSOFT,
                    INKFAINT, RED, AMBER, WHITE, SANS5, SANS6, SANS7, SANS8, feature_frame, ui_enter, bubble)

# Brand serif = the app's own Fraunces build (same file the website loads)
R.SERIF, R.SERIFB, R.SERIFI = 'PWAppSerif500', 'PWAppSerif600', 'PWAppSerifItalic500'
SERIF, SERIFB, SERIFI = R.SERIF, R.SERIFB, R.SERIFI
CLIPS = R.CLIPS
PREVIEW = '--preview' in sys.argv

def wordmark(ctx, x, y, size, a=1.0, color=WHITE, align='left'):
    """Matches web/src/components/Logo.tsx: 'Pay' bold sans (Manrope 700, tight) + 'Watch' Fraunces italic — Watch in mint."""
    tr = -size*0.025
    w1 = text_w(ctx, 'Pay', SANS7, size, tr); w2 = text_w(ctx, 'Watch', SERIFI, size)
    if align == 'center': x -= (w1 + w2)/2
    text(ctx, 'Pay', x, y, SANS7, size, color, a, track=tr)
    text(ctx, 'Watch', x + w1 + size*0.01, y, SERIFI, size, MINT, a)
    return w1 + w2
R.wordmark = wordmark

def speed(fn, base):
    """Run an existing scene faster: its animation timeline is compressed to the new duration."""
    def f(ctx, lt, dur): fn(ctx, lt*base/dur, base)
    return f

# ---------------- PROBLEM ----------------
DECISIONS = ['Old or new tax regime?', 'Do I need term insurance?', 'SIP or FD?', 'Prepay my home loan?',
             'Is my emergency fund enough?', 'Which ITR form do I file?', 'Can I afford that car?',
             'Am I saving enough?', 'Health cover — ₹5L or ₹10L?', 'Where do I invest my bonus?']
SPOTS = [(330, 230), (1500, 210), (280, 520), (1580, 470), (900, 150), (1430, 700), (470, 680), (1180, 300), (640, 380), (1120, 560)]

def dark_bg(ctx, t):
    g = cairo.LinearGradient(0, 0, W, H); g.add_color_stop_rgba(0, 0.04, 0.07, 0.08, 1); g.add_color_stop_rgba(1, 0.01, 0.02, 0.03, 1)
    ctx.set_source(g); ctx.paint()
    rg = cairo.RadialGradient(W*0.5, H*0.42, 0, W*0.5, H*0.42, 800)
    rg.add_color_stop_rgba(0, 0.30, 0.38, 0.6, 0.18); rg.add_color_stop_rgba(1, 0, 0, 0, 0); ctx.set_source(rg); ctx.paint()

def decision_bubbles(ctx, lt, dur, alpha=1.0):
    for i, q in enumerate(DECISIONS):
        t0 = 0.25 + 0.42*i - 0.012*i*i          # accelerating — overload
        p = prog(lt, t0, 0.38)
        if p <= 0: continue
        s = eo_back(p, 2.0); a = clamp(p*3) * alpha
        cx, cy = SPOTS[i]
        cx += math.sin(lt*1.3 + i)*10; cy += math.cos(lt*1.1 + i*2)*8
        tw = text_w(ctx, q, SANS8, 25) + 90
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(math.radians((i % 5 - 2)*1.2))
        shadow(ctx, -tw/2, -34, tw, 68, 34, a=0.4*a)
        rrect(ctx, -tw/2, -34, tw, 68, 34); ctx.set_source_rgba(1, 1, 1, 0.94*a); ctx.fill()
        setc(ctx, AMBER if i % 3 else RED, a); ctx.new_sub_path(); ctx.arc(-tw/2 + 34, 0, 17, 0, 2*math.pi); ctx.fill()
        text(ctx, '?', -tw/2 + 34, 9, SANS8, 24, WHITE, a, 'center')
        text(ctx, q, -tw/2 + 64, 9, SANS8, 25, INK, a)
        ctx.restore()

def s_overload(ctx, lt, dur):
    if CLIPS.get('d') is None: dark_bg(ctx, lt)
    else: draw_clip(ctx, CLIPS['d'], lt, dur, dark=0.15)
    out = 1 - eio_cubic(prog(lt, dur-0.35, 0.3))
    decision_bubbles(ctx, lt, dur, out)
    eyebrow(ctx, 'Every single week', 150, 820, eo_cubic(prog(lt, 0.3, 0.5))*out, MINT300)
    kinetic(ctx, [('So', SERIF, WHITE), ('many', SERIF, WHITE), ('money', SERIF, WHITE), ('decisions.', SERIFI, MINT300)],
            150, 905, 76, lt, 0.4, out_t=dur-0.35)

TODOS = [('Compare tax regimes', 'Snoozed', AMBER), ('Renew health policy', 'Overdue', RED),
         ('Review my SIPs', 'Someday', INKFAINT), ('Collect rent receipts', 'Snoozed', AMBER), ('Plan for retirement', 'Not started', RED)]

def s_notime(ctx, lt, dur):
    if CLIPS.get('e') is None: dark_bg(ctx, lt)
    else: draw_clip(ctx, CLIPS['e'], lt, dur, zoom=(1.08, 1.0), dark=0.1)
    out = 1 - eio_cubic(prog(lt, dur-0.35, 0.3))
    # clock card
    p = eo_expo(prog(lt, 0.15, 0.6)); a = p*out
    x, y = 1250, 120
    card(ctx, x, y, 530, 120, 30, WHITE, 0.95*a)
    mins = 47 + int(lt*3)
    text(ctx, f'8:{min(mins, 59):02d} PM', x+40, y+78, SANS8, 46, INK, a)
    text(ctx, 'Meetings since 9 AM', x+300, y+56, SANS6, 18, INKFAINT, a)
    text(ctx, '0 min for money', x+300, y+84, SANS8, 18, RED, a)
    # to-do card
    p2 = eo_expo(prog(lt, 0.35, 0.7)); a2 = p2*out
    cy0 = 270
    card(ctx, x, cy0, 530, 64 + 74*len(TODOS), 30, WHITE, 0.95*a2)
    text(ctx, 'MONEY TO-DO', x+36, cy0+46, SANS8, 17, INKFAINT, a2, track=3)
    for i, (t, st, col) in enumerate(TODOS):
        pp = eo_cubic(prog(lt, 0.6 + i*0.28, 0.4)); ia = pp*a2
        yy = cy0 + 100 + i*74
        ctx.set_line_width(3); setc(ctx, PAPER200, ia); ctx.new_sub_path(); ctx.arc(x+50, yy-8, 13, 0, 2*math.pi); ctx.stroke()
        text(ctx, t, x+80, yy, SANS7, 23, INK, ia)
        sw = text_w(ctx, st, SANS8, 16) + 26
        rrect(ctx, x+530-36-sw, yy-30, sw, 36, 18); setc(ctx, col, 0.15*ia); ctx.fill()
        text(ctx, st, x+530-36-sw/2, yy-6, SANS8, 16, col, ia, 'center')
    kinetic(ctx, [('…and', SERIF, WHITE), ('zero', SERIF, WHITE), ('time', SERIF, WHITE), ('to', SERIF, WHITE), ('figure', SERIFI, MINT300),
                  ('them', SERIFI, MINT300), ('out.', SERIFI, MINT300)], 150, 905, 76, lt, 0.4, out_t=dur-0.35)

# ---------------- SOLUTION ----------------
def s_logo2(ctx, lt, dur):
    aurora(ctx, lt + 12)
    for i in range(3):
        p = prog(lt, 0.15 + i*0.12, 1.1)
        if 0 < p < 1:
            r = lerp(60, 520, eo_cubic(p)); setc(ctx, MINT, 0.35*(1-p)); ctx.set_line_width(3); ctx.new_sub_path(); ctx.arc(W/2, 430, r, 0, 2*math.pi); ctx.stroke()
    pb = prog(lt, 0.1, 0.6)
    bars = tuple(prog(lt, 0.45 + i*0.11, 0.5) for i in range(3))
    up = eo_cubic(prog(lt, 1.2, 0.6))
    logo_mark(ctx, W/2, lerp(500, 390, up), 220, pb, bars)
    a = eo_cubic(prog(lt, 1.3, 0.5))
    ctx.save(); ctx.translate(0, 30*(1-a)); wordmark(ctx, W/2, 640, 116, a, WHITE, 'center'); ctx.restore()
    kinetic(ctx, [('Your', SANS6, MINT300), ('personal', SANS6, MINT300), ('financial', SANS6, MINT300), ('advisor.', SANS6, MINT300),
                  ('In', SANS6, WHITE), ('your', SANS6, WHITE), ('pocket.', SANS6, WHITE)], W/2, 735, 40, lt, 1.75, stagger=0.05, align='center')
    wipe(ctx, prog(lt, dur-0.5, 0.85))

def ff(ctx, lt, dur, eb, h1, h2, sub):
    """Fast feature frame (left copy)."""
    paper_bg(ctx, lt)
    out = eio_cubic(prog(lt, dur-0.3, 0.3))
    ctx.save(); ctx.translate(-70*out, 0); a = 1-out
    eyebrow(ctx, eb, 140, 400, eo_cubic(prog(lt, 0.05, 0.35))*a)
    kinetic(ctx, h1, 140, 495, 74, lt, 0.08, stagger=0.04, dur=0.45)
    kinetic(ctx, h2, 140, 582, 74, lt, 0.2, stagger=0.04, dur=0.45)
    pa = eo_cubic(prog(lt, 0.4, 0.4))*a; y = 655
    for line in sub: text(ctx, line, 140, y, SANS5, 27, INKSOFT, pa); y += 40
    ctx.restore()
    return out

def panel(lt, dur, delay=0.05):
    p = eo_expo(prog(lt, delay, 0.6)); out = eio_cubic(prog(lt, dur-0.3, 0.3))
    return lerp(180, 0, p) - 70*out, p*(1-out)

def W_(s): return [(w, SERIF, INK) for w in s.split()]
def I_(s): return [(w, SERIFI, PINE700) for w in s.split()]

def s_spend(ctx, lt, dur):
    out = ff(ctx, lt, dur, '05 · Statement scan', W_('See where'), I_('it all goes.'), ['Upload a bank statement —', 'we find what you could save.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    x, y, w, h = 960, 200, 820, 680
    card(ctx, x, y, w, h, 36, WHITE, a)
    text(ctx, 'September spending', x+56, y+80, SANS8, 28, INK, a)
    text(ctx, '₹84,320 out · 212 transactions', x+56, y+116, SANS5, 21, INKFAINT, a)
    cats = [('Rent & bills', 34, PINE700), ('Food & dining', 22, MINT), ('Shopping', 16, AMBER), ('Travel', 10, '#58C5A8'), ('Subscriptions', 8, RED), ('Other', 10, PAPER200)]
    cx, cy, rr = x+230, y+380, 150
    pdn = eo_cubic(prog(lt, 0.25, 1.0)); ang = -math.pi/2
    ctx.set_line_width(56)
    for n, v, col in cats:
        sweep = 2*math.pi*v/100*pdn
        setc(ctx, col, a); ctx.new_sub_path(); ctx.arc(cx, cy, rr, ang, ang + sweep - 0.02); ctx.stroke(); ang += sweep
    text(ctx, '38%', cx, cy+10, SERIFB, 54, INK, a, 'center'); text(ctx, 'flexible', cx, cy+44, SANS6, 20, INKFAINT, a, 'center')
    for i, (n, v, col) in enumerate(cats):
        ia = eo_cubic(prog(lt, 0.4 + i*0.07, 0.3))*a; yy = y+230 + i*52
        setc(ctx, col, ia); ctx.new_sub_path(); ctx.arc(x+470, yy-7, 9, 0, 2*math.pi); ctx.fill()
        text(ctx, n, x+492, yy, SANS6, 22, INKSOFT, ia); text(ctx, f'{v}%', x+w-56, yy, SANS8, 22, INK, ia, 'right')
    sp = prog(lt, 1.15, 0.45)
    if sp > 0:
        s = eo_back(sp)
        ctx.save(); ctx.translate(x+w/2, y+h-70); ctx.scale(s, s)
        rrect(ctx, -360, -42, 720, 84, 26); setc(ctx, MINT100, a); ctx.fill()
        text(ctx, 'Where you could’ve saved', -330, 10, SANS7, 24, PINE700, a)
        text(ctx, '₹6,240', 330, 13, SERIFB, 38, PINE900, a, 'right')
        ctx.restore()
    ctx.restore()

def ring(ctx, cx, cy, r, frac, col, a, lw=26):
    ctx.set_line_width(lw); ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    setc(ctx, PAPER100, a); ctx.new_sub_path(); ctx.arc(cx, cy, r, 0, 2*math.pi); ctx.stroke()
    if frac > 0.005:
        setc(ctx, col, a); ctx.new_sub_path(); ctx.arc(cx, cy, r, -math.pi/2, -math.pi/2 + 2*math.pi*frac); ctx.stroke()

def s_insure(ctx, lt, dur):
    ff(ctx, lt, dur, '06 · Insurance check', W_('Spot the gaps'), I_('before life does.'), ['Upload your policies — we read', 'cover, expiry & renewals for you.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    x, y, w, h = 960, 200, 820, 680
    card(ctx, x, y, w, h, 36, WHITE, a)
    text(ctx, 'Your cover vs. what you need', x+56, y+80, SANS8, 28, INK, a)
    pr = eo_cubic(prog(lt, 0.3, 1.0))
    for i, (lab, have, need, frac, col) in enumerate((('Health', '₹5L', '₹10L', 0.5, AMBER), ('Term life', '₹0', '₹1 Cr', 0.02, RED), ('Accident', '₹20L', '₹20L', 1.0, MINT))):
        cx = x + 160 + i*250; cy = y + 290
        ring(ctx, cx, cy, 80, frac*pr, col, a)
        text(ctx, f'{int(frac*100*pr)}%', cx, cy+12, SERIFB, 40, INK, a, 'center')
        text(ctx, lab, cx, cy+140, SANS8, 23, INK, a, 'center')
        text(ctx, f'{have} of {need}', cx, cy+172, SANS5, 19, INKFAINT, a, 'center')
    for i, (t, col) in enumerate((('Health policy renews in 12 days', AMBER), ('Term cover gap: ₹1 Cr', RED))):
        ia = eo_cubic(prog(lt, 1.0 + i*0.15, 0.35))*a; yy = y+540 + i*62
        rrect(ctx, x+56, yy-36, w-112, 52, 16); setc(ctx, col, 0.1*ia); ctx.fill()
        text(ctx, '●  ' + t, x+80, yy-2, SANS7, 21, col, ia)
    ctx.restore()

def s_invest(ctx, lt, dur):
    ff(ctx, lt, dur, '07 · Invest smarter', W_('A plan that fits'), I_('your risk.'), ['Your target mix + the fund', 'categories to start with.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    x, y, w, h = 960, 200, 820, 680
    card(ctx, x, y, w, h, 36, WHITE, a)
    text(ctx, 'Target mix · Aggressive · Age 26', x+56, y+80, SANS8, 28, INK, a)
    mix = [('Equity', 75, PINE700), ('Debt', 15, MINT), ('Gold', 10, AMBER)]
    cx, cy, rr = x+220, y+330, 140; ang = -math.pi/2; pd = eo_cubic(prog(lt, 0.25, 0.9))
    ctx.set_line_width(60)
    for n, v, col in mix:
        sw = 2*math.pi*v/100*pd; setc(ctx, col, a); ctx.new_sub_path(); ctx.arc(cx, cy, rr, ang, ang+sw-0.02); ctx.stroke(); ang += sw
    text(ctx, '₹25K', cx, cy+8, SERIFB, 46, INK, a, 'center'); text(ctx, 'per month', cx, cy+40, SANS6, 19, INKFAINT, a, 'center')
    for i, (n, v, col) in enumerate(mix):
        ia = eo_cubic(prog(lt, 0.45 + i*0.08, 0.3))*a; yy = y+230 + i*64
        rrect(ctx, x+440, yy-22, 22, 22, 6); setc(ctx, col, ia); ctx.fill()
        text(ctx, n, x+476, yy-3, SANS7, 24, INK, ia); text(ctx, f'{v}%', x+w-56, yy-3, SANS8, 24, INK, ia, 'right')
    chips = ['Index funds', 'Flexi-cap', 'Short-duration debt', 'Gold ETF / SGB']
    cx0, cy0 = x+56, y+540
    for i, c in enumerate(chips):
        ia = eo_back(prog(lt, 0.9 + i*0.08, 0.35)) if prog(lt, 0.9 + i*0.08, 0.35) > 0 else 0
        cw = text_w(ctx, c, SANS7, 21) + 40
        if cx0 + cw > x + w - 40: cx0 = x+56; cy0 += 64
        if ia > 0:
            rrect(ctx, cx0, cy0, cw, 48, 24); setc(ctx, MINT100, a*clamp(ia)); ctx.fill()
            text(ctx, c, cx0+20, cy0+32, SANS7, 21, PINE700, a*clamp(ia))
        cx0 += cw + 12
    text(ctx, 'Fund categories only · no stock tips', x+56, y+h-30, SANS5, 17, INKFAINT, a*0.9)
    ctx.restore()

def s_goals(ctx, lt, dur):
    ff(ctx, lt, dur, '08 · Goals on autopilot', W_('Name it.'), I_('Watch it fill up.'), ['Every goal gets a monthly', 'number and a finish date.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    goals = [('Emergency fund', '₹4.8L of ₹5.4L', 0.89, 'On track', MINT), ('Goa trip with friends', '₹27K of ₹60K', 0.45, 'Dec 2026', MINT),
             ('Home down payment', '₹3.6L of ₹20L', 0.18, '+₹8K/mo needed', AMBER)]
    for i, (n, sub, fr, tag, col) in enumerate(goals):
        pp = eo_expo(prog(lt, 0.1 + i*0.12, 0.6)); yy = 220 + i*210
        ctx.save(); ctx.translate(lerp(200, 0, pp), 0); ia = pp*a
        card(ctx, 960, yy, 820, 180, 30, WHITE, ia)
        text(ctx, n, 1010, yy+64, SANS8, 30, INK, ia); text(ctx, sub, 1010, yy+100, SANS5, 21, INKFAINT, ia)
        tw = text_w(ctx, tag, SANS8, 18) + 30
        rrect(ctx, 1740-tw, yy+36, tw, 40, 20); setc(ctx, col, 0.15*ia); ctx.fill(); text(ctx, tag, 1740-tw/2, yy+62, SANS8, 18, PINE700 if col == MINT else col, ia, 'center')
        bp = eo_cubic(prog(lt, 0.4 + i*0.12, 0.9))
        rrect(ctx, 1010, yy+128, 730, 18, 9); setc(ctx, PAPER100, ia); ctx.fill()
        rrect(ctx, 1010, yy+128, 730*fr*bp, 18, 9); setc(ctx, col, ia); ctx.fill()
        ctx.restore()
    ctx.restore()

def s_alerts(ctx, lt, dur):
    ff(ctx, lt, dur, '09 · Proactive alerts', W_('It taps you'), I_('before it costs you.'), ['Deadlines, renewals and', 'slip-ups — caught early.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    items = [('URGENT', RED, 'Advance tax due in 5 days', 'Pay ₹14,200 by 15 Dec to avoid interest'),
             ('WARNING', AMBER, 'Dining spend up 38% this month', '₹4,100 above your usual'),
             ('GOOD', MINT, 'Emergency fund hit 6 months', 'Nice — you’re fully covered'),
             ('INFO', PINE700, 'Your October briefing is ready', '3 things to do this month')]
    for i, (lvl, col, t1, t2) in enumerate(items):
        pp = eo_expo(prog(lt, 0.08 + i*0.11, 0.55)); yy = 190 + i*172
        ctx.save(); ctx.translate(0, lerp(-60, 0, pp)); ia = pp*a
        card(ctx, 960, yy, 820, 150, 28, WHITE, ia)
        rrect(ctx, 960, yy, 10, 150, 5); setc(ctx, col, ia); ctx.fill()
        text(ctx, lvl, 1000, yy+46, SANS8, 16, col if col != MINT else PINE700, ia, track=3)
        text(ctx, t1, 1000, yy+90, SANS8, 28, INK, ia); text(ctx, t2, 1000, yy+124, SANS5, 21, INKFAINT, ia)
        ctx.restore()
    ctx.restore()

def s_records(ctx, lt, dur):
    ff(ctx, lt, dur, '10 · AI document reader', W_('Upload a payslip.'), I_('Done.'), ['AI reads it, checks it’s the', 'right document, fills your data.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    x, y, w, h = 960, 200, 820, 680
    card(ctx, x, y, w, h, 36, WHITE, a)
    # file chip flying in
    fp = eo_expo(prog(lt, 0.15, 0.6))
    rrect(ctx, x+56, y+56, w-112, 110, 22); setc(ctx, PAPER100, a); ctx.fill()
    rrect(ctx, x+80, y+78, 52, 66, 8); setc(ctx, RED, 0.85*a*fp); ctx.fill(); text(ctx, 'PDF', x+106, y+118, SANS8, 15, WHITE, a*fp, 'center')
    text(ctx, 'Payslip_Sep2026.pdf', x+156, y+108, SANS8, 25, INK, a*fp)
    scan = prog(lt, 0.5, 0.7)
    rrect(ctx, x+156, y+126, 420, 10, 5); setc(ctx, PAPER200, a); ctx.fill()
    rrect(ctx, x+156, y+126, 420*eo_cubic(scan), 10, 5); setc(ctx, MINT, a); ctx.fill()
    if scan >= 1: text(ctx, '✓ Verified payslip', x+w-80, y+120, SANS8, 20, PINE700, a, 'right')
    fields = [('Gross salary', '₹2,33,333'), ('Basic', '₹93,333'), ('HRA', '₹46,667'), ('PF (employee)', '₹11,200'), ('TDS this month', '₹28,450')]
    for i, (k, v) in enumerate(fields):
        fa = eo_cubic(prog(lt, 1.05 + i*0.12, 0.3))*a; yy = y+240 + i*74
        text(ctx, k, x+56, yy, SANS6, 24, INKSOFT, fa)
        text(ctx, v, x+w-110, yy, SANS8, 26, INK, fa, 'right')
        if fa > 0.5: text(ctx, '✓', x+w-64, yy, SANS8, 24, MINT, fa)
        setc(ctx, PAPER100, fa); ctx.rectangle(x+56, yy+24, w-112, 2); ctx.fill()
    ctx.restore()

def s_itr(ctx, lt, dur):
    ff(ctx, lt, dur, '11 · File it yourself', W_('ITR, step by step.'), I_('No panic.'), ['Right form, right regime, your', 'refund — guided to the end.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    x, y, w, h = 960, 200, 820, 680
    card(ctx, x, y, w, h, 36, WHITE, a)
    rrect(ctx, x+56, y+56, w-112, 120, 24); setc(ctx, PINE900, a); ctx.fill()
    text(ctx, 'ITR-1 · New regime', x+90, y+108, SANS8, 26, WHITE, a); text(ctx, 'Refund due', x+90, y+144, SANS6, 20, MINT300, a)
    text(ctx, '₹12,450', x+w-90, y+136, SERIFB, 50, WHITE, a, 'right')
    steps = ['Gather Form 16 & AIS', 'Match TDS with 26AS', 'Log in to the tax portal', 'Fill & verify with our computation', 'Submit & e-verify']
    for i, s_ in enumerate(steps):
        yy = y+250 + i*82; t0 = 0.35 + i*0.22
        dp = prog(lt, t0, 0.25); ia = a
        setc(ctx, MINT if dp > 0 else PAPER200, ia); ctx.new_sub_path(); ctx.arc(x+84, yy-8, 20, 0, 2*math.pi); ctx.fill()
        if dp > 0: text(ctx, '✓', x+84, yy, SANS8, 22, WHITE, ia*clamp(dp*2), 'center')
        else: text(ctx, str(i+1), x+84, yy, SANS8, 20, INKFAINT, ia, 'center')
        text(ctx, s_, x+124, yy, SANS7, 25, INK if dp > 0 else INKFAINT, ia)
    ctx.restore()

def s_ca(ctx, lt, dur):
    ff(ctx, lt, dur, '12 · Works with your CA', W_('Your CA gets'), I_('a ready pack.'), ['Share docs and computations', 'privately — one tap.'])
    dx, a = panel(lt, dur)
    ctx.save(); ctx.translate(dx, 0)
    x, y, w, h = 960, 240, 820, 600
    card(ctx, x, y, w, h, 36, WHITE, a)
    setc(ctx, PINE700, a); ctx.new_sub_path(); ctx.arc(x+96, y+96, 40, 0, 2*math.pi); ctx.fill(); text(ctx, 'RM', x+96, y+106, SANS8, 26, WHITE, a, 'center')
    text(ctx, 'CA Rajesh Mehta', x+156, y+90, SANS8, 28, INK, a); text(ctx, '● Connected · sees what you share', x+156, y+124, SANS6, 19, MINT, a)
    docs = [('CA-ready tax pack', 'Computation · both regimes'), ('Form 16 + payslips', '12 files'), ('Capital gains statement', 'FY 2025-26')]
    for i, (d1, d2) in enumerate(docs):
        pp = eo_expo(prog(lt, 0.25 + i*0.14, 0.5)); yy = y+190 + i*110; ia = pp*a
        ctx.save(); ctx.translate(lerp(120, 0, pp), 0)
        rrect(ctx, x+56, yy, w-112, 90, 20); setc(ctx, PAPER100, ia); ctx.fill()
        rrect(ctx, x+80, yy+20, 50, 50, 12); setc(ctx, MINT, ia); ctx.fill(); icon(ctx, 'Tax', x+105, yy+45, ia)
        text(ctx, d1, x+150, yy+42, SANS8, 24, INK, ia); text(ctx, d2, x+150, yy+72, SANS5, 19, INKFAINT, ia)
        text(ctx, 'Shared ✓', x+w-84, yy+56, SANS8, 19, PINE700, ia, 'right')
        ctx.restore()
    ctx.restore()

def s_grid2(ctx, lt, dur):
    aurora(ctx, lt + 30)
    out = eio_cubic(prog(lt, dur-0.35, 0.35)); a0 = 1-out
    kinetic(ctx, [('One', SERIF, WHITE), ('app.', SERIF, WHITE), ('Your', SERIFI, MINT300), ('whole', SERIFI, MINT300), ('financial', SERIFI, MINT300), ('life.', SERIFI, MINT300)],
            W/2, 220, 76, lt, 0.05, stagger=0.05, align='center', out_t=dur-0.35)
    tiles = [('Money Health Score', 'Score'), ('Ask PayWatch AI', 'Chat'), ('Tax & ITR prep', 'Tax'), ('Insurance check', 'Shield'),
             ('Investment plan', 'Invest'), ('Net worth tracker', 'Net'), ('Document vault', 'Vault'), ('Works with your CA', 'CA'),
             ('Statement scan', 'Invest'), ('Goals autopilot', 'Score'), ('Proactive alerts', 'Shield'), ('Monthly briefing', 'Chat')]
    tw, th, gap = 380, 150, 24
    gx0 = W/2 - (4*tw + 3*gap)/2
    for i, (lab, ic) in enumerate(tiles):
        r, c = divmod(i, 4)
        pp = prog(lt, 0.3 + i*0.05, 0.45)
        if pp <= 0: continue
        s = eo_back(pp, 1.4); ta = clamp(pp*2.5)*a0
        cx = gx0 + c*(tw+gap) + tw/2; cy = 340 + r*(th+gap) + th/2
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s)
        rrect(ctx, -tw/2, -th/2, tw, th, 26); setc(ctx, WHITE, 0.07*ta); ctx.fill()
        rrect(ctx, -tw/2, -th/2, tw, th, 26); setc(ctx, MINT300, 0.25*ta); ctx.set_line_width(2); ctx.stroke()
        rrect(ctx, -tw/2+26, -32, 64, 64, 18); setc(ctx, MINT, ta); ctx.fill()
        icon(ctx, ic, -tw/2+58, 0, ta)
        text(ctx, lab, -tw/2+110, 9, SANS8, 24, WHITE, ta)
        ctx.restore()
    wipe(ctx, prog(lt, dur-0.5, 0.85))

# ---------------- AFTERMATH ----------------
def s_after(ctx, lt, dur):
    if CLIPS.get('c') is None: aurora(ctx, lt)
    else: draw_clip(ctx, CLIPS['c'], lt, dur, zoom=(1.05, 1.0))
    p = eo_expo(prog(lt, 0.3, 0.7)); out = 1 - eio_cubic(prog(lt, dur-0.35, 0.3)); a = p*out
    x, y, w, h = 1180, 150, 600, 470
    ctx.save(); ctx.translate(0, lerp(60, 0, p))
    shadow(ctx, x, y, w, h, 34, a=0.35*a)
    rrect(ctx, x, y, w, h, 34); ctx.set_source_rgba(1, 1, 1, 0.95*a); ctx.fill()
    logo_mark(ctx, x+62, y+62, 52)
    text(ctx, 'Your net worth', x+104, y+56, SANS8, 24, INK, a)
    gp = eio_cubic(prog(lt, 0.7, 3.0))
    yr = 2026 + int(10*gp)
    text(ctx, f'{yr}', x+104, y+86, SANS6, 19, INKFAINT, a)
    val = lerp(8.4, 46.2, gp ** 1.6)
    text(ctx, f'₹{val:.1f}L', x+48, y+200, SERIFB, 88, PINE900, a)
    # growing chart
    cx0, cy0, cw, ch = x+48, y+250, w-96, 150
    n = max(2, int(60*gp))
    pts = [(cx0 + cw*i/59, cy0 + ch - ch*((i/59)**1.7)*0.92 - math.sin(i*0.9)*3) for i in range(n)]
    g = cairo.LinearGradient(0, cy0, 0, cy0+ch); g.add_color_stop_rgba(0, *hexc(MINT, 0.35*a)); g.add_color_stop_rgba(1, *hexc(MINT, 0))
    ctx.move_to(pts[0][0], cy0+ch)
    for px, py in pts: ctx.line_to(px, py)
    ctx.line_to(pts[-1][0], cy0+ch); ctx.close_path(); ctx.set_source(g); ctx.fill()
    ctx.set_line_width(6); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.move_to(*pts[0])
    for px, py in pts[1:]: ctx.line_to(px, py)
    setc(ctx, MINT, a); ctx.stroke()
    ex, ey = pts[-1]; setc(ctx, MINT, a); ctx.new_sub_path(); ctx.arc(ex, ey, 10, 0, 2*math.pi); ctx.fill()
    cp = prog(lt, 2.6, 0.45)
    if cp > 0:
        s = eo_back(cp)
        ctx.save(); ctx.translate(x+w/2, y+h-10); ctx.scale(s, s)
        rrect(ctx, -230, -30, 460, 60, 30); setc(ctx, PINE900, a); ctx.fill()
        text(ctx, '▲ On track for ₹1 Cr by 34', 0, 9, SANS8, 22, MINT300, a, 'center')
        ctx.restore()
    ctx.restore()
    text(ctx, 'Illustrative', x+w-20, y+h+70, SANS5, 16, WHITE, 0.6*a, 'right')
    kinetic(ctx, [('From', SERIF, WHITE), ('anxious', SERIF, WHITE), ('to', SERIF, WHITE), ('in', SERIFI, MINT300), ('control.', SERIFI, MINT300)],
            150, 905, 80, lt, 0.5, out_t=dur-0.35)
    fi = 1 - eo_cubic(prog(lt, 0, 0.3))
    if fi > 0: setc(ctx, PINE900, fi); ctx.paint()
    wipe(ctx, prog(lt, dur-0.45, 0.85))

def s_end2(ctx, lt, dur):
    aurora(ctx, lt + 50)
    pb = prog(lt, 0.1, 0.5); bars = tuple(prog(lt, 0.35 + i*0.1, 0.45) for i in range(3))
    logo_mark(ctx, W/2, 320, 170, pb, bars)
    a = eo_cubic(prog(lt, 0.7, 0.5))
    ctx.save(); ctx.translate(0, 26*(1-a)); wordmark(ctx, W/2, 540, 104, a, WHITE, 'center'); ctx.restore()
    kinetic(ctx, [('Watch', SERIF, WHITE), ('your', SERIF, WHITE), ('money', SERIF, WHITE), ('grow.', SERIFI, MINT)], W/2, 645, 54, lt, 1.0, stagger=0.07, align='center')
    cp = prog(lt, 1.6, 0.5)
    if cp > 0:
        s = eo_back(cp); ca = clamp(cp*2)
        ctx.save(); ctx.translate(W/2, 775); ctx.scale(s, s)
        lab = 'Try the live demo  →  paywatch.in'
        tw = text_w(ctx, lab, SANS8, 30) + 80
        rrect(ctx, -tw/2, -42, tw, 84, 42); setc(ctx, MINT, ca); ctx.fill()
        sx = lerp(-tw/2 - 100, tw/2 + 100, (lt*0.6) % 1)
        g = cairo.LinearGradient(sx-80, 0, sx+80, 0); g.add_color_stop_rgba(0, 1, 1, 1, 0); g.add_color_stop_rgba(0.5, 1, 1, 1, 0.35*ca); g.add_color_stop_rgba(1, 1, 1, 1, 0)
        rrect(ctx, -tw/2, -42, tw, 84, 42); ctx.set_source(g); ctx.fill()
        text(ctx, lab, 0, 11, SANS8, 30, PINE950, ca, 'center')
        ctx.restore()
    fa = eo_cubic(prog(lt, 2.2, 0.5))
    text(ctx, 'Educational & organisation tool · Not a SEBI-registered investment adviser · Works alongside your CA', W/2, 1010, SANS5, 19, MINT300, 0.55*fa, 'center')

def s_networth2(ctx, lt, dur):
    R.s_networth(ctx, lt*5.0/dur, 5.0)
    wipe(ctx, prog(lt, dur-0.45, 0.85))

SCENES = [
    ('clip_a', R.s_clip_a, 3.8), ('overload', s_overload, 4.8), ('notime', s_notime, 4.4), ('clip_b', R.s_clip_b, 3.6),
    ('question', speed(R.s_question, 3.6), 3.0), ('logo', s_logo2, 3.4),
    ('score', speed(R.s_score, 6.0), 3.6), ('chat', speed(R.s_chat, 6.6), 4.8), ('actions', speed(R.s_actions, 5.2), 3.6),
    ('tax', speed(R.s_tax, 4.8), 3.2), ('spend', s_spend, 2.9), ('insure', s_insure, 2.9), ('invest', s_invest, 2.9),
    ('goals', s_goals, 2.6), ('alerts', s_alerts, 2.6), ('records', s_records, 3.0), ('itr', s_itr, 2.7), ('ca', s_ca, 2.5),
    ('grid', s_grid2, 3.2), ('after', s_after, 5.0), ('networth', s_networth2, 3.6), ('end', s_end2, 4.8),
]
START = {}; _acc = 0.0
for _n, _f, _d in SCENES: START[_n] = _acc; _acc += _d
TOTAL = _acc

def main():
    for k in 'abcde':
        cands = [f'/sessions/blissful-gifted-volta/mnt/PersonalCFO/video-assets/clip_{k}.mp4']
        found = [c for c in cands if os.path.exists(c)] if '--noclips' not in sys.argv else []
        CLIPS[k] = Clip(found[0]) if found else None
    print('clips:', {k: bool(v) for k, v in CLIPS.items()}, 'total', TOTAL)
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H); ctx = cairo.Context(surf)
    fo = cairo.FontOptions(); fo.set_antialias(cairo.ANTIALIAS_GRAY); fo.set_hint_style(cairo.HINT_STYLE_NONE); fo.set_hint_metrics(cairo.HINT_METRICS_OFF)
    ctx.set_font_options(fo)
    starts = [START[n] for n, _, _ in SCENES]
    def frame(T):
        i = max(j for j, s in enumerate(starts) if s <= T + 1e-9); n, fn, d = SCENES[i]
        ctx.save(); setc(ctx, '#000000'); ctx.paint(); fn(ctx, T - starts[i], d); ctx.restore()
    if PREVIEW:
        for T in [float(x) for x in sys.argv[sys.argv.index('--preview')+1].split(',')]:
            i = max(j for j, s in enumerate(starts) if s <= T); n = SCENES[i][0]
            key = {'clip_a': 'a', 'clip_b': 'b', 'after': 'c', 'overload': 'd', 'notime': 'e'}.get(n)
            if key and CLIPS.get(key):
                c = Clip(CLIPS[key].path)
                for _ in range(int((T-starts[i])*FPS)+1): c.next()
                CLIPS[key] = c
            frame(T); surf.write_to_png(f'p2_{T:05.1f}.png')
        return
    outp = '/sessions/blissful-gifted-volta/mnt/outputs/video/PayWatch-Promo-v2.mp4'
    out = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-i', '/sessions/blissful-gifted-volta/mnt/outputs/video/sfx.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outp], stdin=subprocess.PIPE)
    nf = int(round(TOTAL*FPS))
    for f in range(nf):
        frame(f/FPS); surf.flush(); out.stdin.write(bytes(surf.get_data()))
        if f % 300 == 0: print('frame', f, '/', nf, flush=True)
    out.stdin.close(); out.wait(); print('done', outp)

if __name__ == '__main__':
    main()
