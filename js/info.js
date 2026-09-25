/*
 * Textos del panel: electrodomésticos y comprobaciones.
 * Todo se calcula a partir de las medidas y de dónde ha quedado cada mueble,
 * así que sigue valiendo cuando alguien cambia las medidas en «Mis medidas».
 *
 * ctx = { L, mode, want, met, room, ap, under, fmt, cm, c1, dimsTxt, names, boiler }
 *   L     distribución 'A' | 'B' | 'C'
 *   mode  dónde está la nevera: 'pared' (empotrada) | 'hueco'
 *   want  dónde se pidió en la opción C (puede no caber)
 *   met   métricas de buildLayout(): posiciones, pasos, lo que no cabe…
 *   room  geometría de la estancia (computeRoom)
 *   ap    medidas de los electrodomésticos (metros); under: hueco bajo encimera
 * Cada comprobación es [estado, etiqueta, título, explicación]; estado: 'ok' | 'warn'.
 */
export function panelInfo({ L, mode, want, met, room: g, ap, under, fmt, cm, c1, dimsTxt, names, boiler }) {
  const FRW = ap.fridgeW, m = v => `${fmt(v)} m`, cms = v => `${Math.max(0, cm(v))} cm`;
  const has = id => met.run && met.run[id];
  const dropped = new Set(met.dropped);

  const apps = [];
  apps.push(['Nevera americana', dimsTxt(ap.fridgeW, ap.fridgeD, ap.fridgeH), mode === 'pared'
    ? `En la pared de la puerta, mirando a la encimera, entre ${met.pantryW ? 'la despensa y ' : ''}la torre de horno. Con 2,3 cm libres a cada lado, 5 cm arriba y 5 cm detrás.`
    : `En el hueco junto al quiebro, con 5 cm de ventilación detrás. Mejor un modelo sin toma de agua (dispensador con depósito).`]);
  if (has('sink')) apps.push(['Fregadero', cms(met.run.sink.w), `Centro a ${m(met.run.sink.x)} de la esquina${met.run.sink.x >= g.waterFrom ? ', encima de las tomas' : ''}.`]);
  if (has('dw')) apps.push(['Lavavajillas integrable', `${c1(ap.dwW)} cm`, 'Junto al fregadero, con el frente panelado a juego.']);
  const washerTxt = { A: 'Bajo encimera en el brazo izquierdo de la L.', B: 'Abajo en la columna de la pared izquierda, junto a la entrada.', C: 'Bajo encimera en la pared larga, junto al lavavajillas.' }[L];
  const dryerTxt = { A: 'Al lado de la lavadora, bajo encimera. Elige una de 60 cm de fondo como máximo.', B: 'Encima de la lavadora con kit de unión.', C: 'Al final del mueble, junto a la ventana. El condensado va al desagüe de la lavadora o a su depósito.' }[L];
  apps.push(['Lavadora', dimsTxt(ap.washerW, ap.washerD, ap.washerH), dropped.has('washer') || dropped.has('laundryCol') ? 'No cabe con estas medidas.' : washerTxt]);
  apps.push(['Secadora bomba de calor', dimsTxt(ap.dryerW, ap.dryerD, ap.dryerH), dropped.has('dryer') || dropped.has('laundryCol') ? 'No cabe con estas medidas.' : dryerTxt]);
  if (has('hob')) apps.push(['Placa de inducción + campana', `${c1(ap.hobW)} cm`, `Centro a ${m(met.run.hob.x)}${met.sinkHobFree != null ? `, con ${m(Math.max(0, met.sinkHobFree))} de encimera entre la placa y el fregadero` : ''}.`]);

  const checks = [];
  // Tomas de agua
  const far = met.wet.filter(([, d, tol]) => d > tol);
  if (!far.length) checks.push(['ok', 'Sin obra', 'Tomas de agua', 'Todo lo que usa agua queda encima de las tomas o justo al lado.']);
  else checks.push(['warn', 'Obra', 'Tomas de agua', `Hay que llevar agua y desagüe hasta ${far.map(([id, d]) => `${names[id].toLowerCase()} (${m(d)})`).join(', ')}. El desagüe necesita pendiente.`]);

  // Dónde va la nevera
  if (L === 'C' && want === 'pared' && mode !== 'pared') {
    checks.push(['warn', 'No cabe', 'Nevera empotrada', `Entre la puerta y el quiebro hay ${m(Math.max(0, (met.warnings.find(w => w[0] === 'wallNoFit') || [0, 0])[1]))} y hacen falta ${m(met.wallNeed)} (torre de horno y hueco de nevera). La muestro en el hueco.`]);
  } else if (L === 'C') {
    checks.push(mode === 'pared'
      ? ['ok', 'Mejor', 'Dónde va la nevera', `De frente a la encimera, a ${m(met.pass)} de ella. Como sobresale ${c1(Math.max(0, ap.fridgeD + 0.05 - 0.62))} cm de los armarios, sus dos puertas abren más de 90°.`]
      : ['ok', 'Bien', 'Dónde va la nevera', `En el hueco queda a ${m(met.fridgeSink || 0)} del fregadero y fuera del paso, pero la puerta pegada a la pared solo abre 90°.`]);
  }
  // Hueco de la nevera
  if (mode === 'hueco') {
    const margin = (g.notch - FRW) / 2;
    if (!g.hasNotch) checks.push(['ok', 'Bien', 'Sitio de la nevera', 'Va en la esquina de la pared de la puerta con la del patio.']);
    else if (margin >= 0.01) checks.push(['ok', margin < 0.03 ? 'Justo' : 'Bien', 'Hueco de la nevera', `${cms(g.notch)} de hueco para ${c1(FRW)} cm de nevera: quedan ${fmt(margin * 100, 1)} cm por lado. Comprueba en el manual que con 90° salen los cajones.`]);
    else checks.push(['warn', 'Sobresale', 'Hueco de la nevera', `El quiebro mide ${cms(g.notch)} y la nevera ${c1(FRW)} cm: sobresale ${fmt((FRW + 0.02 - g.notch) * 100, 0)} cm hacia la cocina.`]);
    if (met.doorHitsFridge) checks.push(['warn', 'Choca', 'Puerta de entrada y nevera', 'La puerta de entrada cae donde va la nevera. Mueve la puerta o la nevera.']);
  } else {
    checks.push(['warn', 'Revisar', 'Ventilación de la nevera', 'Es un modelo de libre instalación metido entre muebles: deja 2,3 cm por lado, 5 cm arriba y 5 cm detrás, con rejilla en el zócalo y en el mueble alto. Confírmalo en el manual del modelo.']);
  }
  if (met.boiler) checks.push(['warn', 'Revisar', 'Calentador de gas', `El mueble que tapa el ${boiler.label} va abierto por abajo, con rejillas y la chimenea libre por arriba. Deja las distancias del manual y que lo valide un instalador de gas autorizado.`]);

  // Meter la nevera por la puerta
  const clear = g.doorW - 0.07, fd = ap.fridgeD;
  checks.push(clear >= fd + 0.035
    ? ['ok', 'Bien', 'Meter la nevera por la puerta', `La puerta deja unos ${cms(clear)} de paso y la nevera tiene ${c1(fd)} cm de fondo: entra de lado sin desmontar nada.`]
    : ['warn', clear >= fd - 0.04 ? 'Medir' : 'Difícil', 'Meter la nevera por la puerta', `Una hoja de ${cms(g.doorW)} deja unos ${cms(clear)} de paso y la nevera tiene ${c1(fd)} cm de fondo. Suele entrar de lado quitando sus puertas o la hoja de la puerta.`]);

  // Lavadora y secadora bajo encimera o apiladas
  if (met.laundryUnder) {
    const tall = [['lavadora', ap.washerH], ['secadora', ap.dryerH]].filter(([, h]) => h > under.h);
    const deep = [['lavadora', ap.washerD], ['secadora', ap.dryerD]].filter(([, d]) => d > under.d - 0.01);
    if (tall.length) checks.push(['warn', 'No entra', 'Altura bajo encimera', `Bajo la encimera caben ${c1(under.h)} cm de alto y ${tall.map(([n, h]) => `la ${n} mide ${c1(h)}`).join(' y ')}. Busca un modelo encastrable o ponla en columna.`]);
    else if (deep.length) checks.push(['warn', 'Sobresale', 'Fondo bajo encimera', `${deep.map(([n, d]) => `La ${n} tiene ${c1(d)} cm de fondo`).join(' y ')}: con la toma y la manguera detrás sobresale de la encimera de ${c1(under.d)} cm.`]);
    else checks.push(['ok', 'Bien', 'Lavadora y secadora bajo encimera', `Caben de alto (${c1(Math.max(ap.washerH, ap.dryerH))} de ${c1(under.h)} cm) y de fondo.`]);
  } else if (met.stackH) {
    checks.push([met.stackH <= 1.75 ? 'ok' : 'warn', met.stackH <= 1.75 ? 'Bien' : 'Alto', 'Columna de lavado', `Apiladas suman ${c1(met.stackH)} cm con el kit de unión${met.stackH > 1.75 ? '; la secadora queda muy alta para cargarla con comodidad' : ''}.`]);
  }

  // Muebles de enfrente
  if (met.opp) checks.push(['ok', 'Bien', 'Muebles de enfrente', `${cms(met.opp)} de bajos y altos entre la puerta y la nevera, con ${m(met.oppPass)} de paso. Terminan 50 cm antes de la nevera para que abra su puerta.`]);

  // Paso principal
  const pass = met.pass;
  checks.push([pass >= 0.9 ? 'ok' : 'warn', pass >= 0.9 ? 'Bien' : 'Estrecho', 'Paso principal', `${m(pass)} entre la encimera y ${mode === 'pared' ? 'el frente' : 'el costado'} de la nevera. Para una persona cocinando se recomienda entre 0,90 y 1,20 m.`]);

  // Salida al patio
  if (met.patioFree != null) checks.push([met.patioFree >= 0.9 ? 'ok' : 'warn', met.patioFree >= 0.9 ? 'Bien' : 'Justo', 'Salida al patio', `La puerta del patio (${cms(g.PD1 - g.PD0)}) abre hacia dentro sobre ${m(met.patioFree)} libres.`]);

  // Puerta de entrada frente a lo que haya en la pared izquierda
  if (met.doorGap != null) checks.push(met.doorGap < 0.05
    ? ['warn', 'Justo', 'Puerta de entrada', `La hoja abierta a 90° queda a unos ${fmt(Math.max(0, met.doorGap) * 100, 0)} cm de ${met.leftWhat}. Conviene un tope de puerta.`]
    : ['ok', 'Bien', 'Puerta de entrada', `La hoja abre sin tocar ${met.leftWhat}.`]);
  else if (met.doorNearLeft) checks.push(['ok', 'Bien', 'Puerta de entrada', 'La pared izquierda queda libre: la hoja abre sin topes.']);

  // Triángulo de trabajo
  if (met.triangle != null) {
    const t = met.triangle, ok = t >= 4 && t <= 7 && met.fridgeHob >= 1.0;
    checks.push([ok ? 'ok' : 'warn', ok ? 'Bien' : t > 7 ? 'Largo' : 'Justo', 'Triángulo de trabajo', `Nevera, fregadero y placa suman unos ${m(t)} de recorrido (lo ideal es 4–7 m)${met.fridgeHob < 1.0 ? `, pero la nevera queda a ${m(met.fridgeHob)} de la placa` : ''}.`]);
  }

  // Lo que no cabe
  const missing = [...dropped].filter(id => names[id] && !['washer', 'dryer', 'laundryCol'].includes(id));
  if (missing.length) checks.push(['warn', 'No cabe', 'Faltan muebles', `Con estas medidas no caben: ${missing.map(id => names[id].toLowerCase()).join(', ')}.`]);

  return { apps, checks };
}
