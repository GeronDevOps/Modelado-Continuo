/**
 * SistemaContinuo.js
 * Modelo matemático en espacio de estados del embalse hidroeléctrico.
 *
 * Variables físicas:
 *   x(t) = V(t)            [hm³]   — Volumen del embalse (estado)
 *   u[0] = u_t(t)          [adm]   — Apertura compuerta turbinas [0,1]
 *   u[1] = u_v(t)          [adm]   — Apertura compuerta vertedero [0,1]
 *   d(t) = Q_río(t)        [hm³/h] — Caudal de entrada (perturbación)
 *
 * Espacio de estados (en h⁻¹, unidades físicas):
 *   ẋ = A·x + B·u + E·d
 *   y = C·x + D·u
 *
 *   A = [-0.002]
 *   B = [-1.0, -2.0]
 *   E = [1.0]
 *   C = [1.0]
 *   D = [0, 0]
 *
 * EDO resultante:
 *   dV/dt = -0.002·V - 1·u_t - 2·u_v + 1·Q_río   [hm³/h]
 *
 * Escala temporal de juego (1 h real = 5 s juego):
 *   dV/dt_juego = dV/dt_físico × (1 h / 5 s) = dV/dt_físico × 0.2   [hm³/s_juego]
 *
 * Constante de tiempo: τ = 1/0.002 = 500 h = 2500 s de juego
 */

import { MODELO, HIDRO, TIEMPO, LIMITES } from '../config/constantes.js';

/**
 * Calcula la derivada del estado (dV/dt) en tiempo de juego.
 *
 * @param {number} V      - Volumen actual [hm³]
 * @param {number} ut     - Apertura turbinas [0,1]
 * @param {number} uv     - Apertura vertedero [0,1]
 * @param {number} Qrio   - Caudal del río [hm³/h]
 * @returns {number}        dV/dt en [hm³/s_juego]
 */
export function derivada(V, ut, uv, Qrio) {
  // EDO en tiempo físico [hm³/h]:
  //   dV/dt_físico = E·Qrío + B[0]·ut + B[1]·uv + A·V
  const dV_dt_fisico =
    MODELO.E * Qrio +
    MODELO.B[0] * ut +
    MODELO.B[1] * uv +
    MODELO.A * V;

  // Convertir a tiempo de juego: multiplicar por horas_por_segundo_juego (0.2 h/s)
  return dV_dt_fisico * TIEMPO.horas_por_segundo_juego;
}

/**
 * Calcula la cabeza hidráulica H en función del volumen V.
 * H(V) = 20 + 0.8·V   [m]
 *
 * @param {number} V  - Volumen [hm³]
 * @returns {number}    Cabeza hidráulica [m]
 */
export function calcularH(V) {
  return HIDRO.H_base + HIDRO.H_slope * V;
}

/**
 * Calcula la potencia eléctrica generada.
 * P = η · H · Q_t = 2.45 · H · (Kt · ut)   [MW]
 *
 * @param {number} H   - Cabeza hidráulica [m]
 * @param {number} ut  - Apertura turbinas [0,1]
 * @returns {number}     Potencia generada [MW]
 */
export function calcularP(H, ut) {
  const Qt = HIDRO.Kt * ut;   // Caudal turbinado [hm³/h]
  return HIDRO.eta * H * Qt;
}

/**
 * Calcula la potencia máxima posible dado el volumen actual.
 * P_max(V) = η · H(V) · Kt · ut_max
 *
 * @param {number} V - Volumen [hm³]
 * @returns {number}   Potencia máxima [MW]
 */
export function calcularPmax(V) {
  const H = calcularH(V);
  return HIDRO.eta * H * HIDRO.Kt * LIMITES.ut_max;
}

/**
 * Demanda de referencia alcanzable (factibilidad del Nivel 3):
 *   P_ref = min(P_demanda, P_max(V) + margen)
 *
 * @param {number} Pdem   - Demanda cruda [MW]
 * @param {number} V      - Volumen actual [hm³]
 * @param {number} margen - Margen sobre P_max [MW]
 * @returns {number}
 */
export function demandaEfectiva(Pdem, V, margen = 5) {
  return Math.min(Pdem, calcularPmax(V) + margen);
}

/**
 * Satura el valor de apertura de la compuerta al rango [min, max].
 *
 * @param {number} u    - Valor sin saturar
 * @param {number} min  - Mínimo permitido
 * @param {number} max  - Máximo permitido
 * @returns {number}      Valor saturado
 */
export function saturar(u, min, max) {
  return Math.max(min, Math.min(max, u));
}

/**
 * Clase que encapsula el estado completo del sistema y permite
 * avanzar la simulación un paso de integración.
 */
export class SistemaContinuo {
  /**
   * @param {number} V0      - Volumen inicial [hm³]
   * @param {number} ut0     - Apertura inicial turbinas [0,1]
   * @param {number} uv0     - Apertura inicial vertedero [0,1]
   * @param {number} Qrio0   - Caudal inicial del río [hm³/h]
   */
  constructor(V0 = 30.0, ut0 = 0.44, uv0 = 0.0, Qrio0 = 0.5) {
    this.V = V0;
    this.ut = ut0;
    this.uv = uv0;
    this.Qrio = Qrio0;

    // Salidas calculadas
    this.H = calcularH(this.V);
    this.P = calcularP(this.H, this.ut);
    this.t = 0.0;  // Tiempo de juego [s]
  }

  /**
   * Actualiza las salidas algebraicas (H y P) a partir del estado actual.
   */
  actualizarSalidas() {
    this.H = calcularH(this.V);
    this.P = calcularP(this.H, this.ut);
  }

  /**
   * Devuelve la derivada dV/dt en tiempo de juego para el estado actual.
   * Función conveniente para pasarla a los integradores.
   *
   * @param {number} V   - Volumen [hm³]
   * @returns {number}     dV/dt [hm³/s_juego]
   */
  f(V) {
    return derivada(V, this.ut, this.uv, this.Qrio);
  }

  /**
   * Avanza el sistema un paso h usando el método proporcionado.
   *
   * @param {function} metodo   - Función integradora: (f, x, h) => x_nuevo
   * @param {number}   h        - Paso de integración [s_juego]
   */
  paso(metodo, h) {
    this.V = metodo((v) => this.f(v), this.V, h);
    // Aplicar límites físicos del embalse
    this.V = Math.max(0.0, Math.min(LIMITES.V_max, this.V));
    this.t += h;
    this.actualizarSalidas();
  }

  /**
   * Devuelve un snapshot del estado actual para logging/CSV.
   *
   * @returns {object} Snapshot del estado
   */
  snapshot() {
    return {
      t: this.t,
      V: this.V,
      H: this.H,
      P: this.P,
      ut: this.ut,
      uv: this.uv,
      Qrio: this.Qrio,
    };
  }
}
