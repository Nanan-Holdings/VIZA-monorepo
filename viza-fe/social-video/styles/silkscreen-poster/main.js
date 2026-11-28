// Page contract (Lemo-Opuscar render tools): window.DUR, window.render(t), window.READY, window.EV, window.TEXTS.
// ?spec=<name> reads content/<name>.json (build.sh copies the VideoSpec there); default content/spec.json. &nocap=1 leaves the captions out.
import { setup, render, texts } from './film.js';
const Q = new URLSearchParams(location.search);
const name = Q.get('spec') || 'spec';
const spec = await (await fetch(`content/${encodeURIComponent(name)}.json`)).json();
const sample = [...new Set(JSON.stringify(spec))].join('');
await Promise.all(['900 40px BigShoulders', '800 40px BigShoulders', '700 40px BigShoulders', '500 40px Outfit', '600 40px Outfit', '700 40px Outfit',
  '500 40px NotoSC', '600 40px NotoSC', '700 40px NotoSC', '800 40px NotoSC', '900 40px NotoSC'].map(f => document.fonts.load(f, f.includes('NotoSC') ? sample : 'A')));
const img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => { console.warn('missing ' + src); res(null); }; i.src = src; });
const logos = { logoDark: await img('content/brand/viza-logotype-dark.svg'), logoLight: await img('content/brand/viza-logotype-light.svg'), mark: await img('content/brand/viza-mark.svg'), markDark: await img('content/brand/viza-mark-dark.svg') };
const TL = setup(document.getElementById('c'), spec, { logos, nocap: Q.get('nocap') === '1' });
window.DUR = TL.dur;
window.EV = TL.ev;
window.render = render;
window.TEXTS = texts;
window.READY = true;
