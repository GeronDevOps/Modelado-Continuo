# Documentación SimJam — Represa hidroeléctrica

| Archivo | Contenido | Día |
|---|---|---|
| `docs/diseno.md` | Documento de diseño del juego (sección 13: día 2) | 1 y 2 |
| `docs/modelo.md` | Modelo, EDO, G(s), espacio de estados, línea base | 1 y 2 |
| `docs/niveles.md` | Niveles 1–3 (calibración de 10 s) y programación de perturbaciones | 1 y 2 |
| `docs/informe.md` | Verificación, gestos, identificación, sensibilidad, postmortem | 1 (+ resumen día 2) |
| `docs/recursos.md` | Especificación de sprites y mapa variable → representación | 2 |
| `docs/audio.md` | Música, efectos, sonificación, mezcla y licencias | 2 |
| `docs/pruebas_dia2.md` | Tablas de las secciones 5.1, 5.5, 5.7 y 5.8 de la guía del día 2 | 2 |
| `docs/linea_base_escalon.csv` | Línea base de la respuesta al escalón (t, u, y, P) | 2 |
| `docs/niveles_linea_base.json` | Parámetros del modelo y de los niveles antes del día 2 | 2 |
| `PROMPTS.md` | Prompts usados con IA | 1 y 2 |
| `analisis/generar_linea_base.mjs` | Genera la línea base con el integrador del juego | 2 |
| `analisis/regresion.py` | Compara CSV de escalón con la línea base | 2 |
| `analisis/regresion_headless.txt` | Salida de la regresión a 15 y 144 FPS | 2 |
| `vensim/` | Modelo de Vensim y capturas | 1 |

La prueba automática del día 2 está en `tests/regresion.test.js` del repositorio y corre con `npm test`. El ensayo en el navegador se abre con `http://localhost:5173/?control=escalon` (descarga `dia2_escalon.csv`).

Convención de los datos: **[auto]** = medido sin interfaz en el repositorio; **[ref]** = calculado con los scripts o el modelo; **[sim]** = **dato simulado** (valor plausible y coherente con el modelo, puesto para completar las tablas). Antes de la entrega, reemplazar cada **[sim]** por la medición real jugando: resultados del nivel 1, FPS, aciertos de gestos, sonificación a ciegas, capturas antes/después, CSV `dia2_escalon*.csv` descargados del navegador, ZIP y video.
