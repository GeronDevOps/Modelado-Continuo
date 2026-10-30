/**
 * progreso.js
 * Persistencia local (localStorage) de resultados por nivel. Sin backend.
 */

const CLAVE = 'aislados_patagonia_progreso_v1';

export function leerProgreso() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {};
  } catch (e) {
    return {};
  }
}

/**
 * Guarda el resultado de un nivel conservando el mejor intento.
 * @param {number} nivel
 * @param {{exito:boolean, errorPMedio:number, rmse?:number}} r
 */
export function guardarResultado(nivel, r) {
  try {
    const p = leerProgreso();
    const previo = p[nivel] || { aprobado: false, intentos: 0 };
    p[nivel] = {
      aprobado: previo.aprobado || !!r.exito,
      intentos: previo.intentos + 1,
      mejorErrorP: Math.min(previo.mejorErrorP ?? Infinity, r.errorPMedio),
      mejorRmse: r.rmse === undefined ? previo.mejorRmse : Math.min(previo.mejorRmse ?? Infinity, r.rmse),
    };
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch (e) {
    // localStorage no disponible: se ignora
  }
}
