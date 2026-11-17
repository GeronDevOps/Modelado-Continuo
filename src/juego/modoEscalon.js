/**
 * modoEscalon.js
 * Modo de prueba ?control=escalon (guía día 2, secciones 5.1 y 5.7).
 *
 * Reemplaza la mano/teclado por un escalón en la consigna de u_t y registra la respuesta
 * del modelo que integra JuegoScene (mismo SistemaContinuo, integrarDt, RK4, h = 1/120 s).
 * No toca src/modelo/: solo fija la consigna, lee el estado y descarga un CSV (t, u, y, ut, P).
 *
 * Parámetros de la URL (todos opcionales salvo control=escalon):
 *   control=escalon            activa el modo
 *   u0=0.44  u1=0.46  t0=2     consigna antes y después del escalón, e instante del escalón [s de juego]
 *   T=15000                    duración del ensayo [s de juego] (6τ con τ = 2500 s)
 *   vel=100                    s de juego por s real; el modelo se integra igual con h fijo,
 *                              solo se le entrega más tiempo por cuadro (vel=1 = tiempo real)
 *   archivo=dia2_escalon       nombre del CSV descargado (sin extensión)
 *
 * Ejemplo: http://localhost:5173/?control=escalon
 *          http://localhost:5173/?control=escalon&archivo=dia2_escalon_lento   (con CPU 4x en DevTools)
 */

/** Lee la configuración del modo escalón desde la URL; null si no está activo. */
export function leerModoEscalon(search = globalThis.location?.search ?? '') {
  const q = new URLSearchParams(search);
  if (q.get('control') !== 'escalon') return null;
  const num = (k, def) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : def;
  };
  return {
    u0: num('u0', 0.44),
    u1: num('u1', 0.46),
    t0: num('t0', 2),
    T: num('T', 15000),
    velocidad: Math.max(1, num('vel', 100)),
    archivo: (q.get('archivo') || 'dia2_escalon').replace(/[^\w.-]/g, '_'),
  };
}

export class RegistroEscalon {
  /** @param {ReturnType<typeof leerModoEscalon>} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this.filas = ['t,u,y,ut,P'];
    this.terminado = false;
  }

  /** Consigna de u_t en el instante t [s de juego]. */
  consigna(t) {
    return t >= this.cfg.t0 ? this.cfg.u1 : this.cfg.u0;
  }

  /** Registra una muestra. Devuelve true cuando el ensayo llegó a T. */
  registrar(t, u, sistema) {
    if (this.terminado) return true;
    this.filas.push(`${t.toFixed(4)},${u.toFixed(6)},${sistema.V.toFixed(8)},${sistema.ut.toFixed(6)},${sistema.P.toFixed(6)}`);
    if (t >= this.cfg.T) this.terminado = true;
    return this.terminado;
  }

  get muestras() {
    return this.filas.length - 1;
  }

  /** Descarga el CSV en el navegador. */
  descargar() {
    const blob = new Blob([this.filas.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.cfg.archivo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
