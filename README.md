# Cocina 3D

Hice este configurador para diseñar la cocina de mi casa en Albuixech. Es una cocina de 4,78 × 2,64 m con salida al patio, y quería ver cómo quedaba antes de encargar nada. Funciona en el navegador y parte del croquis que dibujé a mano con las medidas reales. Con él pruebo distribuciones, coloco electrodomésticos de tamaño estándar, cambio acabados y compruebo que todo cabe.

Lo comparto por si a alguien le sirve para diseñar la suya.

Puedes probarlo aquí: https://ricardoedreirapenas.github.io/cocina-3d/

![Vista desde la puerta, estilo Nórdico](docs/hero.jpg)

## Qué hace

- Tiene tres distribuciones sobre la misma planta. En L, lineal con columna de lavado y otra que llamo "aguas al patio", que junta fregadero, lavavajillas, lavadora y secadora encima de las tomas de agua.
- La nevera americana (una LG side-by-side de 91,3 × 73,5 × 179 cm) se puede poner en dos sitios. Empotrada entre la despensa y la torre de hornos, o en el hueco del quiebro.
- Para los acabados hay 4 opciones actuales en cada categoría y 4 estilos combinados que se aplican con un clic.

  | Categoría | Opciones |
  |---|---|
  | Muebles bajos | Blanco roto · Verde salvia · Azul noche · Roble natural |
  | Muebles altos | Blanco roto · Verde salvia · Azul noche · Roble natural |
  | Encimera | Roble macizo · Cuarzo Calacatta · Porcelánico negro mate · Terrazo |
  | Frente de cocina | Metro blanco · Zellige verde · Zellige crema · Igual que la encimera |
  | Pintura de pared | Blanco cálido · Greige · Arcilla · Verde niebla |
  | Suelo | Porcelánico 60×60 · Roble en espiga · Microcemento · Hidráulico |

- Se puede ver de día y de noche. De día entra el sol por la ventana y la luz del cielo por la puerta del patio. De noche están los focos del techo y las tiras LED bajo los muebles altos.
- En calidad alta usa oclusión ambiental (GTAO), sombras de 4096 px y bloom por la noche. En el móvil arranca en modo rápido.
- Comprueba medidas que me importaban: pasos libres, apertura de puertas, triángulo de trabajo, distancia a las tomas de agua y ventilación de la nevera y del calentador de gas.
- Hay cinco vistas (desde la puerta, desde el patio, nevera, maqueta y planta). También muestra las cotas del croquis y las puertas se abren con animación.
- El diseño se guarda en la URL, así que puedes pasar el enlace a quien quieras. Por ejemplo `#C.pared.000000`.

| Salvia | Mediterráneo | Noche |
|---|---|---|
| ![](docs/estilo-salvia.jpg) | ![](docs/estilo-mediterraneo.jpg) | ![](docs/estilo-noche.jpg) |

| Maqueta | Planta |
|---|---|
| ![](docs/maqueta.jpg) | ![](docs/planta.jpg) |

## Cómo usarlo en local

No hay que instalar nada. Eso sí, los módulos JavaScript necesitan un servidor, así que abrir `index.html` con doble clic no funciona. Yo lo lanzo así:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Si prefieres un único HTML con todo dentro, que sí se abre con doble clic, puedes generarlo con:

```bash
python3 scripts/build_single.py   # → dist/cocina-3d.html
```

## Cómo adaptarlo a tu cocina

Todas las medidas están en [`js/config.js`](js/config.js).

- `ROOM` son las medidas de las paredes, en metros. La planta es un rectángulo con un quiebro en una esquina.
- `DOOR` y `WINDOW` son la puerta de entrada, la ventana fija y la puerta al patio.
- `FRIDGE` tiene las medidas de la nevera y la ventilación trasera.
- `CATALOG` y `PRESETS` son los acabados y los estilos. Para añadir un color solo hay que meter otra entrada `{ id, name, type: 'color', color: '#...' }`.

Los muebles de cada distribución se colocan en `buildLayout()`, dentro de [`js/main.js`](js/main.js). Cada módulo lleva su posición y su ancho. Por ejemplo, `[2.90, 0.60, 'dw']` es un lavavajillas de 60 cm a 2,90 m de la esquina.

Las texturas (maderas, piedras, azulejos) las dibujo por código en [`js/textures.js`](js/textures.js), así el proyecto no depende de imágenes externas.

## Publicarlo con GitHub Pages

El repositorio ya trae el flujo [`.github/workflows/pages.yml`](.github/workflows/pages.yml), que publica la web en cada `push` a `main`. Para activarlo:

1. En GitHub, ve a **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Haz `push` a `main`. En la pestaña **Actions** verás el despliegue y, cuando termine, la URL pública.

## Estructura

```
index.html              página y panel
css/styles.css          estilos
js/config.js            medidas, electrodomésticos, catálogo de acabados
js/textures.js          texturas procedurales
js/main.js              escena 3D, distribuciones, luces, interfaz
scripts/build_single.py genera dist/cocina-3d.html
docs/                   capturas
```

## Tecnología

Uso [three.js](https://threejs.org/) 0.165 cargado desde jsDelivr, con postprocesado (GTAO, UnrealBloom), luces de área y etiquetas CSS2D. No hay paso de compilación ni dependencias de npm.

## Aviso

Esto sirve para visualizar, no sustituye a un profesional. Antes de encargar muebles o electrodomésticos, confirma las medidas en obra y los requisitos de instalación de cada fabricante. Sobre todo la ventilación de la nevera y las distancias del calentador de gas, que tiene que validar un instalador autorizado.

## Licencia

[MIT](LICENSE) © 2026 Ricardo Manuel Edreira Penas
