# PROMPTS — "Aislados en la Patagonia: Balance Hídrico"

Registro de los prompts usados con IA. Para cada uno: herramienta, fecha, prompt y qué se hizo con la respuesta, con los errores de la IA y cómo se corrigieron. Las entradas marcadas **[sim]** son una reconstrucción simulada: reemplazarlas por el texto exacto del historial de la herramienta.

## Día 1

Reconstrucción **[sim]** de los prompts del día 1 (2026-11-16):

| # | Herramienta | Prompt (resumen) | Uso de la respuesta | Error de la IA y corrección |
|---|---|---|---|---|
| 1 | Gemini (skill disenador-juegos-simulacion) | "Diseña un juego de simulación continua sobre el embalse de una represa hidroeléctrica en la Patagonia, controlado con la mano por cámara, con ficha, bucle, actuadores, controles y tres niveles" | Base de `docs/diseno.md` (secciones 1–12) | Propuso 8 acciones de control: se redujo a 5 |
| 2 | Gemini | "Escribe el modelo de dinámica de sistemas del embalse: EDO, punto de operación, G(s), espacio de estados y diagrama causal con ciclos R/B" | `docs/modelo.md` | τ en pantalla de 0,694 s (correcto: 500 h = 2500 s de juego); ciclo R1 clasificado como de balance; polaridad Q_t → P invertida |
| 3 | Claude Code | "Genera `vensim/represa.mdl` con las ecuaciones de `docs/modelo.md`, RK4, 20 h y un escalón de −0,1 en u_t a las 2 h" | `vensim/represa.mdl` y `vensim/LEEME.md` | El .mdl no fijaba el tipo de integración: se documentó elegir RK4 a mano |
| 4 | Claude Code | "Implementa `SistemaContinuo` e `integradores` (RK4/Euler, h = 1/120 s, `integrarDt`) sin Phaser y sus pruebas Vitest" | `src/modelo/`, `tests/modelo.test.js` | Sin paso residual: la respuesta dependía de los FPS. Se agregó el paso residual en `integrarDt` |
| 5 | Claude Code | "Implementa la escena de juego, la HMI ISA-101, los gestos con MediaPipe (muñeca, puño, pellizco) y los niveles 1–3" | `src/escenas/`, `src/ui/`, `src/entrada/`, `tests/fase2.test.js`, `tests/fase3.test.js` | Demanda de 120 MW infactible en el Nivel 3 (se agregó `demandaEfectiva`); Nivel 2 que no obligaba a usar el vertedero (se subió la tormenta a amplitud 2,5) |
| 6 | Claude Code | "Escribe `analisis/verificacion_numerica.py` e `identificar_represa.py` y valida con datos sintéticos" | `docs/informe.md`, secciones 1 y 5 | Propuso python-control con un 1.er orden: se cambió a mínimos cuadrados en forma integral |

---

## Día 2

### 5.1 Revisión del estado (Codex / Claude Code)

```
Revisa el estado del proyecto antes de empezar el día 2 de la SimJam y no
modifiques ningún archivo:
1. Ejecuta npm test, npm run build y npm run preview e informa si hay errores.
2. Verifica los requisitos de la sección 5.5.1 de la guía del día 1:
   Phaser 3.87 por CDN, base: './' en vite.config.js, MediaPipe 0.10.14 por
   CDN con Hand Landmarker, sin import de phaser y rutas relativas.
3. Confirma que src/modelo/ no importa Phaser ni el DOM, que las escenas no
   calculan física por su cuenta y que los actuadores usan la clase Actuador.
   Lista dónde se lee el estado del modelo para dibujar.
4. Lista los elementos del simulador (equipo principal, actuadores,
   perturbaciones, indicadores), cómo se dibujan hoy y qué variable del
   modelo controla cada uno.
5. Confirma que los niveles de src/config/constantes.js coinciden con docs/niveles.md.
6. Compara public/assets/ con docs/recursos.md.
7. Entrégame en una tabla lo que está listo y lo que falta para mejorar el
   arte y el sonido.
```

Resultado: ver `docs/pruebas_dia2.md`, sección 1. Hallazgos: todo se dibuja con `Graphics`; no existe `public/assets/`; Phaser y MediaPipe se importan por npm; no hay clase `Actuador` (la rampa de u_t está en `JuegoScene._procesarControles`); no había modo `?control=escalon` (se agregó, ver etapa 0b).

### 5.3 Arte en Gemini (skill director-arte-videojuegos)

**Equipo principal** (adjuntar `docs/diseno.md`, la guía de estilo y `docs/img/vista_frontal.png`):

```
/director-arte-videojuegos
Mejora el equipo principal "Presa y casa de máquinas", que representa una
represa hidroeléctrica de hormigón en la cordillera patagónica, de noche y con
lluvia. Adjunto la versión actual. Respeta la guía de estilo (pixel art de 16
bits, contornos de 1-2 px, dithering, hormigón #3d5a80, sombras #293241) y las
reglas para Phaser.
1. Lectura: que se reconozca a primera vista y que su forma muestre su función
   física: embalse aguas arriba (entrada), tubería forzada y casa de máquinas
   (salida por turbinas), vertedero lateral (salida de emergencia) y
   manómetro de cabeza hidráulica (sensor).
2. HMI: tonos neutros y apagados; el color intenso queda solo para alarmas
   (#e63946) y advertencias (#f4a261).
3. Genera una hoja de sprites por estado, una sola fila, cuadros de 192x192
   px, en la misma escala y posición en todos los cuadros, fondo magenta
   #FF00FF: reposo (1 cuadro), funcionando (4: luces y vibración de la casa de
   máquinas), falla (4: grietas y turbinas detenidas por cavitación) y alarma
   (2: baliza roja encendida/apagada).
4. Entrega por separado las partes que el juego deformará según el modelo:
   "el agua del embalse" (textura estirable de 32x128), "el chorro de las
   turbinas" (48x64, 4 cuadros), "el torrente del vertedero" (96x96, 5
   cuadros) y "el rotor de la turbina" (64x64), en reposo y con bordes limpios.
```

**Actuadores** (uno por mensaje):

```
/director-arte-videojuegos
Crea el actuador "Compuerta de turbinas" (compuerta), con el mismo estilo y
escala del equipo principal.
1. Pieza fija (marco de hormigón con guías) y pieza móvil (placa de acero
   deslizante) por separado, sobre fondo magenta, para que el juego desplace
   la placa hacia arriba según la apertura u_t (0 a 1).
2. Una marca semitransparente con la forma de la placa para mostrar el mando
   de la mano.
3. Variante en color de falla.
```

Repetir con `"Compuerta del vertedero"` (apertura u_v) y con `"Manómetro de cabeza hidráulica"` (cuerpo fijo + aguja que gira de 20 a 60 m).

**Perturbaciones** (una por mensaje):

```
/director-arte-videojuegos
Crea la perturbación "Tormenta cordillerana", que representa una creciente del
río por lluvia intensa (Q_río sube de 0,5 a 3,0 hm³/h durante 90 s), con el
mismo estilo del simulador.
1. Su forma debe anunciar su efecto: prolongada = nube ancha y pesada.
2. Hojas de sprites en una fila, cuadros de 64x64 px, fondo magenta:
   aviso (3 cuadros, la nube se oscurece y brilla un relámpago que el jugador
   alcance a ver), activa (4) y fin (3).
```

Repetir con `"Deshielo"` (oscilante = forma ondulada, Q_río entre 0,5 y 2,5 con periodo de 40 s) y `"Pico de demanda"` (rápida = flecha delgada y alargada sobre la ciudad).

**Escenario:**

```
/director-arte-videojuegos
Mejora el escenario "Valle aislado de la Patagonia", que representa una
central hidroeléctrica en un valle de la cordillera nevada, de noche y con
lluvia, con un pueblo pequeño a lo lejos.
1. Profundidad: tres capas separadas de 1280x720 px: fondo lejano (cielo
   nocturno y cordillera), estructuras medias (laderas y torres de
   transmisión, fondo magenta) y detalles cercanos en primer plano (rocas,
   lengas y barandas, fondo magenta).
2. Baldosas: hoja de 32x32 px en cuadrícula 8x4 con roca, hormigón, muros,
   tuberías rectas y codos, pasarelas, nieve y variaciones. Todas encajan sin
   cortes.
3. Objetos decorativos animados (4 cuadros cada uno, fondo magenta): baliza de
   la torre de transmisión, ventanas de la sala de control que parpadean.
4. Contraste: el fondo con colores apagados y poco detalle, para que la
   planta y la HMI se lean primero.
```

**Efectos visuales:**

```
/director-arte-videojuegos
Crea los efectos visuales del simulador, cada uno como hoja de sprites en una
fila, cuadros de 64x64 px, fondo magenta: salpicadura (5 cuadros), vapor o
rocío del vertedero (6), chispa de cortocircuito (4), polvo (4), aparición de
objeto (5) y "rebose del agua sobre la corona de la presa" (6).
```

Respuestas y retoques **[sim]**: la presa salió con 5 cuadros en "funcionando" y escala distinta en "falla": se regeneró pidiendo "misma escala y posición en todos los cuadros". En Piskel se limpió el halo magenta de los bordes (1 px), se igualó la baliza de alarma entre los 2 cuadros y se recortó la compuerta del vertedero a 64×64. El deshielo se regeneró dos veces porque Gemini dibujaba una nube igual a la tormenta (no se distinguían); se pidió "forma ondulada de agua, sin nube".

### 5.4 Audio

**Diseño de audio** (skill disenador-juegos-simulacion, adjuntar `docs/diseno.md` y `docs/modelo.md`): prompt de la guía, sección 5.4 a, sin cambios. Respuesta revisada y guardada como `docs/audio.md` (se ajustó a la sonificación que ya existía en `src/ui/Sonido.js`).

**Música** (Gemini → Herramientas → Música, instrumental), una vez por pista:

```
Crea una pista instrumental, sin voz ni letra, para un simulador 2D de una
represa hidroeléctrica en la cordillera patagónica, de noche y con lluvia.
Situación: <menú / operación normal / tormenta / nivel superado / nivel
fallido>. Estilo: <electrónica ambiental / ambient minimalista / synthwave
oscuro / synth suave / ambient grave>. Tempo: <70 / 80 / 100 / 90 / 60> BPM.
Emoción: <calma y aislamiento / concentración / tensión creciente / alivio /
pesadez>. Ambiente de planta industrial: pulsos regulares como un oscilador,
zumbido de turbinas y agua que corre. Debe ser discreta, sin picos de volumen,
y poder repetirse en bucle sin un final marcado.
```

**Efectos** en jsfxr (sfxr.me) **[sim]**: Hit/Hurt → `sfx_descebe`, `sfx_tope`, `sfx_vertedero_cerrar`; Powerup → `sfx_superado`, `sfx_turbina_arranque`; Blip/Select → `ui_mover`, `ui_aceptar`, `ui_cancelar`, `sfx_aviso_demanda`; Pickup/Coin → `sfx_banda`, `ui_calibrado`; Explosion → `sfx_desborde`, `sfx_aviso_tormenta`; Laser/Shoot → `sfx_compuerta_abrir`, `sfx_compuerta_cerrar` (frecuencia invertida para cerrar); Synth → `sfx_alarma_alta`, `sfx_alarma_baja`.

### 5.5 Integración (Codex / Claude Code)

Prompt de la guía, sección 5.5, con estas adaptaciones al proyecto:

- Los niveles están en `src/config/constantes.js` (no hay `niveles.json`); la prueba de regresión los compara con `docs/niveles_linea_base.json`.
- Las pruebas usan Vitest en `tests/` (no `node:test` en `test/`): la prueba es `tests/regresion.test.js`.
- No existe la clase `Actuador`; la rampa de u_t (0,20 s⁻¹) y de u_v (0,50 s⁻¹) está en `JuegoScene`. No modificarla.

Prompts detallados por etapa: los de la guía (5.6 a–g), reemplazando los ejemplos por:

- Etapa 2: variable del timeScale de "funcionando" = Q_t; alarma con histéresis "entra en 45 hm³ y sale en 44 hm³", falla "entra en 10 y sale en 11".
- Etapa 3: "el agua del embalse con setCrop según V/50", "la placa de la compuerta desplazada según u_t", "el rotor girando a ω = 16·Q_t rad/s", "las luces de la ciudad según P/D".
- Etapa 4: `<AVISO>` = 400 ms; la programación de perturbaciones está en `docs/niveles.md`.
- Etapa 5: cámara fija (no hay parallax con desplazamiento).
- Etapa 6: evento principal = "el embalse llega a 45 hm³ (alarma alta) o a 50 hm³ (desborde)".
- Etapa 7: variables de la sonificación = Q_t + Q_v (rumor) y P (zumbido), con las τ de `docs/audio.md`.

Respuestas por etapa y errores corregidos (etapas 1–8 **[sim]**):

| Etapa | Fecha | Herramienta | Resumen de la respuesta | Errores de la IA y corrección |
|---|---|---|---|---|
| 0 | 2026-11-17 | Claude Code | Línea base, `regresion.py`, `tests/regresion.test.js`, docs del día 2 | La guía pide `?control=escalon`, pero el juego no lo tiene: la línea base se generó sin interfaz con el mismo integrador |
| 0b | 2026-11-17 | Claude Code | Modo `?control=escalon` en `src/juego/modoEscalon.js` con `vel` para acelerar el ensayo sin cambiar h | Con τ = 2500 s el ensayo en tiempo real duraría 4 h: se agregó el parámetro `vel`, que entrega más tiempo por cuadro a `integrarDt` |
| 1 | 2026-11-18 | Claude Code | Carga de recursos en `BootScene` con barra de progreso y respaldo procedural si falta una imagen | Usó rutas `/assets/...` con barra inicial (fallan con `base: './'`): se cambiaron a `assets/...` |
| 2 | 2026-11-18 | Claude Code | `animaciones.js`, `Equipo.js` y `GaleriaScene.js`; máquina de estados apagado/arranque/funcionando/alarma/falla | La alarma no tenía histéresis y parpadeaba en V ≈ 45: se agregó salida en 44 y en 11 |
| 3 | 2026-11-18 | Claude Code | `representacion.js` (`mapear`, color, histéresis); agua con `setCrop`, placa y marca del mando, rotor, luces | Animó la placa con un tween (retardo visible): se dibujó directo desde u_t en cada cuadro |
| 4 | 2026-11-19 | Claude Code | Avisos de 400 ms antes de cada perturbación, leídos de la programación de `docs/niveles.md` | Calculaba el aviso con `Math.random`: se quitó (las perturbaciones son deterministas) |
| 5 | 2026-11-19 | Claude Code | Tres capas de fondo, baldosas y decoraciones animadas con cámara fija | Agregó parallax con desplazamiento de cámara: se dejó la cámara fija |
| 6 | 2026-11-19 | Claude Code | `resorteVisual.js` (2.º orden con RK4) para vibración y oleaje; efecto de rebose de la corona; opción "Reducir efectos" | Integraba el resorte con Euler y h = dt (inestable a 15 FPS): se usó `integrarDt` con h fijo |
| 7 | 2026-11-20 | Claude Code | `audio.js` con 4 canales, ducking, música por situación y sonificación sobre `this.sound.context` | Conflicto de teclas A/M: silencio general pasó a M y el menú a Esc |
| 8 | 2026-11-20 | Claude Code | Atlas de sprites, OGG+MP3, `scripts/procesar-audio.mjs`, carga diferida de la música | Proponía cargar las 5 pistas al inicio (12 MB): se recortaron a 45 s y se cargan por escena |
