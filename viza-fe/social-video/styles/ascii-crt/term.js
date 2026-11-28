// Character-grid engine for the VIZA ascii-crt template. Extends LIB styles/ascii-crt/demo/term.js:
//  · page size comes from the canvas (1080x1920 for shorts), not a fixed 1920x1080
//  · half-width cells (VT323, 1:2) for Latin, digits and punctuation; full-width cells (2 columns, square) for CJK, drawn with Noto Sans SC
//  · the atlas is built from the characters the spec actually uses
// Scene canvas convention (same as the demo, read by crt.js): drawn additively, R = amber phosphor, G = the one second colour.
export const FONT = 'VT323', CJK = 'Noto Sans SC';
const GS = 160;                                   // atlas font size: half-width cell 64x128, baseline 102.4
const GW = GS * .4, GH = GS * .8, BASE = GS * .64;
const PAD = 4, COLS_ATLAS = 16;
const CJ = GH;                                    // full-width atlas cell: 128x128

// full-width: CJK ideographs, kana, hangul, CJK punctuation, full-width forms
export const isWide = ch => { const c = ch.codePointAt(0); return (c >= 0x2E80 && c <= 0x9FFF) || (c >= 0xAC00 && c <= 0xD7AF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFE30 && c <= 0xFE4F) || (c >= 0xFF00 && c <= 0xFF60) || (c >= 0xFFE0 && c <= 0xFFE6); };
export const colsOf = s => { let n = 0; for (const ch of s) n += isWide(ch) ? 2 : 1; return n; };

export let ATLAS = null;
export async function initTerm(extra = '') {
  await document.fonts.load(`${GS}px ${FONT}`);
  await document.fonts.load(`500 ${GS}px "${CJK}"`, '签');
  const half = [], wide = [];
  for (let c = 32; c < 127; c++) half.push(String.fromCharCode(c));
  for (const ch of new Set([...extra])) { if (ch.codePointAt(0) < 32 || half.includes(ch) || wide.includes(ch)) continue; (isWide(ch) ? wide : half).push(ch); }
  const cellW = GW + PAD * 2, cellH = GH + PAD * 2, cjW = CJ + PAD * 2;
  const rowsH = Math.ceil(half.length / COLS_ATLAS), rowsW = Math.ceil(wide.length / COLS_ATLAS);
  const aw = COLS_ATLAS * Math.max(cellW, cjW), ah = rowsH * cellH + rowsW * cjW + 8;
  const white = document.createElement('canvas'); white.width = aw; white.height = ah;
  const g = white.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const pos = {};
  g.font = `${GS}px ${FONT}`; g.lineWidth = 2.2;          // beam spread: slightly fatter, rounder glyphs
  half.forEach((ch, i) => {
    const x = (i % COLS_ATLAS) * cellW + PAD, y = Math.floor(i / COLS_ATLAS) * cellH + PAD;
    pos[ch] = [x, y, GW, GH];
    g.save(); g.beginPath(); g.rect(x, y, GW, GH); g.clip();
    // VT323 lacks a few glyphs (·, €); the browser falls back, so squeeze anything wider than the cell back into it
    const w = g.measureText(ch).width, sx = w > GW ? GW / w : 1;
    g.translate(x + (GW - w * sx) / 2, 0); g.scale(sx, 1);
    g.fillText(ch, 0, y + BASE); g.strokeText(ch, 0, y + BASE);
    g.restore();
  });
  const y0 = rowsH * cellH + 4, FS = 104;
  g.font = `500 ${FS}px "${CJK}"`; g.lineWidth = 1.6;
  wide.forEach((ch, i) => {
    const x = (i % COLS_ATLAS) * cjW + PAD, y = y0 + Math.floor(i / COLS_ATLAS) * cjW + PAD;
    pos[ch] = [x, y, CJ, CJ];
    const w = g.measureText(ch).width;
    g.save(); g.beginPath(); g.rect(x, y, CJ, CJ); g.clip();
    g.fillText(ch, x + (CJ - w) / 2, y + 104); g.strokeText(ch, x + (CJ - w) / 2, y + 104);
    g.restore();
  });
  const cov = {};
  const d = g.getImageData(0, 0, aw, ah).data;
  for (const ch of half) {
    const [x, y] = pos[ch]; let s = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) s += d[((y + j) * aw + x + i) * 4 + 3];
    cov[ch] = s / 255 / (GW * GH);
  }
  const tint = col => { const c = document.createElement('canvas'); c.width = aw; c.height = ah; const x = c.getContext('2d');
    x.drawImage(white, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, aw, ah); return c; };
  ATLAS = { red: tint('#ff0000'), green: tint('#00ff00'), black: tint('#000000'), pos, cov };
  return ATLAS;
}

// one glyph at top-left (x,y) in a cell of width cw (2cw for a wide glyph); a = brightness 0..2; chan 0 = phosphor, 1 = second colour
export function glyph(g, ch, x, y, cw, a = 1, chan = 0) {
  if (ch === ' ' || a <= 0.004) return;
  const p = ATLAS.pos[ch]; if (!p) return;
  const w = isWide(ch) ? cw * 2 : cw;
  const src = chan ? ATLAS.green : ATLAS.red;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(src, p[0], p[1], p[2], p[3], x, y, w, cw * 2);
  if (a > 1) { g.globalAlpha = Math.min(1, a - 1); g.drawImage(src, p[0], p[1], p[2], p[3], x, y, w, cw * 2); }
}
// a line of text from column col, row row; view = {ox, oy, cw}. n = how many characters are shown (typing)
export function text(g, str, col, row, view, a = 1, chan = 0, n = Infinity) {
  const { ox, oy, cw } = view; let c = col, k = 0;
  for (const ch of str) { if (k++ >= n) break; glyph(g, ch, ox + c * cw, oy + row * cw * 2, cw, a, chan); c += isWide(ch) ? 2 : 1; }
  return c;
}
// inverse video: a lit block with the glyphs knocked out (the scene canvas is opaque black, so knocking out = drawing black)
export function inverse(g, str, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  const x = ox + col * cw, y = oy + row * cw * 2, w = colsOf(str);
  g.globalAlpha = Math.min(1, a); g.fillStyle = chan ? '#00ff00' : '#ff0000';
  g.fillRect(x, y + cw * .1, w * cw, cw * 1.8);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  let c = 0;
  for (const ch of str) { const p = ATLAS.pos[ch]; if (p && ch !== ' ') g.drawImage(ATLAS.black, p[0], p[1], p[2], p[3], x + c * cw, y, isWide(ch) ? cw * 2 : cw, cw * 2); c += isWide(ch) ? 2 : 1; }
  g.globalCompositeOperation = 'lighter';
}
export function cursor(g, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  if (a <= .004) return;
  g.globalAlpha = Math.min(1, a); g.fillStyle = chan ? '#00ff00' : '#ff0000';
  g.fillRect(ox + col * cw + cw * .06, oy + row * cw * 2 + cw * .22, cw * .88, cw * 1.56);
}

// density table from a set of characters (measured ink x dim/normal/bold), near-duplicates dropped
export function makeRamp(chars, attrs = [.42, .7, 1]) {
  const set = [...new Set(chars.split(''))].filter(c => c !== ' ' && ATLAS.cov[c] > 0);
  const mx = Math.max(...set.map(c => ATLAS.cov[c]));
  const lv = [{ ch: ' ', a: 0, v: 0 }];
  for (const c of set) for (const a of attrs) lv.push({ ch: c, a, v: ATLAS.cov[c] / mx * a });
  lv.sort((p, q) => p.v - q.v);
  const out = [lv[0]];
  for (const l of lv.slice(1)) { if (l.v - out[out.length - 1].v > .018) out.push(l); else if (l.a > out[out.length - 1].a) out[out.length - 1] = l; }
  return out;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);
export function pick(ramp, L, i, j, dither = .6) {
  const n = ramp.length - 1;
  let h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; h -= Math.floor(h);
  const x = L * n + (BAYER[(j & 3) * 4 + (i & 3)] * .5 + (h - .5) * .5) * dither * 1.6;
  return ramp[Math.max(0, Math.min(n, Math.round(x)))];
}
// negative (cols*sx x rows*sy, R = phosphor, G = second colour, B = flag) → per-cell averages
export function cellsFromImage(data, aw, cols, rows, sx, sy) {
  const A = new Float32Array(cols * rows), E = new Float32Array(cols * rows), N = new Float32Array(cols * rows);
  const n = sx * sy * 255;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let r = 0, gg = 0, bb = 0;
    for (let v = 0; v < sy; v++) { let o = ((j * sy + v) * aw + i * sx) * 4; for (let u = 0; u < sx; u++, o += 4) { r += data[o]; gg += data[o + 1]; bb += data[o + 2]; } }
    A[j * cols + i] = r / n; E[j * cols + i] = gg / n; N[j * cols + i] = bb / n;
  }
  return { A, E, N, cols, rows };
}
