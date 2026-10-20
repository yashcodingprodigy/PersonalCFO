# Procedural score + SFX for the PayWatch promo, synced to render.py's timeline.
import numpy as np, sys, os
from scipy.signal import lfilter, butter
from scipy.io import wavfile

SR = 44100
TOTAL = 57.6
N = int(SR * TOTAL)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
PINGS = 8 if '--pings' in sys.argv else 4  # notification pings

def t_arr(d): return np.arange(int(SR*d)) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, fc, order=2):
    b, a = butter(order, min(fc / (SR/2), 0.99)); return lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR/2), 'high'); return lfilter(b, a, x)
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j-i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def env(n, a, r, sus=1.0):
    e = np.ones(n) * sus
    na = max(1, int(a*SR)); nr = max(1, int(r*SR))
    e[:na] = np.linspace(0, sus, na)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e

def pad(notes, dur, bright=1500, detune=0.12):
    tt = t_arr(dur); out = np.zeros_like(tt)
    for m in notes:
        f = midi(m)
        for d in (-detune, 0, detune):
            ph = rng.random()*2*np.pi
            saw = 2*((tt*f*(1+d/100) + ph/(2*np.pi)) % 1) - 1
            out += saw*0.35 + np.sin(2*np.pi*f*tt + ph)*0.65
    out = lp(out / (len(notes)*3), bright)
    return out * env(len(tt), 0.6, 0.9)

def pluck(m, dur=0.5, bright=1.0):
    tt = t_arr(dur); f = midi(m)
    s = np.sin(2*np.pi*f*tt) + 0.35*np.sin(2*np.pi*2*f*tt)*np.exp(-tt*9) + 0.12*np.sin(2*np.pi*3*f*tt)*np.exp(-tt*14)
    return s * np.exp(-tt*5.5) * env(len(tt), 0.004, 0.05)

def kick():
    tt = t_arr(0.45); f = 50 + 110*np.exp(-tt*28)
    ph = 2*np.pi*np.cumsum(f)/SR
    return np.sin(ph) * np.exp(-tt*7.5)

def hat(d=0.06):
    tt = t_arr(d); return hp(rng.standard_normal(len(tt)), 7000) * np.exp(-tt*70)

def whoosh(d=0.9, up=True):
    tt = t_arr(d); n = rng.standard_normal(len(tt))
    out = np.zeros_like(tt); seg = 512
    for k in range(0, len(tt), seg):
        p = k/len(tt); fc = 300 + (5000 if up else 3000)*(p if up else 1-p)
        out[k:k+seg] = lp(n[k:k+seg], fc)[:len(out[k:k+seg])]
    e = np.sin(np.pi*np.clip(tt/d, 0, 1))**2
    return out*e

def boom():
    tt = t_arr(2.5); f = 38 + 60*np.exp(-tt*6)
    s = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*1.6)
    n = lp(rng.standard_normal(len(tt)), 900)*np.exp(-tt*5)*0.4
    return s + n

def riser(d):
    tt = t_arr(d); f = 200*(1 + 6*(tt/d)**2)
    s = np.sin(2*np.pi*np.cumsum(f)/SR)*0.25
    n = hp(rng.standard_normal(len(tt)), 2000)*0.35
    return (s + n) * (tt/d)**2.2

def blip(f=1320, d=0.18, g=1.0):
    tt = t_arr(d); return (np.sin(2*np.pi*f*tt) + 0.3*np.sin(2*np.pi*f*1.5*tt)) * np.exp(-tt*28) * g

def ping():
    return blip(1568, 0.35) + blip(2093, 0.35)*0.5

# ---------- Section A: tension (0 – 9.0) ----------
drone = pad([38, 45, 50, 53], 9.6, bright=600, detune=0.25)
trem = 0.75 + 0.25*np.sin(2*np.pi*0.5*t_arr(9.6))
add(drone*trem, 0.0, 0.55)
for b in np.arange(0.4, 9.0, 1.0):  # heartbeat pulse
    add(kick()*0.6, b, 0.35); add(kick()*0.4, b+0.22, 0.25)
if PINGS:
    for i in range(PINGS):
        add(ping(), 0.35 + i*0.95, 0.16, pan=0.3)

add(whoosh(1.0), 8.45, 0.45)
# ---------- Section B: question + riser (9.0 – 12.6) ----------
add(pad([38, 45, 52, 57], 3.8, bright=900), 9.0, 0.45)
add(riser(3.4), 9.2, 0.5)
add(boom(), 12.6, 0.9)
add(blip(2637, 0.6)*0.6 + blip(3136, 0.6)*0.4, 12.75, 0.35)

# ---------- Section C: bright groove (12.6 – end) ----------
BPM = 100; beat = 60/BPM; bar = 4*beat
chords = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 57]]  # Dmaj7 Bm7 Gmaj7 A
arp_notes = [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]]
t = 12.6; k = 0
END = 55.6
while t < END:
    ci = k % 4
    add(pad(chords[ci], bar + 0.6, bright=2200), t, 0.32)
    add(pad([chords[ci][0]-12], bar+0.3, bright=300), t, 0.35)
    for s8 in range(8):
        tt8 = t + s8*beat/2
        if tt8 >= END: break
        n = arp_notes[ci][[0, 1, 2, 3, 2, 1, 2, 3][s8]] + (12 if s8 in (3,) else 0)
        add(pluck(n), tt8, 0.12, pan=(-0.25 if s8 % 2 else 0.25))
        add(hat(), tt8 + (0.0 if s8 % 2 == 0 else 0.02), 0.05 if s8 % 2 == 0 else 0.03, pan=0.2)
    if t >= 16.6:
        for b in (0, 2):
            add(kick(), t + b*beat, 0.5)
        for b in (1, 3):  # soft clap
            tt = t_arr(0.18); cl = hp(rng.standard_normal(len(tt)), 1500)*np.exp(-tt*30)
            add(cl, t + b*beat, 0.08)
    t += bar; k += 1
# final chord ring
add(pad([50, 57, 61, 64, 66], 4.0, bright=2500), 52.4, 0.35)
add(boom()*0.6, 52.4, 0.5)

# ---------- transitions + UI sfx ----------
for tw in (16.05, 42.45):
    add(whoosh(0.9), tw, 0.4)
for ts in (22.4, 29.0, 34.2, 39.0, 47.8):
    add(whoosh(0.6, up=False), ts, 0.22)
for tb in (19.0, 25.6, 31.8, 36.6, 37.0, 46.1, 54.4):
    add(blip(1760, 0.2), tb, 0.12)
for i in range(8):
    add(blip(1200 + i*90, 0.12), 39.65 + i*0.07, 0.06)

# ---------- master ----------
mix = np.stack([L, R], 1)
fade_in = int(0.3*SR); mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
fo = int(2.2*SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]**1.5
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix /= np.max(np.abs(mix)) + 1e-9; mix *= 0.85
wavfile.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music.wav'), SR, (mix*32767).astype(np.int16))
print('music.wav written', TOTAL, 's')
