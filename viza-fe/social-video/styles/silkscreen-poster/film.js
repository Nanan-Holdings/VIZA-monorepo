// film.js · VIZA vertical shorts in the Silkscreen Travel Poster style (1080×1920, 24 fps). A template: any VideoSpec in, one film out.
// One portrait poster per video: a generic destination scene (scenery.js) chosen from the topic, re-inked per scene in one palette series.
// Every scene is a new print swept on by a diagonal squeegee whose blade crosses mid-frame exactly on the spec's scene time.
// The scene kinds are printed in the poster's own grammar:
//   hook      the first pulls: sun first, sky bands, landscape, one ink per sixteenth while the camera steps back; the headline printed into the sky
//   acronym   one split-fountain pull prints the letters, each in its own ink; the words print row by row on a dark card
//   notA      a registration slip: the wrong word floats off register and gets a paper strike and an accent stamp band;
//             the right answer prints loose on a ticket and snaps into register with one hit
//   stats     the info band printed last: a dark band rises, values and labels print row by row on the beats
//   timeline  a printed route on a bare-paper panel (the sky knocked out): stops stamped one by one, slipped dates struck through
//   verdict   palette re-ink to dusk, the badge tag, the headline printed into the sky like the poster's name, the note in the band
//   cta       re-ink to night, the final lockup: a wide ticket with the VIZA logotype, the URL, the Free stamp and the disclaimer
// Captions are a printed strip on the poster's foot band (screen space, y 1262 to 1398), outside the platform UI zones.
import { makeTextures, paperSheet, ink, wipeRegion, wipeFront, squeegee, inkFinish, rectPath, circlePath, ringPath, clamp, lerp, hash } from '/styles/silkscreen-poster/demo/engine/silk.js';
import { pickInk, contrast } from '/styles/silkscreen-poster/demo/engine/poster.js';
import { SCENERY, PALETTES, pickScenery, poly, BX0, BY0, BX1, BY1, BW, BH } from './scenery.js';

export const W = 1080, H = 1920, PAPER = '#F3EAD8';
const FD = 'BigShoulders, NotoSC', FT = 'Outfit, NotoSC';
const FOOT = 1262, CAP_MID = 1332, BOT = 1236, ML = 60, CW = 960;
const ANG = -.08;

const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
// a push toward a focus point (fx, fy): at z = 1 the frame is the sheet's home framing, so layouts never shift
const zoomAt = (fx, fy, z, dx = 0, dy = 0) => [fx + (540 - fx) / z + dx, fy + (960 - fy) / z + dy, z];
const R2 = (seed, amp) => [(hash(seed * 3.1 + 1) - .5) * 2 * amp, (hash(seed * 7.7 + 1.3) - .5) * 2 * amp];
const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;
const isCJK = s => CJK.test(s || '');
function inverse(p) { const q = new Path2D(); q.rect(-1e4, -1e4, 2e4, 2e4); q.addPath(p); return q; }
function strHash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

let ctx, T, SP, DUR, SCN, SCENES = [], EVL = [], LOGO = {}, NOCAP = false, SEED = 1, KIND = 'harbour';

// ---------------- type: wrap and fit ----------------
function setF(c, w, size, fam, track = 0) { c.font = `${w} ${size}px ${fam}`; c.letterSpacing = track + 'px'; }
function tokens(s) { return String(s).match(/[⺀-鿿豈-﫿＀-￯　-〿]|\s+|[^\s⺀-鿿豈-﫿＀-￯　-〿]+/g) || []; }
const CLOSE = /^[，。、？！：；）」』,.?!:;)]$/;
function wrap(s, maxW) {
  const out = []; let line = '';
  for (const tk of tokens(s)) {
    if (/^\s+$/.test(tk)) { if (line) line += ' '; continue; }
    const tryL = line + tk;
    if (!line || ctx.measureText(tryL.trimEnd()).width <= maxW || CLOSE.test(tk)) line = tryL;
    else { out.push(line.trimEnd()); line = tk; }
  }
  if (line.trim()) out.push(line.trimEnd());
  return out.length ? out : [''];
}
function fit(text, { w = 800, fam = FD, max = 120, min = 40, maxW = CW, maxLines = 2, track = 0 }) {
  for (let s = max; s >= min; s -= 2) { setF(ctx, w, s, fam, track * s); const lines = wrap(text, maxW); if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW + 1)) return { size: s, lines, w, fam, track: track * s }; }
  setF(ctx, w, min, fam, track * min); return { size: min, lines: wrap(text, maxW), w, fam, track: track * min };
}
function widthOf(F, line) { setF(ctx, F.w, F.size, F.fam, F.track); return ctx.measureText(line).width; }

// ---------------- tempo grid: each scene gets an even number of beats near 100 BPM, so every scene starts on a downbeat ----------------
function grid(S) {
  const d = S.end - S.start, n = Math.max(2, Math.round(d / .6 / 2) * 2);
  S.nb = n; S.bl = d / n; S.s16 = S.bl / 4;
}
const q16 = (S, t) => S.start + Math.max(0, Math.floor((t - S.start) / S.s16 + 1e-6)) * S.s16;
function beat(S, k, frac) { const b = S.beats && S.beats[k]; const t = (b != null && b >= S.start - .01 && b < S.end) ? b : S.start + frac * (S.end - S.start); return q16(S, t); }

// ---------------- items: everything printed in a scene, one pull each ----------------
// { id, t0, dur, draw(c, p, t, S), text?, box?[x0,y0,x1,y1] (art units), ev?: {type,...}, sq?: {dir, box:[x,y,w,h], color|beads} }
function textItem(S, id, t0, dur, F, x, y, { align = 'left', color, lh = 1.0, reg = 1.2, dir = 'right', ev = { type: 'item' }, accent = null, text = null, loose = null } = {}) {
  setF(ctx, F.w, F.size, F.fam, F.track);
  const ws = F.lines.map(l => ctx.measureText(l).width), mw = Math.max(...ws);
  const x0 = align === 'center' ? x - mw / 2 : align === 'right' ? x - mw : x;
  const box = [x0 - 6, y - F.size * .86, x0 + mw + 6, y + (F.lines.length - 1) * F.size * lh + F.size * .24];
  const seed = strHash(S.i + id) % 997;
  return {
    id, t0, dur, box, text: text ?? F.lines.join(' '), ev,
    draw(c, p, t) {
      const clip = p < 1 ? wipeRegion([box[0] - 10, box[1] - 10, box[2] - box[0] + 20, box[3] - box[1] + 20], dir, p, seed, 30) : null;
      const off = loose ? loose(t) : [0, 0], rg = R2(seed, reg);
      ink(c, { paint: (g) => {
        g.translate(off[0], off[1]);
        setF(g, F.w, F.size, F.fam, F.track); g.textAlign = align; g.textBaseline = 'alphabetic';
        F.lines.forEach((l, i) => g.fillText(l, x, y + i * F.size * lh));
      } }, { color, reg: rg, clip });
      if (accent) for (const a of accent) {           // accent words: a bar in the accent ink under the word, half a beat later
        const pa = seg(t, t0 + dur * .5, t0 + dur * 1.5); if (pa <= 0) continue;
        ink(c, { path: rectPath(a.x0, a.y + F.size * .1, (a.x1 - a.x0) * pa, Math.max(8, F.size * .07)) }, { color: a.color, reg: R2(seed + 5, 1), sheen: .6 });
      }
    },
  };
}
function shapeItem(S, id, t0, dur, part, color, box, { dir = 'down', sq = true, ev = { type: 'pull' }, reg = 1, beads = null } = {}) {
  const seed = strHash(S.i + id) % 991;
  return {
    id, t0, dur, ev: { ...ev, dur },
    sq: sq ? { dir, box, color, beads } : null,
    draw(c, p) { ink(c, part, { color, reg: R2(seed, reg), clip: p < 1 ? wipeRegion(box, dir, p, seed, 40) : null, sheen: 1 }); },
  };
}
// bare paper laid over ink inside a shape (a struck word, a knocked-out bar): unprinted stock showing through
function paperItem(S, id, t0, dur, path, box, dir = 'right') {
  const seed = strHash(S.i + id) % 983;
  return { id, t0, dur, ev: { type: 'strike' }, draw(c, p) { c.save(); c.clip(path); if (p < 1) c.clip(wipeRegion(box, dir, p, seed, 24)); paperSheet(c, T, box[0] - 20, box[1] - 20, box[2] + 40, box[3] + 40, .6); c.restore(); } };
}
function strikeBar(box, ang = -.05) {
  const [x0, y0, x1, y1] = box, cy = (y0 + y1) / 2 + (y1 - y0) * .06, h = Math.max(10, (y1 - y0) * .12), cx = (x0 + x1) / 2, L = (x1 - x0) / 2 + 24;
  const m = new DOMMatrix().translate(cx, cy).rotate(ang * 180 / Math.PI);
  const pts = [[-L, -h / 2], [L, -h / 2], [L, h / 2], [-L, h / 2]].map(([x, y]) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; });
  return { path: poly(pts), box: [x0 - 30, cy - L * Math.abs(Math.sin(ang)) - h, x1 - x0 + 60, 2 * h + 2 * L * Math.abs(Math.sin(ang))] };
}
function ticket(x, y, w, h, notchY, r = 20) {
  const knock = new Path2D();
  knock.arc(x, notchY, r, -Math.PI / 2, Math.PI / 2); knock.closePath();
  knock.moveTo(x + w, notchY - r); knock.arc(x + w, notchY, r, -Math.PI / 2, Math.PI / 2, true); knock.closePath();
  for (let xx = x + 44; xx < x + w - 34; xx += 24) { knock.moveTo(xx + 5, notchY); knock.arc(xx, notchY, 5, 0, Math.PI * 2); knock.closePath(); }
  return { path: rectPath(x, y, w, h), knock };
}

// ---------------- palette helpers ----------------
const skyInk = (pal, extra = []) => pickInk([pal.sky1, pal.sky2], [pal.near, pal.mid, ...extra], 3.5);
const onNear = (pal, cands, need = 4.5) => pickInk(pal.near, cands, need);

// ================================ scene builders ================================
function buildOpening(S) {
  // the first print: accent first on bare paper, then one ink per sixteenth while the camera steps back from the sun
  const s = S.s16, st = S.start;
  S.pulls = { sun: [-.55, .8], sky1: [st + s, .3], sky2: [st + 3 * s, .3], far: [st + 5 * s, .28], mid: [st + 6 * s, .28], near: [st + 7 * s, .28], acc: [st + 8 * s, .22], lit: [st + 9 * s, .22] };
  S.lift = st + 10 * s; S.bugT = st + 9 * s; S.footT = 0;
  const sun = SCN.sun;
  S.cam = (t) => {
    const u = eo(seg(t, 0, S.lift + .1)), z = Math.exp(lerp(Math.log(2.3), 0, u));
    const v = eio(seg(t, S.lift + .1, S.end));
    return [lerp(sun[0], 540, u), lerp(sun[1], 960, u), z * (1 + .035 * v)];
  };
}
function buildHook(S) {
  const P = S.props, pal = S.pal, s = S.s16;
  const b0 = beat(S, 0, .02), b1 = beat(S, 1, .25), b2 = beat(S, 2, .55);
  const kick = fit(P.kicker || '', { w: 700, fam: FT, max: 62, min: 40, maxW: CW, maxLines: 2 });
  const kY = 330 + kick.size * .2;
  S.items.push(textItem(S, 'kicker', Math.max(q16(S, b0), S.start + 6 * s), .26, kick, ML, kY, { color: skyInk(pal), lh: 1.12, ev: { type: 'header' } }));
  // headline: lines[0] is the headline; later lines that appear inside it are accent words, the rest are their own lines
  const lines = P.lines || [], main = [lines[0] || ''], acc = [];
  for (const l of lines.slice(1)) (lines[0] || '').includes(l) ? acc.push(l) : main.push(l);
  const top = kY + (kick.lines.length - 1) * kick.size * 1.12 + 40, room = 790 - top;
  let size = 190, Fs;
  const tryFit = (one) => { for (size = 190; size >= 70; size -= 4) {
    Fs = main.map(l => fit(l, { w: 900, fam: FD, max: size, min: size, maxW: CW, maxLines: one ? 1 : 3, track: .02 }));
    const n = Fs.reduce((a, F) => a + F.lines.length, 0);
    if ((!one || n === main.length) && n * size * .98 <= room && Fs.every(F => F.lines.every(l => widthOf(F, l) <= CW + 1))) return true;
  } return false; };
  if (!tryFit(true) || size < 104) tryFit(false);
  const hInk = skyInk(pal), aInk = pickInk([pal.sky1, pal.sky2], [pal.sun, pal.near], 1.2);
  let y = top + size * .84;
  Fs.forEach((F, i) => {
    const t0 = i === 0 ? b1 : q16(S, b1 + i * Math.max(.6, (b2 - b1) * .42));
    const accent = [];
    if (i === 0) for (const a of acc) F.lines.forEach((l, li) => {
      const j = l.indexOf(a); if (j < 0) return;
      setF(ctx, F.w, F.size, F.fam, F.track);
      const x0 = ML + ctx.measureText(l.slice(0, j)).width, x1 = x0 + ctx.measureText(a).width;
      accent.push({ x0, x1, y: y + li * size * .98, color: aInk });
    });
    S.items.push(textItem(S, 'head' + i, t0, .3, F, ML, y, { color: hInk, lh: .98, ev: { type: 'header' }, accent }));
    y += F.lines.length * size * .98;
  });
  // the turn: printed last in a dark band over the landscape
  if (P.turn) {
    const F = fit(P.turn, { w: 700, fam: FT, max: 54, min: 36, maxW: 900, maxLines: 3 });
    const bh = F.lines.length * F.size * 1.2 + 56, by = Math.min(1040, BOT - bh);
    S.items.push(shapeItem(S, 'turnband', b2 - s, .26, { path: rectPath(30, by, 1020, bh) }, pal.near, [10, by - 20, 1060, bh + 40], { dir: 'right' }));
    S.items.push(textItem(S, 'turn', b2, .24, F, 540, by + 28 + F.size * .9, { align: 'center', color: onNear(pal, [pal.sky1, PAPER, pal.glow]), lh: 1.2 }));
  }
  if (P.ring === 'eu') {                                                    // a ring of twelve stars around the sun, in the accent ink
    const [sx, sy] = SCN.sun, R = SCN.r + 128, stars = new Path2D();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2, cx = sx + Math.cos(a) * R, cy = sy + Math.sin(a) * R, pts = []; for (let j = 0; j < 10; j++) { const rr = j % 2 ? 10 : 24, aa = -Math.PI / 2 + j * Math.PI / 5; pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr]); } stars.addPath(poly(pts)); }
    S.items.push(shapeItem(S, 'ring', b1 + 2 * s, .3, { path: stars }, pal.sun, [sx - R - 40, sy - R - 40, 2 * R + 80, 2 * R + 80], { dir: 'right', sq: false, ev: { type: 'pull', accent: 1 } }));
  }
}

function buildAcronym(S) {
  const P = S.props, pal = S.pal, s = S.s16, b0 = beat(S, 0, .08);
  const F = fit(P.acronym || '', { w: 900, fam: FD, max: 330, min: 120, maxW: CW, maxLines: 1, track: .04 });
  const cols = [pal.sun, pal.near, pal.mid, pal.far, pal.glow].filter(c => contrast(c, pal.sky1) >= 2.2 && contrast(c, pal.sky2) >= 1.8);
  if (cols.length < 2) cols.push(pal.near, pal.mid);
  setF(ctx, F.w, F.size, F.fam, F.track);
  const word = F.lines[0], tw = ctx.measureText(word).width, x0 = 540 - tw / 2, y = 330 + F.size * .86;
  const xs = [...word].map((_, i) => x0 + ctx.measureText(word.slice(0, i)).width);
  const box = [x0 - 20, y - F.size * .9, tw + 40, F.size * 1.05];
  S.items.push({
    id: 'acr', t0: b0, dur: .4, text: word, box: [box[0], box[1], box[0] + box[2], box[1] + box[3]], ev: { type: 'sweep', fountain: 1, dur: .4 },
    sq: { dir: 'right', box, beads: [...word].map((_, i) => cols[i % cols.length]) },
    draw(c, p) {
      const clip = p < 1 ? wipeRegion(box, 'right', p, 17, 40) : null;
      [...word].forEach((ch, i) => ink(c, { paint: (g) => { setF(g, F.w, F.size, F.fam, F.track); g.textAlign = 'left'; g.fillText(ch, xs[i], y); } }, { color: cols[i % cols.length], reg: R2(i * 13 + 3, 2.4), clip }));
    },
  });
  // the words, row by row on a dark card, initials in the accent ink
  const words = P.words || [], cardTop = y + F.size * .22 + 40, n = Math.max(1, words.length);
  const rowH = Math.min(110, (BOT - cardTop - 60 - (P.note ? 60 : 0)) / n), size = Math.round(rowH * .78);
  S.items.push(shapeItem(S, 'card', b0 + 2 * s, .3, { path: rectPath(ML, cardTop, CW, BOT - cardTop) }, pal.near, [ML - 20, cardTop - 20, CW + 40, BOT - cardTop + 40]));
  const iInk = onNear(pal, [pal.sun, pal.sky1], 3), rInk = onNear(pal, [pal.sky1, PAPER, pal.glow]);
  const rowT0 = b0 + 2 * s + .22, rowStep = Math.max(.06, Math.min(s, (S.end - .35 - rowT0) / n));
  words.forEach((wd, k) => {
    const yb = cardTop + 34 + (k + 1) * rowH - rowH * .2, Fw = { size, lines: [wd], w: 800, fam: FD, track: size * .04 };
    setF(ctx, 800, size, FD, size * .04);
    const iw = ctx.measureText(wd[0]).width, x = ML + 56;
    const it = textItem(S, 'w' + k, rowT0 + k * rowStep, .14, Fw, x, yb, { color: rInk });
    it.draw = (c, p) => {                                                  // initial in the accent ink, the rest in the light ink
      const clip = p < 1 ? wipeRegion([x - 10, yb - size, CW, size * 1.3], 'right', p, 31 + k, 26) : null;
      ink(c, { paint: (g) => { setF(g, 800, size, FD, size * .04); g.textAlign = 'left'; g.fillText(wd[0], x, yb); } }, { color: iInk, reg: R2(k + 40, 1.2), clip });
      ink(c, { paint: (g) => { setF(g, 800, size, FD, size * .04); g.textAlign = 'left'; g.fillText(wd.slice(1), x + iw, yb); } }, { color: rInk, reg: R2(k + 60, 1.2), clip });
    };
    S.items.push(it);
  });
  if (P.note) { const Fn = fit(P.note, { w: 500, fam: FT, max: 34, min: 26, maxW: 840, maxLines: 2 }); S.items.push(textItem(S, 'note', rowT0 + n * rowStep, .2, Fn, ML + 56, BOT - 40 - (Fn.lines.length - 1) * Fn.size * 1.2, { color: onNear(pal, [pal.glow, pal.sky2, pal.sky1]), lh: 1.2 })); }
  S.cam = (t) => zoomAt(540, 640, 1 + .05 * eio(seg(t, S.start, S.end)));
}

function buildNotA(S) {
  const P = S.props, pal = S.pal, s = S.s16, b0 = beat(S, 0, .05), b1 = beat(S, 1, .45);
  const like = P.like ?? P['like?'] ?? P['like?:'], rows = (P.rows || []).slice(0, 3);
  // the wrong word, printed in two inks that never come into register
  const F = fit(P.struck || '', { w: 900, fam: FD, max: rows.length || like ? 210 : 260, min: 100, maxW: 900, maxLines: 1, track: .03 });
  const y = 330 + F.size * .86, cA = pickInk([pal.sky1, pal.sky2], [pal.mid, pal.far, pal.near], 2), cB = skyInk(pal);
  const tA = q16(S, S.start + .12);
  const slipA = (t) => [-12 + Math.sin(t * 2.1) * 5, 8 + Math.cos(t * 1.7) * 4], slipB = (t) => [10 + Math.sin(t * 1.6 + 1) * 5, -7 + Math.cos(t * 2.3) * 4];
  const wA = textItem(S, 'strA', tA, .26, F, 540, y, { align: 'center', color: cA, loose: slipA, ev: { type: 'header' } });
  const wB = textItem(S, 'strB', tA + s, .26, F, 540, y, { align: 'center', color: cB, loose: slipB, ev: { type: 'pull', dur: .26 } });
  wB.text = null;
  S.items.push(wA, wB);
  const sb = strikeBar(wA.box, -.06);
  S.items.push(paperItem(S, 'strike', b0, .2, sb.path, sb.box));
  // the stamp: an accent band printed across, slanted
  const Fs = fit(P.stamp || '', { w: 800, fam: FD, max: 100, min: 52, maxW: 820, maxLines: 2, track: .05 });
  const bh = Fs.lines.length * Fs.size * 1.0 + 44, by = wA.box[3] + 30, ang = -.06;
  const m = new DOMMatrix().translate(540, by + bh / 2).rotate(ang * 180 / Math.PI);
  const corners = [[-470, -bh / 2], [470, -bh / 2], [470, bh / 2], [-470, bh / 2]].map(([x, yy]) => { const q = m.transformPoint(new DOMPoint(x, yy)); return [q.x, q.y]; });
  const tS = q16(S, b0 + 2 * s);
  S.items.push(shapeItem(S, 'stampband', tS, .26, { path: poly(corners) }, pal.sun, [40, by - 60, 1000, bh + 120], { dir: 'right', ev: { type: 'pull', accent: 1 } }));
  const stampText = textItem(S, 'stamp', tS + s, .22, Fs, 0, 0, { align: 'center', color: pickInk(pal.sun, [pal.near, PAPER, '#111111'], 4.5), lh: 1.0, ev: { type: 'item', accent: 1 } });
  const d0 = stampText.draw;
  stampText.draw = (c, p, t) => { c.save(); c.translate(540, by + bh / 2); c.rotate(ang); c.translate(0, Fs.size * .34 - (Fs.lines.length - 1) * Fs.size * .5); d0(c, p, t); c.restore(); };
  stampText.box = [70, by - 30, 1010, by + bh + 30];
  S.items.push(stampText);
  // the answer: a ticket printed loose, snapping into register with one hit
  // fit the ticket into the room left under the stamp: shrink the answer, the comparison and the rows together
  const avail = BOT - (stampText.box[3] + 10);
  let Fi, Fl, rowSz, rowStep, hIs, hL, hR, cardH;
  for (const [im, rs, lm] of [[96, 40, 40], [86, 38, 38], [76, 36, 36], [68, 33, 34], [60, 30, 32], [54, 28, 30]]) {
    Fi = fit(P.is || '', { w: 800, fam: FD, max: im, min: Math.min(im, 54), maxW: 860, maxLines: 3, track: .01 });
    Fl = like ? fit(like, { w: 500, fam: FT, max: lm, min: 28, maxW: 860, maxLines: 2 }) : null;
    rowSz = rs; rowStep = Math.round(rs * 1.55);
    hIs = Fi.lines.length * Fi.size * 1.0; hL = Fl ? Fl.lines.length * Fl.size * 1.25 + 18 : 0; hR = rows.length ? rows.length * rowStep + 16 : 0;
    cardH = 52 + hIs + hL + hR + 40;
    if (cardH <= avail) break;
  }
  const cardTop = Math.max(stampText.box[3] + 10, BOT - cardH);
  const snap = q16(S, b1 + (4 + rows.length) * s);
  S.snap = snap;
  const loose = (k) => (t) => { const u = t < snap ? 1 : 0; return [Math.sin(t * 2.3 + k) * 16 * u + 18 * u, Math.cos(t * 1.9 + k) * 12 * u - 10 * u]; };
  S.items.push(shapeItem(S, 'card', q16(S, b1 - s), .3, ticket(ML, cardTop, CW, BOT - cardTop, cardTop + 26 + hIs + (Fl ? hL - 4 : 12)), pal.near, [ML - 20, cardTop - 20, CW + 40, BOT - cardTop + 40]));
  const light = onNear(pal, [pal.sky1, PAPER, pal.glow]), soft = onNear(pal, [pal.glow, pal.sky2, pal.sky1]), key = onNear(pal, [pal.sun, pal.sky1], 3);
  let yy = cardTop + 40 + Fi.size * .84;
  S.items.push(textItem(S, 'is', b1, .26, Fi, ML + 50, yy, { color: key, lh: 1.0, loose: loose(1), ev: { type: 'header' } }));
  yy += hIs - Fi.size * .84 + 14;
  if (Fl) { yy += Fl.size * .9 + 10; S.items.push(textItem(S, 'like', b1 + 2 * s, .2, Fl, ML + 50, yy, { color: soft, lh: 1.25, loose: loose(2) })); yy += (Fl.lines.length - 1) * Fl.size * 1.25 + 14; }
  rows.forEach((r, k) => {
    const ry = yy + 30 + k * rowStep + rowSz * .8, Fr = fit(r, { w: 600, fam: FT, max: rowSz, min: 24, maxW: 800, maxLines: 1 });
    const it = textItem(S, 'row' + k, b1 + (3 + k) * s, .18, Fr, ML + 108, ry, { color: light, loose: loose(3 + k) });
    const d1 = it.draw, bx = ML + 52, byy = ry - rowSz * .86;
    it.draw = (c, p, t) => {                                               // a tick box knocked out to paper, the tick in the accent ink
      const off = loose(3 + k)(t);
      c.save(); c.translate(off[0], off[1]);
      if (p > .2) { ink(c, { path: rectPath(bx, byy, 34, 34) }, { color: PAPER, reg: [0, 0] }); ink(c, { path: poly([[bx + 6, byy + 18], [bx + 13, byy + 11], [bx + 16, byy + 16], [bx + 28, byy + 3], [bx + 33, byy + 9], [bx + 15, byy + 29]]) }, { color: pickInk(PAPER, [pal.sun, pal.mid, pal.near], 3), reg: R2(k + 9, 1.5) }); }
      c.restore(); d1(c, p, t);
    };
    S.items.push(it);
  });
  S.cam = (t) => zoomAt(540, 800, 1.02, lerp(-16, 16, ss(seg(t, S.start, S.end))));
}

function buildStats(S) {
  const P = S.props, pal = S.pal, s = S.s16, items = (P.items || []).slice(0, 4), n = Math.max(1, items.length);
  let bandTop = 420;
  if (P.title) {
    const Ft = fit(P.title, { w: 800, fam: FD, max: 116, min: 60, maxW: CW, maxLines: 1, track: .03 });
    S.items.push(textItem(S, 'title', q16(S, S.start + .15), .26, Ft, ML, 340 + Ft.size * .84, { color: skyInk(pal), ev: { type: 'header' } }));
    bandTop = 340 + Ft.size + 50;
  }
  S.items.push(shapeItem(S, 'band', q16(S, S.start + .05), .34, { path: rectPath(BX0, bandTop, BW, BY1 - bandTop) }, pal.near, [BX0, bandTop - 20, BW, 1300 - bandTop], { dir: 'up' }));
  const rowH = (BOT - bandTop - 30) / n, key = onNear(pal, [pal.sun, pal.sky1], 3), light = onNear(pal, [pal.sky1, PAPER, pal.glow]), soft = onNear(pal, [pal.glow, pal.sky2, pal.sky1]), dim = onNear(pal, [pal.far, pal.glow, pal.sky2], 3);
  items.forEach((it, k) => {
    const tk = beat(S, k, .06 + k * .75 / n), rowTop = bandTop + 30 + k * rowH;
    let val = String(it.value ?? '');
    if (it.prefix && !val.startsWith(it.prefix)) val = it.prefix + val;
    const suf = it.suffix && !val.endsWith(it.suffix.trim()) ? it.suffix.trim() : '';
    const Fl = fit(it.label || '', { w: 600, fam: FT, max: Math.min(42, rowH * .2), min: 28, maxW: 900, maxLines: 2, track: .06 });
    const lH = Fl.lines.length * Fl.size * 1.25;
    const vMax = Math.min(170, (rowH - 24 - lH) / .98);
    const Fv = fit(val, { w: 900, fam: FD, max: Math.max(60, Math.round(vMax)), min: 50, maxW: suf ? 640 : 900, maxLines: 1, track: .02 });
    const vy = rowTop + 12 + Fv.size * .86;
    if (k > 0) S.items.push(shapeItem(S, 'rule' + k, tk - s, .16, { path: rectPath(ML, rowTop - 4, CW, 3) }, dim, [ML - 10, rowTop - 14, CW + 20, 24], { dir: 'right', sq: false, ev: { type: 'tick' } }));
    const vi = textItem(S, 'val' + k, tk, .22, Fv, ML, vy, { color: k === 0 ? key : light, ev: { type: 'item', accent: k === 0 ? 1 : 0 }, text: val + suf });
    if (it.countTo != null && isFinite(it.countTo)) {                     // the number runs up while the pull lands
      const d0 = vi.draw, pre = (val.match(/^[^\d]*/) || [''])[0], post = val.replace(/^[^\d]*[\d.,]+/, '');
      vi.draw = (c, p, t) => {
        const u = seg(t, tk, tk + .5);
        if (u >= 1) return d0(c, p, t);
        const txt = pre + Math.round(it.countTo * ss(u)) + post;
        ink(c, { paint: (g) => { setF(g, Fv.w, Fv.size, Fv.fam, Fv.track); g.textAlign = 'left'; g.fillText(txt, ML, vy); } }, { color: k === 0 ? key : light, reg: R2(k + 70, 1.2), clip: p < 1 ? wipeRegion([vi.box[0] - 10, vi.box[1] - 10, vi.box[2] - vi.box[0] + 200, vi.box[3] - vi.box[1] + 20], 'right', p, 51 + k, 30) : null });
      };
      vi.liveUntil = tk + .5; vi.ev = { ...vi.ev, count: 1 };
    }
    S.items.push(vi);
    const vw = widthOf(Fv, Fv.lines[0]);
    if (suf) {
      const Fs = fit(suf, { w: 700, fam: FT, max: Math.round(Fv.size * .34), min: 22, maxW: 300, maxLines: 1 });
      S.items.push(textItem(S, 'suf' + k, tk + s, .14, Fs, ML + vw + 16, vy, { color: k === 0 ? key : light }));
    }
    if (it.struck) {                                                        // the old value, printed small and struck to paper
      const Fo = fit(it.struck, { w: 700, fam: FD, max: Math.round(Fv.size * .5), min: 30, maxW: 300, maxLines: 1 });
      const ti = textItem(S, 'old' + k, tk + 2 * s, .16, Fo, ML + vw + 40, vy, { color: dim });
      S.items.push(ti);
      const sb = strikeBar(ti.box, -.12); S.items.push(paperItem(S, 'oldx' + k, tk + 4 * s, .14, sb.path, sb.box));
    }
    S.items.push(textItem(S, 'lab' + k, tk + s, .2, Fl, ML, vy + 14 + Fl.size * 1.1, { color: soft, lh: 1.25 }));
  });
  S.cam = (t) => { const u = eio(seg(t, S.start, S.end)); return zoomAt(540, 860, lerp(1.0, 1.035, u), 0, lerp(-10, 8, u)); };
}

function buildTimeline(S) {
  const P = S.props, pal = S.pal, s = S.s16, pts = (P.points || []).slice(0, 5), n = Math.max(1, pts.length);
  const px0 = 50, py0 = 318, px1 = 1030, py1 = BOT;
  S.hole = rectPath(px0, py0, px1 - px0, py1 - py0);                       // the panel is bare paper: every ink of this print stops at its edge
  const frame = new Path2D(); frame.rect(px0, py0, px1 - px0, py1 - py0); frame.rect(px0 + 10, py0 + 10, px1 - px0 - 20, py1 - py0 - 20);
  S.items.push(shapeItem(S, 'frame', q16(S, S.start + .1), .24, { path: frame, rule: 'evenodd' }, pal.near, [px0 - 20, py0 - 20, px1 - px0 + 40, py1 - py0 + 40], { sq: false }));
  const nearP = pickInk(PAPER, [pal.near, pal.mid], 7), midP = pickInk(PAPER, [pal.mid, pal.far, pal.near], 3), route = pickInk(PAPER, [pal.sun, pal.mid], 2.4);
  const Ft = fit(P.title || '', { w: 800, fam: FD, max: 104, min: 56, maxW: 860, maxLines: 2, track: .03 });
  S.items.push(textItem(S, 'title', q16(S, S.start + .2), .26, Ft, px0 + 50, py0 + 44 + Ft.size * .84, { color: nearP, ev: { type: 'header' } }));
  const Fc = P.caveat ? fit(P.caveat, { w: 600, fam: FT, max: 40, min: 28, maxW: 820, maxLines: 2 }) : null;
  const cavH = Fc ? Fc.lines.length * Fc.size * 1.2 + 44 : 0;
  const yTop = py0 + 44 + Ft.lines.length * Ft.size * 1.0 + 70, yBot = py1 - 40 - cavH - 70, X = 150;
  const ys = pts.map((_, k) => n === 1 ? (yTop + yBot) / 2 : yTop + k * (yBot - yTop) / (n - 1));
  // when each stop prints: the first beat, the target on the last beat, the others spread between
  const b0 = beat(S, 0, .05), bl = (S.beats || []).filter(b => b >= S.start && b < S.end), last = bl.length > 1 ? q16(S, bl[bl.length - 1]) : q16(S, Math.min(b0 + 1.5, b0 + (S.end - b0) * .5));
  const times = pts.map((p, k) => n === 1 ? b0 : q16(S, lerp(b0, last, k / (n - 1))));
  const Lsz = Math.round(Math.min(88, n > 1 ? (yBot - yTop) / (n - 1) * .52 : 88));
  pts.forEach((pt, k) => {
    const tk = times[k], y = ys[k], tgt = pt.state === 'target';
    if (k > 0) {                                                            // the dashed route to this stop, stamped segment by segment
      const y0 = ys[k - 1] + 34, y1 = y - 34, nd = Math.max(1, Math.floor((y1 - y0) / 34)), t0 = times[k - 1] + s, span = Math.max(s * 2, tk - t0 - s * .5);
      for (let d = 0; d < nd; d++) { const yy = y0 + d * (y1 - y0) / nd; S.items.push(shapeItem(S, `dash${k}-${d}`, t0 + span * d / nd, .06, { path: rectPath(X - 6, yy, 12, (y1 - y0) / nd - 12) }, route, [X - 20, yy - 4, 40, 40], { sq: false, ev: { type: 'tick' } })); }
    }
    const mark = tgt ? { path: circlePath(X, y, 30), knock: ringPath(X, y, 13, 19) } : { path: circlePath(X, y, 20) };
    S.items.push(shapeItem(S, 'stop' + k, tk, .14, mark, tgt ? route : midP, [X - 40, y - 40, 80, 80], { dir: 'right', sq: false, ev: { type: 'item', accent: tgt ? 1 : 0 } }));
    const Fl = fit(pt.label || '', { w: 800, fam: FD, max: Lsz, min: 34, maxW: 760, maxLines: 1, track: .02 });
    const ly = y + Fl.size * .32;
    const li = textItem(S, 'lab' + k, tk + s * .5, .2, Fl, X + 70, ly, { color: tgt ? nearP : midP, ev: { type: 'header' } });
    S.items.push(li);
    if (pt.note) { const Fn = fit(pt.note, { w: 500, fam: FT, max: 36, min: 26, maxW: 760, maxLines: 1 }); S.items.push(textItem(S, 'note' + k, tk + s * 1.5, .16, Fn, X + 72, ly + Fn.size * 1.35, { color: tgt ? nearP : midP })); }
    if (!tgt) { const sb = strikeBar(li.box, -.04); S.items.push(paperItem(S, 'x' + k, tk + s * 2.5, .14, sb.path, sb.box)); }
    else S.items.push(shapeItem(S, 'ul' + k, tk + s * 2, .16, { path: rectPath(X + 70, ly + 12, li.box[2] - li.box[0] - 12, 9) }, route, [X + 60, ly, li.box[2] - li.box[0] + 20, 30], { dir: 'right', sq: false, ev: { type: 'tick' } }));
  });
  if (Fc) {
    const tc = q16(S, Math.max(last + 3 * s, Math.min(last + 1.0, S.end - 2.2)));
    const cy0 = py1 - 40 - cavH;
    S.items.push(shapeItem(S, 'cavband', tc - s, .2, { path: rectPath(px0 + 40, cy0, px1 - px0 - 80, cavH) }, pal.near, [px0 + 20, cy0 - 20, px1 - px0 - 40, cavH + 40], { dir: 'right' }));
    S.items.push(textItem(S, 'caveat', tc, .2, Fc, 540, cy0 + 22 + Fc.size * .9, { align: 'center', color: onNear(pal, [pal.sun, pal.sky1], 3), lh: 1.2 }));
  }
  S.cam = (t) => { const u = eio(seg(t, S.start, S.end)); return zoomAt(540, 780, 1.025, 0, lerp(12, -12, u)); };
}

function buildVerdict(S) {
  const P = S.props, pal = S.pal, s = S.s16, b0 = beat(S, 0, .03), b1 = beat(S, 1, .5);
  // badge: a tag in the accent ink with a notch
  const Fb = fit((P.badge || '').toUpperCase(), { w: 700, fam: FT, max: 36, min: 26, maxW: 800, maxLines: 1, track: .12 });
  const bw = widthOf(Fb, Fb.lines[0]) + 70, bh = Fb.size + 34, by = 312;
  const notch = new Path2D(); notch.moveTo(ML + bw + 1, by + bh / 2 - 14); notch.arc(ML + bw, by + bh / 2, 14, -Math.PI / 2, Math.PI / 2, true); notch.closePath();
  S.items.push(shapeItem(S, 'tag', b0, .2, { path: rectPath(ML, by, bw, bh), knock: notch }, pal.sun, [ML - 20, by - 20, bw + 40, bh + 40], { dir: 'right', ev: { type: 'pull', accent: 1 } }));
  S.items.push(textItem(S, 'badge', b0 + s, .16, Fb, ML + 30, by + bh / 2 + Fb.size * .36, { color: pickInk(pal.sun, [pal.near, PAPER, '#111111'], 4.5) }));
  // the note in the dark band at the foot
  const Fn = fit(P.note || '', { w: 600, fam: FT, max: 44, min: 30, maxW: 920, maxLines: 3 });
  const bandTop = Math.max(960, BOT - (Fn.lines.length * Fn.size * 1.25 + 62));
  // headline: printed into the sky, line by line, as the poster's name
  const room = Math.min(bandTop - 40, 900) - (by + bh + 50);
  let Fh; for (let sz = 200; sz >= 70; sz -= 4) { Fh = fit(P.headline || '', { w: 900, fam: FD, max: sz, min: sz, maxW: CW, maxLines: 5, track: .02 }); if (Fh.lines.length * sz * 1.0 <= room && Fh.lines.every(l => widthOf(Fh, l) <= CW + 1)) break; }
  const hy = by + bh + 50 + Fh.size * .84, hInk = skyInk(pal, [PAPER]);
  Fh.lines.forEach((l, i) => S.items.push(textItem(S, 'h' + i, b0 + (2 + 2 * i) * s, .26, { ...Fh, lines: [l] }, ML, hy + i * Fh.size * 1.0, { color: hInk, ev: { type: 'header' } })));
  const tn = Math.max(b1, b0 + (3 + 2 * Fh.lines.length) * s);
  S.items.push(shapeItem(S, 'band', tn - 2 * s, .3, { path: rectPath(BX0, bandTop, BW, BY1 - bandTop) }, pal.near, [BX0, bandTop - 20, BW, 1300 - bandTop], { dir: 'up' }));
  S.items.push(textItem(S, 'note', tn, .26, Fn, ML, bandTop + 34 + Fn.size * .86, { color: onNear(pal, [pal.sky1, pal.glow, PAPER]), lh: 1.25 }));
  S.cam = (t) => zoomAt(540, 700, 1 + .04 * eio(seg(t, S.start, S.end)));
}

function buildCta(S) {
  const P = S.props, pal = S.pal, s = S.s16, b0 = beat(S, 0, .04);
  const tx = 50, tw = 980, ty = 306, th = BOT - ty;
  const Fq = fit(P.question || '', { w: 800, fam: FD, max: 104, min: 56, maxW: 860, maxLines: 3, track: .02 });
  const logoH = 96, qy = ty + 56 + logoH + 40 + Fq.size * .84, perf = qy + (Fq.lines.length - 1) * Fq.size * 1.0 + Fq.size * .3 + 46;
  S.items.push(shapeItem(S, 'ticket', q16(S, S.start + .02), .4, ticket(tx, ty, tw, th, perf, 22), pal.near, [tx - 20, ty - 20, tw + 40, th + 40]));
  const light = onNear(pal, [pal.sky1, PAPER, pal.glow]), soft = onNear(pal, [pal.glow, pal.sky2, pal.sky1, '#C3CADB']);
  const img = LOGO.logoDark, lw = logoH * 375 / 111, lx = 540 - lw / 2, ly = ty + 56;
  S.items.push({ id: 'logo', t0: b0 + s, dur: .2, ev: { type: 'item' }, text: 'VIZA', box: [lx, ly, lx + lw, ly + logoH], pass: true,
    draw(c, p) { ink(c, { paint: (g) => { if (img) g.drawImage(img, lx, ly, lw, logoH); } }, { color: '#fff', reg: [1, -.6], clip: p < 1 ? wipeRegion([lx - 10, ly - 10, lw + 20, logoH + 20], 'right', p, 7, 30) : null }); } });
  S.items.push(textItem(S, 'q', b0 + 2 * s, .26, Fq, 540, qy, { align: 'center', color: light, lh: 1.0, ev: { type: 'header' } }));
  const Fu = fit(P.url || 'viza.it.com', { w: 900, fam: FD, max: 186, min: 90, maxW: 860, maxLines: 1, track: .02 });
  const uy = perf + 50 + Fu.size * .84;
  S.items.push(textItem(S, 'url', b0 + 4 * s, .26, Fu, 540, uy, { align: 'center', color: light, ev: { type: 'header', accent: 1 } }));
  const Fp = fit(P.pill || 'Free', { w: 800, fam: FD, max: 76, min: 50, maxW: 500, maxLines: 1, track: .06 });
  const pw = widthOf(Fp, Fp.lines[0]) + 110, ph = Fp.size + 40, py = uy + 46, pr = ph / 2;
  const pill = new Path2D(); pill.moveTo(540 - pw / 2 + pr, py); pill.lineTo(540 + pw / 2 - pr, py); pill.arc(540 + pw / 2 - pr, py + pr, pr, -Math.PI / 2, Math.PI / 2); pill.lineTo(540 - pw / 2 + pr, py + ph); pill.arc(540 - pw / 2 + pr, py + pr, pr, Math.PI / 2, Math.PI * 1.5); pill.closePath();
  S.items.push(shapeItem(S, 'pill', b0 + 6 * s, .2, { path: pill }, pal.sun, [540 - pw / 2 - 20, py - 20, pw + 40, ph + 40], { dir: 'right', sq: false, ev: { type: 'pull', accent: 1 } }));
  S.items.push(textItem(S, 'pilltx', b0 + 7 * s, .16, Fp, 540, py + ph / 2 + Fp.size * .36, { align: 'center', color: pickInk(pal.sun, [pal.near, PAPER, '#111111'], 4.5), ev: { type: 'item', accent: 1 } }));
  const Fd = fit(P.disclaimer || '', { w: 500, fam: FT, max: 31, min: 24, maxW: 880, maxLines: 3 });
  const dy = Math.max(py + ph + 40 + Fd.size, BOT - 36 - (Fd.lines.length - 1) * Fd.size * 1.3);
  S.items.push(textItem(S, 'disc', b0 + 9 * s, .2, Fd, 540, dy, { align: 'center', color: soft, lh: 1.3 }));
  S.cam = (t) => { const u = eo(seg(t, S.start, S.start + 1.6)); return zoomAt(540, 800, Math.exp(lerp(Math.log(1.07), 0, u))); };
}
const BUILD = { hook: buildHook, acronym: buildAcronym, notA: buildNotA, stats: buildStats, timeline: buildTimeline, verdict: buildVerdict, cta: buildCta };

// ================================ setup ================================
export function setup(canvas, spec, opts = {}) {
  ctx = canvas.getContext('2d'); T = makeTextures(PAPER, 7); SP = spec; NOCAP = !!opts.nocap; LOGO = opts.logos || {};
  DUR = +(+spec.durationSec || spec.scenes[spec.scenes.length - 1].end).toFixed(3);
  SEED = strHash(spec.slug || 'viza') % 1000;
  KIND = pickScenery(spec); SCN = SCENERY[KIND](SEED % 97 + 3);
  const PS = PALETTES[KIND], base = SEED % 2 ? 'alt' : 'day', other = base === 'day' ? 'alt' : 'day';
  let alt = 0;
  SCENES = spec.scenes.map((sc, i) => {
    const pn = i === 0 ? base : sc.kind === 'cta' ? 'night' : sc.kind === 'verdict' ? 'dusk' : (alt++ % 2 === 0 ? other : base);
    const S = { i, kind: sc.kind, start: +sc.start, end: Math.min(+sc.end, DUR), beats: sc.beats || [], props: sc.props || {}, palName: pn, pal: PS[pn], items: [], seed: SEED + i * 7, hole: null, cam: () => [540, 960, 1] };
    grid(S);
    return S;
  });
  const build = (S) => {
    S.items = []; S.pulls = null; S.hole = null; S.snap = null; grid(S);
    if (S.i === 0) buildOpening(S);
    const opening = S.cam;
    if (BUILD[S.kind]) BUILD[S.kind](S);
    if (S.i === 0) S.cam = opening;                                         // the opening keeps its step-back camera whatever the first scene is
  };
  for (const S of SCENES) build(S);
  // the final lockup holds at least 3.5 s after its last item lands; the film runs longer than the spec when it must (the voice has ended by then)
  const L = SCENES[SCENES.length - 1];
  if (L && L.kind === 'cta') for (let k = 0; k < 3; k++) {
    const landed = Math.max(...L.items.map(it => it.t0 + it.dur)), need = +(landed + 3.5).toFixed(3);
    if (need <= DUR + 1e-3) break;
    DUR = need; L.end = DUR; build(L);
  }
  EVL = events();
  return { dur: DUR, ev: EVL, kind: KIND };
}

function events() {
  const ev = [], E = (t, type, o = {}) => { if (t >= 0 && t <= DUR + .01) ev.push({ t: +t.toFixed(3), type, ...o }); };
  E(0, 'meta', { kind: KIND, locale: SP.locale, seed: SEED });
  for (const S of SCENES) {
    E(S.start, 'scene', { i: S.i, kind: S.kind, end: S.end, bl: +S.bl.toFixed(4), nb: S.nb, pal: S.palName });
    for (let k = 0; k < S.nb; k++) E(S.start + k * S.bl, 'beat', { i: S.i, k, n: S.nb, kind: S.kind });
    if (S.i > 0) E(S.start - .22, 'sweep', { dur: .44, to: S.palName, fountain: S.palName !== SCENES[S.i - 1].palName ? 1 : 0 });
    if (S.pulls) for (const [k, [a, d]] of Object.entries(S.pulls)) E(Math.max(0, a), 'pull', { layer: k, dur: +(d - Math.max(0, -a)).toFixed(3), accent: k === 'sun' ? 1 : 0 });
    if (S.lift) E(S.lift, 'lift');
    if (S.i === 0) { E(0, 'pull', { layer: 'foot', dur: .25 }); E(S.bugT, 'item', {}); }
    for (const it of S.items) if (it.ev) E(it.t0, it.ev.type, { ...it.ev, dur: it.ev.dur ?? it.dur, id: it.id });
    if (S.snap) E(S.snap, 'snap');
    if (S.kind === 'verdict' && S.i > 0) { const pv = SCENES[S.i - 1], d = Math.min(pv.bl, .65); E(S.start - .22 - d, 'silence', { dur: +(d - .02).toFixed(3) }); }
  }
  E(DUR, 'end');
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

// ================================ drawing ================================
let CAM = [540, 960, 1];
function camFix(cx, cy, z) {
  z = Math.max(1, z); const hw = W / 2 / z, hh = H / 2 / z;
  return [clamp(cx, BX0 + hw + 20, BX1 - hw - 20), clamp(cy, BY0 + hh + 20, BY1 - hh - 20), z];
}
function setCam(cx, cy, z) { CAM = camFix(cx, cy, z); const [x, y, zz] = CAM; ctx.setTransform(zz, 0, 0, zz, W / 2 - x * zz, H / 2 - y * zz); }
const toScreen = (x, y) => [W / 2 + (x - CAM[0]) * CAM[2], H / 2 + (y - CAM[1]) * CAM[2]];

const ABOX = [BX0, BY0, BW, BH];
const tiltM = (a) => new DOMMatrix().translate(540, 960).rotate(a * 180 / Math.PI).translate(-540, -960);
function tiltRegion(p, a, seed) { if (p >= 1) return null; const o = new Path2D(); o.addPath(wipeRegion(ABOX, 'down', p, seed, 34, 6), tiltM(a)); return o; }
function tiltFront(p, a) {
  const y = wipeFront(ABOX, 'down', p, 34), m = tiltM(a);
  const A = m.transformPoint(new DOMPoint(BX0, y)), B = m.transformPoint(new DOMPoint(BX1, y)), d = m.transformPoint(new DOMPoint(0, 1)), o = m.transformPoint(new DOMPoint(0, 0));
  return { a: [A.x, A.y], b: [B.x, B.y], lead: [d.x - o.x, d.y - o.y] };
}
const INK_OF = { sun: 'sun', sky1: 'sky1', sky2: 'sky2', far: 'far', mid: 'mid', near: 'near', acc: 'sun', lit: 'glow' };

function drawScenery(S, t) {
  const pal = S.pal, prog = (k) => S.pulls ? (S.pulls[k] ? seg(t, S.pulls[k][0], S.pulls[k][0] + S.pulls[k][1]) : 1) : 1;
  paperSheet(ctx, T, BX0, BY0, BW, BH, .6);
  ctx.save();
  if (S.hole) ctx.clip(inverse(S.hole), 'evenodd');
  SCN.parts.forEach((pt, j) => {
    const p = prog(pt.pull); if (p <= 0) return;
    ctx.save();
    if (pt.cut) ctx.clip(inverse(pt.cut), 'evenodd');
    const clip = tiltRegion(p, ANG, S.seed + j * 3);
    if (pt.paper) { ctx.clip(pt.path); ctx.clip(pt.paper); if (clip) ctx.clip(clip); paperSheet(ctx, T, BX0, BY0, BW, BH, .6); }
    else ink(ctx, pt, { color: pal[pt.ink], reg: R2(S.seed + j * 5, 2), clip, sheen: 1, trap: pt.lit ? 0 : 1, lw: 1.8 });
    ctx.restore();
  });
  ctx.restore();
}
function drawPullBlades(S, t) {                                            // the blade riding each pull of the opening print
  if (!S.pulls) return;
  for (const [k, [a, d]] of Object.entries(S.pulls)) {
    const u = seg(t, a, a + d); if (u <= 0 || u >= 1) continue;
    const f = tiltFront(u, ANG), o = 16;
    squeegee(ctx, [f.a[0] + f.lead[0] * o, f.a[1] + f.lead[1] * o], [f.b[0] + f.lead[0] * o, f.b[1] + f.lead[1] * o], f.lead, { color: S.pal[INK_OF[k]], seed: a * 10 + 3, roll: (f.a[1] + f.b[1]) / 60, scale: 1.3, handle: .4, shadow: .18 });
  }
}
function drawItemSq(it, p) {
  if (!it.sq || p <= 0 || p >= 1) return;
  const [x, y, w, h] = it.sq.box, dir = it.sq.dir, f = wipeFront(it.sq.box, dir, p, 40);
  const beads = it.sq.beads ? it.sq.beads.map((c, i, a) => ({ t0: i / a.length + .004, t1: (i + 1) / a.length, color: c })) : null;
  const o = { color: it.sq.color, beads, seed: 3, roll: f / 30, scale: 1.2, handle: .35, shadow: .16 };
  if (dir === 'down') squeegee(ctx, [x - 30, f + 12], [x + w + 30, f + 12], [0, 1], o);
  else if (dir === 'up') squeegee(ctx, [x + w + 30, f - 12], [x - 30, f - 12], [0, -1], o);
  else if (dir === 'right') squeegee(ctx, [f + 12, y - 30], [f + 12, y + h + 30], [1, 0], o);
}
// the screen over the opening print: mesh while printing, then the frame's bottom bar sweeps up and away
function mesh(lift) {
  if (lift >= 1) return;
  const y1 = H + 40 - ss(lift) * (H + 300);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.rect(-100, -100, W + 200, y1 + 100); ctx.clip();
  ctx.fillStyle = 'rgba(236,214,128,.05)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(60,52,30,.12)'; ctx.lineWidth = .5; ctx.beginPath();
  for (let x = 0; x < W; x += 7) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += 7) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
  if (lift > 0) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = .22; ctx.fillStyle = '#000'; ctx.fillRect(0, y1 + 40, W, 30 + 40 * lift);
    ctx.globalAlpha = 1; ctx.fillStyle = '#B7B2A6'; ctx.fillRect(0, y1, W, 40);
    ctx.fillStyle = '#D6D1C4'; ctx.fillRect(0, y1, W, 6); ctx.fillStyle = '#8E897E'; ctx.fillRect(0, y1 + 33, W, 7);
    ctx.fillStyle = '#3C6E9E'; ctx.fillRect(0, y1 - 12, W, 12);
    ctx.restore();
  }
}
// brand bug: the VIZA mark and the topic, printed small at the top of the sheet (screen space, below the 200 px status zone)
function drawBug(S, t) {
  const p = S.i === 0 ? seg(t, S.bugT, S.bugT + .25) : 1; if (p <= 0) return;
  const pal = S.pal, txt = (SP.topic || '').toUpperCase(), col = pickInk([pal.sky1, pal.sky2], [pal.near, pal.mid, PAPER], 3.5);
  const navyOk = contrast('#03346C', pal.sky2) >= 3 && contrast('#03346C', pal.sky1) >= 3, img = navyOk ? LOGO.mark : LOGO.markDark;
  const clip = p < 1 ? wipeRegion([ML - 10, 206, 960, 70], 'right', p, 5, 24) : null;
  if (img) ink(ctx, { paint: (g) => g.drawImage(img, ML, 216, 46, 40) }, { color: '#fff', reg: [0, 0], clip });
  ink(ctx, { paint: (g) => { setF(g, 600, 30, FT, 5); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(txt, ML + 62, 248); } }, { color: col, reg: R2(S.seed + 2, 1), clip });
}
function drawFoot(S, t) {
  const p = S.i === 0 ? seg(t, S.footT, S.footT + .25) : 1; if (p <= 0) return;
  ink(ctx, { path: rectPath(-20, FOOT, W + 40, H - FOOT + 20) }, { color: S.pal.near, reg: [0, 0], clip: p < 1 ? wipeRegion([0, FOOT - 20, W, H - FOOT + 40], 'up', p, 3, 40) : null, sheen: .6 });
}

function drawPrint(S, t) {
  const [cx, cy, z] = S.cam(t);
  setCam(cx, cy, z);
  drawScenery(S, t);
  for (const it of S.items) { const p = seg(t, it.t0, it.t0 + it.dur); if (p > 0) it.draw(ctx, p, t, S); }
  inkFinish(ctx, T, BX0, BY0, BW, BH, .6, 1);
  drawPullBlades(S, t);
  for (const it of S.items) drawItemSq(it, seg(t, it.t0, it.t0 + it.dur));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.i === 0) mesh(seg(t, S.lift, S.lift + .45));
  drawFoot(S, t);
  drawBug(S, t);
  ctx.save(); ctx.beginPath(); ctx.rect(0, FOOT, W, H - FOOT); ctx.clip(); inkFinish(ctx, T, 0, 0, W, H, .6, .8); ctx.restore();
}

// a re-ink sweep in screen space: everything behind the blade is the next print
const SW_BOX = [-700, -700, W + 1400, H + 1400], SW_ANG = -.32;
const swM = () => new DOMMatrix().translate(W / 2, H / 2).rotate(SW_ANG * 180 / Math.PI).translate(-W / 2, -H / 2);
function swRegion(p, seed) { const o = new Path2D(); o.addPath(wipeRegion(SW_BOX, 'down', p, seed, 50, 7), swM()); return o; }
function swFront(p) {
  const y = wipeFront(SW_BOX, 'down', p, 50), m = swM();
  const A = m.transformPoint(new DOMPoint(-700, y)), B = m.transformPoint(new DOMPoint(W + 700, y)), d = m.transformPoint(new DOMPoint(0, 1)), o = m.transformPoint(new DOMPoint(0, 0));
  return { a: [A.x, A.y], b: [B.x, B.y], lead: [d.x - o.x, d.y - o.y] };
}
function sceneAt(t) { let S = SCENES[0]; for (const s of SCENES) if (t >= s.start) S = s; return S; }
function sweepBlade(p, to, from) {
  if (p <= 0 || p >= 1) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const f = swFront(p), o = 22, pal = to.pal;
  const inks = to.palName !== from.palName ? [pal.sky1, pal.sky2, pal.far, pal.mid, pal.near] : [pal.near];   // a re-ink carries a split fountain
  const beads = inks.map((c, i) => ({ t0: .18 + i * .64 / inks.length + .004, t1: .18 + (i + 1) * .64 / inks.length, color: c }));
  squeegee(ctx, [f.a[0] + f.lead[0] * o, f.a[1] + f.lead[1] * o], [f.b[0] + f.lead[0] * o, f.b[1] + f.lead[1] * o], f.lead, { beads, seed: to.i, roll: p * 40, scale: 1.6, handle: .35, shadow: .16 });
  ctx.restore();
}

export function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const S = sceneAt(t), next = SCENES[S.i + 1];
  // the sweep is centred on the scene time: the blade crosses the middle of the frame exactly when the next scene starts
  const pair = next && t >= next.start - .22 ? [S, next] : (S.i > 0 && t < S.start + .22 ? [SCENES[S.i - 1], S] : null);
  if (pair) {
    const [a, b] = pair, p = seg(t, b.start - .22, b.start + .22);
    drawPrint(a, t);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clip(swRegion(p, b.i * 3 + 1)); drawPrint(b, t); ctx.restore();
    sweepBlade(p, b, a);
  } else drawPrint(S, t);
  caption(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------- captions: a printed strip on the foot band, pulled on with each line ----------------
function capAt(t) {
  const cs = SP.captions || [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], nx = cs[i + 1], end = Math.min(nx ? nx.start : DUR, c.end + .6);
    if (t >= c.start && t < end) return { c, i };
  }
  return null;
}
function capFit(text) {
  const zh = isCJK(text);
  for (const sz of zh ? [54, 48, 42] : [50, 44, 38]) { setF(ctx, 600, sz, FT, zh ? 1 : .3); const L = wrap(text, 960); if (L.length <= 2) return { sz, L, zh }; }
  setF(ctx, 600, zh ? 42 : 38, FT, 0); return { sz: zh ? 42 : 38, L: wrap(text, 960).slice(0, 2), zh };
}
function caption(t) {
  if (NOCAP) return;
  const a = capAt(t); if (!a) return;
  const { c, i } = a, S = sceneAt(t), pIn = seg(t, c.start, c.start + .12);
  if (S.i === 0 && t < S.footT + .2) return;
  const { sz, L, zh } = capFit(c.text), lh = sz * 1.22, y0 = CAP_MID - (L.length - 1) * lh / 2 + sz * .36;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const box = [40, FOOT + 4, W - 80, 1398 - FOOT - 4];
  ink(ctx, { paint: (g) => { setF(g, 600, sz, FT, zh ? 1 : .3); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; L.forEach((l, k) => g.fillText(l, W / 2, y0 + k * lh)); } },
    { color: pickInk(S.pal.near, [PAPER, S.pal.sky1], 4.5), reg: [1, -.6], clip: pIn < 1 ? wipeRegion(box, 'right', pIn, 7 + i, 26, 5) : null });
}

// every on-screen text at t (pixels), for readcheck; running counters are left out until they stop
export function texts(t) {
  const out = [], S = sceneAt(t);
  CAM = camFix(...S.cam(t));
  for (const it of S.items) {
    if (!it.text || !it.box || t < it.t0 + it.dur || (it.liveUntil && t < it.liveUntil)) continue;
    const [x0, y0] = toScreen(it.box[0], it.box[1]), [x1, y1] = toScreen(it.box[2], it.box[3]);
    out.push({ id: `${S.i}-${it.id}`, text: it.text, x0: Math.max(0, x0), y0, x1: Math.min(W, x1), y1, pass: it.pass });
  }
  return out;
}
