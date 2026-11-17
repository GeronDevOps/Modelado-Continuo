# Documentación SimJam — Represa hidroeléctrica

| Archivo | Contenido | Día |
|---|---|---|
| `docs/diseno.md` | Documento de diseño del juego (sección 13: día 2) | 1 y 2 |
| `docs/modelo.md` | Modelo, EDO, G(s), espacio de estados, línea base | 1 y 2 |
| `docs/niveles.md` | Niveles 1–3 rediseñados (tutorial, tormenta con recuperación, despacho de carga) y programación de perturbaciones | 1, 2 y rediseño |
| `docs/informe.md` | Verificación, gestos, identificación, sensibilidad, postmortem | 1 (+ resumen día 2) |
| `docs/recursos.md` | Especificación de sprites y mapa variable → representación | 2 |
| `docs/audio.md` | Música, efectos, sonificación, mezcla y licencias | 2 |
| `docs/pruebas_dia2.md` | Tablas de las secciones 5.1, 5.5, 5.7 y 5.8 de la guía del día 2 | 2 |
| `docs/linea_base_escalon.csv` | Línea base de la respuesta al escalón (t, u, y, P) | 2 |
| `docs/niveles_linea_base.json` | Parámetros del modelo y de los niveles antes del día 2 (se usa para comprobar que el modelo no cambió) | 2 |
| `docs/niveles_linea_base_v2.json` | Parámetros de los niveles después del rediseño | rediseño |
| `PROMPTS.md` | Prompts usados con IA | 1 y 2 |
| `analisis/generar_linea_base.mjs` | Genera la línea base con el integrador del juego | 2 |
| `analisis/regresion.py` | Compara CSV de escalón con la línea base | 2 |
| `analisis/regresion_headless.txt` | Salida de la regresión a 15 y 144 FPS | 2 |
| `analisis/simular_niveles.mjs` | Simula los 3 niveles sin interfaz con jugadores sintéticos (`node analisis/simular_niveles.mjs`) | rediseño |
| `analisis/generar_linea_base_niveles.mjs` | Regenera `docs/niveles_linea_base_v2.json` cuando se cambian los niveles a propósito | rediseño |
| `vensim/` | Modelo de Vensim y capturas | 1 |

La prueba automática del día 2 está en `tests/regresion.test.js` del repositorio y corre con `npm test`; las reglas de los niveles rediseñados se prueban en `tests/niveles.test.js` y `tests/fase3.test.js`. El ensayo en el navegador se abre con `http://localhost:5173/?control=escalon` (descarga `dia2_escalon.csv`).

