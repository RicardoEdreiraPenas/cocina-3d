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

// Nevera LG side-by-side (serie GSLV): 91,3 × 73,5 × 179 cm, 5 cm de ventilación detrás
export const FRIDGE = { w: 0.913, d: 0.735, h: 1.79, back: 0.05 };

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
