// scenery.js · generic, landmark-free destination prints for the VIZA vertical poster (1080×1920 screen units, art bleeds past every edge).
// A scenery = { kind, sun:[x,y], r, parts:[{ pull, ink, path, knock?, cut?, lit?, paper? }] } in print order.
// `ink` is a palette key (sky1 sky2 far mid near sun glow); `paper: true` leaves the shape as bare stock (snow, sand, foam).
// Every polygon is wound the same way as rect()/arc(), so unions fill solid under the nonzero rule.
import { mulberry, circlePath, ringPath, rectPath, unionPath, bandSteps, ridgeLine, lerp } from '/styles/silkscreen-poster/demo/engine/silk.js';

export const BX0 = -240, BX1 = 1320, BY0 = -240, BY1 = 2160, BW = BX1 - BX0, BH = BY1 - BY0;

// ---------------- helpers ----------------
function area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; }
export function poly(pts) { if (area(pts) < 0) pts = pts.slice().reverse(); const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; }
function addPoly(p, pts) { p.addPath(poly(pts)); }
function blob(p, x, y, rx, ry, a0 = 0, a1 = Math.PI * 2) { p.moveTo(x + rx * Math.cos(a0), y + ry * Math.sin(a0)); p.ellipse(x, y, rx, ry, 0, a0, a1); p.closePath(); }
const ground = (pts) => poly([...pts, [BX1, BY1], [BX0, BY1]]);

function sky(sun, r) {
  const knock = unionPath([circlePath(sun[0], sun[1], r + 9), ringPath(sun[0], sun[1], r + 30, r + 40), ringPath(sun[0], sun[1], r + 62, r + 69)]);
  const s2 = new Path2D(); s2.rect(BX0, BY0, BW, 250 - BY0); s2.addPath(bandSteps(BX0, BW, 240, 760, 6, 12));
  return [
    { pull: 'sun', ink: 'sun', path: circlePath(sun[0], sun[1], r) },
    { pull: 'sky1', ink: 'sky1', path: rectPath(BX0, BY0, BW, BH), knock },
    { pull: 'sky2', ink: 'sky2', path: s2, cut: circlePath(sun[0], sun[1], r + 74) },
  ];
}
// glint bars on water: rows that never overlap (safe for knock / cut)
function glints(x0, x1, y0, y1, n, seed, len = 180) {
  const p = new Path2D(), r = mulberry(seed);
  let y = y0;
  for (let i = 0; i < n && y < y1; i++) {
    const k = i / n, th = 2.5 + 14 * Math.pow(k, 1.4);
    let x = x0 + r() * 90;
    while (x < x1) { const L = len * (.4 + r()), g = 40 + r() * 110 * (.4 + k); p.rect(x, y, L, th); x += L + g; }
    y += th + 6 + (y1 - y0) / n * Math.pow(k + .2, 1.3) * .9;
  }
  return p;
}
// the sun's broken reflection on water, in the accent ink
function sunTrail(x, y0, y1, w, seed) {
  const p = new Path2D(), r = mulberry(seed);
  for (let y = y0, i = 0; y < y1; i++) { const th = 4 + i * 1.6, ww = w * (.35 + .65 * r()) * (1 - i * .04); p.rect(x - ww / 2 + (r() - .5) * 20, y, ww, th); y += th + 8 + i * 2; }
  return p;
}
function palm(p, x, base, h, lean, seed, s = 1) {
  const r = mulberry(seed), K = 14, L = [], R = [];
  for (let i = 0; i <= K; i++) { const t = i / K, cx = x + lean * t * t, cy = base - h * t, w = lerp(15, 7, t) * s; L.push([cx - w, cy]); R.push([cx + w, cy]); }
  addPoly(p, [...L, ...R.reverse()]);
  const tx = x + lean, ty = base - h;
  for (let k = 0; k < 8; k++) {
    const a = Math.PI + k * (Math.PI / 7) + (r() - .5) * .25, len = (110 + r() * 70) * s, side = Math.cos(a) >= 0 ? 1 : -1, up = [], dn = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, d = len * t, px = tx + Math.cos(a) * d, py = ty + Math.sin(a) * d * .55 + len * .55 * t * t, w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * len * .1 + 2;
      up.push([px, py - w]); dn.push([px + side * w * .2, py + w * .6]);
    }
    addPoly(p, [...up, ...dn.reverse()]);
  }
  blob(p, tx, ty + 4, 16 * s, 12 * s);
}
function pine(p, x, base, h, w) {
  p.rect(x - w * .05, base - h * .2, w * .1, h * .2 + 600);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), yb = base - h * (.15 + .7 * t), ww = w * (1 - t * .75) / 2, ht = h * (.3 - .06 * t);
    addPoly(p, [[x, yb - ht], [x + ww * .5, yb - ht * .45], [x + ww, yb], [x + ww * .45, yb - ht * .1], [x, yb - ht * .04], [x - ww * .45, yb - ht * .1], [x - ww, yb], [x - ww * .5, yb - ht * .45]]);
  }
}
// a pad pine (flat cloud-like layers on a crooked trunk)
function padPine(p, x, base, h, w, seed) {
  const r = mulberry(seed), K = 10, L = [], R = [];
  for (let i = 0; i <= K; i++) { const t = i / K, cx = x + Math.sin(t * 3 + seed) * w * .12, cy = base - h * t, ww = lerp(14, 6, t); L.push([cx - ww, cy]); R.push([cx + ww, cy]); }
  addPoly(p, [...L, ...R.reverse()]);
  for (let i = 0; i < 4; i++) {
    const t = .45 + i * .17, cx = x + Math.sin(t * 3 + seed) * w * .12 + (r() - .5) * w * .5, cy = base - h * t;
    const pw = w * (.42 - .07 * i) * (.8 + .4 * r());
    blob(p, cx, cy, pw, h * .08, Math.PI, Math.PI * 2); blob(p, cx - pw * .35, cy - h * .03, pw * .6, h * .07, Math.PI, Math.PI * 2);
    p.rect(cx - pw * .9, cy - 1, pw * 1.8, h * .03);
  }
}
const towerSet = (seed, x0, x1, base, hMin, hMax) => {
  const r = mulberry(seed), towers = [];
  for (let x = x0; x < x1;) { const w = 40 + r() * 70, h = hMin + Math.pow(r(), 1.6) * (hMax - hMin); towers.push([x, w, h, r()]); x += w + (r() < .3 ? 6 + r() * 20 : -8); }
  return towers;
};

// ================= harbour city: generic towers over a bay, palms on the quay =================
function harbour(seed) {
  const SUN = [800, 950], R = 104, r = mulberry(seed);
  const far = new Path2D(), lit = new Path2D(), win = new Path2D();
  for (const [x, w, h, k] of towerSet(seed + 1, BX0, BX1, 1030, 70, 340)) {
    far.rect(x, 1030 - h, w, h + 40);
    if (k > .55) far.rect(x + w * .3, 1030 - h - 26 - k * 30, w * .4, 30 + k * 30);           // setback crown
    if (k > .85) far.rect(x + w * .47, 1030 - h - 110, 4, 90);                               // mast
    lit.rect(x + w * .66, 1030 - h, w * .34, h);                                              // sun-side face
    if (k < .5) for (let y = 1030 - h + 18; y < 1010; y += 22) win.rect(x + 8, y, w * .5, 4);  // floor lines
  }
  const sea = rectPath(BX0, 1050, BW, BY1 - 1050);
  const glint = glints(BX0, BX1, 1062, 1240, 9, seed + 3);
  const mid = new Path2D();                                                                   // low hills of the far shore, left
  addPoly(mid, [[BX0, 1058], [BX0, 1000], [60, 990], [180, 1008], [300, 1030], [380, 1058]]);
  const quay = ground([[BX0, 1196], [240, 1204], [520, 1214], [760, 1206], [BX1, 1196]]);
  const near = new Path2D(); near.addPath(quay);
  palm(near, 70, 1210, 520, -60, seed + 5, 1.15); palm(near, 190, 1214, 380, 40, seed + 6, .95); palm(near, 1010, 1206, 470, 50, seed + 7, 1.05);
  return {
    kind: 'harbour', sun: SUN, r: R,
    parts: [
      ...sky(SUN, R),
      { pull: 'far', ink: 'far', path: far },
      { pull: 'far', ink: 'mid', path: win, lit: 1 },
      { pull: 'mid', ink: 'mid', path: unionPath([sea, mid]), cut: glint },
      { pull: 'acc', ink: 'sun', path: sunTrail(SUN[0], 1066, 1190, 220, seed + 9) },
      { pull: 'near', ink: 'near', path: near },
      { pull: 'lit', ink: 'glow', path: lit, lit: 1 },
    ],
  };
}

// ================= alpine lake: snow peaks (bare paper), a lake, pines =================
function alpine(seed) {
  const SUN = [820, 900], R = 92;
  const peaks = ridgeLine([BX0, 930], [BX1, 900], 380, 7, seed + 2).map(([x, y]) => [x, Math.min(y, 1010)]);
  const far = ground(peaks);
  const snowLine = ridgeLine([BX0, 860], [BX1, 840], 90, 6, seed + 3);
  const snowCut = poly([[BX0, BY0], [BX1, BY0], ...snowLine.slice().reverse()]);              // everything above the snow line
  const lake = rectPath(BX0, 1040, BW, BY1 - 1040);
  const glint = glints(BX0, BX1, 1060, 1200, 8, seed + 5, 150);
  const midL = ground([[BX0, 960], [40, 978], [180, 1010], [320, 1052], [420, 1080], [BX0 + 1, 1090]]);
  const midR = ground([[700, 1080], [820, 1040], [940, 1000], [1080, 986], [BX1, 976]]);
  const near = ground([[BX0, 1190], [300, 1204], [640, 1214], [BX1, 1196]]);
  pine(near, 40, 1200, 380, 170); pine(near, 150, 1206, 280, 130); pine(near, 260, 1210, 200, 95);
  pine(near, 900, 1206, 300, 140); pine(near, 1030, 1200, 420, 180);
  const midTrees = new Path2D(); for (let x = 850; x < BX1; x += 46) pine(midTrees, x, 1050 - (x - 850) * .22, 70 + (x % 3) * 18, 40);
  const litF = new Path2D(); { const pts = peaks.filter((_, i) => i % 2 === 0); for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < pts[i - 1][1] && pts[i][1] < pts[i + 1][1]) addPoly(litF, [pts[i], [pts[i][0] + 70, pts[i][1] + 150], [pts[i][0] + 10, pts[i][1] + 170]]); }
  return {
    kind: 'alpine', sun: SUN, r: R,
    parts: [
      ...sky(SUN, R),
      { pull: 'far', ink: 'far', path: far, cut: snowCut },
      { pull: 'far', ink: 'far', path: far, paper: snowCut },                                    // snow: the peaks above the line stay bare paper
      { pull: 'mid', ink: 'sky2', path: lake, cut: glint, lit: 1 },
      { pull: 'mid', ink: 'mid', path: unionPath([midL, midR, midTrees]) },
      { pull: 'acc', ink: 'sun', path: sunTrail(SUN[0], 1060, 1160, 170, seed + 9) },
      { pull: 'near', ink: 'near', path: near },
      { pull: 'lit', ink: 'glow', path: litF, lit: 1 },
    ],
  };
}

// ================= layered hills: soft ridges, a river of paper, pad pines, birds =================
function hills(seed) {
  const SUN = [660, 900], R = 132;
  const r1 = ridgeLine([BX0, 930], [BX1, 960], 120, 6, seed + 1).map(([x, y]) => [x, y]);
  const far = ground(r1);
  const mid = ground([[BX0, 1010], [120, 990], [300, 1020], [520, 1000], [700, 1040], [900, 1016], [BX1, 1030]]);
  const river = poly([[460, 1060], [640, 1060], [1020, BY1], [-80, BY1]]);
  const bank = ground([[BX0, 1080], [200, 1086], [460, 1090], [700, 1096], [BX1, 1084]]);
  const near = ground([[BX0, 1196], [300, 1206], [620, 1214], [BX1, 1200]]);
  padPine(near, 120, 1210, 520, 380, seed + 4); padPine(near, 960, 1204, 440, 340, seed + 5);
  const birds = new Path2D(); for (const [x, y, s] of [[300, 520, 1], [352, 494, .8], [262, 470, .65], [880, 600, .7]]) addPoly(birds, [[x - 24 * s, y - 6 * s], [x - 11 * s, y - 10 * s], [x, y], [x + 11 * s, y - 10 * s], [x + 24 * s, y - 6 * s], [x + 11 * s, y - 5 * s], [x, y + 5 * s], [x - 11 * s, y - 5 * s]]);
  const litF = new Path2D(); for (let i = 2; i < r1.length - 2; i++) if (r1[i][1] < r1[i - 2][1] && r1[i][1] < r1[i + 2][1] && r1[i][1] < 940) addPoly(litF, [r1[i], [r1[i][0] + 90, r1[i][1] + 46], [r1[i][0] + 20, r1[i][1] + 60]]);
  return {
    kind: 'hills', sun: SUN, r: R,
    parts: [
      ...sky(SUN, R),
      { pull: 'far', ink: 'far', path: far, cut: river },
      { pull: 'mid', ink: 'mid', path: unionPath([mid, bank]), cut: river },
      { pull: 'near', ink: 'near', path: unionPath([near, birds]), cut: poly([[560, 1206], [640, 1206], [760, BY1], [400, BY1]]) },
      { pull: 'acc', ink: 'sun', path: sunTrail(560, 1100, 1190, 120, seed + 9) },
    ],
  };
}

// ================= islands: limestone stacks in a bay, palms, a long boat =================
function islands(seed) {
  const SUN = [770, 960], R = 100, r = mulberry(seed);
  const far = new Path2D();
  for (const [x, w, h] of [[-120, 260, 240], [90, 170, 380], [230, 140, 220], [620, 120, 160], [960, 220, 330], [1140, 180, 200]]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = Math.PI * t; pts.push([x + w / 2 - Math.cos(a) * w / 2, 1040 - Math.pow(Math.sin(a), .55) * h + (r() - .5) * 8]); }
    addPoly(far, [...pts.reverse(), [x, 1050], [x + w, 1050]].reverse());
  }
  const sea = rectPath(BX0, 1040, BW, BY1 - 1040);
  const glint = glints(BX0, BX1, 1056, 1196, 8, seed + 3, 160);
  const sand = ground([[BX0, 1180], [300, 1176], [700, 1190], [BX1, 1172]]);
  const near = ground([[BX0, 1228], [400, 1222], [800, 1232], [BX1, 1220]]);
  palm(near, 960, 1214, 560, -90, seed + 5, 1.2); palm(near, 80, 1224, 430, 70, seed + 6, 1);
  const boat = poly([[520, 1146], [760, 1146], [800, 1126], [790, 1124], [748, 1160], [540, 1160], [500, 1124], [488, 1126]]);
  const boatTop = rectPath(600, 1118, 90, 28);
  const lit = new Path2D(); for (const [x, w, h] of [[90, 170, 380], [960, 220, 330]]) addPoly(lit, [[x + w * .55, 1040 - h * .96], [x + w * .9, 1040 - h * .5], [x + w * .98, 1040], [x + w * .7, 1040]]);
  return {
    kind: 'islands', sun: SUN, r: R,
    parts: [
      ...sky(SUN, R),
      { pull: 'far', ink: 'far', path: far },
      { pull: 'mid', ink: 'mid', path: sea, cut: glint },
      { pull: 'acc', ink: 'sun', path: sunTrail(SUN[0], 1058, 1150, 200, seed + 9) },
      { pull: 'near', ink: 'glow', path: sand, lit: 1 },
      { pull: 'near', ink: 'near', path: unionPath([near, boat, boatTop]) },
      { pull: 'lit', ink: 'glow', path: lit, lit: 1 },
    ],
  };
}

export const SCENERY = { harbour, alpine, hills, islands };

// palettes per scenery: two daylight inkings (picked per video) plus dusk and night for the re-ink
// keys: sky1 sky2 far mid near sun(accent) glow(lit face). Values step from far (light) to near (dark).
export const PALETTES = {
  harbour: {
    day: { sky1: '#E8F0F2', sky2: '#86B7CA', far: '#D9C7A3', mid: '#2F6E8E', near: '#173247', sun: '#E8553D', glow: '#F4DDB0' },
    alt: { sky1: '#F6E3C0', sky2: '#9CC5C9', far: '#C9B6CF', mid: '#3D7A86', near: '#18323A', sun: '#E4602F', glow: '#F7EBC8' },
    dusk: { sky1: '#F4B271', sky2: '#C2607A', far: '#8E6E9C', mid: '#354C7E', near: '#161B30', sun: '#F6D36A', glow: '#E58A5A' },
    night: { sky1: '#2B3A66', sky2: '#1B244B', far: '#45568A', mid: '#23406A', near: '#0F1528', sun: '#F2CF6E', glow: '#3C5C93' },
  },
  alpine: {
    day: { sky1: '#EEF1F4', sky2: '#B8C9D9', far: '#8B9BB0', mid: '#4A5D78', near: '#1F2A3C', sun: '#F2B134', glow: '#C9D6E2' },
    alt: { sky1: '#F3E9D2', sky2: '#A9C6D8', far: '#9FB0C4', mid: '#4E7A6A', near: '#1C2E2A', sun: '#E35B3B', glow: '#E7D9A8' },
    dusk: { sky1: '#F2B37A', sky2: '#B86B7E', far: '#7D6A95', mid: '#3B4A72', near: '#171C2E', sun: '#F7D46B', glow: '#E8956A' },
    night: { sky1: '#283764', sky2: '#1A2349', far: '#3E4C7E', mid: '#22305C', near: '#0E1426', sun: '#F3C85A', glow: '#4A6096' },
  },
  hills: {
    day: { sky1: '#F6CD98', sky2: '#EE9A73', far: '#9A7FA8', mid: '#3E7079', near: '#1E3B3F', sun: '#D8432B', glow: '#FBE6B4' },
    alt: { sky1: '#F3E6CF', sky2: '#A8C3C9', far: '#B3A2C4', mid: '#4F6F8F', near: '#1F2B3D', sun: '#E0533A', glow: '#EFD6A0' },
    dusk: { sky1: '#F2A766', sky2: '#A25A84', far: '#6E5C8E', mid: '#26386E', near: '#151A2C', sun: '#F2C14E', glow: '#E07A4F' },
    night: { sky1: '#2A3762', sky2: '#18204A', far: '#3A4778', mid: '#1F2D5C', near: '#0F1426', sun: '#F2BE4E', glow: '#3D5A97' },
  },
  islands: {
    day: { sky1: '#F8E9B8', sky2: '#7CC6CF', far: '#8FB9A8', mid: '#2E7D86', near: '#163A3E', sun: '#EF6A3A', glow: '#FBE7B0' },
    alt: { sky1: '#FBE3C4', sky2: '#F0A57C', far: '#9DB7C9', mid: '#2D6F8C', near: '#182E3E', sun: '#E64B3C', glow: '#F9D98A' },
    dusk: { sky1: '#F6A86A', sky2: '#C25C6E', far: '#7E6496', mid: '#2F4A78', near: '#141A2C', sun: '#F8D266', glow: '#F09A5E' },
    night: { sky1: '#263A66', sky2: '#17224A', far: '#3B5683', mid: '#1E3E66', near: '#0D1628', sun: '#F4CF70', glow: '#3E6295' },
  },
};

// choose the place from the spec's topic (destination first; Singapore is also where every viewer lives, so it only wins on its own)
export function pickScenery(spec) {
  const s = `${spec.topic || ''} ${spec.slug || ''}`.toLowerCase();
  if (/\b(eu|etias|schengen|europe|uk|eta|france|germany|italy|spain|swiss|switzerland|austria|norway|iceland)\b|欧洲|申根|英国/.test(s)) return 'alpine';
  if (/japan|korea|china|taiwan|hong ?kong|日本|韩国|中国|台湾/.test(s)) return 'hills';
  if (/thai|bali|indonesia|malaysia|vietnam|philippines|cambodia|maldives|sri ?lanka|泰国|马来西亚|印尼|越南|菲律宾/.test(s)) return 'islands';
  if (/\bsg\b|singapore|新加坡/.test(s)) return 'harbour';
  return ['harbour', 'hills', 'islands', 'alpine'][Math.abs([...s].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % 4];
}
