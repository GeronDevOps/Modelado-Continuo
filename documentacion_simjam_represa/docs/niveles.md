# Niveles de "Aislados en la Patagonia: Balance Hídrico"

Los niveles usan el modelo de `docs/modelo.md` (sin cambios). Cada uno enseña una mecánica distinta y **ninguno se gana sin tocar los controles** (comprobado en `tests/niveles.test.js`).

| Nivel | Duración máx. | Estado inicial | Mecánica propia | Cómo se gana |
|---|---|---|---|---|
| 1 Turno Tranquilo | 120 s | V₀ = 25, u_t = 0,20 | Tutorial por etapas | 10 s continuos calibrados |
| 2 Tormenta Cordillerana | 150 s | V₀ = 30, u_t = 0,44 | Fases, pronóstico, vertedero parcial, tronco | Sin desborde y 10 s calibrados desde t = 90 s |
| 3 Hora Pico y Deshielo | 120 s | V₀ = 30, u_t = 0,44 | Barrios con deslastre, capacidad, avería | Turno completo, RMSE ≤ 8 MW, ENS ≤ 12 % |

> ⚠️ Los valores de este archivo deben coincidir con `src/config/constantes.js` (objetos `NIVEL1`, `NIVEL2`, `NIVEL3` y las funciones `caudalNivel2`, `caudalNivel3`, `demandaNivel3`, `demandaPorSector`) y con las reglas de `src/juego/mecanicasNivel.js`. Si cambias el código, cambia este archivo.
> `tests/regresion.test.js` compara esos objetos con `docs/niveles_linea_base_v2.json`. Si cambias los niveles **a propósito**, regenera la línea base con `node documentacion_simjam_represa/analisis/generar_linea_base_niveles.mjs` en el mismo commit. El arte y el sonido no deben cambiarla. Los parámetros del **modelo** se siguen comparando con `docs/niveles_linea_base.json` (versión antes del día 2), que no cambió.

**Regla de calibración** (`estadoCalibracion` y `calibracionHabilitada` en `mecanicasNivel.js`, usadas por `JuegoScene._actualizarMetricas`): el jugador está "calibrado" cuando, en el mismo instante, V ∈ [27, 33] hm³ **y** la potencia está dentro de la tolerancia del nivel. El contador `tiempoBanda` suma el tiempo continuo calibrado y vuelve a 0 al salir de la banda. En el N1 y el N2 el nivel se completa al llegar a **10 s continuos**. En el N2 el contador solo corre desde la fase de recuperación (t ≥ 90 s). El N3 no usa este contador para ganar.

**Por qué se rediseñaron:** antes los tres niveles empezaban en el equilibrio (V = 30, u_t = 0,44, P = 47,4 MW), y ese estado ya cumplía la calibración. Sin tocar nada, los tres se aprobaban a los 10,0 s, antes de la tormenta (t = 15 s) y del primer cambio de demanda (t = 20 s).

## Nivel 1 – Turno Tranquilo (tutorial, obligatorio)

| Ítem | Valor |
|---|---|
| Objetivo | Llevar la planta al punto de operación: llenar el embalse, entregar la potencia y sostenerla |
| Estado inicial | **V₀ = 25 hm³, u_t = 0,20** → P ≈ 19,6 MW (fuera de la banda y lejos de la demanda) |
| Q_río | 0,5 hm³/h constante |
| P_demanda | 47,4 MW constante |
| Vertedero | Deshabilitado |
| Etapas (`etapaNivel1`) | 1. Llevar V a 30 ± 3 · 2. Entregar 47,4 MW ± 5 % · 3. Sostener 10 s. La etapa sale del estado actual: si el jugador se sale de la banda, vuelve a la etapa que corresponde |
| Guía | Panel "TUTORIAL" con las 3 etapas marcadas (✓ / ▶ / ·), línea de pista y flecha parpadeante junto a la barra de u_t (▲ ABRE · ▼ CIERRA · ● MANTÉN) |
| **Criterio de aprobación** | **≥ 10 s continuos** con V en 30 ± 3 hm³ **y** \|P − 47,4\| / 47,4 ≤ 5 % |
| Fallas | El desborde y el descebe no terminan la partida (solo se muestran las alarmas) |
| Valor que se reporta | Calibración continua máxima (s); informativos: tiempo para completar, error medio de potencia y V final |
| Idea didáctica | El embalse integra: para subir V hay que sacar menos agua de la que entra (cerrar turbinas cuesta potencia) y corregir antes de llegar a la banda. |

Referencia (simulación sin interfaz, `analisis/simular_niveles.mjs`):

| Política | Resultado |
|---|---|
| No tocar nada (u_t = 0,20 fijo) | **Falla**: V sube hasta 30,9 hm³ en 120 s, pero P ≈ 22 MW nunca llega a la banda de ±5 % |
| Cerrar turbinas hasta V = 29,5 y luego seguir 47,4 MW | **Aprueba** a t = 62,8 s |

## Nivel 2 – Tormenta Cordillerana

| Ítem | Valor |
|---|---|
| Objetivo | Sobrevivir a la creciente sin desbordar ni cavitar y, cuando amaine, devolver la planta a 30 hm³ |
| Duración | **150 s** (30 s más que antes, para la recuperación) |
| Q_río | Base 0,5 hm³/h más un pulso sin² de amplitud 2,5 entre t = 15 s y t = 105 s: Q_río(t) = 0,5 + 2,5·sin²(π·(t − 15)/90). Pico de **3,0 hm³/h a t = 60 s** |
| P_demanda | 47,4 MW constante |
| Fases (`faseNivel2`) | **CALMA** 0–5 s · **ALERTA** 5–15 s (pronóstico: "baja el embalse ANTES") · **TORMENTA** 15–90 s · **RECUPERACIÓN** 90–150 s. Cada cambio se anuncia con un banner |
| Pronóstico | Panel "PARTE METEOROLÓGICO": Q_río ahora y Q_río dentro de 10 s, con flecha ▲/▼/= (las perturbaciones son deterministas, así que el pronóstico es exacto) |
| Vertedero | Habilitado y **parcial**. Teclado: [E] abre y [Q] cierra a 0,5 s⁻¹, y la posición se queda; [ESPACIO] mantenido = 100 % de emergencia. Cámara: puño izquierdo bajo = 50 %, puño alto = 100 %, mano abierta = cerrado |
| Evento sorpresa | **Tronco en el vertedero** entre t = 45 s y t = 53 s: u_v ≤ 0,25 (se dibuja el tronco y aparece el banner "¡TRONCO EN EL VERTEDERO!"). Obliga a haber bajado el embalse antes o a subir turbinas |
| **Criterio de aprobación** | **≥ 10 s continuos calibrados en la RECUPERACIÓN** (t ≥ 90 s): V en 30 ± 3 hm³ y error de potencia ≤ 15 %, sin desborde ni descebe |
| Fallas que terminan el nivel | V ≥ 50 hm³ (desborde) · V ≤ 5 hm³ (descebe) |
| Alarmas | "¡PELIGRO: REBOSAMIENTO!" si V > 45 · "¡ADVERTENCIA: CAVITACIÓN!" si V < 10 · aviso de tormenta si Q_río > 1,2 |
| Valor que se reporta | Calibración máxima en la recuperación y V máximo; informativos: error medio de P y V final |

Referencia calculada con el modelo (RK4, h = 1/120 s, misma función `caudalNivel2` del juego):

| Política | Resultado |
|---|---|
| u_t = 0,44 fijo, sin vertedero | **Falla**: cruza 45 a t ≈ 67,9 s y desborda (V = 50) a t ≈ 81,5 s |
| u_t para 47,4 MW y vertedero proporcional u_v = (V − 30)/4 (con el tronco) | **Aprueba** a t = 105,9 s; V máx = 36,8 hm³ |

**Observación de diseño:** antes, el N2 se aprobaba a los 10 s, antes de la tormenta. Al contar la calibración solo en la recuperación, el jugador tiene que pasar por la tormenta completa.

## Nivel 3 – Hora Pico y Deshielo

| Ítem | Valor |
|---|---|
| Objetivo | Seguir la demanda variable con caudal variable durante **todo el turno**, decidiendo a quién dejar sin luz cuando la planta no alcanza |
| Modo | **Supervivencia**: no termina antes; se evalúa a los 120 s |
| Q_río | Q_río(t) = 1,5 − cos(2π·t/40): oscila entre 0,5 y 2,5 hm³/h con periodo de 40 s |
| Demanda total | Escalones de 20 s (45, 70, 100, 120, 75, 30 MW) con rampa lineal de 4 s entre ellos |
| Barrios (`demandaPorSector`) | **Hospital** 15 MW fijo (no se corta) · **Industria** 45 % del resto (peso 1,0, tecla [1]) · **Casas** 55 % del resto (peso 1,5, tecla [2]) |
| Deslastre | [1] y [2] cortan y reconectan la industria o las casas (también en modo cámara). El barrio cortado se apaga en la ciudad y sale de la demanda activa: D_activa = suma de los barrios con luz |
| Avería | Entre **t = 62 s y t = 77 s** la turbina 3 sale de servicio: **u_t ≤ 0,66**. Aviso 3 s antes; se dibuja el rodete detenido en rojo |
| Capacidad disponible | P_max = 2,45·(20 + 0,8·V)·u_t,max(t). El panel "DESPACHO DE CARGA" muestra la capacidad, el V necesario para la demanda total (`volumenNecesario`) y la ENS acumulada |
| Vertedero | Habilitado (mismo control parcial que en el N2) |
| **Criterio de aprobación** | Turno completo **sin desborde ni descebe**, **RMSE(P − D_activa) ≤ 8 MW** y **ENS ponderada ≤ 12 %** |
| ENS ponderada | ∫ Σ peso·P_cortada dt / ∫ D_total dt (energía demandada en el turno ≈ 8830 MW·s) |

**Cambio respecto a la versión anterior:** antes la referencia era P_ref = min(P_demanda, P_max(V) + 5 MW) (`demandaEfectiva`), es decir, el juego perdonaba automáticamente la demanda imposible. Ahora esa decisión la toma el jugador con el deslastre, y cortar tiene un costo (ENS). `demandaEfectiva` sigue en `SistemaContinuo.js` como utilidad, pero el N3 ya no la usa.

Factibilidad:

- P_max(V) con u_t = 1 en V = 30 es 107,8 MW; la demanda de 120 MW solo es alcanzable con V ≥ 36,2 hm³ (hay que acumular agua antes: el agua es un recurso).
- Con la avería (u_t ≤ 0,66) la capacidad es 71,1 MW en V = 30 y 97,0 MW con el embalse lleno: **la demanda de 110–120 MW es imposible** y hay que deslastrar.
- Los picos de demanda (t = 60–80 s) coinciden con un máximo de Q_río (t = 60 s), para que el jugador pueda acumular volumen antes.

Referencia (simulación sin interfaz, `analisis/simular_niveles.mjs`):

| Política | Resultado |
|---|---|
| No tocar nada (u_t = 0,44 fijo) | **Falla**: desborda a t ≈ 101 s (RMSE 34 MW) |
| Seguir D_activa, cortar la **industria** cuando D > capacidad, vertedero si V > 38 | **Aprueba**: RMSE 3,5 MW, ENS 8,0 %, V ∈ [30, 41] |
| Igual, con 1 s de retardo humano | **Aprueba**: RMSE 5,5 MW, ENS 8,0 % |
| Igual, pero cortando las **casas** | **Falla** por ENS: 14,6 % > 12 % |
| Igual, pero sin cortar nunca | **Falla** por RMSE: 12,7 MW > 8 MW |

Rampa real de `constantes.js` (`demandaNivel3` y `caudalNivel3`):

| Tramo (s) | P_demanda (MW) | Q_río (hm³/h) | Nota |
|---|---|---|---|
| 0 – 20 | 45 | 0,5 → 2,5 (pico en t = 20) | |
| 20 – 24 | rampa 45 → 70 | 2,5 → 2,3 | |
| 24 – 40 | 70 | 2,3 → 0,5 (mínimo en t = 40) | |
| 40 – 44 | rampa 70 → 100 | 0,5 → 0,7 | |
| 44 – 60 | 100 | 0,7 → 2,5 (pico en t = 60) | aviso de avería desde t = 59 |
| 60 – 64 | rampa 100 → 120 | 2,5 → 2,3 | avería desde t = 62 |
| 64 – 80 | 120 | 2,3 → 0,5 (mínimo en t = 80) | avería hasta t = 77 |
| 80 – 84 | rampa 120 → 75 | 0,5 → 0,7 | |
| 84 – 100 | 75 | 0,7 → 2,5 (pico en t = 100) | |
| 100 – 104 | rampa 75 → 30 | 2,5 → 2,3 | |
| 104 – 120 | 30 | 2,3 → 0,5 | |

## Programación de perturbaciones y avisos

Todas las perturbaciones son **deterministas** (no hay sorteo con semilla), así que los avisos se pueden programar con anticipación. La duración mínima de aviso es `AVISO = max(400 ms, 2 × retardo del lazo del jugador)`. Retardo estimado: filtro EMA con α = 0,35 a 30 Hz → τ = −(1/30)/ln(0,65) ≈ 77 ms, más la detección de MediaPipe (**[sim]** 42 ms medidos en la vista debug a 24 FPS de detección); el retardo total queda en ≈ 119 ms, 2 × 119 = 238 ms < 400 ms, así que el aviso mínimo es **400 ms**. Los avisos del rediseño son más largos que ese mínimo.

| Nivel | Perturbación / evento | Inicio | Duración | Magnitud | Aviso en el juego |
|---|---|---|---|---|---|
| 1 | — (arranque fuera del equilibrio) | t = 0 | — | V₀ = 25, u_t = 0,20 | Banner "TUTORIAL · paso 1" y etapas |
| 2 | Tormenta (creciente del río) | t = 15 s | 90 s (hasta t = 105 s) | Q_río 0,5 → 3,0 hm³/h (pico a t = 60 s) | Fase ALERTA desde t = 5 s (10 s antes) y pronóstico a +10 s |
| 2 | Tronco en el vertedero | t = 45 s | 8 s | u_v ≤ 0,25 | **Sin aviso previo** (evento sorpresa); banner al iniciar y al terminar |
| 2 | Recuperación (inicio de la calibración) | t = 90 s | hasta t = 150 s | — | Banner de fase; el contador pasa de "BLOQUEADA" a activo |
| 3 | Deshielo (oscilación de Q_río) | t = 0 s, periódica | continua, periodo 40 s | 0,5 – 2,5 hm³/h | Aviso de tormenta si Q_río > 1,2 (alarmas) |
| 3 | Cambio de demanda | t = 20, 40, 60, 80, 100 s | rampa de 4 s | +25, +30, +20, −45, −45 MW | Curva de demanda en la tendencia y panel de barrios |
| 3 | Avería de la turbina 3 | t = 62 s | 15 s (hasta t = 77 s) | u_t ≤ 0,66 | Banner 3 s antes (t = 59 s), al iniciar y al terminar |

## Correspondencia con el Anexo C de la guía y justificación de los cambios

| Guía (C.3) | Implementado | Justificación |
|---|---|---|
| N1 Día tranquilo: generar 60 MW; energía no suministrada < 5 %; V entre 20 y 45 al final | N1 Turno Tranquilo: arranca en V = 25 con P ≈ 20 MW; hay que llegar a 47,4 MW con V 30 ± 3 y sostenerlo 10 s | 47,4 MW es el equilibrio de la planta, así que enseña el concepto de punto de operación y lazo cerrado. Arrancar fuera del equilibrio obliga a usar el control (antes el nivel se ganaba solo). Con 60 MW el control ideal termina en V ≈ 26,9 hm³ (también cumple el criterio de la guía). Se usa 10 s porque 30 s continuos con la mano resultaban demasiado largos en las pruebas. |
| N2 Demanda diaria D(t) = 70 + 30·sin(2π(t − 6 h)/24) | N2 Tormenta: demanda constante, creciente sin² con pico de 3,0 hm³/h, fases, pronóstico y tronco | Se prioriza la perturbación (guía: "cada nivel agrega una perturbación"). La calibración solo cuenta en la recuperación para que la tormenta sea obligatoria. La demanda sinusoidal queda como extra posible. |
| N3 Demanda de N2 con creciente 0,5 → 2,5 entre las 8 h y las 14 h | N3 Hora Pico y Deshielo: demanda en rampa 30–120 MW por barrios, Q_río oscilante, avería y deslastre | Combina ambas perturbaciones. La "energía no suministrada" de la guía aparece como ENS ponderada del deslastre (≤ 12 %). Criterio: turno completo sin desborde y RMSE ≤ 8 MW (≈ 7 % de 120 MW, comparable al 10 % de la guía). |
