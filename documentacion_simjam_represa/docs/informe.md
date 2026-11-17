# Informe: Aislados en la Patagonia: Balance Hídrico (Simulador 3 – Represa)

> Convención: **[ref]** = calculado con el script independiente `analisis/verificacion_numerica.py` (ecuaciones del modelo, no salida del juego). ✏️ = dato que debes medir tú en el juego.

## 1. Verificación numérica (guía 5.9 a)

Paso h = 1/120 s. Criterio: error máximo de RK4 < 10⁻⁴.

| Sistema probado | Método | Paso h (s) | Error máximo | ¿Pasa? |
|---|---|---|---|---|
| 1.er orden (K = 2, τ = 0,5 s), T = 20 s [ref] | RK4 | 1/120 | 4,8·10⁻¹⁰ | Sí |
| 1.er orden (K = 2, τ = 0,5 s) [ref] | Euler | 1/120 | 6,2·10⁻³ | Informativo |
| 2.º orden (ζ = 0,3, ωn = 4 rad/s) [ref] | RK4 | 1/120 | 1,3·10⁻⁸ | Sí |
| 2.º orden (ζ = 0,3, ωn = 4 rad/s) [ref] | Euler | 1/120 | 2,2·10⁻² | Informativo |
| Modelo del juego (u_t = 0, u_v = 0, Q_río = 0,5), T = 120 s [ref] | RK4 | 1/120 | 4,4·10⁻¹³ hm³ | Sí |
| Modelo del juego (mismo caso) [ref] | Euler | 1/120 | 1,7·10⁻⁵ hm³ | Informativo |

Salida de `npm test` (Vitest, 2026-11-17): **4 archivos, 36/36 pruebas aprobadas** en ≈ 3,9 s. Las pruebas Vitest no incluyen los sistemas de prueba de 1.er y 2.º orden; esas filas las cubre el script de referencia.

| Archivo | Pruebas | Qué comprueba |
|---|---|---|
| `tests/modelo.test.js` | 14 ✔ | Equilibrio (dV/dt ≈ 0, estable 120 s); H(0) = 20, H(30) = 44, H(50) = 60 m; P₀ ≈ 47,432 MW; P_max ≈ 147 MW; escalones ±0,1 en u_t y u_v = 1; Euler vs RK4 < 0,05 hm³; τ = 500 h = 2500 s; exportación de `vensim_escalon.csv` |
| `tests/fase2.test.js` | 11 ✔ | Altura de muñeca → u_t con saturación y calibración; detección de puño; selección de mano derecha/izquierda; Nivel 2: sin vertedero supera el umbral de rebose y con vertedero termina cerca de 30 |
| `tests/fase3.test.js` | 7 ✔ | Perfiles del Nivel 3 (Q_río 0,5–2,5; demanda 30–120 MW); demanda efectiva acotada por P_max(V) + 5; factibilidad con seguimiento directo y con 2 s de retardo humano; deriva sin vertedero |
| `tests/regresion.test.js` (día 2) | 4 ✔ | Existe la línea base; el escalón a 60 FPS y a 15 FPS reproduce `docs/linea_base_escalon.csv` (valor final, tiempo de subida y Mp); parámetros del modelo y niveles iguales a `docs/niveles_linea_base.json` |

Pruebas del modelo de la represa [ref]:

| Prueba | Esperado | Obtenido |
|---|---|---|
| Equilibrio V₀ = 30, Q_río = 0,5, u_t = 0,44 | dV/dt ≈ 0; P ≈ 47,4 MW | dV/dt = 0; P = 47,432 MW |
| u_t = 0, u_v = 0, Q_río = 0,5 | V sube | 30 → 40,31 hm³ en 120 s |

### Comparación con Vensim y la analítica

Respuesta analítica: ΔV(t) = −500·(1 − e^(−0,002·t))·Δu_t (t en horas). A 20 h: ΔV = −19,61·Δu_t.

| Magnitud | Analítica | Vensim (`vensim_escalon.csv`) | Juego (`juego_escalon.csv`) | Diferencia (%) |
|---|---|---|---|---|
| Valor final a 20 h | −19,61·Δu_t | ✏️ | ✏️ | ✏️ (debe ser < 2 %) |

> Nota: `docs/vensim_escalon.csv` del repositorio lo genera `tests/modelo.test.js` con el modelo en JavaScript (u_t = 0,54 constante, 60 s); no es la exportación de Vensim. Para la columna "Vensim" hay que exportar la simulación de `vensim/represa.mdl` (ver `vensim/LEEME.md`).
| τ (h) | 500 | ✏️ | ✏️ | ✏️ |

## 2. Prueba de gestos (guía 5.9 b) ✏️

Repetir cada gesto 20 veces con el modo debug, con los dos integrantes y a 40 y 80 cm.

| Gesto | Intentos | Aciertos | No detectados | Falsos | % acierto | Umbral final |
|---|---|---|---|---|---|---|
| Altura de muñeca (u_t) | 20 | ✏️ | ✏️ | ✏️ | ✏️ | zona muerta ✏️ |
| Puño derecho (u_v) | 20 | ✏️ | ✏️ | ✏️ | ✏️ | histéresis 3 cuadros |
| Pellizco izquierdo (menú) | 20 | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ |
| Ambas manos fuera > 3 s (pausa) | 20 | ✏️ | ✏️ | ✏️ | ✏️ | 3 s |

Meta: ≥ 90 % de aciertos.

### Filtro EMA

τ equivalente = −Ts/ln(1 − α), con Ts = 1/30 s [ref]:

| α | τ equivalente (ms) | Ruido en reposo (pico a pico) | Retraso observado (ms) |
|---|---|---|---|
| 0,2 | 149,4 | ✏️ | ✏️ |
| 0,5 | 48,1 | ✏️ | ✏️ |
| 0,8 | 20,7 | ✏️ | ✏️ |

α elegido: ✏️ (justifica el equilibrio ruido/retardo).

## 3. Control alterno (guía 5.9 c)

| Acción | Gamepad | Teclado | ¿Funciona? ✏️ |
|---|---|---|---|
| Turbinas u_t | Stick derecho Y | ↑ / ↓ | ✏️ |
| Vertedero u_v | A | Espacio | ✏️ |
| Pausa / calibración | Start | P / C | ✏️ |
| Menú | Select | M | ✏️ |
| Debug | LB + RB | D | ✏️ |

Negar el permiso de cámara: ✏️ ¿el juego pasa a teclado sin bloquearse?

## 4. Playtest con otra pareja ✏️

| Observación | Cambio realizado | Sección a la que se regresó |
|---|---|---|
| ✏️ | ✏️ | ✏️ |

Preguntas: ¿qué sistema representa?, ¿qué parámetro cambia el comportamiento y cómo lo notó?, ¿qué fue lo más difícil de controlar?

## 5. Identificación y validación (guía 5.10)

### 5.1 Qué se identifica
Entrada neta Q_río − Q_t − Q_v → V. Modelo: dV/dt = b·(Q_río − Q_t − Q_v) − a·V (tiempo de juego). Esperado: **b = 0,2**, **a = 0,0004 s⁻¹** (en horas: ganancia 1 y k_perd = 0,002 h⁻¹), y las algebraicas H = 20 + 0,8·V y P = 2,45·H·Q_t.

### 5.2 Procedimiento
1. Jugar el ensayo de identificación (reposo 3 s, apertura máxima 5 s, reposo 5 s, repetir a media apertura) y guardar `partida_represa.csv` como `docs/ident_1.csv`.
2. Jugar una partida normal de ≥ 60 s y guardarla como `docs/valid_1.csv`.
3. Ejecutar: `python analisis/identificar_represa.py docs/ident_1.csv docs/valid_1.csv`.

Nota: la guía propone un 1.er orden con python-control. Aquí se usa un ajuste lineal por mínimos cuadrados en forma integral (numpy/scipy), porque el modelo es un integrador con pérdida y no una función de transferencia con ganancia estática útil dentro de 120 s.

### 5.3 Validación del script con datos sintéticos (no son datos de partida)
Datos generados con el modelo + ruido gaussiano de σ = 0,02 hm³ (`analisis/sinteticos/`):

| Parámetro | Esperado | Identificado | Error relativo |
|---|---|---|---|
| b | 0,2 | 0,19973 | 0,14 % |
| a (s⁻¹) | 0,0004 | 0,000399 | 0,27 % |
| H = h₀ + m·V | 20 + 0,8·V | 20,01 + 0,7997·V | < 0,1 % |
| P = c·H·Q_t | 2,45 | 2,4500 | ≈ 0 % |
| τ | 2500 s (500 h) | 2507 s (501 h) | 0,3 % |

R² en identificación = 0,9997 y en validación = 1,0000 (criterio R² ≥ 0,90).

### 5.4 Resultados con tus datos ✏️

| Parámetro | Esperado | Identificado | Error relativo |
|---|---|---|---|
| b | 0,2 | ✏️ | ✏️ |
| a (s⁻¹) | 0,0004 | ✏️ | ✏️ |
| R² validación | ≥ 0,90 | ✏️ | — |

Adjunta `analisis/identificacion.png` y `analisis/validacion.png`.

## 6. Sensibilidad (guía 5.10 d)

Escenario [ref]: u_t de 0 a 1 a t = 2 s (con rampa de 0,2 s⁻¹), Q_río = 0,5, V₀ = 30, 120 s. S = (ΔM/M)/(Δp/p), con M = ΔV = V(120) − 30.

| Parámetro | Variación | V(120) | ΔV | Mp (%) | ts (2 %) | S |
|---|---|---|---|---|---|---|
| Nominal | 0 % | 17,74 | −12,26 | 0 | no se alcanza (4τ = 10 000 s) | — |
| k_perd | −20 % | 17,96 | −12,04 | 0 | no se alcanza | +0,09 |
| k_perd | +20 % | 17,51 | −12,49 | 0 | no se alcanza | +0,09 |
| K_t | −20 % | 22,25 | −7,75 | 0 | no se alcanza | +1,84 |
| K_t | +20 % | 13,22 | −16,78 | 0 | no se alcanza | +1,84 |
| Q_río | −20 % | 15,39 | −14,61 | 0 | no se alcanza | −0,96 |
| Q_río | +20 % | 20,08 | −9,92 | 0 | no se alcanza | −0,96 |

Esta tabla es la referencia analítica. Si tu juego no tiene panel de parámetros, repite la medición cambiando las constantes en `SistemaContinuo.js` o con el script.

## 7. Preguntas de análisis

1. **¿Coinciden los parámetros identificados con los del modelo?** Con datos sintéticos, el error es < 0,3 % (sección 5.3). ✏️ Compara con tus datos reales; deberían coincidir porque el juego es una simulación determinista.
2. **¿Cuánto aumenta τ o el retardo con u_crudo?** Para la represa, la señal cruda del gesto pasa por EMA (τ = −Ts/ln(1 − α)), por la detección de la cámara y por el límite de velocidad del actuador (0,2 s⁻¹, hasta 5 s de rampa). ✏️ Identifica con u_crudo y reporta el aumento. Lo esperable es que la mayor parte se deba al actuador, no al filtro.
3. **¿El modelo identificado es estable?** Sí: su único polo es −a ≈ −0,0004 s⁻¹ (−0,002 h⁻¹), con Re(s) < 0. Al ser de primer orden no hace falta Routh-Hurwitz.
4. **¿Qué parámetro es más sensible?** K_t (S ≈ 1,84 sobre ΔV), seguido de Q_río (≈ −0,96). k_perd es casi irrelevante en 24 h simuladas (S ≈ 0,09). En la jugabilidad: la apertura de compuerta domina la dinámica; las pérdidas por filtración no se notan.
5. **¿Una sola partida basta?** Matemáticamente sí, pero con una salvedad: la partida dura ≈ 0,048·τ, así que el término de pérdidas a·V es débil. Con datos sin ruido se recupera con error < 1 %; si V tiene ruido σ = 0,2 hm³, la desviación estándar de `a` sube a ≈ 23 % y con σ = 0,5 hm³ a ≈ 58 % [ref, 30 repeticiones]. La excitación debe incluir escalones grandes de u_t y Q_río. La no linealidad (P = H·Q_t, saturaciones, rampa del actuador) no afecta a V, pero sí exigiría un modelo distinto para identificar P.

## 8. Postmortem ✏️ (borrador a ajustar con tu experiencia)

1. **Qué funcionó:** el modelo desacoplado de Phaser con pruebas; la prueba headless del Nivel 1; usar la muñeca (landmark 0) para que el puño no altere u_t.
2. **Qué falló o tardó más:** ✏️ (p. ej. la verificación visual no se pudo hacer en el entorno del agente; el τ en pantalla estaba mal en el borrador; el Nivel 3 pedía una demanda inalcanzable).
3. **Prompts y errores de la IA:** ver `PROMPTS.md` (τ = 0,694 s erróneo; ciclo R1 mal clasificado; demanda de 120 MW infactible; Nivel 2 que no obliga a usar el vertedero).
4. **Cómo ayudó al concepto / limitaciones:** el juego muestra que la mano fija dV/dt. Limitaciones: modelo de un solo estado, k_perd constante, sin evaporación variable, sin inercia hidráulica en tuberías, u_v on/off, P simplificada con eficiencia constante.
5. **Con una semana más:** ✏️

## 9. Día 2: regresión, pruebas y entrega

Las tablas del día 2 (revisión inicial, etapas de integración, regresión, mediciones antes/después, lista de verificación y entrega) están en `docs/pruebas_dia2.md`. Resumen de lo medido sin interfaz:

| Prueba | Resultado |
|---|---|
| Línea base `docs/linea_base_escalon.csv` | Valor final 20,034 hm³ · tr = 5418,7 s · Mp = 0,09 % |
| Mismo escalón a 15 FPS (CPU 4× más lenta) | 0,00 % / 0,00 % / 0,00 puntos → pasa |
| Mismo escalón a 144 FPS | 0,00 % / 0,00 % / 0,00 puntos → pasa |
| Juego en el navegador, `?control=escalon`, 60 FPS | 0,0001 % / 0,0009 % / 0,002 puntos → pasa |
| Juego en el navegador, `?control=escalon`, 15 FPS (CPU 4×) | 0,0004 % / 0,0031 % / 0,002 puntos → pasa |
| Niveles sin cambios (`niveles_linea_base.json`) | Pasa |
