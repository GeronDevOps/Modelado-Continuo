/**
 * mecanicasNivel.js
 * Reglas propias de cada nivel, separadas de Phaser para poder probarlas con Vitest.
 *
 *   Nivel 1 – Turno Tranquilo: tutorial por etapas (llenar → potencia → sostener).
 *   Nivel 2 – Tormenta: fases (calma, alerta, tormenta, recuperación), pronóstico
 *             de Q_río y un tronco que bloquea el vertedero.
 *   Nivel 3 – Hora Pico: demanda por barrios con deslastre de carga, capacidad
 *             disponible y avería de una turbina.
 *
 * Nada de esto escribe en src/modelo/: solo calcula consignas, límites de los
 * actuadores y referencias que JuegoScene aplica antes de integrar el modelo.
 */

import {
  NIVEL1, NIVEL2, NIVEL3, LIMITES, HIDRO,
  caudalPorNivel, demandaPorNivel, demandaPorSector,
} from '../config/constantes.js';
import { calcularH } from '../modelo/SistemaContinuo.js';

/** Configuración del nivel por id. */
export function configNivel(id) {
  return id === 3 ? NIVEL3 : (id === 2 ? NIVEL2 : NIVEL1);
}

// ─── NIVEL 1: ETAPAS DEL TUTORIAL ─────────────────────────────────────────────

/**
 * Etapa del tutorial según el estado actual (no se "traba": si el jugador se sale
 * de la banda vuelve a la etapa que corresponde).
 *   1 NIVEL      → llevar V a [27, 33]
 *   2 POTENCIA   → |P − 47,4| / 47,4 ≤ 5 %
 *   3 SOSTENER   → mantener ambas 10 s
 *
 * @param {number} V    - Volumen [hm³]
 * @param {number} P    - Potencia generada [MW]
 * @param {number} Pref - Demanda [MW]
 * @returns {{indice:number, titulo:string, pista:string, direccion:'sube'|'baja'|'mantener'}}
 */
export function etapaNivel1(V, P, Pref) {
  const vBajo = LIMITES.V_objetivo - LIMITES.V_banda;
  const vAlto = LIMITES.V_objetivo + LIMITES.V_banda;
  if (V < vBajo) {
    return {
      indice: 1, titulo: 'LLENAR EL EMBALSE',
      pista: `V = ${V.toFixed(1)} < ${vBajo}: CIERRA turbinas para que entre más agua de la que sale`,
      direccion: 'baja',
    };
  }
  if (V > vAlto) {
    return {
      indice: 1, titulo: 'BAJAR EL EMBALSE',
      pista: `V = ${V.toFixed(1)} > ${vAlto}: ABRE turbinas para sacar más agua`,
      direccion: 'sube',
    };
  }
  if (Math.abs(P - Pref) / Pref > NIVEL1.error_P_max) {
    return {
      indice: 2, titulo: 'AJUSTAR LA POTENCIA',
      pista: P < Pref
        ? `P = ${P.toFixed(1)} < ${Pref.toFixed(1)} MW: ABRE turbinas poco a poco`
        : `P = ${P.toFixed(1)} > ${Pref.toFixed(1)} MW: CIERRA turbinas poco a poco`,
      direccion: P < Pref ? 'sube' : 'baja',
    };
  }
  return {
    indice: 3, titulo: 'SOSTENER',
    pista: 'Todo en rango: mantén la mano quieta (el embalse integra cualquier desvío)',
    direccion: 'mantener',
  };
}

// ─── NIVEL 2: FASES, PRONÓSTICO Y TRONCO ──────────────────────────────────────

/**
 * Fase de la tormenta en el instante t.
 * @param {number} t - Tiempo de juego [s]
 * @returns {{id:'calma'|'alerta'|'tormenta'|'recuperacion', nombre:string, mensaje:string, color:string}}
 */
export function faseNivel2(t) {
  if (t < NIVEL2.alerta_inicio_s) {
    return { id: 'calma', nombre: 'CALMA', color: '#52b788',
      mensaje: 'Río tranquilo. Observa el pronóstico.' };
  }
  if (t < NIVEL2.tormenta_inicio_s) {
    return { id: 'alerta', nombre: 'ALERTA', color: '#f4d35e',
      mensaje: 'Tormenta en camino: baja el embalse ANTES de que llegue' };
  }
  if (t < NIVEL2.inicio_calibracion_s) {
    return { id: 'tormenta', nombre: 'TORMENTA', color: '#4fc3f7',
      mensaje: 'Creciente del río: usa el vertedero [E/Q · ESPACIO] para no desbordar' };
  }
  return { id: 'recuperacion', nombre: 'RECUPERACIÓN', color: '#52b788',
    mensaje: 'La tormenta amaina: vuelve a 30 ± 3 hm³ y calibra 10 s' };
}

/**
 * Pronóstico del caudal del río: valor dentro de `horizonte` segundos (las
 * perturbaciones son deterministas, así que el pronóstico es exacto).
 */
export function pronosticoCaudal(nivel, t, horizonte = NIVEL2.pronostico_s) {
  return caudalPorNivel(nivel, t + horizonte);
}

/** ¿El tronco bloquea el vertedero en el instante t? (solo Nivel 2) */
export function troncoActivo(nivel, t) {
  return nivel === 2 && t >= NIVEL2.tronco_inicio_s && t < NIVEL2.tronco_fin_s;
}

/** Apertura máxima física del vertedero en el instante t. */
export function uvMaximo(nivel, t) {
  const cfg = configNivel(nivel);
  if (!cfg.uv_habilitado) return 0;
  return troncoActivo(nivel, t) ? NIVEL2.tronco_uv_max : LIMITES.uv_max;
}

// ─── NIVEL 3: AVERÍA, CAPACIDAD Y BARRIOS ─────────────────────────────────────

/** ¿Hay una turbina fuera de servicio en el instante t? (solo Nivel 3) */
export function averiaActiva(nivel, t) {
  return nivel === 3 && t >= NIVEL3.averia_inicio_s && t < NIVEL3.averia_fin_s;
}

/** Segundos que faltan para la avería si está por llegar (aviso), o null. */
export function avisoAveria(nivel, t) {
  if (nivel !== 3) return null;
  const falta = NIVEL3.averia_inicio_s - t;
  return falta > 0 && falta <= NIVEL3.aviso_averia_s ? falta : null;
}

/** Apertura máxima física de las turbinas en el instante t. */
export function utMaximo(nivel, t) {
  return averiaActiva(nivel, t) ? NIVEL3.averia_ut_max : LIMITES.ut_max;
}

/**
 * Potencia máxima que la planta puede entregar ahora: 2,45·H(V)·u_t,max(t).
 * Es la "carga disponible" que se muestra en el Nivel 3.
 */
export function capacidadDisponible(nivel, t, V) {
  return HIDRO.eta * calcularH(V) * HIDRO.Kt * utMaximo(nivel, t);
}

/**
 * Volumen necesario para entregar la potencia D con las turbinas disponibles.
 * Despeja V de D = 2,45·(20 + 0,8·V)·u_t,max.  Puede ser > 50 (imposible).
 */
export function volumenNecesario(nivel, t, D) {
  const Hreq = D / (HIDRO.eta * HIDRO.Kt * utMaximo(nivel, t));
  return (Hreq - HIDRO.H_base) / HIDRO.H_slope;
}

/**
 * Demanda del instante t descontando los barrios cortados.
 *
 * @param {number} nivel
 * @param {number} t
 * @param {Set<string>} [cortados] - ids de barrios sin luz (solo Nivel 3)
 * @returns {{total:number, activa:number, sectores:Object<string,number>, cortadaPonderada:number, cortada:number}}
 */
export function demandaActiva(nivel, t, cortados = new Set()) {
  const total = demandaPorNivel(nivel, t);
  if (nivel !== 3) {
    return { total, activa: total, sectores: null, cortada: 0, cortadaPonderada: 0 };
  }
  const sectores = demandaPorSector(total);
  let activa = 0, cortada = 0, cortadaPonderada = 0;
  for (const s of NIVEL3.sectores) {
    const mw = sectores[s.id];
    if (s.cortable && cortados.has(s.id)) {
      cortada += mw;
      cortadaPonderada += s.peso * mw;
    } else {
      activa += mw;
    }
  }
  return { total, activa, sectores, cortada, cortadaPonderada };
}

// ─── CRITERIOS ────────────────────────────────────────────────────────────────

/** ¿Cuenta el tiempo calibrado en el instante t? (N2: solo en la recuperación) */
export function calibracionHabilitada(cfg, t) {
  return cfg.modo === 'calibracion' && t >= (cfg.inicio_calibracion_s ?? 0);
}

/**
 * ¿El instante está calibrado? N1/N2: V en 30 ± 3 y error relativo de P en tolerancia.
 * @returns {{enBandaV:boolean, enBandaP:boolean, calibrado:boolean}}
 */
export function estadoCalibracion(cfg, V, P, Pref) {
  const enBandaV = V >= (LIMITES.V_objetivo - LIMITES.V_banda) &&
                   V <= (LIMITES.V_objetivo + LIMITES.V_banda);
  const enBandaP = cfg.modo === 'supervivencia'
    ? Math.abs(P - Pref) <= cfg.rmse_max_MW
    : Math.abs(P - Pref) / Pref <= (cfg.error_P_max ?? 0.05);
  return { enBandaV, enBandaP, calibrado: enBandaV && enBandaP };
}

/**
 * Resultado final del nivel.
 *
 * @param {object} cfg - NIVEL1 | NIVEL2 | NIVEL3
 * @param {{completadoTemprano:boolean, desborde:boolean, descebe:boolean,
 *          tiempoJugado:number, rmse:number, ens:number}} m
 * @returns {{exito:boolean, motivo:string}}
 */
export function evaluarNivel(cfg, m) {
  if (m.desborde) return { exito: false, motivo: 'desborde' };
  if (m.descebe) return { exito: false, motivo: 'descebe' };
  if (cfg.modo === 'supervivencia') {
    if (m.tiempoJugado < cfg.duracion_s - 1e-6) return { exito: false, motivo: 'incompleto' };
    if (m.rmse > cfg.rmse_max_MW) return { exito: false, motivo: 'rmse' };
    if (m.ens > cfg.ens_max) return { exito: false, motivo: 'ens' };
    return { exito: true, motivo: 'turno_completo' };
  }
  return m.completadoTemprano
    ? { exito: true, motivo: 'calibrado' }
    : { exito: false, motivo: 'tiempo' };
}
