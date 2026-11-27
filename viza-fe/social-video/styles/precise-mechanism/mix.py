"""Sound for a VIZA short in the Color-Coded Mechanism style: the spec's voice + foley from the entry machine + a score.

usage (any folder):  $LIB/.venv/bin/python mix.py <content/<name>> <out.wav>
Reads <content>/events.json (the page's EV) and <content>/voice.wav (the spec's voice, already at -14 LUFS).

Foley comes from the machine's own events, panned to the part: the slats rattling past while the belt indexes, the indexer's
clack when it stops, the card landing, air at the gate flaps, the stamp's thump, a metal swish for the section cut, air and
clacks for the plates. The score sits on the machine's grid: a marimba and harp figure on its quarter cycles (so the music
slows when the machine slows), a bowed vibraphone pad where the machine almost stops, one note per system as it takes its
colour, a short silence before the section cut, and an F add9 chord under the title block. Instruments: VCSL only
(harp, marimba, glockenspiel, vibraphone), CC0.
Mix: voice compressed and set about 10 dB over the music by RMS; music ducked and thinned in 300 Hz to 4 kHz under speech;
mux.sh masters to -14 LUFS, true peak <= -1 dB.
"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
LIB = os.environ.get('LIB') or os.path.expanduser('~/lemo-opuscar')
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, bp, lp, hp, add, compress, limit, click, t_, env_exp, whoosh, thump

C, OUT = sys.argv[1], sys.argv[2]
D = json.load(open(os.path.join(C, 'events.json')))
FULL = float(D['dur']); EV = D['ev']
N = int((FULL + .05) * SR); tt = np.arange(N) / SR
rng = np.random.default_rng(11)
ev = lambda kind: [e for e in EV if e['type'] == kind]
SC = ev('scene')
kind_at = lambda t: ([s for s in SC if s['t'] <= t + 1e-6] or SC[:1])[-1]
RATE = [e for e in EV if e['type'] == 'curve' and e['name'] == 'rate'][0]
rate = np.interp(tt, np.arange(len(RATE['v'])) * RATE['dt'], RATE['v'])


# ───────────── foley ─────────────
def metal_tick(bright=1.0):
    d = .09; x = t_(d)
    tr = hp(rng.standard_normal(len(x)), 2500) * np.exp(-x / .0012)
    res = sum(g * np.sin(2 * np.pi * f * bright * x + rng.random() * 6) * np.exp(-x / tau) for f, g, tau in [(2300, .6, .012), (3900, .4, .008), (5600, .3, .006)])
    y = tr * .7 + res; return y / np.abs(y).max()


def clack(v=1.0, f=1.0):
    d = .3; x = t_(d)
    k = hp(rng.standard_normal(len(x)), 1500) * np.exp(-x / .0025)
    body = sum(g * np.sin(2 * np.pi * fr * f * x) * np.exp(-x / tau) for fr, g, tau in [(1450, .5, .03), (2900, .3, .02), (380, .8, .06), (140, .7, .08)])
    y = k * .8 + body; return y / np.abs(y).max() * v


def paper(v=1.0):
    d = .12; x = t_(d)
    y = bp(rng.standard_normal(len(x)), 1800, 7000) * np.exp(-x / .018) + .5 * np.sin(2 * np.pi * 900 * x) * np.exp(-x / .01)
    return y / np.abs(y).max() * v


def air(d, f0=500, f1=2500):
    x = t_(d); n = bp(rng.standard_normal(len(x)), f0, f1)
    env = np.sin(np.pi * np.clip(x / d, 0, 1)) ** 2
    y = n * env; return y / np.abs(y).max()


def metal_swish(d, f0, f1):
    x0 = t_(d); n = rng.standard_normal(len(x0)); out = np.zeros(len(x0))
    for i in range(0, len(n), 480):
        hi = min(len(n), i + 480); f = f0 + (f1 - f0) * (i / len(n)) ** 1.3
        out[i:hi] = bp(n[max(0, i - 2000):hi], f * .8, f * 1.25)[-(hi - i):]
    env = np.minimum(1, x0 / .03) * np.exp(-np.maximum(0, x0 - .05) / (d * .4))
    x = out * env; x /= np.abs(x).max()
    y = np.zeros(int((d + .6) * SR)); y[:len(x)] += x * .7
    tk = sum(g * np.sin(2 * np.pi * f * t_(.6)) * env_exp(.6, tau) for f, g, tau in [(5240, .5, .09), (7900, .3, .05)])
    s = int((d - .06) * SR); y[s:s + len(tk)] += tk * .35
    return y


def pen(d=.18):
    x = t_(d); y = bp(rng.standard_normal(len(x)), 2500, 9000) * np.sin(np.pi * np.clip(x / d, 0, 1)) ** .5
    return y / np.abs(y).max()


fol = np.zeros((N, 2))
TICK = metal_tick()
for e in ev('index'):                         # slats passing during the index: 8 slat pitches along a cycloidal profile
    tw = .34 / max(e['rate'], 1e-3)
    if tw > 2.5: continue
    u = np.linspace(0, 1, 4001); s = u - np.sin(2 * np.pi * u) / (2 * np.pi)
    for j in range(1, 9):
        add(fol, TICK * (.6 + .4 * rng.random()), e['t'] + tw * float(np.interp(j / 8, s, u)), .05, e['pan'] * .6)
    add(fol, lp(air(tw, 300, 1800), 2500), e['t'], .025, e['pan'] * .5)
for e in ev('indexEnd'): add(fol, clack(1.0, .8), e['t'], .13, float(np.clip(e['pan'] * .6, -.7, .7)))
for e in ev('feed'): add(fol, paper(), e['t'], .10, float(np.clip(e['pan'] * .6, -.7, .7)))
for e in ev('gateOpen') + ev('gateShut'):
    add(fol, air(.35, 900, 3500), e['t'], .035, float(np.clip(e['pan'] * .6, -.7, .7)))
    add(fol, metal_tick(.7), e['t'] + .3, .04, float(np.clip(e['pan'] * .6, -.7, .7)))
for e in ev('stamp'):
    p = float(np.clip(e['pan'] * .6, -.7, .7))
    add(fol, thump(.9, 85)[:int(.35 * SR)], e['t'], .16, p); add(fol, clack(.8, 1.3), e['t'], .09, p)
for e in ev('cut'): add(fol, metal_swish(.7, 1200, 6000), e['t'], .16, .15)
for e in ev('lift'): add(fol, lp(whoosh(1.0, 1.0), 3000), e['t'], .10, 0)
for e in ev('land'): add(fol, clack(.7, 1.1), e['t'] - .05, .12, 0)
for e in ev('label') + ev('tag') + ev('readout') + ev('rule'): add(fol, hp(click(pitch=1.5, v=1.0), 2500), e['t'] + .12, .028, 0)
for e in ev('strike'): add(fol, pen(.22), e['t'], .05, -.2)
for e in ev('stampmark'):
    add(fol, thump(1.0, 110)[:int(.3 * SR)], e['t'], .16, .1); add(fol, paper(1.0), e['t'], .08, .1)
# motor: a low hum whose pitch and level follow the machine's speed
ph = np.cumsum((55 + 40 * np.clip(rate, 0, 1.2)) / SR) * 2 * np.pi
hum = (np.sin(ph) + .35 * np.sin(2 * ph) + .2 * np.sin(3 * ph)) * np.clip(rate / .3, 0, 1) ** .8
fol += np.stack([hum, hum], 1) * .012
room = lp(rng.standard_normal(N), 420, 2) * .003
fol += np.stack([room, np.roll(room, 1709)], 1)

# ───────────── score (F major, on the machine's grid) ─────────────
CH = {'F': (41, [65, 69, 72, 77]), 'C': (36, [64, 67, 72, 76]), 'Dm': (38, [62, 65, 69, 74]), 'Bb': (46, [62, 65, 70, 74]),
      'Am': (45, [64, 69, 72, 76]), 'Gm': (43, [62, 67, 70, 74])}
PROG = {'hook': ['F', 'C', 'Dm', 'Bb'], 'acronym': ['Dm'], 'notA': ['Bb', 'Gm'], 'stats': ['C', 'Am', 'F', 'C'],
        'timeline': ['Dm', 'Bb', 'F', 'C'], 'verdict': ['F', 'C', 'Dm', 'Bb'], 'cta': ['F']}
score = []
Q = ev('q')
cyc = {}                                       # chord index advances on every cycle start, restarts at every scene
def chord(t):
    s = kind_at(t); p = PROG.get(s['kind'], ['F'])
    k = sum(1 for e in Q if e['q'] == 0 and s['t'] <= e['t'] <= t)
    return CH[p[k % len(p)]]
PAT = [0, 2, 1, 3, 0, 2, 1, 3]
for i, e in enumerate(Q):
    t = e['t']; kind = kind_at(t)['kind']
    if kind == 'cta' or e['rate'] < .08: continue
    root, ns = chord(t)
    lv = .85 if kind == 'verdict' else .7
    score.append((t, 'marimba', ns[PAT[e['q'] * 2 % 8]], .5, (.36 if e['q'] == 0 else .26) * lv, -.15))
    nxt = Q[i + 1]['t'] if i + 1 < len(Q) else t + .5
    if nxt - t < 1.4: score.append(((t + nxt) / 2, 'harp', ns[PAT[(e['q'] * 2 + 1) % 8]] + 12 * (e['q'] == 3), .6, .22 * lv, .2))
    if e['q'] == 0: score.append((t, 'harp', root, 1.4, .5 * lv, -.05)); score.append((t + .01, 'harp', root + 12, 1.2, .3 * lv, -.05))
for s in SC:                                   # a bowed pad where the machine almost stops; a soft chord at every scene
    root, ns = chord(s['t'] + .01)
    if s['kind'] in ('acronym', 'notA'):
        for p in ns[:3]: score.append(dict(t=s['t'], inst='vibraphone_bowed', pitch=p, dur=max(.8, s['end'] - s['t']), vel=.34, pan=.1, attack=.3))
    elif s['kind'] != 'cta':
        score.append((s['t'], 'vibraphone', ns[1], 1.6, .28, .1))
NOTE = {'trav': ('vibraphone', 65), 'route': ('marimba', 72), 'gov': ('glockenspiel', 84), 'step': ('glockenspiel', 89)}
for e in ev('dye'):
    if not e.get('on'): continue
    inst, p = NOTE[e['g']]; score.append((e['t'], inst, p, 1.0, .42 if inst == 'glockenspiel' else .5, float(np.clip(e.get('pan', 0) * .6, -.6, .6))))
CTA = [s for s in SC if s['kind'] == 'cta']
if CTA:                                        # the last image: F add9, rung once under the title block
    t0 = CTA[0]['t'] + .25
    for i, p in enumerate([41, 48, 53, 57, 60, 67, 69]): score.append((t0 + i * .03, 'harp', p, 3.5, .5, -.3 + i * .1))
    score.append((t0, 'vibraphone', 65, 3.5, .4, .1)); score.append((t0, 'vibraphone', 72, 3.5, .34, .15))
    score.append((t0 + .02, 'glockenspiel', 79, 3.0, .36, .25))
score.sort(key=lambda x: x['t'] if isinstance(x, dict) else x[0])
S.seed(7)
music = S.render(score, dur=FULL + 4, master=False)[:N]
if len(music) < N: music = np.vstack([music, np.zeros((N - len(music), 2))])
music = S.room(music, size=.3, mix=.15)
g = np.ones(N)
for e in ev('cut'):                            # a breath before the section cut: the first sound after it is the cut
    g *= 1 - np.clip((tt - (e['t'] - .55)) / .2, 0, 1) * (tt < e['t'] + .05)
g *= np.clip((FULL + .05 - tt) / 1.2, 0, 1) ** 1.5

# ───────────── voice and balance ─────────────
x, sr = sf.read(os.path.join(C, 'voice.wav'))
if x.ndim > 1: x = x.mean(1)
if sr != SR: x = resample_poly(x, SR, sr)
voice = np.zeros(N); voice[:min(N, len(x))] = x[:N]
voice = compress(hp(voice, 70) / (np.abs(voice).max() + 1e-9), thr=.35, ratio=2.5)
env = np.convolve(np.abs(voice), np.ones(int(.05 * SR)) / int(.05 * SR), 'same')
speech = env > env.max() * .06
duck = np.convolve(speech.astype(float), np.ones(int(.3 * SR)) / int(.3 * SR), 'same').clip(0, 1)
mid = np.stack([bp(music[:, 0], 300, 4000), bp(music[:, 1], 300, 4000)], 1)
music = (music - mid * .45 * duck[:, None]) * (1 - .4 * duck)[:, None]
music *= g[:, None]
bed = music * .5 + fol
def rms(a): return np.sqrt(np.mean(a ** 2) + 1e-12)
m_rms = rms(bed[speech].mean(1)); v_rms = rms(voice[speech])
voice *= (m_rms * 10 ** (10 / 20)) / v_rms
voice = limit(voice, rms(voice[speech]) * 10 ** (9 / 20))
mix = bed + np.stack([voice, voice], 1)
mix = np.stack([compress(mix[:, 0], thr=.4, ratio=2.0), compress(mix[:, 1], thr=.4, ratio=2.0)], 1)
pk = np.abs(mix).max(); c = pk * 10 ** (-9 / 20)
mix = np.stack([limit(mix[:, 0], c), limit(mix[:, 1], c)], 1)
mix *= .63 / np.abs(mix).max()
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
sf.write(OUT, mix.astype(np.float32), SR)
open(os.path.join(os.path.dirname(os.path.abspath(OUT)), 'instruments.txt'), 'w').write('\n'.join(S.credits(['harp', 'marimba', 'glockenspiel', 'vibraphone', 'vibraphone_bowed'])))
print('mix', mix.shape, 'bed rms in speech %.1f dB' % (20 * np.log10(m_rms)), 'voice %.1f dB' % (20 * np.log10(rms(voice[speech]))))
