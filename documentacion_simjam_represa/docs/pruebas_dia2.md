# Pruebas del día 2 (tablas de la guía, secciones 5.1, 5.5, 5.7 y 5.8)

Convención: **[auto]** = medido sin interfaz en este repositorio (pruebas, build, scripts). ✏️ = dato que se mide jugando con las manos o en el navegador.

## 1. Revisión del estado y línea base (sección 5.1)

| Verificación | Resultado |
|---|---|
| npm test sin fallas | **Sí [auto]**: 4 archivos, 36/36 pruebas (`modelo`, `fase2`, `fase3` y la nueva `regresion`) |
| npm run build sin errores | **Sí [auto]**: `dist/` ≈ 1,7 MB de JS (aviso de Vite por chunk > 500 kB; no es error) |
| Requisitos de la sección 5.5.1 (día 1) | **Parcial**: `base: './'` ✔ y `pixelArt: true` ✔; Phaser **no** va por CDN (`import Phaser from 'phaser'` en `src/main.js`, versión 3.88 en npm) y MediaPipe se importa del paquete npm (el WASM sí va por CDN 0.10.14) |
| src/modelo/ independiente de Phaser | **Sí**: `SistemaContinuo.js` e `integradores.js` solo importan `config/constantes.js` |
| Niveles cargados desde docs/niveles.md | **Sí**: `src/config/constantes.js` coincide con `docs/niveles.md` (actualizado al Nivel 1 de 10 s) |
| Elementos que se dibujan con figuras | **Todos**: presa, agua, compuertas, turbinas, ciudad, lluvia, rayos, manómetro y tendencias usan `Graphics` |
| Recursos que faltan en public/assets | **Todos**: no existe `public/assets/` (ver `docs/recursos.md`, sección 4) |
| Archivo de línea base del modelo | **Sí [auto]**: `docs/linea_base_escalon.csv` (ver nota); el juego ahora tiene `?control=escalon` |
| Resultado del nivel 1 / FPS del simulador / FPS de detección | ✏️ ___ s calibrados, error ___ % / ___ FPS / ___ FPS |

**Modo `?control=escalon` (agregado en el día 2, `src/juego/modoEscalon.js`):** `BootScene` entra directo a `JuegoScene` (Nivel 1) y la consigna de u_t la fija un escalón en vez de la mano. El modelo se integra con el mismo `update()` del juego. Parámetros de la URL: `u0=0.44`, `u1=0.46`, `t0=2`, `T=15000`, `vel=100` (segundos de juego por segundo real, para no esperar 4 horas: el paso h no cambia) y `archivo=dia2_escalon`. Al llegar a T se descarga `<archivo>.csv` con columnas `t,u,y,ut,P`. Con `vel=100` el ensayo dura unos 2,5 min reales.

```
npm run dev
http://localhost:5173/?control=escalon                                  → dia2_escalon.csv
http://localhost:5173/?control=escalon&archivo=dia2_escalon_lento        → con DevTools › Performance › CPU 4x
```

**Nota sobre la línea base:** la línea base se generó con `analisis/generar_linea_base.mjs`, que usa las mismas piezas que `JuegoScene.update()` (`SistemaContinuo.f`, `integrarDt` con RK4 y h = 1/120 s, saturación 0–50) avanzando por cuadros de 1/60 s. Escalón u_t = 0,44 → 0,46 en t = 2 s; 15 000 s de juego (6τ) registrados cada 1 s. Métricas: valor final 20,034 hm³ · tr(10–90 %) = 5418,7 s · Mp = 0,09 % (no es sobreimpulso real: el promedio del último 10 % todavía no llegó a 20).

Línea base del juego antes del día 2 (✏️):

| Dato | Valor |
|---|---|
| Valor del criterio del nivel 1 (calibración máxima y error medio de P) | ✏️ |
| FPS del simulador | ✏️ |
| FPS de detección | ✏️ |
| Promedio de aciertos de gestos (día 1, `docs/informe.md` sección 2) | ✏️ |
| Capturas "antes" (presa, compuertas, escenario, HMI) | ✏️ `docs/capturas/antes_*.png` |
| Commit "Versión estable antes del día 2" | ✏️ |

## 2. Integración por etapas (sección 5.5)

| Etapa | Descripción | Archivos modificados | ¿Pasa la regresión? | Commit |
|---|---|---|---|---|
| 0 | Diagnóstico y prueba de regresión | `tests/regresion.test.js`, `analisis/generar_linea_base.mjs`, `docs/linea_base_escalon.csv`, `docs/niveles_linea_base.json` | Sí (36/36) | ✏️ |
| 0b | Modo `?control=escalon` | `src/juego/modoEscalon.js` (nuevo), `src/escenas/BootScene.js`, `src/escenas/JuegoScene.js` | Sí (36/36 y en el navegador a 60 y 15 FPS) | ✏️ |
| 1 | Carga de recursos | ✏️ `BootScene.js` | ✏️ | ✏️ |
| 2 | Equipo principal y estados | ✏️ `src/juego/animaciones.js`, `src/juego/entidades/Equipo.js`, `GaleriaScene.js` | ✏️ | ✏️ |
| 3 | Actuadores y piezas del modelo | ✏️ `src/hmi/representacion.js`, `JuegoScene.js` | ✏️ | ✏️ |
| 4 | Perturbaciones y avisos | ✏️ | ✏️ | ✏️ |
| 5 | Escenario | ✏️ | ✏️ | ✏️ |
| 6 | Efectos y retroalimentación | ✏️ `src/juego/efectos/resorteVisual.js` | ✏️ | ✏️ |
| 7 | Música, efectos sonoros y sonificación | ✏️ `src/juego/audio.js`, `scripts/procesar-audio.mjs` | ✏️ | ✏️ |
| 8 | Rendimiento, robustez y tamaño | ✏️ | ✏️ | ✏️ |

## 3. Regresión del modelo (sección 5.7 a)

Comando (desde `documentacion_simjam_represa/`):

```
python analisis/regresion.py docs/dia2_escalon.csv docs/dia2_escalon_lento.csv
```

Resultado de referencia sin interfaz [auto] (`analisis/regresion_headless.txt`): el mismo escalón a 15 FPS (equivale a la CPU 4× más lenta) y a 144 FPS da **0,00 % / 0,00 % / 0,00 puntos** frente a la línea base: el paso fijo h = 1/120 s hace que la respuesta no dependa de los FPS.

```
línea base: valor final = 20.0340  tr = 5418.658 s  Mp = 0.09 %
analisis/headless_escalon_15fps.csv: valor final 0.00 %, tr 0.00 %, Mp 0.00 puntos -> pasa
analisis/headless_escalon_144fps.csv: valor final 0.00 %, tr 0.00 %, Mp 0.00 puntos -> pasa
```

Resultado en el navegador [auto, 2026-11-17]: modo `?control=escalon` ejecutado en `npm run dev` (Chrome del panel de Claude), con los cuadros avanzados a mano con `game.step` (el panel estaba oculto). Métricas calculadas en la página con el mismo algoritmo de `regresion.py`:

| Ensayo | Cuadro (delta) | Muestras | Valor final | tr (s) | Mp (%) | Diferencia vs línea base | ¿Pasa? |
|---|---|---|---|---|---|---|---|
| `dia2_escalon` | 1/60 s (60 FPS) × vel 100 | 9001 | 20,03398 | 5418,71 | 0,092 | 0,0001 % / 0,0009 % / 0,002 puntos | Sí |
| `dia2_escalon_lento` | 1/15 s (CPU 4×) × vel 100 | 2251 | 20,03392 | 5418,83 | 0,092 | 0,0004 % / 0,0031 % / 0,002 puntos | Sí |

El instante del escalón se corre al borde del cuadro (3,3 s a 60 FPS y 13,3 s a 15 FPS en vez de 2 s), como advierte la guía; el tiempo de subida no depende de ese instante. ✏️ Para la entrega, descargar los dos CSV desde el navegador, guardarlos en `docs/` y pegar aquí la salida de:

```
python analisis/regresion.py docs/dia2_escalon.csv docs/dia2_escalon_lento.csv
```

## 4. Mediciones (sección 5.7 b)

| Medición | Antes (día 1) | Después (día 2) | Meta |
|---|---|---|---|
| Regresión del modelo: valor final / tiempo de subida / Mp | 0 | 0,0001 % / 0,0009 % / 0,002 [auto, juego en el navegador] | < 0,5 % / < 2 % / < 1 punto |
| Regresión con CPU 4x: valor final / tiempo de subida / Mp | — | 0,0004 % / 0,0031 % / 0,002 [auto, juego a 15 FPS] | < 0,5 % / < 2 % / < 1 punto |
| Valor del criterio del nivel 1 | ✏️ | ✏️ | Igual o mejor |
| FPS del simulador | ✏️ | ✏️ | 60 |
| FPS de detección | ✏️ | ✏️ | 20 o más |
| % de aciertos de gestos (promedio) | ✏️ | ✏️ | 90 % o más |
| Aciertos en la sonificación a ciegas (de 10) | — | ✏️ | 8 o más |
| Tamaño de public/assets sin audio (MB) | 0 (no existe) | ✏️ | Menos de 10 |
| Tamaño de public/assets/audio (MB) | 0 (síntesis) | ✏️ | Menos de 8 |

Prueba con otra pareja (✏️):

| Pregunta | Respuesta |
|---|---|
| ¿Se distingue el equipo principal de las perturbaciones? | ✏️ |
| ¿Se ven venir las perturbaciones? | ✏️ |
| ¿Qué variable del modelo muestra cada pieza que se mueve? | ✏️ |
| ¿Qué evento del modelo reconocen solo por el sonido? | ✏️ |

## 5. Lista de verificación

Estado al cierre de la documentación (antes de integrar el arte y el sonido del día 2).

| Criterio | Cumple (sí/no) | Commit |
|---|---|---|
| La prueba de regresión del modelo pasa, también con la CPU ralentizada, y los niveles no cambiaron. | Sí: sin interfaz y en el navegador con `?control=escalon` (60 y 15 FPS) | ✏️ |
| El equipo principal se reconoce a primera vista y se distingue de las perturbaciones. | ✏️ | |
| Todas las animaciones se ven en la escena Galería sin saltos ni cambios de tamaño. | No (falta la escena Galería) | |
| Los estados del equipo (funcionando, falla, alarma) cambian con el modelo y la alarma no parpadea. | No (las alarmas no tienen histéresis; no hay máquina de estados) | |
| Cada actuador muestra el mando de la mano y su posición real. | No (solo la posición) | |
| Las piezas del modelo se deforman con el estado, sin retardo y de forma fiel a la física. | Sí (agua, compuertas, rotor, ciudad y manómetro se redibujan desde el estado en cada cuadro) | |
| Cada perturbación tiene un aviso de al menos 400 ms y no menor al doble del retardo medido. | No (el aviso de tormenta aparece cuando Q_río > 1,2, no antes) | |
| La vibración de cámara y el oleaje se calculan con un sistema de segundo orden. | No | |
| El escenario tiene baldosas sin cortes y decoraciones animadas, y no compite con la HMI. | Parcial (escenario procedural de tonos apagados, sin baldosas) | |
| El evento principal del modelo tiene un efecto visual y sonoro propio. | Parcial (rebose: alarma visual y pitido; falta efecto propio) | |
| La sonificación sigue a la variable del modelo sin chasquidos. | Sí (`setTargetAtTime` con τ = 0,1–0,2 s) · ✏️ confirmar con audífonos | |
| La música se repite sin cortes y las alarmas se oyen sobre ella. | No (no hay música) | |
| El sonido se activa tras la primera interacción y hay volumen por canal y silencio. | Parcial (se activa al iniciar el nivel; silencio con A; sin volumen por canal) | |
| El simulador mantiene 60 FPS y la detección 20 FPS o más. | ✏️ | |
| La carpeta public/assets pesa menos de 10 MB y el ZIP menos de 25 MB. | Sí hoy (sin assets; `dist/` ≈ 1,7 MB) · ✏️ tras el día 2 | |

## 6. Entrega en el aula virtual (sección 5.8)

| Dato | Valor |
|---|---|
| Nombre del archivo ZIP | ✏️ `GrupoN_SimJam_Modelado_Dia2.zip` |
| Tamaño del archivo ZIP (MB) | ✏️ |
| Enlace de previsualización del aula virtual | ✏️ |
