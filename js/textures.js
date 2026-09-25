/*
 * Texturas procedurales (dibujadas en <canvas>, sin imágenes externas).
 * Cada textura devuelve { map, bump?, canvas } y una miniatura para el panel.
 * Se generan bajo demanda: solo se dibujan cuando algo las usa por primera vez,
 * y warmUp() prepara el resto en ratos libres para las miniaturas del panel.
 */

function prng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createTextures(THREE, renderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const out = {}, thumbs = {}, cache = {}, pending = [];

  function build(name, w, h, drawColor, drawHeight, seed) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    let rnd = prng(seed); drawColor(c.getContext('2d'), w, h, rnd);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = aniso;
    const t = { map, canvas: c };
    if (drawHeight) {
      const hc = document.createElement('canvas'); hc.width = w; hc.height = h;
      rnd = prng(seed); drawHeight(hc.getContext('2d'), w, h, rnd);
      const bump = new THREE.CanvasTexture(hc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.anisotropy = aniso;
      t.bump = bump;
    }
    const s = document.createElement('canvas'); s.width = s.height = 96;
    s.getContext('2d').drawImage(c, 0, 0, Math.min(w, h) * 0.5, Math.min(h, w) * 0.5, 0, 0, 96, 96);
    thumbs[name] = s.toDataURL('image/jpeg', 0.8);
    return t;
  }
  function make(name, w, h, drawColor, drawHeight, seed = 1) {
    pending.push(name);
    Object.defineProperty(out, name, { enumerable: true, get: () => cache[name] || (cache[name] = build(name, w, h, drawColor, drawHeight, seed)) });
  }
  // Genera las texturas que falten, una por hueco libre del navegador, y avisa al terminar
  function warmUp(onDone) {
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 30));
    const next = () => {
      const name = pending.find(n => !cache[n]);
      if (!name) { onDone && onDone(); return; }
      void out[name]; idle(next);
    };
    idle(next);
  }
  const noise = (g, w, h, rnd, n, cols, size = 3) => {
    for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0].replace('A', (rnd() * 0.08).toFixed(3)); const s = 1 + rnd() * size; g.fillRect(rnd() * w, rnd() * h, s, s); }
  };
  // Dibuja una forma en las 9 posiciones envolventes para que la textura sea continua
  const wrap9 = (w, h, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy); };

  /* ── Madera de roble (1 m) ── */
  const oakGrain = (g, w, h, rnd, base = '#C39A6B') => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const y = rnd() * h, a = 0.03 + rnd() * 0.12, amp = 2 + rnd() * 7, f = 0.003 + rnd() * 0.01, ph = rnd() * 6;
      g.strokeStyle = rnd() > .3 ? `rgba(105,68,36,${a})` : `rgba(242,208,165,${a})`; g.lineWidth = 0.5 + rnd() * 2.4;
      g.beginPath(); for (let x = -16; x <= w + 16; x += 16) g.lineTo(x, y + Math.sin(x * f + ph) * amp); g.stroke();
    }
    for (let k = 0; k < 6; k++) { const x = rnd() * w, y = rnd() * h; const gr = g.createRadialGradient(x, y, 1, x, y, 14 + rnd() * 10); gr.addColorStop(0, 'rgba(90,55,25,.35)'); gr.addColorStop(1, 'rgba(90,55,25,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 30, 8, 0, 0, 7); g.fill(); }
  };
  make('oak', 1024, 1024, (g, w, h, r) => oakGrain(g, w, h, r), (g, w, h, r) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.strokeStyle = `rgba(0,0,0,${r() * .25})`; g.lineWidth = 1 + r() * 2; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - .5) * 8); g.stroke(); } }, 3);

  /* ── Cuarzo Calacatta (2,4 m) ── */
  make('calacatta', 2048, 1024, (g, w, h, rnd) => {
    g.fillStyle = '#F3F1ED'; g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 9000, ['rgba(160,150,140,A)', 'rgba(255,255,255,A)'], 2);
    const vein = (col, lw, blur, n) => {
      g.save(); g.filter = `blur(${blur}px)`; g.strokeStyle = col; g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        let x = rnd() * w, y = -40, ang = 0.9 + rnd() * 0.9; g.lineWidth = lw * (0.4 + rnd());
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 40; s++) { ang += (rnd() - .5) * 0.5; x += Math.cos(ang) * 40; y += Math.sin(ang) * 40; g.lineTo(x, y); if (y > h + 40) break; }
        g.stroke();
      }
      g.restore();
    };
    vein('rgba(120,114,108,.55)', 7, 3, 7); vein('rgba(95,90,86,.7)', 2, 0.6, 10); vein('rgba(176,146,98,.55)', 1.6, 0.4, 6);
  }, null, 11);

  /* ── Porcelánico negro mate (1 m) ── */
  make('blackStone', 1024, 1024, (g, w, h, rnd) => {
    g.fillStyle = '#242424'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h, r = 60 + rnd() * 160; wrap9(w, h, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${rnd() > .5 ? '60,60,60' : '15,15,15'},.18)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); }); }
    noise(g, w, h, rnd, 14000, ['rgba(120,120,120,A)', 'rgba(0,0,0,A)'], 1.5);
  }, null, 21);

  /* ── Terrazo (0,8 m) ── */
  make('terrazzo', 1024, 1024, (g, w, h, rnd) => {
    g.fillStyle = '#ECE6DC'; g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 8000, ['rgba(150,140,125,A)'], 2);
    const cols = ['#C8745A', '#B9634A', '#8FA08A', '#6E806A', '#3E3B38', '#D9C9B0', '#F8F5EF', '#A9A39A'];
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * w, y = rnd() * h, big = rnd() < 0.06, r = big ? 10 + rnd() * 16 : 2 + rnd() * 7, col = cols[(rnd() * cols.length) | 0], n = 4 + ((rnd() * 4) | 0), rot = rnd() * 6.28;
      wrap9(w, h, (dx, dy) => { if (x + dx < -40 || x + dx > w + 40 || y + dy < -40 || y + dy > h + 40) return; g.fillStyle = col; g.beginPath(); for (let k = 0; k < n; k++) { const a = rot + k / n * 6.283, rr = r * (0.6 + rnd() * 0.5); g.lineTo(x + dx + Math.cos(a) * rr, y + dy + Math.sin(a) * rr); } g.fill(); });
    }
  }, null, 31);

  /* ── Azulejo metro 15×7,5 (0,30 m) ── */
  const metro = (g, w, h, rnd, height) => {
    g.fillStyle = height ? '#000' : '#cfcac2'; g.fillRect(0, 0, w, h);
    const tw = w / 2, th = h / 4, gr = 8;
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
      const x = c * tw + (r % 2 ? tw / 2 : 0), y = r * th;
      if (height) { const grd = g.createLinearGradient(x, y, x, y + th); grd.addColorStop(0, '#d0d0d0'); grd.addColorStop(0.15, '#ffffff'); grd.addColorStop(0.85, '#ffffff'); grd.addColorStop(1, '#c0c0c0'); g.fillStyle = grd; }
      else { const v = 236 + Math.floor(rnd() * 14); const grd = g.createLinearGradient(x, y, x, y + th); grd.addColorStop(0, `rgb(${v + 4},${v + 4},${v})`); grd.addColorStop(1, `rgb(${v - 12},${v - 12},${v - 16})`); g.fillStyle = grd; }
      g.beginPath(); g.roundRect(x + gr / 2, y + gr / 2, tw - gr, th - gr, 10); g.fill();
    }
  };
  make('metro', 1024, 1024, (g, w, h, r) => metro(g, w, h, r, false), (g, w, h, r) => metro(g, w, h, r, true), 41);

  /* ── Zellige 10×10 (0,40 m) ── */
  const zellige = (base, spread) => (g, w, h, rnd, height) => {
    const n = 4, s = w / n, gr = 6;
    g.fillStyle = height ? '#000' : '#d8d2c6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * s + gr / 2, y = j * s + gr / 2, sz = s - gr;
      if (height) { const gg = g.createRadialGradient(x + sz / 2, y + sz / 2, 4, x + sz / 2, y + sz / 2, sz * 0.75); gg.addColorStop(0, '#fff'); gg.addColorStop(1, '#8a8a8a'); g.fillStyle = gg; g.fillRect(x, y, sz, sz); continue; }
      const [hh, ss, ll] = base, dl = (rnd() - .5) * spread;
      g.fillStyle = `hsl(${hh + (rnd() - .5) * 6},${ss}%,${ll + dl}%)`; g.fillRect(x, y, sz, sz);
      for (let k = 0; k < 5; k++) { const cx = x + rnd() * sz, cy = y + rnd() * sz, r = sz * (0.2 + rnd() * 0.4); const gg = g.createRadialGradient(cx, cy, 0, cx, cy, r); gg.addColorStop(0, `hsla(${hh},${ss}%,${ll + dl + (rnd() > .5 ? 9 : -9)}%,.5)`); gg.addColorStop(1, `hsla(${hh},${ss}%,${ll}%,0)`); g.fillStyle = gg; g.fillRect(x, y, sz, sz); }
      const edge = g.createLinearGradient(x, y, x + sz, y + sz); edge.addColorStop(0, 'rgba(255,255,255,.18)'); edge.addColorStop(0.5, 'rgba(255,255,255,0)'); edge.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = edge; g.fillRect(x, y, sz, sz);
    }
  };
  const zg = zellige([152, 22, 36], 10), zc = zellige([40, 38, 86], 6);
  make('zelligeGreen', 1024, 1024, (g, w, h, r) => zg(g, w, h, r, false), (g, w, h, r) => zg(g, w, h, r, true), 51);
  make('zelligeCream', 1024, 1024, (g, w, h, r) => zc(g, w, h, r, false), (g, w, h, r) => zc(g, w, h, r, true), 52);

  /* ── Porcelánico 60×60 (1,2 m) ── */
  const porcelain = (g, w, h, rnd, height) => {
    const s = w / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      if (height) { g.fillStyle = '#fff'; g.fillRect(i * s, j * s, s, s); continue; }
      const v = 216 + Math.floor(rnd() * 8); g.fillStyle = `rgb(${v},${v - 5},${v - 12})`; g.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 3000; k++) { const a = rnd() * 0.06; g.fillStyle = rnd() > .5 ? `rgba(120,110,95,${a})` : `rgba(255,255,255,${a})`; g.fillRect(i * s + rnd() * s, j * s + rnd() * s, 2 + rnd() * 3, 2 + rnd() * 3); }
    }
    g.strokeStyle = height ? '#000' : '#b3ab9e'; g.lineWidth = 5;
    for (let k = 0; k <= 2; k++) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, h); g.stroke(); g.beginPath(); g.moveTo(0, k * s); g.lineTo(w, k * s); g.stroke(); }
  };
  make('porcelain', 1024, 1024, (g, w, h, r) => porcelain(g, w, h, r, false), (g, w, h, r) => porcelain(g, w, h, r, true), 61);

  /* ── Roble en espiga húngara (0,9 m) ── */
  const herring = (g, w, h, rnd, height) => {
    const cols = 4, c = w / cols, ph = 128, rows = h / ph;
    const tones = []; for (let i = 0; i < cols * rows; i++) tones.push([192 + rnd() * 30, 0.66 + rnd() * 0.06, 0.42 + rnd() * 0.06]);
    g.fillStyle = height ? '#000' : '#6b4a2c'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < cols; k++) for (let j = -3; j < rows + 3; j++) {
      const x0 = k * c, y = j * ph, even = k % 2 === 0;
      const pts = even ? [[x0, y], [x0 + c, y - c], [x0 + c, y - c + ph], [x0, y + ph]] : [[x0, y - c], [x0 + c, y], [x0 + c, y + ph], [x0, y - c + ph]];
      g.save(); g.beginPath(); pts.forEach(([px, py]) => g.lineTo(px, py)); g.closePath(); g.clip();
      if (height) { g.fillStyle = '#fff'; g.fill(); }
      else {
        const [r0, gf, bf] = tones[k * rows + ((j % rows) + rows) % rows]; g.fillStyle = `rgb(${r0},${r0 * gf},${r0 * bf})`; g.fill();
        for (let l = 0; l < 26; l++) { const off = rnd() * ph * 1.4 - ph * 0.2; g.strokeStyle = rnd() > .4 ? `rgba(100,62,30,${0.05 + rnd() * 0.12})` : `rgba(245,210,165,${0.05 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd() * 1.8; g.beginPath(); if (even) { g.moveTo(x0, y + off); g.lineTo(x0 + c, y - c + off + (rnd() - .5) * 6); } else { g.moveTo(x0, y - c + off); g.lineTo(x0 + c, y + off + (rnd() - .5) * 6); } g.stroke(); }
      }
      g.restore();
      g.strokeStyle = height ? '#000' : 'rgba(60,38,20,.55)'; g.lineWidth = 2.5; g.beginPath(); pts.forEach(([px, py]) => g.lineTo(px, py)); g.closePath(); g.stroke();
    }
  };
  make('herringbone', 1024, 1024, (g, w, h, r) => herring(g, w, h, r, false), (g, w, h, r) => herring(g, w, h, r, true), 71);

  /* ── Microcemento (2 m) ── */
  make('microcement', 1024, 1024, (g, w, h, rnd) => {
    g.fillStyle = '#BEB9B1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h, r = 50 + rnd() * 220, light = rnd() > .5; const a = 0.05 + rnd() * 0.08; wrap9(w, h, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, light ? `rgba(235,230,222,${a})` : `rgba(120,112,102,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); }); }
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(250,248,244,${rnd() * 0.05})`; g.lineWidth = 8 + rnd() * 20; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.arc(x, y, 60 + rnd() * 120, rnd() * 6, rnd() * 6 + 1.2); g.stroke(); }
    noise(g, w, h, rnd, 12000, ['rgba(90,85,80,A)', 'rgba(255,255,255,A)'], 1.5);
  }, null, 81);

  /* ── Hidráulico 20×20 (0,40 m) ── */
  const hydraulic = (g, w, h, rnd, height) => {
    const s = w / 2, cream = '#ECE4D4', blue = '#40596A', terra = '#B4603F';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = i * s, y = j * s;
      if (height) { g.fillStyle = '#fff'; g.fillRect(x, y, s, s); continue; }
      g.fillStyle = cream; g.fillRect(x, y, s, s);
      g.fillStyle = blue; [[0, 0], [s, 0], [0, s], [s, s]].forEach(([cx, cy]) => { g.beginPath(); g.moveTo(x + cx, y + cy); g.arc(x + cx, y + cy, s * 0.36, 0, 7); g.fill(); });
      g.fillStyle = cream; [[0, 0], [s, 0], [0, s], [s, s]].forEach(([cx, cy]) => { g.beginPath(); g.arc(x + cx, y + cy, s * 0.22, 0, 7); g.fill(); });
      g.fillStyle = terra; [[0, 0], [s, 0], [0, s], [s, s]].forEach(([cx, cy]) => { g.beginPath(); g.arc(x + cx, y + cy, s * 0.12, 0, 7); g.fill(); });
      g.save(); g.translate(x + s / 2, y + s / 2); g.rotate(Math.PI / 4); g.fillStyle = terra; g.fillRect(-s * 0.15, -s * 0.15, s * 0.3, s * 0.3); g.fillStyle = cream; g.fillRect(-s * 0.07, -s * 0.07, s * 0.14, s * 0.14); g.restore();
      g.strokeStyle = blue; g.lineWidth = 3; g.strokeRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88);
      for (let k = 0; k < 1200; k++) { g.fillStyle = `rgba(90,70,50,${rnd() * 0.06})`; g.fillRect(x + rnd() * s, y + rnd() * s, 2, 2); }
    }
    g.strokeStyle = height ? '#000' : '#cfc6b4'; g.lineWidth = 4;
    for (let k = 0; k <= 2; k++) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, h); g.stroke(); g.beginPath(); g.moveTo(0, k * s); g.lineTo(w, k * s); g.stroke(); }
  };
  make('hydraulic', 1024, 1024, (g, w, h, r) => hydraulic(g, w, h, r, false), (g, w, h, r) => hydraulic(g, w, h, r, true), 91);

  /* ── Otros ── */
  make('patio', 512, 512, (g, w, h, rnd) => {
    const s = w / 2; g.fillStyle = '#9c8f82'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const r = 190 + rnd() * 16; g.fillStyle = `rgb(${r},${r * 0.7},${r * 0.56})`; g.fillRect(i * s + 4, j * s + 4, s - 8, s - 8); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(80,40,20,${rnd() * .08})`; g.fillRect(i * s + rnd() * s, j * s + rnd() * s, 3, 3); } }
  }, null, 101);
  make('hob', 512, 460, (g, w, h) => {
    g.fillStyle = '#0d0e10'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,.35)'; g.lineWidth = 3;
    [[140, 120, 95], [370, 130, 70], [140, 330, 70], [370, 320, 95]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, r * .55, 0, 7); g.stroke(); });
    g.fillStyle = 'rgba(210,215,220,.55)'; for (let i = 0; i < 7; i++) g.fillRect(150 + i * 32, h - 26, 14, 3);
  }, null, 111);
  make('steel', 512, 512, (g, w, h, rnd) => {
    g.fillStyle = '#c3c6c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) { const v = rnd() > .5 ? 255 : 110; g.fillStyle = `rgba(${v},${v},${v},${rnd() * .05})`; g.fillRect(0, rnd() * h, w, 1); }
  }, null, 121);

  return { tex: out, thumbs, warmUp };
}
