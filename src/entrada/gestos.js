/**
 * gestos.js
 * Lógica pura (sin DOM ni MediaPipe) para convertir landmarks de mano en
 * señales de control. Se mantiene separada para poder probarla con Vitest.
 *
 * Convención de landmarks de MediaPipe: coordenadas normalizadas, y=0 arriba, y=1 abajo.
 */

import { CAMARA } from '../config/constantes.js';

// Índices MediaPipe: [punta, PIP] de índice, medio, anular y meñique
const DEDOS = [[8, 6], [12, 10], [16, 14], [20, 18]];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Altura normalizada de la compuerta a partir de la coordenada y de la muñeca
 * (landmark 0). Mano abajo (yBajo) → 0 (cerrada), mano arriba (yAlto) → 1 (abierta).
 *
 * @param {number} y     - y de la muñeca [0,1] (0 = arriba del frame)
 * @param {{yBajo:number,yAlto:number}} calib
 * @returns {number} apertura en [0,1]
 */
export function aperturaDesdeAltura(y, calib) {
  const rango = calib.yBajo - calib.yAlto;
  if (rango <= 1e-6) return 0;
  const u = (calib.yBajo - y) / rango;
  return Math.max(0, Math.min(1, u));
}

/**
 * ¿La calibración tiene un rango utilizable?
 */
export function calibracionValida(calib) {
  return !!calib && (calib.yBajo - calib.yAlto) >= CAMARA.rango_minimo;
}

/**
 * Detecta puño cerrado: al menos 3 de 4 dedos con la punta más cerca de la
 * muñeca que su articulación PIP.
 *
 * @param {Array<{x:number,y:number}>} lm - 21 landmarks
 * @returns {boolean}
 */
export function esPuno(lm) {
  if (!lm || lm.length < 21) return false;
  const muneca = lm[CAMARA.landmark_muneca];
  let plegados = 0;
  for (const [punta, pip] of DEDOS) {
    if (dist(lm[punta], muneca) < dist(lm[pip], muneca) * CAMARA.umbral_puño) plegados++;
  }
  return plegados >= 3;
}

/**
 * Separa del resultado de HandLandmarker la mano derecha (turbinas) y la
 * izquierda (vertedero) del usuario, según la etiqueta de handedness.
 *
 * @param {{landmarks:Array, handedness:Array}} resultado
 * @returns {{derecha: Array|null, izquierda: Array|null}}
 */
export function separarManos(resultado) {
  const salida = { derecha: null, izquierda: null };
  if (!resultado || !resultado.landmarks) return salida;
  resultado.landmarks.forEach((lm, i) => {
    const etiqueta = resultado.handedness?.[i]?.[0]?.categoryName;
    if (etiqueta === CAMARA.etiqueta_mano_derecha) salida.derecha = lm;
    else if (etiqueta === CAMARA.etiqueta_mano_izquierda) salida.izquierda = lm;
  });
  return salida;
}
