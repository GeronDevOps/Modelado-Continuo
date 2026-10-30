/**
 * fase2.test.js
 * Pruebas de la lógica de gestos (muñeca / puño) y de factibilidad del Nivel 2.
 */

import { describe, test, expect } from 'vitest';
import {
  aperturaDesdeAltura, calibracionValida, esPuno, separarManos,
} from '../src/entrada/gestos.js';
import { SistemaContinuo, saturar } from '../src/modelo/SistemaContinuo.js';
import { rk4, H_PASO } from '../src/modelo/integradores.js';
import { NIVEL2, EQUILIBRIO, LIMITES, ACTUADORES, caudalNivel2 } from '../src/config/constantes.js';

/** Construye 21 landmarks con la muñeca en (0.5, yMuneca). */
function mano({ puño }) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[0] = { x: 0.5, y: 0.8 };                              // muñeca
  // [punta, pip] por dedo, extendido: punta lejos de la muñeca
  const dedos = [[8, 6], [12, 10], [16, 14], [20, 18]];
  dedos.forEach(([punta, pip], i) => {
    const x = 0.4 + i * 0.07;
    lm[pip] = { x, y: 0.55 };
    lm[punta] = { x, y: puño ? 0.7 : 0.3 };                // puño: punta cerca de la muñeca
  });
  return lm;
}

describe('Altura de muñeca → apertura de compuerta', () => {
  const calib = { yBajo: 0.8, yAlto: 0.2 };

  test('mano abajo = 0, mano arriba = 1', () => {
    expect(aperturaDesdeAltura(0.8, calib)).toBeCloseTo(0, 9);
    expect(aperturaDesdeAltura(0.2, calib)).toBeCloseTo(1, 9);
  });
  test('punto medio = 0.5 y saturación fuera de rango', () => {
    expect(aperturaDesdeAltura(0.5, calib)).toBeCloseTo(0.5, 9);
    expect(aperturaDesdeAltura(0.95, calib)).toBe(0);
    expect(aperturaDesdeAltura(0.0, calib)).toBe(1);
  });
  test('calibración con rango pequeño es inválida', () => {
    expect(calibracionValida({ yBajo: 0.5, yAlto: 0.45 })).toBe(false);
    expect(calibracionValida(calib)).toBe(true);
    expect(calibracionValida(null)).toBe(false);
  });
});

describe('Detección de puño', () => {
  test('mano abierta no es puño', () => expect(esPuno(mano({ puño: false }))).toBe(false));
  test('mano cerrada es puño', () => expect(esPuno(mano({ puño: true }))).toBe(true));
  test('landmarks incompletos → false', () => expect(esPuno([])).toBe(false));
});

describe('Selección de mano (derecha del usuario = etiqueta Left en frame sin espejar)', () => {
  test('separa derecha e izquierda', () => {
    const a = mano({ puño: false });
    const b = mano({ puño: true });
    const r = separarManos({
      landmarks: [a, b],
      handedness: [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]],
    });
    expect(r.derecha).toBe(a);
    expect(r.izquierda).toBe(b);
  });
  test('sin resultados', () => {
    expect(separarManos(null)).toEqual({ derecha: null, izquierda: null });
  });
});

describe('Nivel 2: tormenta', () => {
  test('caudal: base fuera de la tormenta, pico a mitad', () => {
    expect(caudalNivel2(0)).toBe(NIVEL2.Qrio);
    expect(caudalNivel2(NIVEL2.duracion_s)).toBe(NIVEL2.Qrio);
    const mid = (NIVEL2.tormenta_inicio_s + NIVEL2.tormenta_fin_s) / 2;
    expect(caudalNivel2(mid)).toBeCloseTo(NIVEL2.Qrio + NIVEL2.tormenta_amplitud, 9);
  });

  function simular(politica) {
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0, 0, NIVEL2.Qrio);
    const dt = 1 / 60;
    let Vmax = s.V;
    let tObj = 0;
    for (let t = 0; t < NIVEL2.duracion_s; t += dt) {
      s.Qrio = caudalNivel2(t);
      const { utObj, uvObj } = politica(s, t);
      s.ut = saturar(s.ut + saturar(utObj - s.ut, -ACTUADORES.ut_velocidad_max * dt, ACTUADORES.ut_velocidad_max * dt), 0, 1);
      s.uv = saturar(s.uv + saturar(uvObj - s.uv, -ACTUADORES.uv_velocidad_max * dt, ACTUADORES.uv_velocidad_max * dt), 0, 1);
      for (let k = 0; k < 2; k++) s.paso(rk4, H_PASO * 1); // 2 pasos de 1/120 = 1/60
      Vmax = Math.max(Vmax, s.V);
    }
    return { s, Vmax };
  }

  test('sin vertedero el embalse supera el umbral de rebosamiento', () => {
    const { Vmax } = simular(() => ({ utObj: EQUILIBRIO.ut0, uvObj: 0 }));
    expect(Vmax).toBeGreaterThan(LIMITES.V_alarma_alta);
  });

  test('con vertedero (control simple) se evita el rebosamiento y se termina cerca de 30', () => {
    const { s, Vmax } = simular((sis) => ({
      utObj: EQUILIBRIO.ut0,
      uvObj: sis.V > 33 ? 1 : 0,
    }));
    expect(Vmax).toBeLessThan(LIMITES.V_alarma_alta);
    expect(Math.abs(s.V - LIMITES.V_objetivo)).toBeLessThanOrEqual(NIVEL2.V_final_tolerancia);
  });
});
