/**
 * integradores.js
 * Integradores numéricos de paso fijo para EDOs de primer orden.
 *
 * Firma estándar de función de derivada:
 *   f(x) => dx/dt
 *
 * Paso fijo: h = 1/120 s (sincronizado con 120 fps de Phaser)
 */

import { INTEGRADOR } from '../config/constantes.js';

/** Paso de integración fijo [s] */
export const H_PASO = INTEGRADOR.h;  // 1/120 s ≈ 0.008333 s

// ─── EULER ────────────────────────────────────────────────────────────────────

/**
 * Método de Euler explícito (orden 1).
 * x[n+1] = x[n] + h · f(x[n])
 *
 * @param {function} f  - Función de derivada: f(x) => dx/dt
 * @param {number}   x  - Estado actual
 * @param {number}   h  - Paso de integración [s]
 * @returns {number}      Nuevo estado x[n+1]
 */
export function euler(f, x, h = H_PASO) {
  return x + h * f(x);
}

// ─── RK4 ──────────────────────────────────────────────────────────────────────

/**
 * Método de Runge-Kutta de orden 4 (RK4), paso fijo.
 * Ofrece precisión O(h⁵) por paso, O(h⁴) global.
 *
 * k1 = f(x)
 * k2 = f(x + h/2 · k1)
 * k3 = f(x + h/2 · k2)
 * k4 = f(x + h · k3)
 * x[n+1] = x[n] + h/6 · (k1 + 2·k2 + 2·k3 + k4)
 *
 * @param {function} f  - Función de derivada: f(x) => dx/dt
 * @param {number}   x  - Estado actual
 * @param {number}   h  - Paso de integración [s]
 * @returns {number}      Nuevo estado x[n+1]
 */
export function rk4(f, x, h = H_PASO) {
  const k1 = f(x);
  const k2 = f(x + (h / 2) * k1);
  const k3 = f(x + (h / 2) * k2);
  const k4 = f(x + h * k3);
  return x + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

// ─── INTEGRACIÓN DE MÚLTIPLES PASOS ──────────────────────────────────────────

/**
 * Integra la EDO durante dt segundos usando el método indicado,
 * subdividiendo en pasos de longitud h.
 * Útil para avanzar la simulación un fotograma completo.
 *
 * @param {function} f       - Función de derivada: f(x) => dx/dt
 * @param {number}   x0      - Estado inicial
 * @param {number}   dt      - Tiempo total a integrar [s]
 * @param {number}   h       - Paso fijo de integración [s]
 * @param {function} metodo  - Función integradora (euler o rk4)
 * @returns {number}           Estado final
 */
export function integrarDt(f, x0, dt, h = H_PASO, metodo = rk4) {
  let x = x0;
  let t = 0;

  // Pasos completos
  const nPasos = Math.floor(dt / h);
  for (let i = 0; i < nPasos; i++) {
    x = metodo(f, x, h);
    t += h;
  }

  // Paso residual (si queda fracción de paso)
  const residuo = dt - t;
  if (residuo > 1e-10) {
    x = metodo(f, x, residuo);
  }

  return x;
}
