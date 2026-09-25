/*
 * Configuración de la cocina.
 * ─────────────────────────────────────────────────────────────
 * Todas las medidas en metros. El origen (0,0) es la esquina interior
 * donde se unen la pared larga y la pared izquierda.
 *   x → a lo largo de la pared larga (hacia el patio)
 *   z → hacia dentro de la cocina (hacia la pared de la puerta)
 *
 *   (0,0) ─────────── W (pared larga) ──────────┐
 *     │                                         │ ventana fija + puerta al patio
 *     D (pared izquierda)              quiebro ─┘
 *     │                                   │ notch
 *     └──── puerta ──── NX (pared de la puerta) ┘
 *
 * Estas son las medidas de mi cocina. Desde la web se pueden cambiar en
 * «Mis medidas» sin tocar el código; aquí se cambia el punto de partida.
 */

export const DEFAULT_ROOM = {
  W: 4.78,       // pared larga
  D: 2.64,       // pared izquierda
  NX: 3.42,      // pared de la puerta, hasta el quiebro (si es igual a W, la planta es rectangular)
  notch: 0.95,   // quiebro junto a la nevera
  H: 2.60,       // altura del techo
  doorX: 0.10,   // puerta de entrada: distancia a la esquina
  doorW: 0.80,   // puerta de entrada: ancho
  fixW: 0.64,    // ventana fija sobre la encimera (0 = sin ventana fija)
  patioW: 0.80,  // puerta al patio
};

// Límites del formulario «Mis medidas»
export const ROOM_LIMITS = {
  W: [3.0, 7.0], D: [1.8, 4.5], NX: [2.0, 7.0], notch: [0.3, 3.0], H: [2.3, 3.2],
  doorX: [0.05, 6.0], doorW: [0.6, 1.2], fixW: [0, 1.6], patioW: [0.6, 1.6],
};

export const T = 0.10;                       // grosor de muro
export const WATER = { from: 0.5 };          // las tomas empiezan a mitad de la pared larga (fracción de W)
export const BOILER = { enabled: true, width: 0.45, label: 'Junkers de gas' };  // calentador tapado junto a la ventana

// Electrodomésticos de partida (metros): los que tengo en casa. También se cambian desde «Mis medidas».
// Nevera LG side-by-side (serie GSLV): 91,3 × 73,5 × 179 cm, con 5 cm de ventilación detrás.
// Lavadora LG F4WR5509A0W: 60 × 56,5 × 85 cm. Secadora Zanussi ZDH8373W: 60 × 60 × 85 cm.
// Lavavajillas Whirlpool WFC 3C33 PF, de libre instalación: 60 × 59 × 85 cm (82 sin la tapa de arriba).
// Los dos últimos campos (fondo y alto del lavavajillas) van al final para que los enlaces antiguos sigan valiendo.
export const DEFAULT_APPLIANCES = {
  fridgeW: 0.913, fridgeD: 0.735, fridgeH: 1.79,
  dwW: 0.60,                                        // lavavajillas (45 o 60)
  washerW: 0.60, washerD: 0.565, washerH: 0.85,
  dryerW: 0.60, dryerD: 0.60, dryerH: 0.85,
  hobW: 0.60,                                       // placa (60, 70, 80 o 90)
  dwD: 0.59, dwH: 0.85,
};
// Modelo que se nombra en el panel mientras las medidas sean las de partida
export const APPLIANCE_MODELS = {
  fridge: { name: 'LG side-by-side', keys: ['fridgeW', 'fridgeD', 'fridgeH'] },
  washer: { name: 'LG F4WR5509A0W', keys: ['washerW', 'washerD', 'washerH'] },
  dryer: { name: 'Zanussi ZDH8373W', keys: ['dryerW', 'dryerD', 'dryerH'] },
  dw: { name: 'Whirlpool WFC 3C33 PF', keys: ['dwW', 'dwD', 'dwH'] },
};
export const DW_LID = 0.03;   // lo que baja un lavavajillas de libre instalación al quitarle la tapa
export const APPLIANCE_LIMITS = {
  fridgeW: [0.55, 1.10], fridgeD: [0.55, 0.80], fridgeH: [1.40, 2.10],
  dwW: [0.45, 0.60], dwD: [0.50, 0.65], dwH: [0.80, 0.90],
  washerW: [0.40, 0.70], washerD: [0.40, 0.70], washerH: [0.70, 0.95],
  dryerW: [0.40, 0.70], dryerD: [0.40, 0.70], dryerH: [0.70, 0.95],
  hobW: [0.30, 0.90],
};
export const FRIDGE_BACK = 0.05;   // ventilación detrás de la nevera
export const UNDER_COUNTER = { h: 0.855, d: 0.62 };   // hueco bajo encimera: alto útil y fondo de encimera

/*
 * Catálogo de acabados: 4 opciones por categoría, tendencias 2025–2026.
 * type: 'color' (lacado mate) | 'wood' | un id de textura procedural (ver js/textures.js)
 */
export const CATALOG = {
  bajos: {
    label: 'Muebles bajos',
    options: [
      { id: 'blanco', name: 'Blanco roto', type: 'color', color: '#ECE9E2' },
      { id: 'salvia', name: 'Verde salvia', type: 'color', color: '#87967F' },
      { id: 'noche', name: 'Azul noche', type: 'color', color: '#2D3947' },
      { id: 'roble', name: 'Roble natural', type: 'wood' },
    ],
  },
  altos: {
    label: 'Muebles altos',
    options: [
      { id: 'blanco', name: 'Blanco roto', type: 'color', color: '#ECE9E2' },
      { id: 'salvia', name: 'Verde salvia', type: 'color', color: '#87967F' },
      { id: 'noche', name: 'Azul noche', type: 'color', color: '#2D3947' },
      { id: 'roble', name: 'Roble natural', type: 'wood' },
    ],
  },
  encimera: {
    label: 'Encimera',
    options: [
      { id: 'roble', name: 'Roble macizo', tex: 'oak', roughness: 0.5 },
      { id: 'calacatta', name: 'Cuarzo Calacatta', tex: 'calacatta', roughness: 0.18, clearcoat: 0.6 },
      { id: 'negro', name: 'Porcelánico negro mate', tex: 'blackStone', roughness: 0.55 },
      { id: 'terrazo', name: 'Terrazo', tex: 'terrazzo', roughness: 0.3, clearcoat: 0.3 },
    ],
  },
  frente: {
    label: 'Frente de cocina',
    options: [
      { id: 'metro', name: 'Metro blanco', tex: 'metro', size: 0.30, roughness: 0.2 },
      { id: 'zellige-verde', name: 'Zellige verde', tex: 'zelligeGreen', size: 0.40, roughness: 0.12 },
      { id: 'zellige-crema', name: 'Zellige crema', tex: 'zelligeCream', size: 0.40, roughness: 0.12 },
      { id: 'encimera', name: 'Igual que la encimera', tex: 'worktop' },
    ],
  },
  pared: {
    label: 'Pintura de pared',
    options: [
      { id: 'blanco', name: 'Blanco cálido', color: '#EFEBE4' },
      { id: 'greige', name: 'Greige', color: '#D8D0C4' },
      { id: 'arcilla', name: 'Arcilla', color: '#D9B8A0' },
      { id: 'niebla', name: 'Verde niebla', color: '#C6CEC0' },
    ],
  },
  suelo: {
    label: 'Suelo',
    options: [
      { id: 'porcelanico', name: 'Porcelánico 60×60', tex: 'porcelain', size: 1.2, roughness: 0.35 },
      { id: 'espiga', name: 'Roble espiga', tex: 'herringbone', size: 0.9, roughness: 0.45 },
      { id: 'microcemento', name: 'Microcemento', tex: 'microcement', size: 2.0, roughness: 0.55 },
      { id: 'hidraulico', name: 'Hidráulico', tex: 'hydraulic', size: 0.4, roughness: 0.3 },
    ],
  },
};

// Estilos: combinaciones listas para aplicar de un clic
export const PRESETS = [
  { id: 'nordico', name: 'Nórdico', fin: { bajos: 'blanco', altos: 'blanco', encimera: 'roble', frente: 'metro', pared: 'blanco', suelo: 'porcelanico' } },
  { id: 'salvia', name: 'Salvia', fin: { bajos: 'salvia', altos: 'blanco', encimera: 'calacatta', frente: 'zellige-crema', pared: 'greige', suelo: 'espiga' } },
  { id: 'noche', name: 'Noche', fin: { bajos: 'noche', altos: 'roble', encimera: 'negro', frente: 'encimera', pared: 'blanco', suelo: 'microcemento' } },
  { id: 'mediterraneo', name: 'Mediterráneo', fin: { bajos: 'blanco', altos: 'roble', encimera: 'terrazo', frente: 'zellige-verde', pared: 'arcilla', suelo: 'hidraulico' } },
];

// Diseño que se abre por defecto (el de Ricardo)
export const DEFAULT_DESIGN = {
  layout: 'C',
  fridgePos: 'pared',
  fin: { ...PRESETS[0].fin },
};
