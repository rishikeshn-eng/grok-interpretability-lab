/* Grok — grokking & mechanistic interpretability lab. Vanilla JS. */
(async () => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const svg = (c, w, h) => { c.innerHTML = ''; const s = el('svg', { viewBox: `0 0 ${w} ${h}` }); c.appendChild(s); return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = { train: '#3A5BFF', test: '#FF3D71', ok: '#18B67A', bad: '#FF5A5F', violet: '#7A4DFF', gold: '#FFB020', ink: '#0D0D14', muted: '#5F6070', line: '#E4E4DC' };
const tip = $('#tip');
const showTip = (h, e) => { tip.innerHTML = h; tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; };
const hideTip = () => tip.style.opacity = 0;

const [G, FR, FI, GR] = await Promise.all([fetch('grok.json').then(r => r.json()), fetch('frames.bin').then(r => r.arrayBuffer()), fetch('final.bin').then(r => r.arrayBuffer()), fetch('grids.bin').then(r => r.arrayBuffer())]);
const P = G.p, N = G.N, NC = G.steps.length;
const frames = new Int8Array(FR), fin = new Int8Array(FI), grids = new Uint8Array(GR);
const mat = key => { const f = G.final[key]; const n = f.shape[0] * f.shape[1]; const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = fin[f.off + i] * f.sc; return a; };
const Wa = mat('Wa'), Wb = mat('Wb'), W2 = mat('W2');
const TRAIN = Uint8Array.from(G.train), DOM = G.dom, LOG = G.log;
const logAt = s => { let best = LOG[0]; for (const r of LOG) if (r[0] <= s) best = r; return best; };
setTimeout(() => $('#loader').classList.add('done'), 100);
const gen = LOG.find(r => r[4] >= .95)[0];
$('#kGen').textContent = gen.toLocaleString();
$('#kPur').textContent = `${G.series[0].purity.toFixed(2)} → ${G.series[NC - 1].purity.toFixed(2)}`;

/* ---------- hero clock ---------- */
(function clock() {
  const s = $('#clock'), R = 100;
  el('circle', { r: R, fill: 'none', stroke: C.line, 'stroke-width': 2 }, s);
  for (let i = 0; i < P; i++) { const t = i / P * 2 * Math.PI - Math.PI / 2; el('circle', { cx: R * Math.cos(t), cy: R * Math.sin(t), r: i % 10 === 0 ? 2.6 : 1.4, fill: i % 10 === 0 ? C.ink : '#B8B8C4' }, s); if (i % 10 === 0) el('text', { x: 116 * Math.cos(t), y: 116 * Math.sin(t) + 4, 'text-anchor': 'middle', 'font-size': 9, 'font-family': 'JetBrains Mono', fill: C.muted }, s).textContent = i; }
  const arcA = el('path', { fill: 'none', stroke: C.train, 'stroke-width': 7, 'stroke-linecap': 'round' }, s);
  const arcB = el('path', { fill: 'none', stroke: C.test, 'stroke-width': 7, 'stroke-linecap': 'round' }, s);
  const hand = el('line', { x1: 0, y1: 0, stroke: C.violet, 'stroke-width': 3, 'stroke-linecap': 'round' }, s);
  const dot = el('circle', { r: 8, fill: C.violet }, s);
  const halo = el('circle', { r: 16, fill: C.violet, opacity: .15 }, s);
  el('circle', { r: 5, fill: C.ink }, s);
  const arc = (a0, a1, r) => { const t0 = a0 / P * 2 * Math.PI - Math.PI / 2, t1 = a1 / P * 2 * Math.PI - Math.PI / 2; const large = (a1 - a0) > P / 2 ? 1 : 0; return a1 - a0 < .01 ? '' : `M${r * Math.cos(t0)},${r * Math.sin(t0)}A${r},${r} 0 ${large} 1 ${r * Math.cos(t1)},${r * Math.sin(t1)}`; };
  let a = 23, b = 41, t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    if (t > 4) { a = Math.floor(Math.random() * P); b = Math.floor(Math.random() * P); t0 = now; $('#cA').textContent = a; $('#cB').textContent = b; $('#cC').textContent = '…'; }
    const ea = clamp(t / 1.1, 0, 1), eb = clamp((t - 1.1) / 1.1, 0, 1), e = x => 1 - Math.pow(1 - x, 3);
    const pa = a * e(ea), pb = b * e(eb);
    arcA.setAttribute('d', arc(0, pa, R - 14)); arcB.setAttribute('d', arc(a, a + pb, R - 26));
    const cur = (pa + pb) % P, th = cur / P * 2 * Math.PI - Math.PI / 2;
    hand.setAttribute('x2', (R - 34) * Math.cos(th)); hand.setAttribute('y2', (R - 34) * Math.sin(th));
    dot.setAttribute('cx', R * Math.cos(th)); dot.setAttribute('cy', R * Math.sin(th)); halo.setAttribute('cx', R * Math.cos(th)); halo.setAttribute('cy', R * Math.sin(th));
    halo.setAttribute('r', 14 + 4 * Math.sin(now / 200));
    if (eb >= 1) $('#cC').textContent = (a + b) % P;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- log-x chart helper ---------- */
function xScale(x0, x1) { const a = Math.log10(100), b = Math.log10(40100); return s => x0 + (Math.log10(s + 100) - a) / (b - a) * (x1 - x0); }

/* ---------- 01 timeline ---------- */
const gctx = $('#gridCv').getContext('2d');
function drawGrid(i) {
  const off = i * Math.ceil(P * P / 8), cs = 5;
  gctx.clearRect(0, 0, 485, 485);
  for (let k = 0; k < P * P; k++) {
    const bit = (grids[off + (k >> 3)] >> (7 - (k & 7))) & 1, a = Math.floor(k / P), b = k % P;
    gctx.fillStyle = bit ? '#18B67A' : '#FF5A5F'; gctx.globalAlpha = TRAIN[k] ? .55 : 1;
    gctx.fillRect(b * cs, a * cs, cs, cs);
  }
  gctx.globalAlpha = 1; gctx.fillStyle = '#fff';
  for (let k = 0; k < P * P; k++) if (TRAIN[k]) { const a = Math.floor(k / P), b = k % P; gctx.fillRect(b * cs + 2, a * cs + 2, 1.2, 1.2); }
}
function curves(i) {
  const W = 620, H = 250, m = { l: 40, r: 12, t: 12, b: 34 }, s = svg($('#curves'), W, H);
  const x = xScale(m.l, W - m.r), y = v => H - m.b - v * (H - m.t - m.b);
  const g = el('g', { class: 'axis' }, s);
  [0, .25, .5, .75, 1].forEach(v => { el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'gl' }, g); el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, g).textContent = v * 100 + '%'; });
  [0, 100, 1000, 10000, 40000].forEach(v => el('text', { x: x(v), y: H - 14, 'text-anchor': 'middle' }, g).textContent = v >= 1000 ? v / 1000 + 'k' : v);
  el('text', { x: (m.l + W) / 2, y: H - 1, 'text-anchor': 'middle' }, g).textContent = 'training step (log scale)';
  const line = (pts, col, dash, w = 2.5) => el('path', { d: pts.map((p, k) => (k ? 'L' : 'M') + x(p[0]) + ',' + y(p[1])).join(''), fill: 'none', stroke: col, 'stroke-width': w, 'stroke-dasharray': dash || '' }, s);
  line(LOG.map(r => [r[0], r[2]]), C.train); line(LOG.map(r => [r[0], r[4]]), C.test); line(G.series.map(r => [r.s, r.purity]), C.violet, '5 4');
  const st = G.steps[i];
  el('line', { x1: x(st), x2: x(st), y1: m.t, y2: H - m.b, stroke: C.ink, 'stroke-width': 1.5 }, s);
  el('circle', { cx: x(st), cy: y(logAt(st)[4]), r: 5, fill: C.test, stroke: '#fff', 'stroke-width': 2 }, s);
  [['train accuracy', C.train], ['test accuracy', C.test], ['wave purity', C.violet]].forEach(([t, c], k) => { el('rect', { x: m.l + 10 + k * 120, y: m.t + 2, width: 14, height: 3, fill: c }, s); el('text', { x: m.l + 28 + k * 120, y: m.t + 8, 'font-size': 11, fill: C.ink }, s).textContent = t; });
  s.style.cursor = 'ew-resize';
  const scrub = e => { const r = s.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W; let best = 0; G.steps.forEach((sv, k) => { if (Math.abs(x(sv) - px) < Math.abs(x(G.steps[best]) - px)) best = k; }); setStep(best); };
  s.addEventListener('pointerdown', e => { scrub(e); s.onpointermove = scrub; }); s.addEventListener('pointerup', () => s.onpointermove = null); s.addEventListener('pointerleave', () => s.onpointermove = null);
}
function phase(st) {
  if (st < 400) return '<b>Memorising.</b> Training accuracy climbs fast. The network is storing input/output pairs like a lookup table.';
  if (st < 5000) return '<b>Memorised, not understood.</b> The training set is perfect and unseen pairs are no better than chance (≈1%). A naïve observer would stop here and call it overfitting.';
  if (st < 25000) return '<b>Circuit forming, invisibly.</b> Test accuracy barely moves, but weight decay keeps pushing toward the simpler solution and wave purity climbs. The general algorithm is being built next to the memorised one.';
  if (st < 34000) return '<b>Grokking.</b> The general circuit now outcompetes memorisation and weight decay cleans up the rest. Test accuracy shoots up.';
  return '<b>Generalised.</b> The network answers pairs it has never seen, using waves and rotations instead of a lookup table.';
}
let curStep = 0;
function setStep(i) {
  curStep = i; const st = G.steps[i], r = logAt(st), sr = G.series[i];
  $('#tlStep').value = i; $('#tlStepOut').textContent = st.toLocaleString();
  $('#sTrA').textContent = (r[2] * 100).toFixed(1) + '%'; $('#sTeA').textContent = (r[4] * 100).toFixed(1) + '%';
  $('#sTeA').style.color = r[4] > .9 ? C.ok : r[4] > .3 ? C.gold : C.test;
  $('#sPur').textContent = sr.purity.toFixed(2); $('#sNorm').textContent = sr.norm.toFixed(1);
  $('#phase').innerHTML = phase(st);
  drawGrid(i); curves(i);
}
let tlTimer = null;
$('#tlPlay').addEventListener('click', () => { if (tlTimer) { clearInterval(tlTimer); tlTimer = null; $('#tlPlay').textContent = '▶ Play'; return; } if (curStep >= NC - 1) setStep(0); $('#tlPlay').textContent = '❚❚ Pause'; tlTimer = setInterval(() => { if (curStep >= NC - 1) { clearInterval(tlTimer); tlTimer = null; $('#tlPlay').textContent = '↺ Replay'; return; } setStep(curStep + 1); }, 230); });
$('#tlStep').addEventListener('input', e => setStep(+e.target.value));
setStep(0);
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); setTimeout(() => $('#tlPlay').click(), 600); } }, { threshold: .5 }).observe($('#gridCv'));
$('#gridCv').addEventListener('mousemove', e => { const r = e.target.getBoundingClientRect(), b = Math.floor((e.clientX - r.left) / r.width * P), a = Math.floor((e.clientY - r.top) / r.height * P); if (a < 0 || b < 0 || a >= P || b >= P) return; const k = a * P + b, off = curStep * Math.ceil(P * P / 8), bit = (grids[off + (k >> 3)] >> (7 - (k & 7))) & 1; showTip(`${a} + ${b} = ${(a + b) % P} (mod 97)<br>${TRAIN[k] ? 'in training set' : 'held out'} · ${bit ? '✓ correct' : '✗ wrong'} at step ${G.steps[curStep].toLocaleString()}`, e); });
$('#gridCv').addEventListener('mouseleave', hideTip);

/* ---------- 02 weights ---------- */
const wCv = $('#wCv'), fCv = $('#fCv');
wCv.width = P; wCv.height = N; fCv.width = 48; fCv.height = N;
const wctx = wCv.getContext('2d'), fctx = fCv.getContext('2d');
function divCol(t) { t = clamp(t, -1, 1); const a = t < 0 ? [58, 91, 255] : [255, 61, 113], f = Math.abs(t); return [255 + (a[0] - 255) * f, 255 + (a[1] - 255) * f, 255 + (a[2] - 255) * f]; }
function magma(t) { t = clamp(t, 0, 1); const st = [[13, 13, 20], [58, 20, 110], [140, 40, 140], [230, 80, 100], [255, 176, 32], [255, 250, 200]]; const x = t * 5, k = Math.min(4, Math.floor(x)), f = x - k; return st[k].map((v, i) => v + (st[k + 1][i] - v) * f); }
const COS = [], SIN = []; for (let k = 1; k <= 48; k++) { COS.push(Float32Array.from({ length: P }, (_, a) => Math.cos(2 * Math.PI * k * a / P))); SIN.push(Float32Array.from({ length: P }, (_, a) => Math.sin(2 * Math.PI * k * a / P))); }
function drawW(i) {
  const f = G.frames[i], img = wctx.createImageData(P, N), img2 = fctx.createImageData(48, N);
  for (let n = 0; n < N; n++) {
    let mx = 0; for (let a = 0; a < P; a++) mx = Math.max(mx, Math.abs(frames[f.off + n * P + a]));
    for (let a = 0; a < P; a++) { const c = divCol(frames[f.off + n * P + a] / (mx || 1)); const o = (n * P + a) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
    const pw = new Float32Array(48); let tot = 0, pm = 0;
    for (let k = 0; k < 48; k++) { let re = 0, im = 0; for (let a = 0; a < P; a++) { const w = frames[f.off + n * P + a]; re += w * COS[k][a]; im += w * SIN[k][a]; } pw[k] = re * re + im * im; tot += pw[k]; pm = Math.max(pm, pw[k]); }
    for (let k = 0; k < 48; k++) { const c = magma(Math.sqrt(pw[k] / (pm || 1))); const o = (n * 48 + k) * 4; img2.data[o] = c[0]; img2.data[o + 1] = c[1]; img2.data[o + 2] = c[2]; img2.data[o + 3] = 255; }
  }
  wctx.putImageData(img, 0, 0); fctx.putImageData(img2, 0, 0);
  $('#wStep').value = i; $('#wStepOut').textContent = G.steps[i].toLocaleString();
  purChart(i);
}
function purChart(i) {
  const W = 1100, H = 200, m = { l: 40, r: 12, t: 10, b: 30 }, s = svg($('#purChart'), W, H), x = xScale(m.l, W - m.r), y = v => H - m.b - v * (H - m.t - m.b);
  const g = el('g', { class: 'axis' }, s); [0, .5, 1].forEach(v => { el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'gl' }, g); el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, g).textContent = v; });
  [0, 100, 1000, 10000, 40000].forEach(v => el('text', { x: x(v), y: H - 10, 'text-anchor': 'middle' }, g).textContent = v >= 1000 ? v / 1000 + 'k' : v);
  const pts = G.series.map(r => [r.s, r.purity]);
  el('path', { d: pts.map((p, k) => (k ? 'L' : 'M') + x(p[0]) + ',' + y(p[1])).join('') + `L${x(40000)},${y(0)}L${x(0)},${y(0)}Z`, fill: C.violet, opacity: .1 }, s);
  el('path', { d: pts.map((p, k) => (k ? 'L' : 'M') + x(p[0]) + ',' + y(p[1])).join(''), fill: 'none', stroke: C.violet, 'stroke-width': 3 }, s);
  el('path', { d: LOG.map((r, k) => (k ? 'L' : 'M') + x(r[0]) + ',' + y(r[4])).join(''), fill: 'none', stroke: C.test, 'stroke-width': 2.5 }, s);
  el('line', { x1: x(G.steps[i]), x2: x(G.steps[i]), y1: m.t, y2: H - m.b, stroke: C.ink }, s);
  el('text', { x: x(3000), y: y(.12) , fill: C.violet, 'font-size': 12.5, 'font-weight': 600 }, s).textContent = 'wave purity starts rising here…';
  el('text', { x: x(27000) - 8, y: y(.62), fill: C.test, 'font-size': 12.5, 'font-weight': 600, 'text-anchor': 'end' }, s).textContent = '…test accuracy follows much later →';
}
let wTimer = null, wi = 0;
$('#wPlay').addEventListener('click', () => { if (wTimer) { clearInterval(wTimer); wTimer = null; $('#wPlay').textContent = '▶ Play'; return; } if (wi >= NC - 1) wi = 0; $('#wPlay').textContent = '❚❚ Pause'; wTimer = setInterval(() => { if (wi >= NC - 1) { clearInterval(wTimer); wTimer = null; $('#wPlay').textContent = '↺ Replay'; return; } drawW(++wi); }, 180); });
$('#wStep').addEventListener('input', e => { wi = +e.target.value; drawW(wi); });
drawW(0);
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); setTimeout(() => $('#wPlay').click(), 500); } }, { threshold: .4 }).observe(wCv);

/* ---------- 03 neuron ---------- */
function neuron(n) {
  $('#nSel').value = n; $('#nOut').textContent = n;
  const k = DOM[n], w = Array.from({ length: P }, (_, a) => Wa[n * P + a]);
  let re = 0, im = 0; for (let a = 0; a < P; a++) { re += w[a] * Math.cos(2 * Math.PI * k * a / P); im += w[a] * Math.sin(2 * Math.PI * k * a / P); }
  const amp = 2 * Math.hypot(re, im) / P, ph = Math.atan2(im, re), mean = w.reduce((s, v) => s + v, 0) / P;
  const fit = a => mean + amp * Math.cos(2 * Math.PI * k * a / P - ph);
  let ssr = 0, sst = 0; w.forEach((v, a) => { ssr += (v - fit(a)) ** 2; sst += (v - mean) ** 2; });
  $('#nInfo').textContent = `dominant frequency k = ${k} · ${(G.domFrac[n] * 100).toFixed(0)}% of its Fourier power · cosine fit R² = ${(1 - ssr / sst).toFixed(2)}`;
  const W = 640, H = 260, m = { l: 40, r: 10, t: 10, b: 30 }, s = svg($('#nWave'), W, H);
  const mn = Math.min(...w), mx = Math.max(...w), x = a => m.l + a / (P - 1) * (W - m.l - m.r), y = v => H - m.b - (v - mn) / ((mx - mn) || 1) * (H - m.t - m.b);
  const g = el('g', { class: 'axis' }, s); [0, 24, 48, 72, 96].forEach(v => el('text', { x: x(v), y: H - 10, 'text-anchor': 'middle' }, g).textContent = v); el('line', { x1: m.l, x2: W - m.r, y1: y(mean), y2: y(mean), class: 'gl' }, g);
  let d = ''; for (let a = 0; a <= 96; a += .25) d += (d ? 'L' : 'M') + x(a) + ',' + y(fit(a));
  const pth = el('path', { d, fill: 'none', stroke: C.violet, 'stroke-width': 2.5 }, s);
  const L = pth.getTotalLength(); pth.style.strokeDasharray = L; pth.style.strokeDashoffset = L; requestAnimationFrame(() => requestAnimationFrame(() => { pth.style.transition = 'stroke-dashoffset 1s'; pth.style.strokeDashoffset = 0; }));
  w.forEach((v, a) => el('circle', { cx: x(a), cy: y(v), r: 3.2, fill: C.train }, s));
  const cv = $('#nAct'), ctx = cv.getContext('2d'), img = ctx.createImageData(P, P); let am = 0; const act = new Float32Array(P * P);
  for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) { const v = Math.max(0, Wa[n * P + a] + Wb[n * P + b]); act[a * P + b] = v; am = Math.max(am, v); }
  for (let i = 0; i < P * P; i++) { const c = magma(act[i] / (am || 1)); img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
  const tmp = document.createElement('canvas'); tmp.width = P; tmp.height = P; tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 291, 291); ctx.drawImage(tmp, 0, 0, 291, 291);
}
$('#nSel').addEventListener('input', e => neuron(+e.target.value));
$('#nRand').addEventListener('click', () => neuron(G.nord[Math.floor(Math.random() * N)]));
const bestN = [...Array(N).keys()].filter(n => DOM[n] <= 4).sort((a, b) => G.domFrac[b] - G.domFrac[a])[0]; neuron(bestN);

/* ---------- 04 calculator + ablation ---------- */
const H = new Float32Array(N * P * P);
for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) { const k = a * P + b; for (let n = 0; n < N; n++) H[n * P * P + k] = Math.max(0, Wa[n * P + a] + Wb[n * P + b]); }
const off = new Set();
function activeNeurons() { const a = []; for (let n = 0; n < N; n++) if (!off.has(DOM[n])) a.push(n); return a; }
function logitsFor(a, b, act) { const k = a * P + b, L = new Float32Array(P); for (const n of act) { const h = H[n * P * P + k]; if (!h) continue; for (let c = 0; c < P; c++) L[c] += W2[c * N + n] * h; } return L; }
function fullAcc(act) {
  let correct = 0; const L = new Float32Array(P);
  for (let k = 0; k < P * P; k++) { L.fill(0); for (const n of act) { const h = H[n * P * P + k]; if (!h) continue; for (let c = 0; c < P; c++) L[c] += W2[c * N + n] * h; } let bi = 0; for (let c = 1; c < P; c++) if (L[c] > L[bi]) bi = c; if (bi === ((Math.floor(k / P) + k % P) % P)) correct++; }
  return correct / (P * P);
}
function calc() {
  const a = clamp(+$('#ia').value | 0, 0, 96), b = clamp(+$('#ib').value | 0, 0, 96), act = activeNeurons(), L = logitsFor(a, b, act);
  let bi = 0; for (let c = 1; c < P; c++) if (L[c] > L[bi]) bi = c; const truth = (a + b) % P;
  $('#ans').textContent = bi; $('#ans').style.color = bi === truth ? C.violet : C.bad;
  const W = 620, Hh = 200, s = svg($('#logits'), W, Hh), mn = Math.min(...L), mx = Math.max(...L), bw = (W - 20) / P;
  Array.from(L).forEach((v, c) => { const h = (v - mn) / ((mx - mn) || 1) * (Hh - 30); const r = el('rect', { x: 10 + c * bw, y: Hh - 20 - h, width: bw - 1, height: h, fill: c === truth ? C.violet : c === bi ? C.bad : '#C9C9D6', rx: 1 }, s); r.addEventListener('mousemove', e => showTip(`answer ${c}: logit ${v.toFixed(2)}`, e)); r.addEventListener('mouseleave', hideTip); });
  el('text', { x: 10 + truth * bw + bw / 2, y: Hh - 4, 'text-anchor': 'middle', 'font-size': 11, fill: C.violet, 'font-family': 'JetBrains Mono' }, s).textContent = truth;
}
function freqButtons() { $('#freqs').innerHTML = Array.from({ length: 48 }, (_, i) => `<button data-k="${i + 1}" class="${off.has(i + 1) ? 'off' : ''}" title="${DOM.filter(d => d === i + 1).length} neurons">${i + 1}</button>`).join(''); $$('#freqs button').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.k; off.has(k) ? off.delete(k) : off.add(k); ablUpdate(); })); }
let abT; function ablUpdate() { freqButtons(); calc(); $('#abN').textContent = N - activeNeurons().length; $('#abAcc').textContent = '…'; clearTimeout(abT); abT = setTimeout(() => { const acc = fullAcc(activeNeurons()); $('#abAcc').textContent = (acc * 100).toFixed(1) + '%'; $('#abAcc').style.color = acc > .9 ? C.ok : acc > .5 ? C.gold : C.bad; }, 60); }
$('#ia').addEventListener('input', calc); $('#ib').addEventListener('input', calc);
$('#abNone').addEventListener('click', () => { off.clear(); ablUpdate(); });
$('#abHalf').addEventListener('click', () => { off.clear(); const ks = [...Array(48).keys()].map(i => i + 1).sort(() => Math.random() - .5).slice(0, 24); ks.forEach(k => off.add(k)); ablUpdate(); });
$('#abSweep').addEventListener('click', async () => {
  const b = $('#abSweep'); b.disabled = true; const res = [], order = [...Array(48).keys()].map(i => i + 1).sort(() => Math.random() - .5);
  for (let m = 0; m <= 48; m += 4) { const offS = new Set(order.slice(0, m)); const act = []; for (let n = 0; n < N; n++) if (!offS.has(DOM[n])) act.push(n); res.push([m, fullAcc(act)]); drawSweep(res); await sleep(10); }
  b.disabled = false;
});
function drawSweep(res) {
  const W = 620, Hh = 180, m = { l: 40, r: 10, t: 10, b: 30 }, s = svg($('#sweep'), W, Hh), x = v => m.l + v / 48 * (W - m.l - m.r), y = v => Hh - m.b - v * (Hh - m.t - m.b);
  const g = el('g', { class: 'axis' }, s); [0, .5, 1].forEach(v => { el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'gl' }, g); el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, g).textContent = v * 100 + '%'; });
  [0, 12, 24, 36, 48].forEach(v => el('text', { x: x(v), y: Hh - 12, 'text-anchor': 'middle' }, g).textContent = v); el('text', { x: (m.l + W) / 2, y: Hh, 'text-anchor': 'middle' }, g).textContent = 'frequencies ablated (random order)';
  el('path', { d: res.map((r, k) => (k ? 'L' : 'M') + x(r[0]) + ',' + y(r[1])).join(''), fill: 'none', stroke: C.violet, 'stroke-width': 3 }, s);
  res.forEach(r => el('circle', { cx: x(r[0]), cy: y(r[1]), r: 4, fill: C.violet }, s));
}
freqButtons(); calc(); ablUpdate();

/* ---------- nav ---------- */
const links = $$('.toc a');
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
$$('section.sec').forEach(s => io.observe(s));
const rv = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }), { threshold: .06 });
$$('.card, .prose').forEach(n => { n.classList.add('reveal'); rv.observe(n); });
})();
