// VIZA "entry machine" for the Color-Coded Mechanism style (precise-mechanism).
// One reusable 3D machine that every VideoSpec drives. The travel process is the mechanism:
//   a hopper of passports (traveller documents, yellow) drops one passport per cycle onto an indexing slat belt
//   (the route, grey-green); the form unit (the step this video explains, the single accent) drops a card onto it;
//   the checkpoint gate and the stamp press (the government's own system, grey-violet) let it through and stamp it.
// The machine is true: one motor turns a back shaft (12:36 gears); one shaft turn = one cycle; the belt indexes one
// pitch (12 units = 8 slats = one roller turn) per cycle through a cycloidal indexer; three cams on the same shaft
// time the card feed, the gate and the stamp. Everything is a function of the master clock theta (cycles).
// Shader, section hatching and outlines are the style demo's (lemo-opuscar styles/precise-mechanism/demo).
import * as THREE from 'three';
import { involute, windows, circle, hull, slab } from '/styles/precise-mechanism/demo/gears.js';
import { makeOutline } from '/styles/precise-mechanism/demo/film-outline.js';

THREE.ColorManagement.enabled = false;
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = u => u * u * (3 - 2 * u);
const eo = u => 1 - Math.pow(1 - u, 3);

export const PAL = {
  paper: '#F3F0EA', neutral: '#DDD8CF', ink: '#25282D', grey: '#7A756D',
  trav: '#E6B94F', route: '#79B09F', gov: '#8A97D4', step: '#E8472A', floor: '#E7E2D9',
};

// ───────── the cycle (one shaft turn) ─────────
export const D = 12;                                  // belt pitch per cycle (world units)
export const ST = [-18, -6, 6, 18, 30];               // stations: hopper, form unit, gate, stamp, bin
export const YB = 4.6;                                // top of the belt
const PP = { l: 6, h: .45, w: 4.2 };                  // passport booklet
const IDX = .34;                                      // index window (share of the cycle)
export const PH = { feed0: .44, feed1: .64, stamp: .64, gateOpen: .9, gateShut: .46 };
export const idx = f => { if (f >= IDX) return 1; const u = f / IDX; return u - Math.sin(TAU * u) / TAU; };   // cycloidal indexer
const bump = (f, a, b) => (f <= a || f >= b) ? 0 : Math.pow(Math.sin(Math.PI * (f - a) / (b - a)), 2);
const L1 = f => 1.0 * bump(f, .40, .70);                                    // card feed cam
const L2 = f => { const o = f > .5 ? ss(seg(f, .86, .96)) : 1 - ss(seg(f, .36, PH.gateShut)); return 1.0 * o; };   // gate cam (open through the index)
const L3 = f => 1.2 * bump(f, .50, .78);                                    // (LIFT3)                                    // stamp cam, peak at 0.64
export function cycleState(theta) {
  const n = Math.floor(theta), f = theta - n;
  return { n, f, B: n + idx(f) };
}

export function buildMachine({ W, H, PR = 2 }) {
  // ───────── renderer ─────────
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(PR); renderer.setSize(W, H);
  renderer.setClearColor(new THREE.Color(PAL.paper), 1);
  renderer.localClippingEnabled = true;
  document.getElementById('stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, W / H, 1, 900);

  // ───────── soft cel + dye front + section hatching (the demo's shader) ─────────
  const LIGHT = new THREE.Vector3(-0.55, 1.0, 0.45).normalize();
  const lightView = { value: new THREE.Vector3() };
  const VS = `
    #include <clipping_planes_pars_vertex>
    varying vec3 vN; varying vec3 vW;
    void main(){
      vN = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <clipping_planes_vertex>
    }`;
  const FS = `
    #include <clipping_planes_pars_fragment>
    uniform vec3 colA, colB, Ld, O; uniform float R, cut;
    uniform vec4 P1, P2; uniform vec3 hatchU;
    varying vec3 vN; varying vec3 vW;
    vec3 cel(vec3 col, float d){
      float lit = smoothstep(0.02, 0.30, d);
      float deep = smoothstep(-0.55, -0.05, d);
      vec3 shade = col * vec3(.80, .80, .86) * mix(.90, 1., deep);
      vec3 c = mix(shade, col, lit);
      return mix(c, min(col * 1.04 + .015, vec3(1.)), smoothstep(.85, .97, d) * .6);
    }
    void main(){
      #include <clipping_planes_fragment>
      float dd = distance(vW, O);
      float k = 1. - smoothstep(R - .05, R + .05, dd);
      float rim = smoothstep(R - .55, R - .04, dd) * k;
      vec3 col = mix(colA, colB, k);
      col = mix(col, min(colB * 1.10 + .10, vec3(1.)), rim * .55);
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) {
        if (cut > .5) {
          vec3 rd = normalize(vW - cameraPosition);
          float best = 1e9; vec3 hp = vW;
          for (int i = 0; i < 2; i++) {
            vec4 P = i == 0 ? P1 : P2; vec4 Q = i == 0 ? P2 : P1;
            float dn = dot(P.xyz, rd); if (abs(dn) < 1e-4) continue;
            float s = -(dot(P.xyz, cameraPosition) + P.w) / dn;
            vec3 p = cameraPosition + rd * s;
            if (s > 0. && dot(Q.xyz, p) + Q.w > -1e-3 && s < best) { best = s; hp = p; }
          }
          float u = length(hp.xz - hatchU.xz) + hp.y;
          float f = abs(fract(u / .42) - .5);
          float line = 1. - smoothstep(.13, .21, f);
          vec3 base = mix(col, vec3(1.), .18);
          gl_FragColor = vec4(mix(base, col * .55, line * .85), 1.);
          return;
        }
        n = -n;
      }
      gl_FragColor = vec4(cel(col, dot(n, Ld)), 1.);
    }`;
  function cutSet() {
    const P1 = new THREE.Plane(), P2 = new THREE.Plane();
    return { planes: [P1, P2], P1, P2, u: { P1: { value: new THREE.Vector4() }, P2: { value: new THREE.Vector4() }, hatchU: { value: new THREE.Vector3() } },
      nm: new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, clippingPlanes: [P1, P2], clipIntersection: true }) };
  }
  const CUT = cutSet();
  function setWedge(cs, axis, centre, open) {
    const { P1, P2, u } = cs;
    if (open < 1e-4) { P1.set(new THREE.Vector3(0, 1, 0), 1e4); P2.set(new THREE.Vector3(0, 1, 0), 1e4); }
    else {
      const a1 = centre - open / 2, a2 = centre + open / 2, c = new THREE.Vector3(axis[0], 0, axis[1]);
      P1.setFromNormalAndCoplanarPoint(new THREE.Vector3(-Math.cos(a1 + Math.PI / 2), 0, -Math.sin(a1 + Math.PI / 2)), c);
      P2.setFromNormalAndCoplanarPoint(new THREE.Vector3(-Math.cos(a2 - Math.PI / 2), 0, -Math.sin(a2 - Math.PI / 2)), c);
    }
    u.P1.value.set(P1.normal.x, P1.normal.y, P1.normal.z, P1.constant);
    u.P2.value.set(P2.normal.x, P2.normal.y, P2.normal.z, P2.constant);
    u.hatchU.value.set(axis[0], 0, axis[1]);
  }
  setWedge(CUT, [ST[1], 0], 0, 0);
  const SYS = ['trav', 'route', 'gov', 'step'];
  const dyeU = {};
  for (const g of [...SYS, 'frame']) dyeU[g] = { colA: { value: new THREE.Color(PAL.neutral) }, colB: { value: new THREE.Color(PAL.neutral) }, O: { value: new THREE.Vector3() }, R: { value: -1 } };
  const matCache = {};
  function material(g, clip) {
    const key = g + (clip ? ':c' : '');
    if (matCache[key]) return matCache[key];
    const u = dyeU[g];
    return matCache[key] = new THREE.ShaderMaterial({
      uniforms: { ...u, Ld: lightView, cut: { value: clip ? 1 : 0 }, ...CUT.u },
      vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide, clipping: !!clip,
      clippingPlanes: clip ? CUT.planes : null, clipIntersection: true,
    });
  }
  const nMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

  // ───────── parts ─────────
  const root = new THREE.Group(); scene.add(root);
  const parts = [];
  function add(geo, sys, pos = [0, 0, 0], parent = root, o = {}) {
    const m = new THREE.Mesh(geo, material(sys, o.clip));
    m.position.set(...pos); m.userData = { sys, nm: o.clip ? CUT.nm : nMat };
    parent.add(m); parts.push(m); return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);    // bottom at y = 0
  const cylY = (r, h, n = 40) => new THREE.CylinderGeometry(r, r, h, n).translate(0, h / 2, 0);
  const cylX = (r, len, n = 40) => new THREE.CylinderGeometry(r, r, len, n).rotateZ(Math.PI / 2);
  const cylZ = (r, len, n = 40) => new THREE.CylinderGeometry(r, r, len, n).rotateX(Math.PI / 2);
  const rrect = (w, d, r) => hull([[-w / 2 + r, -d / 2 + r, r], [w / 2 - r, -d / 2 + r, r], [w / 2 - r, d / 2 - r, r], [-w / 2 + r, d / 2 - r, r]], 24);
  const W2S = pts => pts.map(([x, z]) => [x, -z]);

  // frame: base plate, side rails, bearing posts, motor, indexer housing, bin (one light neutral)
  const basePts = rrect(74, 27, 2.5);
  add(slab(W2S(basePts.map(([x, z]) => [x, z - 6])), [], 1.3, 0), 'frame', [0, -1.3, 0]);
  for (const s of [-1, 1]) add(box(52, 4.2, .6), 'frame', [0, 0, s * 5.0]);
  for (const x of [-27, -12, 0, 12, 25.5]) { add(box(1.4, 8.2, 1.8), 'frame', [x, 0, -7.5]); add(cylX(1.05, 1.6), 'frame', [x, 9, -7.5]); }
  add(cylX(2.6, 4.2), 'frame', [-32.4, 3.0, -16.48]);                     // the motor
  add(box(5.2, 3.0, 4.2), 'frame', [-32.4, 0, -16.48]);
  add(box(4.6, 11.4, 4.4), 'frame', [27.4, 0, -7.4]);                     // the indexer housing (cycloidal cam inside)
  { const bw = .5; add(box(8.6, 4.8, bw), 'frame', [31, 0, 4.6]); add(box(8.6, 4.8, bw), 'frame', [31, 0, -4.6]); add(box(bw, 4.8, 9.7), 'frame', [35.1, 0, 0]); add(box(bw, 3.2, 9.7), 'frame', [26.9, 0, 0]); }

  // ROUTE (transmission, grey-green): gear pair, back shaft, rollers, slat belt
  const gearPlane = new THREE.Group(); gearPlane.rotation.z = -Math.PI / 2; gearPlane.position.set(-30.4, 0, 0); root.add(gearPlane);
  //   local [a, b] (xz of the plane) = world (y = -a, z = b); local +y = world +x
  const P2D = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  const A2 = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  function meshPhase(cA, zA, wA, cB, zB) {
    const lam = A2(cA, cB), p = TAU / zA;
    let d = ((lam - wA) % p + p) % p; if (d > p / 2) d -= p;
    return lam + Math.PI - d * zA / zB + Math.PI / zB;
  }
  const MODG = .45, ZG = 36, ZP = 12;
  const cG = [-9, -7.5], cP = [-3.0, -16.48];
  const gG = involute(ZG, MODG, { steps: 5 }), gP = involute(ZP, MODG, { steps: 5 });
  const wG = 0, wP = meshPhase(cG, ZG, wG, cP, ZP);
  const gearG = add(slab(W2S(gG.pts), windows(5, 1.6, gG.rf - 1.0, .55, .5), .7, 0), 'route', [cG[0], 0, cG[1]], gearPlane); gearG.rotation.y = -wG;
  const gearP = add(slab(W2S(gP.pts), [], .7, 0), 'route', [cP[0], 0, cP[1]], gearPlane); gearP.rotation.y = -wP;
  add(cylX(.55, 58), 'route', [-1.6, 9, -7.5]);                            // the back shaft, x −30.6 … 27.4
  add(cylX(.9, 1.4), 'route', [-29.6, 9, -7.5]);
  const RC = 6 / Math.PI, RY = YB - .175 - RC;                              // slat centre path radius; one roller turn = one pitch
  const rollers = [];
  for (const x of [-24, 24]) {
    const r = add(cylZ(RC - .2, 9.0, 48), 'route', [x, RY, 0]); rollers.push(r);
    for (const s of [-1, 1]) {
      const cap = slab(W2S(circle(RC - .25, 64)), windows(4, .45, RC - .7, .28, .25), .3, 0).rotateX(Math.PI / 2);
      const c = add(cap, 'route', [x, RY, s > 0 ? 4.5 : -4.8]); rollers.push(c);
    }
  }
  add(cylZ(.45, 13.2), 'route', [24, RY, -1.9]);                           // drive roller axle into the indexer
  const NSL = 72, LOOP = 108, slats = [];
  for (let i = 0; i < NSL; i++) slats.push(add(new THREE.BoxGeometry(1.18, .35, 9.0), 'route'));
  function beltPos(s) {
    s = ((s % LOOP) + LOOP) % LOOP;
    const yt = YB - .175;
    if (s < 48) return [-24 + s, yt, 0];
    if (s < 54) { const a = (s - 48) / RC; return [24 + RC * Math.sin(a), RY + RC * Math.cos(a), -a]; }
    if (s < 102) return [24 - (s - 54), RY - RC, -Math.PI];
    const a = (s - 102) / RC; return [-24 - RC * Math.sin(a), RY - RC * Math.cos(a), -Math.PI - a];
  }

  // TRAV (traveller documents, warm yellow): the hopper and the passports
  const HX = ST[0];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(.5, 7.4, .5), 'trav', [HX + sx * 3.45, YB + .2, sz * 2.85]);   // hopper: four posts,
  for (const sz of [-1, 1]) { add(box(7.4, .4, .4), 'trav', [HX, YB + 7.2, sz * 2.85]); add(box(7.4, 1.2, .4), 'trav', [HX, YB + .2, sz * 2.85]); }   // rails and skirts,
  add(box(.4, .4, 6.1), 'trav', [HX - 3.45, YB + 7.2, 0]); add(box(.4, .4, 6.1), 'trav', [HX + 3.45, YB + 7.2, 0]);
  add(box(.4, 6.1, 6.1), 'trav', [HX - 3.45, YB + 1.1, 0]);                                                            // a back plate; the front is open above the exit
  add(box(.4, 5.0, .9), 'trav', [HX + 3.45, YB + 2.4, 2.4]); add(box(.4, 5.0, .9), 'trav', [HX + 3.45, YB + 2.4, -2.4]);
  const NPASS = 14, pass = [];
  const passGeo = slab(W2S(rrect(PP.l, PP.w, .35)), [], PP.h, 0);
  const cardGeo = slab(W2S(rrect(4.4, 3.0, .25)), [], .1, 0);
  const markGeo = slab(W2S(rrect(1.5, 1.5, .2)), [], .06, 0);
  for (let i = 0; i < NPASS; i++) {
    const g = new THREE.Group(); root.add(g);
    const b = add(passGeo, 'trav', [0, 0, 0], g);
    const c = add(cardGeo, 'step', [0, PP.h, 0], g);
    const m = add(markGeo, 'gov', [1.1, PP.h + .1, .5], g);
    pass.push({ g, b, c, m });
  }

  // STEP (the part this video explains, the accent): the form unit, cut set A
  const FX = ST[1];
  const housing = [];
  for (const s of [-1, 1]) housing.push(add(box(6.8, 10.4, .6), 'step', [FX, 0, s * 5.7], root, { clip: 1 }));
  housing.push(add(box(6.8, .6, 12.0), 'step', [FX, 9.8, 0], root, { clip: 1 }));
  housing.push(add(box(.6, 3.9, 12.0), 'step', [FX - 3.1, 5.9, 0], root, { clip: 1 }));      // lintels over the tunnel
  housing.push(add(box(.6, 3.9, 12.0), 'step', [FX + 3.1, 5.9, 0], root, { clip: 1 }));
  housing.push(add(box(1.4, .9, 6.0), 'step', [FX, 10.4, 0], root, { clip: 1 }));         // card slot ridge on the roof
  const MAG = []; for (let j = 0; j < 8; j++) MAG.push(add(cardGeo, 'step', [FX, 7.55 + j * .2, 0]));
  for (const s of [-1, 1]) add(box(.3, 2.2, .3), 'step', [FX + s * 2.4, 7.4, 1.65]), add(box(.3, 2.2, .3), 'step', [FX + s * 2.4, 7.4, -1.65]);
  const feedR = []; for (const s of [-1, 1]) feedR.push(add(cylX(.45, 4.2, 24), 'step', [FX, 6.7, s * 2.05]));
  const reader = add(box(2.2, 1.0, .9), 'step', [FX, 5.6, -4.55]);
  void reader;

  // GOV (the government's system, grey-violet): the gate (with its scanner arch) and the stamp press
  const GX = ST[2];
  for (const s of [-1, 1]) add(box(.7, 8.6, .7), 'gov', [GX, 0, s * 6.3]);
  add(box(1.0, .7, 13.3), 'gov', [GX, 8.6, 0]);
  add(box(3.0, .5, 3.0), 'gov', [GX, 8.1, 0]);
  const flapX = GX + 3.6, flaps = [];
  for (const s of [-1, 1]) {
    add(cylY(.35, 3.6), 'gov', [flapX, 4.2, s * 5.0]);
    const hinge = new THREE.Group(); hinge.position.set(flapX, 0, s * 5.0); root.add(hinge);
    const f = add(new THREE.BoxGeometry(.3, 2.7, 4.3).translate(0, YB + .1 + 1.35, -s * 2.15), 'gov', [0, 0, 0], hinge);
    void f; flaps.push({ hinge, s });
  }
  const SX = ST[3];
  const BACK = 2.1, FRONT = 5.4, LIFT3 = 1.2, PY = 11.5, PZ = -5.4;
  const DROPMAX = FRONT * Math.sin(Math.atan2(LIFT3, BACK));
  add(cylY(.45, PY + .35), 'frame', [SX + 1.0, 0, PZ - .3]);                 // lever post and pin
  add(cylX(.3, 1.3), 'frame', [SX + .5, PY, PZ]);
  const lever = new THREE.Group(); lever.position.set(SX, PY, PZ); root.add(lever);
  add(new THREE.BoxGeometry(.8, .5, BACK + FRONT + 1.0).translate(0, 0, (FRONT - BACK) / 2 + .2), 'gov', [0, 0, 0], lever);
  add(cylX(.45, 1.0, 24), 'gov', [0, -.45, -BACK], lever);                   // follower roller on the stamp cam
  const stampG = new THREE.Group(); root.add(stampG);
  const HEAD = YB + PP.h + .1 + DROPMAX;                                       // stamp face at rest; at full lift it meets the card
  add(cylY(.3, PY - .25 - (HEAD + 1.1)), 'gov', [SX, HEAD + 1.1, 0], stampG);
  add(box(3.2, 1.1, 2.4), 'gov', [SX, HEAD + .2, 0], stampG);
  add(box(3.4, .25, 2.6), 'gov', [SX, HEAD, 0], stampG);                      // the rubber
  // the three cams on the back shaft (form feed is the step's, gate and stamp are the government's)
  function camGeo(Lf) {
    const pts = []; const N = 160;
    for (let i = 0; i < N; i++) { const a = i / N * TAU; const f = (((Math.PI - a) / TAU) % 1 + 1) % 1; const r = 1.6 + Lf(f);   // the point on top at shaft angle 2πθ has f = θ mod 1
      pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    return slab(W2S(pts), [circle(.55, 32)], .8, 0);
  }
  const camPlane = x => { const g = new THREE.Group(); g.rotation.z = -Math.PI / 2; g.position.set(x, 0, 0); root.add(g); return g; };
  const cams = [[FX, L1, 'step'], [GX, L2, 'gov'], [SX, L3, 'gov']].map(([x, Lf, sys]) => add(camGeo(Lf), sys, [-9, 0, -7.5], camPlane(x - .4)));
  const gateRod = add(cylY(.22, 2.6), 'gov', [GX + .9, 0, -7.5]);
  const feedRod = add(cylY(.22, 2.6), 'step', [FX + .9, 0, -7.5]);

  // explode plates (acronym): built per spec, lifted out of the form unit's roof
  const plates = [];
  function setPlates(n) {
    for (let i = 0; i < n; i++) plates.push(add(slab(W2S(rrect(6.0, 9.0, .6)), [], .3, 0), 'step', [FX, 9.95, 0]));
  }

  // soft contact shadow under the base plate (colour pass only)
  {
    const S = 12, x0 = -46, x1 = 46, z0 = -32, z1 = 18;
    const c = document.createElement('canvas'); c.width = (x1 - x0) * S; c.height = (z1 - z0) * S; const x = c.getContext('2d');
    x.filter = `blur(${2.2 * S}px)`; x.fillStyle = 'rgba(70,60,45,.20)';
    x.beginPath(); basePts.forEach(([px, pz], i) => x[i ? 'lineTo' : 'moveTo']((px - x0 + .5) * S, (pz - 6 - z0 + 1.2) * S)); x.closePath(); x.fill();
    const s = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.position.set((x0 + x1) / 2, -1.9, (z0 + z1) / 2); s.layers.set(1); scene.add(s);
  }

  // ───────── state at one machine time ─────────
  // cycle n: f in [0, IDX) the belt indexes, B = n + idx(f); then it dwells with B = n + 1.
  // passport k: on the belt once k <= n (stage p = B - k: 0 hopper, 1 form, 2 gate, 3 stamp, 4 bin), otherwise stacked in the hopper.
  const cs = { theta: 0 };
  function setMachine(theta, o = {}) {
    cs.theta = theta;
    const { n, f, B } = cycleState(theta);
    // gears and shaft
    const a = TAU * theta;
    gearG.rotation.y = -wG - a; gearP.rotation.y = -wP + a * ZG / ZP;
    for (const c of cams) c.rotation.y = -a;
    // belt and rollers (one roller turn per pitch)
    for (let i = 0; i < NSL; i++) { const [x, y, r] = beltPos(i * 1.5 + B * D); slats[i].position.set(x, y, 0); slats[i].rotation.z = r; }
    for (const r of rollers) r.rotation.z = -B * TAU;
    // passports
    const drop = f < IDX ? ss(seg(idx(f), .5, 1)) : 1;          // the stack drops one place once the bottom passport is half out
    for (let i = 0; i < NPASS; i++) {
      const P = pass[i], k = n - 4 + ((i - (n - 4)) % NPASS + NPASS) % NPASS;
      let x, y, rz = 0;
      if (k <= n) {
        x = HX + D * (B - k); y = YB;
        if (x > 24.6) { const u = x - 24.6; y = YB - Math.min(3.6, .2 * u * u); rz = -Math.min(.45, .08 * u); }
        if (x > 33.5) { P.g.visible = false; continue; }
      } else {
        x = HX; y = YB + PP.h * (k - n - drop);
        if (y > YB + 6.6) { P.g.visible = false; continue; }
      }
      P.g.visible = true; P.g.position.set(x, y, 0); P.g.rotation.z = rz;
      P.c.visible = k <= n - 1 || (k === n && f >= PH.feed0);
      P.c.position.y = k === n && f < PH.feed1 ? PP.h + (7.55 - YB - PP.h) * (1 - ss(seg(f, PH.feed0, PH.feed1))) : PP.h;
      P.m.visible = k <= n - 3 || (k === n - 2 && f >= PH.stamp);
    }
    for (const r of feedR) r.rotation.x = (r.position.z > 0 ? -1 : 1) * TAU * 1.5 * ss(seg(f, PH.feed0, PH.feed1)) + n * TAU * 1.5;
    feedRod.position.y = 9 + 1.6 + L1(f);
    // gate
    const g = L2(f);
    for (const fl of flaps) fl.hinge.rotation.y = -fl.s * deg(80) * g;
    gateRod.position.y = 9 + 1.6 + g;
    // stamp lever: back arm 3 over the cam, front arm 4.5 over the belt
    const beta = Math.atan2(L3(f), BACK);
    lever.rotation.x = beta;                                                  // back end (over the cam) up, front end (over the belt) down
    stampG.position.y = -FRONT * Math.sin(beta);
    // explode plates
    const lift = o.lift || 0;
    plates.forEach((p, i) => { p.position.y = 9.95 + lift * (2.2 + 2.0 * i); p.visible = lift > .002; });
    // magazine: the bottom card leaves during the feed
  }
  const deg = d => d * Math.PI / 180;

  // ───────── dye ─────────
  // tr[g] = [{t0, dur, from, to, O:[x,y,z], R}] sorted; colour = from → to as a front spreading from O
  function setDye(t, tr) {
    for (const g of SYS) {
      const u = dyeU[g], list = tr[g] || [];
      let cur = null; for (const e of list) if (e.t0 <= t) cur = e;
      if (!cur) { u.colA.value.set(list.length ? list[0].from : PAL.neutral); u.colB.value.copy(u.colA.value); u.R.value = -1; continue; }
      u.colA.value.set(cur.from); u.colB.value.set(cur.to); u.O.value.set(...cur.O);
      const k = seg(t, cur.t0, cur.t0 + cur.dur);
      u.R.value = k >= 1 ? 1e4 : cur.R * eo(k) + .05;
    }
  }

  // ───────── camera ─────────
  function setCamera(c) {
    const el = deg(c.el), az = deg(c.az);
    camera.position.set(c.x + c.d * Math.cos(el) * Math.sin(az), c.y + c.d * Math.sin(el), c.z + c.d * Math.cos(el) * Math.cos(az));
    camera.lookAt(c.x, c.y, c.z);
    camera.setViewOffset(W, H, c.ox || 0, c.oy || 0, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    lightView.value.copy(LIGHT).transformDirection(camera.matrixWorldInverse);
  }
  function setCut(centreAz, open) {          // a wedge through the form unit's vertical axis, opened toward the camera
    const az = deg(centreAz);
    setWedge(CUT, [FX, 0], Math.atan2(Math.cos(az), Math.sin(az)), open);
  }
  const scr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; };

  const post = makeOutline(renderer, scene, camera, W * PR, H * PR, PAL, parts);
  return {
    setMachine, setDye, setCamera, setCut, setPlates, scr, render: () => post.render(),
    passportX: (theta, k) => { const { B } = cycleState(theta); return HX + D * Math.max(0, B - k); },
    ANCH: {                                   // world points that labels and dye fronts grow from
      formTop: [FX, 10.8, 0], formSide: [FX + 3.4, 8.0, 3.0], formMid: [FX, 6.5, 0], mag: [FX, 8.2, 1.5], feed: [FX, 6.7, 2.05], reader: [FX, 6.1, -4.1],
      cardIn: [FX + 1.6, 5.2, 1.2], hopper: [HX, YB + 7.6, 0], hopperIn: [HX, YB + 1, 0], belt: [0, YB, 4.5], gearHub: [-30.4, 9, -7.5], mesh: [-30.4, 4.6, -12.3],
      gate: [GX, 9.3, 0], flap: [flapX, YB + 2.8, 2.6], stamp: [SX, HEAD + .6, 1.2], lever: [SX, 11.6, 0], cam: [SX - .4, 9, -7.5], bin: [31, 4.8, 0],
      station: i => [ST[Math.min(i, 4)], YB + .6, 0], plate: i => [FX + 3.0, 9.95 + 2.2 + 2.0 * i + .15, 4.5],
    },
  };
}
