/*
 * Prueba rápida: abre la web en Chromium sin ventana y comprueba que
 *  - carga sin errores de JavaScript,
 *  - la escena 3D se dibuja (el lienzo no sale vacío),
 *  - todas las distribuciones, posiciones de nevera y estilos funcionan,
 *  - el panel muestra electrodomésticos y comprobaciones.
 *
 * Uso: con la web servida en BASE_URL (por defecto http://localhost:8000/)
 *   node tests/smoke.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000/';
const THREE_LOCAL = process.env.THREE_LOCAL; // opcional: carpeta con three@0.165.0 para probar sin internet

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(`console: ${m.text()}`); });
if (THREE_LOCAL) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.165\.0\/(.*)/, r => {
    const file = r.request().url().match(/three@0\.165\.0\/(.*)$/)[1];
    r.fulfill({ path: `${THREE_LOCAL}/${file}`, contentType: 'application/javascript' });
  });
}
// Las fuentes no afectan a la prueba: se sirven vacías para no depender de la red
await page.route(/fonts\.(googleapis|gstatic)/, r => r.fulfill({ body: '', contentType: 'text/css' }));

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? '✔' : '✘'} ${what}`); if (!ok) failed++; };

await page.addInitScript(() => { window.__kitchenPaused = true; });   // los fotogramas se dibujan a mano
await page.goto(BASE_URL);
await page.waitForFunction(() => window.__kitchen, null, { timeout: 90_000 });

// Dibuja un fotograma y mide el lienzo: brillo medio y variación (una imagen vacía no varía)
const renderStats = () => page.evaluate(() => {
  const k = window.__kitchen; k.frame(); k.frame();
  const src = document.querySelector('#stage canvas'), c = document.createElement('canvas');
  c.width = 64; c.height = 48; const g = c.getContext('2d'); g.drawImage(src, 0, 0, 64, 48);
  const d = g.getImageData(0, 0, 64, 48).data; let sum = 0, sq = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; sq += v * v; }
  const mean = sum / n; return { mean, std: Math.sqrt(sq / n - mean * mean) };
});

const cases = [
  { layout: 'A', fridge: 'hueco' }, { layout: 'B', fridge: 'hueco' },
  { layout: 'C', fridge: 'hueco' }, { layout: 'C', fridge: 'pared' },
];
for (const c of cases) {
  await page.evaluate(c => { const k = window.__kitchen; k.state.layout = c.layout; k.state.fridgePos = c.fridge; k.state.hq = false; k.setQuality(); k.applyAll(); k.goView('iso', true); }, c);
  const s = await renderStats();
  check(s.std > 8, `Distribución ${c.layout} · nevera ${c.fridge}: la escena se dibuja (variación ${s.std.toFixed(1)})`);
  const panel = await page.evaluate(() => ({ apps: document.querySelectorAll('#apps .row').length, checks: document.querySelectorAll('#checks .check').length }));
  check(panel.apps >= 5 && panel.checks >= 5, `Distribución ${c.layout}: panel con ${panel.apps} electrodomésticos y ${panel.checks} comprobaciones`);
}

const presets = await page.$$eval('[data-preset]', els => els.map(e => e.dataset.preset));
for (const id of presets) {
  await page.click(`[data-preset="${id}"]`);
  const s = await renderStats();
  check(s.std > 8, `Estilo ${id}`);
}

await page.evaluate(() => { window.__kitchenSaveWidth = 900; });
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }).catch(() => null), page.click('#save-img')]);
check(!!download && /\.png$/.test(download.suggestedFilename()), `Guardar imagen (${download ? download.suggestedFilename() : 'sin descarga'})`);

await page.evaluate(() => { const k = window.__kitchen; k.state.night = true; k.state.hq = true; k.setQuality(); k.applyAll(); k.goView('entrada', true); });
const night = await renderStats();
check(night.std > 3, 'Noche en calidad alta (oclusión ambiental y bloom)');

// Mis medidas: una cocina rectangular más pequeña, con la puerta en medio
await page.evaluate(() => { const k = window.__kitchen; k.state.night = false; k.state.hq = false; k.setQuality(); k.applyAll(); document.getElementById('measures').open = true; });
for (const [k, v] of [['W', 360], ['D', 300], ['NX', 360], ['doorX', 120]]) await page.fill(`#m-${k}`, String(v));
await page.click('#m-apply');
const custom = await page.evaluate(() => ({ g: window.__kitchen.room(), hash: location.hash, svg: document.querySelectorAll('#room-svg line').length }));
check(Math.abs(custom.g.W - 3.6) < 1e-6 && Math.abs(custom.g.D - 3.0) < 1e-6 && !custom.g.hasNotch, 'Mis medidas: cocina rectangular de 3,60 × 3,00');
check(/\.m360-300-360-/.test(custom.hash), `Las medidas viajan en el enlace (${custom.hash})`);
check(custom.svg >= 4, 'El plano de «Mis medidas» se dibuja');
for (const layout of ['A', 'B', 'C']) {
  await page.evaluate(l => { const k = window.__kitchen; k.state.layout = l; k.buildLayout(); k.goView('iso', true); }, layout);
  const s = await renderStats();
  const n = await page.evaluate(() => document.querySelectorAll('#checks .check').length);
  check(s.std > 8 && n >= 5, `Medidas propias · distribución ${layout}: se dibuja y hay ${n} comprobaciones`);
}
// Cotas de los electrodomésticos a la vista y modelos de partida en el panel
await page.evaluate(() => { const k = window.__kitchen; k.state.layout = 'C'; k.state.fridgePos = 'pared'; k.applyAll(); k.goView('iso', true); k.frame(); });
const adims = await page.evaluate(() => ({ n: [...document.querySelectorAll('.dim.ap')].filter(e => e.style.display !== 'none').length, apps: document.getElementById('apps').textContent, checks: [...document.querySelectorAll('#checks .check .t')].map(e => e.textContent) }));
check(adims.n >= 8, `Cotas de electrodomésticos visibles (${adims.n} etiquetas)`);
check(['LG F4WR5509A0W', 'Zanussi ZDH8373W', 'Whirlpool WFC 3C33 PF'].every(m => adims.apps.includes(m)), 'El panel nombra la lavadora, la secadora y el lavavajillas');
check(adims.apps.includes('60 × 59 × 85') && adims.checks.includes('Lavavajillas bajo encimera'), 'Lavavajillas de libre instalación: medidas y aviso de la tapa');
await page.click('#t-adims');
await page.evaluate(() => window.__kitchen.frame());
const hidden = await page.evaluate(() => [...document.querySelectorAll('.dim.ap')].filter(e => e.style.display !== 'none').length);
check(hidden === 0, 'El botón oculta las cotas de electrodomésticos');
await page.click('#t-adims');

// Electrodomésticos: nevera más estrecha y una lavadora demasiado alta para ir bajo encimera
await page.evaluate(() => { const k = window.__kitchen; k.state.layout = 'C'; });
for (const [k, v] of [['fridgeW', 84], ['fridgeD', 70.5], ['washerH', 90]]) await page.fill(`#m-${k}`, String(v));
await page.click('#m-apply');
const ap = await page.evaluate(() => ({ appl: window.__kitchen.state.appl, hash: location.hash, checks: [...document.querySelectorAll('#checks .check .t')].map(e => e.textContent), apps: document.getElementById('apps').textContent }));
check(Math.abs(ap.appl.fridgeW - 0.84) < 1e-6 && Math.abs(ap.appl.fridgeD - 0.705) < 1e-6, 'Medidas de la nevera aplicadas (84 × 70,5)');
check(ap.apps.includes('84 × 70,5 × 179'), 'El panel muestra las nuevas medidas de la nevera');
check(ap.checks.includes('Altura bajo encimera'), 'Aviso si la lavadora no entra bajo la encimera');
check(/\.a840-705-/.test(ap.hash), `Las medidas de los electrodomésticos van en el enlace (${ap.hash})`);
{ const s = await renderStats(); check(s.std > 8, 'La escena se dibuja con los electrodomésticos cambiados'); }
await page.click('#m-reset');
const back = await page.evaluate(() => ({ W: window.__kitchen.room().W, hash: location.hash }));
check(Math.abs(back.W - 4.78) < 1e-6 && !/\.[ma]\d/.test(back.hash), 'Volver a las medidas originales');

const hash = await page.evaluate(() => location.hash);
check(/^#[ABC]\.(pared|hueco)\.[0-3]{6}$/.test(hash), `Enlace compartible con el diseño (${hash})`);

check(errors.length === 0, `Sin errores en la consola${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
await browser.close();
if (failed) { console.error(`\n${failed} comprobación(es) fallida(s)`); process.exit(1); }
console.log('\nTodo correcto');
