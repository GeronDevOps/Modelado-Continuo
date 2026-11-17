/**
 * fase3.test.js
 * Perfiles y factibilidad del Nivel 3 rediseñado: demanda por barrios con deslastre,
 * avería de una turbina y criterio de turno completo (RMSE ≤ 8 MW y ENS ≤ 12 %).
 */

import { describe, test, expect } from 'vitest';
import { demandaEfectiva, calcularPmax } from '../src/modelo/SistemaContinuo.js';
import {
  NIVEL3, LIMITES, caudalNivel3, demandaNivel3, demandaPorSector,
} from '../src/config/constantes.js';
import {
  demandaActiva, capacidadDisponible, volumenNecesario, utMaximo, averiaActiva, avisoAveria,
} from '../src/juego/mecanicasNivel.js';
import {
  simularNivel, quieto, jugadorRazonable,
} from '../documentacion_simjam_represa/analisis/simular_niveles.mjs';

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

describe('Barrios y deslastre', () => {
  test('los barrios suman la demanda total y el hospital es fijo', () => {
    for (const D of [30, 45, 70, 120]) {
      const s = demandaPorSector(D);
      expect(s.hospital + s.industria + s.casas).toBeCloseTo(D, 9);
      expect(s.hospital).toBe(15);
    }
  });

  test('cortar un barrio baja la demanda activa y suma ENS ponderada', () => {
    const t = 70; // escalón de 120 MW
    const sin = demandaActiva(3, t);
    const ind = demandaActiva(3, t, new Set(['industria']));
    const cas = demandaActiva(3, t, new Set(['casas']));
    expect(sin.activa).toBe(120);
    expect(ind.activa).toBeCloseTo(120 - 0.45 * 105, 9);
    expect(ind.cortadaPonderada).toBeCloseTo(1.0 * 0.45 * 105, 9);
    expect(cas.cortadaPonderada).toBeCloseTo(1.5 * 0.55 * 105, 9);
  });

  test('el hospital no se puede cortar', () => {
    const d = demandaActiva(3, 70, new Set(['hospital']));
    expect(d.activa).toBe(120);
    expect(d.cortada).toBe(0);
  });
});

describe('Avería y capacidad disponible', () => {
  test('la avería limita u_t a 0,66 entre 62 y 77 s, con aviso de 3 s', () => {
    expect(utMaximo(3, 61.9)).toBe(LIMITES.ut_max);
    expect(utMaximo(3, 62)).toBe(NIVEL3.averia_ut_max);
    expect(utMaximo(3, 77)).toBe(LIMITES.ut_max);
    expect(averiaActiva(3, 70)).toBe(true);
    expect(avisoAveria(3, 60)).toBeCloseTo(2, 9);
    expect(avisoAveria(3, 50)).toBe(null);
    expect(utMaximo(2, 70)).toBe(LIMITES.ut_max);          // solo en el Nivel 3
  });

  test('con la avería ni el embalse lleno alcanza para 120 MW (hay que deslastrar)', () => {
    expect(capacidadDisponible(3, 70, LIMITES.V_max)).toBeLessThan(120);
    expect(volumenNecesario(3, 70, 120)).toBeGreaterThan(LIMITES.V_max);
  });

  test('sin avería, 120 MW requieren acumular V ≥ 36,2 hm³', () => {
    expect(volumenNecesario(3, 85, 120)).toBeCloseTo(36.22, 1);
    expect(capacidadDisponible(3, 85, 30)).toBeCloseTo(calcularPmax(30), 9);
  });
});

describe('Factibilidad del Nivel 3 (simulación de JuegoScene sin interfaz)', () => {
  test('sin tocar nada se falla', () => {
    expect(simularNivel(3, quieto(3)).exito).toBe(false);
  });

  test('cortando la industria cuando falta capacidad se aprueba', () => {
    const r = simularNivel(3, jugadorRazonable(3));
    expect(r.exito).toBe(true);
    expect(r.rmse).toBeLessThanOrEqual(NIVEL3.rmse_max_MW);
    expect(r.ens).toBeLessThanOrEqual(NIVEL3.ens_max);
  });

  test('con 1 s de retardo humano todavía es aprobable', () => {
    expect(simularNivel(3, jugadorRazonable(3, { retardo_s: 1 })).exito).toBe(true);
  });

  test('la decisión importa: cortar las casas excede la ENS y no cortar excede el RMSE', () => {
    expect(simularNivel(3, jugadorRazonable(3, { cortar: 'casas' })).motivo).toBe('ens');
    expect(simularNivel(3, jugadorRazonable(3, { cortar: 'ninguno' })).motivo).toBe('rmse');
  });
});

describe('demandaEfectiva (utilidad del modelo, ya no la usa el Nivel 3)', () => {
  test('se acota por P_max(V) + 5', () => {
    expect(demandaEfectiva(120, 30)).toBeCloseTo(calcularPmax(30) + 5, 9);
    expect(demandaEfectiva(40, 30)).toBe(40);
  });
});
