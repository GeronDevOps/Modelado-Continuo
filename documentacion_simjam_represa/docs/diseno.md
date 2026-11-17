# Diseño: "Aislados en la Patagonia: Balance Hídrico"

## 1. Ficha

| Campo | Valor |
|---|---|
| Nombre | Aislados en la Patagonia: Balance Hídrico |
| Sistema simulado | Embalse de una represa hidroeléctrica (dinámica de sistemas, U2) |
| Jugadores | 1 (un solo portátil con cámara; teclado y gamepad como alternativa) |
| Duración de partida | Hasta 120 s de juego = 24 h simuladas (termina antes al lograr 10 s continuos calibrados) |
| Ambientación | Noche lluviosa en la cordillera patagónica, central aislada por un temporal |
| Stack | Phaser 3 · JavaScript ES · Vite · MediaPipe HandLandmarker |

**Historia (una línea):** un temporal corta el camino y la única central eléctrica del valle queda en modo manual; el jugador es el operador que debe sostener la energía del pueblo sin que el embalse se desborde ni se seque.

## 2. Concepto

El embalse es un **acumulador continuo de primer orden**: V cambia según entradas menos salidas. Al mover la mano no se fija el nivel del agua, se fija la **tasa de cambio dV/dt** (compuerta). Con τ = 2500 s de juego frente a partidas de 120 s, el embalse actúa casi como un integrador puro: los errores se acumulan y exigen anticipación y lazo cerrado (human-in-the-loop). Si se quita el modelo, el juego deja de funcionar: el nivel, la potencia y las alarmas salen de `SistemaContinuo`.

## 3. Modelo

Resumen (detalle en `docs/modelo.md`):

```
dV/dt = Q_río − K_t·u_t − K_v·u_v − 0,002·V     [hm³/h]       K_t = 1,0 · K_v = 2,0
H = 20 + 0,8·V [m]       P = 2,45·H·Q_t [MW]       1 h = 5 s de juego
```

Entradas: u_t, u_v · Perturbación: Q_río · Estado/salida: V · Salidas auxiliares: H, P · Referencia: P_demanda.
Integración: RK4 de paso fijo h = 1/120 s; cada cuadro se divide en pasos de h más un paso residual (`integrarDt`), así que la respuesta no depende de los FPS (Euler seleccionable).
Fallas (niveles 2 y 3): V ≤ 5 → DESCEBE (derrota); V ≥ 50 → DESBORDE (derrota). Alarmas en V > 45 (rebosamiento) y V < 10 (cavitación).

## 4. Bucle principal (cada 10 s de partida = 2 h simuladas)

1. Mirar en la HMI la curva P_demanda vs P.
2. Ajustar u_t con la mano para igualar P a la demanda.
3. Vigilar V (banda 30 ± 3; alarmas en 45 y 10) hasta sumar 10 s continuos calibrados.
4. Ante tormenta (Q_río sube), abrir el vertedero si V se acerca a 50.

## 5. Actuadores

| Actuador | Rango | Saturación | Velocidad máxima |
|---|---|---|---|
| Turbinas u_t | 0 – 1 | [0, 1] | 0,20 s⁻¹ (0 → 100 % en 5 s), rampa hacia la referencia del gesto |
| Vertedero u_v | 0 – 1 (mando on/off) | [0, 1] | 0,50 s⁻¹ (abre en 2 s), rampa hacia el mando |

## 6. Controles (máximo 5 acciones)

| Acción | Cámara (HandLandmarker) | Gamepad | Teclado |
|---|---|---|---|
| Turbinas u_t | Altura de la **muñeca (landmark 0)** de la mano derecha, normalizada 0–1, con EMA y zona muerta | Stick derecho eje Y | ↑ / ↓ |
| Vertedero u_v | Puño cerrado de la mano derecha (puntas 8, 12, 16, 20 más cerca de la muñeca que sus PIP), histéresis de 3 cuadros | Botón A | Barra espaciadora |
| Pausa / calibración | Ambas manos fuera de la zona > 3 s | Start | P / C |
| Menú / opciones | Pellizco de la mano izquierda | Select | M |
| Vista debug | — | LB + RB | D |
| Silenciar sonificación | — | — | A |

Decisión de diseño: se usa la **muñeca** y no el centro de la palma para que cerrar el puño (vertedero) no altere u_t. La calibración mide el rango mínimo y máximo de altura de la mano de cada jugador. Sin cámara o con permiso denegado, el juego pasa a teclado/gamepad.

## 7. Niveles

Ver `docs/niveles.md`: Nivel 1 Turno Tranquilo (obligatorio), Nivel 2 Tormenta Cordillerana, Nivel 3 Hora Pico y Deshielo. Los niveles 2 y 3 se desbloquean al aprobar el anterior.

## 8. Elementos visuales

| Elemento | Descripción | Variable del modelo |
|---|---|---|
| Presa y casa de máquinas | Hormigón #3d5a80, contornos oscuros | Estructura fija |
| Compuertas de turbina y vertedero | Placa que sube con la apertura (hoy `Graphics`; día 2: marco + placa + marca del mando) | u_t, u_v |
| Turbinas | Rotor que gira a ω = 16·Q_t rad/s | Q_t |
| Ciudad lejana | Ventanas que se apagan y parpadean si P/D < 0,9 | P/D |
| Agua del embalse | Superficie de y = 490 (vacío) a y = 310 (lleno), con olas | V/50 |
| Chorro de turbinas | 4 cuadros; intensidad ∝ Q_t | Q_t |
| Torrente del vertedero | 5 cuadros, con espuma | u_v |
| Lluvia, relámpagos, paralaje | Partículas diagonales; flash + silueta de montañas | Ambiente; color del agua según Q_río |

## 9. Escenarios y paleta

Noche lluviosa con cordillera nevada y 5 capas de paralaje. Paleta: agua #1c5270 (reposo) → #00a896 (tormenta); hormigón #3d5a80; maquinaria/sombras #293241; HMI #52b788 sobre #111111; alarmas #e63946; advertencias/luces #f4a261. Estilo pixel art de 16 bits, contornos de 1–2 px y dithering.

## 10. Interfaz (HMI, criterio ISA-101)

Fondo #111111, color intenso solo para alarmas.

- Tendencia de 30 s: P(t) verde #52b788; P_demanda amarilla punteada; V(t) azul en eje secundario.
- Manómetro de H (20–60 m); indicadores de u_t (0–100 %) y u_v.
- Alarmas intermitentes #e63946 / #f4a261 con texto y sonido.
- Contador de calibración continua (meta 10 s) y tiempo restante del turno.

## 11. Pantalla "Lo que pasó en el modelo"

- Gráficas 0–120 s: u_t, Q_río, V y P vs P_demanda.
- Métricas: RMSE de potencia, desviación máxima de V respecto a V₀, % de tiempo en banda.
- Resultado del nivel (aprobado / no) con el valor del criterio y, en el Nivel 3, la regla de factibilidad.
- Texto educativo y botón "Descargar datos" (`partida_represa.csv`: t_s, V_hm3, H_m, ut, uv, Qrio, P_MW, Pdemanda_MW, Pref_MW).

## 12. Alcance

- **Mínimo obligatorio:** modelo + pruebas, control por cámara de u_t, HMI, Nivel 1, pantalla final y CSV.
- **Extras:** vertedero por puño, Nivel 2, alarmas, gamepad completo, Nivel 3, menú de niveles y efectos visuales.

## 13. Día 2: arte, sonido y sonificación guiados por el modelo

Regla: el arte y el sonido **leen** el estado de `SistemaContinuo` y nunca escriben en él. La prueba `tests/regresion.test.js` lo comprueba (respuesta al escalón y parámetros de los niveles iguales a la línea base).

- **Arte:** especificación de sprites y mapa variable → representación en `docs/recursos.md`. Equipo principal: presa y casa de máquinas (192×192, estados reposo / funcionando / falla / alarma). Actuadores: compuertas de turbinas y vertedero con mando y posición real. Perturbaciones: tormenta, deshielo y pico de demanda, con aviso de 400 ms.
- **Máquina de estados de la presa (sistema híbrido):** apagado (Q_t = 0) → arranque → funcionando; alarma si V > 45 (sale en 44); falla si V < 10 (sale en 11). Solo elige la animación y la alarma.
- **Sonido:** música por situación, efectos y sonificación en `docs/audio.md`. La sonificación ya implementada: rumor del agua ∝ Q_t + Q_v, zumbido eléctrico ∝ P y alerta si D > P, con `setTargetAtTime`.
- **Retroalimentación:** vibración de cámara (2.º orden, ζ = 0,3, 12 Hz) ante desborde o descebe; oleaje del embalse (ζ = 0,2, 2 Hz) al abrir bruscamente una compuerta; opción "Reducir efectos".
- **Pruebas y entrega:** `docs/pruebas_dia2.md`; prompts en `PROMPTS.md`.
