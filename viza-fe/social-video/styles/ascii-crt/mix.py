"""VIZA ascii-crt mix: python mix.py events.json voice.wav out.wav
Original analogue-synth score (PolyBLEP saw/square, filter envelopes, tape wow, long reverb; never chiptune), synthesised foley
(buckling-spring keys, teletype ticks, relay, degauss, error beeps, BEL, digit ratchets, raster ticks), room tone, the VIZA voice on top.
Music cues come from the page's events: one chord per scene, a 16th sequencer in the busy scenes, the only major chord on the CTA address.
Music ducked about 8 dB under the voice; mux.sh brings the master to -14 LUFS. Pure numpy/scipy (no numba needed)."""
import json, os, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly
sys.path.insert(0, os.path.join(os.environ.get('LIB', os.path.expanduser('~/lemo-opuscar')), 'core/audio'))
from sfx import limit

evf, voicef, outf = sys.argv[1:4]
SR = 48000
rng = np.random.default_rng(20260915)
E = json.load(open(evf)); DUR = E['dur'] + .3; N = int(DUR * SR)
EV = E['ev']
def T(d): return np.arange(int(round(d * SR))) / SR
def nz(d): return rng.standard_normal(int(round(d * SR)))
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
bus = {k: np.zeros((N, 2)) for k in ['sfx', 'bed', 'vo', 'music']}
def add(name, x, at, g=1.0, pan=0.0):
    i = int(round(at * SR))
    if i >= N or len(x) == 0 or i < 0: return
    x = x[:N - i]
    if x.ndim == 2: bus[name][i:i + len(x)] += x * g; return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[name][i:i + len(x), 0] += x * g * l * 1.414; bus[name][i:i + len(x), 1] += x * g * r * 1.414

# ---------------- foley (after LIB styles/ascii-crt/demo/mix.py) ----------------
def key(v=1.0, kind='key'):
    d = .09; t = T(d); p = rng.uniform(.93, 1.08)
    clickn = hp(nz(d), 2200) * np.exp(-t / .0028)
    ping = np.sin(2 * np.pi * 3400 * p * t) * np.exp(-t / .03) * .22 + np.sin(2 * np.pi * 5230 * p * t) * np.exp(-t / .015) * .1
    thock = bp(nz(d), 260 * p, 900 * p) * np.exp(-np.maximum(0, t - .012) / .012) * (t > .01) * 1.3
    if kind == 'space': thock = lp(thock * 1.6, 500); ping *= .4
    if kind == 'enter': thock *= 2.0
    return (clickn * .8 + ping + thock) * v
def tick(v=1.0):
    d = .03; t = T(d)
    return (bp(nz(d), 1200, 4200) * np.exp(-t / .004) + np.sin(2 * np.pi * 1850 * t) * np.exp(-t / .008) * .3) * v
def relay(v=1.0):
    d = .12; t = T(d)
    return (hp(nz(d), 1500) * np.exp(-t / .004) * .8 + bp(nz(d), 80, 400) * np.exp(-t / .03) * 1.4 +
            hp(nz(d), 1500) * np.exp(-np.maximum(0, t - .035) / .003) * (t > .035) * .4) * v
def degauss(v=1.0):
    d = 1.1; t = T(d); wob = 1 + .04 * np.sin(2 * np.pi * 7 * t)
    hum = sum(np.sin(2 * np.pi * 50 * h * t * wob) / h for h in (1, 2, 3, 5)) * np.exp(-t / .3)
    return (np.tanh(hum * 1.5) * .6 + lp(nz(d), 120) * np.exp(-t / .08) * 3) * v
def err(f=466, d=.16, v=1.0):
    t = T(d); x = np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * 2 * t) * .15
    return lp(np.tanh(x * 1.6), 3500) * np.minimum(1, t / .004) * np.minimum(1, (d - t) / .01) * v
def bel(v=1.0):
    d = .45; t = T(d)
    return (np.sin(2 * np.pi * 1000 * t) + .3 * np.sin(2 * np.pi * 2000 * t)) * np.exp(-t / .12) * np.minimum(1, t / .003) * v
def ratchet(v=1.0):
    d = .02; t = T(d); return hp(nz(d), 2500) * np.exp(-t / .002) * v
def landtick(n, v=1.0):
    d = .02; t = T(d); x = np.zeros_like(t)
    for _ in range(min(n, 5)):
        f = rng.uniform(2200, 6000); o = rng.uniform(0, .008)
        x += np.sin(2 * np.pi * f * t) * np.exp(-np.maximum(0, t - o) / .003) * (t >= o)
    return x * v
def hit(v=1.0):          # gated-reverb hit: thump + a burst of noise cut short
    d = .5; t = T(d)
    th = np.sin(2 * np.pi * (55 + 60 * np.exp(-t / .03)) * t) * np.exp(-t / .12)
    gate = (t < .22) * np.exp(-t / .5)
    return (th * 1.2 + lp(hp(nz(d), 300), 4000) * gate * .35) * v

for e in EV:
    t, ty = e['t'], e['type']; pan = rng.uniform(-.25, .25)
    if ty in ('key', 'space', 'enter', 'keyLight'): add('sfx', key(1.0, 'space' if ty == 'space' else 'enter' if ty == 'enter' else 'key'), t, .32 if ty != 'keyLight' else .2, pan)
    elif ty == 'tick': add('sfx', tick(), t, .22, .15)
    elif ty == 'strike': add('sfx', tick(), t, .3, -.1)
    elif ty == 'relay': add('sfx', relay(), t, .7)
    elif ty == 'cls': add('sfx', relay(), t, .35, .1)
    elif ty == 'degauss': add('sfx', degauss(), t, .45)
    elif ty == 'err': add('sfx', err(466) if not e.get('soft') else err(311, .12), t, .26 if not e.get('soft') else .16)
    elif ty == 'bel': add('sfx', bel(), t, .22)
    elif ty == 'ratchet': add('sfx', ratchet(), t, .2, .3)
    elif ty == 'clunk': add('sfx', relay(), t, .3)
    elif ty == 'land': add('sfx', landtick(e.get('n', 4)), t, .1, rng.uniform(-.5, .5))
    elif ty == 'hit': add('sfx', hit(), t, .45)

# ---------------- room tone: fan, mains hum, a very quiet flyback whine ----------------
tt = np.arange(N) / SR
on = np.clip((tt - .05) / .8, 0, 1)
fan = (lp(rng.standard_normal(N), 700) * .03 + lp(rng.standard_normal(N), 180) * .04 + np.sin(2 * np.pi * 100 * tt) * .004) * on
whine = np.sin(2 * np.pi * 15734 * tt) * .0016 * on
bus['bed'][:, 0] += fan + whine; bus['bed'][:, 1] += fan * .97 + whine

# ---------------- score ----------------
mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)
def blep(p, dt):
    v = 2 * p - 1
    a = p < dt; x = p[a] / dt[a]; v[a] -= x + x - x * x - 1
    b = p > 1 - dt; x = (p[b] - 1) / dt[b]; v[b] -= x * x + x + x + 1
    return v
def osc(f, n, kind='saw', ph=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,)).copy()
    dt = f / SR; p = (ph + np.cumsum(dt)) % 1.0
    s = blep(p.copy(), dt)
    if kind == 'sq': s = (s - blep((p + .5) % 1.0, dt)) * .5
    return s
def wow(n, t0):
    t = t0 + np.arange(n) / SR
    return 2 ** ((3 / 1200) * (np.sin(2 * np.pi * .37 * t + 1.1) * .7 + np.sin(2 * np.pi * .91 * t + 2.3) * .3))
def env(n, a, r, hold):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-3))
    return e * np.where(t > hold, np.exp(-(t - hold) / r), 1.0)
def filt_env(x, f0, f1, tau):   # moving low-pass by blocks (cutoff falls f1 → f0 with tau)
    out = np.zeros_like(x); zi = np.zeros((2, 2)); blk = 512
    for i in range(0, len(x), blk):
        fc = f0 + (f1 - f0) * np.exp(-i / SR / tau)
        sos = butter(4, min(fc, SR * .45), 'low', fs=SR, output='sos')
        y, zi = sosfilt(sos, x[i:i + blk], zi=zi); out[i:i + blk] = y
    return out
def pan2(x, p): a = (p + 1) * np.pi / 4; return np.stack([x * np.cos(a), x * np.sin(a)], 1)

pad = np.zeros((N, 2)); seq = np.zeros((N, 2)); drone = np.zeros((N, 2))
CH = {'hook': [50, 53, 57, 62], 'acronym': [53, 57, 60, 65], 'notA': [58, 62, 65, 69], 'stats': [55, 58, 62, 67],
      'timeline': [48, 55, 60, 64], 'verdict': [57, 60, 64, 69], 'cta': [50, 54, 57, 62]}
scenes = [e for e in EV if e['type'] == 'scene']
hit_t = next((e['t'] for e in EV if e['type'] == 'hit'), None)
def put(buf, x, t):
    i = int(round(t * SR)); x = x[:N - i]; buf[i:i + len(x)] += x
for s in scenes:
    t0, t1, kind = s['t'], s['end'], s['kind']
    notes = CH.get(kind, CH['hook'])
    if kind == 'cta':        # minor (Dm) until the address lands, then the only major chord of the film
        notes = [50, 53, 57, 62]
        if hit_t: t1 = hit_t
    d = t1 - t0 + 1.6; n = int(d * SR)
    for k, m in enumerate(notes):
        x = sum(osc(mf(m) * wow(n, t0) * (1 + dd), n, 'saw', ph=k * .3 + j * .17) for j, dd in enumerate((-.004, 0, .005))) / 3
        x = filt_env(x, 900, 2200, .6) * env(n, .5, .7, t1 - t0)
        put(pad, pan2(x * .12, (k - 1.5) * .3), t0)
    # 16th sequencer in the busy scenes (square, filter snap per note)
    if kind in ('acronym', 'notA', 'stats', 'timeline', 'verdict'):
        s16 = .15; arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12, notes[3] + 12, notes[2] + 12]
        k = 0; t = t0 + .05
        while t < t1 - .1:
            nn = int(.14 * SR)
            x = osc(mf(arp[k % len(arp)]), nn, 'sq')
            x = filt_env(x, 500, 3200 if k % 4 == 0 else 1800, .03) * env(nn, .002, .04, .03)
            put(seq, pan2(x * (.07 if k % 4 == 0 else .05), .35 if k % 2 else -.35), t)
            t += s16; k += 1
if hit_t:
    t1 = DUR; n = int((t1 - hit_t + .2) * SR)
    for k, m in enumerate([50, 54, 57, 62, 66]):
        x = sum(osc(mf(m) * wow(n, hit_t) * (1 + dd), n, 'saw', ph=k * .2) for dd in (-.004, .005)) / 2
        x = filt_env(x, 1400, 3600, .8) * env(n, .03, 1.0, t1 - hit_t - .9)
        put(pad, pan2(x * .13, (k - 2) * .25), hit_t)
# drone under everything: D2 + A2, slowly breathing
n = N
dr = (osc(mf(38) * wow(n, 0), n) + osc(mf(45) * wow(n, 3), n) * .6)
dr = lp(dr, 320, 4) * (.6 + .4 * np.sin(2 * np.pi * tt / 9.6 - 1.5) ** 2) * np.clip((tt - .4) / 2, 0, 1)
drone += pan2(dr * .14, 0)
# long reverb on pad + sequencer
ir_t = np.arange(int(2.6 * SR)) / SR
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))], 1) * np.exp(-ir_t / .9)[:, None]
ir = np.stack([lp(ir[:, 0], 5000), lp(ir[:, 1], 5000)], 1); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(pad[:, c] + seq[:, c] * .6, ir[:, c])[:N] for c in range(2)], 1)
music = pad + seq + drone + wet * .5
music = np.stack([hp(music[:, c], 45) for c in range(2)], 1)
fade = np.clip((DUR - .2 - tt) / 1.2, 0, 1)[:, None]
bus['music'] += music * fade

# ---------------- voice + ducking ----------------
y, sr = sf.read(voicef)
if y.ndim > 1: y = y.mean(1)
if sr != SR: y = resample_poly(y, SR, sr)
add('vo', y, 0, 1.0)
k = int(.05 * SR)
envv = np.sqrt(np.convolve(y[:N] ** 2, np.ones(k) / k, 'same')); envv = np.pad(envv, (0, max(0, N - len(envv))))[:N]
act = np.clip(envv / .02, 0, 1)
k2 = int(.3 * SR); act = np.convolve(act, np.ones(k2) / k2, 'same')
duck = 1 - .6 * np.clip(act * 1.4, 0, 1)        # about -8 dB under speech
bus['music'] *= duck[:, None]

def rms(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
mix = bus['music'] * 1.0 + bus['vo'] + bus['sfx'] * .8 + bus['bed']
mix = np.stack([limit(mix[:, 0], .95), limit(mix[:, 1], .95)], 1)
sf.write(outf, mix.astype(np.float32), SR)
print(f"levels dB  voice {rms(bus['vo']):.1f}  music {rms(bus['music']):.1f}  sfx {rms(bus['sfx']):.1f}  bed {rms(bus['bed']):.1f}  mix {rms(mix):.1f}  peak {np.abs(mix).max():.2f}")
