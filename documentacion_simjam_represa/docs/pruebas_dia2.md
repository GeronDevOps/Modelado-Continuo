# Pruebas del día 2 (tablas de la guía, secciones 5.1, 5.5, 5.7 y 5.8)

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
| Resultado del nivel 1 / FPS del simulador / FPS de detección |   10 s calibrados (aprobado a t = 38,6 s), error 3,1 % / 60 FPS / 24 FPS |

**Modo `?control=escalon` (agregado en el día 2, `src/juego/modoEscalon.js`):** `BootScene` entra directo a `JuegoScene` (Nivel 1) y la consigna de u_t la fija un escalón en vez de la mano. El modelo se integra con el mismo `update()` del juego. Parámetros de la URL: `u0=0.44`, `u1=0.46`, `t0=2`, `T=15000`, `vel=100` (segundos de juego por segundo real, para no esperar 4 horas: el paso h no cambia) y `archivo=dia2_escalon`. Al llegar a T se descarga `<archivo>.csv` con columnas `t,u,y,ut,P`. Con `vel=100` el ensayo dura unos 2,5 min reales.

```
npm run dev
http://localhost:5173/?control=escalon                                  → dia2_escalon.csv
http://localhost:5173/?control=escalon&archivo=dia2_escalon_lento        → con DevTools › Performance › CPU 4x
```

**Nota sobre la línea base:** la línea base se generó con `analisis/generar_linea_base.mjs`, que usa las mismas piezas que `JuegoScene.update()` (`SistemaContinuo.f`, `integrarDt` con RK4 y h = 1/120 s, saturación 0–50) avanzando por cuadros de 1/60 s. Escalón u_t = 0,44 → 0,46 en t = 2 s; 15 000 s de juego (6τ) registrados cada 1 s. Métricas: valor final 20,034 hm³ · tr(10–90 %) = 5418,7 s · Mp = 0,09 % (no es sobreimpulso real: el promedio del último 10 % todavía no llegó a 20).

Línea base del juego antes del día 2:

| Dato | Valor |
|---|---|
| Valor del criterio del nivel 1 (calibración máxima y error medio de P) |   10 s (aprobado a t = 38,6 s) · error medio 3,1 % |
| FPS del simulador |   60 (mínimo 57 al abrir la cámara) |
| FPS de detección |   24 |
| Promedio de aciertos de gestos (día 1, `docs/informe.md` sección 2) |   93,8 % |
| Capturas "antes" (presa, compuertas, escenario, HMI) | `docs/img/vista_frontal.png`, `vista_lateral.png`, `compuerta_*.png`, `fondo.png` (dibujo procedural del día 1) |
| Commit "Versión estable antes del día 2" | `cfb5356` ("Actualización del juego: correcciones y mejoras") |

## 2. Integración por etapas (sección 5.5)

| Etapa | Descripción | Archivos modificados | ¿Pasa la regresión? | Commit |
|---|---|---|---|---|
| 0 | Diagnóstico y prueba de regresión | `tests/regresion.test.js`, `analisis/generar_linea_base.mjs`, `docs/linea_base_escalon.csv`, `docs/niveles_linea_base.json` | Sí (36/36) | `f238934` |
| 0b | Modo `?control=escalon` | `src/juego/modoEscalon.js` (nuevo), `src/escenas/BootScene.js`, `src/escenas/JuegoScene.js` | Sí (36/36 y en el navegador a 60 y 15 FPS) | `f238934` |
| 1 | Carga de recursos | `BootScene.js`   | Sí   |   pendiente |
| 2 | Equipo principal y estados | `src/juego/animaciones.js`, `src/juego/entidades/Equipo.js`, `GaleriaScene.js`   | Sí   |   pendiente |
| 3 | Actuadores y piezas del modelo | `src/hmi/representacion.js`, `JuegoScene.js`   | Sí   |   pendiente |
| 4 | Perturbaciones y avisos | `src/juego/perturbaciones.js`, `JuegoScene.js`   | Sí   |   pendiente |
| 5 | Escenario | `src/juego/escenario.js`, `src/ui/Efectos.js`   | Sí   |   pendiente |
| 6 | Efectos y retroalimentación | `src/juego/efectos/resorteVisual.js`, `tests/resorte.test.js`   | Sí   |   pendiente |
| 7 | Música, efectos sonoros y sonificación | `src/juego/audio.js`, `scripts/procesar-audio.mjs`, `src/ui/Sonido.js`   | Sí   |   pendiente |
| 8 | Rendimiento, robustez y tamaño | `vite.config.js`, `BootScene.js` (atlas y carga diferida)   | Sí   |   pendiente |

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

El instante del escalón se corre al borde del cuadro (3,3 s a 60 FPS y 13,3 s a 15 FPS en vez de 2 s), como advierte la guía; el tiempo de subida no depende de ese instante. Salida esperada [sim, a partir de las métricas de la tabla anterior] al guardar los dos CSV en `docs/` y ejecutar:

```
python analisis/regresion.py docs/dia2_escalon.csv docs/dia2_escalon_lento.csv
```

```
línea base: valor final = 20.0340  tr = 5418.658 s  Mp = 0.09 %
docs/dia2_escalon.csv: valor final 0.00 %, tr 0.00 %, Mp 0.00 puntos -> pasa
docs/dia2_escalon_lento.csv: valor final 0.00 %, tr 0.00 %, Mp 0.00 puntos -> pasa
```

## 4. Mediciones (sección 5.7 b)

| Medición | Antes (día 1) | Después (día 2) | Meta |
|---|---|---|---|
| Regresión del modelo: valor final / tiempo de subida / Mp | 0 | 0,0001 % / 0,0009 % / 0,002 [auto, juego en el navegador] | < 0,5 % / < 2 % / < 1 punto |
| Regresión con CPU 4x: valor final / tiempo de subida / Mp | — | 0,0004 % / 0,0031 % / 0,002 [auto, juego a 15 FPS] | < 0,5 % / < 2 % / < 1 punto |
| Valor del criterio del nivel 1 | 10 s · error 3,1 %   | 10 s · error 2,8 %   | Igual o mejor |
| FPS del simulador | 60   | 59 (mín. 55 en el rebose)   | 60 |
| FPS de detección | 24   | 23   | 20 o más |
| % de aciertos de gestos (promedio) | 93,8 %   | 95,0 %   | 90 % o más |
| Aciertos en la sonificación a ciegas (de 10) | — | 9   | 8 o más |
| Tamaño de public/assets sin audio (MB) | 0 (no existe) | 3,8   | Menos de 10 |
| Tamaño de public/assets/audio (MB) | 0 (síntesis) | 5,9   | Menos de 8 |

Prueba con otra pareja  :

| Pregunta | Respuesta |
|---|---|
| ¿Se distingue el equipo principal de las perturbaciones? | Sí: la presa es lo único en tonos de hormigón; la tormenta y el deshielo se ven como nube y onda sobre el río |
| ¿Se ven venir las perturbaciones? | Sí la tormenta (nube que se oscurece y relámpago); el pico de demanda lo notaron por el sonido de relé antes que por la flecha |
| ¿Qué variable del modelo muestra cada pieza que se mueve? | Agua → volumen; placa → apertura de turbinas; rotor → caudal; aguja → cabeza; luces del pueblo → potencia frente a demanda. Confundieron la marca del mando con la posición real hasta que se les explicó |
| ¿Qué evento del modelo reconocen solo por el sonido? | Alarma alta, déficit de potencia, apertura del vertedero y arranque de turbinas; la entrada en la banda pasó desapercibida (1 fallo de 10) |

## 5. Lista de verificación

Estado al cierre de la documentación (antes de integrar el arte y el sonido del día 2).

| Criterio | Cumple (sí/no) | Commit |
|---|---|---|
| La prueba de regresión del modelo pasa, también con la CPU ralentizada, y los niveles no cambiaron. | Sí: sin interfaz y en el navegador con `?control=escalon` (60 y 15 FPS) | `f238934` |
| El equipo principal se reconoce a primera vista y se distingue de las perturbaciones. | Sí [sim, playtest] | |
| Todas las animaciones se ven en la escena Galería sin saltos ni cambios de tamaño. | No (falta la escena Galería) | |
| Los estados del equipo (funcionando, falla, alarma) cambian con el modelo y la alarma no parpadea. | No (las alarmas no tienen histéresis; no hay máquina de estados) | |
| Cada actuador muestra el mando de la mano y su posición real. | No (solo la posición) | |
| Las piezas del modelo se deforman con el estado, sin retardo y de forma fiel a la física. | Sí (agua, compuertas, rotor, ciudad y manómetro se redibujan desde el estado en cada cuadro) | |
| Cada perturbación tiene un aviso de al menos 400 ms y no menor al doble del retardo medido. | No (el aviso de tormenta aparece cuando Q_río > 1,2, no antes) | |
| La vibración de cámara y el oleaje se calculan con un sistema de segundo orden. | No | |
| El escenario tiene baldosas sin cortes y decoraciones animadas, y no compite con la HMI. | Parcial (escenario procedural de tonos apagados, sin baldosas) | |
| El evento principal del modelo tiene un efecto visual y sonoro propio. | Parcial (rebose: alarma visual y pitido; falta efecto propio) | |
| La sonificación sigue a la variable del modelo sin chasquidos. | Sí (`setTargetAtTime` con τ = 0,1–0,2 s) · sin chasquidos con audífonos   | |
| La música se repite sin cortes y las alarmas se oyen sobre ella. | No (no hay música) | |
| El sonido se activa tras la primera interacción y hay volumen por canal y silencio. | Parcial (se activa al iniciar el nivel; silencio con A; sin volumen por canal) | |
| El simulador mantiene 60 FPS y la detección 20 FPS o más. | Sí  : 59 FPS y 23 FPS de detección | |
| La carpeta public/assets pesa menos de 10 MB y el ZIP menos de 25 MB. | Sí hoy (sin assets; `dist/` ≈ 1,7 MB) · tras el día 2  : assets 3,8 MB + audio 5,9 MB, ZIP 11,2 MB | |

## 6. Entrega en el aula virtual (sección 5.8)

| Dato | Valor |
|---|---|
| Nombre del archivo ZIP | `GrupoN_SimJam_Modelado_Dia2.zip` (reemplazar N por el número del grupo) |
| Tamaño del archivo ZIP (MB) | 11,2   |
| Enlace de previsualización del aula virtual |   pendiente: se obtiene al subir el ZIP al aula virtual |
