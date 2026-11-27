"""mix.py · score + foley + ambience + voice for one VIZA short in the Silkscreen Travel Poster style → mix.wav
  $LIB/.venv/bin/python mix.py <events.json> <voice.wav> <out.wav>
Everything follows the page's own timeline (events.json from core/render/events.mjs): every scene has an even number of beats
near 100 BPM, so each scene starts on a downbeat; pulls and printed items sit on sixteenths of that grid.
Score: hand-played acoustic folk, synthesised here (no sample download): plucked nylon guitar (a ukulele for island places)
by Karplus-Strong through scipy's lfilter, an upright bass, brushes and a shaker from filtered noise, and a glockenspiel
that answers only the accent ink (the sun, the key number, the URL). One pull, one hit: each ink of the opening print gets a pluck.
A beat of silence before the verdict; the re-ink sweep and a full chord land on its downbeat.
Foley by material: squeegee over mesh (band-passed noise with a 230 to 280 Hz grain), wet ink squelch, screen clack and hinge,
paper stamps for printed items, ticks for the dashed route, a wood-and-metal clamp for the registration snap.
Balance: the voice is compressed and sits about 12 dB (RMS) over the music; the music dips 300 Hz to 4 kHz and ducks under speech."""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import lfilter, resample_poly
from scipy.ndimage import maximum_filter1d, uniform_filter1d
LIB = os.environ.get('LIB') or os.path.expanduser('~/lemo-opuscar')
sys.path.insert(0, os.path.join(LIB, 'core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, clack, creak, thump, whoosh, compress, limit, add

EVJ = json.load(open(sys.argv[1])); EV = EVJ['ev']; DUR = float(EVJ['dur'])
VOICE, OUT = sys.argv[2], sys.argv[3]
N = int((DUR + 1.5) * SR)
tt = np.arange(N) / SR
rng = np.random.default_rng(5)
meta = next(e for e in EV if e['type'] == 'meta'); KIND = meta['kind']; SEED = int(meta.get('seed', 1))
def evs(tp): return [e for e in EV if e['type'] == tp]
SCENES = evs('scene')
SIL = [(e['t'], e['t'] + e['dur']) for e in evs('silence')]
def silent(t): return any(a - .01 <= t < b for a, b in SIL)

# ---------------- instruments ----------------
_ks = {}
def ks(freq, dur, bright=.55, decay=2.6, pos=.2, var=0):
    """Karplus-Strong plucked string: a noise burst through a tuned feedback comb with a two-tap loss filter (scipy lfilter)."""
    key = (round(freq, 2), round(dur, 2), round(bright, 2), round(decay, 2), var)
    if key in _ks: return _ks[key]
    n = int(dur * SR); P = SR / freq; D = int(np.floor(P)); w = P - D
    r = np.random.default_rng(int(freq * 10) + var)
    ex = r.uniform(-1, 1, D)
    ex = lfilter([1 - bright * .0 - (1 - bright) * .7], [1, -(1 - bright) * .7], ex)          # darker pluck = smoother burst
    ex = ex - np.roll(ex, max(1, int(pos * D)))                                                   # pluck position
    x = np.zeros(n); x[:D] = ex
    g = 10 ** (-3 / (decay * freq))
    a = np.zeros(D + 2); a[0] = 1; a[D] = -g * (1 - w) * .5 - g * .5 * (1 - w); a[D + 1] = -g * w * .5 - g * .5 * w
    # (two-tap average split by the fractional delay; the taps sum to g)
    a[D] = -g * (1 - w); a[D + 1] = -g * w
    y = lfilter([1.0], a, x)
    y = lp(y, 1200 + 5200 * bright) + .25 * bp(y, 90, 260)                                      # string tone + a little body
    f = min(n, int(.03 * SR)); y[-f:] *= np.linspace(1, 0, f)
    y = norm(y)
    _ks[key] = y
    return y
def hzm(m): return 440.0 * 2 ** ((m - 69) / 12)
UKE = KIND == 'islands'
def pluck(m, at, vel=.5, dur=1.8, pan=0., stem=None, bright=.5):
    if UKE: m2, d2, b2 = m + 12 if m < 60 else m, min(dur, 1.0), bright + .15
    else: m2, d2, b2 = m, dur, bright
    add(stem if stem is not None else GT, ks(hzm(m2), d2, b2, 2.2 if not UKE else 1.1, var=int(m2) % 3) * vel, at + rng.normal(0, .003), 1.0, pan)
def strum(notes, at, vel=.45, up=False, spread=.014, dur=1.2):
    ns = notes[::-1] if up else notes
    for i, m in enumerate(ns): pluck(m, at + i * spread, vel * (1 - .05 * i) * (.7 if up else 1), dur, .12 + .04 * i, bright=.45 if not up else .6)
def bass(m, at, vel=.6, dur=1.1):
    y = ks(hzm(m), dur, .25, 1.3, .12, var=1)
    y = lp(y, 900) + .35 * norm(np.sin(2 * np.pi * hzm(m) * 2 * t_(dur)) * env_exp(dur, .25))   # 2nd harmonic so it speaks on phones
    add(BS, y * vel, at, 1.0, 0)
def glock(m, at, vel=.4, pan=.3):
    d = 2.2; x = t_(d); f = hzm(m)
    y = sum(a * np.sin(2 * np.pi * f * r * x) * np.exp(-x / tau) for r, a, tau in [(1, 1, .9), (2.76, .35, .25), (5.4, .18, .1), (8.93, .08, .05)])
    add(GL, norm(y) * vel, at, 1.0, pan)
def brush(at, vel=.3):
    d = .16; x = t_(d)
    add(PC, norm(bp(noise(d), 1800, 8000) * np.minimum(1, x / .02) * np.exp(-x / .05)) * vel, at, 1.0, -.2)
def shaker(at, vel=.15):
    d = .07; x = t_(d)
    add(PC, norm(hp(noise(d), 5000) * np.sin(np.pi * x / d) ** 2) * vel, at, 1.0, .35)
def kick(at, vel=.5):
    d = .3; x = t_(d)
    add(PC, norm(np.sin(2 * np.pi * (55 + 60 * np.exp(-x / .03)) * x) * np.exp(-x / .09) + lp(noise(d), 400) * np.exp(-x / .01) * .4) * vel, at, 1.0, 0)

GT = np.zeros((N, 2)); BS = np.zeros((N, 2)); GL = np.zeros((N, 2)); PC = np.zeros((N, 2))
KEY = [48, 50, 53, 55, 52][SEED % 5]                      # C, D, F, G or E major, picked per video
MAJ = [0, 2, 4, 5, 7, 9, 11]
def chord_pcs(deg): return [(KEY + MAJ[(deg + k) % 7] + 12 * ((deg + k) // 7)) % 12 for k in (0, 2, 4)]
def voicing(deg): return [m for m in range(52, 72) if m % 12 in chord_pcs(deg)][:5]
def root_bass(deg): pc = chord_pcs(deg)[0]; return next(m for m in range(36, 48) if m % 12 == pc)
PROG = {'hook': [0, 4, 5, 3], 'acronym': [3, 4], 'notA': [5, 3, 0, 4], 'stats': [0, 3, 4, 0], 'timeline': [0, 2, 3, 4], 'verdict': [3, 4, 0, 5], 'cta': [3, 4, 0, 0]}
BUSY = {'stats', 'timeline', 'cta'}

lift = next((e['t'] for e in evs('lift')), 1.5)
beats = evs('beat')
last_scene = SCENES[-1]
for b in beats:
    t = b['t']; sc = SCENES[b['i']]; kind = sc['kind']; k = b['k']; n = b['n']; bl = sc['bl']
    if t < lift - .05 or silent(t): continue
    per = 4 if n > 6 else 2
    prog = PROG.get(kind, [0, 3, 4, 0]); deg = prog[(k // per) % len(prog)]
    if b['i'] == last_scene['i']:                       # the end: land on the tonic and let it ring
        if t > DUR - 1.7: continue
        if t + bl > DUR - 1.7:
            strum(voicing(0), t, .55, dur=3.0); bass(root_bass(0), t, .7, 2.4); glock(KEY + 24, t + .02, .35); continue
    vel = .44 + (.06 if kind in BUSY else 0)
    if k % 2 == 0:
        bass(root_bass(deg), t, .62 if k % per == 0 else .5)
        pluck(voicing(deg)[0], t, .42, 1.2, -.1)
        if k == 0 and b['i'] > 0: kick(t, .55)
    else:
        strum(voicing(deg)[1:], t, vel)
        if b['i'] > 0 or t > lift: brush(t, .28)
    if kind in BUSY or (kind == 'hook' and t > lift + 2):
        strum(voicing(deg)[2:], t + bl / 2, vel * .55, up=True, spread=.01, dur=.5)
    if kind in BUSY: shaker(t, .14); shaker(t + bl / 2, .1)

# one pull, one hit: each ink of the opening print gets a rising pluck; accent events ring the glockenspiel
open_pulls = sorted([e for e in evs('pull') if e.get('layer') and e['t'] < lift + .1], key=lambda e: e['t'])
tones = [m for m in range(55, 84) if m % 12 in chord_pcs(0)]
for j, e in enumerate(open_pulls): pluck(tones[min(j, len(tones) - 1)], e['t'] + .02, .4, 1.4, -.2 + .05 * j, bright=.6)
for e in EV:
    if e.get('accent') and not silent(e['t']): glock(tones[(SEED + int(e['t'] * 7)) % 5] + 12, e['t'] + .01, .28)
for e in evs('scene'):
    if e['kind'] == 'verdict' and e['i'] > 0:            # after the silence: the chord lands with the sweep
        strum(voicing(PROG['verdict'][0]), e['t'], .6); bass(root_bass(PROG['verdict'][0]), e['t'], .8); kick(e['t'], .8)
mus = GT * .9 + BS * .85 + GL * .5 + PC * .6

# ---------------- foley ----------------
FO = np.zeros((N, 2))
def scrape(d, bright=1.0, heavy=0.0, attack=.02):
    n = noise(d); x = t_(d)
    grain = .65 + .35 * np.abs(np.sin(2 * np.pi * (230 + 50 * bright) * x + rng.random() * 6)) ** 2
    y = bp(n, 700 * bright, min(9000, 5200 * bright), 2) * grain + lp(noise(d), 380) * (.5 + heavy) * .6
    e = np.minimum(1, x / max(attack, 1e-3)) * np.minimum(1, (d - x) / .06) * (1 - .25 * x / d)
    return norm(y * e)
def squelch(f=140):
    d = .16; x = t_(d)
    return norm(np.sin(2 * np.pi * f * x * (1 - .9 * x)) * env_exp(d, .05) + lp(noise(d), 900) * env_exp(d, .03) * .5)
def tick(f=3200):
    d = .03; x = t_(d)
    return norm(hp(noise(d), 2500) * env_exp(d, .003) + np.sin(2 * np.pi * f * x) * env_exp(d, .004) * .4)
def stamp():
    d = .14; x = t_(d)
    return norm(lp(noise(d), 1200) * env_exp(d, .012) + np.sin(2 * np.pi * 160 * x) * env_exp(d, .03) * .7 + bp(noise(d), 2500, 6000) * env_exp(d, .006) * .4)
def clamp_hit():
    d = .6; x = t_(d)
    wood = sum(a * np.sin(2 * np.pi * f * x) * env_exp(d, tau) for f, a, tau in [(520, 1, .03), (1180, .6, .02), (240, .8, .05)])
    metal = sum(a * np.sin(2 * np.pi * f * x) * env_exp(d, tau) for f, a, tau in [(2410, .5, .18), (3890, .3, .12), (5230, .18, .08)])
    return norm(wood + metal + hp(noise(d), 3000) * env_exp(d, .002) * 1.2)
for e in EV:
    t, tp = e['t'], e['type']
    if silent(t): continue
    d = max(.08, float(e.get('dur', .25) or .25))
    if tp == 'pull':
        big = e.get('layer') in ('sky1', 'sky2', 'far', 'mid', 'near', 'foot') or d >= .26
        add(FO, scrape(d, 1.0 + .3 * rng.random(), .25 if big else .1), t, .42 if big else .28, rng.uniform(-.3, .3)); add(FO, squelch(130 + 40 * rng.random()), t, .16, 0)
    elif tp == 'sweep':
        add(FO, scrape(d + .1, .85, .8), t, .6, 0); add(FO, squelch(95), t, .3, 0)
        if e.get('fountain'): add(FO, squelch(140), t + .1, .2, -.3); add(FO, squelch(170), t + .18, .16, .3)
    elif tp == 'lift':
        add(FO, clack(.65, 1), t, .3, 0); add(FO, creak(1), t + .04, .14, .2); add(FO, whoosh(.3, 1), t + .02, .08, 0)
    elif tp == 'header':
        add(FO, scrape(.28, 1.2, .3, attack=.004), t, .3, -.3); add(FO, squelch(170), t, .16, -.3)
    elif tp == 'item':
        add(FO, stamp(), t, .45 if not e.get('accent') else .6, .3); add(FO, tick(2400), t, .14, .3)
        if e.get('count'):
            for k in range(8): add(FO, tick(2600 + 120 * k), t + k * .06, .06, .4)
    elif tp == 'strike':
        add(FO, scrape(.16, 1.6, 0, attack=.003), t, .3, .2)
    elif tp == 'tick':
        add(FO, tick(2800 + 400 * rng.random()), t, .16, .4)
    elif tp == 'snap':
        add(FO, clamp_hit(), t, .9, 0); add(FO, thump(1, 60), t, .5, 0)

# ---------------- ambience: room tone, and the place waking up inside the print ----------------
AM = np.zeros((N, 2))
room = lp(brown(N / SR), 240) * .5 + bp(noise(N / SR), 150, 900) * .07
AM[:, 0] += room * .04; AM[:, 1] += room * .038
swell = .55 + .45 * np.sin(2 * np.pi * .16 * tt + 1.2) ** 2
if KIND in ('harbour', 'islands'):
    water = (lp(noise(N / SR), 650) * .7 + bp(noise(N / SR), 1200, 4500) * .12) * swell
    AM[:, 0] += water * .03; AM[:, 1] += np.roll(water, 800) * .03
else:
    wind = (lp(noise(N / SR), 900) * .6 + bp(noise(N / SR), 1500, 5000) * .08) * (.55 + .45 * np.sin(2 * np.pi * .13 * tt + .7) ** 2)
    AM[:, 0] += wind * .028; AM[:, 1] += np.roll(wind, 900) * .028
def chirp(d=.09, f0=3800, f1=5200):
    x = t_(d); f = np.linspace(f0, f1, len(x)); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / d) ** 2)
r2 = np.random.default_rng(4)
for k in range(10):
    t0 = lift + .3 + k * .9 + r2.random() * .5
    if t0 < DUR: add(AM, chirp(.06 + .05 * r2.random(), 2600 + 1800 * r2.random(), 3600 + 2000 * r2.random()), t0, .005, r2.uniform(-.8, .8))
amb_env = np.clip(np.minimum(tt / .6, (DUR - tt) / .8), 0, 1)
AM *= amb_env[:, None]

# ---------------- voice ----------------
v, sr = sf.read(VOICE, always_2d=True); v = v.mean(1)
if sr != SR: v = resample_poly(v, SR, sr)
v = hp(v, 70)
v = compress(v / (np.abs(v).max() + 1e-9) * .9, thr=.3, ratio=2.2, att=.004, rel=.1)
VO = np.zeros((N, 2)); L = min(N, len(v)); VO[:L, 0] = v[:L]; VO[:L, 1] = v[:L]

# ---------------- mix ----------------
mid = np.stack([bp(mus[:, c], 300, 4000) for c in range(2)], 1); mus = mus - mid * .35
ve = np.abs(VO[:, 0]); ve = uniform_filter1d(maximum_filter1d(ve, int(.25 * SR)), int(.12 * SR))
mus *= (1 - .3 * np.clip(ve / (ve.max() + 1e-9) * 4, 0, 1))[:, None]
vmask = ve > ve.max() * .08; mmask = np.abs(mus).max(1) > 1e-4
def rms(x, m): return np.sqrt((x[m] ** 2).mean() + 1e-12)
vr = rms(VO[:, 0], vmask); mr = rms(mus.mean(1), mmask); fr = rms(FO.mean(1), np.abs(FO).max(1) > 1e-4)
mus *= (vr / mr) / 10 ** (12 / 20)
FO *= (vr / fr) / 10 ** (15 / 20)
for a, b in SIL: mus[int(a * SR):int(b * SR)] = 0; FO[int(a * SR):int(b * SR)] = 0
mix = mus + FO + AM * (vr / .05) * .5 + VO
mix = mix[:int(DUR * SR)]
fo = int(.25 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
for c in range(2): mix[:, c] = limit(mix[:, c] / (np.abs(mix).max() + 1e-9) * .95, .92)
assert np.isfinite(mix).all()
sf.write(OUT, mix.astype(np.float32), SR, subtype='FLOAT')
db = lambda x: 20 * np.log10(x + 1e-12)
print(f'{OUT}: {DUR:.2f}s  key {KEY}  {KIND}{" (ukulele)" if UKE else ""}  voice-music gap {db(vr) - db(rms(mus.mean(1), mmask)):.1f} dB')
