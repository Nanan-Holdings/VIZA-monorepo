// Glyph-density pictures: paint greyscale into an offscreen "negative" aligned exactly to the grid, average per cell, pick a glyph by ink.
// Subjects are silhouettes with a few planes of light (STYLE.md §2): an airliner in profile, a passport data page.
import { cellsFromImage, pick, glyph } from './term.js';

export class Pic {
  // a picture band: top-left (x0,y0) in screen px, cols x rows cells of width cw (height 2cw); sx x sy samples per cell
  constructor(x0, y0, cols, rows, cw, sx = 3, sy = 6) {
    Object.assign(this, { x0, y0, cols, rows, cw, sx, sy });
    this.cv = document.createElement('canvas'); this.cv.width = cols * sx; this.cv.height = rows * sy;
    this.g = this.cv.getContext('2d', { willReadFrequently: true });
  }
  // paint(g) draws in screen-px units relative to (x0,y0); R channel = brightness
  build(paint) {
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#000'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(this.sx / this.cw, 0, 0, this.sy / (this.cw * 2), 0, 0);
    paint(g);
    const d = g.getImageData(0, 0, this.cv.width, this.cv.height).data;
    return cellsFromImage(d, this.cv.width, this.cols, this.rows, this.sx, this.sy);
  }
  // draw cells: local contrast keeps outlines; cells below the threshold stay blank (negative space)
  draw(sg, c, ramp, amp = 1, flt = null, gam = 1.2) {
    const { cols, rows, cw, x0, y0 } = this;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (flt && !flt(i, j)) continue;
      const k = j * cols + i, A = c.A[k];
      if (A < .05) continue;
      let nb = 0, nn = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue; nb += c.A[jj * cols + ii]; nn++; }
      const m = Math.min(1, Math.max(0, A + .9 * (A - nb / nn)));
      if (m < .06) continue;
      const lv = pick(ramp, Math.pow(m, gam), i, j, .6);
      if (lv.ch !== ' ') glyph(sg, lv.ch, x0 + i * cw, y0 + j * cw * 2, cw, lv.a * amp);
    }
  }
}
const R = v => `rgb(${Math.round(Math.max(0, Math.min(1, v)) * 255)},0,0)`;

// Airliner in profile, nose to the right, centre (cx,cy), length L. Lit from above.
export function paintPlane(g, cx, cy, L, bank = 0) {
  g.save(); g.translate(cx, cy); g.rotate(bank);
  const h = L * .105;
  // far wing (behind the fuselage, darker)
  g.fillStyle = R(.3); g.beginPath(); g.moveTo(-L * .02, -h * .1); g.lineTo(-L * .2, -h * 1.5); g.lineTo(-L * .27, -h * 1.5); g.lineTo(-L * .16, -h * .1); g.fill();
  // far stabiliser
  g.fillStyle = R(.28); g.beginPath(); g.moveTo(-L * .4, -h * .05); g.lineTo(-L * .49, -h * .7); g.lineTo(-L * .52, -h * .7); g.lineTo(-L * .47, -h * .05); g.fill();
  // fuselage, gradient top-lit
  const fg = g.createLinearGradient(0, -h / 2, 0, h / 2); fg.addColorStop(0, R(1)); fg.addColorStop(.45, R(.82)); fg.addColorStop(1, R(.38));
  g.fillStyle = fg; g.beginPath();
  g.moveTo(-L * .5, -h * .38);
  g.lineTo(L * .36, -h * .5);
  g.bezierCurveTo(L * .45, -h * .5, L * .5, -h * .18, L * .5, h * .02);   // nose
  g.bezierCurveTo(L * .5, h * .3, L * .45, h * .5, L * .38, h * .5);
  g.lineTo(-L * .3, h * .5);
  g.lineTo(-L * .5, -h * .05);
  g.closePath(); g.fill();
  // tail fin
  const tg = g.createLinearGradient(0, -h * 2.4, 0, -h * .4); tg.addColorStop(0, R(.95)); tg.addColorStop(1, R(.7));
  g.fillStyle = tg; g.beginPath(); g.moveTo(-L * .33, -h * .45); g.lineTo(-L * .45, -h * 2.3); g.lineTo(-L * .5, -h * 2.3); g.lineTo(-L * .5, -h * .38); g.fill();
  // cockpit windows and the cabin window line (dark against the lit skin)
  g.fillStyle = R(.12); g.beginPath(); g.moveTo(L * .4, -h * .3); g.lineTo(L * .46, -h * .3); g.lineTo(L * .475, -h * .12); g.lineTo(L * .41, -h * .12); g.fill();
  for (let x = -L * .3; x < L * .34; x += L * .028) g.fillRect(x, -h * .2, L * .012, h * .14);
  // near wing (in front, lit edge)
  const wg = g.createLinearGradient(0, 0, 0, h * 2.4); wg.addColorStop(0, R(.85)); wg.addColorStop(1, R(.55));
  g.fillStyle = wg; g.beginPath(); g.moveTo(L * .06, h * .25); g.lineTo(-L * .2, h * 2.3); g.lineTo(-L * .26, h * 2.3); g.lineTo(-L * .14, h * .3); g.fill();
  // engine under the near wing
  g.fillStyle = R(.55); g.beginPath(); g.ellipse(L * .02, h * .95, L * .075, h * .3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = R(.95); g.fillRect(L * .07, h * .7, L * .02, h * .5);
  g.fillStyle = R(.1); g.beginPath(); g.ellipse(L * .085, h * .95, L * .008, h * .2, 0, 0, Math.PI * 2); g.fill();
  // near stabiliser
  g.fillStyle = R(.7); g.beginPath(); g.moveTo(-L * .36, h * .05); g.lineTo(-L * .47, h * .8); g.lineTo(-L * .5, h * .8); g.lineTo(-L * .45, h * .05); g.fill();
  g.restore();
}
// clouds: soft dim streaks drifting left (sparse dim glyphs)
export function paintClouds(g, w, h, t, seed = 1) {
  const hs = n => { const v = Math.sin(n * 127.1 + seed * 31.7) * 43758.5453; return v - Math.floor(v); };
  for (let k = 0; k < 7; k++) {
    const sp = 40 + hs(k) * 60, y = h * (.15 + .75 * hs(k + 9)), cw = 160 + hs(k + 3) * 260;
    let x = (hs(k + 5) * (w + 600) - t * sp) % (w + 600); if (x < 0) x += w + 600; x -= 300;
    const gr = g.createRadialGradient(x, y, 0, x, y, cw * .5);
    const v = .16 + .12 * hs(k + 7);
    gr.addColorStop(0, R(v)); gr.addColorStop(1, R(0));
    g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, .22); g.translate(-x, -y); g.beginPath(); g.arc(x, y, cw * .5, 0, Math.PI * 2); g.fill(); g.restore();
  }
}
// passport data page: page with guilloche, photo box with a head-and-shoulders silhouette, field bars. MRZ lines are typed as real characters on top.
export function paintPassport(g, x, y, w, h) {
  g.save();
  g.fillStyle = R(.2); g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
  g.strokeStyle = R(.8); g.lineWidth = 5; g.beginPath(); g.roundRect(x, y, w, h, 18); g.stroke();
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip();
  g.strokeStyle = R(.34); g.lineWidth = 2;
  for (let k = 0; k < 9; k++) { g.beginPath(); for (let u = 0; u <= w; u += 6) { const yy = y + h * .12 + k * h * .055 + Math.sin(u / w * 12 + k * .8) * h * .03; u ? g.lineTo(x + u, yy) : g.moveTo(x + u, yy); } g.stroke(); }
  g.restore();
  // photo box + silhouette
  const px = x + w * .05, py = y + h * .14, pw = w * .27, ph = h * .58;
  g.fillStyle = R(.06); g.fillRect(px, py, pw, ph);
  g.strokeStyle = R(.6); g.lineWidth = 3; g.strokeRect(px, py, pw, ph);
  const hg = g.createRadialGradient(px + pw * .42, py + ph * .32, 2, px + pw * .5, py + ph * .38, pw * .3); hg.addColorStop(0, R(.95)); hg.addColorStop(1, R(.55));
  g.fillStyle = hg; g.beginPath(); g.ellipse(px + pw * .5, py + ph * .38, pw * .2, ph * .17, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = R(.6); g.beginPath(); g.moveTo(px + pw * .1, py + ph); g.quadraticCurveTo(px + pw * .12, py + ph * .64, px + pw * .5, py + ph * .62); g.quadraticCurveTo(px + pw * .88, py + ph * .64, px + pw * .9, py + ph); g.fill();
  // fields
  g.fillStyle = R(.62);
  const fx = x + w * .38;
  [[.16, .3], [.27, .42], [.38, .24], [.49, .36], [.6, .2]].forEach(([fy, fw]) => { g.fillRect(fx, y + h * fy, w * .12, h * .025); g.fillRect(fx, y + h * (fy + .045), w * fw, h * .04); });
  // MRZ band (left dark: the characters are typed over it)
  g.fillStyle = R(.04); g.fillRect(x + 8, y + h * .76, w - 16, h * .22);
  g.restore();
}
