# Diseño de audio: "Aislados en la Patagonia: Balance Hídrico"

Guía día 2, sección 5.4. Ambiente: noche lluviosa en la cordillera, sala de control de una central aislada. La regla del día es que **el sonido lee el modelo, pero no lo cambia**.

## 0. Estado actual (síntesis en el navegador, sin archivos)

Hoy todo el sonido del juego se sintetiza con Web Audio API; no hay archivos de audio. Cada clase crea su propio `AudioContext`, y el grafo se inicia al empezar un nivel (después de un clic o una tecla, así que el navegador lo permite).

| Sonido | Dónde | Cómo se genera | Variable del modelo | Suavizado |
|---|---|---|---|---|
| Rumor del agua | `src/ui/Sonido.js` | Ruido marrón en bucle → filtro pasabanda (Q = 0,7) → ganancia | q = (Q_t + Q_v)/3: ganancia 0,03 + 0,55·q; frecuencia central 300 + 900·q Hz | `setTargetAtTime`, τ = 0,1 s (volumen) y 0,2 s (filtro) |
| Zumbido eléctrico | `src/ui/Sonido.js` | Diente de sierra 100 Hz + cuadradas 200 y 300 Hz → pasabajos 900 Hz | p = P/150: ganancia 0,015 + 0,09·p; tono (100 + 12·p)·k Hz | τ = 0,1 s (volumen) y 0,15 s (tono) |
| Alerta de déficit | `src/ui/Sonido.js` | Doble pitido cuadrado 740 Hz + 988 Hz, cada 0,9 s | Suena mientras D − P > max(2 MW, 5 % de D) | Envolvente de 10 ms de ataque |
| Alarma de rebose | `src/ui/Alarmas.js` | Pitido de 880 Hz, 0,25 s, sincronizado con el parpadeo | V > 45 hm³ | — |
| Alarma de cavitación | `src/ui/Alarmas.js` | Pitido de 330 Hz, 0,3 s | V < 10 hm³ | — |
| Trueno | `src/ui/Efectos.js` | Ruido con caída cuadrática de 1,4 s → pasabajos 220 Hz | Acompaña cada relámpago; frecuencia de rayos ∝ intensidad de tormenta | — |
| Silencio | `JuegoScene` | Tecla **A** alterna el silencio de la sonificación; la pausa la silencia | — | — |

Pendiente para el día 2: un gestor único con canales (sección 5), música, efectos de actuadores e interfaz, ducking, desbloqueo explícito con mensaje y menú de volumen.

## 1. Música (una pista por situación)

Todas instrumentales, discretas (sin picos), con bucle sin final marcado. Formato OGG + MP3, 96 kbps, estéreo, 30–90 s. Fuente: Gemini, herramienta Música (Lyria 3), o Kenney/OpenGameArt (CC0).

| Pista | Archivo | Situación | Estilo | Tempo | Instrumentos | Emoción |
|---|---|---|---|---|---|---|
| Menú | `musica_menu` | Menú, selección de nivel, calibración | Electrónica ambiental | 70 BPM | Pad de sintetizador, viento suave, campanas lejanas | Calma, aislamiento |
| Operación normal | `musica_operacion` | Nivel 1 y fases sin perturbación | Ambient minimalista | 80 BPM | Pulso de bajo regular (como un oscilador), zumbido de máquinas, agua que corre | Concentración |
| Perturbación / tensión | `musica_tormenta` | Tormenta (N2), picos de deshielo y escalones grandes de demanda (N3), V > 40 | Synthwave oscuro | 100 BPM | Arpegio en ostinato, percusión baja, cuerdas sintéticas | Tensión creciente |
| Nivel superado | `musica_superado` | Pantalla de resultados con éxito | Synth suave | 90 BPM | Pad mayor, campanas | Alivio |
| Nivel fallido | `musica_fallido` | Desborde, descebe o 120 s sin calibrar | Ambient grave | 60 BPM | Drone grave, notas menores | Pesadez, reflexión |

Cambios de pista: fundido de 1 s al cambiar de escena y al entrar en "perturbación" (Q_río > 1,2 o aviso de escalón de demanda); vuelve a "operación" cuando Q_río < 1,0 durante 3 s (histéresis).

## 2. Efectos sonoros (máximo 1 s)

| Evento | Descripción del sonido | Duración | Prioridad | Archivo |
|---|---|---|---|---|
| Abrir compuerta de turbinas (u_t sube) | Chirrido metálico corto, tono que sube | 0,3 s | Baja | `sfx_compuerta_abrir` |
| Cerrar compuerta de turbinas | Mismo chirrido con tono que baja y golpe final | 0,3 s | Baja | `sfx_compuerta_cerrar` |
| Abrir vertedero (u_v 0 → 1) | Golpe de compuerta pesada + chorro que arranca | 0,8 s | Media | `sfx_vertedero_abrir` |
| Cerrar vertedero | Golpe sordo | 0,4 s | Media | `sfx_vertedero_cerrar` |
| Actuador saturado (u_t en 0 o 1) | Tope mecánico "clonk" | 0,15 s | Baja | `sfx_tope` |
| Aviso de tormenta | Trueno lejano grave | 1,0 s | Media | `sfx_aviso_tormenta` |
| Aviso de escalón de demanda | Dos notas ascendentes tipo relé | 0,4 s | Media | `sfx_aviso_demanda` |
| Interfaz: mover selección | Blip corto | 0,05 s | Baja | `ui_mover` |
| Interfaz: aceptar | Blip doble ascendente | 0,15 s | Baja | `ui_aceptar` |
| Interfaz: cancelar / volver | Blip descendente | 0,15 s | Baja | `ui_cancelar` |
| Calibración de la mano lista | Acorde corto | 0,3 s | Baja | `ui_calibrado` |

## 3. Sonidos de los eventos del modelo

Cada uno debe distinguirse de los demás con los ojos cerrados.

| Evento del modelo | Condición (estado continuo) | Sonido | Duración | Prioridad | Archivo |
|---|---|---|---|---|---|
| Entrada en la banda | V entra en [27, 33] y P en tolerancia | Campanita suave ascendente | 0,3 s | Baja | `sfx_banda` |
| Calibración completa (nivel superado) | 10 s continuos calibrados | Fanfarria corta (Powerup) | 1,0 s | Alta | `sfx_superado` |
| Alarma alta (H) | V > 45 (sale en 44) | Sirena de dos tonos 880/660 Hz | 0,6 s, repetida | Alta | `sfx_alarma_alta` |
| Alarma muy alta / desborde (HH) | V ≥ 50 | Agua que rompe sobre la corona + explosión grave | 1,0 s | Alta | `sfx_desborde` |
| Alarma baja (L) | V < 10 (sale en 11) | Tono grave 330 Hz pulsado | 0,5 s, repetida | Alta | `sfx_alarma_baja` |
| Descebe / cavitación (LL) | V ≤ 5 | Golpeteo metálico + motor que se apaga (Hit/Hurt) | 1,0 s | Alta | `sfx_descebe` |
| Déficit de potencia | D − P > max(2 MW, 5 % D) | Doble pitido 740/988 Hz (ya existe, sintetizado) | 0,3 s | Media | sintetizado |
| Turbinas arrancan | Q_t pasa de 0 a > 0,05 | Silbido que sube | 0,6 s | Baja | `sfx_turbina_arranque` |

## 4. Sonificación (variable del modelo → parámetro del sonido)

Sintetizada con Web Audio (`this.sound.context` de Phaser en el día 2). Cada parámetro se lleva a su objetivo con `AudioParam.setTargetAtTime(objetivo, ahora, τ)`, que es un filtro de primer orden τ·dy/dt + y = u: el sonido sigue a la variable sin saltos ni chasquidos. Con τ ≤ 0,2 s el retardo es mucho menor que la dinámica de la planta (τ = 2500 s) y que el retardo de la cámara.

| Variable | Rango | Sonido | Parámetro | Rango del parámetro | τ (s) |
|---|---|---|---|---|---|
| Q_t + Q_v | 0 – 3 hm³/h | Rumor del agua (ruido marrón + pasabanda) | Volumen | 0,03 – 0,58 | 0,10 |
| Q_t + Q_v | 0 – 3 hm³/h | Rumor del agua | Frecuencia central del filtro | 300 – 1200 Hz | 0,20 |
| P | 0 – 150 MW | Zumbido eléctrico (100/200/300 Hz) | Volumen | 0,015 – 0,105 | 0,10 |
| P | 0 – 150 MW | Zumbido eléctrico | Tono fundamental | 100 – 112 Hz | 0,15 |
| D − P | > max(2 MW, 5 % D) | Alerta | Ritmo (doble pitido cada 0,9 s) | encendido/apagado | — |
| V (propuesta día 2) | 0 – 50 hm³ | Tono de nivel muy suave | Tono | 200 – 600 Hz (sube con V) | 0,03 |

Prueba a ciegas (sección 5.7): con la pantalla tapada, al dar un escalón de u_t el rumor sube de volumen y se vuelve más agudo; el zumbido sigue a P. Un primer orden no tiene sobreimpulso, así que lo que se debe reconocer es la **dirección** y la **rapidez**.

## 5. Mezcla (cuatro canales)

| Canal | Volumen relativo | Contenido |
|---|---|---|
| Música | 0,35 | Pistas en bucle; baja un 40 % (ducking, τ = 0,05 s) con las alarmas de prioridad alta y se recupera a los 300 ms |
| Efectos | 0,80 | Actuadores, perturbaciones y eventos del modelo; detune ±100 cents, máximo 3 instancias simultáneas del mismo efecto |
| Interfaz | 0,60 | Menús y calibración |
| Sonificación | 0,70 | Rumor, zumbido y alerta (síntesis continua) |

Las alarmas de prioridad alta siempre se oyen sobre la música. Los volúmenes se guardan en `localStorage` (dentro de `try/catch`). Silencio general: tecla **M** / botón Select (hoy la tecla A silencia la sonificación y la M abre el menú: hay que resolver el conflicto en la etapa 7).

## 6. Formatos y presupuesto

| Elemento | Formato y calidad | Duración | Fuente sugerida |
|---|---|---|---|
| Música (5 pistas) | OGG y MP3, 96 kbps, estéreo, en bucle | 30 a 90 s | Gemini (Música), Kenney u OpenGameArt |
| Efectos de actuadores y perturbaciones | OGG y MP3, 64 kbps, mono | 0,1 a 1 s | jsfxr o Freesound (CC0) |
| Efectos de eventos del modelo y alarmas | OGG y MP3, 64 kbps, mono | 0,1 a 1 s | jsfxr, un sonido distinto por evento |
| Sonificación | Web Audio API (oscilador, ruido y filtro) | Continua | Sin archivo |
| Interfaz | OGG y MP3, 64 kbps, mono | 0,05 a 0,3 s | jsfxr (Blip/Select) o Kenney UI Audio |
| **Total de `public/assets/audio`** | **Máximo 8 MB** | — | Estimado: 5 pistas × 60 s × 0,7 MB/min × 2 formatos ≈ 7 MB; efectos < 0,5 MB → recortar pistas a 45 s si se pasa |

## 7. Origen y licencia de cada archivo

| Evento del juego | Archivo | Fuente y licencia | Duración (s) |
|---|---|---|---|
| Rumor del agua, zumbido, alerta de déficit | — (síntesis en `Sonido.js`) | Creación propia, código del proyecto | Continua |
| Alarmas de rebose y cavitación | — (síntesis en `Alarmas.js`) | Creación propia | 0,25 / 0,3 |
| Trueno | — (síntesis en `Efectos.js`) | Creación propia | 1,4 |
| ✏️ Música de menú | `musica_menu.mp3` | ✏️ Gemini Música (SynthID) / Kenney CC0 | ✏️ |
| ✏️ Música de operación | `musica_operacion.mp3` | ✏️ | ✏️ |
| ✏️ Música de tormenta | `musica_tormenta.mp3` | ✏️ | ✏️ |
| ✏️ Música de nivel superado | `musica_superado.mp3` | ✏️ | ✏️ |
| ✏️ Música de nivel fallido | `musica_fallido.mp3` | ✏️ | ✏️ |
| ✏️ Cada efecto de las secciones 2 y 3 | `sfx_*.wav` | ✏️ jsfxr (sfxr.me, dominio público) / Freesound CC0 | ✏️ |

Los archivos que exijan atribución (CC-BY) se mencionan en una pantalla de créditos. La música de Gemini lleva la marca de agua SynthID y la herramienta es para mayores de 18 años: revisar las condiciones de uso de Google antes de publicar el juego fuera del aula.
