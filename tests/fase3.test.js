/**
 * fase3.test.js
 * Factibilidad del Nivel 3 con la demanda de referencia acotada
 * P_ref = min(P_demanda, P_max(V) + 5 MW).
 */

import { describe, test, expect } from 'vitest';
import { SistemaContinuo, saturar, demandaEfectiva, calcularPmax, calcularH } from '../src/modelo/SistemaContinuo.js';
import { rk4, H_PASO } from '../src/modelo/integradores.js';
import {
  NIVEL3, EQUILIBRIO, LIMITES, ACTUADORES, HIDRO, caudalNivel3, demandaNivel3,
} from '../src/config/constantes.js';

describe('Perfiles del Nivel 3', () => {
  test('caudal oscila entre 0.5 y 2.5 hm³/h', () => {
    let min = Infinity, max = -Infinity;
    for (let t = 0; t <= NIVEL3.duracion_s; t += 0.1) {
      const q = caudalNivel3(t);
      min = Math.min(min, q); max = Math.max(max, q);
    }
    expect(min).toBeCloseTo(0.5, 2);
    expect(max).toBeCloseTo(2.5, 2);
    expect(caudalNivel3(0)).toBeCloseTo(0.5, 9);
  });

  test('demanda escalonada entre 30 y 120 MW, con rampa continua', () => {
    let min = Infinity, max = -Infinity, saltoMax = 0, prev = demandaNivel3(0);
    for (let t = 0.05; t <= NIVEL3.duracion_s; t += 0.05) {
      const p = demandaNivel3(t);
      min = Math.min(min, p); max = Math.max(max, p);
      saltoMax = Math.max(saltoMax, Math.abs(p - prev));
      prev = p;
    }
    expect(min).toBe(30);
    expect(max).toBe(120);
    expect(saltoMax).toBeLessThan(10);  // sin saltos instantáneos
  });
});

describe('Demanda efectiva', () => {
  test('se acota por P_max(V) + 5', () => {
    expect(demandaEfectiva(120, 30)).toBeCloseTo(calcularPmax(30) + 5, 9);
    expect(demandaEfectiva(40, 30)).toBe(40);
  });
  test('con embalse bajo la referencia cae por debajo de la demanda cruda', () => {
    expect(demandaEfectiva(120, 5)).toBeLessThan(120);
  });
});

describe('Factibilidad del Nivel 3', () => {
  /**
   * @param {number} adelanto_s - >0 anticipa la demanda, <0 simula retardo humano
   */
  function jugar(adelanto_s) {
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0, 0, NIVEL3.Qrio);
    const dt = 1 / 60;
    let sumSq = 0, n = 0, Vmax = s.V, Vmin = s.V;
    for (let t = 0; t < NIVEL3.duracion_s; t += dt) {
      s.Qrio = caudalNivel3(t);
      // Jugador razonable: apunta a la demanda alcanzable y abre el vertedero si V > 36
      const pObj = demandaEfectiva(demandaNivel3(t + adelanto_s), s.V, NIVEL3.margen_Pmax_MW);
      const utObj = saturar(pObj / (HIDRO.eta * calcularH(s.V)), 0, 1);
      const uvObj = s.V > 36 ? 1 : 0;
      const vT = ACTUADORES.ut_velocidad_max * dt;
      const vV = ACTUADORES.uv_velocidad_max * dt;
      s.ut = saturar(s.ut + saturar(utObj - s.ut, -vT, vT), 0, 1);
      s.uv = saturar(s.uv + saturar(uvObj - s.uv, -vV, vV), 0, 1);
      for (let k = 0; k < 2; k++) s.paso(rk4, H_PASO);
      const pRef = demandaEfectiva(demandaNivel3(t), s.V, NIVEL3.margen_Pmax_MW);
      sumSq += (s.P - pRef) ** 2; n++;
      Vmax = Math.max(Vmax, s.V); Vmin = Math.min(Vmin, s.V);
    }
    return { rmse: Math.sqrt(sumSq / n), Vmax, Vmin };
  }

  test('seguimiento directo: RMSE ≤ 8 MW sin desborde ni descebe', () => {
    const { rmse, Vmax, Vmin } = jugar(0);
    expect(rmse).toBeLessThanOrEqual(NIVEL3.rmse_max_MW);
    expect(Vmax).toBeLessThan(LIMITES.V_max);
    expect(Vmin).toBeGreaterThan(LIMITES.V_min);
  });

  test('con 2 s de retardo humano todavía es aprobable', () => {
    expect(jugar(-2).rmse).toBeLessThanOrEqual(NIVEL3.rmse_max_MW);
  });

  test('sin vertedero y sin reaccionar a Q_río el volumen deriva (el vertedero importa)', () => {
    // Turbinas siguiendo la demanda pero vertedero cerrado: V sube más que con vertedero
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0, 0, NIVEL3.Qrio);
    for (let t = 0; t < NIVEL3.duracion_s; t += 1 / 60) {
      s.Qrio = caudalNivel3(t);
      s.ut = saturar(demandaEfectiva(demandaNivel3(t), s.V) / (HIDRO.eta * calcularH(s.V)), 0, 1);
      for (let k = 0; k < 2; k++) s.paso(rk4, H_PASO);
    }
    expect(s.V).toBeGreaterThan(36.2);
  });
});
