/**
 * simular_niveles.mjs — Simulación sin interfaz de los 3 niveles rediseñados.
 *
 * Repite el orden de JuegoScene.update(): perturbación → consigna del jugador →
 * actuadores con velocidad y límites del nivel (tronco, avería) → RK4 con integrarDt
 * (h = 1/120 s) → métricas → criterio de evaluarNivel(). Lo usan tests/niveles.test.js
 * y este mismo archivo como script:
 *
 *   node documentacion_simjam_represa/analisis/simular_niveles.mjs
 *
 * Una "política" es una función (estado) → { utObj, uvObj, cortados } que hace de jugador.
 */

import { SistemaContinuo, saturar, calcularH } from '../../src/modelo/SistemaContinuo.js';
import { rk4, H_PASO, integrarDt } from '../../src/modelo/integradores.js';
import { LIMITES, ACTUADORES, HIDRO, caudalPorNivel } from '../../src/config/constantes.js';
import {
  configNivel, uvMaximo, utMaximo, demandaActiva, calibracionHabilitada,
  estadoCalibracion, evaluarNivel,
} from '../../src/juego/mecanicasNivel.js';

/**
 * @param {number} nivel
 * @param {(e:{t:number,V:number,P:number,ut:number,uv:number,Qrio:number,D:number,nivel:number}) =>
 *         {utObj:number, uvObj?:number, cortados?:Set<string>}} politica
 * @param {number} [dt=1/60] - duración del cuadro [s]
 */
export function simularNivel(nivel, politica, dt = 1 / 60) {
  const cfg = configNivel(nivel);
  const s = new SistemaContinuo(cfg.V0, cfg.ut0, 0, cfg.Qrio);
  let t = 0, banda = 0, bandaMax = 0, sumSq = 0, sumT = 0, ensNum = 0, ensDen = 0;
  let Vmax = s.V, Vmin = s.V, completadoTemprano = false, desborde = false, descebe = false;
  let cortados = new Set();

  while (t < cfg.duracion_s - 1e-9) {
    s.Qrio = caudalPorNivel(nivel, t);
    const d0 = demandaActiva(nivel, t, cortados);
    const o = politica({ t, V: s.V, P: s.P, ut: s.ut, uv: s.uv, Qrio: s.Qrio, D: d0.total, nivel });
    cortados = o.cortados ?? cortados;
    const vT = ACTUADORES.ut_velocidad_max * dt;
    const vV = ACTUADORES.uv_velocidad_max * dt;
    const uvObj = cfg.uv_habilitado ? (o.uvObj ?? 0) : 0;
    s.ut = saturar(s.ut + saturar(saturar(o.utObj, 0, 1) - s.ut, -vT, vT), 0, utMaximo(nivel, t));
    s.uv = saturar(s.uv + saturar(uvObj - s.uv, -vV, vV), 0, uvMaximo(nivel, t));

    s.V = saturar(integrarDt((v) => s.f(v), s.V, dt, H_PASO, rk4), 0, LIMITES.V_max);
    s.actualizarSalidas();
    t += dt;

    const d = demandaActiva(nivel, t, cortados);
    Vmax = Math.max(Vmax, s.V); Vmin = Math.min(Vmin, s.V);
    const { calibrado } = estadoCalibracion(cfg, s.V, s.P, d.activa);
    if (calibracionHabilitada(cfg, t) && calibrado) {
      banda += dt; bandaMax = Math.max(bandaMax, banda);
    } else banda = 0;
    sumSq += (s.P - d.activa) ** 2 * dt; sumT += dt;
    ensNum += d.cortadaPonderada * dt; ensDen += d.total * dt;

    if (cfg.modo === 'calibracion' && banda >= cfg.tiempo_banda_minimo) { completadoTemprano = true; break; }
    if (nivel >= 2 && s.V >= LIMITES.V_max) { desborde = true; break; }
    if (nivel >= 2 && s.V <= LIMITES.V_min) { descebe = true; break; }
  }
  const rmse = Math.sqrt(sumSq / Math.max(sumT, 1e-9));
  const ens = ensDen > 0 ? ensNum / ensDen : 0;
  const r = evaluarNivel(cfg, { completadoTemprano, desborde, descebe, tiempoJugado: t, rmse, ens });
  return { ...r, t, V: s.V, Vmax, Vmin, bandaMax, rmse, ens };
}

// ─── POLÍTICAS DE REFERENCIA ("jugadores" sintéticos) ─────────────────────────

/** No tocar nada: la consigna se queda en el valor inicial del nivel. */
export const quieto = (nivel) => {
  const ut0 = configNivel(nivel).ut0;
  return () => ({ utObj: ut0, uvObj: 0 });
};

/** u_t que entrega la potencia D con el volumen actual. */
const utPara = (D, V) => D / (HIDRO.eta * calcularH(V));

/**
 * Jugador razonable. `retardo_s` simula reacción humana: decide con la demanda de
 * hace `retardo_s` segundos (o la anticipa si es negativo).
 */
export function jugadorRazonable(nivel, { retardo_s = 0, cortar = 'industria' } = {}) {
  return (e) => {
    const tv = Math.max(0, e.t - retardo_s);
    if (nivel === 1) {
      // Llenar con turbinas cerradas hasta 29,5 y luego seguir la demanda
      return { utObj: e.V < 29.5 ? 0 : utPara(47.4, e.V), uvObj: 0 };
    }
    if (nivel === 2) {
      // Vertedero proporcional al exceso sobre 30 (abrir a medias), turbinas en 47,4 MW
      const uvObj = saturar((e.V - 30) / 4, 0, 1);
      return { utObj: utPara(47.4, e.V), uvObj };
    }
    // Nivel 3: corta un barrio cuando la demanda supera la capacidad disponible
    const capacidad = HIDRO.eta * calcularH(e.V) * utMaximo(3, tv);
    const cortados = new Set();
    let D = demandaActiva(3, tv).activa;
    if (D > capacidad) { cortados.add(cortar); D = demandaActiva(3, tv, cortados).activa; }
    const uvObj = e.V > 38 ? saturar((e.V - 38) / 4, 0, 1) : 0;
    return { utObj: utPara(D, e.V), uvObj, cortados };
  };
}

// ─── SCRIPT ───────────────────────────────────────────────────────────────────
const esScript = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('analisis/simular_niveles.mjs');
if (esScript) {
  const fmt = (r) => `${r.exito ? 'APRUEBA' : 'FALLA  '} (${r.motivo}) t=${r.t.toFixed(1)} s · ` +
    `V ∈ [${r.Vmin.toFixed(1)}, ${r.Vmax.toFixed(1)}] · calib máx ${r.bandaMax.toFixed(1)} s · ` +
    `RMSE ${r.rmse.toFixed(2)} MW · ENS ${(r.ens * 100).toFixed(1)} %`;
  for (const n of [1, 2, 3]) {
    console.log(`Nivel ${n}`);
    console.log('  sin tocar nada      :', fmt(simularNivel(n, quieto(n))));
    console.log('  jugador razonable   :', fmt(simularNivel(n, jugadorRazonable(n))));
    console.log('  con 1 s de retardo  :', fmt(simularNivel(n, jugadorRazonable(n, { retardo_s: 1 }))));
    if (n === 3) {
      console.log('  corta CASAS         :', fmt(simularNivel(n, jugadorRazonable(n, { cortar: 'casas' }))));
      console.log('  nunca corta         :', fmt(simularNivel(n, jugadorRazonable(n, { cortar: 'ninguno' }))));
    }
  }
}
