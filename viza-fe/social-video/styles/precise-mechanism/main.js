// VIZA vertical short in the Color-Coded Mechanism style. Any VideoSpec (src/spec.ts) → one film on the entry machine (film.js).
// The page contract: window.DUR, window.render(t), window.READY, window.EV (sound and cue events), window.TEXTS(t) (readcheck).
// Everything comes from the spec: scene kinds and props, scene times, beats, captions. Scene changes land on spec times.
//   hook      a close-up on the part this video explains (the form unit, accent), then the pull-back that finds the whole machine;
//             its systems take their colours in the order the passport flows
//   acronym   the form unit explodes into one plate per word; the acronym is the primary, the words are labels on the plates
//   notA      the wrong idea is struck and stamped; a section cut opens the form unit and shows what it really is
//   stats     readouts on leader lines, counted up by the machine's own clock
//   timeline  one passport stepped through the machine, one dated stage per station
//   verdict   the whole machine running
//   cta       the machine stops; a drawing's title block with the VIZA logotype, the question, viza.it.com, Free, the disclaimer
import { buildMachine, PAL, ST, YB, PH, cycleState } from './film.js';

const QS = new URLSearchParams(location.search);
const NAME = QS.get('spec') || (await fetch('content/current.json').then(r => r.json())).name;
const BASE = `content/${NAME}/`;
const spec = await fetch(BASE + 'spec.json').then(r => r.json());
const W = innerWidth, H = innerHeight;
const ZH = String(spec.locale || '').startsWith('zh');
if (ZH) document.body.classList.add('zh');
const T = (en, zh) => ZH ? zh : en;
let DUR = +spec.durationSec;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = u => u * u * (3 - 2 * u);
const eo = u => 1 - Math.pow(1 - u, 3);
const ei = u => u * u * u;
const backE = u => { const s = 1.7; u -= 1; return u * u * ((s + 1) * u + s) + 1; };
const mixHex = (a, b, k) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',') + ')';
};
const esc0 = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// Chinese: let a line break only after punctuation (or a space) when every clause is short enough, so words are not split
const esc = (s, max = 10) => {
  const e = esc0(s); if (!/[\u4e00-\u9fff]/.test(e)) return e;
  const parts = e.split(/(?<=[，。；：？！、,;:?! ])/);
  return parts.every(p => [...p].length <= max) ? `<span style="word-break:keep-all">${parts.join('<wbr>')}</span>` : e;
};
const INK = '#25282D', MID = '#6F6A62', GREY = '#8C867D', SUBC = '#5E5A54';
const LM = 64, CAP_BOTTOM = H - 520, TOPY = 268;

const M = buildMachine({ W, H, PR: +(QS.get('pr') || 2) });
const A = M.ANCH;
const SCENES = spec.scenes.map((s, i) => {
  const dur = s.end - s.start, bt = (s.beats || []).filter(Number.isFinite);
  const beat = j => bt[j] ?? (j === 0 ? s.start + .18 : Math.min(s.end - .6, (bt[bt.length - 1] ?? s.start + .18) + dur * .3 * (j - bt.length + 1)));
  return { ...s, i, dur, beat, props: s.props || {} };
});
// the closing title block: its rows land 0.22 s apart from 0.25 s in; it then holds at least 3.5 s, past the spec's end if need be
const TB_STEP = .22, TB_LAND = .25 + 5 * TB_STEP + .3;
{ const last = SCENES[SCENES.length - 1];
  const dis = String(last?.props?.disclaimer || ''), cjk = (dis.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length;
  const read = cjk / 4.5 + (dis.replace(/\s/g, '').length - cjk) / 15 + 1.5, dLand = .25 + 4 * TB_STEP + .4;
  const TB_HOLD = Math.max(3.5, read - (TB_LAND - dLand) + .2);      // at least 3.5 s after the last rule, and long enough to read the disclaimer
  if (last && last.kind === 'cta') { DUR = Math.max(DUR, last.start + TB_LAND + TB_HOLD); last.end = DUR; last.dur = last.end - last.start; } }
if (SCENES.some(s => s.kind === 'acronym')) M.setPlates(SCENES.find(s => s.kind === 'acronym').props.words.length);

// ───────── the master clock θ (machine cycles): keys, monotone cubic, so speed never jumps ─────────
const TK = [{ t: 0, th: .265 }];
const lastK = () => TK[TK.length - 1];
const run = (t, rate) => { const l = lastK(); if (t > l.t + .02) TK.push({ t, th: l.th + rate * (t - l.t) }); };
const anchor = (t, phase, minRate) => {
  const l = lastK(); if (t - l.t < .9) return run(t, minRate);
  const m = l.th + minRate * (t - l.t); TK.push({ t, th: Math.ceil(m - phase) + phase });
};
const RATE = { hook: .35, acronym: .04, notA: .14, stats: .3, timeline: .4, verdict: .62, cta: 0 };
const TLINE = {};     // timeline scene index → { pts: [times], k: tracked passport }
let prevRate = RATE[SCENES[0]?.kind] ?? .3;
for (const s of SCENES) {
  const r = RATE[s.kind] ?? .3;
  if (s.i > 0) run(s.start + .7, (prevRate + r) / 2);
  if (s.kind === 'notA') anchor(Math.min(s.end - .3, s.beat(1) + .55), PH.feed1, .1);
  if (s.kind === 'timeline') {
    const n = Math.max(1, s.props.points?.length || 1), a = s.beat(0) + .3, b = Math.max(a + .9 * (n - 1), s.end - 1.25);
    const pts = n === 1 ? [a] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
    anchor(pts[0], .40, .2);
    for (let i = 1; i < n; i++) TK.push({ t: pts[i], th: lastK().th + 1 });
    TLINE[s.i] = { pts, th0: lastK().th - (n - 1) };
  }
  if (s.kind === 'cta') { run(s.start + 1.4, .12); run(s.end + 1, 0); }
  else run(s.end, r);
  prevRate = r;
}
if (lastK().t < DUR + 1) run(DUR + 1, 0);
const theta = (() => {
  const k = TK, n = k.length, dx = [], m = [], tg = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = k[i + 1].t - k[i].t; m[i] = (k[i + 1].th - k[i].th) / dx[i]; }
  tg[0] = m[0]; tg[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tg[i] = 0;
    else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; tg[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]); }
  }
  return t => {
    if (t <= k[0].t) return k[0].th + tg[0] * (t - k[0].t);
    if (t >= k[n - 1].t) return k[n - 1].th;
    let i = 0; while (i < n - 2 && t > k[i + 1].t) i++;
    const h = dx[i], u = (t - k[i].t) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * k[i].th + (u3 - 2 * u2 + u) * h * tg[i] + (-2 * u3 + 3 * u2) * k[i + 1].th + (u3 - u2) * h * tg[i + 1];
  };
})();
for (const s of SCENES) if (TLINE[s.i]) TLINE[s.i].k = cycleState(theta(TLINE[s.i].pts[0])).n + 1;   // the passport in the hopper at the first point

// ───────── dye: each system takes or loses its colour as a front from a point (never a crossfade) ─────────
const SYSCOL = { trav: PAL.trav, route: PAL.route, gov: PAL.gov, step: PAL.step };
const TR = { trav: [], route: [], gov: [], step: [{ t0: -9, dur: .01, from: PAL.neutral, to: PAL.step, O: A.formMid, R: 30 }] };
const cur = { trav: PAL.neutral, route: PAL.neutral, gov: PAL.neutral, step: PAL.step };
const EVL = [];
const ev = (t, type, o = {}) => EVL.push({ t: +t.toFixed(4), type, ...o });
function dyeTo(g, col, t0, O, R = 70, dur = .9) {
  if (cur[g] === col) return; TR[g].push({ t0, dur, from: cur[g], to: col, O, R }); cur[g] = col;
  ev(t0, 'dye', { g, on: col !== PAL.neutral ? 1 : 0, O });
}
let dyed = false;
const dyeAll = t => {
  dyeTo('trav', PAL.trav, t, A.hopperIn, 16, .7);
  dyeTo('route', PAL.route, t + .45, A.mesh, 80, 1.5);
  dyeTo('gov', PAL.gov, t + .95, A.gate, 34, 1.0);
  dyed = true;
};
for (const s of SCENES) {
  if (s.kind === 'hook') { dyeAll(s.beat(1) + .1); continue; }
  if (!dyed) dyeAll(s.start + .3);
  if (s.kind === 'acronym') for (const g of ['trav', 'route', 'gov']) dyeTo(g, PAL.neutral, s.start + .05, A.formMid, 70, .7);
  else if (s.kind === 'notA') { for (const g of ['route', 'gov']) dyeTo(g, PAL.neutral, s.start + .05, A.formMid, 70, .7); dyeTo('trav', PAL.trav, s.start + .05, A.formMid, 70, .7); }
  else for (const g of ['trav', 'route', 'gov']) dyeTo(g, SYSCOL[g], s.start + .1, A.formMid, 80, 1.0);
}

// ───────── camera: Hermite keys inside a scene, a hard cut between scenes ─────────
const MC = { x: 2, y: 5, z: -3 };
const K = (t, el, az, d, p, ox = 0, oy = 0) => ({ t, el, az, d, x: p.x ?? p[0], y: p.y ?? p[1], z: p.z ?? p[2], ox, oy });
const FU = [ST[1], 6.5, 0];
function camKeys(s) {
  const a = s.start, b = s.end;
  switch (s.kind) {
    case 'hook': {
      const b1 = clamp(s.beat(1), a + .8, b - 1.2);
      return [K(a, 22, -40, 170, FU, 0, 90), K(b1, 22, -34, 156, FU, 0, 90), K(Math.min(b, b1 + 1.5), 30, -74, 380, MC, 0, 110), K(b, 29, -64, 370, MC, 0, 110)];
    }
    case 'acronym': return [K(a, 10, -26, 150, [ST[1], 15, 0], 170, -60), K(b, 12, -16, 142, [ST[1], 15, 0], 170, -60)];
    case 'notA': {
      const b1 = clamp(s.beat(1), a + .5, b - .5);
      return [K(a, 30, -56, 150, FU, 0, -20), K(b1, 28, -40, 138, FU, 0, -20), K(b, 25, -26, 130, FU, 0, -20)];
    }
    case 'stats': return [K(a, 50, -80, 480, MC, 0, 30), K(b, 54, -86, 470, MC, 0, 30)];
    case 'verdict': return [K(a, 32, -80, 350, MC, 0, 90), K(b, 27, -60, 385, MC, 0, 90)];
    case 'cta': return [K(a, 38, -72, 500, MC, 0, 640), K(b, 46, -62, 520, MC, 0, 640)];
    default: return [K(a, 30, -70, 360, MC, 0, 60), K(b, 30, -60, 360, MC, 0, 60)];
  }
}
const CAMS = SCENES.map(s => ({ s, keys: s.kind === 'timeline' ? null : camKeys(s) }));
const CK = ['el', 'az', 'd', 'x', 'y', 'z', 'ox', 'oy'];
function hermite(keys, t) {
  const n = keys.length; let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], u = clamp((t - a.t) / (b.t - a.t)), h = b.t - a.t;
  const tan = (j, f) => (j === 0 || j === n - 1) ? 0 : (keys[j + 1][f] - keys[j - 1][f]) / (keys[j + 1].t - keys[j - 1].t);
  const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const o = {}; for (const f of CK) o[f] = h00 * a[f] + h10 * h * tan(i, f) + h01 * b[f] + h11 * h * tan(i + 1, f);
  return o;
}
const sceneAt = t => SCENES.find(s => t >= s.start && t < s.end) || (t < 0 ? SCENES[0] : SCENES[SCENES.length - 1]);
const CAMQ = QS.get('cam') ? QS.get('cam').split(',').map(Number) : null;     // tuning: ?cam=el,az,d,x,y,z,ox,oy
function camAt(t) {
  if (CAMQ) return Object.fromEntries(CK.map((k, i) => [k, CAMQ[i] ?? 0]));
  const s = sceneAt(t), c = CAMS[s.i];
  if (c.keys) return hermite(c.keys, clamp(t, s.start, s.end));
  const tl = TLINE[s.i], u = seg(t, s.start, s.end);     // timeline: a low tracking shot that follows the passport
  let x = 0; for (let j = -6; j <= 6; j++) x += clamp(M.passportX(theta(t + j * .1), tl.k), ST[0], ST[4] - 4);
  return { el: 24 + 2 * u, az: -46 + 10 * u, d: 190, x: x / 13 + 4, y: 6, z: 0, ox: 0, oy: -90 };
}
// the section through the form unit: opens in notA (toward that shot's camera), then stays open
const NOTA = SCENES.find(s => s.kind === 'notA');
const CUT = NOTA ? { t: clamp(NOTA.beat(1), NOTA.start + .3, NOTA.end - .4), az: camAt(clamp(NOTA.beat(1), NOTA.start + .3, NOTA.end - .4) + .4).az } : null;
if (CUT) ev(CUT.t, 'cut');
const ACR = SCENES.find(s => s.kind === 'acronym');
const liftAt = t => ACR ? ss(seg(t, ACR.start + .05, ACR.start + .75)) * (1 - ei(seg(t, ACR.end - .1, ACR.end + .45))) : 0;
if (ACR) { ev(ACR.start + .05, 'lift'); ev(ACR.end + .45, 'land'); }

// ───────── text layer ─────────
const ov = document.getElementById('ov'), svg = document.getElementById('lines');
const NSV = 'http://www.w3.org/2000/svg';
const div = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; ov.appendChild(d); return d; };
const EL = [];        // every text element: { update(t), texts(t) }
const vis = (el, on) => { el.style.display = on ? 'block' : 'none'; };
const opacityOf = el => { let o = 1; for (let e = el; e && e !== ov; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
const boxOf = (id, el, text, o = {}) => {
  if (!el || el.offsetParent === null || opacityOf(el) < .5) return null;
  const r = el.getBoundingClientRect(); return { id, text, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, ...o };
};
function line(a, b, op, col = INK, w = 2.4) {
  const p = document.createElementNS(NSV, 'path');
  p.setAttribute('d', `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${b[0].toFixed(1)},${b[1].toFixed(1)}`);
  for (const [k, v] of Object.entries({ fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', opacity: op })) p.setAttribute(k, v);
  svg.appendChild(p);
}
function pip(a, op, col = INK) {
  const c = document.createElementNS(NSV, 'circle');
  for (const [k, v] of Object.entries({ cx: a[0].toFixed(1), cy: a[1].toFixed(1), r: 5.5, fill: col, stroke: PAL.paper, 'stroke-width': 2.4, opacity: op })) c.setAttribute(k, v);
  svg.appendChild(c);
}
const scrW = p => M.scr(p[0], p[1], p[2]);

// figure line (tertiary), one per scene
let FIGN = 0;
function figLine(s, text) {
  const d = div('o fig', esc(`${T('Fig.', '图')} ${++FIGN} · ${text}`)); d.style.left = LM + 'px'; d.style.top = '214px';
  EL.push({ update(t) { const k = seg(t, s.start + .05, s.start + .4) * (t < s.end ? 1 : 0); vis(d, k > 0); d.style.opacity = k; d.style.transform = `translateX(${(1 - ss(k)) * -10}px)`; },
    texts: () => [boxOf('fig' + s.i, d, d.textContent, { pass: true })] });
}
// headline / line in the top zone: primary while on, then secondary (smaller, grey), then gone
function head(o) {
  const d = div('o head ' + (o.cls || 'h1'), o.html); d.style.left = LM + 'px';
  const h = { d, scale: 1, y: 0, o };
  h.bottom = () => h.y + d.offsetHeight * h.scale;
  EL.push({
    update(t) {
      const on = ss(seg(t, o.on, o.on + .45)), bk = ss(seg(t, o.back ?? 1e9, (o.back ?? 1e9) + .5)), out = ss(seg(t, o.out, o.out + .3));
      const v = t >= o.on && out < 1; vis(d, v); if (!v) return;
      h.scale = 1 - (1 - (o.backScale ?? .62)) * bk;
      h.y = typeof o.y === 'function' ? o.y(t) : o.y;
      d.style.top = h.y.toFixed(1) + 'px';
      d.style.opacity = on * (1 - out);
      d.style.transform = `translateY(${(1 - on) * 18}px) scale(${h.scale})`;
      if (!o.keepColour) d.style.color = mixHex(o.col || INK, GREY, bk);
    },
    texts: () => [boxOf('head-' + o.id, d, d.textContent)],
  });
  return h;
}
// a part label: the leader draws from a dot on the part, a colour dot pops, the text slides in
function callout(o) {
  const dot = div('dot'); dot.style.background = o.col;
  const box = div('o co' + (o.side === 'left' ? ' left' : ''), `<div class="nm"><span class="tx">${o.name}</span>${o.strike ? '<i class="strike"></i>' : ''}</div>${o.sub ? `<div class="d">${o.sub}</div>` : ''}`);
  const nm = box.querySelector('.nm'), tx = box.querySelector('.tx'), sub = box.querySelector('.d'), bar = box.querySelector('.strike');
  const big = o.size === 's' ? 42 : 56, small = 38;
  EL.push({
    update(t) {
      const lead = eo(seg(t, o.on, o.on + .3)), pop = seg(t, o.on + .15, o.on + .42), txt = ss(seg(t, o.on + .22, o.on + .58));
      const bk = ss(seg(t, o.back ?? 1e9, (o.back ?? 1e9) + .5)), out = ss(seg(t, o.out, o.out + .3));
      let v = t >= o.on && out < 1;
      const a = scrW(o.anchor(t));
      const off = Math.max(-a[0], a[0] - W, -a[1], a[1] - H, 0), inF = a[2] < 1 ? ss(clamp(1 - (off - 60) / 120)) : 0;
      if (inF <= 0) v = false;
      vis(dot, v); vis(box, v); if (!v) return;
      const pin = o.pin(t, a);
      const inX = ss(clamp((pin[0] - (LM - 60)) / 50)); if (inX <= 0) { vis(dot, false); vis(box, false); return; }
      const vx = pin[0] - a[0], vy = pin[1] - a[1], len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len;
      const end = [pin[0] - ux * 16, pin[1] - uy * 16], p = [a[0] + (end[0] - a[0]) * lead, a[1] + (end[1] - a[1]) * lead];
      const lop = (1 - .5 * bk) * (1 - out) * inF * inX * (o.leaderOut ? 1 - ss(seg(t, o.leaderOut, o.leaderOut + .3)) : 1);
      line(a, p, lop, o.accent ? PAL.step : INK); pip(a, lop, o.accent ? PAL.step : INK);
      dot.style.left = pin[0].toFixed(1) + 'px'; dot.style.top = pin[1].toFixed(1) + 'px';
      dot.style.transform = `scale(${pop > 0 ? backE(pop) * (1 - .3 * bk) : 0})`; dot.style.opacity = (1 - out) * inF;
      const fs = big - (big - small) * bk;
      nm.style.fontSize = fs.toFixed(1) + 'px';
      nm.style.color = o.accent ? mixHex(PAL.step, MID, bk) : mixHex(o.dim ? MID : INK, MID, bk);
      if (sub) { sub.style.opacity = 1 - ss(seg(t, (o.back ?? 1e9) + .9, (o.back ?? 1e9) + 1.3)); sub.style.color = mixHex(SUBC, GREY, bk); sub.style.fontSize = (34 - 6 * bk).toFixed(1) + 'px'; }
      if (bar) { bar.style.width = tx.offsetWidth + 12 + 'px'; bar.style.transform = `scaleX(${eo(seg(t, o.strike, o.strike + .35))})`; bar.style.background = mixHex(INK, MID, bk); }
      box.style.opacity = txt * (1 - out) * inF * inX;
      const slide = (1 - txt) * 14, gap = 30;
      const maxW = o.side === 'left' ? pin[0] - gap - LM : W - LM - (pin[0] + gap);
      box.style.maxWidth = box.style.width = Math.max(200, Math.min(o.maxW || 900, maxW)) + 'px';
      box.style.top = (pin[1] - fs * .62).toFixed(1) + 'px';
      if (o.side === 'left') { box.style.left = 'auto'; box.style.right = (W - pin[0] + gap).toFixed(1) + 'px'; box.style.transform = `translateX(${-slide}px)`; }
      else { box.style.right = 'auto'; box.style.left = (pin[0] + gap).toFixed(1) + 'px'; box.style.transform = `translateX(${slide}px)`; }
    },
    texts: () => [boxOf(o.id + '-n', tx, tx.textContent), sub && boxOf(o.id + '-d', sub, sub.textContent)],
  });
  return { tx, box };
}
function tag(o) {      // tertiary data tag on a short leader (notA rows)
  const d = div('o tag', `<span class="n">${esc(o.n)}</span>${esc(o.text)}`);
  EL.push({
    update(t) {
      const k = ss(seg(t, o.on, o.on + .35)), out = ss(seg(t, o.out, o.out + .3)), v = t >= o.on && out < 1; vis(d, v); if (!v) return;
      const a = scrW(o.anchor()), p = o.pin(a);
      d.style.opacity = k * (1 - out); d.style.left = p[0].toFixed(1) + 'px'; d.style.top = (p[1] - 18 + (1 - k) * 8).toFixed(1) + 'px';
      const ex = [p[0] + d.offsetWidth + 14, p[1]];
      line(a, [a[0] + (ex[0] - a[0]) * eo(k), a[1] + (ex[1] - a[1]) * eo(k)], k * (1 - out) * .8, INK, 2);
      pip(a, k * (1 - out));
    },
    texts: () => [boxOf(o.id, d, d.textContent)],
  });
}
function stamp(o) {
  const d = div('o stamp', esc(o.text));
  EL.push({
    update(t) {
      const k = seg(t, o.on, o.on + .16), bk = ss(seg(t, o.back, o.back + .5)), out = ss(seg(t, o.out, o.out + .3)), v = t >= o.on && out < 1; vis(d, v); if (!v) return;
      const p = o.pos(t);
      d.style.left = p[0].toFixed(1) + 'px'; d.style.top = p[1].toFixed(1) + 'px';
      d.style.opacity = Math.min(1, k * 3) * (1 - out) * (1 - .45 * bk);
      d.style.transform = `rotate(-5deg) scale(${(1.35 - .35 * ss(k)) * (1 - .3 * bk)})`;
      d.style.transformOrigin = '0 50%';
    },
    texts: () => [boxOf(o.id, d, d.textContent)],
  });
}

// the colour key: one swatch per system, each arriving with its dye, in a row just above the captions
function legend(s, t0, t1) {
  const items = [['trav', T('Your documents', '你的证件'), 0], ['route', T('The route', '出行路线'), .45], ['gov', T('Government check', '政府审核'), .95], ['step', T('This step', '本期这一步'), 1.3]];
  const d = div('o key', items.map(([g, nm]) => `<span class="it"><i style="background:${SYSCOL[g]}"></i>${esc(nm)}</span>`).join(''));
  const its = [...d.children];
  EL.push({
    update(t) {
      const out = ss(seg(t, t1 - .05, t1 + .25)), v = t >= t0 && out < 1; d.style.display = v ? 'grid' : 'none'; if (!v) return;
      d.style.top = (CAP_BOTTOM - 150 - d.offsetHeight).toFixed(1) + 'px'; d.style.opacity = 1 - out;
      its.forEach((e, j) => { const k = ss(seg(t, t0 + items[j][2], t0 + items[j][2] + .35)); e.style.opacity = k; e.style.transform = `translateY(${(1 - k) * 8}px)`; });
    },
    texts: () => its.map((e, j) => boxOf('key' + j, e, e.textContent)),
  });
}

// ───────── scene builders ─────────
const L = SCENES.map(s => s.props);
const FIG = {
  hook: () => `${T('Entry machine', '入境机器')} · ${spec.topic || ''}`,
  acronym: () => T('The form unit, taken apart', '表单单元分解'),
  notA: () => T('Section through the form unit', '表单单元剖面'),
  stats: s => s.props.title || T('Readouts', '读数'),
  timeline: () => T('One passport, stage by stage', '一本护照，逐站推进'),
  verdict: () => T('The whole machine running', '整台机器运转'),
  cta: () => T('Title block', '标题栏'),
};
for (const s of SCENES) {
  const P = s.props, a = s.start, b = s.end;
  if (s.kind !== 'cta') figLine(s, FIG[s.kind]?.(s) || '');
  if (s.kind === 'hook') {
    const b0 = s.beat(0), b1 = s.beat(1), b2 = Math.max(s.beat(2), b1 + .6);
    const kick = head({ id: 'kick' + s.i, cls: 'kick', html: esc(P.kicker), on: b0, out: b - .05, y: TOPY, keepColour: true });
    let ls = (P.lines || []).map(String);
    const emph = ls.filter((l, j) => j > 0 && ls.slice(0, j).some(p => p.includes(l.replace(/[.。]$/, ''))));
    ls = ls.filter(l => !emph.includes(l));
    const lhtml = ls.map(l => { let h = esc(l); for (const e of emph) { const w = esc0(e.replace(/[.。]$/, '')); h = h.replace(w, `<u class="em">${w}</u>`); } return h; }).join('<br>');
    const lines = head({ id: 'lines' + s.i, html: lhtml, on: b0 + .15, back: P.turn ? b2 : null, out: b - .05, y: () => kick.bottom() + 14 });
    if (P.turn) head({ id: 'turn' + s.i, html: esc(P.turn), on: b2 + .1, out: b - .05, y: () => lines.bottom() + 26 });
    callout({ id: 'topic' + s.i, name: esc(spec.topic || T('This step', '本期重点')), col: PAL.step, accent: true, size: 's',
      on: b0 + .55, back: b1, out: b - .05, side: 'right', anchor: () => A.formSide, pin: (t, an) => [clamp(an[0] + 120, 380, 640), clamp(an[1] - 260, 640, 1120)] });
    ev(b0 + .55, 'label');
    legend(s, b1 + .1, b);
  }
  if (s.kind === 'acronym') {
    head({ id: 'acr' + s.i, cls: 'big', html: esc(P.acronym), on: a + .08, out: b - .05, y: TOPY + 10 });
    if (P.note) head({ id: 'acrn' + s.i, cls: 'note', html: esc(P.note), on: a + .3, out: b - .05, y: TOPY + 220 });
    (P.words || []).forEach((w, j) => {
      const n = P.words.length, i = n - 1 - j;          // the first word on the top plate
      callout({ id: 'w' + j + s.i, name: `<span class="k">${esc(w[0])}</span><span class="r">${esc(w.slice(1))}</span>`, col: PAL.step, size: 's',
        on: a + .45 + j * .1, out: b - .05, side: 'right', anchor: () => A.plate(i), pin: (t, p) => [Math.max(p[0] + 70, 560), p[1]] });
    });
    ev(a + .45, 'label');
  }
  if (s.kind === 'notA') {
    const b0 = s.beat(0), b1 = clamp(s.beat(1), a + .5, b - .4);
    const st = callout({ id: 'struck' + s.i, name: esc(P.struck), strike: b0 + .45, col: PAL.neutral, on: b0, back: b1, out: b - .05, leaderOut: b1, side: 'right', anchor: () => A.formSide,
      pin: () => [LM + 14, TOPY + 40] });
    stamp({ id: 'stamp' + s.i, text: P.stamp, on: b0 + .8, back: b1, out: b - .05, pos: t => [LM + 14 + 30 + st.tx.offsetWidth * (1 - .32 * ss(seg(t, b1, b1 + .5))) + 40, TOPY + 40 - 30] });
    ev(b0 + .45, 'strike'); ev(b0 + .8, 'stampmark');
    const like = P.like ?? P['like?'] ?? P['like?:'];
    const isC = callout({ id: 'is' + s.i, name: esc(P.is), sub: like ? esc(like) : '', col: PAL.step, accent: true, on: b1 + .25, out: b - .05, side: 'right', anchor: () => A.cardIn,
      pin: () => [LM + 14, TOPY + 190], maxW: 900 });
    ev(b1 + .25, 'label');
    const rows = (P.rows || []).slice(0, 3), anc = [A.mag, A.feed, A.reader];
    rows.forEach((r, j) => {
      tag({ id: 'row' + j + s.i, n: String(j + 1).padStart(2, '0'), text: r, on: b1 + .9 + j * .35, out: b - .05, anchor: () => anc[j], pin: p => [LM + 44, isC.box.getBoundingClientRect().bottom + 44 + j * 54] });
      ev(b1 + .9 + j * .35, 'tag');
    });
  }
  if (s.kind === 'stats') statsPanel(s);
  if (s.kind === 'timeline') {
    const tl = TLINE[s.i], pts = tl.pts;
    const ttl = head({ id: 'tlt' + s.i, html: esc(P.title), on: a + .08, back: pts[0] + .5, out: b - .05, y: TOPY, backScale: .6 });
    (P.points || []).forEach((p, j) => {
      const on = pts[j] - .05, slipped = p.state === 'slipped', stn = Math.min(j, 4);
      callout({ id: 'pt' + j + s.i, name: esc(p.label), sub: p.note ? esc(p.note) : '', col: slipped ? PAL.neutral : PAL.step, accent: !slipped, dim: slipped, strike: slipped ? on + .45 : null,
        on, back: pts[j + 1] ? pts[j + 1] - .05 : 1e9, out: b - .05, side: 'right', anchor: () => [ST[stn], YB + .6, 2.0],
        pin: (t, an) => [Math.min(an[0] - 40, 600), Math.max(ttl.bottom() + 110, 480) + (j % 3) * 150], maxW: 520 });
      ev(on, 'label', { slipped: slipped ? 1 : 0 });
    });
    if (P.caveat) head({ id: 'cav' + s.i, cls: 'note', html: esc(P.caveat), on: pts[pts.length - 1] + .45, out: b - .05, y: () => ttl.bottom() + 16 });
  }
  if (s.kind === 'verdict') {
    const b0 = s.beat(0);
    const bd = head({ id: 'badge' + s.i, cls: 'badge', html: esc(P.badge), on: b0, out: b - .05, y: TOPY, keepColour: true });
    const hd = head({ id: 'vh' + s.i, html: esc(P.headline), on: b0 + .15, out: b - .05, y: () => bd.bottom() + 22 });
    if (P.note) head({ id: 'vn' + s.i, cls: 'note', html: esc(P.note), on: Math.min(b - 1.6, b0 + .6), out: b - .05, y: () => hd.bottom() + 22 });
  }
  if (s.kind === 'cta') titleBlock(s);
}

function statsPanel(s) {
  const P = s.props, items = (P.items || []).slice(0, 3), a = s.start, b = s.end;
  const y0 = TOPY + (P.title ? 0 : -10);
  const anc = [A.formTop, A.gate, A.stamp], cols = [PAL.step, PAL.gov, PAL.gov];
  const ons = items.map((_, j) => clamp(s.beat(j), a + .1, b - .8));
  const rows = items.map((it, j) => {
    const r = div('ro', `<i class="rule"></i><div class="row"><div class="k">${esc(it.label)}</div><div class="v">${it.struck ? `<span class="was">${esc(it.struck)}<i></i></span>` : ''}<span class="n"></span></div></div>`);
    return { it, r, rule: r.querySelector('.rule'), k: r.querySelector('.k'), v: r.querySelector('.v'), n: r.querySelector('.n'), was: r.querySelector('.was'), wasBar: r.querySelector('.was i'), on: ons[j], th0: theta(ons[j]) };
  });
  const dot = div('dot');
  rows.forEach(R => ev(R.on, 'readout'));
  const fmt = (it, x) => {
    const to = it.countTo ?? (/^\d+$/.test(String(it.value).trim()) ? +it.value : null), suf = it.suffix || '', pre = it.prefix || '';
    if (to == null) return esc(it.value);
    const n = Math.round(to * x);
    const sufHtml = suf ? `<span class="u">${esc(suf.trim())}</span>` : '';
    return `${esc(pre)}${n}${sufHtml}`;
  };
  EL.push({
    update(t) {
      let y = y0, act = -1;
      rows.forEach((R, j) => {
        const on = ss(seg(t, R.on, R.on + .35)), next = rows[j + 1] ? ss(seg(t, rows[j + 1].on, rows[j + 1].on + .45)) : 0, out = ss(seg(t, b - .05, b + .25));
        const v = t >= R.on && out < 1; vis(R.r, v); if (!v) return;
        if (next < 1) act = j;
        R.r.style.top = y.toFixed(1) + 'px'; R.r.style.opacity = on * (1 - out);
        R.rule.style.transform = `scaleX(${eo(seg(t, R.on, R.on + .4))})`;
        const vfs = 132 - 70 * next, kfs = 36 - 6 * next;
        R.v.style.fontSize = vfs.toFixed(1) + 'px'; R.k.style.fontSize = kfs.toFixed(1) + 'px';
        R.v.style.color = mixHex(INK, MID, next); R.k.style.color = mixHex(INK, MID, next);
        const x = R.it.countTo == null && !/^\d+$/.test(String(R.it.value).trim()) ? 1 : eo(clamp((theta(t) - R.th0) / .32));      // counted by the machine's own clock
        const h = fmt(R.it, x); if (R.n.innerHTML !== h) R.n.innerHTML = h;
        R.n.style.opacity = R.it.countTo == null ? ss(seg(t, R.on + .15, R.on + .45)) : 1;
        if (R.was) { R.was.style.opacity = ss(seg(t, R.on + .3, R.on + .6)); R.wasBar.style.transform = `scaleX(${eo(seg(t, R.on + .6, R.on + .9))})`; R.was.style.fontSize = (44 - 18 * next) + 'px'; }
        y += R.r.offsetHeight + 26;
        R.bottom = y - 26;
      });
      // one leader, from the newest readout down to the part that produced it
      const out = ss(seg(t, b - .05, b + .25));
      if (act >= 0 && out < 1) {
        const R = rows[act], k = eo(seg(t, R.on + .1, R.on + .45));
        const p0 = [LM + 13, R.bottom + 34], an = scrW(anc[act % 3]);
        dot.style.display = 'block'; dot.style.background = cols[act % 3];
        dot.style.left = p0[0] + 'px'; dot.style.top = p0[1] + 'px'; dot.style.transform = `scale(${backE(seg(t, R.on, R.on + .3))})`; dot.style.opacity = 1 - out;
        const e = [p0[0] + (an[0] - p0[0]) * k, p0[1] + (an[1] - p0[1]) * k];
        line([p0[0] + 10, p0[1] + 10], e, (1 - out) * .9); if (k > .98) pip(an, 1 - out);
      } else dot.style.display = 'none';
    },
    texts: () => rows.flatMap((R, j) => [boxOf('stk' + j, R.k, R.k.textContent), boxOf('stv' + j, R.n, R.it.value)]),
  });
}

function titleBlock(s) {
  const P = s.props, a = s.start + .25;
  const rows = [
    ['', `<img class="logo" src="${BASE}logo.svg" alt="VIZA">`, 'VIZA'],
    [T('Question', '问题'), `<span class="vq">${esc(P.question)}</span>`, P.question],
    [T('Website', '网址'), `<span class="vu">${esc(P.url)}</span>`, P.url],
    [T('Service', '服务'), `<span class="vf">${esc(P.pill)}</span>`, P.pill],
    [T('Note', '说明'), `<span class="vd">${esc(P.disclaimer)}</span>`, P.disclaimer],
  ];
  const tb = div('tb', rows.map(([k, v], i) => `<div class="row"><i class="rule${i ? ' thin' : ''}"></i><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`).join('') + '<i class="rule end"></i>');
  const R = [...tb.querySelectorAll('.row')], end = tb.querySelector('.rule.end');
  const step = TB_STEP;
  rows.forEach((_, i) => ev(a + i * step, 'rule'));
  EL.push({
    update(t) {
      const v = t >= a; vis(tb, v); if (!v) return;
      tb.style.top = (CAP_BOTTOM - 150 - tb.offsetHeight).toFixed(1) + 'px';
      R.forEach((r, i) => {
        const t0 = a + i * step, rule = eo(seg(t, t0, t0 + .32)), txt = ss(seg(t, t0 + .1, t0 + .4));
        r.children[0].style.transform = `scaleX(${rule})`;
        r.children[1].style.opacity = r.children[2].style.opacity = txt;
        r.children[2].style.transform = `translateX(${(1 - txt) * 10}px)`;
      });
      end.style.transform = `scaleX(${eo(seg(t, a + 5 * step, a + 5 * step + .3))})`;
    },
    texts: () => R.slice(1).map((r, i) => boxOf('tb' + i, r.children[2], rows[i + 1][2])),
  });
}

// captions: bottom left, no plate, held to the next line
{
  const caps = (spec.captions || []).map((c, i, all) => {
    const nxt = all[i + 1] ? all[i + 1].start - .04 : DUR;
    return { text: c.text, t0: c.start, t1: Math.min(nxt, Math.max(c.end + .35, c.start + 1.4)) };
  });
  const d = div('cap', '<div class="l"></div>'), l = d.firstChild;
  EL.push({
    update(t) {
      const c = caps.find(c => t >= c.t0 && t < c.t1);
      vis(d, !!c); if (!c) return;
      if (l.dataset.t !== c.text) { l.dataset.t = c.text; l.innerHTML = esc(c.text, 18); }
      d.style.top = (CAP_BOTTOM - d.offsetHeight).toFixed(1) + 'px';
      d.style.opacity = ss(seg(t, c.t0, c.t0 + .12)) * (1 - ss(seg(t, c.t1 - .1, c.t1)));
    },
    texts: () => [],          // the subtitle line is not reported: its hold follows the voice (readcheck contract)
  });
  window.CAPS = caps;
}

// ───────── one frame ─────────
function renderAt(t) {
  const th = theta(t);
  M.setCamera(camAt(t));
  M.setMachine(th, { lift: liftAt(t) });
  M.setDye(t, TR);
  if (CUT) M.setCut(CUT.az, (110 * Math.PI / 180) * ss(seg(t, CUT.t, CUT.t + .7)));
  M.render();
  svg.innerHTML = '';
  for (const e of EL) e.update(t);
}

// ───────── sound and cue events: machine events found from θ, panned to the part ─────────
{
  const pan = p => { M.setCamera(camAt(p.t)); const x = scrW(p.at)[0]; return +clamp(x / W * 2 - 1, -1, 1).toFixed(3); };
  let prev = theta(0);
  for (let t = .001; t < DUR; t += .002) {
    const th = theta(t), r = (th - prev) / .002;
    const cross = (ph) => Math.floor(prev - ph) !== Math.floor(th - ph);
    if (r > .015) {
      if (cross(0)) ev(t, 'index', { rate: +r.toFixed(3), pan: pan({ t, at: A.belt }) });
      if (cross(.34)) ev(t, 'indexEnd', { rate: +r.toFixed(3), pan: pan({ t, at: A.belt }) });
      if (cross(PH.feed1)) ev(t, 'feed', { rate: +r.toFixed(3), pan: pan({ t, at: A.formMid }) });
      if (cross(.9)) ev(t, 'gateOpen', { rate: +r.toFixed(3), pan: pan({ t, at: A.flap }) });
      if (cross(.42)) ev(t, 'gateShut', { rate: +r.toFixed(3), pan: pan({ t, at: A.flap }) });
      if (cross(PH.stamp)) ev(t, 'stamp', { rate: +r.toFixed(3), pan: pan({ t, at: A.stamp }) });
      for (let q = 0; q < 4; q++) if (cross(q / 4 + .001)) ev(t, 'q', { q, n: Math.floor(th - q / 4), rate: +r.toFixed(3) });
    }
    prev = th;
  }
  for (const s of SCENES) ev(s.start, 'scene', { kind: s.kind, end: s.end, i: s.i });
  const rv = []; for (let t = 0; t < DUR; t += .02) rv.push(+((theta(t + .01) - theta(t - .01)) / .02).toFixed(4));
  EVL.push({ t: 0, type: 'curve', name: 'rate', dt: .02, v: rv });
  for (const c of window.CAPS) ev(c.t0, 'cap', { t1: +c.t1.toFixed(3), text: c.text });
  EVL.sort((x, y) => x.t - y.t);
  window.EV = EVL.map(e => e.O ? { ...e, O: undefined, pan: pan({ t: e.t, at: e.O }) } : e);
}

window.DUR = DUR;
window.render = t => renderAt(t);
window.TEXTS = t => { renderAt(t); return EL.flatMap(e => e.texts(t)).filter(Boolean); };
window.SPEC = { name: NAME, locale: spec.locale, scenes: SCENES.map(s => [s.kind, s.start, s.end]) };
const logo = new Image(); logo.src = BASE + 'logo.svg';
await Promise.all([document.fonts.ready, new Promise(r => { logo.onload = logo.onerror = r; })]);
await document.fonts.load('600 56px "Inter"'); await document.fonts.load('700 56px "Noto Sans SC"'); await document.fonts.load('500 25px "Plex Mono"');
renderAt(0);
window.READY = true;
