# SFX-only audio for promo v2 (no music — user adds their own). Keeps the tension bed in the sad opening.
import sys, os, numpy as np
from scipy.signal import lfilter, butter
from scipy.io import wavfile
sys.argv = [sys.argv[0]]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render3 import START, TOTAL, SCENES

SR = 44100; N = int(SR*TOTAL)
L = np.zeros(N); Rr = np.zeros(N); rng = np.random.default_rng(3)
DUR = {n: d for n, _, d in SCENES}

def t_arr(d): return np.arange(int(SR*d))/SR
def midi(m): return 440*2**((m-69)/12)
def lp(x, fc): b, a = butter(2, min(fc/(SR/2), .99)); return lfilter(b, a, x)
def hp(x, fc): b, a = butter(2, fc/(SR/2), 'high'); return lfilter(b, a, x)
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start*SR); j = min(N, i+len(sig))
    if j <= i or i < 0: return
    s = sig[:j-i]*gain; L[i:j] += s*(1-max(0, pan)); Rr[i:j] += s*(1+min(0, pan))

def pad(notes, dur, bright=600, det=0.25):
    tt = t_arr(dur); out = np.zeros_like(tt)
    for m in notes:
        f = midi(m)
        for d in (-det, 0, det):
            ph = rng.random()*6.28
            out += (2*((tt*f*(1+d/100) + ph/6.28) % 1) - 1)*0.35 + np.sin(6.28*f*tt + ph)*0.65
    out = lp(out/(len(notes)*3), bright)
    e = np.ones(len(tt)); na = int(.8*SR); nr = int(1.2*SR); e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr)
    return out*e
def kick(): tt = t_arr(.45); f = 50+110*np.exp(-tt*28); return np.sin(6.28*np.cumsum(f)/SR)*np.exp(-tt*7.5)
def whoosh(d=.8, up=True):
    tt = t_arr(d); n = rng.standard_normal(len(tt)); out = np.zeros_like(tt); seg = 512
    for k in range(0, len(tt), seg):
        p = k/len(tt); fc = 300 + 4500*(p if up else 1-p); out[k:k+seg] = lp(n[k:k+seg], fc)[:len(out[k:k+seg])]
    return out*np.sin(np.pi*np.clip(tt/d, 0, 1))**2
def boom():
    tt = t_arr(2.4); f = 38+60*np.exp(-tt*6)
    return np.sin(6.28*np.cumsum(f)/SR)*np.exp(-tt*1.6) + lp(rng.standard_normal(len(tt)), 900)*np.exp(-tt*5)*.4
def riser(d):
    tt = t_arr(d); f = 200*(1+6*(tt/d)**2)
    return (np.sin(6.28*np.cumsum(f)/SR)*.25 + hp(rng.standard_normal(len(tt)), 2000)*.35)*(tt/d)**2.2
def blip(f=1320, d=.18): tt = t_arr(d); return (np.sin(6.28*f*tt) + .3*np.sin(6.28*f*1.5*tt))*np.exp(-tt*28)
def pop(f=900):
    tt = t_arr(.12); fr = f*(1+1.2*np.exp(-tt*60)); return np.sin(6.28*np.cumsum(fr)/SR)*np.exp(-tt*40)
def ping(): return blip(1568, .35) + blip(2093, .35)*.5
def tick(): tt = t_arr(.03); return hp(rng.standard_normal(len(tt)), 3000)*np.exp(-tt*200)
def click(): tt = t_arr(.02); return hp(rng.standard_normal(len(tt)), 2500)*np.exp(-tt*300)
def buzz(d=.35):
    tt = t_arr(d); return np.sign(np.sin(6.28*150*tt))*.3*lp(np.ones(len(tt)), 50)*(np.sin(6.28*14*tt) > 0)
def chime(notes=(76, 81, 88)):
    out = np.zeros(int(SR*1.2))
    for k, m in enumerate(notes):
        s = blip(midi(m), 1.0)*0 + np.sin(6.28*midi(m)*t_arr(1.0))*np.exp(-t_arr(1.0)*4)
        i = int(k*.07*SR); out[i:i+len(s)] += s[:len(out)-i]*.5
    return out
def S(n): return START[n]
def scale(n, base): return DUR[n]/base   # for sped-up v1 scenes

# ---- sad opening: tension bed (kept) ----
bed = pad([38, 45, 50, 53], S('logo') + 0.8)
bed *= 0.75 + 0.25*np.sin(6.28*0.5*np.arange(len(bed))/SR)
add(bed, 0, 0.5)
for b in np.arange(0.4, S('question'), 1.0):
    add(kick()*.6, b, .33); add(kick()*.4, b+.22, .22)
for i in range(4): add(ping(), S('clip_a') + 0.35 + i*0.95, .16, .3)
for i in range(10): add(pop(700 + i*70), S('overload') + 0.25 + 0.42*i - 0.012*i*i, .22, (-.4 if i % 2 else .4))
for b in (0.6, 1.9, 3.1): add(buzz(), S('overload') + b, .12)
for k in np.arange(0, DUR['notime'], 0.5): add(tick(), S('notime') + k, .18)
for i in range(5): add(pop(520), S('notime') + 0.6 + i*0.28, .12)
add(whoosh(1.0), S('question') - 0.55, .4)
add(boom(), S('logo'), .9)
add(chime((88, 93, 100)), S('logo') + 0.15, .25)
add(whoosh(.9), S('score') - 0.5, .4)

# ---- features ----
for n in ['chat', 'actions', 'tax', 'markets', 'spend', 'insure', 'alerts', 'itr', 'ca']: add(whoosh(.45, up=False), S(n) - 0.2, .22)
for i in range(6): add(pop(900 + i*60), S('score') + 0.6 + i*0.1, .12)
add(blip(1760), S('score') + 1.9, .12)
for c in np.arange(0.5, 1.5, 0.06): add(click(), S('chat') + c, .12)
add(blip(1320), S('chat') + 2.1, .12)
add(click(), S('chat') + 3.9, .5); add(pop(1000), S('goal') + 0.05, .18)
add(click(), S('goal') + 1.6, .5); add(chime(), S('goal') + 1.95, .22)
for i in range(3): add(pop(700 + i*100), S('actions') + 0.3 + i*0.15, .18)
add(click(), S('actions') + 1.4, .5); add(chime(), S('actions') + 1.9, .2)
add(pop(900), S('tax') + 1.4, .25)
for i in range(5): add(blip(1100 + i*80, .1), S('markets') + 0.8 + i*0.08, .06)
add(blip(900, .3), S('markets') + 1.6, .12)
add(pop(900), S('spend') + 1.3, .22)
for t_ in (1.6, 2.15, 2.45, 5.15): add(click(), S('insure') + t_, .5)
for t_ in (1.9, 3.4, 4.4, 5.6): add(whoosh(.35, up=False), S('insure') + t_ - 0.05, .12)
add(chime((81, 85, 88, 93)), S('insure') + 5.7, .28)
for i in range(4): add(ping(), S('alerts') + 0.3 + i*0.32, .1, .2)
for i in range(5): add(blip(1500 + i*120, .12), S('itr') + 0.4 + 1.6*i/4, .1)
for i in range(3): add(whoosh(.5), S('ca') + 0.7 + i*0.3, .12)
for i in range(12): add(pop(1100 + i*40), S('grid') + 0.3 + i*0.05, .08, (-.3 if i % 2 else .3))
add(whoosh(.9), S('after') - 0.5, .4)

# ---- aftermath ----
tt = t_arr(3.0); f = 600*(1 + 1.5*(tt/3.0)); sh = np.sin(6.28*np.cumsum(f)/SR)*.15*(tt/3.0) + hp(rng.standard_normal(len(tt)), 6000)*.05*(tt/3.0)
add(sh, S('after') + 0.7, .5)
add(chime((81, 85, 88, 93)), S('after') + 2.6, .3)
add(whoosh(.9), S('networth') - 0.45, .35)
add(whoosh(.9), S('end') - 0.45, .35)
add(boom()*.6, S('end'), .5)
add(chime((88, 93, 100)), S('end') + 1.6, .22)

mix = np.stack([L, Rr], 1)
mix = np.tanh(mix*1.3)/np.tanh(1.3)
mix /= np.max(np.abs(mix)) + 1e-9; mix *= 0.8
fo = int(1.0*SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
wavfile.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx3.wav'), SR, (mix*32767).astype(np.int16))
print('sfx3.wav', TOTAL)
