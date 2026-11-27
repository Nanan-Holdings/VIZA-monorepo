// VIZA shorts, ascii-crt template: any VideoSpec (src/spec.ts) → a film on one amber terminal.
// Scene kinds map to the terminal's own moves (STYLE.md §6, §8):
//   hook     command typed, title typed big at a 20-column grid, a glyph-density airliner made only of the title's letters (EU ring of * if asked)
//   acronym  the acronym typed huge, then pull out: each letter becomes the inverse first cell of a log line
//   notA     the wrong word typed big, overstruck cell by cell, an inverse stamp with an error beep and a CRT jolt, then the answer typed
//   stats    rows of a readout: digits roll discretely (fast, then slowing); an old value overstruck first
//   timeline a log file: one entry per point, slipped entries overstruck, the target in inverse, the buffer scrolls
//   verdict  an inverse badge with a BEL, the headline typed during a push-in, a passport data page in glyph density with a typed MRZ
//   cta      the URL typed huge, then the one second colour switches on; the real VIZA logotype sits above it, untouched by the phosphor
// Captions are the LOG strip (STYLE.md §4), typed word by word on the voice's word timings.
import { glyph, text, inverse, cursor, makeRamp, isWide, colsOf } from './term.js';
import { Pic, paintPlane, paintClouds, paintPassport } from './art.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = .1;                                                   // phosphor afterglow
const decay = (t, tOff, tau = TAU) => t < tOff ? 1 : Math.exp(-(t - tOff) / tau);
const blink = (t, t0, per = .53) => { if (t < t0) return 1; const r = (t - t0) % per; return r < per / 2 ? 1 : decay(r, per / 2); };
const flashUp = (t, t0, k = .8, tau = .15) => t < t0 ? 1 : 1 + k * Math.exp(-(t - t0) / tau);
const chars = s => [...s];
const typedN = (t, t0, dt, n) => t < t0 ? 0 : Math.min(n, Math.floor((t - t0) / dt) + 1);

// greedy wrap by columns; CJK breaks anywhere, Latin at spaces; over-long words are hard-split
export function wrap(str, maxc) {
  const toks = []; let cur = '';
  for (const ch of str) {
    if (isWide(ch)) { if (cur) toks.push(cur); cur = ''; toks.push(ch); }
    else if (ch === ' ') { if (cur) toks.push(cur); cur = ''; toks.push(' '); }
    else cur += ch;
  }
  if (cur) toks.push(cur);
  const lines = []; let line = '';
  for (const tk of toks) {
    if (tk === ' ') { if (line) line += ' '; continue; }
    const cand = line + tk;
    if (colsOf(cand.trimEnd()) > maxc && line.trim()) { lines.push(line.trimEnd()); line = tk; } else line = cand;
  }
  if (line.trim()) lines.push(line.trimEnd());
  // CJK closing punctuation never starts a line
  for (let i = 1; i < lines.length; i++) while (/^[，。、？！：；）」』,.!?:;)]/.test(lines[i]) && lines[i].length > 1) { lines[i - 1] += lines[i][0]; lines[i] = lines[i].slice(1); }
  return lines.flatMap(l => { const out = []; let s = ''; for (const ch of l) { if (colsOf(s + ch) > maxc) { out.push(s); s = ''; } s += ch; } if (s) out.push(s); return out; });
}

export function buildFilm(spec, W, H) {
  const ZH = /^zh/.test(spec.locale || '');
  const up = s => ZH ? String(s || '') : String(s || '').toUpperCase();
  let END_HOLD = 0;                                               // the CTA end card holds 3.5 s after its last item lands
  let DUR = +(spec.durationSec || Math.max(...spec.scenes.map(s => s.end))).toFixed(3);
  const EV = [], ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(4), type, ...o });
  // keys: each character → a sound; machine output only ticks once per few characters so it never chatters under the voice
  const regType = (str, t0, dt, kind = 'key', every = 1) => chars(str).forEach((ch, k) => { if (k % every) return; ev(t0 + k * dt, ch === ' ' && kind === 'key' ? 'space' : kind); });
  let REC = null;                                                  // TEXTS recorder
  const rec = (id, s, x0, y0, x1, y1) => { if (REC && s.trim()) REC.push({ id, text: s, x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1) }); };

  // ---------------- layout (1080x1920: key text between y 270 and 1180, LOG strip 1196..1345, nothing key below 1400) ----------------
  const M = 60, TOP = 270, BOT = 1226, INNER = W - 2 * M;
  const T24 = { ox: M, oy: TOP, cw: 24 };
  const cwFit = (cols, max, min = 12) => Math.max(min, Math.min(max, Math.floor(INNER / Math.max(1, cols))));
  const v = (oy, cw, ox = M) => ({ ox, oy, cw });
  const centreX = (str, cw) => (W - colsOf(str) * cw) / 2;

  // typed block of lines: n characters shown in total; returns where the cursor sits
  function block(g, id, lines, view, n, a = 1, chan = 0, centre = false) {
    let k = n, row = 0, col = 0, x = view.ox;
    lines.forEach((L, i) => {
      const ox = centre ? centreX(L, view.cw) : view.ox, cnt = chars(L).length;
      const shown = Math.max(0, Math.min(cnt, k));
      if (shown > 0 || k >= 0) { col = text(g, L, 0, i, { ox, oy: view.oy, cw: view.cw }, a, chan, shown); row = i; x = ox; }
      if (shown === cnt && a > .3) rec(`${id}.${i}`, L, ox, view.oy + i * view.cw * 2, ox + colsOf(L) * view.cw, view.oy + (i + 1) * view.cw * 2);
      k -= cnt; if (k < 0 && i < lines.length - 1) k = -1;
    });
    const total = lines.reduce((s, L) => s + chars(L).length, 0);
    if (n < total) { let m = n; for (let i = 0; i < lines.length; i++) { const c = chars(lines[i]).length; if (m <= c) { const ox = centre ? centreX(lines[i], view.cw) : view.ox; return { col: colsOf(chars(lines[i]).slice(0, m).join('')), row: i, view: { ...view, ox }, done: false }; } m -= c; } }
    return { col: colsOf(lines[lines.length - 1] || ''), row: lines.length - 1, view: { ...view, ox: x }, done: true };
  }
  const nChars = lines => lines.reduce((s, L) => s + chars(L).length, 0);
  // overstrike: '-' typed over each cell of a typed string, one cell at a time (a teletype strike-through)
  function strike(g, str, view, col, row, t, t0, dt, a = 1) {
    const n = typedN(t, t0, dt, colsOf(str));
    for (let c = 0; c < n; c++) glyph(g, '-', view.ox + (col + c) * view.cw, view.oy + row * view.cw * 2 - view.cw * .12, view.cw, a);
  }

  // ---------------- scene builders: plan at build time (events too), draw(g, t, amp) later ----------------
  const RAMP_STD = makeRamp(' .:-=+*#%@');
  const B = (S, k, fb) => (S.beats && S.beats[k] != null && S.beats[k] >= S.start && S.beats[k] < S.end) ? S.beats[k] : fb;
  const mk = {};

  mk.hook = (S, si) => {
    const P = S.props || {};
    const b0 = B(S, 0, S.start + .2), b1 = B(S, 1, Math.min(S.end - 1, b0 + 1.8)), b2 = B(S, 2, Math.min(S.end - .6, b1 + 2.4));
    const kick = wrap('> ' + up(P.kicker), 38), kdt = Math.min(.028, Math.max(.008, (b1 - b0 - .3) / Math.max(1, nChars(kick))));
    regType(kick.join(''), b0, kdt, 'tick', 2);
    const titleRaw = (P.lines || []).map(up).filter(Boolean);
    // each spec line stays one line if it fits at 40 px cells or more; otherwise wrap at the largest grid that keeps it to 4 lines
    let tl = titleRaw, cwT = cwFit(Math.max(1, ...titleRaw.map(colsOf)), 72);
    if (cwT < 40) for (const cw of [52, 44, 40, 34]) { tl = titleRaw.flatMap(L => wrap(L, Math.floor(INNER / cw))); cwT = cw; if (tl.length <= 4) break; }
    cwT = Math.min(72, cwFit(Math.max(1, ...tl.map(colsOf)), 72));
    const tdt = Math.min(.07, Math.max(.025, (b2 - b1 - .4) / Math.max(1, nChars(tl))));
    regType(tl.join(' '), b1, tdt, 'key');
    const kY = TOP, tY = TOP + kick.length * 48 + 60;
    const turn = P.turn ? wrap(up(P.turn), 31) : [];
    const turnY = tY + tl.length * cwT * 2 + 56;
    const udt = Math.min(.03, Math.max(.01, (S.end - b2 - .8) / Math.max(1, nChars(turn))));
    if (turn.length) { ev(b2, 'enter'); regType(turn.join(''), b2 + .15, udt, 'tick', 2); }
    // picture band: an airliner made of the title's own letters (Latin titles), or the standard ramp
    const picY = Math.round((turn.length ? turnY + turn.length * 60 + 40 : turnY) / 16) * 16;
    const picRows = Math.floor((BOT - picY) / 16);
    const letters = (titleRaw.join('') + up(P.kicker)).replace(/[^A-Z0-9]/g, '');
    const ramp = new Set(letters).size >= 6 ? makeRamp(letters + '.') : RAMP_STD;
    const pic = picRows >= 10 ? new Pic(0, picY, Math.ceil(W / 8), picRows, 8) : null;
    if (pic) for (let k = 0; k < 6; k++) ev(b1 + .2 + k * .12, 'land', { n: 6 });
    const ring = P.ring === 'eu';
    if (ring) for (let k = 0; k < 12; k++) ev(b0 + .3 + k * .09, 'tick');
    return {
      draw(g, t, amp) {
        // the opening cursor, then the command
        const kn = typedN(t, b0, kdt, nChars(kick));
        const kc = block(g, `s${si}.kick`, kick, v(kY, 24), kn, .8 * amp);
        if (t < b1) cursor(g, kc.col, kc.row, kc.view, (kn < nChars(kick) ? 1 : blink(t, b0 + nChars(kick) * kdt)) * amp);
        // title
        const tn = typedN(t, b1, tdt, nChars(tl));
        const tc = block(g, `s${si}.title`, tl, v(tY, cwT), tn, 1.05 * amp);
        if (t >= b1 && t < (turn.length ? b2 + .1 : S.end)) cursor(g, tc.col, tc.row, tc.view, (tc.done ? blink(t, b1 + nChars(tl) * tdt) : 1) * amp);
        // the turn
        if (turn.length && t >= b2) {
          const un = typedN(t, b2 + .15, udt, nChars(turn));
          inverse(g, ' ! ', 0, 0, v(turnY, 30), .9 * amp);
          const uc = block(g, `s${si}.turn`, turn, v(turnY, 30, M + 4 * 30), un, amp);
          cursor(g, uc.col, uc.row, uc.view, (uc.done ? blink(t, b2 + .15 + nChars(turn) * udt) : 1) * amp);
        }
        if (pic && t >= b1) {
          const k = eo(seg(t, b1, b1 + 2.4));
          const L = Math.min(860, picRows * 16 * 2.3);
          const cx = lerp(-L * .6, W * .52, k) + (t - b1) * 6, cy = picRows * 16 * .55 - (t - b1) * 4;
          const c = pic.build(g2 => { paintClouds(g2, W, picRows * 16, t, si + 1); paintPlane(g2, cx, cy, L, -.06); });
          pic.draw(g, c, ramp, amp * (.4 + .6 * ss(seg(t, b1, b1 + .5))));
        }
        if (ring && pic) {
          const cx = W / 2, cy = picY + picRows * 8, r = Math.min(picRows * 8 - 30, 300);
          for (let k = 0; k < 12; k++) { if (t < b0 + .3 + k * .09) continue; const a = -Math.PI / 2 + k * Math.PI / 6;
            const cw = 24, i = Math.round((cx + Math.cos(a) * r) / cw), j = Math.round((cy + Math.sin(a) * r * .9) / (cw * 2));
            glyph(g, '*', i * cw - cw / 2, j * cw * 2 - cw, cw, .95 * amp * flashUp(t, b0 + .3 + k * .09)); }
        }
      },
    };
  };

  mk.acronym = (S, si) => {
    const P = S.props || {};
    const b0 = B(S, 0, S.start + .15);
    const acr = up(P.acronym || ''), cwA = cwFit(colsOf(acr) + 1, 130);
    const adt = Math.min(.08, .45 / Math.max(1, chars(acr).length));
    regType(acr, b0, adt, 'key');
    const words = (P.words || []).map(up);
    const wY = TOP + cwA * 2 + 70, cwW = Math.min(34, Math.floor((BOT - 60 - wY) / Math.max(1, words.length) / 2.3));
    const wStart = b0 + chars(acr).length * adt + .1;
    const step = Math.min(.32, Math.max(.08, (S.end - wStart - .5) / Math.max(1, words.length)));
    const wt = words.map((_, k) => wStart + k * step);
    wt.forEach(x => ev(x, 'tick'));
    const note = P.note ? wrap(up(P.note), 38) : [];
    const nY = wY + words.length * cwW * 2.3 + 30;
    return {
      draw(g, t, amp) {
        // pull out: the acronym starts 20% bigger and settles as the list forms
        const n = typedN(t, b0, adt, chars(acr).length);
        const z = lerp(1.2, 1, ss(seg(t, wStart - .1, wStart + .6)));
        const cw = cwA * z, ox = (W - colsOf(acr) * cw) / 2;
        let c = 0;
        chars(acr).forEach((ch, k) => {
          if (k >= n) return;
          const lit = k < words.length ? flashUp(t, wt[k], .7, .18) : 1;
          glyph(g, ch, ox + c * cw, TOP + 20 - (z - 1) * cwA, cw, 1.05 * amp * lit); c += isWide(ch) ? 2 : 1;
        });
        if (n === chars(acr).length) rec(`s${si}.acr`, acr, ox, TOP, ox + colsOf(acr) * cw, TOP + cw * 2);
        if (t < wStart + .2) cursor(g, n < chars(acr).length ? n : chars(acr).length, 0, { ox, oy: TOP + 20 - (z - 1) * cwA, cw }, (n < chars(acr).length ? 1 : blink(t, b0 + n * adt)) * amp);
        words.forEach((w, k) => {
          if (t < wt[k]) return;
          const vw = { ox: M, oy: wY + k * cwW * 2.3, cw: cwW };
          const first = chars(w)[0] || ' ', rest = chars(w).slice(1).join('');
          inverse(g, first, 0, 0, vw, amp * flashUp(t, wt[k], .5));
          const rn = typedN(t, wt[k] + .04, .014, chars(rest).length);
          text(g, rest, colsOf(first) + .5, 0, vw, .9 * amp, 0, rn);
          if (rn === chars(rest).length) rec(`s${si}.w${k}`, w, M, vw.oy, M + (colsOf(w) + 1) * cwW, vw.oy + cwW * 2);
        });
        if (note.length && t >= wt[wt.length - 1] + .3) block(g, `s${si}.note`, note, v(nY, 24), typedN(t, wt[wt.length - 1] + .3, .012, nChars(note)), .7 * amp);
      },
    };
  };

  mk.notA = (S, si) => {
    const P = S.props || {};
    const b0 = B(S, 0, S.start + .2), b1 = B(S, 1, Math.max(b0 + 1.6, S.start + (S.end - S.start) * .45));
    const sw = up(P.struck || ''), cwS = cwFit(colsOf(sw), 112, 36);
    const sdt = Math.min(.08, .5 / Math.max(1, chars(sw).length));
    regType(sw, b0, sdt, 'key');
    const tStrike = b0 + chars(sw).length * sdt + .3, kdt = .045;
    for (let c = 0; c < colsOf(sw); c++) ev(tStrike + c * kdt, 'strike');
    const stamp = P.stamp ? ' ' + up(P.stamp) + ' ' : '';
    const cwSt = cwFit(colsOf(stamp), 44, 20);
    const tStamp = Math.min(b1 - .25, tStrike + colsOf(sw) * kdt + .2);
    if (stamp) ev(tStamp, 'err');
    const cwI = (P.rows || []).length ? 34 : 40;
    const isL = wrap('> ' + up(P.is || ''), Math.floor(INNER / cwI));
    const like = P.like ?? P['like?'] ?? P['like?:'];
    const likeL = like ? wrap(up(like), 38) : [];
    const rows = (P.rows || []).map(up).slice(0, 3);
    const sY = TOP + 10, stY = sY + cwS * 2 + 40, iY = stY + (stamp ? cwSt * 2 + 70 : 0);
    const idt = Math.min(.03, Math.max(.01, (S.end - b1 - 1) / Math.max(1, nChars(isL) + nChars(likeL))));
    regType(isL.join(''), b1, idt, 'tick', 2);
    const lY = iY + isL.length * cwI * 2 + 24, tLike = b1 + nChars(isL) * idt + .2;
    const rY = lY + likeL.length * 48 + 40;
    const rowsL = rows.map(r => wrap(r, 33)[0]);
    const rStep = Math.min(.45, Math.max(.15, (S.end - tLike - nChars(likeL) * .012 - .6) / Math.max(1, rows.length)));
    const rt = rows.map((_, k) => tLike + nChars(likeL) * .012 + .25 + k * rStep);
    rt.forEach(x => ev(x, 'tick'));
    return {
      draw(g, t, amp) {
        const n = typedN(t, b0, sdt, chars(sw).length);
        const struckA = t < tStrike ? 1 : lerp(1, .45, seg(t, tStrike, tStrike + colsOf(sw) * kdt + .1));
        const ox = M;
        text(g, sw, 0, 0, v(sY, cwS, ox), 1.05 * amp * struckA, 0, n);
        if (t < tStrike) cursor(g, colsOf(chars(sw).slice(0, n).join('')), 0, v(sY, cwS, ox), (n < chars(sw).length ? 1 : blink(t, b0 + n * sdt)) * amp);
        strike(g, sw, v(sY, cwS, ox), 0, 0, t, tStrike, kdt, 1.1 * amp);
        if (stamp && t >= tStamp) {
          inverse(g, stamp, 0, 0, v(stY, cwSt, ox), amp * flashUp(t, tStamp, .9, .12));
          rec(`s${si}.stamp`, stamp, ox, stY, ox + colsOf(stamp) * cwSt, stY + cwSt * 2);
        }
        if (t >= b1) {
          const c = block(g, `s${si}.is`, isL, v(iY, cwI), typedN(t, b1, idt, nChars(isL)), amp);
          if (!c.done || t < tLike + .3) cursor(g, c.col, c.row, c.view, amp);
          if (likeL.length && t >= tLike) block(g, `s${si}.like`, likeL, v(lY, 24, M + 48), typedN(t, tLike, .012, nChars(likeL)), .72 * amp);
          rowsL.forEach((r, k) => {
            if (t < rt[k]) return;
            const vr = v(rY + k * 64, 26);
            inverse(g, ' OK ', 0, 0, vr, .85 * amp * flashUp(t, rt[k], .6));
            const rn = typedN(t, rt[k] + .05, .012, chars(r).length);
            text(g, r, 5, 0, vr, .9 * amp, 0, rn);
            if (rn === chars(r).length) rec(`s${si}.r${k}`, r, M + 5 * 26, vr.oy, M + (5 + colsOf(r)) * 26, vr.oy + 52);
          });
        }
      },
    };
  };

  mk.stats = (S, si) => {
    const P = S.props || {};
    const items = (P.items || []).slice(0, 4).map(o => ({ ...o })), n = items.length;
    const title = P.title ? ' ' + up(P.title) + ' ' : '';
    const y0 = TOP + (title ? 90 : 10), hb = Math.min(280, (BOT - y0) / Math.max(1, n));
    const cwV = Math.min(68, Math.floor((hb - 80) / 2.4));
    const plans = items.map((it0, k) => { let it = it0;
      const t0 = B(S, k, S.start + .25 + k * (S.end - S.start - .8) / Math.max(1, n));
      const struck = it.struck ? up(it.struck) : '';
      const tVal = t0 + (struck ? .75 : 0);
      const pre = it.prefix || '', suf = up(it.suffix || ''), val = up(it.value);
      // a plain number rolls even without countTo; prefix/suffix are added unless the value already carries them
      const cnt = it.countTo != null && Number.isFinite(+it.countTo) ? +it.countTo : (/^\d{1,4}$/.test(val) ? +val : null);
      const roll = cnt != null;
      if (roll) it = { ...it, countTo: cnt };
      const fin = roll ? pre + String(cnt) + suf : (pre && !val.startsWith(up(pre)) ? pre : '') + val + (suf && !val.endsWith(suf.trim()) ? suf : '');
      const cw = Math.min(cwV, Math.floor((INNER - (struck ? (colsOf(struck) + 1) * cwV * .5 : 0)) / Math.max(1, colsOf(fin) + 1)));
      const rollD = roll ? Math.min(.9, .25 + .04 * it.countTo) : 0;
      const vdt = roll ? 0 : Math.min(.06, .4 / Math.max(1, chars(fin).length));
      if (struck) { regType(struck, t0, .05, 'keyLight'); for (let c = 0; c < colsOf(struck); c++) ev(t0 + .35 + c * .04, 'strike'); }
      if (roll) { const steps = Math.min(+it.countTo, 24); for (let s = 1; s <= steps; s++) ev(tVal + rollD * (1 - Math.pow(1 - s / steps, 1 / 2.2)), 'ratchet'); ev(tVal + rollD, 'clunk'); }
      else regType(fin, tVal, vdt, 'key');
      const tLab = tVal + (roll ? rollD : chars(fin).length * vdt) + .12;
      const lab = wrap(up(it.label || ''), 38).slice(0, 2);
      return { t0, struck, tVal, pre, suf, roll, fin, cw, rollD, vdt, tLab, lab, it, y: y0 + k * hb };
    });
    if (title) ev(S.start + .1, 'tick');
    return {
      draw(g, t, amp) {
        if (title && t >= S.start + .1) { inverse(g, title, 0, 0, v(TOP + 10, 28), .9 * amp); rec(`s${si}.title`, title, M, TOP + 10, M + colsOf(title) * 28, TOP + 66); }
        plans.forEach((p, k) => {
          if (t < p.t0) return;
          let x = M;
          const vy = p.y, scw = Math.round(p.cw * .55);
          if (p.struck) {
            const sv = v(vy + (p.cw * 2 - scw * 2) / 2, scw, x);
            text(g, p.struck, 0, 0, sv, .55 * amp, 0, typedN(t, p.t0, .05, chars(p.struck).length));
            strike(g, p.struck, sv, 0, 0, t, p.t0 + .35, .04, amp);
            x += (colsOf(p.struck) + 1) * scw;
          }
          if (t >= p.tVal) {
            let s;
            if (p.roll) { const u = seg(t, p.tVal, p.tVal + p.rollD); const num = Math.round(+p.it.countTo * (1 - Math.pow(1 - u, 2.2))); s = p.pre + String(num) + p.suf; }
            else s = chars(p.fin).slice(0, typedN(t, p.tVal, p.vdt, chars(p.fin).length)).join('');
            const done = p.roll ? t >= p.tVal + p.rollD : chars(s).length === chars(p.fin).length;
            const end = text(g, s, 0, 0, v(vy, p.cw, x), 1.05 * amp * (done ? flashUp(t, p.roll ? p.tVal + p.rollD : p.tVal + chars(p.fin).length * p.vdt, .6) : 1));
            if (done) rec(`s${si}.v${k}`, p.fin, x, vy, x + colsOf(p.fin) * p.cw, vy + p.cw * 2);
            const nextT = k + 1 < plans.length ? plans[k + 1].t0 : S.end;
            if (t < nextT) cursor(g, end, 0, v(vy, p.cw, x), (done ? blink(t, p.tLab) : 1) * .7 * amp);
          }
          if (t >= p.tLab) block(g, `s${si}.l${k}`, p.lab, v(vy + p.cw * 2 + 8, 24), typedN(t, p.tLab, .014, nChars(p.lab)), .78 * amp);
        });
      },
    };
  };

  mk.timeline = (S, si) => {
    const P = S.props || {};
    const pts = (P.points || []).slice(0, 6), n = pts.length;
    const title = ' ' + up(P.title || 'LOG') + ' ';
    const b0 = B(S, 0, S.start + .2);
    const last = S.beats && S.beats.length > 1 ? S.beats[S.beats.length - 1] : b0 + (S.end - b0) * .62;
    const pend = Math.max(b0 + .4 * n, Math.min(last, S.end - 1.2));
    const pt = pts.map((_, k) => b0 + .2 + k * (pend - b0 - .2) / Math.max(1, n));
    const cwL = 40, hb = cwL * 2 + 48 + 22;
    const tCav = Math.min(S.end - .9, Math.max(pt[n - 1] + .9, S.beats && S.beats.length > 1 ? S.beats[S.beats.length - 1] + .6 : S.end - 1.6));
    const cav = P.caveat ? wrap(up(P.caveat), Math.floor((INNER - 120) / 30)) : [];
    pts.forEach((p, k) => { ev(pt[k], 'enter'); regType(up(p.label), pt[k] + .05, .03, 'tick', 2); if (p.state !== 'target' && k + 1 < n) for (let c = 0; c < colsOf(up(p.label)) + 2; c++) ev(pt[k + 1] - .25 + c * .03, 'strike'); });
    if (cav.length) ev(tCav, 'err', { soft: 1 });
    const y0 = TOP + 90;
    return {
      draw(g, t, amp) {
        inverse(g, title, 0, 0, v(TOP + 10, 28), .9 * amp); rec(`s${si}.title`, title, M, TOP + 10, M + colsOf(title) * 28, TOP + 66);
        // the buffer: entries appended; when it overflows the screen it scrolls up one entry at a time
        const shown = pts.filter((_, k) => t >= pt[k]).length;
        const cavH = cav.length && t >= tCav ? cav.length * 60 + 40 : 0;
        const over = y0 + shown * hb + cavH - BOT;
        const scroll = over > 0 ? Math.ceil(over / hb) * hb : 0;
        g.save(); g.beginPath(); g.rect(0, TOP + 76, W, BOT - TOP - 60); g.clip();
        pts.forEach((p, k) => {
          if (t < pt[k]) return;
          const y = y0 + k * hb - scroll, lab = '[' + up(p.label) + ']';
          const target = p.state === 'target';
          const slipped = !target && k + 1 < n && t >= pt[k + 1] - .25;
          const a = (slipped ? lerp(1, .5, seg(t, pt[k + 1] - .25, pt[k + 1] + .2)) : 1) * amp;
          const vl = v(y, cwL);
          const ln = typedN(t, pt[k] + .05, .03, chars(lab).length);
          text(g, lab, 0, 0, vl, (target ? 1.1 : .95) * a, 0, ln);
          if (ln === chars(lab).length) rec(`s${si}.p${k}`, lab, M, y, M + colsOf(lab) * cwL, y + cwL * 2);
          if (slipped) strike(g, lab, vl, 0, 0, t, pt[k + 1] - .25, .03, amp);
          const note = up(p.note || '');
          const vn = v(y + cwL * 2 + 4, 24);
          if (t >= pt[k] + .05 + chars(lab).length * .03) {
            const tag = target ? ' TARGET ' : (slipped || !target ? ' ' + (k + 1 < n || !target ? 'SLIPPED' : '') + ' ' : '');
            const nn = wrap(note, 38 - colsOf(tag) - 1)[0] || '';
            text(g, nn, 0, 0, vn, .75 * a, 0, typedN(t, pt[k] + .1 + chars(lab).length * .03, .012, chars(nn).length));
            if (target) { inverse(g, tag, 39 - colsOf(tag), 0, vn, amp * flashUp(t, pt[k] + .3, .8)); cursor(g, colsOf(lab), 0, vl, blink(t, pt[k] + .4) * amp); }
            else if (slipped) text(g, 'SLIPPED', 39 - 7, 0, vn, .55 * amp);
            if (nn) rec(`s${si}.n${k}`, nn, M, vn.oy, M + colsOf(nn) * 24, vn.oy + 48);
          }
        });
        if (cav.length && t >= tCav) {
          const y = y0 + shown * hb - scroll + 10;
          inverse(g, ' ! ', 0, 0, v(y, 30), amp * blink(t, tCav + .6, .8));
          block(g, `s${si}.cav`, cav, v(y, 30, M + 4 * 30), typedN(t, tCav + .1, .02, nChars(cav)), amp);
        }
        g.restore();
      },
    };
  };

  mk.verdict = (S, si) => {
    const P = S.props || {};
    const b0 = B(S, 0, S.start + .2);
    const badge = ' ' + up(P.badge || '') + ' ';
    let hl, cwH;
    // largest grid that keeps the headline to 3 lines without leaving an orphan on the last line
    for (const cw of [56, 48, 44, 40, 34]) { hl = wrap(up(P.headline || ''), Math.floor(INNER / cw)); cwH = cw;
      if (hl.length <= 3 && (hl.length === 1 || colsOf(hl[hl.length - 1]) >= .4 * colsOf(hl[0]))) break; }
    const hY = TOP + 100, hdt = Math.min(.06, Math.max(.02, (S.end - b0 - 1.6) * .5 / Math.max(1, nChars(hl))));
    const tH = b0 + .3, tHe = tH + nChars(hl) * hdt;
    ev(b0, 'bel'); regType(hl.join(' '), tH, hdt, 'keyLight');
    const b1 = Math.max(tHe + .3, B(S, 1, tHe + .4));
    const note = P.note ? wrap(up(P.note), 36) : [];
    const nY = hY + hl.length * cwH * 2 + 40, ndt = Math.min(.025, Math.max(.008, (S.end - b1 - .5) / Math.max(1, nChars(note))));
    regType(note.join(''), b1, ndt, 'tick', 3);
    // the passport data page fills what is left of the screen
    const py = Math.round((nY + note.length * 52 + 50) / 16) * 16, ph = Math.min(520, BOT - py);
    const pw = Math.min(INNER, Math.round(ph * 1.45)), px = Math.round((W - pw) / 2 / 8) * 8;
    const ok = ph >= 260;
    const pic = ok ? new Pic(px - 16, py, Math.ceil((pw + 32) / 8), Math.floor(ph / 16), 8) : null;
    let cells = null;
    const tP = b0 + .15, rowsP = pic ? pic.rows : 0;
    if (pic) for (let r = 0; r < rowsP; r += 4) ev(tP + r / rowsP * .7, 'land', { n: 8 });
    const mcw = Math.max(9, Math.floor((pw - 40) / 44));
    const MRZ = ['P<XXXTRAVELLER<<SAMPLE<<<<<<<<<<<<<<<<<<<<<<', 'X000000000XXX0000000X0000000<<<<<<<<<<<<<<00'];
    const tM = tP + .8;
    return {
      draw(g, t, amp) {
        if (t >= b0) { inverse(g, badge, 0, 0, v(TOP + 10, 32), amp * flashUp(t, b0, .7)); rec(`s${si}.badge`, badge, M, TOP + 10, M + colsOf(badge) * 32, TOP + 74); }
        // push in on the headline while it is typed (grid scale = camera)
        const z = 1 + .05 * ss(seg(t, tH, tHe + .6));
        g.save(); g.translate(W / 2, hY); g.scale(z, z); g.translate(-W / 2, -hY);
        const c = block(g, `s${si}.head`, hl, v(hY, cwH), typedN(t, tH, hdt, nChars(hl)), 1.08 * amp, 0, true);
        if (t >= tH) cursor(g, c.col, c.row, c.view, (c.done ? blink(t, tHe) : 1) * amp);
        g.restore();
        if (t >= b1) block(g, `s${si}.note`, note, v(nY, 26), typedN(t, b1, ndt, nChars(note)), .78 * amp);
        if (pic && t >= tP) {
          if (!cells) cells = pic.build(g2 => paintPassport(g2, 16, 0, pw, ph));
          const r = (t - tP) / .7 * rowsP;                              // raster reveal, top to bottom
          pic.draw(g, cells, RAMP_STD, amp * .9, (i, j) => j < r);
          const vH = v(py + ph * .03, 16, px + pw * .38);
          if (t >= tP + .5) text(g, 'PASSPORT', 0, 0, vH, .9 * amp, 0, typedN(t, tP + .5, .03, 8));
          MRZ.forEach((L, k) => { const vm = v(py + ph * .78 + k * mcw * 2.1, mcw, px + (pw - 44 * mcw) / 2); text(g, L, 0, 0, vm, .85 * amp, 0, typedN(t, tM + k * .3, .007, 44)); });
        }
      },
    };
  };

  let LOGO = null;
  mk.cta = (S, si) => {
    const P = S.props || {};
    const q = wrap('> ' + up(P.question || ''), 31);
    const qdt = Math.min(.025, Math.max(.008, .6 / Math.max(1, nChars(q))));
    regType(q.join(''), S.start + .05, qdt, 'tick', 2);
    const b0 = Math.max(B(S, 0, S.start + .2), S.start + .05 + nChars(q) * qdt + .05);
    const url = String(P.url || 'viza.it.com'), cwU = cwFit(colsOf(url) + 1, 86);
    const udt = Math.min(.06, Math.max(.03, (S.end - b0 - 1.2) * .4 / Math.max(1, url.length)));
    regType(url, b0, udt, 'key');
    const tU = b0 + url.length * udt;
    ev(tU + .02, 'hit');
    const pill = ' ' + up(P.pill || 'Free') + ' ';
    const qY = TOP, uY = qY + q.length * 60 + 50, pY = uY + cwU * 2 + 36, lY = pY + 44 * 2 + 44;
    const disc = wrap(P.disclaimer || '', 46);
    const dY = BOT - disc.length * 40 - 6;
    LOGO = { t0: tU + .25, y: lY, w: 380, x: (W - 380) / 2 };
    END_HOLD = Math.max(END_HOLD, tU + .12, LOGO.t0 + .25, S.start + .3 + nChars(disc) * .01) + 3.5;
    return {
      draw(g, t, amp) {
        block(g, `s${si}.q`, q, v(qY, 30), typedN(t, S.start + .05, qdt, nChars(q)), .85 * amp);
        const un = typedN(t, b0, udt, url.length), done = un === url.length && t >= tU;
        const ox = (W - colsOf(url) * cwU) / 2;
        // the one second colour switches on when the address is complete
        const chan = done ? 1 : 0;
        if (done) { text(g, url, 0, 0, v(uY, cwU, ox), 1.1 * amp * flashUp(t, tU, 1, .2), 1); rec(`s${si}.url`, url, ox, uY, ox + colsOf(url) * cwU, uY + cwU * 2); }
        else text(g, url, 0, 0, v(uY, cwU, ox), 1.05 * amp, chan, un);
        if (t >= b0 && !done) cursor(g, un, 0, v(uY, cwU, ox), amp);
        if (t >= tU + .12) {
          const px = (W - colsOf(pill) * 44) / 2;
          inverse(g, pill, 0, 0, v(pY, 44, px), amp * flashUp(t, tU + .12, .6), 1);
          rec(`s${si}.pill`, pill, px, pY, px + colsOf(pill) * 44, pY + 88);
          cursor(g, colsOf(pill) + 1, 0, v(pY, 44, px), blink(t, tU + .4, .6) * .8 * amp);
        }
        block(g, `s${si}.disc`, disc, v(dY, 20), typedN(t, S.start + .3, .01, nChars(disc)), .62 * amp, 0, true);
      },
    };
  };

  // ---------------- timeline of scenes ----------------
  const scenes = spec.scenes.map((S, i) => ({ S, kind: S.kind, ...(mk[S.kind] ? mk[S.kind](S, i) : { draw() {} }) }));
  spec.scenes.forEach((S, i) => { if (i) ev(S.start, 'cls'); ev(S.start, 'scene', { kind: S.kind, i, end: S.end }); });
  ev(0.02, 'relay'); ev(.06, 'degauss');
  const tStamps = EV.filter(e => e.type === 'err' && !e.soft).map(e => e.t);

  DUR = +Math.max(DUR, END_HOLD).toFixed(3);                      // extend past the spec end if the end card needs it

  // ---------------- LOG strip: captions typed word by word ----------------
  const caps = (spec.captions || []).map((c, i, A) => {
    const txt = up(c.text);
    const lines = wrap(txt, 37);
    const flat = chars(lines.join(''));
    // each word's end → a character position in the wrapped text
    const marks = []; let pos = 0; const plain = lines.join('');
    for (const w of c.words || []) {
      const wt = up(w.text).trim(); if (!wt) continue;
      const at = plain.indexOf(wt, pos);
      const end = at >= 0 ? at + wt.length : Math.min(plain.length, pos + wt.length);
      marks.push([w.start, w.end, chars(plain.slice(0, end)).length]); pos = end;
    }
    const nextStart = i + 1 < A.length ? A[i + 1].start : Infinity;
    const hold = Math.max(c.end + 1.0, c.start + 1.8);
    return { ...c, lines, n: flat.length, marks, t1: Math.min(nextStart, hold, DUR) };
  });
  const capChars = (c, t) => {
    if (!c.marks.length) return Math.ceil(c.n * seg(t, c.start, c.end));
    let n = 0, prev = 0;
    for (const [a, b, p] of c.marks) { if (t >= b) { n = p; prev = p; continue; } if (t > a) n = Math.round(lerp(prev, p, (t - a) / (b - a))); break; }
    return t >= c.end ? c.n : n;
  };
  const SY = 1246, SV = { ox: M, oy: SY + 54, cw: 24 };
  function strip(g, t) {
    // a dim separator with the inverse LOG tag; it lives outside the camera, like a status line
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, SY - 6, W, 170); g.globalCompositeOperation = 'lighter';
    text(g, '-'.repeat(40), 0, 0, { ox: M, oy: SY, cw: 24 }, .26);
    inverse(g, ' LOG ', 1, 0, { ox: M, oy: SY, cw: 24 }, .75);
    const c = caps.filter(o => t >= o.start && t < o.t1).pop();
    if (c) {
      const n = capChars(c, t);
      let k = n, end = null;
      c.lines.forEach((L, i) => {
        const cnt = chars(L).length, s = Math.max(0, Math.min(cnt, k));
        const pre = i ? '  ' : '> ';
        text(g, pre, 0, i, SV, .7);
        const col = text(g, L, 2, i, SV, 1.05, 0, s);
        if (s > 0 || i === 0) end = [col, i];
        k -= cnt;
      });
      if (n < c.n && end) cursor(g, end[0], end[1], SV, .9);
      return;
    }
    text(g, '>', 0, 0, SV, .7);
    cursor(g, 2, 0, SV, blink(t, 0) * .75);
  }
  // header: status line (not key text)
  const topic = up(spec.topic || '');
  const HV = { ox: M, oy: 214, cw: 16 };
  function header(g, t) {
    if (t < .5) return;
    const a = .5 * ss(seg(t, .5, .8));
    text(g, 'VIZA', 0, 0, HV, a, 0, typedN(t, .5, .03, 4));
    const tc = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    const right = (topic ? topic + '  ' : '') + tc;
    text(g, right, 60 - colsOf(right), 0, HV, a);
    text(g, '='.repeat(60), 0, 1, { ...HV, oy: HV.oy + 4 }, .14);
  }

  // footer: dim system state in the zone the apps cover (nothing here has to be read)
  const FV = { ox: M, oy: 1452, cw: 16 };
  function footer(g, t, i) {
    if (t < .8) return;
    const k = Math.round(seg(t, 0, DUR) * 30);
    const s = `SCN ${String(i + 1).padStart(2, '0')}/${String(scenes.length).padStart(2, '0')}  [${'#'.repeat(k)}${'.'.repeat(30 - k)}]  ${String(Math.round(t * 24)).padStart(4, '0')}`;
    text(g, s, 0, 0, FV, .28);
  }

  // ---------------- frame ----------------
  const sceneAt = t => { let i = 0; for (let k = 0; k < scenes.length; k++) if (t >= scenes[k].S.start) i = k; return i; };
  function draw(g, t) {
    const i = sceneAt(t), sc = scenes[i];
    // a hard redraw on every cut: the old screen fades out on the phosphor's afterglow while the new one starts
    if (i > 0 && t < sc.S.start + .6) scenes[i - 1].draw(g, t, decay(t, sc.S.start, .09));
    sc.draw(g, t, 1);
    if (i === 0 && t < (sc.S.beats?.[0] ?? .2) + .05) cursor(g, 0, 0, T24, blink(t, .3, .35));
    header(g, t);
    strip(g, t);
    footer(g, t, i);
    // CRT: power on (dot → line → frame), a jolt on each error stamp
    const P = { power: seg(t, .04, .5) };
    if (t < .04) P.expo = 0;
    let jolt = 0; for (const s of tStamps) if (t >= s) jolt = Math.max(jolt, Math.exp(-(t - s) / .12) * Math.sin((t - s) * 70));
    P.zoom = 1 + .012 * jolt;
    return P;
  }
  EV.sort((a, b) => a.t - b.t);
  const SUBS = (spec.captions || []).map(c => ({ t0: c.start, t1: c.end, text: c.text }));
  const allText = [spec.topic, ...spec.scenes.flatMap(S => JSON.stringify(S.props)), ...(spec.captions || []).map(c => c.text)].join('');
  return {
    DUR, EV, SUBS, draw, logo: () => LOGO, allText: allText + allText.toUpperCase(),
    texts(g, t) { REC = []; draw(g, t); const r = REC; REC = null; return r; },
  };
}
