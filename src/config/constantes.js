/**
 * constantes.js
 * Todas las constantes del modelo matemático y del juego.
 * Fuente: Documento de Diseño "Aislados en la Patagonia: Balance Hídrico"
 */

// ─── ESPACIO DE ESTADOS (variables físicas, unidades: hm³/h) ─────────────────
export const MODELO = {
  A: -0.002,          // h⁻¹  — Tasa de pérdida por filtración/evaporación
  B: [-1.0, -2.0],    // [Kt, Kv] — Ganancia de turbinas y vertedero (hm³/h por unidad)
  E: 1.0,             // Ganancia de perturbación (caudal río)
  C: 1.0,             // Salida = volumen V
  D: [0.0, 0.0],      // Sin término directo
};

// ─── RELACIONES ALGEBRAICAS ───────────────────────────────────────────────────
export const HIDRO = {
  H_base: 20.0,       // m — Cabeza hidráulica mínima (V=0)
  H_slope: 0.8,       // m/hm³ — Pendiente H(V) = 20 + 0.8·V
  eta: 2.45,          // MW·h/(hm³·m) — Factor eficiencia hidro-electromecánica
  Kt: 1.0,            // hm³/(h·unidad) — Caudal turbinado por unidad de apertura
  Kv: 2.0,            // hm³/(h·unidad) — Caudal vertedero por unidad de apertura
};

// ─── ESCALA TEMPORAL ──────────────────────────────────────────────────────────
export const TIEMPO = {
  horas_por_segundo_juego: 0.2,   // 1 s juego = 0.2 h reales (i.e., 5 s = 1 h real)
  factor_aceleracion: 720,        // k_tiempo = 3600/5
  // τ_juego = (1/0.002 h) × 5 s/h = 500 × 5 = 2500 s de juego
  tau_juego_s: 2500,
};

// ─── PUNTO DE OPERACIÓN (Nivel 1 / Equilibrio) ───────────────────────────────
export const EQUILIBRIO = {
  V0: 30.0,           // hm³
  Qrio0: 0.5,         // hm³/h
  uv0: 0.0,           // Vertedero cerrado
  // ut0 tal que dV/dt = 0: Qrio - Kt·ut - Kv·uv - k·V = 0
  // 0.5 - 1·ut - 0 - 0.002·30 = 0  →  ut = 0.5 - 0.06 = 0.44
  ut0: 0.44,
};

// ─── LÍMITES DEL EMBALSE ──────────────────────────────────────────────────────
export const LIMITES = {
  V_min: 5.0,         // hm³ — Por debajo: cavitación / descebe
  V_max: 50.0,        // hm³ — Por encima: desbordamiento catastrófico
  V_alarma_alta: 45.0,// hm³ — Alarma de pre-rebosamiento
  V_alarma_baja: 10.0,// hm³ — Advertencia de cavitación
  V_objetivo: 30.0,   // hm³ — Nivel nominal de operación
  V_banda: 3.0,       // hm³ — Banda de éxito ±3 hm³ = [27, 33]
  ut_min: 0.0,
  ut_max: 1.0,
  uv_min: 0.0,
  uv_max: 1.0,
};

// ─── INTEGRADOR ───────────────────────────────────────────────────────────────
export const INTEGRADOR = {
  h: 1 / 120,         // s — Paso fijo (120 Hz, sincronizado con Phaser)
};

// ─── ACTUADORES ───────────────────────────────────────────────────────────────
export const ACTUADORES = {
  ut_velocidad_max: 0.20,  // unidad/s — Tarda 5 s en ir de 0% a 100%
  uv_velocidad_max: 0.50,  // unidad/s — El vertedero (compuerta de fondo) abre en 2 s
};

// ─── ENTRADA POR CÁMARA (Fase 2) ──────────────────────────────────────────────
export const CAMARA = {
  landmark_muneca: 0,        // Estrictamente la muñeca (landmark 0), nunca el centro de la palma
  // MediaPipe asume imagen espejada. Se procesa el frame crudo (sin espejar), por lo que
  // la etiqueta queda invertida: la mano DERECHA del usuario llega como 'Left'.
  etiqueta_mano_derecha: 'Left',
  etiqueta_mano_izquierda: 'Right',
  suavizado: 0.35,           // Factor EMA de la altura de la muñeca
  rango_minimo: 0.15,        // Rango mínimo de altura calibrada (fracción del frame)
  umbral_puño: 1.0,          // Punta del dedo más cerca de la muñeca que la articulación PIP
  wasm_url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  modelo_url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};

// ─── NIVEL 1: TURNO TRANQUILO (tutorial) ──────────────────────────────────────
// Arranca FUERA del equilibrio (V0 = 25 hm³, u_t = 0,20 → P ≈ 19,6 MW): el jugador
// tiene que llenar el embalse cerrando turbinas y luego abrirlas hasta 47,4 MW.
// Sin tocar nada nunca se calibra (V sube hacia 50 con P ≈ 22 MW).
export const NIVEL1 = {
  id: 1,
  nombre: 'TURNO TRANQUILO',
  modo: 'calibracion',       // gana con 10 s continuos calibrados
  duracion_s: 120,
  V0: 25.0,                  // hm³ — por debajo de la banda [27, 33]
  ut0: 0.20,                 // apertura inicial de turbinas
  Qrio: 0.5,                 // hm³/h constante
  P_demanda: 47.4,           // MW constante
  uv_habilitado: false,
  inicio_calibracion_s: 0,
  tiempo_banda_minimo: 10,   // 10 s continuos calibrados para completar el nivel
  error_P_max: 0.05,         // ±5% error de potencia permitido
  instruccion: 'TUTORIAL: llena el embalse hasta 30 ± 3 hm³, entrega 47.4 MW (±5%) y sostenlo 10 s.',
};

// ─── NIVEL 2: TORMENTA CORDILLERANA ───────────────────────────────────────────
// Caudal del río: base 0.5 hm³/h + pulso sin² de amplitud 2.5 entre t=15 s y t=105 s.
// Fases: CALMA (0–5) → ALERTA (5–15, pronóstico) → TORMENTA (15–90) → RECUPERACIÓN (90–150).
// La calibración SOLO cuenta en la recuperación: hay que sobrevivir y devolver la planta a 30 hm³.
// Evento sorpresa: un tronco bloquea el vertedero (u_v ≤ 0,25) entre t=45 s y t=53 s.
export const NIVEL2 = {
  id: 2,
  nombre: 'TORMENTA CORDILLERANA',
  modo: 'calibracion',
  duracion_s: 150,           // 120 s de tormenta + 30 s extra de recuperación
  V0: 30.0,
  ut0: 0.44,
  Qrio: 0.5,
  tormenta_inicio_s: 15,
  tormenta_fin_s: 105,
  tormenta_amplitud: 2.5,
  alerta_inicio_s: 5,        // pronóstico: aviso 10 s antes de la tormenta
  inicio_calibracion_s: 90,  // inicio de la fase de RECUPERACIÓN
  pronostico_s: 10,          // horizonte del pronóstico de Q_río
  tronco_inicio_s: 45,
  tronco_fin_s: 53,
  tronco_uv_max: 0.25,       // apertura máxima del vertedero con el tronco atascado
  P_demanda: 47.4,
  uv_habilitado: true,
  tiempo_banda_minimo: 10,   // 10 s continuos calibrados (en la recuperación) para completar
  error_P_max: 0.15,         // 15% error de potencia permitido
  V_final_tolerancia: 5.0,   // |V_final − 30| ≤ 5 hm³ (informativo)
  instruccion: 'OBJETIVO: sobrevive a la tormenta (V < 50) y desde t = 90 s calibra 10 s: V 30 ± 3, P ±15%.',
};

/**
 * Caudal del río en el Nivel 2 [hm³/h] en función del tiempo de juego.
 * @param {number} t - Tiempo de juego [s]
 * @returns {number}
 */
export function caudalNivel2(t) {
  const { Qrio, tormenta_inicio_s: t0, tormenta_fin_s: t1, tormenta_amplitud: A } = NIVEL2;
  if (t <= t0 || t >= t1) return Qrio;
  const s = Math.sin(Math.PI * (t - t0) / (t1 - t0));
  return Qrio + A * s * s;
}

// ─── NIVEL 3: HORA PICO Y DESHIELO PATAGÓNICO ─────────────────────────────────
// Caudal oscilante entre 0.5 y 2.5 hm³/h (periodo 40 s) y demanda en rampa
// escalonada entre 30 y 120 MW, repartida en tres barrios. Se juega el turno completo
// (supervivencia): no termina antes. Si la planta no alcanza, el jugador DESLASTRA un
// barrio (deja sin luz a la industria o a las casas); el hospital nunca se corta.
//   D_activa(t) = suma de los barrios con luz;  RMSE = rms(P − D_activa)
//   ENS ponderada = ∫ Σ peso·P_cortada dt / ∫ D_total dt
// Avería: entre t=62 s y t=77 s una turbina sale de servicio (u_t ≤ 0,66).
export const NIVEL3 = {
  id: 3,
  nombre: 'HORA PICO Y DESHIELO',
  modo: 'supervivencia',     // se juega el turno completo y se evalúa al final
  duracion_s: 120,
  V0: 30.0,
  ut0: 0.44,
  Qrio: 0.5,                 // valor inicial (la función caudalNivel3 lo hace oscilar)
  periodo_Q_s: 40,
  demanda_escalones_MW: [45, 70, 100, 120, 75, 30],
  escalon_s: 20,             // cada escalón dura 20 s
  rampa_s: 4,                // transición lineal entre escalones
  P_demanda: 45,             // demanda inicial
  uv_habilitado: true,
  sectores: [
    { id: 'hospital',  nombre: 'HOSPITAL',  fijo_MW: 15, cortable: false, peso: 0 },
    { id: 'industria', nombre: 'INDUSTRIA', fraccion: 0.45, cortable: true, tecla: 'ONE', etiquetaTecla: '1', peso: 1.0 },
    { id: 'casas',     nombre: 'CASAS',     fraccion: 0.55, cortable: true, tecla: 'TWO', etiquetaTecla: '2', peso: 1.5 },
  ],
  averia_inicio_s: 62,
  averia_fin_s: 77,
  averia_ut_max: 0.66,       // 2 de 3 turbinas disponibles
  aviso_averia_s: 3,         // aviso previo de la avería
  rmse_max_MW: 8.0,
  ens_max: 0.12,             // energía no suministrada ponderada ≤ 12 % de la demandada
  instruccion: 'OBJETIVO: aguanta el turno con RMSE ≤ 8 MW sin desbordar. Sin capacidad: corta un barrio [1]/[2].',
};

/** Caudal oscilante del Nivel 3 [hm³/h]: 0.5 en t=0, pico 2.5 a mitad de periodo. */
export function caudalNivel3(t) {
  return 1.5 - Math.cos(2 * Math.PI * t / NIVEL3.periodo_Q_s);
}

/** Demanda eléctrica total del Nivel 3 [MW]: escalones con rampa lineal. */
export function demandaNivel3(t) {
  const { demanda_escalones_MW: E, escalon_s, rampa_s } = NIVEL3;
  const k = Math.min(E.length - 1, Math.max(0, Math.floor(t / escalon_s)));
  if (k === 0) return E[0];
  const dentro = t - k * escalon_s;
  if (dentro >= rampa_s) return E[k];
  return E[k - 1] + (E[k] - E[k - 1]) * (dentro / rampa_s);
}

/**
 * Reparte la demanda total del Nivel 3 entre los barrios [MW].
 * El hospital es fijo; el resto se divide según `fraccion`.
 * @param {number} D - Demanda total [MW]
 * @returns {Object<string, number>} p. ej. { hospital: 15, industria: 13.5, casas: 16.5 }
 */
export function demandaPorSector(D) {
  const fijo = NIVEL3.sectores.reduce((a, s) => a + (s.fijo_MW ?? 0), 0);
  const resto = Math.max(0, D - fijo);
  const out = {};
  for (const s of NIVEL3.sectores) out[s.id] = s.fijo_MW ?? resto * s.fraccion;
  return out;
}

/** Caudal del río según el nivel. */
export function caudalPorNivel(nivel, t) {
  if (nivel === 2) return caudalNivel2(t);
  if (nivel === 3) return caudalNivel3(t);
  return NIVEL1.Qrio;
}

/** Demanda eléctrica total según el nivel [MW] (sin descontar barrios cortados). */
export function demandaPorNivel(nivel, t) {
  if (nivel === 3) return demandaNivel3(t);
  return nivel === 2 ? NIVEL2.P_demanda : NIVEL1.P_demanda;
}

// ─── PALETA DE COLORES (HMI sala de control 90s) ──────────────────────────────
export const COLORES = {
  fondo: 0x111111,
  fondo_panel: 0x1a1a1a,
  linea_P: 0x52b788,         // Verde fósforo — Potencia generada
  linea_Pdem: 0xf4d35e,      // Amarillo — Demanda
  linea_V: 0x1c5270,         // Azul profundo — Nivel embalse
  linea_V_bright: 0x4fc3f7,  // Azul claro para visibilidad
  alarma_alta: 0xe63946,     // Rojo intenso
  alarma_baja: 0xf4a261,     // Naranja neón
  texto_hmi: 0x52b788,       // Verde fósforo
  texto_label: 0x888888,
  borde_panel: 0x333333,
  agua_reposo: 0x1c5270,
  agua_tormenta: 0x00a896,
  estructura: 0x3d5a80,
  estructura_oscura: 0x293241,
  blanco: 0xffffff,
  gris_claro: 0xcccccc,
};
