# PayWatch promo v3 — varied feature layouts, chat→goal, markets & X-ray, in-app insurance purchase flow.
import sys, os, math, subprocess, cairo
_argv = sys.argv; sys.argv = [sys.argv[0]]
import render as R
import render2 as R2
sys.argv = _argv
from render import (W, H, FPS, hexc, setc, rrect, shadow, card, text, text_w, kinetic, eyebrow, logo_mark, aurora,
                    paper_bg, wipe, draw_clip, Clip, clamp, prog, eo_cubic, eo_expo, eio_cubic, eo_back, lerp, icon,
                    PINE950, PINE900, PINE800, PINE700, MINT, MINT300, MINT100, PAPER, PAPER100, PAPER200, INK, INKSOFT,
                    INKFAINT, RED, AMBER, WHITE, SANS5, SANS6, SANS7, SANS8)
SERIF, SERIFB, SERIFI = R.SERIF, R.SERIFB, R.SERIFI
wordmark = R2.wordmark
CLIPS = R.CLIPS
PREVIEW = '--preview' in sys.argv
ring = R2.ring

def Wd(s, c=INK): return [(w, SERIF, c) for w in s.split()]
def It(s, c=PINE700): return [(w, SERIFI, c) for w in s.split()]

def inr(n):
    n = int(n); s_ = str(n)
    if len(s_) <= 3: return s_
    head, tail = s_[:-3], s_[-3:]
    parts = []
    while len(head) > 2: parts.insert(0, head[-2:]); head = head[:-2]
    if head: parts.insert(0, head)
    return ','.join(parts) + ',' + tail

def scene_alpha(lt, dur, out=0.3):
    return 1 - eio_cubic(prog(lt, dur-out, out))

def tap(ctx, x, y, lt, t0, a=1.0):
    p = prog(lt, t0, 0.45)
    if 0 < p < 1:
        setc(ctx, PINE900, 0.25*(1-p)*a); ctx.new_sub_path(); ctx.arc(x, y, 18 + 40*eo_cubic(p), 0, 2*math.pi); ctx.fill()
        setc(ctx, WHITE, 0.9*(1-p)*a); ctx.new_sub_path(); ctx.arc(x, y, 14, 0, 2*math.pi); ctx.fill()

def phone(ctx, cx, cy, pw, ph, a, screen, bg=WHITE):
    x, y = cx - pw/2, cy - ph/2
    shadow(ctx, x, y, pw, ph, 56, a=0.45*a, spread=34, dy=26)
    rrect(ctx, x, y, pw, ph, 56); setc(ctx, '#0E1412', a); ctx.fill()
    sx, sy, sw, sh = x+14, y+14, pw-28, ph-28
    ctx.save(); rrect(ctx, sx, sy, sw, sh, 44); ctx.clip()
    setc(ctx, bg, a); ctx.paint()
    screen(ctx, sx, sy, sw, sh)
    ctx.restore()
    rrect(ctx, cx-60, y+26, 120, 30, 15); setc(ctx, '#0E1412', a); ctx.fill()   # dynamic island

def copy_block(ctx, x, y, eb, h1, h2, sub, lt, a=1.0, align='left', size=72, out_t=None, dark=False):
    ebw = text_w(ctx, eb.upper(), SANS8, 20, 4)
    eyebrow(ctx, eb, x - (ebw/2 if align == 'center' else 0), y, eo_cubic(prog(lt, 0.05, 0.35))*a, MINT if not dark else MINT300)
    kinetic(ctx, h1, x, y+95, size, lt, 0.08, stagger=0.04, dur=0.45, align=align, out_t=out_t)
    kinetic(ctx, h2, x, y+95+size*1.15, size, lt, 0.2, stagger=0.04, dur=0.45, align=align, out_t=out_t)
    pa = eo_cubic(prog(lt, 0.4, 0.4))*a; yy = y + 95 + size*1.15 + 70
    for line in sub:
        if align == 'center': text(ctx, line, x, yy, SANS5, 27, INKSOFT if not dark else MINT100, pa, 'center')
        else: text(ctx, line, x, yy, SANS5, 27, INKSOFT if not dark else MINT100, pa)
        yy += 40

# ---------- 01 SCORE — centred zoom-in gauge with orbiting dimensions ----------
def s_score3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    z = lerp(1.25, 1.0, eo_expo(prog(lt, 0, 0.9))) * lerp(1, 1.12, eio_cubic(prog(lt, dur-0.3, 0.3)))
    ctx.save(); ctx.translate(W/2, H/2); ctx.scale(max(z, 1e-3), max(z, 1e-3)); ctx.translate(-W/2, -H/2)
    eyebrow(ctx, '01 · Money Health Score', W/2 - text_w(ctx, '01 · MONEY HEALTH SCORE', SANS8, 20, 4)/2, 130, a)
    kinetic(ctx, Wd('Know exactly where you') + It('stand.'), W/2, 215, 66, lt, 0.1, stagger=0.04, align='center')
    gx, gy, Rr = W/2, 610, 215
    a0, a1 = math.radians(135), math.radians(405)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.set_line_width(38)
    setc(ctx, PAPER200, a); ctx.new_sub_path(); ctx.arc(gx, gy, Rr, a0, a1); ctx.stroke()
    sc = 78*eo_cubic(prog(lt, 0.3, 1.6)); ang = a0 + (a1-a0)*sc/100
    if sc > 0.5:
        g = cairo.LinearGradient(gx-Rr, gy, gx+Rr, gy); g.add_color_stop_rgba(0, *hexc(AMBER, a)); g.add_color_stop_rgba(.6, *hexc(MINT, a)); g.add_color_stop_rgba(1, *hexc(PINE700, a))
        ctx.set_source(g); ctx.new_sub_path(); ctx.arc(gx, gy, Rr, a0, ang); ctx.stroke()
        tx, ty = gx + Rr*math.cos(ang), gy + Rr*math.sin(ang)
        setc(ctx, WHITE, a); ctx.new_sub_path(); ctx.arc(tx, ty, 11, 0, 2*math.pi); ctx.fill()
    text(ctx, str(int(round(sc))), gx, gy+50, SERIFB, 160, INK, a, 'center')
    text(ctx, '/ 100', gx, gy+110, SANS6, 28, INKFAINT, a, 'center')
    dims = [('Savings', 86), ('Insurance', 62), ('Diversification', 74), ('Emergency', 91), ('Debt', 80), ('Tax', 68)]
    for i, (n, v) in enumerate(dims):
        p = prog(lt, 0.6 + i*0.1, 0.5)
        if p <= 0: continue
        angd = math.radians(-160 + i*64) if i < 3 else math.radians(-20 + (i-3)*64 - 0)
        side = -1 if i < 3 else 1
        px = gx + side*470; py = gy - 150 + (i % 3)*150
        s = eo_back(p); ca = clamp(p*2)*a
        ctx.save(); ctx.translate(lerp(gx, px, eo_expo(p)), lerp(gy, py, eo_expo(p))); ctx.scale(max(s, 1e-3), max(s, 1e-3))
        card(ctx, -150, -46, 300, 92, 46, WHITE, ca)
        col = MINT if v >= 75 else (AMBER if v < 65 else '#58C5A8')
        ring(ctx, -100, 0, 26, v/100*eo_cubic(prog(lt, 0.9 + i*0.1, 0.6)), col, ca, lw=9)
        text(ctx, n, -58, -4, SANS7, 21, INKSOFT, ca); text(ctx, str(v), -58, 26, SANS8, 24, INK, ca)
        ctx.restore()
    ctx.restore()

# ---------- 02 ASK → GOAL — phone on the left, dark stage ----------
CHAT_ANS = [[('Yes — ', SANS8, PINE700), ('with room to spare.', SANS6, INK)],
            [('Surplus after SIPs: ', SANS5, INKSOFT), ('₹62,000/mo', SANS8, INK)],
            [('EMI at 20% down: ', SANS5, INKSOFT), ('14% of pay', SANS8, INK)],
            [('Emergency fund ', SANS5, INKSOFT), ('stays intact', SANS8, INK)]]

def chat_screen(lt, phase_goal=0.0, gl=0.0):
    def scr(ctx, x, y, w, h):
        a = 1
        logo_mark(ctx, x+50, y+92, 40)
        text(ctx, 'Ask PayWatch', x+82, y+90, SANS8, 22, INK, a); text(ctx, '● grounded in your data', x+82, y+114, SANS6, 15, MINT, a)
        setc(ctx, PAPER200, a); ctx.rectangle(x+20, y+134, w-40, 2); ctx.fill()
        q = 'Can I afford a ₹15L car next year?'
        n = int(len(q)*prog(lt, 0.5, 1.0))
        if n > 0:
            qw = 330; rrect(ctx, x+w-20-qw, y+160, qw, 78, 22); setc(ctx, PINE900, a); ctx.fill()
            words = q[:n]; cut = 20
            text(ctx, words[:cut], x+w-20-qw+20, y+192, SANS7, 20, WHITE, a); text(ctx, words[cut:].lstrip(), x+w-20-qw+20, y+222, SANS7, 20, WHITE, a)
        if 1.6 < lt < 2.1:
            for i in range(3):
                setc(ctx, INKFAINT, a); ctx.new_sub_path(); ctx.arc(x+50+i*20, y+275+math.sin(lt*12-i)*4, 6, 0, 2*math.pi); ctx.fill()
        if lt >= 2.1:
            k = prog(lt, 2.1, 1.0)*4
            shown = [ln for i, ln in enumerate(CHAT_ANS) if k > i]
            if shown:
                bh = 30 + 36*len(shown)
                rrect(ctx, x+20, y+258, w-60, bh, 20); setc(ctx, MINT100, a); ctx.fill()
                rrect(ctx, x+20, y+258, 6, bh, 3); setc(ctx, MINT, a); ctx.fill()
                yy = y+292
                for ln in shown:
                    xx = x+40
                    for seg, f, c in ln: xx += text(ctx, seg, xx, yy, f, 19, c, a)
                    yy += 36
        cp = eo_cubic(prog(lt, 3.3, 0.4))
        if cp > 0:
            for i, c in enumerate(['Add as a goal', 'Show EMI math']):
                cw = text_w(ctx, c, SANS8, 18) + 34; cx = x+20 + i*(text_w(ctx, 'Add as a goal', SANS8, 18) + 48)
                hl = (i == 0)
                rrect(ctx, cx, y+430, cw, 46, 23); setc(ctx, MINT if hl else PAPER100, cp); ctx.fill()
                text(ctx, c, cx+17, y+460, SANS8, 18, PINE950 if hl else PINE700, cp)
        # goal sheet
        if phase_goal > 0:
            sp = eo_expo(phase_goal)
            setc(ctx, '#000000', 0.35*sp); ctx.rectangle(x, y, w, h); ctx.fill()
            sy = y + h - lerp(0, 520, sp)
            rrect(ctx, x, sy, w, 560, 34); setc(ctx, WHITE, 1); ctx.fill()
            rrect(ctx, x+w/2-30, sy+14, 60, 6, 3); setc(ctx, PAPER200, 1); ctx.fill()
            text(ctx, 'New goal', x+30, sy+70, SANS8, 26, INK, 1)
            rows = [('Goal', 'Car fund'), ('Target', '₹15,00,000'), ('By', 'Oct 2027'), ('Monthly', '₹62,000')]
            for i, (k_, v) in enumerate(rows):
                yy = sy + 130 + i*64
                text(ctx, k_, x+30, yy, SANS6, 19, INKFAINT, 1); text(ctx, v, x+w-30, yy, SANS8, 21, INK, 1, 'right')
                setc(ctx, PAPER100, 1); ctx.rectangle(x+30, yy+20, w-60, 2); ctx.fill()
            pressed = gl > 1.7
            rrect(ctx, x+30, sy+400, w-60, 64, 32); setc(ctx, PINE700 if pressed else PINE900, 1); ctx.fill()
            text(ctx, '✓ Goal added' if gl > 1.85 else 'Add goal', x+w/2, sy+440, SANS8, 22, WHITE, 1, 'center')
    return scr

def s_chat3(ctx, lt, dur):
    aurora(ctx, lt + 20)
    phone(ctx, 560, 560, 460, 900, 1.0, chat_screen(lt))
    tap(ctx, 560-230+14+20+60, 560-450+14+430+23, lt, 3.9)
    copy_block(ctx, 1000, 330, '02 · Ask PayWatch', Wd('An AI advisor that', WHITE), It('knows your numbers.', MINT300),
               ['Ask in plain language. Answers', 'come from your real data.'], lt, dark=True)
    enter = 1 - eo_expo(prog(lt, 0, 0.6))
    if enter > 0: setc(ctx, PINE900, enter); ctx.paint()

def s_goal3(ctx, lt, dur):
    aurora(ctx, lt + 24.4)
    gp = prog(lt, 0.0, 0.55)
    phone(ctx, 560, 560, 460, 900, 1.0, chat_screen(4.4, phase_goal=gp, gl=lt))
    tap(ctx, 560, 560-450+14+(900-28)-520+400+32, lt, 1.6)
    a = scene_alpha(lt, dur)
    # right: goals list with new goal sliding in
    kinetic(ctx, Wd('Like the answer?', WHITE), 1000, 300, 64, lt, 0.1, stagger=0.04)
    kinetic(ctx, It('Make it a goal. One tap.', MINT300), 1000, 380, 64, lt, 0.25, stagger=0.04)
    items = [('Car fund', '₹0 of ₹15L', 0.0, 'New'), ('Emergency fund', '₹4.8L of ₹5.4L', 0.89, 'On track'), ('Goa trip', '₹27K of ₹60K', 0.45, 'Dec 2026')]
    newp = eo_back(prog(lt, 1.95, 0.5)) if prog(lt, 1.95, 0.5) > 0 else 0
    for i, (n, sub, fr, tag) in enumerate(items):
        if i == 0 and newp <= 0: continue
        yy = 470 if i == 0 else 470 + (i-1)*150 + 150*clamp(newp)
        s = newp if i == 0 else 1
        ctx.save(); ctx.translate(1000 + 360, yy + 60); ctx.scale(max(s, 1e-3), max(s, 1e-3)); ctx.translate(-360, -60)
        card(ctx, 0, 0, 720, 124, 26, WHITE, a)
        text(ctx, n, 30, 50, SANS8, 26, INK, a); text(ctx, sub, 30, 84, SANS5, 19, INKFAINT, a)
        tw = text_w(ctx, tag, SANS8, 17) + 28
        rrect(ctx, 690-tw, 26, tw, 38, 19); setc(ctx, MINT if i == 0 else MINT100, a); ctx.fill(); text(ctx, tag, 690-tw/2, 51, SANS8, 17, PINE950 if i == 0 else PINE700, a, 'center')
        rrect(ctx, 30, 100, 660, 10, 5); setc(ctx, PAPER100, a); ctx.fill()
        rrect(ctx, 30, 100, 660*fr, 10, 5); setc(ctx, MINT, a); ctx.fill()
        ctx.restore()
    wipe(ctx, prog(lt, dur-0.45, 0.85))

# ---------- 03 ACTIONS — headline top, 3 cards flip in as columns ----------
def s_actions3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    eyebrow(ctx, '03 · Your action plan', W/2 - text_w(ctx, '03 · YOUR ACTION PLAN', SANS8, 20, 4)/2, 150, eo_cubic(prog(lt, .05, .3))*a)
    kinetic(ctx, Wd('Not charts.') + It('Next moves.'), W/2, 240, 76, lt, 0.08, stagger=0.05, align='center', out_t=dur-0.3)
    items = [('HIGH', RED, 'Top up emergency fund', 'Reach 6 months of expenses', '+₹1.2L safety net'),
             ('HIGH', RED, 'Switch to new tax regime', 'Based on your deductions', 'Save ₹38,400 / yr'),
             ('MEDIUM', AMBER, 'Raise SIP by ₹5,000', 'Step-up with your salary', '+₹14L in 10 yrs*')]
    cw, ch, gap = 500, 400, 40; x0 = W/2 - (3*cw + 2*gap)/2
    for i, (pr, pc, t1, t2, chip) in enumerate(items):
        p = prog(lt, 0.3 + i*0.15, 0.55)
        if p <= 0: continue
        fy = eo_back(p, 1.2)
        x = x0 + i*(cw+gap); y = 360
        ctx.save(); ctx.translate(x + cw/2, y + ch/2); ctx.scale(1, max(0.02, fy)); ctx.translate(-cw/2, -ch/2)
        ca = clamp(p*2)*a
        card(ctx, 0, 0, cw, ch, 32, WHITE, ca)
        tw = text_w(ctx, pr, SANS8, 16, 2) + 28
        rrect(ctx, 36, 36, tw, 34, 17); setc(ctx, pc, .14*ca); ctx.fill(); text(ctx, pr, 50, 59, SANS8, 16, pc, ca, track=2)
        done = i == 1 and lt > 1.6
        text(ctx, t1, 36, 150, SANS8, 30, INKFAINT if done else INK, ca)
        if done: setc(ctx, INKFAINT, ca); ctx.rectangle(36, 140, text_w(ctx, t1, SANS8, 30)*eo_cubic(prog(lt, 1.7, .3)), 3); ctx.fill()
        text(ctx, t2, 36, 190, SANS5, 22, INKFAINT, ca)
        chw = text_w(ctx, chip, SANS8, 24) + 44
        rrect(ctx, 36, 240, chw, 60, 30); setc(ctx, MINT100, ca); ctx.fill(); text(ctx, chip, 36 + chw/2, 279, SANS8, 24, PINE700, ca, 'center')
        bx, by = 36, 330
        rrect(ctx, bx, by, cw-72, 50, 25)
        if i == 1 and lt > 1.55:
            setc(ctx, MINT, ca); ctx.fill(); text(ctx, '✓  Done', cw/2, by+33, SANS8, 21, PINE950, ca, 'center')
        else:
            setc(ctx, PAPER200, ca); ctx.set_line_width(2); ctx.stroke(); text(ctx, 'Mark done', cw/2, by+33, SANS8, 21, PINE700, ca, 'center')
        ctx.restore()
    tap(ctx, x0 + cw + gap + cw/2, 360 + 330 + 25, lt, 1.4)
    tp = prog(lt, 1.9, .45)
    if tp > 0:
        s = eo_back(tp); ctx.save(); ctx.translate(W/2, 860); ctx.scale(max(s, 1e-3), max(s, 1e-3))
        card(ctx, -230, -40, 460, 80, 40, PINE900, a); logo_mark(ctx, -180, 0, 44)
        text(ctx, f'Score  72  →  {int(lerp(72, 78, eo_cubic(prog(lt, 2.0, .7))))}', -140, 10, SANS8, 27, WHITE, a); ctx.restore()

# ---------- 04 TAX — mirrored: vertical bar race left, copy right ----------
def s_tax3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    ctx.save(); ctx.translate(70*(1-a), 0)
    copy_block(ctx, 1080, 330, '04 · Tax copilot', Wd('Your taxes,'), It('already worked out.'),
               ['Every income head, both regimes,', 'TDS reconciled — ready to self-file.'], lt, a)
    base = 900
    setc(ctx, PAPER200, a); ctx.rectangle(160, base, 780, 3); ctx.fill()
    for i, (lab, v, col, tc) in enumerate((('Old regime', 246800, PAPER200, INK), ('New regime', 208400, MINT, PINE900))):
        p = eo_expo(prog(lt, 0.25 + i*0.25, 0.9)); bh = 600*v/260000*p; bx = 230 + i*360
        rrect(ctx, bx, base - bh, 260, bh + 20, 24); setc(ctx, col, a); ctx.fill()
        setc(ctx, PAPER, 1); ctx.rectangle(bx-5, base+3, 270, 30); ctx.fill()
        text(ctx, lab, bx+130, base+48, SANS7, 24, INKSOFT, a, 'center')
        if p > .2: text(ctx, '₹' + inr(v*p), bx+130, base - bh + 56, SANS8, 30, tc, a*clamp((p-.2)*3), 'center')
    sp = prog(lt, 1.4, .45)
    if sp > 0:
        s = eo_back(sp, 2.2); ctx.save(); ctx.translate(560, 250); ctx.rotate(math.radians(-6)*s); ctx.scale(max(s, 1e-3), max(s, 1e-3))
        rrect(ctx, -250, -58, 500, 116, 30); setc(ctx, PINE900, a); ctx.fill()
        text(ctx, 'You save', -210, 12, SANS7, 26, MINT300, a); text(ctx, '₹38,400', 210, 20, SERIFB, 54, WHITE, a, 'right')
        ctx.restore()
    ctx.restore()

# ---------- 05 MARKETS — dark stage, scrolling news ticker + portfolio X-ray ----------
NEWS = ['Sensex ends higher; IT and banks lead the gains', 'RBI holds repo rate steady — what it means for your EMI',
        'Gold climbs on global cues', 'Mid-caps outperform for a third straight week', 'New capital-gains rules, explained simply',
        'Why index funds suit most first-time investors']
def s_markets(ctx, lt, dur):
    aurora(ctx, lt + 60); a = scene_alpha(lt, dur)
    # ticker
    ty = 120; setc(ctx, '#000000', 0.25*a); ctx.rectangle(0, ty-50, W, 100); ctx.fill()
    rrect(ctx, 40, ty-28, 150, 56, 28); setc(ctx, RED, a); ctx.fill(); text(ctx, '● LIVE', 115, ty+9, SANS8, 20, WHITE, a, 'center')
    ctx.save(); ctx.rectangle(210, ty-50, W-210, 100); ctx.clip()
    xx = 230 - lt*420
    for k in range(3):
        for n in NEWS:
            w_ = text_w(ctx, n, SANS7, 26)
            if xx > -w_ and xx < W: text(ctx, n, xx, ty+9, SANS7, 26, WHITE, a)
            xx += w_ + 40
            if -w_ < xx < W: text(ctx, '•', xx-26, ty+9, SANS8, 26, MINT, a)
    ctx.restore()
    copy_block(ctx, 140, 330, '05 · Markets & portfolio X-ray', Wd('Markets, explained', WHITE), It('— not hyped.', MINT300),
               ['Plain-English news, and a look-through', 'of what you actually own.'], lt, a, dark=True)
    p = eo_expo(prog(lt, 0.3, 0.7)); x, y, w, h = 1000, 250 + 120*(1-p), 780, 700
    card(ctx, x, y, w, h, 34, WHITE, p*a); ca = p*a
    text(ctx, 'Your portfolio X-ray', x+44, y+70, SANS8, 28, INK, ca)
    gp = eo_back(prog(lt, 1.6, .4)) if prog(lt, 1.6, .4) > 0 else 0
    if gp > 0:
        ctx.save(); ctx.translate(x+w-90, y+60); ctx.scale(max(gp, 1e-3), max(gp, 1e-3))
        setc(ctx, AMBER, ca); ctx.new_sub_path(); ctx.arc(0, 0, 44, 0, 2*math.pi); ctx.fill(); text(ctx, 'B', 0, 15, SERIFB, 44, WHITE, ca, 'center'); ctx.restore()
    text(ctx, 'Market cap', x+44, y+140, SANS7, 20, INKFAINT, ca)
    cx0 = x+44; tot = w-88; bp = eo_cubic(prog(lt, 0.6, 0.8))
    for lab, v, col in (('Large 52%', 52, PINE700), ('Mid 28%', 28, MINT), ('Small 20%', 20, MINT300)):
        ww = tot*v/100*bp
        rrect(ctx, cx0, y+160, max(ww-6, 1), 54, 12); setc(ctx, col, ca); ctx.fill()
        if bp > .8: text(ctx, lab, cx0+16, y+195, SANS8, 19, WHITE if col != MINT300 else PINE900, ca)
        cx0 += ww
    text(ctx, 'Sector concentration', x+44, y+270, SANS7, 20, INKFAINT, ca)
    for i, (sec, v, col) in enumerate((('IT', 42, RED), ('Banks', 18, MINT), ('FMCG', 12, MINT), ('Pharma', 9, MINT), ('Others', 19, PAPER200))):
        yy = y+310 + i*52; sp_ = eo_expo(prog(lt, 0.8 + i*.08, .6))
        text(ctx, sec, x+44, yy+22, SANS7, 21, INK, ca)
        rrect(ctx, x+170, yy+4, (w-300)*v/45*sp_, 26, 13); setc(ctx, col, ca); ctx.fill()
        text(ctx, f'{v}%', x+w-44, yy+24, SANS8, 21, RED if v > 40 else INK, ca, 'right')
    fp = eo_cubic(prog(lt, 1.9, .4))*ca
    rrect(ctx, x+44, y+h-90, w-88, 60, 18); setc(ctx, RED, .1*fp); ctx.fill()
    text(ctx, '⚠  42% in one sector — consider diversifying', x+70, y+h-51, SANS8, 21, RED, fp)
    text(ctx, 'Educational look-through · no stock tips or buy/sell calls', x+w, y+h+40, SANS5, 17, MINT100, .7*ca, 'right')

# ---------- 06 STATEMENT SCAN — spinning donut left, copy right ----------
def s_spend3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    copy_block(ctx, 1080, 330, '06 · Statement scan', Wd('See where'), It('it all goes.'), ['Upload a bank statement —', 'we spot what you could save.'], lt, a)
    cats = [('Rent & bills', 34, PINE700), ('Food', 22, MINT), ('Shopping', 16, AMBER), ('Travel', 10, '#58C5A8'), ('Subscriptions', 8, RED), ('Other', 10, PAPER200)]
    cx, cy, rr = 520, 540, 230
    rot = lerp(-2.2, 0, eo_expo(prog(lt, 0, 1.0))); pd = eo_cubic(prog(lt, 0.1, 0.9)); ang = -math.pi/2 + rot
    ctx.set_line_width(90)
    for n, v, col in cats:
        sw = 2*math.pi*v/100*pd; setc(ctx, col, a); ctx.new_sub_path(); ctx.arc(cx, cy, rr, ang, ang + sw - .025); ctx.stroke()
        mid = ang + sw/2; lp_ = eo_back(prog(lt, 0.7, .5)) if prog(lt, 0.7, .5) > 0 else 0
        if lp_ > 0:
            lx, ly = cx + (rr+150)*math.cos(mid), cy + (rr+130)*math.sin(mid)
            text(ctx, f'{n} {v}%', lx, ly, SANS8, 21, INKSOFT, a*clamp(lp_), 'center')
        ang += sw
    text(ctx, '₹84,320', cx, cy+10, SERIFB, 64, INK, a, 'center'); text(ctx, 'spent in September', cx, cy+50, SANS6, 21, INKFAINT, a, 'center')
    sp = prog(lt, 1.3, .45)
    if sp > 0:
        s = eo_back(sp); ctx.save(); ctx.translate(1380, 860); ctx.scale(max(s, 1e-3), max(s, 1e-3))
        rrect(ctx, -300, -44, 600, 88, 28); setc(ctx, PINE900, a); ctx.fill()
        text(ctx, 'You could’ve saved', -270, 10, SANS7, 24, MINT300, a); text(ctx, '₹6,240', 270, 15, SERIFB, 40, WHITE, a, 'right'); ctx.restore()

# ---------- 07 INSURANCE — in-app purchase flow inside a phone ----------
PLANS = [('A', 'Insurer A · Health Plus', '99.1%', '₹12,480', '★ Matches your inputs'),
         ('B', 'Insurer B · Secure Care', '98.4%', '₹11,950', 'Lowest indicative premium'),
         ('C', 'Insurer C · Family Shield', '97.2%', '₹13,900', '')]
ADDONS = [('Room-rent waiver', 1240), ('Restore benefit', 860), ('OPD cover', 2100)]
def ins_screen(lt):
    def scr(ctx, x, y, w, h):
        # screen index by time
        steps = [0.0, 1.9, 3.4, 4.4, 5.6]
        k = sum(1 for s_ in steps if lt >= s_) - 1
        # slide offset between screens
        tr = 0.0
        for i in range(1, len(steps)):
            tr += eo_expo(prog(lt, steps[i], 0.45))
        ox = -tr*w
        def S(i, fn):
            sx = x + i*w + ox
            if sx < x + w and sx + w > x: fn(sx)
        top = y + 80
        def s0(sx):
            text(ctx, 'Health insurance', sx+28, top+20, SANS8, 26, INK, 1); text(ctx, '₹10L cover · you, 26 · Bengaluru', sx+28, top+50, SANS5, 17, INKFAINT, 1)
            for i, (m, n, cr, pr, badge) in enumerate(PLANS):
                yy = top + 80 + i*170; p = eo_expo(prog(lt, 0.2 + i*0.12, .5))
                ctx.save(); ctx.translate(0, 40*(1-p))
                rrect(ctx, sx+20, yy, w-40, 150, 22); setc(ctx, WHITE, p); ctx.fill()
                rrect(ctx, sx+20, yy, w-40, 150, 22); setc(ctx, MINT if i == 0 else PAPER200, p); ctx.set_line_width(3 if i == 0 else 2); ctx.stroke()
                setc(ctx, PINE900, p); ctx.new_sub_path(); ctx.arc(sx+66, yy+52, 24, 0, 2*math.pi); ctx.fill(); text(ctx, m, sx+66, yy+61, SANS8, 22, WHITE, p, 'center')
                text(ctx, n, sx+102, yy+48, SANS8, 19, INK, p); text(ctx, f'Claims settled {cr}', sx+102, yy+74, SANS5, 15, INKFAINT, p)
                text(ctx, pr, sx+44, yy+124, SERIFB, 28, INK, p); text(ctx, '/yr', sx+44+text_w(ctx, pr, SERIFB, 28)+4, yy+124, SANS5, 15, INKFAINT, p)
                if badge:
                    bw = text_w(ctx, badge, SANS8, 12) + 20
                    rrect(ctx, sx+w-40-bw, yy+100, bw, 30, 15); setc(ctx, MINT100, p); ctx.fill(); text(ctx, badge, sx+w-40-bw/2, yy+120, SANS8, 12, PINE700, p, 'center')
                ctx.restore()
        def s1(sx):
            text(ctx, 'Customise your plan', sx+28, top+20, SANS8, 26, INK, 1); text(ctx, 'Insurer A · Health Plus', sx+28, top+50, SANS5, 17, INKFAINT, 1)
            tot = 12480
            for i, (n, pr) in enumerate(ADDONS):
                yy = top + 90 + i*110; on = lt > 2.25 + i*0.3
                if on: tot += pr
                rrect(ctx, sx+20, yy, w-40, 92, 20); setc(ctx, PAPER100, 1); ctx.fill()
                text(ctx, n, sx+44, yy+40, SANS8, 20, INK, 1); text(ctx, f'+₹{pr:,}/yr', sx+44, yy+68, SANS5, 16, INKFAINT, 1)
                tx_ = sx+w-110
                rrect(ctx, tx_, yy+28, 70, 38, 19); setc(ctx, MINT if on else PAPER200, 1); ctx.fill()
                setc(ctx, WHITE, 1); ctx.new_sub_path(); ctx.arc(tx_ + (51 if on else 19), yy+47, 15, 0, 2*math.pi); ctx.fill()
            rrect(ctx, sx+20, top+460, w-40, 100, 22); setc(ctx, PINE900, 1); ctx.fill()
            text(ctx, 'Indicative premium', sx+44, top+500, SANS6, 17, MINT300, 1); text(ctx, f'₹{tot:,}/yr', sx+44, top+538, SERIFB, 30, WHITE, 1)
        def s2(sx):
            cx, cy = sx + w/2, y + h*0.42
            ctx.set_line_width(12); ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            setc(ctx, PAPER200, 1); ctx.new_sub_path(); ctx.arc(cx, cy, 60, 0, 2*math.pi); ctx.stroke()
            setc(ctx, MINT, 1); a0 = lt*6; ctx.new_sub_path(); ctx.arc(cx, cy, 60, a0, a0 + 1.8); ctx.stroke()
            text(ctx, 'Calculating your', cx, cy+130, SANS8, 24, INK, 1, 'center'); text(ctx, 'final premium…', cx, cy+164, SANS8, 24, INK, 1, 'center')
        def s3(sx):
            text(ctx, 'Review & confirm', sx+28, top+20, SANS8, 26, INK, 1)
            rows = [('Base premium', '₹12,480'), ('Add-ons', '₹4,200'), ('GST (18%)', '₹3,002'), ('Total / year', '₹19,682')]
            for i, (k_, v) in enumerate(rows):
                yy = top + 100 + i*62; b = i == 3
                text(ctx, k_, sx+28, yy, SANS8 if b else SANS6, 21 if b else 19, INK if b else INKSOFT, 1); text(ctx, v, sx+w-28, yy, SERIFB if b else SANS8, 26 if b else 20, INK, 1, 'right')
                setc(ctx, PAPER100, 1); ctx.rectangle(sx+28, yy+22, w-56, 2); ctx.fill()
            text(ctx, '✓ I agree to share my details', sx+28, top+380, SANS6, 17, PINE700, 1)
            pressed = lt > 5.3
            rrect(ctx, sx+20, top+440, w-40, 70, 35); setc(ctx, PINE700 if pressed else PINE900, 1); ctx.fill()
            text(ctx, 'Continue with our licensed partner', sx+w/2, top+482, SANS8, 18, WHITE, 1, 'center')
        def s4(sx):
            cx, cy = sx + w/2, y + h*0.38; p = eo_back(prog(lt, 5.7, .5)) if prog(lt, 5.7, .5) > 0 else 0
            ctx.save(); ctx.translate(cx, cy); ctx.scale(max(p, 1e-3), max(p, 1e-3))
            setc(ctx, MINT, 1); ctx.new_sub_path(); ctx.arc(0, 0, 70, 0, 2*math.pi); ctx.fill()
            ctx.set_line_width(12); setc(ctx, WHITE, 1); ctx.move_to(-28, 2); ctx.line_to(-8, 24); ctx.line_to(30, -20); ctx.stroke(); ctx.restore()
            text(ctx, 'Application submitted', cx, cy+140, SANS8, 26, INK, 1, 'center')
            text(ctx, 'Your IRDAI-licensed partner', cx, cy+180, SANS5, 18, INKFAINT, 1, 'center')
            text(ctx, 'will issue the policy', cx, cy+206, SANS5, 18, INKFAINT, 1, 'center')
        for i, fn in enumerate((s0, s1, s2, s3, s4)): S(i, fn)
    return scr

def s_insure3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    rg = cairo.RadialGradient(1150, 540, 0, 1150, 540, 700); rg.add_color_stop_rgba(0, *hexc(MINT, .25)); rg.add_color_stop_rgba(1, *hexc(MINT, 0)); ctx.set_source(rg); ctx.paint()
    copy_block(ctx, 140, 300, '07 · Insurance, in-app', Wd('Compare. Customise.'), It('Buy — without leaving.'),
               ['Plans matched to your inputs,', 'bought in-app via our IRDAI-', 'licensed partner.'], lt, a, size=64)
    pp = eo_expo(prog(lt, 0, .7))
    ctx.save(); ctx.translate(0, 200*(1-pp))
    phone(ctx, 1080, 560, 470, 940, a, ins_screen(lt))
    ctx.restore()
    # taps
    tap(ctx, 1080, 560-470+14+80+80+75, lt, 1.6); tap(ctx, 1080+150, 560-470+14+80+90+47, lt, 2.15)
    tap(ctx, 1080+150, 560-470+14+80+200+47, lt, 2.45); tap(ctx, 1080, 560-470+14+80+475, lt, 5.15)
    # step rail
    steps = ['Compare plans', 'Add riders', 'Final premium', 'Review & GST', 'Submitted']
    cur = sum(1 for s_ in [0.0, 1.9, 3.4, 4.4, 5.6] if lt >= s_) - 1
    for i, s_ in enumerate(steps):
        yy = 300 + i*120; ia = eo_cubic(prog(lt, .3 + i*.06, .3))*a
        done = i < cur; now = i == cur
        setc(ctx, MINT if (done or now) else PAPER200, ia); ctx.new_sub_path(); ctx.arc(1420, yy, 22, 0, 2*math.pi); ctx.fill()
        text(ctx, '✓' if done else str(i+1), 1420, yy+8, SANS8, 20, PINE950 if (done or now) else INKFAINT, ia, 'center')
        text(ctx, s_, 1462, yy+9, SANS8 if now else SANS6, 25, INK if (done or now) else INKFAINT, ia)
        if i < 4: setc(ctx, MINT if done else PAPER200, ia); ctx.rectangle(1418, yy+26, 4, 68); ctx.fill()
    text(ctx, 'Illustrative · indicative premiums', 140, 990, SANS5, 18, INKFAINT, .9*a)
    text(ctx, 'Subject to insurer underwriting · not advice', 140, 1018, SANS5, 18, INKFAINT, .9*a)

# ---------- 08 ALERTS — lock-screen notifications on dark ----------
def s_alerts3(ctx, lt, dur):
    aurora(ctx, lt + 70); a = scene_alpha(lt, dur)
    copy_block(ctx, 1080, 360, '08 · Proactive alerts', Wd('It taps you', WHITE), It('before it costs you.', MINT300),
               ['Deadlines, renewals and slip-ups', '— caught early.'], lt, a, dark=True)
    items = [('Advance tax due in 5 days', 'Pay ₹14,200 by 15 Dec to avoid interest', RED),
             ('Health policy renews in 12 days', 'Tap to compare before you renew', AMBER),
             ('Dining spend up 38%', '₹4,100 above your usual this month', AMBER),
             ('Emergency fund: 6 months ✓', 'Nice — you’re fully covered', MINT)]
    def scr(ctx, x, y, w, h):
        g = cairo.LinearGradient(0, y, 0, y+h); g.add_color_stop_rgba(0, *hexc('#1F5C52')); g.add_color_stop_rgba(1, *hexc(PINE950)); ctx.set_source(g); ctx.paint()
        text(ctx, 'Thursday, 15 October', x+w/2, y+130, SANS6, 20, WHITE, .8, 'center')
        text(ctx, '9:41', x+w/2, y+240, SANS7, 110, WHITE, 1, 'center')
        for i, (t1, t2, col) in enumerate(items):
            p = prog(lt, 0.3 + i*0.32, .45)
            if p <= 0: continue
            e = eo_back(p, 1.4); yy = y + 300 + i*128
            ctx.save(); ctx.translate(0, -60*(1-e))
            rrect(ctx, x+16, yy, w-32, 112, 24); ctx.set_source_rgba(1, 1, 1, .9*clamp(p*2)); ctx.fill()
            rrect(ctx, x+34, yy+18, 34, 34, 9); setc(ctx, MINT, clamp(p*2)); ctx.fill()
            text(ctx, 'PAYWATCH', x+80, yy+42, SANS8, 13, INKFAINT, clamp(p*2), track=2)
            setc(ctx, col, clamp(p*2)); ctx.new_sub_path(); ctx.arc(x+w-46, yy+36, 7, 0, 2*math.pi); ctx.fill()
            text(ctx, t1, x+34, yy+76, SANS8, 18, INK, clamp(p*2)); text(ctx, t2, x+34, yy+98, SANS5, 14, INKSOFT, clamp(p*2))
            ctx.restore()
    pp = eo_expo(prog(lt, 0, .6))
    ctx.save(); ctx.translate(-160*(1-pp), 0); ctx.translate(560, 540); ctx.rotate(math.radians(-4)*(1-pp)); ctx.translate(-560, -540)
    phone(ctx, 560, 560, 440, 900, a, scr); ctx.restore()

# ---------- 09 ITR — headline top-left, horizontal timeline ----------
def s_itr3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    copy_block(ctx, 140, 170, '09 · File it yourself', Wd('ITR, step by step.'), It('No panic.'), [], lt, a, size=70)
    p = eo_back(prog(lt, .2, .5)) if prog(lt, .2, .5) > 0 else 0
    ctx.save(); ctx.translate(1440, 260); ctx.scale(max(p, 1e-3), max(p, 1e-3))
    card(ctx, -320, -80, 640, 160, 34, PINE900, a)
    text(ctx, 'ITR-1 · New regime', -280, -14, SANS8, 26, WHITE, a); text(ctx, 'Refund due', -280, 22, SANS6, 20, MINT300, a)
    text(ctx, '₹12,450', 280, 20, SERIFB, 56, WHITE, a, 'right'); ctx.restore()
    steps = ['Gather Form 16 & AIS', 'Match TDS with 26AS', 'Log in to the portal', 'Fill & verify', 'Submit & e-verify']
    y = 640; x0, x1 = 220, 1700
    setc(ctx, PAPER200, a); rrect(ctx, x0, y-5, x1-x0, 10, 5); ctx.fill()
    fp = eo_cubic(prog(lt, .4, 1.6))
    setc(ctx, MINT, a); rrect(ctx, x0, y-5, (x1-x0)*fp, 10, 5); ctx.fill()
    for i, s_ in enumerate(steps):
        nx = x0 + (x1-x0)*i/4; on = fp >= i/4 - 1e-3
        np_ = eo_back(prog(lt, .4 + 1.6*i/4, .3)) if on else 0
        setc(ctx, WHITE, a); ctx.new_sub_path(); ctx.arc(nx, y, 40, 0, 2*math.pi); ctx.fill()
        setc(ctx, MINT if on else PAPER200, a); ctx.set_line_width(6); ctx.new_sub_path(); ctx.arc(nx, y, 40, 0, 2*math.pi); ctx.stroke()
        if on:
            ctx.save(); ctx.translate(nx, y); ctx.scale(max(np_, .01), max(np_, .01)); setc(ctx, MINT, a); ctx.new_sub_path(); ctx.arc(0, 0, 30, 0, 2*math.pi); ctx.fill()
            text(ctx, '✓', 0, 10, SANS8, 30, WHITE, a, 'center'); ctx.restore()
        else: text(ctx, str(i+1), nx, y+10, SANS8, 26, INKFAINT, a, 'center')
        text(ctx, s_, nx, y+100, SANS8 if on else SANS6, 24, INK if on else INKFAINT, a, 'center')
    text(ctx, 'Right form, right regime — personalised to your computed return.', W/2, 900, SANS5, 26, INKSOFT, eo_cubic(prog(lt, .6, .4))*a, 'center')

# ---------- 10 CA — two-sided handoff, docs fly across ----------
def s_ca3(ctx, lt, dur):
    paper_bg(ctx, lt); a = scene_alpha(lt, dur)
    eyebrow(ctx, '10 · Works with your CA', W/2 - text_w(ctx, '10 · WORKS WITH YOUR CA', SANS8, 20, 4)/2, 150, a)
    kinetic(ctx, Wd('Your CA gets') + It('a ready pack.'), W/2, 240, 72, lt, .08, stagger=.05, align='center', out_t=dur-.3)
    for side, (lab, sub, ini, cx) in enumerate((('You', 'PayWatch app', 'Y', 420), ('CA Rajesh Mehta', 'Connected privately', 'RM', 1500))):
        p = eo_back(prog(lt, .15 + side*.1, .5)) if prog(lt, .15 + side*.1, .5) > 0 else 0
        ctx.save(); ctx.translate(cx, 560); ctx.scale(max(p, 1e-3), max(p, 1e-3))
        card(ctx, -190, -170, 380, 340, 40, WHITE, a)
        setc(ctx, PINE700 if side else MINT, a); ctx.new_sub_path(); ctx.arc(0, -60, 62, 0, 2*math.pi); ctx.fill()
        text(ctx, ini, 0, -46, SANS8, 40, WHITE if side else PINE950, a, 'center')
        text(ctx, lab, 0, 50, SANS8, 26, INK, a, 'center'); text(ctx, sub, 0, 86, SANS6, 19, MINT if side else INKFAINT, a, 'center')
        ctx.restore()
    docs = ['CA-ready tax pack', 'Form 16 + payslips', 'Capital gains statement']
    for i, d in enumerate(docs):
        p = eio_cubic(prog(lt, .7 + i*.3, .8))
        if p <= 0: continue
        x = lerp(600, 1320, p); y = 560 - math.sin(p*math.pi)*(170 + i*40) + (i-1)*60
        da = a*clamp(p/0.12)*(1 - clamp((p-0.85)/0.15))
        if da <= 0: continue
        dw = text_w(ctx, d, SANS8, 21) + 80
        ctx.save(); ctx.translate(x, y); ctx.rotate(math.sin(p*math.pi)*math.radians(-5))
        card(ctx, -dw/2, -32, dw, 64, 32, WHITE, da); rrect(ctx, -dw/2+14, -18, 36, 36, 9); setc(ctx, MINT, da); ctx.fill(); icon(ctx, 'Tax', -dw/2+32, 0, da)
        text(ctx, d, -dw/2+62, 8, SANS8, 21, INK, da); ctx.restore()
    sh = prog(lt, 1.9, .3)
    if sh > 0: text(ctx, '✓ 3 documents shared · encrypted', 1500, 790, SANS8, 22, PINE700, sh*a, 'center')

def s_grid3(ctx, lt, dur):
    aurora(ctx, lt + 30)
    out = eio_cubic(prog(lt, dur-0.35, 0.35)); a0 = 1-out
    kinetic(ctx, [('One', SERIF, WHITE), ('app.', SERIF, WHITE), ('Your', SERIFI, MINT300), ('whole', SERIFI, MINT300), ('financial', SERIFI, MINT300), ('life.', SERIFI, MINT300)],
            W/2, 220, 76, lt, 0.05, stagger=0.05, align='center', out_t=dur-0.35)
    tiles = [('Money Health Score', 'Score'), ('Ask PayWatch AI', 'Chat'), ('Goals from chat', 'Invest'), ('Tax & ITR prep', 'Tax'),
             ('Insurance marketplace', 'Shield'), ('Markets & news', 'Invest'), ('Portfolio X-ray', 'Net'), ('Statement scan', 'Score'),
             ('Proactive alerts', 'Shield'), ('Document vault', 'Vault'), ('Works with your CA', 'CA'), ('Net worth tracker', 'Net')]
    tw, th, gap = 380, 150, 24; gx0 = W/2 - (4*tw + 3*gap)/2
    for i, (lab, ic) in enumerate(tiles):
        r, c = divmod(i, 4); pp = prog(lt, 0.3 + i*0.05, 0.45)
        if pp <= 0: continue
        s = eo_back(pp, 1.4); ta = clamp(pp*2.5)*a0
        cx = gx0 + c*(tw+gap) + tw/2; cy = 340 + r*(th+gap) + th/2
        ctx.save(); ctx.translate(cx, cy); ctx.scale(max(s, 1e-3), max(s, 1e-3))
        rrect(ctx, -tw/2, -th/2, tw, th, 26); setc(ctx, WHITE, 0.07*ta); ctx.fill()
        rrect(ctx, -tw/2, -th/2, tw, th, 26); setc(ctx, MINT300, 0.25*ta); ctx.set_line_width(2); ctx.stroke()
        rrect(ctx, -tw/2+26, -32, 64, 64, 18); setc(ctx, MINT, ta); ctx.fill(); icon(ctx, ic, -tw/2+58, 0, ta)
        text(ctx, lab, -tw/2+110, 9, SANS8, 23, WHITE, ta); ctx.restore()
    wipe(ctx, prog(lt, dur-0.5, 0.85))

def s_question3(ctx, lt, dur): R2.speed(R.s_question, 3.6)(ctx, lt, dur)

SCENES = [
    ('clip_a', R.s_clip_a, 3.8), ('overload', R2.s_overload, 4.8), ('notime', R2.s_notime, 4.4), ('clip_b', R.s_clip_b, 3.6),
    ('question', s_question3, 3.0), ('logo', R2.s_logo2, 3.4),
    ('score', s_score3, 3.4), ('chat', s_chat3, 4.4), ('goal', s_goal3, 3.2), ('actions', s_actions3, 3.2),
    ('tax', s_tax3, 3.0), ('markets', s_markets, 4.4), ('spend', s_spend3, 2.9), ('insure', s_insure3, 6.6),
    ('alerts', s_alerts3, 2.9), ('itr', s_itr3, 2.9), ('ca', s_ca3, 2.8), ('grid', s_grid3, 3.1),
    ('after', R2.s_after, 5.0), ('networth', R2.s_networth2, 3.6), ('end', R2.s_end2, 4.8),
]
START = {}; _acc = 0.0
for _n, _f, _d in SCENES: START[_n] = _acc; _acc += _d
TOTAL = _acc

def main():
    for k in 'abcde':
        p = f'/sessions/blissful-gifted-volta/mnt/PersonalCFO/video-assets/clip_{k}.mp4'
        CLIPS[k] = Clip(p) if os.path.exists(p) else None
    print('total', TOTAL, {k: bool(v) for k, v in CLIPS.items()})
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
            frame(T); surf.write_to_png(f'p3_{T:05.1f}.png')
        return
    outp = '/sessions/blissful-gifted-volta/mnt/outputs/video/PayWatch-Promo-v3.mp4'
    out = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-i', '/sessions/blissful-gifted-volta/mnt/outputs/video/sfx3.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outp], stdin=subprocess.PIPE)
    nf = int(round(TOTAL*FPS))
    for f in range(nf):
        frame(f/FPS); surf.flush(); out.stdin.write(bytes(surf.get_data()))
        if f % 300 == 0: print('frame', f, '/', nf, flush=True)
    out.stdin.close(); out.wait(); print('done', outp)

if __name__ == '__main__':
    main()
