/**
 * niveles.test.js
 * Reglas del rediseño de niveles (src/juego/mecanicasNivel.js) y prueba de que
 * ningún nivel se gana sin tocar los controles.
 */

import { describe, test, expect } from 'vitest';
import { NIVEL1, NIVEL2, NIVEL3, LIMITES } from '../src/config/constantes.js';
import {
  etapaNivel1, faseNivel2, troncoActivo, uvMaximo, pronosticoCaudal,
  calibracionHabilitada, evaluarNivel,
} from '../src/juego/mecanicasNivel.js';
import { calcularP, calcularH } from '../src/modelo/SistemaContinuo.js';
import {
  simularNivel, quieto, jugadorRazonable,
} from '../documentacion_simjam_represa/analisis/simular_niveles.mjs';

describe('Ningún nivel se gana sin jugar', () => {
  for (const n of [1, 2, 3]) {
    test(`Nivel ${n}: con la consigna inicial fija se falla`, () => {
      expect(simularNivel(n, quieto(n)).exito).toBe(false);
    });
    test(`Nivel ${n}: un jugador razonable aprueba`, () => {
      expect(simularNivel(n, jugadorRazonable(n)).exito).toBe(true);
    });
  }
});

describe('Nivel 1: arranque fuera del equilibrio y etapas', () => {
  test('el estado inicial no está calibrado (V bajo y P lejos de 47,4)', () => {
    expect(NIVEL1.V0).toBeLessThan(LIMITES.V_objetivo - LIMITES.V_banda);
    const P0 = calcularP(calcularH(NIVEL1.V0), NIVEL1.ut0);
    expect(Math.abs(P0 - NIVEL1.P_demanda) / NIVEL1.P_demanda).toBeGreaterThan(NIVEL1.error_P_max);
  });

  test('etapas: llenar → potencia → sostener', () => {
    expect(etapaNivel1(25, 20, 47.4)).toMatchObject({ indice: 1, direccion: 'baja' });
    expect(etapaNivel1(36, 47, 47.4)).toMatchObject({ indice: 1, direccion: 'sube' });
    expect(etapaNivel1(29, 30, 47.4)).toMatchObject({ indice: 2, direccion: 'sube' });
    expect(etapaNivel1(29, 60, 47.4)).toMatchObject({ indice: 2, direccion: 'baja' });
    expect(etapaNivel1(30, 47.4, 47.4)).toMatchObject({ indice: 3, direccion: 'mantener' });
  });
});

describe('Nivel 2: fases, pronóstico y tronco', () => {
  test('secuencia de fases', () => {
    expect(faseNivel2(0).id).toBe('calma');
    expect(faseNivel2(NIVEL2.alerta_inicio_s).id).toBe('alerta');
    expect(faseNivel2(NIVEL2.tormenta_inicio_s).id).toBe('tormenta');
    expect(faseNivel2(NIVEL2.inicio_calibracion_s).id).toBe('recuperacion');
  });

  test('la calibración solo cuenta en la recuperación', () => {
    expect(calibracionHabilitada(NIVEL2, 10)).toBe(false);
    expect(calibracionHabilitada(NIVEL2, NIVEL2.inicio_calibracion_s)).toBe(true);
    expect(calibracionHabilitada(NIVEL1, 0)).toBe(true);
    expect(calibracionHabilitada(NIVEL3, 50)).toBe(false);   // N3 es de supervivencia
  });

  test('el pronóstico anticipa el pico de la tormenta', () => {
    expect(pronosticoCaudal(2, 50)).toBeCloseTo(3.0, 6);     // Q(60) = 0,5 + 2,5
  });

  test('el tronco limita el vertedero a 25 % solo entre 45 y 53 s', () => {
    expect(troncoActivo(2, 44.9)).toBe(false);
    expect(troncoActivo(2, 45)).toBe(true);
    expect(uvMaximo(2, 50)).toBe(NIVEL2.tronco_uv_max);
    expect(uvMaximo(2, 53)).toBe(LIMITES.uv_max);
    expect(uvMaximo(1, 50)).toBe(0);                          // N1 sin vertedero
    expect(troncoActivo(3, 50)).toBe(false);
  });

  test('el jugador razonable termina después de t = 90 s y sin desbordar', () => {
    const r = simularNivel(2, jugadorRazonable(2));
    expect(r.t).toBeGreaterThanOrEqual(NIVEL2.inicio_calibracion_s + NIVEL2.tiempo_banda_minimo);
    expect(r.Vmax).toBeLessThan(LIMITES.V_max);
  });
});

describe('evaluarNivel', () => {
  const base = { completadoTemprano: false, desborde: false, descebe: false, tiempoJugado: 120, rmse: 3, ens: 0.05 };
  test('calibración: gana solo si completó', () => {
    expect(evaluarNivel(NIVEL1, base)).toEqual({ exito: false, motivo: 'tiempo' });
    expect(evaluarNivel(NIVEL1, { ...base, completadoTemprano: true }).exito).toBe(true);
    expect(evaluarNivel(NIVEL2, { ...base, completadoTemprano: true, desborde: true }).motivo).toBe('desborde');
  });
  test('supervivencia: turno completo, RMSE y ENS', () => {
    expect(evaluarNivel(NIVEL3, base)).toEqual({ exito: true, motivo: 'turno_completo' });
    expect(evaluarNivel(NIVEL3, { ...base, tiempoJugado: 80 }).motivo).toBe('incompleto');
    expect(evaluarNivel(NIVEL3, { ...base, rmse: 9 }).motivo).toBe('rmse');
    expect(evaluarNivel(NIVEL3, { ...base, ens: 0.2 }).motivo).toBe('ens');
    expect(evaluarNivel(NIVEL3, { ...base, descebe: true }).motivo).toBe('descebe');
  });
});
