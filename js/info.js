/*
 * Textos del panel: electrodomésticos y comprobaciones de cada distribución.
 * L = 'A' | 'B' | 'C';  fridge = 'pared' | 'hueco' (solo cuenta en la opción C).
 * Cada comprobación es [estado, etiqueta, título, explicación]; estado: 'ok' | 'warn'.
 */
export function panelInfo(L, fridge) {
  const par = L === 'C' && fridge === 'pared';
  const pick = o => (par && 'Cp' in o) ? o.Cp : o[L];
  const apps = [
    ['Nevera LG americana', '91,3 × 73,5 × 179', par ? 'Dos puertas side-by-side (serie GSLV). En la pared de 3,42 mirando a la encimera, entre la despensa y la torre de hornos, con 2,3 cm a cada lado, 5 cm arriba y 5 cm detrás.' : 'Dos puertas side-by-side (serie GSLV, las habituales en España). Va en el hueco de 95 cm junto al quiebro, con 5 cm de ventilación detrás. Mejor un modelo sin toma de agua (dispensador con depósito).'],
    ['Fregadero', '80 cm', pick({ A: 'Hacia la mitad izquierda de la pared larga (centro a 1,60 m).', B: 'Hacia la mitad izquierda de la pared larga (centro a 1,60 m).', C: 'De 90 cm, con el desagüe a 2,45 m: justo al empezar la zona de tomas.' })],
    ['Lavavajillas integrable', '60 cm', pick({ A: 'Junto al fregadero. Frente panelado a juego.', B: 'Junto al fregadero. Frente panelado a juego.', C: 'Entre el fregadero y la lavadora, en la zona de tomas.' })],
    ['Lavadora', '59,7 × 56,5 × 85', pick({ A: 'Bajo encimera en el brazo izquierdo de la L.', B: 'Abajo en la columna de la pared izquierda, junto a la entrada.', C: 'Bajo encimera, la penúltima de la pared larga, sobre las tomas.' })],
    ['Secadora bomba de calor', '59,7 × 60 × 85', pick({ A: 'Al lado de la lavadora, bajo encimera. Elige una de 60 cm de fondo como máximo.', B: 'Encima de la lavadora con kit de unión. Admite fondos de hasta 65 cm.', C: 'Al final del mueble, junto a la ventana. El condensado va al desagüe de la lavadora o a su depósito.' })],
    ['Placa de inducción + campana', '60 cm', pick({ A: 'Entre fregadero y ventana, con 1,28 m de encimera libre hasta la ventana fija.', B: 'Entre lavavajillas y nevera, con 1,88 m de encimera libre hasta la ventana.', C: 'En la mitad izquierda, con 60 cm de encimera libre hasta el fregadero y la columna de horno y microondas al lado.', Cp: 'En la mitad izquierda, con 60 cm de encimera libre hasta el fregadero. El horno va en la torre junto a la nevera.' })],
  ];
  const checks = [
    pick({ A: ['warn', 'Obra', 'Tomas de agua', 'Fregadero, lavavajillas y lavadora quedan lejos de las tomas: hay que llevar agua y desagüe de 1 a 4 m, con pendiente en el desagüe.'],
           B: ['warn', 'Obra', 'Tomas de agua', 'Fregadero y lavavajillas quedan a 1–2 m de las tomas y la columna de lavado a unos 4 m: hay que prolongar agua y desagüe.'],
           C: ['ok', 'Sin obra', 'Tomas de agua', 'Fregadero, lavavajillas, lavadora y secadora van seguidos en la mitad derecha de la pared larga, encima de las tomas.'] }),
    pick({ A: null, B: null,
           C: ['ok', 'Bien', 'Dónde va la nevera', 'En el hueco de 95 cm queda enfrente del fregadero (1,9 m) y fuera del paso, pero la puerta pegada a la pared solo abre 90° y la torre de hornos ocupa la pared izquierda.'],
           Cp: ['ok', 'Mejor', 'Dónde va la nevera', 'De frente a la encimera y a 1,24 m de ella: abres, giras y estás en el fregadero. Queda empotrada entre despensa y torre de hornos, y como sobresale 16 cm de los armarios sus dos puertas abren más de 90°.'] }),
    par ? null : ['ok', 'Justo', 'Hueco de la nevera', '95 cm de hueco para 91,3 cm de nevera: quedan 1,9 cm por lado. La puerta pegada a la pared abre a 90°; comprueba en el manual del modelo que basta para sacar los cajones.'],
    (L === 'C' && par) ? ['warn', 'Revisar', 'Ventilación de la nevera', 'Es un modelo de libre instalación metido entre muebles: deja 2,3 cm por lado, 5 cm arriba y 5 cm detrás y pon rejilla en el zócalo y en el mueble alto. Confírmalo en el manual del modelo LG.'] : null,
    ['warn', 'Revisar', 'Calentador de gas', 'El mueble de 45 cm que lo tapa va abierto por abajo, con rejillas arriba y abajo en la puerta y la chimenea saliendo libre por arriba. Deja las distancias que pide el manual del Junkers y que lo valide un instalador de gas autorizado.'],
    ['warn', 'Medir', 'Meter la nevera por la puerta', 'Una hoja de 80 cm deja unos 72–76 cm de paso y la nevera tiene 73,5 cm de fondo. Suele entrar de lado quitando sus puertas o la hoja de la puerta.'],
    L === 'C' ? null : ['ok', 'Bien', 'Muebles de enfrente', '110 cm de bajos y altos entre la puerta y la nevera, con 1,40 m de paso hasta la encimera. Terminan 50 cm antes de la nevera para que su puerta del lado de la pared abra a 90°.'],
    (L === 'C' && par) ? ['ok', 'Bien', 'Paso principal', '1,24 m entre la encimera y el frente de la nevera y 1,40 m hasta los armarios. Con las puertas de la nevera abiertas siguen quedando unos 75 cm para pasar.'] :
    L === 'C' ? ['ok', 'Bien', 'Paso principal', '1,09 m entre la encimera y el costado de la nevera; el resto de la cocina queda despejado.'] :
    ['ok', 'Bien', 'Paso principal', '1,09 m entre la encimera y el costado de la nevera. Lo recomendable para una persona cocinando es 0,90–1,20 m.'],
    ['ok', 'Bien', 'Salida al patio', 'La encimera llega hasta la ventana fija. La puerta del patio (≈85 cm) abre hacia dentro sobre 1,07 m libres, sin tocar ningún mueble.'],
    pick({ A: ['warn', 'Justo', 'Puerta de entrada y secadora', 'La hoja abierta a 90° queda a unos 3 cm del costado de la secadora. Conviene un tope de puerta.'],
           B: ['ok', 'Bien', 'Puerta de entrada y columna', 'La columna de lavado acaba 57 cm antes del barrido de la puerta.'],
           C: ['warn', 'Justo', 'Puerta de entrada y despensa', 'La hoja abierta a 90° queda a unos 3 cm del costado de la despensa. Conviene un tope de puerta.'],
           Cp: ['ok', 'Bien', 'Puerta de entrada', 'La pared izquierda queda libre: la hoja abre sin topes y la despensa arranca justo después del marco.'] }),
    pick({ A: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 5,7 m de recorrido (lo ideal es 4–7 m).'],
           B: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 5,3 m de recorrido (lo ideal es 4–7 m).'],
           C: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 5,6 m de recorrido (lo ideal es 4–7 m).'],
           Cp: ['ok', 'Bien', 'Triángulo de trabajo', 'Nevera, fregadero y placa suman unos 4,9 m (lo ideal es 4–7 m), con la nevera a 1,5 m del fregadero.'] }),
  ];
  return { apps, checks: checks.filter(Boolean) };
}
