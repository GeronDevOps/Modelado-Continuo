/**
 * generar_linea_base.mjs
 * Línea base del modelo para la regresión del día 2 (guía día 2, secciones 5.1 y 5.7).
 *
 * El juego todavía no tiene el modo ?control=escalon, así que la respuesta al escalón se
 * obtiene sin interfaz con las MISMAS piezas que usa JuegoScene.update():
 *   SistemaContinuo.f  +  integrarDt(..., H_PASO = 1/120 s, rk4)  +  saturar(V, 0, 50)
 * avanzando por "cuadros" de duración 1/fps, igual que Phaser.
 *
 * Escalón: u_t = 0,44 → 0,46 en t = 2 s (Δu_t = +0,02), Q_río = 0,5, u_v = 0, V₀ = 30.
 * Valor final teórico: V = 30 − 500·0,02 = 20 hm³ (lejos de las saturaciones 0 y 50).
 * Se simulan 15 000 s de juego (6 τ, τ = 2500 s) y se registra cada 1 s.
 *
 * Uso (desde la raíz del repositorio):
 *   node documentacion_simjam_represa/analisis/generar_linea_base.mjs            → linea_base_escalon.csv (60 FPS)
 *   node documentacion_simjam_represa/analisis/generar_linea_base.mjs 15 salida.csv  → misma prueba a 15 FPS
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SistemaContinuo, saturar } from '../../src/modelo/SistemaContinuo.js';
import { rk4, H_PASO, integrarDt } from '../../src/modelo/integradores.js';
import { LIMITES } from '../../src/config/constantes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ESCALON = { u0: 0.44, u1: 0.46, t_escalon: 2, T_total: 15000, registro_s: 1 };

export function simularEscalon(fps = 60) {
  const s = new SistemaContinuo(30, ESCALON.u0, 0, 0.5);
  const dt = 1 / fps;
  const filas = ['t,u,y,P'];
  let proximoRegistro = 0;
  let t = 0;
  while (t <= ESCALON.T_total + 1e-9) {
    if (t >= proximoRegistro - 1e-9) {
      filas.push(`${t.toFixed(4)},${s.ut.toFixed(6)},${s.V.toFixed(8)},${s.P.toFixed(6)}`);
      proximoRegistro += ESCALON.registro_s;
    }
    s.ut = t >= ESCALON.t_escalon ? ESCALON.u1 : ESCALON.u0;
    s.V = integrarDt((v) => s.f(v), s.V, dt, H_PASO, rk4);
    s.V = saturar(s.V, 0, LIMITES.V_max);
    s.actualizarSalidas();
    t += dt;
  }
  return filas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fps = Number(process.argv[2] ?? 60);
  const ruta = process.argv[3] ?? join(__dirname, '../docs/linea_base_escalon.csv');
  const filas = simularEscalon(fps);
  writeFileSync(ruta, filas.join('\n') + '\n', 'utf-8');
  console.log(`CSV: ${ruta} (${filas.length - 1} muestras, ${fps} FPS)`);
}
