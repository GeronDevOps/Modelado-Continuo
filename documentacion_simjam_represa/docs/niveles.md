# Niveles de "Aislados en la Patagonia: Balance Hídrico"

Todos los niveles duran **como máximo 120 s de juego = 24 h simuladas**, con V₀ = 30 hm³ y el modelo de `docs/modelo.md`. El nivel termina antes si el jugador logra la **calibración continua**.

> ⚠️ Los valores de esta tabla deben coincidir con `src/config/constantes.js` (objetos `NIVEL1`, `NIVEL2`, `NIVEL3` y las funciones `caudalNivel2`, `caudalNivel3`, `demandaNivel3`). Si cambias el código, cambia este archivo.
> Desde el día 2, `tests/regresion.test.js` compara esos objetos con `docs/niveles_linea_base.json` (copia de la "Versión estable antes del día 2"): el arte y el sonido no pueden cambiar los niveles.

**Regla común de calibración** (`JuegoScene._actualizarMetricas`): el jugador está "calibrado" cuando, en el mismo instante, V ∈ [27, 33] hm³ **y** la potencia está dentro de la tolerancia del nivel. El contador `tiempoBanda` suma el tiempo continuo calibrado y se reinicia a 0 al salir de la banda. Al llegar a **10 s continuos** el nivel se completa; si pasan 120 s sin lograrlo, el nivel termina sin aprobar.

## Nivel 1 – Turno Tranquilo (obligatorio)

| Ítem | Valor |
|---|---|
| Objetivo | Mantener el embalse estable y generar la potencia demandada |
| Q_río | 0,5 hm³/h constante |
| P_demanda | 47,4 MW constante |
| Vertedero | Deshabilitado |
| Punto de equilibrio | u_t = 0,44 (dV/dt = 0, P = 47,43 MW) |
| **Criterio de aprobación** | **≥ 10 s continuos** con V en 30 ± 3 hm³ **y** \|P − 47,4\| / 47,4 ≤ 5 % (antes eran 30 s; se redujo a 10 s en el commit "Actualización del juego: correcciones y mejoras") |
| Fallas | En el Nivel 1 el desborde y el descebe no terminan la partida (solo se muestran las alarmas) |
| Valor del criterio que se reporta | Calibración continua máxima alcanzada (s) y error medio de potencia (%) |
| Idea didáctica | El embalse integra: hay que anticipar y corregir pequeñas desviaciones. |

Referencia: si el jugador arranca con u_t = 0,44, el sistema ya está en el punto de equilibrio y el nivel se completa a los 10 s. Con la mano el reto es **llegar** a u_t ≈ 0,44 (la compuerta sube a 0,20 s⁻¹) y sostenerla sin que el error de potencia supere el 5 % (P ∈ [45,0; 49,8] MW).

## Nivel 2 – Tormenta Cordillerana

| Ítem | Valor |
|---|---|
| Objetivo | Sobrevivir a la creciente sin desbordar ni cavitar y volver a calibrar |
| Q_río | Base 0,5 hm³/h más un pulso sin² de amplitud 2,5 entre t = 15 s y t = 105 s: Q_río(t) = 0,5 + 2,5·sin²(π·(t − 15)/90). Pico de **3,0 hm³/h a t = 60 s** |
| P_demanda | 47,4 MW constante |
| Vertedero | Habilitado (u_v ∈ [0, 1], velocidad máxima 0,5 s⁻¹, Q_v = 2·u_v hm³/h) |
| **Criterio de aprobación** | **≥ 10 s continuos** con V en 30 ± 3 hm³ **y** error de potencia ≤ 15 %, sin desborde (V ≥ 50) ni descebe (V ≤ 5) |
| Fallas que terminan el nivel | V ≥ 50 hm³ (desborde) · V ≤ 5 hm³ (descebe) |
| Alarmas | "¡PELIGRO: REBOSAMIENTO!" si V > 45 · "¡ADVERTENCIA: CAVITACIÓN!" si V < 10 · aviso de tormenta si Q_río > 1,2 |

Referencia calculada con el modelo (RK4, h = 1/120 s, 120 s, misma función `caudalNivel2` del juego):

| Política | V(120 s) | V máx | Resultado |
|---|---|---|---|
| u_t = 0,44 fijo, sin vertedero | 49,9 | 50,0 | **Falla**: cruza 45 a t ≈ 67,9 s y llega a 50 (desborde) |
| u_t = 0,44 con vertedero abierto si V > 40 (cierra en 36) | 36,0 | 41,0 | Sin desborde; luego hay que volver a 30 ± 3 |
| u_t = 1 fijo, sin vertedero | 38,8 | 41,7 | Sin desborde, pero P > 100 MW (error de potencia > 15 %: no calibra) |

**Observación de diseño:** con la tormenta sin² de amplitud 2,5 el vertedero sí es necesario para mantener a la vez el embalse lejos de 50 y la potencia dentro del 15 % de 47,4 MW (`tests/fase2.test.js` lo comprueba).

## Nivel 3 – Hora Pico y Deshielo

| Ítem | Valor |
|---|---|
| Objetivo | Seguir la demanda variable con caudal variable |
| Q_río | Q_río(t) = 1,5 − cos(2π·t/40): oscila entre 0,5 y 2,5 hm³/h con periodo de 40 s |
| P_demanda | Escalones de 20 s (45, 70, 100, 120, 75, 30 MW) con rampa lineal de 4 s entre ellos |
| Vertedero | Habilitado |
| **Criterio de aprobación** | **≥ 10 s continuos** con V en 30 ± 3 hm³ **y** \|P − P_ref\| ≤ 8 MW, sin desborde ni descebe |
| Métrica de la pantalla final | RMSE(P, P_ref) ≤ 8 MW |

**Ajuste de factibilidad (decisión documentada):**

- P_max(V) = 2,45·(20 + 0,8·V) con u_t = 1. En V = 30 es 107,8 MW; la demanda de 120 MW solo es alcanzable con V ≥ 36,2 hm³.
- Los picos altos de demanda (t = 60–80 s) coinciden con un máximo de Q_río (t = 60 s), para que el jugador pueda acumular volumen antes.
- Se usa `P_ref = min(P_demanda, P_max(V) + 5 MW)` (`demandaEfectiva` en `SistemaContinuo.js`), de modo que no se penalice al jugador por una demanda físicamente imposible. Esta regla se muestra en la pantalla final.

Rampa real de `constantes.js` (`demandaNivel3` y `caudalNivel3`):

| Tramo (s) | P_demanda (MW) | Q_río (hm³/h) |
|---|---|---|
| 0 – 20 | 45 | 0,5 → 2,5 (pico en t = 20) |
| 20 – 24 | rampa 45 → 70 | 2,5 → 2,3 |
| 24 – 40 | 70 | 2,3 → 0,5 (mínimo en t = 40) |
| 40 – 44 | rampa 70 → 100 | 0,5 → 0,7 |
| 44 – 60 | 100 | 0,7 → 2,5 (pico en t = 60) |
| 60 – 64 | rampa 100 → 120 | 2,5 → 2,3 |
| 64 – 80 | 120 | 2,3 → 0,5 (mínimo en t = 80) |
| 80 – 84 | rampa 120 → 75 | 0,5 → 0,7 |
| 84 – 100 | 75 | 0,7 → 2,5 (pico en t = 100) |
| 100 – 104 | rampa 75 → 30 | 2,5 → 2,3 |
| 104 – 120 | 30 | 2,3 → 0,5 |

## Programación de perturbaciones (para los avisos del día 2, etapa 4)

Todas las perturbaciones son **deterministas** (no hay sorteo con semilla), así que el aviso se puede programar con anticipación. La duración del aviso es `AVISO = max(400 ms, 2 × retardo del lazo del jugador)`. Retardo estimado: filtro EMA con α = 0,35 a 30 Hz → τ = −(1/30)/ln(0,65) ≈ 77 ms, más la detección de MediaPipe (✏️ medir en la vista debug; con ~33–50 ms, el retardo total queda en ≈ 110–130 ms y el aviso en **400 ms**). Si los jugadores reaccionan tarde, se alarga.

| Nivel | Perturbación | Instante de inicio | Duración | Magnitud | Aviso |
|---|---|---|---|---|---|
| 2 | Tormenta (creciente del río) | t = 15 s | 90 s (hasta t = 105 s) | Q_río 0,5 → 3,0 hm³/h (pico a t = 60 s) | desde t = 14,6 s |
| 3 | Deshielo (oscilación de Q_río) | t = 0 s, periódica | continua, periodo 40 s | 0,5 – 2,5 hm³/h | antes de cada pico (t = 20, 60, 100 s): desde 0,4 s antes de que Q_río supere 1,5 (t = 10, 50, 90 s) |
| 3 | Cambio de demanda | t = 20, 40, 60, 80, 100 s | rampa de 4 s | +25, +30, +20, −45, −45 MW | desde 0,4 s antes de cada escalón |

## Correspondencia con el Anexo C de la guía y justificación de los cambios

| Guía (C.3) | Implementado | Justificación |
|---|---|---|
| N1 Día tranquilo: generar 60 MW; energía no suministrada < 5 %; V entre 20 y 45 al final | N1 Turno Tranquilo: 47,4 MW; V 30 ± 3 y error ≤ 5 % durante 10 s continuos | 47,4 MW es el equilibrio de la planta, así que enseña el concepto de punto de operación y lazo cerrado. Con 60 MW el control ideal termina en V ≈ 26,9 hm³ (también cumple el criterio de la guía). Se bajó a 10 s porque 30 s continuos con la mano resultaban demasiado largos en las pruebas. |
| N2 Demanda diaria D(t) = 70 + 30·sin(2π(t − 6 h)/24) | N2 Tormenta: demanda constante, creciente sin² con pico de 3,0 hm³/h | Se prioriza la perturbación (guía: "cada nivel agrega una perturbación"). La demanda sinusoidal queda como extra posible. |
| N3 Demanda de N2 con creciente 0,5 → 2,5 entre las 8 h y las 14 h | N3 Hora Pico y Deshielo: demanda en rampa 30–120 MW y Q_río oscilante | Combina ambas perturbaciones. Se agrega el ajuste de factibilidad. Criterio: sin desborde y error acotado (8 MW ≈ 7 % de 120 MW, comparable al 10 % de la guía). |
