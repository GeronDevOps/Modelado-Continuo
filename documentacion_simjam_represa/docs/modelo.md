# Modelo de "Aislados en la Patagonia: Balance Hídrico"

Simulador N.º 3 (Represa hidroeléctrica) · SimJam de Modelado y Simulación de Sistemas Continuos (167414)

> **Correcciones respecto al borrador anterior** (detectadas en la revisión crítica, sección 9):
> 1. La constante de tiempo en pantalla es **τ = 500 h × 5 s/h = 2500 s** de juego (no 0,694 s, que mezclaba unidades).
> 2. El ciclo "B2" del borrador es en realidad de **refuerzo (R1)**: tiene dos enlaces negativos.
> 3. La relación Q_t → P es (+) y P → Error es (−); en el borrador la polaridad estaba invertida.
> 4. El rango de P_demanda implementado es 30–120 MW (no 10–120).

## 1. Variables (tabla entrada-proceso-salida con unidades)

| Tipo | Símbolo | Significado en el juego | Unidad | Rango |
|---|---|---|---|---|
| Entrada 1 (gesto) | u_t(t) | Apertura de compuertas de turbinas (altura de la muñeca derecha) | adim. | [0, 1] |
| Entrada 2 (gesto) | u_v(t) | Apertura del vertedero (puño derecho: mando on/off; la compuerta sigue el mando a 0,5 s⁻¹) | adim. | [0, 1] |
| Perturbación | Q_río(t) | Caudal de entrada (lluvia, deshielo, tormenta) | hm³/h | 0,5 – 2,5 |
| Estado | V(t) | Volumen almacenado en el embalse | hm³ | 0 – 50 (físico; puede cruzar para detectar falla) |
| Salida visible | y(t) = V(t) | Nivel del agua en pantalla | hm³ | 0 – 50 |
| Salida auxiliar | H(t) | Cabeza hidráulica | m | 20 – 60 |
| Salida auxiliar | P(t) | Potencia eléctrica generada | MW | 0 – 147 |
| Referencia (lazo) | P_demanda(t) | Demanda de la red regional | MW | 30 – 120 |

Parámetros: K_t = 1,0 hm³/(h·u) · K_v = 2,0 hm³/(h·u) · k_perd = 0,002 h⁻¹ · V₀ = 30 hm³ · escala temporal 1 h de planta = 5 s de juego.

## 2. Diagrama causal y de Forrester (Vensim PLE)

### 2.1 Diagrama causal (el jugador es el controlador)

```
                 (+)                (+)               (+)
  Error ───────────────► u_t ─────────────► Q_t ─────────────► P
  (P_dem − P)             ▲                  │ (−)               │ (+ al H·Q_t)
     ▲ (+ P_dem)          │ jugador          ▼                   │
     │                    │             Volumen V ──(+)──► H ────┘
     └──────(−)───────────┼──────────────────┘                    (H también → P, (+))
                          │
   Q_río ──(+)──► V ◄─(−)── Q_perd = k·V ◄──(+)── V        (auto-filtración)
   V alto ──(alarma)──► u_v ──(+)──► Q_v ──(−)──► V         (vigilancia del jugador)
```

Polaridades: Q_río→V (+); Q_t→V (−); Q_v→V (−); V→Q_perd (+); Q_perd→V (−); V→H (+); H→P (+); Q_t→P (+); P→Error (−); P_dem→Error (+); Error→u_t (+, el jugador sube la mano); u_t→Q_t (+).

### 2.2 Ciclos

| Ciclo | Camino | Enlaces (−) | Tipo | Interpretación |
|---|---|---|---|---|
| **B1** Control de potencia | Error → u_t → Q_t → P → Error | 1 (P→Error) | **Balance** | El jugador iguala P a la demanda. |
| **B2** Auto-filtración | V → Q_perd → V | 1 | **Balance** | Más volumen, más pérdidas. |
| **B3** Vigilancia del vertedero | V → (alarma) → u_v → Q_v → V | 1 (Q_v→V) | **Balance** | Si V sube, el jugador abre el vertedero. |
| **R1** Cabeza hidráulica | V → H → P → Error → u_t → Q_t → V | 2 (P→Error, Q_t→V) | **Refuerzo** | Más volumen → más H → más P → el jugador cierra → V sigue subiendo. Explica por qué el embalse "se escapa" si no se vigila. |

### 2.3 Diagrama de Forrester

- **Nivel:** `Embalse_Volumen` (V) [hm³], inicial 30.
- **Flujos:** `Entrada_Rio` (Q_río), `Salida_Turbinas` (Q_t = K_t·u_t), `Salida_Vertedero` (Q_v = K_v·u_v), `Perdida_Filtracion` (k_perd·V), todos en hm³/h.
- **Auxiliares:** `Cabeza_Hidraulica` = 20 + 0,8·V; `Potencia_Generada` = 2,45·H·Q_t; `Apertura_Turbina`, `Apertura_Vertedero`.
- **Constantes:** `K_t` = 1,0; `K_v` = 2,0; `k_perdida` = 0,002.

Ecuaciones para escribir en Vensim PLE:

```
Embalse_Volumen = INTEG(Entrada_Rio - Salida_Turbinas - Salida_Vertedero - Perdida_Filtracion, 30)
Entrada_Rio = 0.5
Salida_Turbinas = K_t * Apertura_Turbina
Salida_Vertedero = K_v * Apertura_Vertedero
Perdida_Filtracion = k_perdida * Embalse_Volumen
Cabeza_Hidraulica = 20 + 0.8 * Embalse_Volumen
Potencia_Generada = 2.45 * Cabeza_Hidraulica * Salida_Turbinas
Apertura_Turbina = 0.44 + STEP(-0.1, 2)      ~ escalón de prueba (ajusta al usado en tu CSV)
Apertura_Vertedero = 0
K_t = 1 ; K_v = 2 ; k_perdida = 0.002
INITIAL TIME = 0 ; FINAL TIME = 20 ; TIME STEP = 0.01 ; Units: Hour ; Integration: RK4
```

> ✏️ Guardar el `.mdl` en `docs/`, insertar las capturas del causal (con R/B) y del Forrester, y exportar `docs/vensim_escalon.csv`.
> Equivalencia: FINAL TIME = 20 h simuladas = 100 s de juego.

## 3. EDO y punto de operación

Balance de masa:

```
dV/dt = Q_río − Q_t − Q_v − k_perd·V          [hm³/h]
```

En tiempo de juego (1 h = 5 s): `dV/dt_juego = (1/5)·[Q_río − K_t·u_t − K_v·u_v − 0,002·V]` [hm³/s].

Algebraicas: `H = 20 + 0,8·V` [m] · `P = 2,45·H·Q_t` [MW] (no lineal: producto H·Q_t).

Homogeneidad de unidades: hm³/h = hm³/h − hm³/h − hm³/h − (h⁻¹·hm³). ✔

**Punto de operación:** V₀ = 30 hm³, Q_río,0 = 0,5 hm³/h, u_v,0 = 0.
0,5 − Q_t,0 − 0,002·30 = 0 ⇒ **Q_t,0 = 0,44 ⇒ u_t,0 = 0,44**. Entonces H₀ = 44 m y **P₀ = 2,45·44·0,44 = 47,43 MW**.

Linealización (desviaciones ΔV = V − 30, Δu_t = u_t − 0,44):

```
dΔV/dt + 0,002·ΔV = −1,0·Δu_t + ΔQ_río − 2,0·Δu_v
```

## 4. Función de transferencia G(s)

Con ΔV(0) = 0: (s + 0,002)·ΔV(s) = −ΔU_t(s), por tanto

```
G(s) = ΔV(s)/ΔU_t(s) = −1/(s + 0,002) = −500/(500·s + 1)        (s en h⁻¹)
```

Para Q_río: G_d(s) = +1/(s + 0,002). Para u_v: G_v(s) = −2/(s + 0,002).

## 5. Espacio de estados

x = V, u = [u_t, u_v]ᵀ, d = Q_río, y = V:

```
A = [−0,002]     B = [−1,0  −2,0]     E = [1,0]     C = [1,0]     D = [0  0]
```

Dimensiones: A 1×1, B 1×2, E 1×1, C 1×1, D 1×2. ✔ Es la forma programada en `src/modelo/SistemaContinuo.js` (RK4, paso fijo h = 1/120 s). En tiempo de juego, A = −0,0004 s⁻¹ y B, E se dividen entre 5.

## 6. Polos, estabilidad y respuesta esperada al escalón

| Magnitud | En horas simuladas | En tiempo de juego |
|---|---|---|
| Polo | s₁ = −0,002 h⁻¹ | s₁ = −0,0004 s⁻¹ |
| Ganancia K | −500 hm³ por unidad de u_t | igual |
| Constante de tiempo τ | 500 h | **2500 s** (= 500 h × 5 s/h) |
| Tiempo de establecimiento (2 %) 4τ | 2000 h | 10 000 s |
| Sobreimpulso Mp | 0 % (1.er orden) | 0 % |

- **Estabilidad:** polo único con Re(s) < 0 ⇒ asintóticamente estable (BIBO). Con el actuador saturado y el vertedero on/off, el sistema completo es no lineal pero acotado por las saturaciones físicas.
- **Respuesta al escalón:** ΔV(t) = −500·(1 − e^(−0,002·t))·Δu_t. A t = 20 h: ΔV = −19,61·Δu_t (para Δu_t = +0,1: −1,96 hm³).
- **Lectura en pantalla:** la partida dura 24 h simuladas ≈ 0,048·τ. El embalse se comporta casi como un **integrador puro** (dV/dt ≈ Q_río − Q_t − Q_v − 0,002·V): la mano fija la **tasa de cambio**, no el nivel; los errores se acumulan y exigen anticipación y lazo cerrado.

## 7. Niveles

Parámetros, perturbaciones y criterios: ver `docs/niveles.md` (copia fiel de la configuración en `src/config/constantes.js`). Todos los niveles se aprueban con 10 s continuos calibrados (V en 30 ± 3 y potencia en tolerancia).

## 8. Escala física → pantalla

| Magnitud física | Representación | Escala |
|---|---|---|
| Tiempo | 1 h de planta = 5 s de juego; 1 día = 120 s | 1 s de juego = 12 min reales (factor 720) |
| V (0–50 hm³) | altura del agua: `y` y `scaleY` con máscara de recorte | altura = (V/50)·180 px: superficie de y = 490 px (vacío) a y = 310 px (lleno) en `JuegoScene.js` |
| H (20–60 m) | manómetro | aguja lineal en 20–60 m |
| u_t (0–1) | barra y animación de compuerta | 0–100 % |
| Q_t | opacidad/intensidad del chorro de turbinas | ∝ Q_t |
| u_v | torrente del vertedero | visible si u_v = 1 |
| Q_río | color del agua | #1c5270 → #00a896, interpolado entre 0,5 y 2,5 |
| Paso de integración | h = 1/120 s; `integrarDt` divide cada cuadro en pasos de h más un residuo | independiente de los FPS (comprobado a 15, 60 y 144 FPS en `tests/regresion.test.js`) |

## 9. Revisión crítica

1. **Unidades:** todos los términos de dV/dt están en hm³/h. ✔
2. **Signos:** Q_río (+), Q_t, Q_v y k_perd·V (−). ✔
3. **EDO ↔ G(s):** (s + 0,002)·ΔV = −ΔU_t ⇒ G(s) = −1/(s + 0,002). ✔
4. **Matrices:** dimensiones consistentes (ver sección 5). ✔
5. **Polo:** −0,002 h⁻¹, estable. ✔
6. **Factibilidad de potencia:** P_max(V) = 2,45·(20 + 0,8·V) con u_t = 1. En V = 30 es 107,8 MW; 120 MW exige V ≥ 36,2 hm³; el máximo absoluto (V = 50) es 147 MW.
7. **Actuador:** el límite de velocidad de u_t (0,20 s⁻¹) y de u_v (0,50 s⁻¹) agrega un retardo no lineal al lazo; no está en la G(s), pero sí en el juego.

## 10. Verificación numérica de referencia

Resultados del script independiente `analisis/verificacion_numerica.py` (h = 1/120 s, 120 s de juego):

| Prueba | Resultado |
|---|---|
| Equilibrio V₀ = 30, Q_río = 0,5, u_t = 0,44 | dV/dt = 0; H = 44 m; P = 47,432 MW |
| RK4 vs analítica (u_t = 0, u_v = 0, Q_río = 0,5) | error máx 4,4·10⁻¹³ hm³ (Euler: 1,7·10⁻⁵) |
| Con u_t = 0, u_v = 0, Q_río = 0,5 | V sube de 30 a 40,31 hm³ en 24 h |

Ver `docs/informe.md` para la tabla completa.

## 11. Línea base para el día 2

`docs/linea_base_escalon.csv` (generado con `analisis/generar_linea_base.mjs`): escalón u_t = 0,44 → 0,46 en t = 2 s, 15 000 s de juego (6τ). Valor final teórico 30 − 500·0,02 = 20 hm³; tiempo de subida teórico 10–90 % = τ·ln 9 = 5493 s. El script `analisis/regresion.py` mide sobre el CSV 20,034 hm³ y 5418,7 s, porque toma como valor final el promedio del último 10 % de la simulación, que todavía no llegó del todo a 20. Las comparaciones del día 2 usan esas mismas métricas, así que la diferencia no afecta la regresión.

En el juego, el mismo ensayo se corre con `?control=escalon` (`src/juego/modoEscalon.js`); el parámetro `vel` entrega más tiempo de juego por cuadro, pero `integrarDt` lo sigue dividiendo en pasos de h = 1/120 s, así que la solución de la EDO no cambia (comprobado a 60 y 15 FPS, ver `docs/pruebas_dia2.md`).
