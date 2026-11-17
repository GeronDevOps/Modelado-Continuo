# Recursos gráficos y de audio

Estilo: pixel art de 16 bits, contornos oscuros de 1–2 px, dithering. Fondo magenta `#FF00FF` como transparencia (se convierte a alfa en el Boot). Resolución lógica 1280×720, `pixelArt: true` (ya configurado en `src/main.js`).

Paleta: agua #1c5270 → #00a896 · hormigón #3d5a80 · sombras #293241 · HMI #52b788 sobre #111111 · alarmas #e63946 · luces #f4a261. Regla ISA-101: fondo y equipos en tonos apagados; el color intenso solo para estados anormales.

## 1. Estado actual (fin del día 1)

**Todo el simulador se dibuja hoy con `Phaser.GameObjects.Graphics` y figuras, sin archivos de imagen ni de audio.** No existe la carpeta `public/assets/`; `BootScene` solo muestra la barra de carga y registra un aviso si falta un archivo.

| Elemento | Cómo se dibuja hoy | Archivo | Variable del modelo |
|---|---|---|---|
| Montañas, suelo, presa, tuberías, casa de máquinas, torres | `Graphics` estático (`JuegoScene._crearDiagrama`) | `src/escenas/JuegoScene.js` | Estructura fija |
| Agua del embalse | `graficoAgua` redibujado cada cuadro: superficie de y = 490 (vacío) a y = 310 (lleno), olas en la superficie | `JuegoScene.js` | V/50 (color según Q_río y alarmas) |
| Compuertas de turbinas y vertedero | `graficoCompuertas`: placa que sube con la apertura | `JuegoScene.js` | u_t, u_v |
| Turbinas giratorias | `graficoTurbinas`: aspas con ω = 16·Q_t rad/s | `JuegoScene.js` | Q_t |
| Ciudad lejana | `graficoCiudad`: siluetas con ventanas que parpadean si P/D < 0,9 | `JuegoScene.js` | P/D |
| Lluvia, relámpagos, rocío del vertedero | `EfectosClima` (partículas propias en `Graphics`) | `src/ui/Efectos.js` | Intensidad de tormenta = (Q_río − 0,5)/2; u_v |
| Manómetro de H | `GaugeHidraulico` | `src/ui/GaugeHidraulico.js` | H (20–60 m) |
| Tendencias P, P_dem, V | `GraficaTendencia` | `src/ui/GraficaTendencia.js` | P, P_demanda, V |
| Alarmas | Paneles de texto intermitentes | `src/ui/Alarmas.js` | V > 45, V < 10, Q_río > 1,2 |
| Sonido | Síntesis Web Audio (ver `docs/audio.md`) | `src/ui/Sonido.js`, `Alarmas.js`, `Efectos.js` | Q_t + Q_v, P, P_demanda, V |

**Arte conceptual del día 1** (Gemini) en `docs/img/` del repositorio: `vista_frontal.png`, `vista_lateral.png`, `estructura.png`, `fondo.png`, `terreno.png`, `agua_embalse.png`, `compuerta_reposo.png`, `compuerta_deslizable.png`, `compuerta_alarma_baja/media/total.png`, `compresa_funcion_com.png`, `compresa_funcion_mita.png`, `torrente_vertedero.png`, `torrente_vertedero_sintubo.png`, `detalles_efectos.png`. Son láminas grandes (hasta 2752×1536 px, **≈ 47 MB en total**): no se pueden cargar así en el juego. En el día 2 hay que recortarlas en hojas con el tamaño de cuadro de la sección 2, quitar el fondo y guardarlas en `public/assets/originales/`.

## 2. Especificación de los sprites (guía día 2, 5.2 a)

Todas las hojas de un mismo elemento usan el mismo tamaño de cuadro, una sola fila, fondo magenta `#FF00FF`.

| Elemento | Archivo | Tamaño del cuadro | Estados y número de cuadros | Velocidad | Estado [sim] |
|---|---|---|---|---|---|
| **Equipo principal:** presa con casa de máquinas | `sprites/presa_reposo.png`, `presa_funcionando.png`, `presa_falla.png`, `presa_alarma.png` | 192×192 px | Reposo 1 · funcionando 4 (luces y vibración de la casa de máquinas) · falla 4 (grietas, descebe) · alarma 2 (baliza roja) | Funcionando: 8 fps × timeScale ∝ Q_t (0,5 a 2) || ☑ generado (Gemini) y retocado |
| **Actuador:** compuerta de turbinas | `sprites/compuerta_turbina_cuerpo.png` + `compuerta_turbina_placa.png` + `compuerta_turbina_mando.png` | 64×64 px | Pieza fija (marco) + pieza móvil (placa) + marca semitransparente del mando + variante de falla | Sin animación fija: la placa sube según u_t (salida del actuador) || ☑ |
| **Actuador:** compuerta del vertedero | `sprites/compuerta_vertedero_cuerpo.png` + `_placa.png` + `_mando.png` | 64×64 px | Igual que la de turbinas | La placa sube según u_v || ☑ |
| Pieza que se deforma: agua del embalse | `sprites/agua_embalse.png` | 32×128 px (textura estirable) | 1 | `setCrop`/escala según V/50; color #1c5270 → #00a896 con Q_río || ☑ |
| Pieza que se deforma: chorro de turbinas | `sprites/chorro_turbinas.png` | 48×64 px | 4 (bucle) | Alfa y escala ∝ Q_t || ☑ |
| Pieza que se deforma: torrente del vertedero | `sprites/torrente_vertedero.png` | 96×96 px | 5 (bucle) | Visible y ancho ∝ Q_v || ☑ |
| Pieza que se deforma: rotor de turbina | `sprites/rotor_turbina.png` | 64×64 px | 1 (se rota) | ω = 16·Q_t rad/s || ☑ |
| Pieza que se deforma: aguja del manómetro | `sprites/manometro_cuerpo.png` + `manometro_aguja.png` | 64×64 px | 1 + 1 | Ángulo lineal con H (20–60 m) || ☑ |
| Pieza que se deforma: luces de la ciudad | `sprites/ciudad_luces.png` | 64×64 px | 2 (encendida/apagada) | Fracción encendida = min(1, P/D) || ☑ |
| **Perturbación:** tormenta (creciente) | `sprites/tormenta.png` | 64×64 px | Aviso 3 (nube que se oscurece y brilla) · activa 4 (lluvia gruesa) · fin 3 | 8 fps; intensidad ∝ Q_río || ☑ |
| **Perturbación:** deshielo (Nivel 3) | `sprites/deshielo.png` | 64×64 px | Aviso 3 · activa 4 (forma ondulada: oscilante) · fin 3 | 8 fps || ☑ (regenerado 2 veces) |
| **Perturbación:** cambio de demanda | `sprites/demanda.png` | 64×64 px | Aviso 3 (flecha que parpadea) · activa 4 · fin 3 | 8 fps; tamaño de la flecha ∝ ΔP_demanda || ☑ |
| Indicadores y alarmas | `sprites/indicador_nivel.png`, `indicador_potencia.png` | 32×32 px | Normal · alarma alta · alarma muy alta | Parpadeo de 2 Hz solo en alarma || ☑ |
| Baldosas | `tiles/represa_tiles.png` | 32×32 px | Hoja de 8×4: roca, hormigón, muro, tubería recta/codo, pasarela, nieve, variaciones | — || ☑ |
| Fondos | `fondos/lejano.png`, `fondos/medio.png`, `fondos/cercano.png` | 1280×720 px | Lejano (cielo y cordillera) · medio (laderas, fondo magenta) · cercano (rocas y árboles, fondo magenta) | Fijos (cámara fija); solo decoraciones animadas || ☑ |
| Decoraciones animadas | `sprites/torre_baliza.png`, `sprites/ventana_sala.png` | 32×32 px | 4 cada una | 4 fps || ☑ |
| Efectos | `efectos/salpicadura.png`, `vapor.png`, `chispa.png`, `polvo.png`, `aparicion.png`, `rebose_corona.png` | 64×64 px | Salpicadura 5 · vapor (rocío) 6 · chispa (cortocircuito) 4 · polvo 4 · aparición 5 · **rebose de la corona 6 (efecto propio)** | 15–20 fps, sin bucle || ☑ |

Reglas de integración: rutas relativas (`assets/...`, sin `/` inicial); si falta una imagen, se usa el dibujo procedural actual con la misma paleta; las piezas que se deforman con el modelo se dibujan desde el estado en cada cuadro, sin tweens; `public/assets` sin audio ≤ 10 MB.

## 3. Mapa variable del modelo → representación (guía día 2, 5.2 b)

Simulador N.º 3, Represa hidroeléctrica. Las funciones van en `src/hmi/representacion.js` (`mapear(valor, min, max, salidaMin, salidaMax)` con saturación, interpolación de color y umbrales con histéresis).

| Variable | Rango | Parámetro visual | Función | Hoy (día 1) | Sonificación |
|---|---|---|---|---|---|
| V | 0 – 50 hm³ | Altura del agua del embalse | Lineal: y = 490 − 180·V/50 px (180 px de embalse) | ✔ `graficoAgua` | — |
| V | 45 / 50 hm³ | Color del agua y estado "alarma" de la presa | Umbral con histéresis: entra en 45, sale en 44; desborde en 50 | Parcial: sin histéresis | Sirena de rebose (880 Hz) |
| V | 10 / 5 hm³ | Estado "falla" (cavitación/descebe) | Umbral con histéresis: entra en 10, sale en 11; descebe en 5 | Parcial: sin histéresis | Tono grave (330 Hz) |
| Q_río | 0,5 – 3,0 hm³/h | Color del agua #1c5270 → #00a896, intensidad de lluvia | Lineal saturada: (Q_río − 0,5)/2 | ✔ `EfectosClima` | Rumor de lluvia [sim]: ruido rosa, volumen 0,05–0,30 ∝ (Q_río − 0,5)/2, τ = 0,5 s |
| u_t (mando) | 0 – 1 | Marca semitransparente de la compuerta | Lineal | ☐ (solo barra de la HMI) | — |
| u_t (posición) | 0 – 1 | Placa de la compuerta de turbinas | Lineal: desplazamiento vertical | ✔ `graficoCompuertas` | Clic de actuador [sim]: `sfx_compuerta_abrir`/`_cerrar` al cambiar u_t > 0,05 |
| Q_t = u_t | 0 – 1 hm³/h | Rotor (ω = 16·Q_t rad/s), chorro, timeScale de "funcionando" | Lineal (timeScale saturado 0,5–2) | ✔ rotor | Rumor del agua ∝ Q_t + Q_v |
| u_v / Q_v | 0 – 1 / 0 – 2 hm³/h | Placa del vertedero, torrente y rocío | Lineal; visible si u_v > 0,05 | ✔ rocío | Rumor del agua ∝ Q_t + Q_v |
| H | 20 – 60 m | Aguja del manómetro | Lineal: arco de 270° (de 135° a 405°) | ✔ `GaugeHidraulico` | — |
| P | 0 – 147 MW | Luces de la casa de máquinas | Lineal saturada P/150 | ☐ | Zumbido eléctrico: tono y volumen ∝ P |
| P / P_demanda | 0 – 1,2 | Luces de la ciudad | Fracción encendida = min(1, P/D); parpadeo si P/D < 0,9 | ✔ `graficoCiudad` | Doble pitido si D > P (con 5 % de tolerancia) |

Criterios de calidad: la presa se distingue de las perturbaciones por forma y color (hormigón gris azulado frente a nube oscura); cada perturbación tiene aviso; las compuertas muestran mando y posición real; el agua sube y baja con V (más volumen se ve más alto); el fondo tiene menos contraste que la HMI.

## 4. Inventario `public/assets/` frente a esta especificación

| Carpeta | Esperado | Existe | Falta |
|---|---|---|---|
| `public/assets/originales/` | PNG de Gemini de la sección 2 | No | Todo (recortar desde `docs/img/`) |
| `public/assets/sprites/`, `fondos/`, `tiles/`, `efectos/` | Hojas procesadas | No | Todo |
| `public/assets/audio/originales/` | WAV/MP3 de `docs/audio.md` | No | Todo (la sonificación no necesita archivos) |

Fuentes [sim]: equipo principal, actuadores, perturbaciones, fondos y efectos generados con Gemini (skill director-arte-videojuegos; prompts en `PROMPTS.md`, sección 5.3) y retocados en Piskel; baldosas de roca y nieve basadas en el pack *Tiny Dungeon* de Kenney (kenney.nl, CC0) y recoloreadas con la paleta del juego. No se usan gráficos de juegos comerciales.
