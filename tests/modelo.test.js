/**
 * modelo.test.js
 * Tests de Vitest para el núcleo matemático del embalse.
 *
 * Cobertura:
 *   1. Equilibrio: V0=30, ut=0.44, uv=0, Qrío=0.5  →  dV/dt ≈ 0
 *   2. Respuesta al escalón: Δut=+0.1  →  V decrece
 *   3. Consistencia Euler vs RK4: diferencia < 0.05 hm³ en 10 s
 *   4. Relaciones algebraicas: H(30)=44m, P_equilibrio≈47.4 MW
 *   5. Exportación: genera /docs/vensim_escalon.csv con ≥500 filas
 */

import { describe, test, expect } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { derivada, calcularH, calcularP, SistemaContinuo } from '../src/modelo/SistemaContinuo.js';
import { euler, rk4, H_PASO } from '../src/modelo/integradores.js';
import { EQUILIBRIO, TIEMPO } from '../src/config/constantes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const TOLERANCIA = 1e-6;

// Generar CSV al cargar el módulo (antes de todos los tests)
generarVensimCSV();

// ─── 1. EQUILIBRIO ────────────────────────────────────────────────────────────
describe('Equilibrio del sistema', () => {
  test('dV/dt_físico ≈ 0 en punto de operación', () => {
    const { V0, ut0, uv0, Qrio0 } = EQUILIBRIO;
    const dV = Qrio0 + (-1.0) * ut0 + (-2.0) * uv0 + (-0.002) * V0;
    // 0.5 − 0.44 − 0 − 0.06 = 0
    expect(Math.abs(dV)).toBeLessThan(TOLERANCIA);
  });

  test('derivada() en tiempo de juego ≈ 0 en equilibrio', () => {
    const { V0, ut0, uv0, Qrio0 } = EQUILIBRIO;
    const dV = derivada(V0, ut0, uv0, Qrio0);
    expect(Math.abs(dV)).toBeLessThan(TOLERANCIA);
  });

  test('Sistema en equilibrio permanece estable durante 120 s de juego', () => {
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0, EQUILIBRIO.uv0, EQUILIBRIO.Qrio0);
    const pasos = Math.round(120 / H_PASO);
    for (let i = 0; i < pasos; i++) s.paso(rk4, H_PASO);
    expect(Math.abs(s.V - EQUILIBRIO.V0)).toBeLessThan(0.001);
  });
});

// ─── 2. RELACIONES ALGEBRAICAS ────────────────────────────────────────────────
describe('Relaciones algebraicas', () => {
  test('H(V=0) = 20 m',  () => expect(calcularH(0)).toBeCloseTo(20.0, 6));
  test('H(V=30) = 44 m', () => expect(calcularH(30)).toBeCloseTo(44.0, 6));
  test('H(V=50) = 60 m', () => expect(calcularH(50)).toBeCloseTo(60.0, 6));

  test('P en punto de operación ≈ 47.432 MW', () => {
    const P0 = calcularP(calcularH(EQUILIBRIO.V0), EQUILIBRIO.ut0);
    // 2.45 × 44 × 0.44 = 47.432
    expect(P0).toBeCloseTo(47.432, 2);
  });

  test('P_max (V=50, ut=1) ≈ 147 MW', () => {
    expect(calcularP(calcularH(50), 1.0)).toBeCloseTo(147.0, 2);
  });
});

// ─── 3. RESPUESTA AL ESCALÓN ──────────────────────────────────────────────────
describe('Respuesta al escalón', () => {
  test('Δu_t = +0.1 → V disminuye en 10 s', () => {
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0 + 0.1, 0, EQUILIBRIO.Qrio0);
    const pasos = Math.round(10 / H_PASO);
    for (let i = 0; i < pasos; i++) s.paso(rk4, H_PASO);
    expect(s.V).toBeLessThan(EQUILIBRIO.V0);
  });

  test('Δu_t = -0.1 → V aumenta en 10 s', () => {
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0 - 0.1, 0, EQUILIBRIO.Qrio0);
    const pasos = Math.round(10 / H_PASO);
    for (let i = 0; i < pasos; i++) s.paso(rk4, H_PASO);
    expect(s.V).toBeGreaterThan(EQUILIBRIO.V0);
  });

  test('u_v = 1.0 → V cae > 1 hm³ en 10 s', () => {
    const s = new SistemaContinuo(EQUILIBRIO.V0, EQUILIBRIO.ut0, 1.0, EQUILIBRIO.Qrio0);
    const pasos = Math.round(10 / H_PASO);
    for (let i = 0; i < pasos; i++) s.paso(rk4, H_PASO);
    expect(s.V).toBeLessThan(EQUILIBRIO.V0 - 1.0);
  });
});

// ─── 4. CONSISTENCIA EULER vs RK4 ─────────────────────────────────────────────
describe('Consistencia Euler vs RK4', () => {
  test('Diferencia < 0.05 hm³ en 10 s (escalón Δut=0.1)', () => {
    const ut  = EQUILIBRIO.ut0 + 0.1;
    const sE  = new SistemaContinuo(EQUILIBRIO.V0, ut, 0, EQUILIBRIO.Qrio0);
    const sRK = new SistemaContinuo(EQUILIBRIO.V0, ut, 0, EQUILIBRIO.Qrio0);
    const pasos = Math.round(10 / H_PASO);
    for (let i = 0; i < pasos; i++) {
      sE.paso(euler, H_PASO);
      sRK.paso(rk4, H_PASO);
    }
    expect(Math.abs(sE.V - sRK.V)).toBeLessThan(0.05);
  });
});

// ─── 5. CONSTANTE DE TIEMPO ───────────────────────────────────────────────────
describe('Constante de tiempo', () => {
  test('τ_físico = 500 h, τ_juego = 2500 s (500 h × 5 s/h)', () => {
    expect(1 / 0.002).toBe(500);            // τ_físico
    expect(TIEMPO.tau_juego_s).toBe(2500);  // τ_juego exportada
    expect(500 * 5).toBe(2500);             // 500 h × 5 s/h
  });
});

// ─── 6. EXPORTACIÓN CSV ────────────────────────────────────────────────────────
describe('Exportación CSV Vensim', () => {
  test('vensim_escalon.csv tiene encabezado correcto y ≥ 500 filas', () => {
    const csvPath = join(__dirname, '../docs/vensim_escalon.csv');
    const contenido = readFileSync(csvPath, 'utf-8');
    const lineas = contenido.trim().split('\n');
    expect(lineas.length).toBeGreaterThan(500);
    expect(lineas[0]).toContain('t_s');
    expect(lineas[0]).toContain('V_hm3');
    expect(lineas[0]).toContain('P_MW');
    // Verificar que los datos son numéricos
    const primera = lineas[1].split(',');
    expect(parseFloat(primera[0])).toBeCloseTo(0, 2);   // t≈0
    expect(parseFloat(primera[1])).toBeCloseTo(30, 1);  // V≈30
  });
});

// ─── FUNCIÓN DE GENERACIÓN CSV ────────────────────────────────────────────────
function generarVensimCSV() {
  const docsDir = join(__dirname, '../docs');
  mkdirSync(docsDir, { recursive: true });

  const filas = ['t_s,V_hm3,H_m,ut,uv,Qrio,P_MW'];

  // Simular respuesta al escalón: Δut = +0.1 desde equilibrio, 60 s de juego
  const sistema = new SistemaContinuo(
    EQUILIBRIO.V0,
    EQUILIBRIO.ut0 + 0.1,
    0.0,
    EQUILIBRIO.Qrio0
  );

  const T_total     = 60.0;
  const T_muestreo  = 0.1;
  const pasosPorMuestra = Math.round(T_muestreo / H_PASO);
  const nMuestras   = Math.round(T_total / T_muestreo);

  // Fila t=0
  const s0 = sistema.snapshot();
  filas.push(
    `${s0.t.toFixed(4)},${s0.V.toFixed(6)},${s0.H.toFixed(4)},` +
    `${s0.ut.toFixed(6)},${s0.uv.toFixed(6)},${s0.Qrio.toFixed(6)},${s0.P.toFixed(6)}`
  );

  for (let m = 0; m < nMuestras; m++) {
    for (let k = 0; k < pasosPorMuestra; k++) sistema.paso(rk4, H_PASO);
    const s = sistema.snapshot();
    filas.push(
      `${s.t.toFixed(4)},${s.V.toFixed(6)},${s.H.toFixed(4)},` +
      `${s.ut.toFixed(6)},${s.uv.toFixed(6)},${s.Qrio.toFixed(6)},${s.P.toFixed(6)}`
    );
  }

  const csvPath = join(docsDir, 'vensim_escalon.csv');
  writeFileSync(csvPath, filas.join('\n'), 'utf-8');
  console.log(`\n✅ CSV exportado: ${csvPath} (${filas.length} líneas)\n`);
}
