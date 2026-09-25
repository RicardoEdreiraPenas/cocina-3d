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
import { ROOM, DOOR, WINDOW, FRIDGE, DIM_LABELS, CATALOG, PRESETS, DEFAULT_DESIGN } from './config.js';
import { createTextures } from './textures.js';

/* ───────── Medidas (ver js/config.js) ───────── */
const { W, D, NX, NZ, H, T } = ROOM;
const DOOR0 = DOOR.x0, DOOR1 = DOOR.x1, DOORH = DOOR.h;
const WIN0 = WINDOW.z0, WIN1 = NZ - 0.10, WINH = WINDOW.h, WSPLIT = WINDOW.split, SILL = WINDOW.sill;
const FR = FRIDGE;
const FRZ0 = NZ + (D - NZ - FR.w) / 2;         // nevera en el hueco: lado del congelador
const FRX1 = NX - FR.back, FRX0 = FRX1 - FR.d; // fondo y frente

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

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.4; controls.maxDistance = 16; controls.maxPolarAngle = Math.PI * 0.495;
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
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
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

/* ───────── Texturas procedurales (js/textures.js) ───────── */
const { tex: TX, thumbs: THUMBS } = createTextures(THREE, renderer);

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
};

/* ───────── Estado ───────── */
const state = { layout: DEFAULT_DESIGN.layout, fridgePos: DEFAULT_DESIGN.fridgePos, fin: { ...DEFAULT_DESIGN.fin }, water: true, night: false, open: false, dims: true, tags: window.innerWidth > 860, rot: false, hq: HQ_DEFAULT };

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

/* ───────── Luces ───────── */
const hemi = new THREE.HemisphereLight('#f3f6f8', '#b9ab98', 0.35); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d8', 3.4);
sun.position.set(W + 5.2, 4.3, -1.6); sun.target.position.set(2.2, 0, 1.2);
sun.castShadow = true; sun.shadow.mapSize.set(state.hq ? 4096 : 2048, state.hq ? 4096 : 2048);
sun.shadow.camera.layers.enable(1);   // las paredes proyectan sombra aunque estén cortadas en la maqueta
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const nightLights = new THREE.Group(); scene.add(nightLights);
[[0.9, 1.0], [2.2, 1.0], [2.2, 2.0], [0.9, 2.0], [4.05, 0.85]].forEach(([x, z]) => {
  const p = new THREE.PointLight('#ffd9a8', 2.2, 6, 2); p.position.set(x, H - 0.08, z); nightLights.add(p);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), new THREE.MeshBasicMaterial({ color: '#fff4e0' }));
  disc.position.set(x, H - 0.005, z); nightLights.add(disc);
});
const ledLights = new THREE.Group(); scene.add(ledLights);
// Luz de cielo que entra por la ventana fija y la puerta del patio (luz de área suave)
const skyLights = new THREE.Group(); scene.add(skyLights);
[[WIN0 + 0.05, WSPLIT, SILL, WINH - 0.05], [WSPLIT + 0.05, WIN1 - 0.05, 0.02, WINH - 0.05]].forEach(([z0, z1, y0, y1]) => {
  const l = new THREE.RectAreaLight('#e4eef7', 3.2, z1 - z0, y1 - y0);
  l.position.set(W - 0.005, (y0 + y1) / 2, (z0 + z1) / 2); l.lookAt(0, (y0 + y1) / 2, (z0 + z1) / 2); skyLights.add(l);
});

/* ───────── Estancia fija ───────── */
const walls = [];
// Copias invisibles (capa 1) que solo ve la cámara de sombras: así la luz sigue entrando solo por la ventana
const proxies = new THREE.Group(); scene.add(proxies);
function shadowProxy(b) { const m = B(proxies, ...b, M.shadowOnly, { receive: false }); m.layers.set(1); return m; }
function wall(n, p, boxes, fixed = false) {
  const g = new THREE.Group();
  boxes.forEach(b => { const m = B(g, ...b, M.wall); m.castShadow = false; shadowProxy(b); });
  scene.add(g); walls.push({ g, n: new THREE.Vector3(...n), p: new THREE.Vector3(...p), fixed }); return g;
}
wall([0, 0, 1], [0, 0, 0], [[-T, W + T, 0, H, -T, 0]]);                                      // fondo 4,78
wall([1, 0, 0], [0, 0, 0], [[-T, 0, 0, H, 0, D + T]]);                                       // izquierda 2,64
const wDoor = wall([0, 0, -1], [0, 0, D], [[0, DOOR0, 0, H, D, D + T], [DOOR1, NX + T, 0, H, D, D + T], [DOOR0, DOOR1, DOORH, H, D, D + T]]); // abajo 3,42
wall([-1, 0, 0], [NX, 0, 0], [[NX, NX + T, 0, H, NZ, D + T]]);                               // quiebro 0,95
wall([0, 0, -1], [0, 0, NZ], [[NX, W + T, 0, H, NZ, NZ + T]]);                               // quiebro 1,36
wall([-1, 0, 0], [W, 0, 0], [[W, W + T, 0, H, -T, WIN0], [W, W + T, 0, H, WIN1, NZ + T], [W, W + T, WINH, H, WIN0, WIN1], [W, W + T, 0, SILL, WIN0, WSPLIT]], true); // ventana fija + puerta patio

// techo invisible que solo proyecta sombra (la luz entra por la balconera)
shadowProxy([-T, W + T, H, H + 0.05, -T, NZ + T]);
shadowProxy([-T, NX + T, H, H + 0.05, NZ, D + T]);
// Techo visible solo cuando la cámara está dentro de la cocina
const ceiling = new THREE.Group(); scene.add(ceiling);
{ const cm = std('#F4F2EE', 0.95); B(ceiling, 0, W, H, H + 0.02, 0, NZ, cm, { cast: false, receive: false }); B(ceiling, 0, NX, H, H + 0.02, NZ, D, cm, { cast: false, receive: false }); }

// suelo
const shp = new THREE.Shape([[0, 0], [W, 0], [W, -NZ], [NX, -NZ], [NX, -D], [0, -D]].map(([x, y]) => new THREE.Vector2(x, y)));
const floor = new THREE.Mesh(new THREE.ShapeGeometry(shp), M.floor);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M.ground);
ground.rotation.x = -Math.PI / 2; ground.position.set(2.4, -0.012, 1.3); ground.receiveShadow = true; scene.add(ground);

// rodapié
const sk = (a) => { const m = B(scene, ...a, M.skirting); };
sk([0, W, 0, 0.07, 0, 0.012]); sk([0, 0.012, 0, 0.07, 0, D]); sk([DOOR1 + 0.05, NX, 0, 0.07, D - 0.012, D]);
sk([NX - 0.012, NX, 0, 0.07, NZ, D]); sk([NX, W, 0, 0.07, NZ - 0.012, NZ]);

// marco y hoja de la puerta de 80
const trim = (a) => B(wDoor, ...a, M.doorLeaf);
trim([DOOR0 - 0.06, DOOR0, 0, DOORH + 0.06, D - 0.015, D]); trim([DOOR1, DOOR1 + 0.06, 0, DOORH + 0.06, D - 0.015, D]);
trim([DOOR0 - 0.06, DOOR1 + 0.06, DOORH, DOORH + 0.06, D - 0.015, D]);
const doorPivot = new THREE.Group(); doorPivot.position.set(DOOR0 + 0.01, 0, D + 0.005); wDoor.add(doorPivot);
B(doorPivot, 0, DOOR1 - DOOR0 - 0.02, 0.005, DOORH - 0.005, 0, 0.04, M.doorLeaf);
[[-0.03], [0.07]].forEach(([z]) => { cyl(doorPivot, 0.011, 0.13, M.chrome, 0.70, 1.02, z).rotation.x = 0; B(doorPivot, 0.62, 0.72, 1.005, 1.035, z < 0 ? z - 0.01 : z, z < 0 ? z + 0.01 : z + 0.02, M.chrome); });

// ventana fija (sobre la encimera) + puerta del patio
const win = new THREE.Group(); scene.add(win);
B(win, W, W + T, WINH - 0.05, WINH, WIN0, WIN1, M.alu);                       // dintel
B(win, W, W + T, 0, WINH, WIN0, WIN0 + 0.05, M.alu); B(win, W, W + T, 0, WINH, WIN1 - 0.05, WIN1, M.alu);
B(win, W, W + T, 0, WINH, WSPLIT, WSPLIT + 0.05, M.alu);                      // montante central
B(win, W - 0.02, W + T, SILL - 0.03, SILL, WIN0, WSPLIT, M.alu);              // vierteaguas / marco inferior fija
B(win, W, W + T, 0, 0.02, WSPLIT, WIN1, M.alu);                               // umbral
{ const gl = B(win, W + 0.045, W + 0.053, SILL, WINH - 0.05, WIN0 + 0.05, WSPLIT, M.glass); gl.castShadow = false; }
const patioDoor = new THREE.Group(); patioDoor.position.set(W + 0.07, 0, WSPLIT + 0.05); scene.add(patioDoor);
{ const lw = WIN1 - 0.05 - (WSPLIT + 0.05), lx0 = -0.06, lx1 = 0;
  B(patioDoor, lx0, lx1, 0.02, WINH - 0.05, 0, 0.07, M.alu); B(patioDoor, lx0, lx1, 0.02, WINH - 0.05, lw - 0.07, lw, M.alu);
  B(patioDoor, lx0, lx1, 0.02, 0.14, 0, lw, M.alu); B(patioDoor, lx0, lx1, WINH - 0.12, WINH - 0.05, 0, lw, M.alu);
  const gl = B(patioDoor, -0.034, -0.026, 0.14, WINH - 0.12, 0.07, lw - 0.07, M.glass); gl.castShadow = false;
  B(patioDoor, -0.09, -0.06, 1.0, 1.02, lw - 0.16, lw - 0.05, M.chrome); }
/* ───────── Patio ───────── */
const patio = new THREE.Group(); scene.add(patio);
const pf = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6.2), M.patio); pf.rotation.x = -Math.PI / 2; pf.position.set(W + T + 2.1, -0.004, 1.0); pf.receiveShadow = true; patio.add(pf);
B(patio, W + T, W + T + 4.2, 0, 1.1, -2.2, -2.08, M.patioWall); B(patio, W + T + 4.08, W + T + 4.2, 0, 1.1, -2.2, 4.1, M.patioWall);
function naranjo(x, z, s = 1) {
  cyl(patio, 0.2 * s, 0.42 * s, M.terracotta, x, 0.21 * s, z, 24, 0.26 * s);
  cyl(patio, 0.035 * s, 0.8 * s, M.board, x, 0.8 * s, z, 10);
  const fol = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46 * s, 1), M.leaf); fol.position.set(x, 1.45 * s, z); fol.castShadow = true; patio.add(fol);
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, b = rnd() * 1.2 - .3; const o = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 12, 10), M.orange); o.position.set(x + Math.cos(a) * Math.cos(b) * 0.44 * s, 1.45 * s + Math.sin(b) * 0.4 * s, z + Math.sin(a) * Math.cos(b) * 0.44 * s); patio.add(o); }
}
naranjo(W + 1.5, -1.35); naranjo(W + 3.4, 2.9, 1.15);
// tendedero plegable
(() => { const g = new THREE.Group(); const x0 = W + 1.9, z0 = 2.4;
  for (let i = 0; i < 6; i++) B(g, x0, x0 + 1.0, 0.95, 0.955, z0 + i * 0.1, z0 + i * 0.1 + 0.006, M.chrome);
  [[0, 0], [1.0, 0], [0, 0.5], [1.0, 0.5]].forEach(([dx, dz]) => B(g, x0 + dx - .008, x0 + dx + .008, 0, 0.95, z0 + dz - .008, z0 + dz + .008, M.chrome));
  patio.add(g); })();

/* ───────── Nevera LG side-by-side (común a ambas distribuciones) ───────── */
const anim = []; // {obj, key, closed, open}
const fridge = new THREE.Group(); scene.add(fridge);
(() => {
  const g = new THREE.Group();
  const bodyD = FR.d - 0.095;
  RB(g, 0, FR.w, 0.03, FR.h, 0, bodyD, M.steelDark, 0.01);
  B(g, 0.02, FR.w - 0.02, 0, 0.09, bodyD - 0.02, bodyD + 0.005, M.dark);
  // interior (visible con puertas abiertas)
  const inner = std('#f2f3f3', 0.4);
  B(g, 0.03, FR.w - 0.03, 0.12, FR.h - 0.04, bodyD - 0.02, bodyD + 0.001, inner, { cast: false });
  for (let i = 0; i < 4; i++) B(g, 0.44, FR.w - 0.03, 0.45 + i * 0.3, 0.456 + i * 0.3, bodyD - 0.5, bodyD, M.glass);
  B(g, 0.425, 0.435, 0.12, FR.h - 0.04, bodyD - 0.55, bodyD + 0.001, inner);
  // puertas: pivote en la arista exterior delantera
  const mkDoor = (w, sign) => {
    const p = new THREE.Group(); const d = new THREE.Group(); p.add(d);
    const x0 = sign > 0 ? 0 : -w, x1 = sign > 0 ? w : 0;
    RB(d, x0, x1, 0.095, FR.h - 0.005, -0.095, 0, M.steel, 0.012);
    const hx = sign > 0 ? x1 - 0.035 : x0 + 0.02;
    B(d, hx, hx + 0.015, 0.55, 1.5, -0.004, 0.003, M.dark);
    return p;
  };
  const fz = mkDoor(0.425, 1); fz.position.set(0, 0, FR.d); g.add(fz);
  const fg = mkDoor(FR.w - 0.428, -1); fg.position.set(FR.w, 0, FR.d); g.add(fg);
  // dispensador de agua y hielo en la puerta del congelador
  B(fz, 0.08, 0.34, 0.98, 1.34, -0.01, 0.004, M.blackGlass); B(fz, 0.16, 0.26, 1.28, 1.31, 0.004, 0.006, M.display);
  // interior de puertas
  B(fz, 0.03, 0.40, 0.25, FR.h - 0.08, -0.12, -0.095, inner, { cast: false });
  B(fg, -0.46, -0.03, 0.25, FR.h - 0.08, -0.12, -0.095, inner, { cast: false });
  const fgA = { obj: fg.rotation, key: 'y', closed: 0, open: 1.57 };
  anim.push({ obj: fz.rotation, key: 'y', closed: 0, open: -1.9 }, fgA); fridge.userData.fgAnim = fgA;
  // cuerpo local: frente +z; se orienta mirando a -x
  fridge.userData.body = g;
  fridge.add(g);
})();
anim.push({ obj: doorPivot.rotation, key: 'y', closed: 0, open: 1.5 }, { obj: patioDoor.rotation, key: 'y', closed: 0, open: -1.45 });

// Posición de la nevera: 'hueco' (nicho de 95 cm del quiebro) o 'entrada' (pared izquierda, solo opción C)
const FZ_ENT = 0.66, FX_ENT = 0.05;
// Pared de 3,42: despensa 80 · nevera en hueco de 96 · torre horno 60 (x 1,00 → 3,40)
const FP_HX0 = 1.82, FP_HX1 = 2.78, FPX1 = (FP_HX0 + FP_HX1) / 2 + FR.w / 2, FPZ = D - FR.back - FR.d;
const fridgeMode = () => state.layout === 'C' ? state.fridgePos : 'hueco';
function placeFridge() {
  const b = fridge.userData.body;
  const m = fridgeMode();
  if (m === 'hueco') place(b, FRX1, FRZ0, -Math.PI / 2);
  else if (m === 'entrada') place(b, FX_ENT, FZ_ENT + FR.w, Math.PI / 2);
  else place(b, FPX1, D - FR.back, Math.PI);           // pared de 3,42 mirando a la encimera
  fridge.userData.fgAnim.open = m === 'pared' ? 1.9 : 1.57;
}

/* ───────── Módulos ───────── */
const Z_CAR = 0.56, Z_FR = 0.58, Y_PL = 0.14, Y_CT = 0.86, Y_TOP = 0.90;
function baseModule(g, x0, w, type, mats, animList) {
  const x1 = x0 + w, gap = 0.004;
  if (type !== 'dw') B(g, x0, x1, Y_PL, Y_CT, 0, Z_CAR, M.carcass);
  B(g, x0 + 0.002, x1 - 0.002, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
  const heights = { drawers3: [0.18, 0.27, 0.27], drawers2: [0.36, 0.36], doors2: [0.72], door1: [0.72], blind: [0.72] }[type];
  if (type === 'oven') {
    B(g, x0, x1, Y_PL, Y_CT, 0, Z_CAR, M.carcass);
    B(g, x0 + gap, x1 - gap, Y_PL + gap, 0.25, Z_CAR, Z_FR, mats.low);
    B(g, x0 + gap, x1 - gap, 0.254, Y_CT - gap, Z_CAR, Z_FR, M.blackGlass);
    B(g, x0 + 0.02, x1 - 0.02, 0.76, Y_CT - 0.01, Z_FR, Z_FR + 0.004, M.steel);
    B(g, x0 + 0.1, x1 - 0.1, 0.72, 0.735, Z_FR + 0.02, Z_FR + 0.035, M.chrome);
    return;
  }
  if (type === 'dw') {
    B(g, x0 + 0.005, x1 - 0.005, Y_PL, Y_CT - 0.005, 0, Z_CAR, M.steel);
    B(g, x0 + 0.03, x1 - 0.03, 0.45, 0.46, 0.02, Z_CAR + 0.001, M.steelDark);
    const p = new THREE.Group(); p.position.set(x0, Y_PL, Z_FR); g.add(p);
    B(p, gap, w - gap, gap, 0.72 - gap, -0.02, 0, mats.low);
    B(p, 0.02, w - 0.02, 0.02, 0.70, -0.03, -0.02, M.steel, { cast: false });
    animList.push({ obj: p.rotation, key: 'x', closed: 0, open: 1.45 });
    return;
  }
  let top = Y_CT;
  for (const h of heights) {
    const y1 = top - gap, y0 = top - h + gap;
    if (type === 'doors2') { B(g, x0 + gap, x0 + w / 2 - gap / 2, y0, y1, Z_CAR, Z_FR, mats.low); B(g, x0 + w / 2 + gap / 2, x1 - gap, y0, y1, Z_CAR, Z_FR, mats.low); }
    else B(g, x0 + gap, x1 - gap, y0, y1, Z_CAR, Z_FR, mats.low);
    top -= h;
  }
}
function wallModule(g, x0, w, type, mats, y0 = 1.45, y1 = 2.17) {
  const x1 = x0 + w, gap = 0.004;
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
function worktop(g, x0, x1, z0, z1, alongZ = false) { return B(g, x0, x1, Y_CT, Y_TOP, z0, z1, surfMat(x1 - x0, z1 - z0, alongZ)); }
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
  // grifo
  const tz = z0 - 0.06;
  cyl(g, 0.026, 0.03, M.chrome, xc, Y_TOP + 0.015, tz); cyl(g, 0.013, 0.34, M.chrome, xc, Y_TOP + 0.17, tz);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.013, 12, 32, Math.PI), M.chrome);
  arc.rotation.y = -Math.PI / 2; arc.position.set(xc, Y_TOP + 0.34, tz + 0.1); arc.castShadow = true; g.add(arc);
  cyl(g, 0.013, 0.06, M.chrome, xc, Y_TOP + 0.31, tz + 0.2);
  B(g, xc + 0.02, xc + 0.1, Y_TOP + 0.2, Y_TOP + 0.21, tz - 0.005, tz + 0.005, M.chrome);
}
function hob(g, xc, zc) { B(g, xc - 0.295, xc + 0.295, Y_TOP, Y_TOP + 0.006, zc - 0.26, zc + 0.26, M.hob); }
function worktopWithSink(g, x0, x1, sx) {
  const a = sx - 0.27, b = sx + 0.27, z0 = 0.11, z1 = 0.51;
  worktop(g, x0, a, 0, 0.62); worktop(g, b, x1, 0, 0.62); worktop(g, a, b, 0, z0); worktop(g, a, b, z1, 0.62);
}
// Lavadora / secadora 60 cm (frente local +z)
function washer(kind, animList) {
  const g = new THREE.Group(), w = 0.597, d = kind === 'dryer' ? 0.60 : 0.565, h = 0.85;
  RB(g, 0, w, 0, h, 0, d, M.white, 0.014);
  B(g, 0.02, w - 0.02, 0.73, 0.735, d - 0.001, d + 0.002, M.applPlastic);
  if (kind === 'washer') B(g, 0.03, 0.2, 0.755, 0.83, d, d + 0.006, M.applPlastic);
  else B(g, 0.03, 0.26, 0.755, 0.83, d, d + 0.006, M.applPlastic);
  B(g, 0.3, 0.42, 0.775, 0.81, d, d + 0.004, M.display);
  const dial = cyl(g, 0.032, 0.02, M.chrome, 0.51, 0.79, d + 0.01); dial.rotation.x = Math.PI / 2;
  const cx = w / 2, cy = 0.42, R = 0.19;
  const p = new THREE.Group(); p.position.set(cx - R, cy, d + 0.01); g.add(p);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.028, 16, 48), kind === 'dryer' ? M.applPlastic : M.chrome);
  ring.position.set(R, 0, 0.012); ring.castShadow = true; p.add(ring);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.035, R - 0.035, 0.02, 40), M.portGlass);
  glass.rotation.x = Math.PI / 2; glass.position.set(R, 0, 0.012); p.add(glass);
  B(g, cx - 0.14, cx + 0.14, cy - 0.14, cy + 0.14, d - 0.02, d - 0.001, M.steelDark, { cast: false });
  animList.push({ obj: p.rotation, key: 'y', closed: 0, open: -1.7 });
  return g;
}
function tag(parent, text, dims, x, y, z) {
  const el = document.createElement('div'); el.className = 'tag'; el.innerHTML = `<b>${text}</b><span>${dims}</span>`;
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

/* ───────── Muro de armarios en la pared de 3,42 (opción C · nevera mirando a la encimera) ───────── */
function buildTallWall(parent, mats) {
  // Local: x crece desde la esquina (x mundo 3,40) hacia la puerta; frente hacia +z local (= hacia la encimera)
  const t = new THREE.Group(), TOPY = 2.17, gap = 0.004;
  const lx = wx => 3.40 - wx;                         // mundo → local
  // Torre horno + microondas (x mundo 2,80–3,40)
  B(t, 0, 0.60, Y_PL, TOPY, 0, Z_CAR, M.carcass); B(t, 0.002, 0.598, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
  B(t, gap, 0.60 - gap, Y_PL + gap, 0.44, Z_CAR, Z_FR, mats.low);
  B(t, gap, 0.60 - gap, 0.446, 1.03, Z_CAR, Z_FR, M.blackGlass); B(t, 0.02, 0.58, 0.95, 1.02, Z_FR, Z_FR + 0.004, M.steel);
  B(t, 0.10, 0.50, 0.98, 1.0, Z_FR + 0.02, Z_FR + 0.035, M.chrome);
  B(t, gap, 0.60 - gap, 1.036, 1.43, Z_CAR, Z_FR, M.blackGlass); B(t, 0.02, 0.58, 1.036, 1.07, Z_FR, Z_FR + 0.004, M.steel);
  B(t, gap, 0.60 - gap, 1.436, TOPY - gap, Z_CAR, Z_FR, mats.high);
  // Laterales que enmarcan la nevera + mueble alto encima (5 cm de ventilación sobre la nevera)
  const p0 = lx(FP_HX1), p1 = lx(FP_HX0);
  B(t, p0, p0 + 0.02, 0, TOPY, 0, 0.64, mats.low); B(t, p1 - 0.02, p1, 0, TOPY, 0, 0.64, mats.low);
  B(t, p0 + 0.02, p1 - 0.02, FR.h + 0.05, TOPY, 0, Z_CAR, M.carcass);
  B(t, p0 + 0.02 + gap, (p0 + p1) / 2 - gap / 2, FR.h + 0.05 + gap, TOPY - gap, Z_CAR, Z_FR, mats.high);
  B(t, (p0 + p1) / 2 + gap / 2, p1 - 0.02 - gap, FR.h + 0.05 + gap, TOPY - gap, Z_CAR, Z_FR, mats.high);
  B(t, p0 + 0.06, p1 - 0.06, FR.h + 0.055, FR.h + 0.075, Z_FR, Z_FR + 0.004, M.dark);   // rejilla de ventilación
  // Despensa de 80 (x mundo 1,00–1,80)
  const d0 = lx(1.80), d1 = lx(1.00);
  B(t, d0, d1, Y_PL, TOPY, 0, Z_CAR, M.carcass); B(t, d0 + 0.002, d1 - 0.002, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
  [[Y_PL, 1.30, mats.low], [1.30, TOPY, mats.high]].forEach(([y0, y1, m]) => {
    B(t, d0 + gap, (d0 + d1) / 2 - gap / 2, y0 + gap, y1 - gap, Z_CAR, Z_FR, m); B(t, (d0 + d1) / 2 + gap / 2, d1 - gap, y0 + gap, y1 - gap, Z_CAR, Z_FR, m);
  });
  B(t, d1, d1 + 0.02, 0, TOPY, 0, Z_FR, mats.low);
  place(t, 3.40, D, Math.PI);
  parent.add(t);
  tag(parent, 'Torre horno + micro', 'columna 60', 3.10, 2.35, D - 0.3);
  tag(parent, 'Despensa', '80 × 217', 1.40, 2.35, D - 0.3);
}

/* ───────── Distribuciones ───────── */
let layoutGroup = null, layoutAnim = [];
function buildLayout() {
  if (layoutGroup) { layoutGroup.traverse(o => { if (o.isCSS2DObject) o.element.remove(); }); scene.remove(layoutGroup); }
  ledLights.clear();
  layoutGroup = new THREE.Group(); layoutAnim = []; seed = 11;
  const g = layoutGroup, mats = { low: frontMat('low'), high: frontMat('high'), plinth: plinthMat() };
  const top = new THREE.Group(); g.add(top);
  const addLed = (x, z) => { const l = new THREE.RectAreaLight('#ffd9a6', 0, 0.5, 0.03); l.position.set(x, 1.44, z); l.rotation.x = -Math.PI / 2; ledLights.add(l); };

  if (state.layout === 'A') {
    // Frente de 4,78: esquina · cajonera · fregadero · lavavajillas · especiero · placa · cajonera
    const mods = [[0, 0.60, 'blind'], [0.60, 0.60, 'drawers3'], [1.20, 0.80, 'doors2'], [2.00, 0.60, 'dw'], [2.60, 0.30, 'door1'], [2.90, 0.60, 'drawers2'], [3.50, 0.60, 'drawers3'], [4.10, 0.60, 'drawers3']];
    mods.forEach(([x, w, t]) => baseModule(top, x, w, t, mats, layoutAnim));
    B(top, 4.70, W, 0, Y_CT, 0, Z_FR, mats.low);
    worktopWithSink(top, 0, W, 1.60);
    sink(top, 1.60, 0.31); hob(top, 3.20, 0.31);
    [[0, 0.60, 'door1'], [0.60, 0.60, 'door1'], [1.20, 0.80, 'doors2'], [2.00, 0.60, 'door1'], [2.60, 0.30, 'door1'], [2.90, 0.60, 'hood'], [3.50, 0.63, 'door1']].forEach(([x, w, t]) => wallModule(top, x, w, t, mats));
    backsplash(top, 0, W, Y_TOP, 1.45, 0);
    [0.9, 1.6, 2.4, 3.8].forEach(x => addLed(x, 0.3));
    // Brazo izquierdo: lavadora + secadora bajo encimera
    const left = new THREE.Group(); g.add(left);
    left.add(place(washer('washer', layoutAnim), 0.015, 1.205, Math.PI / 2));
    left.add(place(washer('dryer', layoutAnim), 0.015, 1.815, Math.PI / 2));
    B(left, 0, 0.62, 0, Y_CT, 1.815, 1.835, mats.low);
    B(left, 0, 0.62, Y_CT - 0.012, Y_CT, 0.62, 1.815, M.carcass, { cast: false });
    worktop(left, 0, 0.62, 0.62, 1.835, true);
    backsplash(left, 0.62, 1.835, Y_TOP, 1.45, 0, true);
    // baldas de roble sobre la lavandería
    const shelfM = surfMat(0.26, 1.2, true);
    [1.55, 1.92].forEach(y => B(left, 0, 0.26, y, y + 0.03, 0.66, 1.80, shelfM));
    [[0.8, 1.55], [1.05, 1.55], [1.5, 1.92], [1.25, 1.92]].forEach(([z, y], i) => { const c = [M.ceramic, M.white, M.board, M.ceramic][i]; cyl(left, 0.06, 0.18, c, 0.12, y + 0.12, z, 20); });
    fruitBowl(g, 0.9, 0.33); board(g, 2.3, 0.3); pot(g, 3.08, 0.2);
    plant(g, 4.55, 0.3, Y_TOP, 0.6);
    tag(g, 'Lavavajillas 60', '59,8 × 55 × 82', 2.30, 1.02, 0.55);
    tag(g, 'Lavadora 60', '59,7 × 56,5 × 85', 0.35, 1.02, 0.9);
    tag(g, 'Secadora 60', '59,7 × 60 × 85', 0.35, 1.02, 1.5);
    tag(g, 'Placa + campana', '60 cm', 3.20, 1.62, 0.3);
    tag(g, 'Fregadero', '80 cm', 1.60, 1.10, 0.3);
    document.getElementById('st-enc').textContent = '7,09 m';
  } else if (state.layout === 'C') {
    // Tomas de agua y desagüe en la mitad derecha de la pared de 4,78 (x ≥ 2,39).
    // Orden: rincón · placa · cajonera · fregadero 90 · lavavajillas · lavadora · secadora (al final, junto a la ventana)
    const ent = fridgeMode() === 'entrada', par = fridgeMode() === 'pared';
    const mods = [[0, 0.80, par ? 'drawers3' : 'blind'], [0.80, 0.60, ent ? 'oven' : 'drawers2'], [1.40, 0.60, 'drawers3'], [2.00, 0.90, 'doors2'], [2.90, 0.60, 'dw']];
    mods.forEach(([x, w, t]) => baseModule(top, x, w, t, mats, layoutAnim));
    top.add(place(washer('washer', layoutAnim), 3.5015, 0.02));
    top.add(place(washer('dryer', layoutAnim), 4.1015, 0.02));
    B(top, 3.50, 4.70, Y_CT - 0.012, Y_CT, 0, 0.6, M.carcass, { cast: false });
    B(top, 4.70, W, 0, Y_CT, 0, Z_FR, mats.low);
    worktopWithSink(top, 0, W, 2.45);
    sink(top, 2.45, 0.31); hob(top, 1.10, 0.31);
    [[0, 0.80, 'doors2'], [0.80, 0.60, 'hood'], [1.40, 0.60, 'door1'], [2.00, 0.90, 'doors2'], [2.90, 0.60, 'door1'], [3.50, 0.63, 'door1']].forEach(([x, w, t]) => wallModule(top, x, w, t, mats));
    backsplash(top, 0, W, Y_TOP, 1.45, 0);
    [0.5, 1.7, 2.45, 3.3, 3.9].forEach(x => addLed(x, 0.3));
    if (par) {
      buildTallWall(g, mats);
    } else if (!ent) {
      // Pared izquierda: columna horno + microondas (junto a la placa) y despensa (junto a la entrada)
      const cols = new THREE.Group(); g.add(cols);
      B(cols, 0, 1.20, Y_PL, 2.17, 0, Z_CAR, M.carcass); B(cols, 0.002, 1.198, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
      B(cols, 0.004, 0.596, Y_PL + 0.004, 1.22, Z_CAR, Z_FR, mats.low); B(cols, 0.004, 0.596, 1.228, 2.166, Z_CAR, Z_FR, mats.high);
      B(cols, 0.604, 1.196, Y_PL + 0.004, 0.44, Z_CAR, Z_FR, mats.low);
      B(cols, 0.604, 1.196, 0.446, 1.03, Z_CAR, Z_FR, M.blackGlass); B(cols, 0.62, 1.18, 0.95, 1.02, Z_FR, Z_FR + 0.004, M.steel);
      B(cols, 0.70, 1.10, 0.98, 1.0, Z_FR + 0.02, Z_FR + 0.035, M.chrome);
      B(cols, 0.604, 1.196, 1.036, 1.43, Z_CAR, Z_FR, M.blackGlass); B(cols, 0.62, 1.18, 1.036, 1.07, Z_FR, Z_FR + 0.004, M.steel);
      B(cols, 0.604, 1.196, 1.436, 2.166, Z_CAR, Z_FR, mats.high);
      B(cols, 1.20, 1.22, 0, 2.17, 0, Z_FR, mats.low);
      place(cols, 0, 1.83, Math.PI / 2);
      tag(g, 'Horno + micro', 'columna 60', 0.3, 2.3, 0.93);
      tag(g, 'Despensa', '60 × 217', 0.3, 2.3, 1.53);
    } else {
      // El hueco de 95 cm pasa a ser una despensa de 90 cm (frente hacia la cocina)
      const pan = new THREE.Group(); g.add(pan);
      B(pan, 0, 0.91, Y_PL, 2.17, 0, Z_CAR, M.carcass); B(pan, 0.002, 0.908, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
      [[Y_PL, 1.30, mats.low], [1.30, 2.17, mats.high]].forEach(([y0, y1, m]) => { B(pan, 0.004, 0.453, y0 + 0.004, y1 - 0.004, Z_CAR, Z_FR, m); B(pan, 0.457, 0.906, y0 + 0.004, y1 - 0.004, Z_CAR, Z_FR, m); });
      place(pan, NX - 0.02, NZ + 0.02, -Math.PI / 2);
      tag(g, 'Despensa 90', 'en el hueco de 95', NX - 0.3, 2.35, NZ + 0.475);
    }
    fruitBowl(g, 0.35, 0.33); board(g, 1.7, 0.3); pot(g, 0.98, 0.2);
    plant(g, 4.62, 0.26, Y_TOP, 0.5);
    tag(g, 'Fregadero', '90 cm', 2.45, 1.10, 0.3);
    tag(g, 'Lavavajillas 60', '59,8 × 55 × 82', 3.20, 1.02, 0.55);
    tag(g, 'Lavadora 60', '59,7 × 56,5 × 85', 3.80, 0.72, 1.0);
    tag(g, 'Secadora 60', '59,7 × 60 × 85', 4.40, 1.02, 0.55);
    tag(g, ent ? 'Placa + horno debajo' : 'Placa + campana', '60 cm', 1.10, 1.62, 0.3);
    document.getElementById('st-enc').textContent = '4,78 m';
  } else {
    // Frente largo completo: despensa alta · cajonera · fregadero · lavavajillas · placa · cajoneras hasta la ventana
    const mods = [[0.60, 0.60, 'drawers3'], [1.20, 0.80, 'doors2'], [2.00, 0.60, 'dw'], [2.60, 0.60, 'drawers2'], [3.20, 0.30, 'door1'], [3.50, 0.60, 'drawers3'], [4.10, 0.60, 'drawers3']];
    mods.forEach(([x, w, t]) => baseModule(top, x, w, t, mats, layoutAnim));
    B(top, 4.70, W, 0, Y_CT, 0, Z_FR, mats.low);
    B(top, 0, 0.60, Y_PL, 2.17, 0, Z_CAR, M.carcass); B(top, 0.002, 0.598, 0, Y_PL, 0, Z_FR - 0.06, mats.plinth);
    B(top, 0.004, 0.596, Y_PL + 0.004, 1.22, Z_CAR, Z_FR, mats.low); B(top, 0.004, 0.596, 1.228, 2.166, Z_CAR, Z_FR, mats.high);
    worktopWithSink(top, 0.60, W, 1.60);
    sink(top, 1.60, 0.31); hob(top, 2.90, 0.31);
    [[0.60, 0.60, 'door1'], [1.20, 0.80, 'doors2'], [2.00, 0.60, 'door1'], [2.60, 0.60, 'hood'], [3.20, 0.30, 'door1'], [3.50, 0.63, 'door1']].forEach(([x, w, t]) => wallModule(top, x, w, t, mats));
    backsplash(top, 0.60, W, Y_TOP, 1.45, 0);
    [0.9, 1.6, 2.3, 3.4, 3.9].forEach(x => addLed(x, 0.3));
    // Columna de lavado en la pared izquierda (mira hacia la cocina)
    const col = new THREE.Group(); g.add(col);
    const cz0 = 0.64, cz1 = cz0 + 0.65, cd = 0.66;
    B(col, 0, cd, 0, 2.17, cz0, cz0 + 0.019, mats.high); B(col, 0, cd, 0, 2.17, cz1 - 0.019, cz1, mats.high);
    B(col, 0, cd - 0.02, 1.76, 2.17, cz0 + 0.019, cz1 - 0.019, M.carcass); B(col, cd - 0.02, cd, 1.764, 2.166, cz0 + 0.02, cz1 - 0.02, mats.high);
    B(col, 0.03, cd - 0.02, 0.85, 0.87, cz0 + 0.019, cz1 - 0.019, M.steelDark);
    col.add(place(washer('washer', layoutAnim), 0.035, cz1 - 0.026, Math.PI / 2));
    col.add(place(washer('dryer', layoutAnim), 0.035, cz1 - 0.026, Math.PI / 2, 0.87));
    // balda junto a la entrada
    B(g, 0, 0.24, 1.55, 1.58, 1.36, 1.80, surfMat(0.24, 0.44, true));
    plant(g, 0.12, 1.58, 1.58, 0.6); cyl(g, 0.05, 0.16, M.ceramic, 0.12, 1.66, 1.42, 20);
    fruitBowl(g, 3.9, 0.33); board(g, 2.3, 0.3); pot(g, 2.78, 0.2);
    plant(g, 4.55, 0.3, Y_TOP, 0.6);
    tag(g, 'Lavavajillas 60', '59,8 × 55 × 82', 2.30, 1.02, 0.55);
    tag(g, 'Columna lavado', 'Lavadora + secadora apiladas', 0.33, 2.35, (cz0 + cz1) / 2);
    tag(g, 'Placa + campana', '60 cm', 2.90, 1.62, 0.3);
    tag(g, 'Despensa', '60 × 217', 0.3, 2.3, 0.3);
    document.getElementById('st-enc').textContent = '5,28 m';
  }
  // Mueble cubre-calentador (Junkers de gas) al final de los altos de la pared de 4,78.
  // Abierto por abajo, rejillas en la puerta y chimenea saliendo por arriba.
  {
    const x0 = 4.13, x1 = 4.58, yb = 1.45, yt = 2.17, dz = 0.35, cal = new THREE.Group(); g.add(cal);
    B(cal, x0, x0 + 0.018, yb, yt, 0, dz - 0.02, M.carcass); B(cal, x1 - 0.018, x1, yb, yt, 0, dz - 0.02, M.carcass);
    B(cal, x0, x1, yt - 0.018, yt, 0, dz - 0.02, M.carcass); B(cal, x0, x1, yb, yt, 0, 0.006, M.carcass);
    RB(cal, 4.20, 4.51, 1.53, 2.07, 0.02, 0.25, M.white, 0.02);
    B(cal, 4.30, 4.41, 1.60, 1.63, 0.25, 0.253, M.display);
    cyl(cal, 0.05, 0.40, M.steel, 4.355, 2.27, 0.13, 20);
    const el = cyl(cal, 0.05, 0.14, M.steel, 4.355, 2.45, 0.06, 20); el.rotation.x = Math.PI / 2;
    [4.26, 4.355, 4.45].forEach(x => cyl(cal, 0.009, 0.12, x === 4.355 ? M.board : M.chrome, x, 1.47, 0.08, 10));
    const dp = new THREE.Group(); dp.position.set(x1, 0, dz); cal.add(dp);
    B(dp, -(x1 - x0) + 0.004, -0.004, yb + 0.004, yt - 0.004, -0.02, 0, mats.high);
    for (let i = 0; i < 6; i++) { const y = yb + 0.05 + i * 0.018; B(dp, -(x1 - x0) + 0.07, -0.07, y, y + 0.006, 0, 0.002, M.dark); B(dp, -(x1 - x0) + 0.07, -0.07, yt - 0.06 - i * 0.018, yt - 0.054 - i * 0.018, 0, 0.002, M.dark); }
    layoutAnim.push({ obj: dp.rotation, key: 'y', closed: 0, open: 1.6 });
    tag(g, 'Mueble calentador', 'Junkers de gas · 45 cm', 4.36, 2.35, 0.2);
  }
  if (state.layout !== 'C') {
    // Muebles en la pared de enfrente (la de la puerta), entre la puerta y la nevera.
    // Acaban 50 cm antes de la nevera para que su puerta del lado de la pared abra a 90°.
    const opp = new THREE.Group(); g.add(opp);
    baseModule(opp, 0, 0.60, 'drawers3', mats, layoutAnim); baseModule(opp, 0.60, 0.50, 'door1', mats, layoutAnim);
    B(opp, -0.02, 0, 0, Y_CT, 0, Z_FR, mats.low); B(opp, 1.10, 1.12, 0, Y_CT, 0, Z_FR, mats.low);
    worktop(opp, -0.02, 1.12, 0, 0.62);
    backsplash(opp, -0.02, 1.12, Y_TOP, 1.45, 0);
    wallModule(opp, 0, 0.60, 'doors2', mats); wallModule(opp, 0.60, 0.50, 'door1', mats);
    // microondas y cafetera
    B(opp, 0.08, 0.56, Y_TOP, Y_TOP + 0.28, 0.06, 0.42, M.steelDark); B(opp, 0.12, 0.42, Y_TOP + 0.05, Y_TOP + 0.24, 0.42, 0.425, M.blackGlass);
    B(opp, 0.75, 0.93, Y_TOP, Y_TOP + 0.32, 0.08, 0.34, M.dark); cyl(opp, 0.05, 0.1, M.chrome, 0.84, Y_TOP + 0.06, 0.4, 20);
    place(opp, 2.10, D, Math.PI);
    [1.3, 1.8].forEach(x => addLed(x, D - 0.3));
    tag(g, 'Muebles bajos + altos', '110 cm · paso 1,40 m', 1.55, 1.62, D - 0.3);
  }
  if (fridgeMode() === 'hueco') tag(g, 'Nevera LG americana', '91,3 × 73,5 × 179', FRX0 + FR.d / 2, FR.h + 0.18, FRZ0 + FR.w / 2);
  else if (fridgeMode() === 'entrada') tag(g, 'Nevera LG americana', '91,3 × 73,5 × 179', FX_ENT + FR.d / 2, FR.h + 0.18, FZ_ENT + FR.w / 2);
  else tag(g, 'Nevera LG empotrada', '91,3 × 73,5 × 179', (FP_HX0 + FP_HX1) / 2, 1.62, FPZ + 0.2);
  placeFridge();
  document.getElementById('fridge-group').hidden = state.layout !== 'C';
  scene.add(g);
  g.traverse(o => { if (o.isCSS2DObject) o.visible = state.tags; });
  applyNight(); renderInfo();
  const p = state.open ? 1 : 0; allAnim().forEach(a => a.obj[a.key] = a.closed + (a.open - a.closed) * p);
}
const allAnim = () => anim.concat(layoutAnim);

/* ───────── Zona de tomas de agua ───────── */
const water = new THREE.Group(); scene.add(water);
{ const x0 = W / 2, x1 = W, geo = new THREE.BoxGeometry(x1 - x0, 0.95, 0.66);
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#3aa0e0', transparent: true, opacity: 0.1, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#2b8fd6' }));
  [fill, edges].forEach(m => { m.position.set((x0 + x1) / 2, 0.475, 0.33); water.add(m); });
  const el = document.createElement('div'); el.className = 'tag water'; el.innerHTML = '<b>Tomas de agua y desagüe</b><span>mitad de la pared de 4,78 hacia el patio</span>';
  const lab = new CSS2DObject(el); lab.position.set(2.9, 0.1, 1.08); water.add(lab); water.userData.label = lab; }
function syncWater() {
  water.visible = state.water; water.userData.label.visible = state.water && state.tags;
  // en calidad alta la mezcla se hace en espacio lineal: se baja la opacidad para que se vea igual
  water.children.forEach(c => { if (c.isMesh) c.material.opacity = state.hq ? (state.night ? 0.012 : 0.04) : 0.1; });
}

/* ───────── Cotas ───────── */
const dims = new THREE.Group(); scene.add(dims);
const dimMat = new THREE.LineBasicMaterial({ color: '#b8893f', toneMapped: false });
function dim(a, b, text, inner = false, off = [0, 0, 0]) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const pts = [A, Bv]; const dir = Bv.clone().sub(A).normalize(); const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.07);
  const geo = new THREE.BufferGeometry().setFromPoints([A, Bv, A.clone().add(perp), A.clone().sub(perp), Bv.clone().add(perp), Bv.clone().sub(perp)]);
  geo.setIndex([0, 1, 2, 3, 4, 5]);
  dims.add(new THREE.LineSegments(geo, dimMat));
  const el = document.createElement('div'); el.className = 'dim' + (inner ? ' in' : ''); el.textContent = text;
  const o = new CSS2DObject(el); o.position.copy(A).add(Bv).multiplyScalar(0.5).add(new THREE.Vector3(...off)); dims.add(o);
}
const y0 = 0.02, o = 0.32;
dim([0, y0, -o], [W, y0, -o], DIM_LABELS.W);
dim([-o, y0, 0], [-o, y0, D], DIM_LABELS.D);
dim([0, y0, D + o], [NX, y0, D + o], DIM_LABELS.NX);
dim([NX + o, y0, NZ], [NX + o, y0, D], DIM_LABELS.notch);
dim([NX, y0, NZ + o], [W, y0, NZ + o], DIM_LABELS.notchTop);
dim([W + o, y0, 0], [W + o, y0, NZ], DIM_LABELS.window);
dim([DOOR0, y0, D + 0.12], [DOOR1, y0, D + 0.12], 'puerta 0,80', true);
dim([2.4, y0, 0.62], [2.4, y0, FRZ0], 'paso 1,09', true);
const nicheDim = dims.children.slice(-2);
dim([1.55, y0, 0.62], [1.55, y0, D - 0.62], 'paso 1,40', true);
const islandDim = dims.children.slice(-2);
dim([2.15, y0, 0.62], [2.15, y0, FPZ], 'paso 1,24', true);
const wallDim = dims.children.slice(-2);

/* ───────── Info del panel ───────── */
function renderInfo() {
  const L = state.layout, ent = fridgeMode() === 'entrada';
  const par = fridgeMode() === 'pared';
  const pick = o => (L === 'C' && ent && 'Ce' in o) ? o.Ce : (L === 'C' && par && 'Cp' in o) ? o.Cp : o[L];
  const apps = [
    ['Nevera LG americana', '91,3 × 73,5 × 179', par ? 'Dos puertas side-by-side (serie GSLV). En la pared de 3,42 mirando a la encimera, entre la despensa y la torre de hornos, con 2,3 cm a cada lado, 5 cm arriba y 5 cm detrás.' : ent ? 'Dos puertas side-by-side (serie GSLV). En la pared izquierda, junto a la entrada, con 5 cm de ventilación detrás. Mejor un modelo sin toma de agua (dispensador con depósito).' : 'Dos puertas side-by-side (serie GSLV, las habituales en España). Va en el hueco de 95 cm junto al quiebro, con 5 cm de ventilación detrás. Mejor un modelo sin toma de agua (dispensador con depósito).'],
    ['Fregadero', '80 cm', pick({ A: 'Hacia la mitad izquierda de la pared larga (centro a 1,60 m).', B: 'Hacia la mitad izquierda de la pared larga (centro a 1,60 m).', C: 'De 90 cm, con el desagüe a 2,45 m: justo al empezar la zona de tomas.' })],
    ['Lavavajillas integrable', '60 cm', pick({ A: 'Junto al fregadero. Frente panelado a juego.', B: 'Junto al fregadero. Frente panelado a juego.', C: 'Entre el fregadero y la lavadora, en la zona de tomas.' })],
    ['Lavadora', '59,7 × 56,5 × 85', pick({ A: 'Bajo encimera en el brazo izquierdo de la L.', B: 'Abajo en la columna de la pared izquierda, junto a la entrada.', C: 'Bajo encimera, la penúltima de la pared larga, sobre las tomas.' })],
    ['Secadora bomba de calor', '59,7 × 60 × 85', pick({ A: 'Al lado de la lavadora, bajo encimera. Elige una de 60 cm de fondo como máximo.', B: 'Encima de la lavadora con kit de unión. Admite fondos de hasta 65 cm.', C: 'Al final del mueble, junto a la ventana. El condensado va al desagüe de la lavadora o a su depósito.' })],
    ['Placa de inducción + campana', '60 cm', pick({ A: 'Entre fregadero y ventana, con 1,28 m de encimera libre hasta la ventana fija.', B: 'Entre lavavajillas y nevera, con 1,88 m de encimera libre hasta la ventana.', C: 'En la mitad izquierda, con 60 cm de encimera libre hasta el fregadero y la columna de horno y microondas al lado.', Ce: 'En la mitad izquierda, con el horno debajo. La puerta derecha de la nevera barre el frente de la placa al abrirse.', Cp: 'En la mitad izquierda, con 60 cm de encimera libre hasta el fregadero. El horno va en la torre junto a la nevera.' })],
  ];
  document.getElementById('apps').innerHTML = apps.map(([n, d, w]) => `<div class="row"><span class="n">${n}</span><span class="d">${d}</span><span class="w">${w}</span></div>`).join('');
  const checks = [
    pick({ A: ['warn', 'Obra', 'Tomas de agua', 'Fregadero, lavavajillas y lavadora quedan lejos de las tomas: hay que llevar agua y desagüe de 1 a 4 m, con pendiente en el desagüe.'],
           B: ['warn', 'Obra', 'Tomas de agua', 'Fregadero y lavavajillas quedan a 1–2 m de las tomas y la columna de lavado a unos 4 m: hay que prolongar agua y desagüe.'],
           C: ['ok', 'Sin obra', 'Tomas de agua', 'Fregadero, lavavajillas, lavadora y secadora van seguidos en la mitad derecha de la pared larga, encima de las tomas.'] }),
    pick({ A: null, B: null,
           C: ['ok', 'Bien', 'Dónde va la nevera', 'En el hueco de 95 cm queda enfrente del fregadero (1,9 m) y fuera del paso, pero la puerta pegada a la pared solo abre 90° y la torre de hornos ocupa la pared izquierda.'],
           Cp: ['ok', 'Mejor', 'Dónde va la nevera', 'De frente a la encimera y a 1,24 m de ella: abres, giras y estás en el fregadero. Queda empotrada entre despensa y torre de hornos, y como sobresale 16 cm de los armarios sus dos puertas abren más de 90°.'],
           Ce: ['warn', 'Peor', 'Dónde va la nevera', 'Junto a la entrada va bien para descargar la compra y deja el hueco para una despensa de 90, pero queda a 0,9 m de la placa y su puerta derecha barre la zona de cocinar.'] }),
    ent ? null : ['ok', 'Justo', 'Hueco de la nevera', '95 cm de hueco para 91,3 cm de nevera: quedan 1,9 cm por lado. La puerta pegada a la pared abre a 90°; comprueba en el manual del modelo que basta para sacar los cajones.'],
    (L === 'C' && par) ? ['warn', 'Revisar', 'Ventilación de la nevera', 'Es un modelo de libre instalación metido entre muebles: deja 2,3 cm por lado, 5 cm arriba y 5 cm detrás y pon rejilla en el zócalo y en el mueble alto. Confírmalo en el manual del modelo LG.'] : null,
    ['warn', 'Revisar', 'Calentador de gas', 'El mueble de 45 cm que lo tapa va abierto por abajo, con rejillas arriba y abajo en la puerta y la chimenea saliendo libre por arriba. Deja las distancias que pide el manual del Junkers y que lo valide un instalador de gas autorizado.'],
    ['warn', 'Medir', 'Meter la nevera por la puerta', 'Una hoja de 80 cm deja unos 72–76 cm de paso y la nevera tiene 73,5 cm de fondo. Suele entrar de lado quitando sus puertas o la hoja de la puerta.'],
    L === 'C' ? null : ['ok', 'Bien', 'Muebles de enfrente', ent ? '110 cm de bajos y altos entre la puerta y la despensa, con 1,40 m de paso hasta la encimera. Dejan 70 cm para abrir las puertas de la despensa.' : '110 cm de bajos y altos entre la puerta y la nevera, con 1,40 m de paso hasta la encimera. Terminan 50 cm antes de la nevera para que su puerta del lado de la pared abra a 90°.'],
    (L === 'C' && par) ? ['ok', 'Bien', 'Paso principal', '1,24 m entre la encimera y el frente de la nevera y 1,40 m hasta los armarios. Con las puertas de la nevera abiertas siguen quedando unos 75 cm para pasar.'] :
    (L === 'C' && !ent) ? ['ok', 'Bien', 'Paso principal', '1,09 m entre la encimera y el costado de la nevera; el resto de la cocina queda despejado.'] :
    ['ok', 'Bien', 'Paso principal', ent ? '1,40 m entre la encimera y los muebles de enfrente. Lo recomendable para una persona cocinando es 0,90–1,20 m.' : '1,09 m entre la encimera y el costado de la nevera. Lo recomendable para una persona cocinando es 0,90–1,20 m.'],
    ['ok', 'Bien', 'Salida al patio', 'La encimera llega hasta la ventana fija. La puerta del patio (≈85 cm) abre hacia dentro sobre 1,07 m libres, sin tocar ningún mueble.'],
    pick({ A: ['warn', 'Justo', 'Puerta de entrada y secadora', 'La hoja abierta a 90° queda a unos 3 cm del costado de la secadora. Conviene un tope de puerta.'],
           B: ['ok', 'Bien', 'Puerta de entrada y columna', 'La columna de lavado acaba 57 cm antes del barrido de la puerta.'],
           C: ['warn', 'Justo', 'Puerta de entrada y despensa', 'La hoja abierta a 90° queda a unos 3 cm del costado de la despensa. Conviene un tope de puerta.'],
           Cp: ['ok', 'Bien', 'Puerta de entrada', 'La pared izquierda queda libre: la hoja abre sin topes y la despensa arranca justo después del marco.'],
           Ce: ['ok', 'Bien', 'Puerta de entrada y nevera', 'La nevera acaba 29 cm antes del barrido de la puerta de entrada.'] }),
    pick({ A: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 5,7 m de recorrido (lo ideal es 4–7 m).'],
           B: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 5,3 m de recorrido (lo ideal es 4–7 m).'],
           C: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 5,6 m de recorrido (lo ideal es 4–7 m).'],
           Cp: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 4,9 m (lo ideal es 4–7 m), con la nevera a 1,5 m del fregadero.'],
           Ce: ['warn', 'Justo', 'Triángulo de trabajo', 'Suma unos 4,1 m, pero la nevera y la placa quedan a solo 0,9 m (lo aconsejable es más de 1,2 m).'] }),
  ];
  document.getElementById('checks').innerHTML = checks.filter(Boolean).map(([s, l, t, x]) => `<div class="check"><span class="pill ${s}">${l}</span><span class="t">${t}</span><span class="x">${x}</span></div>`).join('');
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

/* ───────── Cámara ───────── */
const VIEWS = {
  entrada: { p: [0.4, 1.62, 1.98], t: [3.3, 1.0, 0.5], f: 66 },
  patio: { p: [6.6, 1.5, 1.2], t: [1.4, 1.0, 1.25], f: 48 },
  nevera: { p: [1.1, 1.6, 0.75], t: [3.0, 0.95, 2.15], f: 58 },
  iso: { p: [-2.9, 5.6, 6.6], t: [2.35, 0.55, 1.25], f: 38 },
  planta: { p: [2.39, 10.5, 1.34], t: [2.39, 0, 1.33], f: 32 },
};
let tween = null;
function goView(name, instant = false) {
  let v = VIEWS[name];
  if (name === 'nevera' && fridgeMode() === 'pared') v = { p: [0.75, 1.7, 0.8], t: [2.4, 0.95, 2.3], f: 62 };
  if (name === 'nevera' && fridgeMode() === 'entrada') v = { p: [2.3, 1.6, 1.7], t: [0.4, 1.0, 1.1], f: 60 };
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
    w.g.userData.hidden = hide;
    w.g.visible = !hide;
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
$('t-tags').onclick = () => { state.tags = !state.tags; $('t-tags').setAttribute('aria-pressed', state.tags); scene.traverse(o => { if (o.isCSS2DObject && o.parent !== dims) o.visible = state.tags; }); syncWater(); };
$('t-water').onclick = () => { state.water = !state.water; $('t-water').setAttribute('aria-pressed', state.water); syncWater(); };
$('t-rot').onclick = () => { state.rot = !state.rot; $('t-rot').setAttribute('aria-pressed', state.rot); controls.autoRotate = state.rot; };
$('t-hq').onclick = () => { state.hq = !state.hq; setQuality(); };
$('copy-link').onclick = async () => {
  saveHash(); const url = location.href, msg = $('copy-msg');
  try { await navigator.clipboard.writeText(url); msg.textContent = 'Enlace copiado'; }
  catch { msg.textContent = url; }
  msg.hidden = false; clearTimeout(msg._t); msg._t = setTimeout(() => { msg.hidden = true; }, 4000);
};
controls.addEventListener('start', () => { tween = null; });

/* ───────── Panel de acabados ───────── */
function thumbStyle(cat, o) {
  if (o.type === 'color' || (cat === 'pared')) return `background:${o.color}`;
  const key = o.type === 'wood' ? 'oak' : o.tex === 'worktop' ? opt('encimera').tex : o.tex;
  return `background-image:url(${THUMBS[key]});background-size:cover`;
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

/* ───────── Enlace compartible: #C.pared.012301 (distribución · nevera · acabados) ───────── */
const CATS = Object.keys(CATALOG), FRIDGE_POS = ['pared', 'hueco', 'entrada'];
function saveHash() {
  const code = CATS.map(c => Math.max(0, CATALOG[c].options.findIndex(o => o.id === state.fin[c]))).join('');
  try { history.replaceState(null, '', '#' + [state.layout, state.fridgePos, code].join('.')); } catch { }
}
function loadHash(h) {
  const m = /^([ABC])\.(pared|hueco|entrada)\.([0-3]{6})$/.exec(h);
  if (!m) return false;
  state.layout = m[1]; state.fridgePos = m[2];
  CATS.forEach((c, i) => { state.fin[c] = CATALOG[c].options[+m[3][i]].id; });
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
  if (window.__kitchenPaused) { requestAnimationFrame(loop); return; }   // usado por el script de capturas
  frame(now);
  requestAnimationFrame(loop);
}
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
  const cp = camera.position; ceiling.visible = cp.y < H - 0.02 && cp.x > 0 && cp.x < W && cp.z > 0 && cp.z < D && !(cp.x > NX && cp.z > NZ);
  const showDims = state.dims && camera.position.y > 2.8;
  if (dims.visible !== showDims) { dims.visible = showDims; dims.children.forEach(c => { if (c.isCSS2DObject) c.visible = showDims; }); }
  const nd = showDims && fridgeMode() === 'hueco'; nicheDim.forEach(c => c.visible = nd);
  const fm = fridgeMode(); islandDim.forEach(c => c.visible = showDims && (state.layout !== 'C' || fm === 'pared')); wallDim.forEach(c => c.visible = showDims && fm === 'pared');
  if (state.hq) composer.render(); else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
const hash = location.hash.slice(1);
if (!loadHash(hash) && ['A', 'B', 'C'].includes(hash)) state.layout = hash;
syncButtons(); applyRoomFinishes(); renderFinishUI(); buildLayout(); syncWater(); setQuality();
goView(VIEWS[hash] ? hash : 'iso', true);
requestAnimationFrame(t => { last = t; loop(t); setTimeout(() => $('loading').classList.add('gone'), 150); });
window.__kitchen = { frame: () => frame(performance.now()), passes: { gtao, bloom }, state, goView, buildLayout, applyNight, allAnim, applyAll, setQuality, setOpen(v) { state.open = v; openP = v ? 1 : 0; allAnim().forEach(a => a.obj[a.key] = a.closed + (a.open - a.closed) * openP); } };
