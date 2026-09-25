import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { DEFAULT_ROOM, ROOM_LIMITS, T, WATER, BOILER, DEFAULT_APPLIANCES, APPLIANCE_LIMITS, FRIDGE_BACK, UNDER_COUNTER, CATALOG, PRESETS, DEFAULT_DESIGN } from './config.js';
import { createTextures } from './textures.js';
import { panelInfo } from './info.js';

const FR = { w: DEFAULT_APPLIANCES.fridgeW, d: DEFAULT_APPLIANCES.fridgeD, h: DEFAULT_APPLIANCES.fridgeH, back: FRIDGE_BACK };
const fmt = (v, d = 2) => v.toFixed(d).replace('.', ',');
const cm = v => Math.round(v * 100);
// centímetros con un decimal solo si hace falta: 0.597 → "59,7", 0.85 → "85"
const c1 = v => { const x = Math.round(v * 1000) / 10; return (Number.isInteger(x) ? String(x) : x.toFixed(1)).replace('.', ','); };
const dimsTxt = (w, d, h) => `${c1(w)} × ${c1(d)} × ${c1(h)}`;

/* ───────── Renderer ───────── */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.prepend(renderer.domElement);
RectAreaLightUniformsLib.init();
const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 120);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.4; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.8;

/* ───────── Postproceso (calidad alta): oclusión ambiental + bloom nocturno ───────── */
const HQ_DEFAULT = !matchMedia('(pointer: coarse)').matches && window.innerWidth > 860;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const gtao = new GTAOPass(scene, camera, 1, 1);
gtao.blendIntensity = 1.0;
gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.25, 0.4, 0.96);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new OutputPass());
// La oclusión ambiental ignora líneas y objetos transparentes (cristales, zona de tomas)
gtao.overrideVisibility = function () {
  const cache = this._visibilityCache;
  this.scene.traverse(o => { cache.set(o, o.visible); if (o.isPoints || o.isLine || (o.isMesh && o.material.transparent)) o.visible = false; });
};

/* ───────── Utilidades ───────── */
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function rep(tex, u, v, rot = 0) { const t = tex.clone(); t.repeat.set(u, v); t.rotation = rot; t.center.set(.5, .5); t.needsUpdate = true; return t; }
const std = (c, r = 0.6, m = 0, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...x });

function B(parent, x0, x1, y0, y1, z0, z1, mat, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  parent.add(m); return m;
}
function RB(parent, x0, x1, y0, y1, z0, z1, mat, r = 0.012) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 3, r), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(parent, r, h, mat, x, y, z, seg = 24, rt) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt ?? r, r, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function place(obj, x, z, rotY = 0, y = 0) { obj.position.set(x, y, z); obj.rotation.y = rotY; return obj; }
// Libera las etiquetas HTML y la memoria de GPU de un grupo que se va a sustituir
function disposeGroup(g) {
  g.traverse(o => {
    if (o.isCSS2DObject) o.element.remove();
    if (o.geometry) o.geometry.dispose();
  });
  g.removeFromParent();
}

/* ───────── Texturas procedurales (js/textures.js) ───────── */
const { tex: TX, thumbs: THUMBS, warmUp } = createTextures(THREE, renderer);

/* ───────── Materiales comunes ───────── */
const M = {
  wall: std('#EFEBE4', 0.9),
  shadowOnly: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  floor: std('#ffffff', 0.38),
  skirting: std('#F4F2EE', 0.5),
  steel: std('#dfe2e4', 0.28, 0.6, { map: TX.steel.map }),
  steelDark: std('#a9adb0', 0.4, 0.55),
  blackGlass: new THREE.MeshPhysicalMaterial({ color: '#08090a', roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
  hob: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0.1, map: TX.hob.map, clearcoat: 1, clearcoatRoughness: 0.05 }),
  white: std('#F5F5F3', 0.35, 0.0),
  applPlastic: std('#e9eaea', 0.4),
  chrome: std('#e6e8ea', 0.12, 1.0),
  dark: std('#1c1f21', 0.6),
  carcass: std('#dcd9d3', 0.8),
  ceiling: std('#F4F2EE', 0.95),
  glass: new THREE.MeshPhysicalMaterial({ color: '#dfeef0', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false }),
  portGlass: new THREE.MeshPhysicalMaterial({ color: '#223038', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.72 }),
  alu: std('#3a3e41', 0.45, 0.6),
  doorLeaf: std('#F7F6F2', 0.45),
  patio: std('#ffffff', 0.85, 0, { map: rep(TX.patio.map, 1 / 0.66, 1 / 0.66) }),
  ground: std('#c9ccc7', 0.95),
  patioWall: std('#F1ECE3', 0.95),
  terracotta: std('#B5643E', 0.8),
  leaf: std('#4E6B3A', 0.8),
  orange: std('#F08A1C', 0.5),
  led: new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffe2b0', emissiveIntensity: 0 }),
  display: new THREE.MeshStandardMaterial({ color: '#0b0f12', emissive: '#7fd4ff', emissiveIntensity: 0.6 }),
  board: std('#b98b5a', 0.6),
  ceramic: std('#f0ede7', 0.25),
  water: new THREE.MeshBasicMaterial({ color: '#3aa0e0', transparent: true, opacity: 0.1, depthWrite: false }),
  waterLine: new THREE.LineBasicMaterial({ color: '#2b8fd6' }),
  dimLine: new THREE.LineBasicMaterial({ color: '#b8893f', toneMapped: false }),
};

/* ───────── Estado ───────── */
const state = {
  layout: DEFAULT_DESIGN.layout, fridgePos: DEFAULT_DESIGN.fridgePos, fin: { ...DEFAULT_DESIGN.fin }, room: { ...DEFAULT_ROOM }, appl: { ...DEFAULT_APPLIANCES },
  water: true, night: false, open: false, dims: true, tags: window.innerWidth > 860, rot: false, hq: HQ_DEFAULT,
};

/* ───────── Acabados (catálogo en js/config.js) ───────── */
const opt = cat => CATALOG[cat].options.find(o => o.id === state.fin[cat]) || CATALOG[cat].options[0];
const texAspect = t => t.canvas.height / t.canvas.width;
function frontMat(which) {
  const o = opt(which === 'low' ? 'bajos' : 'altos');
  if (o.type === 'wood') return new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, map: rep(TX.oak.map, 0.7, 0.7, Math.PI / 2), bumpMap: rep(TX.oak.bump, 0.7, 0.7, Math.PI / 2), bumpScale: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5 });
  return new THREE.MeshPhysicalMaterial({ color: o.color, roughness: 0.42, clearcoat: 0.22, clearcoatRoughness: 0.35 });
}
function plinthMat() {
  const o = opt('bajos');
  return std(o.type === 'wood' ? '#6f5236' : new THREE.Color(o.color).multiplyScalar(0.8), 0.6);
}
function slabMat(o, w, d, alongZ = false) {
  const t = TX[o.tex], s = o.size ?? 1, u = w / s, v = d / (s * texAspect(t));
  const r = (tx) => alongZ ? rep(tx, v, u, Math.PI / 2) : rep(tx, u, v);
  return new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: r(t.map), roughness: o.roughness, clearcoat: o.clearcoat ?? 0, clearcoatRoughness: 0.2, ...(t.bump ? { bumpMap: r(t.bump), bumpScale: 0.4 } : {}) });
}
const surfMat = (w, d, alongZ = false) => slabMat(opt('encimera'), w, d, alongZ);
function splashMat(len, hgt) {
  const o = opt('frente');
  if (o.tex === 'worktop') return slabMat(opt('encimera'), len, hgt);
  const t = TX[o.tex];
  return new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: rep(t.map, len / o.size, hgt / o.size), bumpMap: rep(t.bump, len / o.size, hgt / o.size), bumpScale: 1.5, roughness: o.roughness, clearcoat: 0.6, clearcoatRoughness: 0.12 });
}
function applyRoomFinishes() {
  const f = opt('suelo'), t = TX[f.tex];
  M.floor.map = rep(t.map, 1 / f.size, 1 / f.size);
  M.floor.bumpMap = t.bump ? rep(t.bump, 1 / f.size, 1 / f.size) : null; M.floor.bumpScale = 1.2;
  M.floor.roughness = f.roughness; M.floor.needsUpdate = true;
  M.wall.color.set(opt('pared').color);
}

/* ───────── Geometría de la estancia (se recalcula al cambiar las medidas) ───────── */
let G = {};
function computeRoom(r) {
  const W = r.W, D = r.D, NX = Math.min(r.NX, W), notch = Math.min(r.notch, D - 1.0), NZ = D - notch, H = r.H;
  const hasNotch = NX < W - 0.01;
  const DOOR0 = r.doorX, DOOR1 = r.doorX + r.doorW;
  const rightLen = hasNotch ? NZ : D;                        // largo del muro del patio
  const WIN0 = 0.10, SILL = 0.95, WINH = Math.min(2.15, H - 0.25);
  const hasFix = r.fixW >= 0.2;
  const WSPLIT = hasFix ? WIN0 + r.fixW : WIN0;
  const PD0 = Math.max(0.66, hasFix ? WSPLIT + 0.05 : 0.66);   // la puerta del patio empieza detrás de la encimera
  const PD1 = Math.min(PD0 + r.patioW, rightLen - 0.08);
  const hasPatio = PD1 - PD0 >= 0.55;
  // Nevera en el hueco del quiebro (o pegada a la pared de la puerta si no hay quiebro suficiente)
  const FRX1 = NX - FR.back, FRX0 = FRX1 - FR.d;
  const FRZ0 = notch >= FR.w + 0.02 ? NZ + (notch - FR.w) / 2 : D - 0.02 - FR.w;
  return {
    W, D, NX, NZ, H, notch, hasNotch, rightLen, DOOR0, DOOR1, DOORH: 2.03, doorW: r.doorW,
    WIN0, SILL, WINH, hasFix, WSPLIT, PD0, PD1, hasPatio, FRX0, FRX1, FRZ0,
    area: hasNotch ? W * NZ + NX * notch : W * D,
    waterFrom: W * WATER.from,
    s: Math.max(W / 4.78, D / 2.64, 1),
  };
}
// Corrige medidas imposibles y devuelve avisos para el formulario
function sanitizeRoom(r) {
  const L = ROOM_LIMITS, out = { ...r }, notes = [];
  const clamp = (k, lo, hi, why) => { const v = Math.min(Math.max(out[k], lo), hi); if (Math.abs(v - out[k]) > 0.004) { notes.push(why); out[k] = v; } };
  for (const k of Object.keys(L)) clamp(k, L[k][0], L[k][1], `Ajustado al rango permitido: ${k}`);
  clamp('NX', L.NX[0], out.W, 'La pared de la puerta no puede ser más larga que la pared larga.');
  clamp('notch', L.notch[0], out.D - 1.0, 'El quiebro deja muy poco fondo junto al patio: lo he limitado.');
  clamp('doorX', 0.05, Math.max(0.05, out.NX - out.doorW - 0.05), 'La puerta de entrada se salía de su pared: la he movido.');
  const rightLen = out.NX < out.W - 0.01 ? out.D - out.notch : out.D;
  clamp('fixW', 0, Math.max(0, rightLen - 0.10 - 0.05 - 0.60 - 0.08), 'La ventana fija no cabía junto a la puerta del patio: la he estrechado.');
  if (out.fixW > 0 && out.fixW < 0.2) { out.fixW = 0; }
  return { room: out, notes: notes.filter(n => !n.startsWith('Ajustado')) };
}

/* ───────── Luces fijas ───────── */
const hemi = new THREE.HemisphereLight('#f3f6f8', '#b9ab98', 0.35); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d8', 3.4);
sun.castShadow = true; sun.shadow.mapSize.set(state.hq ? 4096 : 2048, state.hq ? 4096 : 2048);
sun.shadow.camera.layers.enable(1);   // las paredes proyectan sombra aunque estén cortadas en la maqueta
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
let nightLights = new THREE.Group(), skyLights = new THREE.Group();
const ledLights = new THREE.Group(); scene.add(ledLights);

/* ───────── Estancia ───────── */
const walls = [];
let roomGroup = null, roomAnim = [], dims = null, ceiling = null, water = null;

function buildRoom() {
  if (roomGroup) disposeGroup(roomGroup);
  roomGroup = new THREE.Group(); scene.add(roomGroup);
  walls.length = 0; roomAnim = [];
  const { W, D, NX, NZ, H, hasNotch, rightLen } = G;

  // Sol y sombras a escala de la cocina
  sun.position.set(W + 5.2, 4.3, -1.6); sun.target.position.set(W * 0.46, 0, D * 0.45);
  const half = Math.max(W, D) + 1.5;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: 30 });
  sun.shadow.camera.updateProjectionMatrix();

  // Copias invisibles (capa 1) que solo ve la cámara de sombras: así la luz sigue entrando solo por la ventana
  const proxies = new THREE.Group(); roomGroup.add(proxies);
  const shadowProxy = b => { const m = B(proxies, ...b, M.shadowOnly, { receive: false }); m.layers.set(1); };
  const valid = b => b[1] - b[0] > 1e-4 && b[3] - b[2] > 1e-4 && b[5] - b[4] > 1e-4;
  const wall = (n, p, boxes, fixed = false) => {
    const g = new THREE.Group();
    boxes.filter(valid).forEach(b => { const m = B(g, ...b, M.wall); m.castShadow = false; shadowProxy(b); });
    roomGroup.add(g); walls.push({ g, n: new THREE.Vector3(...n), p: new THREE.Vector3(...p), fixed }); return g;
  };
  wall([0, 0, 1], [0, 0, 0], [[-T, W + T, 0, H, -T, 0]]);                                                   // pared larga
  wall([1, 0, 0], [0, 0, 0], [[-T, 0, 0, H, 0, D + T]]);                                                    // izquierda
  const wDoor = wall([0, 0, -1], [0, 0, D], [[0, G.DOOR0, 0, H, D, D + T], [G.DOOR1, NX + T, 0, H, D, D + T], [G.DOOR0, G.DOOR1, G.DOORH, H, D, D + T]]);
  if (hasNotch) {
    wall([-1, 0, 0], [NX, 0, 0], [[NX, NX + T, 0, H, NZ, D + T]]);                                       // quiebro
    wall([0, 0, -1], [0, 0, NZ], [[NX, W + T, 0, H, NZ, NZ + T]]);
  }
  // Muro del patio: ventana fija sobre la encimera + puerta al patio
  const rEnd = rightLen + T, rb = [];
  const firstOpen = G.hasFix ? G.WIN0 : (G.hasPatio ? G.PD0 : rEnd);
  rb.push([W, W + T, 0, H, -T, firstOpen]);
  if (G.hasFix) rb.push([W, W + T, 0, G.SILL, G.WIN0, G.WSPLIT], [W, W + T, G.WINH, H, G.WIN0, G.WSPLIT]);
  if (G.hasPatio) {
    const fixEnd = G.hasFix ? G.WSPLIT : G.PD0;
    if (G.PD0 > fixEnd) rb.push([W, W + T, 0, H, fixEnd, G.PD0]);
    rb.push([W, W + T, G.WINH, H, G.PD0, G.PD1], [W, W + T, 0, H, G.PD1, rEnd]);
  } else if (G.hasFix) rb.push([W, W + T, 0, H, G.WSPLIT, rEnd]);
  wall([-1, 0, 0], [W, 0, 0], rb, true);

  // Techo: sombra siempre; visible solo con la cámara dentro
  const ceilBoxes = hasNotch ? [[0, W, 0, NZ], [0, NX, NZ, D]] : [[0, W, 0, D]];
  ceilBoxes.forEach(([x0, x1, z0, z1]) => shadowProxy([x0 - T, x1 + T, H, H + 0.05, z0 - T, z1 + T]));
  ceiling = new THREE.Group(); roomGroup.add(ceiling);
  ceilBoxes.forEach(([x0, x1, z0, z1]) => B(ceiling, x0, x1, H, H + 0.02, z0, z1, M.ceiling, { cast: false, receive: false }));

  // Suelo
  const pts = hasNotch ? [[0, 0], [W, 0], [W, -NZ], [NX, -NZ], [NX, -D], [0, -D]] : [[0, 0], [W, 0], [W, -D], [0, -D]];
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; roomGroup.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.012, D / 2); ground.receiveShadow = true; roomGroup.add(ground);

  // Rodapié
  const sk = a => B(roomGroup, ...a, M.skirting);
  sk([0, W, 0, 0.07, 0, 0.012]); sk([0, 0.012, 0, 0.07, 0, D]);
  if (G.DOOR0 > 0.12) sk([0, G.DOOR0 - 0.06, 0, 0.07, D - 0.012, D]);
  sk([G.DOOR1 + 0.06, NX, 0, 0.07, D - 0.012, D]);
  if (hasNotch) { sk([NX - 0.012, NX, 0, 0.07, NZ, D]); sk([NX, W, 0, 0.07, NZ - 0.012, NZ]); }

  // Puerta de entrada
  const trim = a => B(wDoor, ...a, M.doorLeaf);
  trim([G.DOOR0 - 0.06, G.DOOR0, 0, G.DOORH + 0.06, D - 0.015, D]); trim([G.DOOR1, G.DOOR1 + 0.06, 0, G.DOORH + 0.06, D - 0.015, D]);
  trim([G.DOOR0 - 0.06, G.DOOR1 + 0.06, G.DOORH, G.DOORH + 0.06, D - 0.015, D]);
  const doorPivot = new THREE.Group(); doorPivot.position.set(G.DOOR0 + 0.01, 0, D + 0.005); wDoor.add(doorPivot);
  const leafW = G.doorW - 0.02;
  B(doorPivot, 0, leafW, 0.005, G.DOORH - 0.005, 0, 0.04, M.doorLeaf);
  [-0.03, 0.07].forEach(z => B(doorPivot, leafW - 0.18, leafW - 0.08, 1.005, 1.035, z < 0 ? z - 0.01 : z, z < 0 ? z + 0.01 : z + 0.02, M.chrome));
  roomAnim.push({ obj: doorPivot.rotation, key: 'y', closed: 0, open: 1.5 });

  // Ventana fija y puerta del patio
  const win = new THREE.Group(); roomGroup.add(win);
  if (G.hasFix) {
    B(win, W, W + T, G.WINH - 0.05, G.WINH, G.WIN0, G.WSPLIT, M.alu);
    B(win, W, W + T, G.SILL, G.WINH, G.WIN0, G.WIN0 + 0.05, M.alu); B(win, W, W + T, G.SILL, G.WINH, G.WSPLIT - 0.05, G.WSPLIT, M.alu);
    B(win, W - 0.02, W + T, G.SILL - 0.03, G.SILL, G.WIN0, G.WSPLIT, M.alu);
    const gl = B(win, W + 0.045, W + 0.053, G.SILL, G.WINH - 0.05, G.WIN0 + 0.05, G.WSPLIT - 0.05, M.glass); gl.castShadow = false;
  }
  if (G.hasPatio) {
    B(win, W, W + T, G.WINH - 0.05, G.WINH, G.PD0, G.PD1, M.alu);
    B(win, W, W + T, 0, G.WINH, G.PD0, G.PD0 + 0.05, M.alu); B(win, W, W + T, 0, G.WINH, G.PD1 - 0.05, G.PD1, M.alu);
    B(win, W, W + T, 0, 0.02, G.PD0, G.PD1, M.alu);
    const patioDoor = new THREE.Group(); patioDoor.position.set(W + 0.07, 0, G.PD0 + 0.05); roomGroup.add(patioDoor);
    const lw = G.PD1 - 0.05 - (G.PD0 + 0.05);
    B(patioDoor, -0.06, 0, 0.02, G.WINH - 0.05, 0, 0.07, M.alu); B(patioDoor, -0.06, 0, 0.02, G.WINH - 0.05, lw - 0.07, lw, M.alu);
    B(patioDoor, -0.06, 0, 0.02, 0.14, 0, lw, M.alu); B(patioDoor, -0.06, 0, G.WINH - 0.12, G.WINH - 0.05, 0, lw, M.alu);
    const gl = B(patioDoor, -0.034, -0.026, 0.14, G.WINH - 0.12, 0.07, lw - 0.07, M.glass); gl.castShadow = false;
    B(patioDoor, -0.09, -0.06, 1.0, 1.02, lw - 0.16, lw - 0.05, M.chrome);
    roomAnim.push({ obj: patioDoor.rotation, key: 'y', closed: 0, open: -1.45 });
  }

  // Luz de cielo por la ventana y la puerta del patio
  skyLights = new THREE.Group(); roomGroup.add(skyLights);
  const skyRects = [];
  if (G.hasFix) skyRects.push([G.WIN0 + 0.05, G.WSPLIT - 0.05, G.SILL, G.WINH - 0.05]);
  if (G.hasPatio) skyRects.push([G.PD0 + 0.05, G.PD1 - 0.05, 0.02, G.WINH - 0.05]);
  skyRects.forEach(([z0, z1, y0, y1]) => {
    const l = new THREE.RectAreaLight('#e4eef7', 3.2, z1 - z0, y1 - y0);
    l.position.set(W - 0.005, (y0 + y1) / 2, (z0 + z1) / 2); l.lookAt(0, (y0 + y1) / 2, (z0 + z1) / 2); skyLights.add(l);
  });

  // Focos de techo (noche)
  nightLights = new THREE.Group(); roomGroup.add(nightLights);
  const spots = [];
  const zA = (hasNotch ? NZ : D) * 0.42;
  for (let i = 0; i < Math.max(2, Math.round(W / 1.3)); i++) spots.push([W * (i + 0.5) / Math.max(2, Math.round(W / 1.3)), zA]);
  if (hasNotch) for (let i = 0; i < Math.max(1, Math.round(NX / 1.5)); i++) spots.push([NX * (i + 0.5) / Math.max(1, Math.round(NX / 1.5)), (NZ + D) / 2]);
  else spots.push([W * 0.3, D * 0.78], [W * 0.7, D * 0.78]);
  spots.forEach(([x, z]) => {
    const p = new THREE.PointLight('#ffd9a8', 2.2, 6, 2); p.position.set(x, H - 0.08, z); nightLights.add(p);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), new THREE.MeshBasicMaterial({ color: '#fff4e0' }));
    disc.position.set(x, H - 0.005, z); nightLights.add(disc);
  });

  // Patio
  const patio = new THREE.Group(); roomGroup.add(patio);
  const pz0 = -2.2, pz1 = rightLen + 2.4, px0 = W + T, pw = 4.2;
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(pw, pz1 - pz0), M.patio); pf.rotation.x = -Math.PI / 2; pf.position.set(px0 + pw / 2, -0.004, (pz0 + pz1) / 2); pf.receiveShadow = true; patio.add(pf);
  B(patio, px0, px0 + pw, 0, 1.1, pz0, pz0 + 0.12, M.patioWall); B(patio, px0 + pw - 0.12, px0 + pw, 0, 1.1, pz0, pz1, M.patioWall);
  const naranjo = (x, z, s = 1) => {
    cyl(patio, 0.2 * s, 0.42 * s, M.terracotta, x, 0.21 * s, z, 24, 0.26 * s);
    cyl(patio, 0.035 * s, 0.8 * s, M.board, x, 0.8 * s, z, 10);
    const fol = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46 * s, 1), M.leaf); fol.position.set(x, 1.45 * s, z); fol.castShadow = true; patio.add(fol);
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, b = rnd() * 1.2 - .3; const o = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 12, 10), M.orange); o.position.set(x + Math.cos(a) * Math.cos(b) * 0.44 * s, 1.45 * s + Math.sin(b) * 0.4 * s, z + Math.sin(a) * Math.cos(b) * 0.44 * s); patio.add(o); }
  };
  seed = 5; naranjo(W + 1.5, -1.35); naranjo(W + 3.4, rightLen + 1.2, 1.15);
  { const x0 = W + 1.9, z0 = rightLen + 0.7;
    for (let i = 0; i < 6; i++) B(patio, x0, x0 + 1.0, 0.95, 0.955, z0 + i * 0.1, z0 + i * 0.1 + 0.006, M.chrome);
    [[0, 0], [1.0, 0], [0, 0.5], [1.0, 0.5]].forEach(([dx, dz]) => B(patio, x0 + dx - .008, x0 + dx + .008, 0, 0.95, z0 + dz - .008, z0 + dz + .008, M.chrome)); }

  // Zona de tomas de agua
  water = new THREE.Group(); roomGroup.add(water);
  { const x0 = G.waterFrom, x1 = W, geo = new THREE.BoxGeometry(x1 - x0, 0.95, 0.66);
    const fill = new THREE.Mesh(geo, M.water), edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), M.waterLine);
    [fill, edges].forEach(m => { m.position.set((x0 + x1) / 2, 0.475, 0.33); water.add(m); });
    const el = document.createElement('div'); el.className = 'tag water'; el.innerHTML = `<b>Tomas de agua y desagüe</b><span>desde ${fmt(x0)} m hasta el patio</span>`;
    const lab = new CSS2DObject(el); lab.position.set((x0 + x1) / 2 - 0.4, 0.1, 1.08); water.add(lab); water.userData.label = lab; }

  // Cotas de la planta
  dims = new THREE.Group(); roomGroup.add(dims);
  const y0 = 0.02, o = 0.32;
  dim(dims, [0, y0, -o], [W, y0, -o], fmt(W));
  dim(dims, [-o, y0, 0], [-o, y0, D], fmt(D));
  dim(dims, [0, y0, D + o], [NX, y0, D + o], fmt(NX));
  if (hasNotch) {
    dim(dims, [NX + o, y0, NZ], [NX + o, y0, D], fmt(G.notch));
    dim(dims, [NX, y0, NZ + o], [W, y0, NZ + o], fmt(W - NX));
  }
  dim(dims, [W + o, y0, 0], [W + o, y0, rightLen], fmt(rightLen));
  dim(dims, [G.DOOR0, y0, D + 0.12], [G.DOOR1, y0, D + 0.12], `puerta ${fmt(G.doorW)}`, true);
}

function dim(parent, a, b, text, inner = false) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const dir = Bv.clone().sub(A).normalize(); const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.07);
  const geo = new THREE.BufferGeometry().setFromPoints([A, Bv, A.clone().add(perp), A.clone().sub(perp), Bv.clone().add(perp), Bv.clone().sub(perp)]);
  parent.add(new THREE.LineSegments(geo, M.dimLine));
  const el = document.createElement('div'); el.className = 'dim' + (inner ? ' in' : ''); el.textContent = text;
  const lab = new CSS2DObject(el); lab.position.copy(A).add(Bv).multiplyScalar(0.5); parent.add(lab);
}

/* ───────── Nevera americana side-by-side (medidas en state.appl) ───────── */
let fridgeAnim = [];
const fridge = new THREE.Group(); scene.add(fridge);
function syncFR() { const a = state.appl; FR.w = a.fridgeW; FR.d = a.fridgeD; FR.h = a.fridgeH; }
function buildFridge() {
  if (fridge.userData.body) disposeGroup(fridge.userData.body);
  fridgeAnim = [];
  const g = new THREE.Group(), k = FR.h / 1.79;
  const bodyD = FR.d - 0.095, fzW = FR.w * 0.4655, fgW = FR.w - fzW - 0.003;
  RB(g, 0, FR.w, 0.03, FR.h, 0, bodyD, M.steelDark, 0.01);
  B(g, 0.02, FR.w - 0.02, 0, 0.09, bodyD - 0.02, bodyD + 0.005, M.dark);
  const inner = std('#f2f3f3', 0.4);
  B(g, 0.03, FR.w - 0.03, 0.12, FR.h - 0.04, bodyD - 0.02, bodyD + 0.001, inner, { cast: false });
  for (let i = 0; i < 4; i++) B(g, fzW + 0.015, FR.w - 0.03, (0.45 + i * 0.3) * k, (0.456 + i * 0.3) * k, bodyD - 0.5, bodyD, M.glass);
  B(g, fzW, fzW + 0.01, 0.12, FR.h - 0.04, bodyD - 0.55, bodyD + 0.001, inner);
  // Puertas con el pivote en la arista exterior delantera
  const mkDoor = (w, sign) => {
    const p = new THREE.Group(); const d = new THREE.Group(); p.add(d);
    const x0 = sign > 0 ? 0 : -w, x1 = sign > 0 ? w : 0;
    RB(d, x0, x1, 0.095, FR.h - 0.005, -0.095, 0, M.steel, 0.012);
    const hx = sign > 0 ? x1 - 0.035 : x0 + 0.02;
    B(d, hx, hx + 0.015, 0.55 * k, 1.5 * k, -0.004, 0.003, M.dark);
    return p;
  };
  const fz = mkDoor(fzW, 1); fz.position.set(0, 0, FR.d); g.add(fz);
  const fg = mkDoor(fgW, -1); fg.position.set(FR.w, 0, FR.d); g.add(fg);
  const dw = Math.min(0.26, fzW - 0.12);
  B(fz, 0.08, 0.08 + dw, 0.98 * k, 1.34 * k, -0.01, 0.004, M.blackGlass); B(fz, 0.08 + dw / 2 - 0.05, 0.08 + dw / 2 + 0.05, 1.28 * k, 1.31 * k, 0.004, 0.006, M.display);
  B(fz, 0.03, fzW - 0.025, 0.25, FR.h - 0.08, -0.12, -0.095, inner, { cast: false });
  B(fg, -fgW + 0.025, -0.03, 0.25, FR.h - 0.08, -0.12, -0.095, inner, { cast: false });
  const fgA = { obj: fg.rotation, key: 'y', closed: 0, open: 1.57 };
  fridgeAnim.push({ obj: fz.rotation, key: 'y', closed: 0, open: -1.9 }, fgA); fridge.userData.fgAnim = fgA;
  fridge.userData.body = g; fridge.add(g);
}

/* ───────── Módulos de cocina ───────── */
const Z_CAR = 0.56, Z_FR = 0.58, Y_PL = 0.14, Y_CT = 0.86, Y_TOP = 0.90, TOPY = 2.17;
function baseModule(g, x0, w, type, mats, animList) {
  const x1 = x0 + w, gap = 0.004;
  if (type === 'filler') { B(g, x0, x1, 0, Y_CT, 0, Z_FR, mats.low); return; }
  if (type !== 'dw') B(g, x0, x1, Y_PL, Y_CT, 0, Z_CAR, M.carcass);
  B(g, x0 + 0.002, x1 - 0.002, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
  if (type === 'dw') {
    B(g, x0 + 0.005, x1 - 0.005, Y_PL, Y_CT - 0.005, 0, Z_CAR, M.steel);
    B(g, x0 + 0.03, x1 - 0.03, 0.45, 0.46, 0.02, Z_CAR + 0.001, M.steelDark);
    const p = new THREE.Group(); p.position.set(x0, Y_PL, Z_FR); g.add(p);
    B(p, gap, w - gap, gap, 0.72 - gap, -0.02, 0, mats.low);
    B(p, 0.02, w - 0.02, 0.02, 0.70, -0.03, -0.02, M.steel, { cast: false });
    animList.push({ obj: p.rotation, key: 'x', closed: 0, open: 1.45 });
    return;
  }
  const heights = { drawers3: [0.18, 0.27, 0.27], drawers2: [0.36, 0.36], doors2: [0.72], door1: [0.72], blind: [0.72] }[type] || [0.72];
  let top = Y_CT;
  for (const h of heights) {
    const y1 = top - gap, y0 = top - h + gap;
    if (type === 'doors2') { B(g, x0 + gap, x0 + w / 2 - gap / 2, y0, y1, Z_CAR, Z_FR, mats.low); B(g, x0 + w / 2 + gap / 2, x1 - gap, y0, y1, Z_CAR, Z_FR, mats.low); }
    else B(g, x0 + gap, x1 - gap, y0, y1, Z_CAR, Z_FR, mats.low);
    top -= h;
  }
}
function wallModule(g, x0, w, type, mats) {
  const x1 = x0 + w, gap = 0.004, y0 = 1.45, y1 = TOPY;
  if (type === 'hood') {
    B(g, x0, x1, 1.62, y1, 0, 0.33, M.carcass); B(g, x0 + gap, x1 - gap, 1.62 + gap, y1 - gap, 0.33, 0.35, mats.high);
    B(g, x0 + 0.01, x1 - 0.01, 1.55, 1.62, 0, 0.35, M.steel); B(g, x0 + 0.03, x1 - 0.03, 1.548, 1.552, 0.05, 0.3, M.led);
    return;
  }
  B(g, x0, x1, y0, y1, 0, 0.33, M.carcass);
  if (type === 'doors2') { B(g, x0 + gap, x0 + w / 2 - gap / 2, y0 + gap, y1 - gap, 0.33, 0.35, mats.high); B(g, x0 + w / 2 + gap / 2, x1 - gap, y0 + gap, y1 - gap, 0.33, 0.35, mats.high); }
  else B(g, x0 + gap, x1 - gap, y0 + gap, y1 - gap, 0.33, 0.35, mats.high);
  B(g, x0 + 0.02, x1 - 0.02, y0 - 0.006, y0, 0.27, 0.29, M.led, { cast: false });
}
// Columna alta de 60 (u otro ancho): horno + microondas o despensa. Local: x 0..w, frente hacia +z
function tallUnit(kind, w, mats) {
  const t = new THREE.Group(), gap = 0.004;
  B(t, 0, w, Y_PL, TOPY, 0, Z_CAR, M.carcass); B(t, 0.002, w - 0.002, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
  if (kind === 'oven') {
    B(t, gap, w - gap, Y_PL + gap, 0.44, Z_CAR, Z_FR, mats.low);
    B(t, gap, w - gap, 0.446, 1.03, Z_CAR, Z_FR, M.blackGlass); B(t, 0.02, w - 0.02, 0.95, 1.02, Z_FR, Z_FR + 0.004, M.steel);
    B(t, 0.10, w - 0.10, 0.98, 1.0, Z_FR + 0.02, Z_FR + 0.035, M.chrome);
    B(t, gap, w - gap, 1.036, 1.43, Z_CAR, Z_FR, M.blackGlass); B(t, 0.02, w - 0.02, 1.036, 1.07, Z_FR, Z_FR + 0.004, M.steel);
    B(t, gap, w - gap, 1.436, TOPY - gap, Z_CAR, Z_FR, mats.high);
  } else {
    const split = w >= 0.6;
    [[Y_PL, 1.30, mats.low], [1.30, TOPY, mats.high]].forEach(([y0, y1, m]) => {
      if (split) { B(t, gap, w / 2 - gap / 2, y0 + gap, y1 - gap, Z_CAR, Z_FR, m); B(t, w / 2 + gap / 2, w - gap, y0 + gap, y1 - gap, Z_CAR, Z_FR, m); }
      else B(t, gap, w - gap, y0 + gap, y1 - gap, Z_CAR, Z_FR, m);
    });
  }
  return t;
}
function worktop(g, x0, x1, z0, z1, alongZ = false) { return B(g, x0, x1, Y_CT, Y_TOP, z0, z1, surfMat(x1 - x0, z1 - z0, alongZ)); }
function worktopRun(g, x0, x1, sinkX) {
  if (sinkX == null) return worktop(g, x0, x1, 0, 0.62);
  const a = sinkX - 0.27, b = sinkX + 0.27;
  worktop(g, x0, a, 0, 0.62); worktop(g, b, x1, 0, 0.62); worktop(g, a, b, 0, 0.11); worktop(g, a, b, 0.51, 0.62);
}
function backsplash(g, x0, x1, y0, y1, z, alongZ = false) {
  const mat = splashMat(x1 - x0, y1 - y0);
  const m = alongZ ? B(g, 0, 0.008, y0, y1, x0, x1, mat) : B(g, x0, x1, y0, y1, z, z + 0.008, mat);
  m.castShadow = false; return m;
}
function sink(g, xc, zc) {
  const x0 = xc - 0.27, x1 = xc + 0.27, z0 = zc - 0.2, z1 = zc + 0.2, yb = 0.69;
  B(g, x0, x1, yb, yb + 0.01, z0, z1, M.steel);
  B(g, x0, x0 + 0.008, yb, Y_TOP - 0.004, z0, z1, M.steel); B(g, x1 - 0.008, x1, yb, Y_TOP - 0.004, z0, z1, M.steel);
  B(g, x0, x1, yb, Y_TOP - 0.004, z0, z0 + 0.008, M.steel); B(g, x0, x1, yb, Y_TOP - 0.004, z1 - 0.008, z1, M.steel);
  cyl(g, 0.04, 0.004, M.dark, xc, yb + 0.012, zc);
  const tz = z0 - 0.06;
  cyl(g, 0.026, 0.03, M.chrome, xc, Y_TOP + 0.015, tz); cyl(g, 0.013, 0.34, M.chrome, xc, Y_TOP + 0.17, tz);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.013, 12, 32, Math.PI), M.chrome);
  arc.rotation.y = -Math.PI / 2; arc.position.set(xc, Y_TOP + 0.34, tz + 0.1); arc.castShadow = true; g.add(arc);
  cyl(g, 0.013, 0.06, M.chrome, xc, Y_TOP + 0.31, tz + 0.2);
  B(g, xc + 0.02, xc + 0.1, Y_TOP + 0.2, Y_TOP + 0.21, tz - 0.005, tz + 0.005, M.chrome);
}
function hob(g, xc, zc) { const h = state.appl.hobW / 2 - 0.005; B(g, xc - h, xc + h, Y_TOP, Y_TOP + 0.006, zc - 0.26, zc + 0.26, M.hob); }
// Lavadora / secadora 60 cm (frente local +z)
function washer(kind, animList) {
  const a = state.appl, g = new THREE.Group();
  const w = kind === 'dryer' ? a.dryerW : a.washerW, d = kind === 'dryer' ? a.dryerD : a.washerD, h = kind === 'dryer' ? a.dryerH : a.washerH;
  const ky = h / 0.85;
  RB(g, 0, w, 0, h, 0, d, M.white, 0.014);
  B(g, 0.02, w - 0.02, h - 0.12, h - 0.115, d - 0.001, d + 0.002, M.applPlastic);
  B(g, 0.03, Math.min(w * (kind === 'washer' ? 0.33 : 0.43), w - 0.3), h - 0.095, h - 0.02, d, d + 0.006, M.applPlastic);
  B(g, w * 0.5, w * 0.7, h - 0.075, h - 0.04, d, d + 0.004, M.display);
  const dial = cyl(g, 0.032, 0.02, M.chrome, w - 0.087, h - 0.06, d + 0.01); dial.rotation.x = Math.PI / 2;
  const cx = w / 2, R = Math.min(0.19, w / 2 - 0.08, (h - 0.2) / 2), cy = Math.min(0.42 * ky, h - 0.14 - R);
  const p = new THREE.Group(); p.position.set(cx - R, cy, d + 0.01); g.add(p);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.028, 16, 48), kind === 'dryer' ? M.applPlastic : M.chrome);
  ring.position.set(R, 0, 0.012); ring.castShadow = true; p.add(ring);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.035, R - 0.035, 0.02, 40), M.portGlass);
  glass.rotation.x = Math.PI / 2; glass.position.set(R, 0, 0.012); p.add(glass);
  B(g, cx - 0.14, cx + 0.14, cy - 0.14, cy + 0.14, d - 0.02, d - 0.001, M.steelDark, { cast: false });
  animList.push({ obj: p.rotation, key: 'y', closed: 0, open: -1.7 });
  return g;
}
function tag(parent, text, dimsTxt, x, y, z) {
  const el = document.createElement('div'); el.className = 'tag'; el.innerHTML = `<b>${text}</b><span>${dimsTxt}</span>`;
  const o = new CSS2DObject(el); o.position.set(x, y, z); o.userData.kind = 'tag'; parent.add(o); return o;
}
function fruitBowl(g, x, z) {
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 12, 0, 6.29, Math.PI / 2, Math.PI / 2), M.ceramic);
  bowl.rotation.x = Math.PI; bowl.position.set(x, Y_TOP + 0.1, z); bowl.castShadow = true; g.add(bowl);
  [[0, 0], [0.06, 0.03], [-0.05, 0.04], [0.01, -0.06], [-0.02, 0.01]].forEach(([dx, dz], i) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), M.orange); o.position.set(x + dx, Y_TOP + 0.05 + (i === 4 ? 0.06 : 0.02), z + dz); o.castShadow = true; g.add(o); });
}
function pot(g, x, z) {
  cyl(g, 0.11, 0.13, M.steel, x, Y_TOP + 0.075, z, 32); cyl(g, 0.115, 0.012, M.steel, x, Y_TOP + 0.145, z, 32);
  cyl(g, 0.015, 0.02, M.dark, x, Y_TOP + 0.16, z);
}
function board(g, x, z) { B(g, x - 0.2, x + 0.2, Y_TOP, Y_TOP + 0.02, z - 0.13, z + 0.13, M.board); }
function plant(g, x, z, y = 0, s = 1) {
  cyl(g, 0.13 * s, 0.32 * s, M.ceramic, x, y + 0.16 * s, z, 24, 0.15 * s);
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 10, 8), M.leaf); l.scale.set(0.6, 1.6, 0.6); l.position.set(x + (rnd() - .5) * 0.16 * s, y + (0.48 + rnd() * 0.18) * s, z + (rnd() - .5) * 0.16 * s); l.rotation.z = (rnd() - .5) * 0.7; l.castShadow = true; g.add(l); }
}

/* ───────── Reparto de módulos en un tramo ─────────
 * left: módulos que van pegados al inicio; right: pegados al final.
 * El hueco del medio se rellena con cajoneras y armarios de 60/45/40/30 y un panel de remate.
 * Si no cabe todo, se quitan primero los módulos con más prioridad de descarte (prio).
 */
const FLEX = [0.60, 0.45, 0.40, 0.30];
function packRun(a, b, left, right) {
  let L = [...left], Rt = [...right];
  const dropped = [];
  const total = () => [...L, ...Rt].reduce((s, i) => s + i.w, 0);
  while (total() > b - a + 1e-6) {
    const cand = [...L, ...Rt].filter(i => i.prio).sort((p, q) => q.prio - p.prio)[0];
    if (!cand) break;
    L = L.filter(i => i !== cand); Rt = Rt.filter(i => i !== cand); dropped.push(cand);
  }
  const items = [];
  let x = a;
  if (total() > b - a + 1e-6) {                     // ni lo imprescindible cabe: se coloca en orden hasta donde llegue
    for (const i of [...L, ...Rt]) { if (x + i.w <= b + 1e-6) { items.push({ ...i, x }); x += i.w; } else dropped.push(i); }
    if (b - x > 0.005) items.push({ w: b - x, type: 'filler', x });
    return { items, dropped };
  }
  for (const i of L) { items.push({ ...i, x }); x += i.w; }
  let xr = b; const rItems = [];
  for (let k = Rt.length - 1; k >= 0; k--) { xr -= Rt[k].w; rItems.unshift({ ...Rt[k], x: xr }); }
  let gap = xr - x;
  while (gap >= 0.30 - 1e-6) { const w = FLEX.find(f => f <= gap + 1e-6); items.push({ w, type: w >= 0.45 ? 'drawers3' : 'door1', x, flex: true }); x += w; gap -= w; }
  if (gap > 0.005) items.push({ w: gap, type: 'filler', x });
  return { items: items.concat(rItems), dropped };
}
// Dibuja un tramo de bajos (frente local +z) y devuelve centros útiles
function renderRun(g, items, mats, animList) {
  const out = {};
  for (const it of items) {
    const c = it.x + it.w / 2;
    if (it.type === 'washer' || it.type === 'dryer') {
      g.add(place(washer(it.type, animList), it.x + (it.w - (it.type === 'dryer' ? state.appl.dryerW : state.appl.washerW)) / 2, 0.02));
      B(g, it.x, it.x + it.w, Y_CT - 0.012, Y_CT, 0, 0.6, M.carcass, { cast: false });
    } else if (it.type === 'sink') baseModule(g, it.x, it.w, 'doors2', mats, animList);
    else if (it.type === 'hob') baseModule(g, it.x, it.w, 'drawers2', mats, animList);
    else baseModule(g, it.x, it.w, it.type, mats, animList);
    if (it.id) out[it.id] = { x: c, w: it.w, x0: it.x, x1: it.x + it.w };
  }
  return out;
}
// Altos sobre un tramo, alineados con los bajos; campana sobre la placa
function renderWallRun(g, items, wa, wb, mats, addLed) {
  let end = wa;
  for (const it of items) {
    const x0 = Math.max(it.x, wa), x1 = Math.min(it.x + it.w, wb), w = x1 - x0;
    if (w < 0.25 || it.tall) continue;
    const type = it.type === 'hob' ? 'hood' : (w >= 0.79 ? 'doors2' : 'door1');
    wallModule(g, x0, w, type, mats);
    if (type !== 'hood') addLed(g, (x0 + x1) / 2, 0.3, Math.min(0.5, w - 0.1));
    end = Math.max(end, x1);
  }
  return end;
}
const NAMES = { corner: 'Mueble de rincón', d1: 'Cajonera', sink: 'Fregadero', dw: 'Lavavajillas', washer: 'Lavadora', dryer: 'Secadora', hob: 'Placa y campana', spice: 'Especiero', oven: 'Torre de horno', pantry: 'Despensa', opp: 'Muebles de enfrente', laundryCol: 'Columna de lavado', cols: 'Columnas de la pared izquierda' };

/* ───────── Distribuciones ───────── */
let layoutGroup = null, layoutAnim = [], ldims = null, MET = {};
const fridgeMode = () => state.layout === 'C' && state.fridgePos === 'pared' && MET.wallFits !== false ? 'pared' : 'hueco';

function buildLayout() {
  if (layoutGroup) disposeGroup(layoutGroup);
  ledLights.clear();
  layoutGroup = new THREE.Group(); layoutAnim = []; seed = 11;
  const g = layoutGroup, mats = { low: frontMat('low'), high: frontMat('high'), plinth: plinthMat() };
  const { W, D, NX } = G;
  const L = state.layout;
  const met = { dropped: [], counter: 0, warnings: [] };
  const addLed = (parent, x, z, w = 0.5) => {
    const l = new THREE.RectAreaLight('#ffd9a6', 0, w, 0.03); l.position.set(x, 1.44, z); l.rotation.x = -Math.PI / 2;
    parent.updateMatrixWorld(); l.position.applyMatrix4(parent.matrixWorld);
    l.rotation.y = parent.rotation.y; ledLights.add(l);
  };
  const top = new THREE.Group(); g.add(top);
  ldims = new THREE.Group(); g.add(ldims);
  // Espacio libre en la pared izquierda antes del barrido de la puerta de entrada
  const leftFrom = 0.63;
  const leftTo = G.DOOR0 < 0.66 ? D - G.doorW - 0.005 : D - 0.02;   // la hoja abierta queda pegada a la pared izquierda
  met.leftTo = leftTo; met.doorNearLeft = G.DOOR0 < 0.66;
  const wantPared = L === 'C' && state.fridgePos === 'pared';

  // Pared de la puerta: sitio para el muro de armarios con la nevera (solo C empotrada)
  const twX0 = G.DOOR1 + 0.08, twX1 = NX - 0.02;
  const housingW = FR.w + 0.047;
  met.wallFits = wantPared ? (twX1 - twX0 >= 0.60 + housingW) : undefined; met.wallNeed = 0.60 + housingW;
  if (wantPared && !met.wallFits) met.warnings.push(['wallNoFit', twX1 - twX0]);
  MET = met;                                         // fridgeMode() lo necesita ya
  const mode = fridgeMode();

  // Pared larga
  let runA = 0, left = [], right = [];
  const I = (id, w, type, extra = {}) => ({ id, w, type, ...extra });
  const A = state.appl;
  const modW = w => Math.max(0.60, Math.ceil((w + 0.003) * 100) / 100);    // hueco de módulo para un aparato
  const wmW = modW(A.washerW), dmW = modW(A.dryerW), dwW = A.dwW, hbW = Math.max(0.60, Math.ceil(A.hobW * 100) / 100);
  if (L === 'A') {
    left = [I('corner', 0.60, 'blind'), I('d1', 0.60, 'drawers3'), I('sink', 0.80, 'sink'), I('dw', dwW, 'dw', { prio: 2 }), I('spice', 0.30, 'door1', { prio: 3 }), I('hob', hbW, 'hob')];
  } else if (L === 'B') {
    runA = 0.60;
    left = [I('d1', 0.60, 'drawers3', { prio: 4 }), I('sink', 0.80, 'sink'), I('dw', dwW, 'dw', { prio: 2 }), I('hob', hbW, 'hob'), I('spice', 0.30, 'door1', { prio: 3 })];
  } else {
    left = [I('corner', 0.80, mode === 'pared' ? 'drawers3' : 'blind', { prio: 5 }), I('hob', hbW, 'hob')];
    right = [I('sink', 0.90, 'sink'), I('dw', dwW, 'dw', { prio: 3 }), I('washer', wmW, 'washer', { prio: 2 }), I('dryer', dmW, 'dryer', { prio: 1 }), I('end', 0.08, 'filler')];
  }
  const run = packRun(runA, W, left, right);
  met.dropped.push(...run.dropped.map(d => d.id).filter(Boolean));
  const P = renderRun(top, run.items, mats, layoutAnim);
  met.sink = P.sink; met.hob = P.hob; met.run = P;
  worktopRun(top, runA, W, P.sink ? P.sink.x : null);
  backsplash(top, runA, W, Y_TOP, 1.45, 0);
  met.counter += W - runA;
  if (P.sink) sink(top, P.sink.x, 0.31);
  if (P.hob) { hob(top, P.hob.x, 0.31); pot(top, P.hob.x - 0.12, 0.2); }
  if (L === 'B') {                                   // despensa alta en la esquina
    top.add(tallUnit('pantry', 0.60, mats));
    tag(g, 'Despensa', '60 × 217', 0.3, 2.3, 0.3);
  }
  // Altos hasta 65 cm antes del muro del patio si hay ventana fija; ahí va el mueble del calentador
  const wEnd = G.hasFix ? W - 0.65 : W;
  const wLast = renderWallRun(top, run.items, runA, wEnd, mats, addLed);
  if (BOILER.enabled && G.hasFix && wLast + BOILER.width <= W - 0.12) { buildBoiler(g, wLast, wLast + BOILER.width, mats); met.boiler = true; }

  // Pared izquierda
  const leftLen = leftTo - leftFrom;
  if (L === 'A') {
    const lg = new THREE.Group(); g.add(lg);
    const z0 = 0.61, avail = leftTo - z0, wm = A.washerW + 0.005, dm = A.dryerW + 0.005;
    const n = avail >= wm + dm + 0.02 ? 2 : avail >= wm + 0.02 ? 1 : 0;
    if (n < 2) met.dropped.push(n === 1 ? 'dryer' : 'washer', ...(n === 0 ? ['dryer'] : []));
    const zEnd = z0 + (n >= 1 ? wm : 0) + (n >= 2 ? dm : 0);
    if (n >= 1) lg.add(place(washer('washer', layoutAnim), 0.015, z0 + A.washerW, Math.PI / 2));
    if (n >= 2) lg.add(place(washer('dryer', layoutAnim), 0.015, z0 + wm + A.dryerW, Math.PI / 2));
    met.laundryUnder = true;
    if (n > 0) {
      B(lg, 0, 0.62, 0, Y_CT, zEnd, zEnd + 0.02, mats.low);
      B(lg, 0, 0.62, Y_CT - 0.012, Y_CT, 0.62, zEnd, M.carcass, { cast: false });
      worktop(lg, 0, 0.62, 0.62, zEnd + 0.02, true); met.counter += zEnd + 0.02 - 0.62;
      backsplash(lg, 0.62, zEnd + 0.02, Y_TOP, 1.45, 0, true);
      const shelfM = surfMat(0.26, zEnd - 0.66, true);
      [1.55, 1.92].forEach(y => B(lg, 0, 0.26, y, y + 0.03, 0.66, zEnd, shelfM));
      [[0.8, 1.55], [1.05, 1.55], [1.5, 1.92], [1.25, 1.92]].filter(([z]) => z < zEnd - 0.1).forEach(([z, y], i) => cyl(lg, 0.06, 0.18, [M.ceramic, M.white, M.board, M.ceramic][i], 0.12, y + 0.12, z, 20));
      tag(g, 'Lavadora', dimsTxt(A.washerW, A.washerD, A.washerH), 0.35, 1.02, z0 + wm / 2);
      if (n >= 2) tag(g, 'Secadora', dimsTxt(A.dryerW, A.dryerD, A.dryerH), 0.35, 1.02, z0 + wm + dm / 2);
      met.leftEnd = zEnd + 0.02; met.leftWhat = n >= 2 ? 'la secadora' : 'la lavadora';
      met.washerPos = { x: 0, z: 0.9 };
    }
  } else if (L === 'B') {
    const colW = Math.max(A.washerW, A.dryerW) + 0.053;
    if (leftLen >= colW + 0.01) {
      const col = new THREE.Group(); g.add(col);
      const cz0 = 0.64, cz1 = cz0 + colW, cd = Math.max(0.66, Math.max(A.washerD, A.dryerD) + 0.06);
      const kit = A.washerH, dryY = kit + 0.02, capY = Math.min(TOPY - 0.12, dryY + A.dryerH + 0.04);
      met.stackH = dryY + A.dryerH;
      B(col, 0, cd, 0, TOPY, cz0, cz0 + 0.019, mats.high); B(col, 0, cd, 0, TOPY, cz1 - 0.019, cz1, mats.high);
      B(col, 0, cd - 0.02, capY, TOPY, cz0 + 0.019, cz1 - 0.019, M.carcass); B(col, cd - 0.02, cd, capY + 0.004, TOPY - 0.004, cz0 + 0.02, cz1 - 0.02, mats.high);
      B(col, 0.03, cd - 0.02, kit, kit + 0.02, cz0 + 0.019, cz1 - 0.019, M.steelDark);
      col.add(place(washer('washer', layoutAnim), 0.035, cz0 + 0.026 + A.washerW, Math.PI / 2));
      col.add(place(washer('dryer', layoutAnim), 0.035, cz0 + 0.026 + A.dryerW, Math.PI / 2, dryY));
      tag(g, 'Columna lavado', 'Lavadora + secadora apiladas', 0.33, 2.35, (cz0 + cz1) / 2);
      met.leftEnd = cz1; met.leftWhat = 'la columna de lavado'; met.washerPos = { x: 0, z: (cz0 + cz1) / 2 };
      if (leftTo - cz1 >= 0.35) { B(g, 0, 0.24, 1.55, 1.58, cz1 + 0.07, leftTo - 0.04, surfMat(0.24, leftTo - cz1 - 0.11, true)); plant(g, 0.12, cz1 + 0.25, 1.58, 0.6); }
    } else met.dropped.push('laundryCol');
  } else if (mode === 'hueco') {
    // C con la nevera en el hueco: horno junto a la placa y despensa hacia la entrada
    const n = leftLen >= 1.20 ? 2 : leftLen >= 0.60 ? 1 : 0;
    if (n < 2) met.dropped.push(n === 1 ? 'pantry' : 'oven', ...(n === 0 ? ['pantry'] : []));
    if (n >= 1) { g.add(place(tallUnit('oven', 0.60, mats), 0, leftFrom + 0.60, Math.PI / 2)); tag(g, 'Horno + micro', 'columna 60', 0.3, 2.3, leftFrom + 0.3); }
    if (n >= 2) { g.add(place(tallUnit('pantry', 0.60, mats), 0, leftFrom + 1.20, Math.PI / 2)); tag(g, 'Despensa', '60 × 217', 0.3, 2.3, leftFrom + 0.9); }
    if (n > 0) { B(g, 0, Z_FR, 0, TOPY, leftFrom - 0.02, leftFrom, mats.low); met.leftEnd = leftFrom + n * 0.60; met.leftWhat = n >= 2 ? 'la despensa' : 'la torre de horno'; }
  }

  // Pared de la puerta
  if (mode === 'pared') {
    const tw = new THREE.Group(); g.add(tw);
    // local x crece desde la esquina del quiebro hacia la puerta
    const p0 = 0.60, p1 = 0.60 + housingW;
    const len = twX1 - twX0, pantryW = len - p1 >= 0.30 ? Math.min(len - p1, 1.20) : 0;
    tw.add(place(tallUnit('oven', 0.60, mats), 0, 0));
    B(tw, p0, p0 + 0.02, 0, TOPY, 0, 0.64, mats.low); B(tw, p1 - 0.02, p1, 0, TOPY, 0, 0.64, mats.low);
    B(tw, p0 + 0.02, p1 - 0.02, FR.h + 0.05, TOPY, 0, Z_CAR, M.carcass);
    B(tw, p0 + 0.024, (p0 + p1) / 2 - 0.002, FR.h + 0.054, TOPY - 0.004, Z_CAR, Z_FR, mats.high);
    B(tw, (p0 + p1) / 2 + 0.002, p1 - 0.024, FR.h + 0.054, TOPY - 0.004, Z_CAR, Z_FR, mats.high);
    B(tw, p0 + 0.06, p1 - 0.06, FR.h + 0.055, FR.h + 0.075, Z_FR, Z_FR + 0.004, M.dark);
    if (pantryW) { tw.add(place(tallUnit('pantry', pantryW, mats), p1, 0)); }
    const endX = p1 + pantryW; B(tw, endX, endX + 0.02, 0, TOPY, 0, Z_FR, mats.low);
    place(tw, twX1, D, Math.PI);
    const fx = twX1 - (p0 + p1) / 2;
    met.fridge = { x: fx, z: D - FR.back - FR.d, mode };
    met.housing = [twX1 - p1, twX1 - p0]; met.pantryW = pantryW;
    tag(g, 'Torre horno + micro', 'columna 60', twX1 - 0.3, 2.35, D - 0.3);
    if (pantryW) tag(g, 'Despensa', `${cm(pantryW)} × 217`, twX1 - p1 - pantryW / 2, 2.35, D - 0.3);
    tag(g, 'Nevera empotrada', dimsTxt(FR.w, FR.d, FR.h), fx, Math.min(1.62, FR.h - 0.1), met.fridge.z + 0.2);
    place(fridge.userData.body, fx + FR.w / 2, D - FR.back, Math.PI);
    fridge.userData.fgAnim.open = 1.9;
    met.pass = met.fridge.z - 0.62;
    dim(ldims, [fx - 0.15, 0.02, 0.62], [fx - 0.15, 0.02, met.fridge.z], `paso ${fmt(met.pass)}`, true);
  } else {
    place(fridge.userData.body, G.FRX1, G.FRZ0, -Math.PI / 2);
    fridge.userData.fgAnim.open = 1.57;
    met.fridge = { x: G.FRX0, z: G.FRZ0 + FR.w / 2, mode };
    tag(g, 'Nevera americana', dimsTxt(FR.w, FR.d, FR.h), G.FRX0 + FR.d / 2, FR.h + 0.18, G.FRZ0 + FR.w / 2);
    met.pass = G.FRZ0 - 0.62;
    met.doorHitsFridge = G.DOOR1 > G.FRX0 - 0.05;
    dim(ldims, [G.FRX0 - 0.25, 0.02, 0.62], [G.FRX0 - 0.25, 0.02, G.FRZ0], `paso ${fmt(met.pass)}`, true);
    // Muebles de enfrente (A y B): entre la puerta y la nevera, dejando 50 cm para abrir su puerta
    if (L !== 'C') {
      const ox0 = G.DOOR1 + 0.08, ox1 = G.FRX0 - 0.50, olen = ox1 - ox0;
      if (olen >= 0.30) {
        const opp = new THREE.Group(); g.add(opp);
        const pk = packRun(0, olen - 0.02, [], []);
        renderRun(opp, pk.items, mats, layoutAnim);
        B(opp, olen - 0.02, olen, 0, Y_CT, 0, Z_FR, mats.low); B(opp, -0.02, 0, 0, Y_CT, 0, Z_FR, mats.low);
        worktop(opp, -0.02, olen, 0, 0.62); backsplash(opp, -0.02, olen, Y_TOP, 1.45, 0); met.counter += olen + 0.02;
        place(opp, ox1, D, Math.PI);
        renderWallRun(opp, pk.items, 0, olen, mats, addLed);
        if (olen >= 0.9) { B(opp, 0.08, 0.56, Y_TOP, Y_TOP + 0.28, 0.06, 0.42, M.steelDark); B(opp, 0.12, 0.42, Y_TOP + 0.05, Y_TOP + 0.24, 0.42, 0.425, M.blackGlass); }
        met.opp = olen; met.oppPass = D - 0.62 - 0.62;
        tag(g, 'Muebles bajos + altos', `${cm(olen)} cm · paso ${fmt(met.oppPass)} m`, (ox0 + ox1) / 2, 1.62, D - 0.3);
        dim(ldims, [(ox0 + ox1) / 2, 0.02, 0.62], [(ox0 + ox1) / 2, 0.02, D - 0.62], `paso ${fmt(met.oppPass)}`, true);
      }
    }
  }

  // Etiquetas y atrezo de la pared larga
  const tags = { sink: ['Fregadero', w => `${cm(w)} cm`, 1.10, 0.3], dw: ['Lavavajillas', () => dimsTxt(A.dwW - 0.002, 0.55, 0.82), 1.02, 0.55], washer: ['Lavadora', () => dimsTxt(A.washerW, A.washerD, A.washerH), 0.72, 1.0], dryer: ['Secadora', () => dimsTxt(A.dryerW, A.dryerD, A.dryerH), 1.02, 0.55], hob: ['Placa + campana', () => `${c1(A.hobW)} cm`, 1.62, 0.3] };
  if (P.washer || P.dryer) met.laundryUnder = true;
  for (const [id, [t, d, y, z]] of Object.entries(tags)) if (P[id]) tag(g, t, d(P[id].w), P[id].x, y, z);
  if (P.washer) met.washerPos = { x: P.washer.x, z: 0 };
  const flexItems = run.items.filter(i => i.flex);
  fruitBowl(g, runA + 0.35, 0.33);
  if (P.sink) board(g, P.sink.x0 - 0.3 > runA + 0.2 ? P.sink.x0 - 0.3 : P.sink.x1 + 0.3, 0.3);
  plant(g, W - 0.16, 0.26, Y_TOP, 0.5);

  // Métricas para el panel
  const S = P.sink ? { x: P.sink.x, z: 0.31 } : null, Hb = P.hob ? { x: P.hob.x, z: 0.31 } : null;
  const F = mode === 'pared' ? { x: met.fridge.x, z: met.fridge.z } : { x: G.FRX0, z: G.FRZ0 + FR.w / 2 };
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  if (S && Hb) { met.triangle = d2(F, S) + d2(S, Hb) + d2(Hb, F); met.fridgeHob = d2(F, Hb); met.fridgeSink = d2(F, S); met.sinkHobFree = Math.abs(P.sink.x - P.hob.x) - (P.sink.w + P.hob.w) / 2; }
  // Distancia de cada aparato con agua hasta el principio de las tomas (recorrido por la pared)
  const wet = [];
  // pared larga: lo que falte hasta las tomas; pared izquierda: hasta la esquina y luego por la pared larga
  const along = (x, z) => z > 0 ? G.waterFrom + z : Math.max(0, G.waterFrom - x);
  // margen que cubren el sifón (fregadero) y las mangueras (lavavajillas, lavadora) sin obra
  if (P.sink) wet.push(['sink', along(P.sink.x, 0), 0.3]);
  if (P.dw) wet.push(['dw', along(P.dw.x, 0), 1.0]);
  if (met.washerPos) wet.push(['washer', along(met.washerPos.x, met.washerPos.z), 1.0]);
  met.wet = wet;
  met.doorGap = met.doorNearLeft && met.leftEnd != null ? (D - G.doorW + 0.015) - met.leftEnd : null;   // hoja abierta a 90°
  met.patioFree = G.hasPatio ? (G.hasNotch ? G.NZ : D) - 0.62 : null;
  MET = met;

  scene.add(g);
  g.traverse(o => { if (o.isCSS2DObject) o.visible = state.tags; });
  document.getElementById('fridge-group').hidden = L !== 'C';
  document.getElementById('st-enc').textContent = `${fmt(met.counter)} m`;
  applyNight(); renderInfo();
  const p = state.open ? 1 : 0; allAnim().forEach(a => a.obj[a.key] = a.closed + (a.open - a.closed) * p);
}
const allAnim = () => fridgeAnim.concat(roomAnim, layoutAnim);

// Mueble que tapa el calentador de gas: abierto por abajo, rejillas y chimenea libre
function buildBoiler(g, x0, x1, mats) {
  const yb = 1.45, yt = TOPY, dz = 0.35, cal = new THREE.Group(); g.add(cal);
  const cx = (x0 + x1) / 2;
  B(cal, x0, x0 + 0.018, yb, yt, 0, dz - 0.02, M.carcass); B(cal, x1 - 0.018, x1, yb, yt, 0, dz - 0.02, M.carcass);
  B(cal, x0, x1, yt - 0.018, yt, 0, dz - 0.02, M.carcass); B(cal, x0, x1, yb, yt, 0, 0.006, M.carcass);
  RB(cal, cx - 0.155, cx + 0.155, 1.53, 2.07, 0.02, 0.25, M.white, 0.02);
  B(cal, cx - 0.055, cx + 0.055, 1.60, 1.63, 0.25, 0.253, M.display);
  cyl(cal, 0.05, G.H - 0.10 - 2.07, M.steel, cx, (2.07 + G.H - 0.10) / 2, 0.13, 20);
  const el = cyl(cal, 0.05, 0.14, M.steel, cx, G.H - 0.15, 0.06, 20); el.rotation.x = Math.PI / 2;
  [-0.095, 0, 0.095].forEach(dx => cyl(cal, 0.009, 0.12, dx === 0 ? M.board : M.chrome, cx + dx, 1.47, 0.08, 10));
  const dp = new THREE.Group(); dp.position.set(x1, 0, dz); cal.add(dp);
  B(dp, -(x1 - x0) + 0.004, -0.004, yb + 0.004, yt - 0.004, -0.02, 0, mats.high);
  for (let i = 0; i < 6; i++) { const y = yb + 0.05 + i * 0.018; B(dp, -(x1 - x0) + 0.07, -0.07, y, y + 0.006, 0, 0.002, M.dark); B(dp, -(x1 - x0) + 0.07, -0.07, yt - 0.06 - i * 0.018, yt - 0.054 - i * 0.018, 0, 0.002, M.dark); }
  layoutAnim.push({ obj: dp.rotation, key: 'y', closed: 0, open: 1.6 });
  tag(g, 'Mueble calentador', `${BOILER.label} · ${cm(x1 - x0)} cm`, cx, 2.35, 0.2);
}

/* ───────── Panel: electrodomésticos y comprobaciones (textos en js/info.js) ───────── */
function renderInfo() {
  const { apps, checks } = panelInfo({ L: state.layout, mode: fridgeMode(), want: state.fridgePos, met: MET, room: G, ap: state.appl, under: UNDER_COUNTER, fmt, cm, c1, dimsTxt, names: NAMES, boiler: BOILER });
  document.getElementById('apps').innerHTML = apps.map(([n, d, w]) => `<div class="row"><span class="n">${n}</span><span class="d">${d}</span><span class="w">${w}</span></div>`).join('');
  document.getElementById('checks').innerHTML = checks.map(([s, l, t, x]) => `<div class="check"><span class="pill ${s}">${l}</span><span class="t">${t}</span><span class="x">${x}</span></div>`).join('');
  $('st-area').textContent = `${fmt(G.area, 1)} m²`;
  $('st-size').textContent = `${fmt(G.W)} × ${fmt(G.D)}`;
}

/* ───────── Día / noche ───────── */
function applyNight() {
  const n = state.night;
  sun.intensity = n ? 0 : 3.4; hemi.intensity = n ? 0.03 : 0.35;
  scene.environmentIntensity = n ? 0.08 : 0.55;
  scene.background = new THREE.Color(n ? '#0d1116' : '#dfe4e2');
  stage.style.background = n ? '#0d1116' : '#dfe4e2';
  M.ground.color.set(n ? '#1a1e22' : '#c9ccc7');
  nightLights.visible = n; ledLights.children.forEach(l => l.intensity = n ? 9 : 0);
  skyLights.children.forEach(l => l.intensity = n ? 0 : 3.2);
  bloom.enabled = n; syncWater();
  M.led.emissiveIntensity = n ? 2.2 : 0;
  renderer.toneMappingExposure = n ? 1.15 : 1.0;
}
function syncWater() {
  if (!water) return;
  water.visible = state.water; water.userData.label.visible = state.water && state.tags;
  // en calidad alta la mezcla se hace en espacio lineal: se baja la opacidad para que se vea igual
  M.water.opacity = state.hq ? (state.night ? 0.012 : 0.04) : 0.1;
}

/* ───────── Cámara ───────── */
function views() {
  const { W, D, s } = G, F = MET.fridge || { x: G.FRX0, z: G.FRZ0 };
  return {
    entrada: { p: [G.DOOR0 + 0.3, 1.62, D - 0.66], t: [W * 0.69, 1.0, 0.5], f: 66 },
    patio: G.hasPatio ? { p: [W + 1.82, 1.5, (G.PD0 + G.PD1) / 2], t: [W * 0.29, 1.0, G.rightLen * 0.74], f: 48 }
      : { p: [W + 3.2, 2.2, D / 2], t: [W * 0.4, 1.0, D / 2], f: 48 },
    nevera: fridgeMode() === 'pared' ? { p: [F.x - 1.65, 1.7, 0.8], t: [F.x + 0.1, 0.95, D - 0.34], f: 62 }
      : { p: [G.FRX0 - 1.53, 1.6, 0.75], t: [G.FRX0 + 0.36, 0.95, G.FRZ0 + 0.44], f: 58 },
    iso: { p: [-2.9 * s, 5.6 * s, D + 3.96 * s], t: [W / 2 - 0.04, 0.55, D * 0.47], f: 38 },
    planta: { p: [W / 2, 10.5 * s, D / 2 + 0.01], t: [W / 2, 0, D / 2], f: 32 },
  };
}
let tween = null, currentView = 'iso';
function goView(name, instant = false) {
  const v = views()[name] || views().iso; currentView = name;
  document.querySelectorAll('.vbtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
  const to = { p: new THREE.Vector3(...v.p), t: new THREE.Vector3(...v.t), f: v.f };
  if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { camera.position.copy(to.p); controls.target.copy(to.t); camera.fov = to.f; camera.updateProjectionMatrix(); return; }
  tween = { from: { p: camera.position.clone(), t: controls.target.clone(), f: camera.fov }, to, t0: performance.now(), dur: 1300 };
}

/* ───────── Corte de paredes (maqueta) ───────── */
const tmp = new THREE.Vector3();
function updateCutaway() {
  for (const w of walls) {
    if (w.fixed) continue;
    const hide = tmp.copy(camera.position).sub(w.p).dot(w.n) < -0.02;
    if (w.g.userData.hidden === hide) continue;
    w.g.userData.hidden = hide; w.g.visible = !hide;
  }
}

/* ───────── UI ───────── */
const $ = id => document.getElementById(id);
document.querySelectorAll('[data-layout]').forEach(b => b.onclick = () => { state.layout = b.dataset.layout; syncButtons(); buildLayout(); saveHash(); });
document.querySelectorAll('.vbtn').forEach(b => b.onclick = () => goView(b.dataset.view));
document.querySelectorAll('[data-fridge]').forEach(b => b.onclick = () => { state.fridgePos = b.dataset.fridge; syncButtons(); buildLayout(); saveHash(); goView('nevera'); });
$('t-day').onclick = () => { state.night = false; $('t-day').setAttribute('aria-pressed', true); $('t-night').setAttribute('aria-pressed', false); applyNight(); };
$('t-night').onclick = () => { state.night = true; $('t-day').setAttribute('aria-pressed', false); $('t-night').setAttribute('aria-pressed', true); applyNight(); };
$('t-open').onclick = () => { state.open = !state.open; $('t-open').setAttribute('aria-pressed', state.open); };
$('t-dims').onclick = () => { state.dims = !state.dims; $('t-dims').setAttribute('aria-pressed', state.dims); };
$('t-tags').onclick = () => { state.tags = !state.tags; $('t-tags').setAttribute('aria-pressed', state.tags); scene.traverse(o => { if (o.isCSS2DObject && !o.element.classList.contains('dim')) o.visible = state.tags; }); syncWater(); };
$('t-water').onclick = () => { state.water = !state.water; $('t-water').setAttribute('aria-pressed', state.water); syncWater(); };
$('t-rot').onclick = () => { state.rot = !state.rot; $('t-rot').setAttribute('aria-pressed', state.rot); controls.autoRotate = state.rot; };
$('t-hq').onclick = () => { state.hq = !state.hq; setQuality(); };
const flash = (text) => { const msg = $('copy-msg'); msg.textContent = text; msg.hidden = false; clearTimeout(msg._t); msg._t = setTimeout(() => { msg.hidden = true; }, 4000); };
$('copy-link').onclick = async () => {
  saveHash();
  try { await navigator.clipboard.writeText(location.href); flash('Enlace copiado'); } catch { flash(location.href); }
};
// Guardar la vista actual como PNG en alta calidad (hasta ~2400 px de ancho)
$('save-img').onclick = () => {
  const w = stage.clientWidth, h = stage.clientHeight, hq = state.hq;
  const pr = Math.min(3, Math.max(1, 2400 / w));
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(w, h);
  state.hq = true; frame(performance.now()); state.hq = hq;
  renderer.domElement.toBlob(blob => {
    setQuality();
    if (!blob) { flash('No se pudo generar la imagen'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cocina-3d-${(location.hash.slice(1) || 'diseno').replace(/[^\w.-]/g, '')}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    flash('Imagen guardada');
  }, 'image/png');
};
controls.addEventListener('start', () => { tween = null; });

/* ───────── Panel de acabados ───────── */
function thumbStyle(cat, o) {
  if (o.type === 'color' || cat === 'pared') return `background:${o.color}`;
  const key = o.type === 'wood' ? 'oak' : o.tex === 'worktop' ? opt('encimera').tex : o.tex;
  return THUMBS[key] ? `background-image:url(${THUMBS[key]});background-size:cover` : 'background:#3a4043';
}
function renderFinishUI() {
  $('presets').innerHTML = PRESETS.map(p => {
    const on = Object.keys(p.fin).every(k => p.fin[k] === state.fin[k]);
    return `<button class="chip" data-preset="${p.id}" aria-pressed="${on}">${p.name}</button>`;
  }).join('');
  $('finishes').innerHTML = Object.entries(CATALOG).map(([cat, c]) => `
    <div class="fin-cat"><div class="fin-head"><span class="label">${c.label}</span><span class="fin-name">${opt(cat).name}</span></div>
    <div class="fin-grid" role="group" aria-label="${c.label}">${c.options.map(o => `<button class="sw-btn" data-cat="${cat}" data-id="${o.id}" aria-pressed="${state.fin[cat] === o.id}" title="${o.name}" aria-label="${c.label}: ${o.name}"><i style="${thumbStyle(cat, o)}"></i></button>`).join('')}</div></div>`).join('');
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { state.fin = { ...PRESETS.find(p => p.id === b.dataset.preset).fin }; applyAll(); });
  document.querySelectorAll('.sw-btn').forEach(b => b.onclick = () => { state.fin[b.dataset.cat] = b.dataset.id; applyAll(); });
}
function applyAll() { applyRoomFinishes(); buildLayout(); renderFinishUI(); saveHash(); }
function syncButtons() {
  document.querySelectorAll('[data-layout]').forEach(x => x.setAttribute('aria-pressed', x.dataset.layout === state.layout));
  document.querySelectorAll('[data-fridge]').forEach(x => x.setAttribute('aria-pressed', x.dataset.fridge === state.fridgePos));
  $('t-hq').setAttribute('aria-pressed', state.hq);
  $('t-tags').setAttribute('aria-pressed', state.tags);
}
function setQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, state.hq ? 2 : 1.25));
  const s = state.hq ? 4096 : 2048; sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  resize(); syncButtons(); syncWater();
}

/* ───────── Mis medidas ───────── */
const FIELDS = [
  ['W', 'Pared larga'], ['D', 'Pared izquierda'], ['NX', 'Pared de la puerta'], ['notch', 'Quiebro'],
  ['H', 'Altura del techo'], ['doorX', 'Puerta: a la esquina'], ['doorW', 'Puerta: ancho'],
  ['fixW', 'Ventana fija'], ['patioW', 'Puerta al patio'],
];
const AFIELDS = [
  ['fridgeW', 'Nevera: ancho'], ['fridgeD', 'Nevera: fondo'], ['fridgeH', 'Nevera: alto'], ['dwW', 'Lavavajillas: ancho'],
  ['washerW', 'Lavadora: ancho'], ['washerD', 'Lavadora: fondo'], ['washerH', 'Lavadora: alto'], ['hobW', 'Placa: ancho'],
  ['dryerW', 'Secadora: ancho'], ['dryerD', 'Secadora: fondo'], ['dryerH', 'Secadora: alto'],
];
function sanitizeAppliances(a) {
  const out = { ...DEFAULT_APPLIANCES, ...a };
  for (const [k, [lo, hi]] of Object.entries(APPLIANCE_LIMITS)) out[k] = Math.min(Math.max(Number(out[k]) || DEFAULT_APPLIANCES[k], lo), hi);
  return out;
}
function roomForm() {
  const form = $('room-form');
  const field = (k, label, lim, step) => `<label class="m-field" data-k="${k}"><span>${label}</span><span class="m-in"><input type="number" id="m-${k}" inputmode="decimal" step="${step}" min="${Math.round(lim[0] * 100)}" max="${Math.round(lim[1] * 100)}"><em>cm</em></span></label>`;
  $('m-fields').innerHTML = FIELDS.map(([k, label]) => field(k, label, ROOM_LIMITS[k], 1)).join('');
  $('a-fields').innerHTML = AFIELDS.map(([k, label]) => field(k, label, APPLIANCE_LIMITS[k], 0.1)).join('');
  const val = k => { const v = String($(`m-${k}`).value).replace(',', '.'); return (parseFloat(v) || 0) / 100; };
  const fill = (r, a = state.appl) => { FIELDS.forEach(([k]) => { $(`m-${k}`).value = cm(r[k]); }); AFIELDS.forEach(([k]) => { $(`m-${k}`).value = Math.round(a[k] * 1000) / 10; }); };
  const read = () => Object.fromEntries(FIELDS.map(([k]) => [k, val(k)]));
  const readA = () => Object.fromEntries(AFIELDS.map(([k]) => [k, val(k)]));
  let focusKey = null;
  const draw = () => drawPlan(read(), focusKey);
  form.addEventListener('input', draw);
  form.addEventListener('focusin', e => { focusKey = e.target.id?.slice(2) || null; draw(); });
  form.addEventListener('focusout', () => { focusKey = null; draw(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const { room, notes } = sanitizeRoom(read());
    const appl = sanitizeAppliances(readA());
    const clamped = AFIELDS.some(([k]) => Math.abs(appl[k] - readA()[k]) > 0.0005);
    setRoom(room, appl); fill(room, appl); draw();
    $('m-msg').textContent = [...notes, clamped ? 'Alguna medida de electrodoméstico estaba fuera de rango y la he ajustado.' : ''].filter(Boolean).join(' ') || 'Medidas aplicadas.';
  });
  $('m-reset').onclick = () => { setRoom({ ...DEFAULT_ROOM }, { ...DEFAULT_APPLIANCES }); fill(state.room, state.appl); draw(); $('m-msg').textContent = 'Vuelven las medidas originales.'; };
  fill(state.room); draw();
  return { fill, draw };
}
// Plano en planta (SVG) que se actualiza mientras se escriben las medidas
function drawPlan(r, focusKey) {
  const g = computeRoom(sanitizeRoom(r).room), padL = 42, padR = 48, padY = 28, vw = 320, vh = 210;
  const k = Math.min((vw - padL - padR) / g.W, (vh - 2 * padY) / g.D);
  const ox = padL + ((vw - padL - padR) - g.W * k) / 2, oy = padY + ((vh - 2 * padY) - g.D * k) / 2;
  const X = x => ox + x * k, Y = z => oy + z * k;
  const pts = g.hasNotch ? [[0, 0], [g.W, 0], [g.W, g.NZ], [g.NX, g.NZ], [g.NX, g.D], [0, g.D]] : [[0, 0], [g.W, 0], [g.W, g.D], [0, g.D]];
  const on = key => focusKey === key ? ' on' : '';
  const seg = (key, x0, z0, x1, z1) => `<line class="w${on(key)}" x1="${X(x0)}" y1="${Y(z0)}" x2="${X(x1)}" y2="${Y(z1)}"/>`;
  const txt = (key, x, z, t, anchor = 'middle') => `<text class="t${on(key)}" x="${x}" y="${z}" text-anchor="${anchor}">${t}</text>`;
  let s = `<polygon class="fl" points="${pts.map(([x, z]) => `${X(x)},${Y(z)}`).join(' ')}"/>`;
  s += seg('W', 0, 0, g.W, 0) + seg('D', 0, 0, 0, g.D) + seg('NX', 0, g.D, g.NX, g.D);
  if (g.hasNotch) s += seg('notch', g.NX, g.NZ, g.NX, g.D) + `<line class="w" x1="${X(g.NX)}" y1="${Y(g.NZ)}" x2="${X(g.W)}" y2="${Y(g.NZ)}"/>`;
  s += `<line class="w" x1="${X(g.W)}" y1="${Y(0)}" x2="${X(g.W)}" y2="${Y(g.rightLen)}"/>`;
  s += `<line class="op${on('doorX')}${on('doorW')}" x1="${X(g.DOOR0)}" y1="${Y(g.D)}" x2="${X(g.DOOR1)}" y2="${Y(g.D)}"/>`;
  if (g.hasFix) s += `<line class="gl${on('fixW')}" x1="${X(g.W)}" y1="${Y(g.WIN0)}" x2="${X(g.W)}" y2="${Y(g.WSPLIT)}"/>`;
  if (g.hasPatio) s += `<line class="op${on('patioW')}" x1="${X(g.W)}" y1="${Y(g.PD0)}" x2="${X(g.W)}" y2="${Y(g.PD1)}"/>`;
  s += txt('W', X(g.W / 2), Y(0) - 8, fmt(g.W)) + txt('D', X(0) - 8, Y(g.D / 2), fmt(g.D), 'end') + txt('NX', X(g.NX / 2), Y(g.D) + 16, fmt(g.NX));
  if (g.hasNotch) s += txt('notch', X(g.NX) + 6, Y((g.NZ + g.D) / 2) + 4, fmt(g.notch), 'start');
  s += txt('doorW', X((g.DOOR0 + g.DOOR1) / 2), Y(g.D) - 6, 'puerta');
  if (g.hasPatio || g.hasFix) s += txt('patioW', X(g.W) + 6, Y(Math.max(g.PD0 || 0, 0.3)) + 4, 'patio', 'start');
  $('room-svg').innerHTML = s;
}
function setRoom(room, appl = state.appl) {
  state.room = { ...room }; state.appl = { ...appl };
  syncFR(); G = computeRoom(state.room);
  buildFridge(); buildRoom(); buildLayout(); syncWater(); saveHash(); goView(currentView, true);
}

/* ───────── Enlace compartible: #C.pared.012301[.m478-264-…] ───────── */
const CATS = Object.keys(CATALOG), RKEYS = Object.keys(DEFAULT_ROOM), AKEYS = Object.keys(DEFAULT_APPLIANCES);
function saveHash() {
  const code = CATS.map(c => Math.max(0, CATALOG[c].options.findIndex(o => o.id === state.fin[c]))).join('');
  const parts = [state.layout, state.fridgePos, code];
  if (RKEYS.some(k => cm(state.room[k]) !== cm(DEFAULT_ROOM[k]))) parts.push('m' + RKEYS.map(k => cm(state.room[k])).join('-'));
  const mm = v => Math.round(v * 1000);
  if (AKEYS.some(k => mm(state.appl[k]) !== mm(DEFAULT_APPLIANCES[k]))) parts.push('a' + AKEYS.map(k => mm(state.appl[k])).join('-'));
  try { history.replaceState(null, '', '#' + parts.join('.')); } catch { }
}
function loadHash(h) {
  const m = /^([ABC])\.(pared|hueco)\.([0-3]{6})(?:\.m([\d-]+))?(?:\.a([\d-]+))?$/.exec(h);
  if (!m) return false;
  state.layout = m[1]; state.fridgePos = m[2];
  CATS.forEach((c, i) => { state.fin[c] = CATALOG[c].options[+m[3][i]].id; });
  if (m[4]) {
    const v = m[4].split('-').map(Number);
    if (v.length === RKEYS.length && v.every(n => Number.isFinite(n))) state.room = sanitizeRoom(Object.fromEntries(RKEYS.map((k, i) => [k, v[i] / 100]))).room;
  }
  if (m[5]) {
    const v = m[5].split('-').map(Number);
    if (v.length === AKEYS.length && v.every(n => Number.isFinite(n))) state.appl = sanitizeAppliances(Object.fromEntries(AKEYS.map((k, i) => [k, v[i] / 1000])));
  }
  return true;
}

/* ───────── Bucle ───────── */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  labelRenderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
let openP = 0, last = performance.now();
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function loop(now) {
  if (window.__kitchenPaused) { requestAnimationFrame(loop); return; }   // usado por la prueba automática
  frame(now);
  requestAnimationFrame(loop);
}
function inside(p) { return p.y < G.H - 0.02 && p.x > 0 && p.x < G.W && p.z > 0 && p.z < G.D && !(G.hasNotch && p.x > G.NX && p.z > G.NZ); }
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (tween) {
    const k = ease(Math.min(1, (now - tween.t0) / tween.dur));
    camera.position.lerpVectors(tween.from.p, tween.to.p, k); controls.target.lerpVectors(tween.from.t, tween.to.t, k);
    camera.fov = tween.from.f + (tween.to.f - tween.from.f) * k; camera.updateProjectionMatrix();
    if (k >= 1) tween = null;
  }
  const target = state.open ? 1 : 0;
  if (openP !== target) {
    openP += Math.sign(target - openP) * dt * 0.9; openP = Math.max(0, Math.min(1, openP));
    const k = ease(openP); allAnim().forEach(a => a.obj[a.key] = a.closed + (a.open - a.closed) * k);
  }
  controls.update(); updateCutaway();
  ceiling.visible = inside(camera.position);
  const showDims = state.dims && camera.position.y > 2.8;
  [dims, ldims].forEach(grp => { if (!grp) return; grp.visible = showDims; grp.children.forEach(c => { if (c.isCSS2DObject) c.visible = showDims; }); });
  if (state.hq) composer.render(); else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

/* ───────── Arranque ───────── */
const hash = location.hash.slice(1);
if (!loadHash(hash) && ['A', 'B', 'C'].includes(hash)) state.layout = hash;
syncFR(); G = computeRoom(state.room);
syncButtons(); applyRoomFinishes(); renderFinishUI(); buildFridge(); buildRoom(); buildLayout(); syncWater(); setQuality();
const form = roomForm();
goView(['entrada', 'patio', 'nevera', 'iso', 'planta'].includes(hash) ? hash : 'iso', true);
requestAnimationFrame(t => { last = t; loop(t); setTimeout(() => $('loading').classList.add('gone'), 150); });
warmUp(() => renderFinishUI());   // miniaturas del resto de acabados, en ratos libres
window.__kitchen = {
  frame: () => frame(performance.now()), passes: { gtao, bloom }, state, goView, buildLayout, applyNight, allAnim, applyAll, setQuality,
  setRoom: (r, a) => { setRoom(sanitizeRoom({ ...state.room, ...r }).room, sanitizeAppliances({ ...state.appl, ...(a || {}) })); form.fill(state.room, state.appl); form.draw(); }, metrics: () => MET, room: () => G,
  setOpen(v) { state.open = v; openP = v ? 1 : 0; allAnim().forEach(a => a.obj[a.key] = a.closed + (a.open - a.closed) * openP); },
};
