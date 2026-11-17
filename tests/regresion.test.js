/**
 * regresion.test.js — Prueba de regresión del día 2 (guía día 2, sección 5.5, paso 1).
 *
 * 1. Repite el escalón de la línea base (u_t 0,44 → 0,46 en t = 2 s) con SistemaContinuo,
 *    integrarDt y RK4 (h = 1/120 s), a 60 FPS y a 15 FPS (CPU ralentizada 4x), y compara
 *    con docs/linea_base_escalon.csv por métricas: valor final (< 0,5 %), tiempo de subida
 *    10-90 % (< 2 %) y sobreimpulso (< 1 punto porcentual). No compara punto a punto.
 * 2. Comprueba que los parámetros del MODELO no cambiaron respecto a la "Versión estable
 *    antes del día 2" (docs/niveles_linea_base.json, que se conserva como registro).
 * 3. Comprueba que NIVEL1/2/3 coinciden con la línea base del rediseño de niveles
 *    (docs/niveles_linea_base_v2.json). El rediseño cambió los niveles a propósito; la
 *    línea base se regenera solo con analisis/generar_linea_base_niveles.mjs y junto con
 *    docs/niveles.md.
 *
 * El arte y el sonido solo pueden LEER el modelo: si esta prueba falla, algo
 * está escribiendo en src/modelo/ o en src/config/constantes.js.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { simularEscalon } from '../documentacion_simjam_represa/analisis/generar_linea_base.mjs';
import {
  MODELO, HIDRO, TIEMPO, EQUILIBRIO, LIMITES, INTEGRADOR, ACTUADORES,
  NIVEL1, NIVEL2, NIVEL3,
} from '../src/config/constantes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, '../documentacion_simjam_represa/docs');

function leerCSV(texto) {
  const [cab, ...filas] = texto.trim().split(/\r?\n/);
  const cols = cab.split(',');
  const it = cols.indexOf('t'), iu = cols.indexOf('u'), iy = cols.indexOf('y');
  const t = [], u = [], y = [];
  for (const f of filas) {
    const c = f.split(',').map(Number);
    t.push(c[it]); u.push(c[iu]); y.push(c[iy]);
  }
  return { t, u, y };
}

/** Mismas métricas que analisis/regresion.py. */
function metricas({ t, u, y }) {
  let k0 = u.findIndex((v) => Math.abs(v - u[0]) > 1e-9);
  if (k0 < 0) k0 = 0;
  const y0 = y[Math.max(k0 - 1, 0)];
  const nFin = Math.max(1, Math.floor(y.length / 10));
  const yf = y.slice(-nFin).reduce((a, b) => a + b, 0) / nFin;
  const tt = t.slice(k0);
  const yn = y.slice(k0).map((v) => (v - y0) / (yf - y0));
  const cruce = (nivel) => {
    const k = yn.findIndex((v) => v >= nivel);
    return tt[k - 1] + (nivel - yn[k - 1]) / (yn[k] - yn[k - 1]) * (tt[k] - tt[k - 1]);
  };
  const tr = cruce(0.9) - cruce(0.1);
  const mp = Math.max(0, Math.max(...yn) - 1) * 100;
  return { yf, tr, mp };
}

const rutaBase = join(DOCS, 'linea_base_escalon.csv');

describe('Regresión del modelo (día 2)', () => {
  test('existe la línea base', () => {
    expect(existsSync(rutaBase)).toBe(true);
  });

  const base = metricas(leerCSV(readFileSync(rutaBase, 'utf-8')));

  for (const fps of [60, 15]) {
    test(`escalón a ${fps} FPS reproduce la línea base`, () => {
      const m = metricas(leerCSV(simularEscalon(fps).join('\n')));
      expect(Math.abs(m.yf - base.yf) / Math.abs(base.yf)).toBeLessThan(0.005);
      expect(Math.abs(m.tr - base.tr) / base.tr).toBeLessThan(0.02);
      expect(Math.abs(m.mp - base.mp)).toBeLessThan(1.0);
    });
  }

  test('los parámetros del modelo no cambiaron (línea base antes del día 2)', () => {
    const base = JSON.parse(readFileSync(join(DOCS, 'niveles_linea_base.json'), 'utf-8'));
    const claves = ['MODELO', 'HIDRO', 'TIEMPO', 'EQUILIBRIO', 'LIMITES', 'INTEGRADOR', 'ACTUADORES'];
    const esperado = Object.fromEntries(claves.map((k) => [k, base[k]]));
    const actual = JSON.parse(JSON.stringify({
      MODELO, HIDRO, TIEMPO, EQUILIBRIO, LIMITES, INTEGRADOR, ACTUADORES,
    }));
    expect(actual).toEqual(esperado);
  });

  test('los niveles coinciden con la línea base del rediseño', () => {
    const esperado = JSON.parse(readFileSync(join(DOCS, 'niveles_linea_base_v2.json'), 'utf-8'));
    const actual = JSON.parse(JSON.stringify({ NIVEL1, NIVEL2, NIVEL3 }));
    expect(actual).toEqual(esperado);
  });
});
