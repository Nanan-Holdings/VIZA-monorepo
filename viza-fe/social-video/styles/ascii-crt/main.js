// VIZA ascii-crt template page. Contract: window.DUR, window.render(t), window.READY, window.EV, window.TEXTS(t), window.SUBS.
// ?spec=content/<name>.json picks the VideoSpec (default content/spec.json); ?nosub=1 is not offered: the LOG strip is part of the picture.
import { initTerm } from './term.js';
import { makeCRT } from '/styles/ascii-crt/demo/crt.js';      // the style's own monochrome phosphor post (adapted from core/post/crt.js)
import { buildFilm } from './film.js';

const Q = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const out = document.getElementById('c'); out.width = W; out.height = H;
const scene = document.createElement('canvas'); scene.width = W; scene.height = H;
const g = scene.getContext('2d');
const spec = await (await fetch(Q.get('spec') || 'content/spec.json')).json();
const all = [spec.topic || '', JSON.stringify(spec.scenes), ...(spec.captions || []).map(c => c.text)].join('');
await initTerm(all + all.toUpperCase());
const film = buildFilm(spec, W, H);
let crt = null;
try { crt = makeCRT(out); } catch (e) { console.warn('no WebGL2: events/text export only'); }

// the real VIZA logotype (white, for dark backgrounds) sits above the CRT layer: never passed through the phosphor, so never recoloured
const logo = document.getElementById('logo');
logo.src = 'content/viza-logotype-dark.svg';
try { await logo.decode(); } catch (e) { console.warn('logo missing'); }
function placeLogo(t) {
  const L = film.logo();
  if (!L) { logo.style.opacity = 0; return; }
  const a = t < L.t0 ? 0 : Math.min(1, (t - L.t0) / .25);
  logo.style.width = L.w + 'px'; logo.style.left = L.x + 'px'; logo.style.top = L.y + 'px';
  logo.style.opacity = a.toFixed(3);
}
function begin() { g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; }

window.DUR = film.DUR; window.EV = film.EV; window.SUBS = film.SUBS;
window.render = t => {
  begin();
  const P = film.draw(g, t);
  if (crt) crt.render(scene, Math.round(t * 24), P);
  placeLogo(t);
};
window.TEXTS = t => { begin(); const r = film.texts(g, t); return r; };
window.READY = true;
