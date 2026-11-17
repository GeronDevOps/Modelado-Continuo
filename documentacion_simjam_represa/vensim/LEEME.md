# Archivos de Vensim

- `represa.mdl`: ecuaciones, parámetros de simulación y un diagrama de variables con flechas de influencia.


Archivos generados como texto, sin abrirlos en Vensim. Antes de usarlos:

1. Abre el archivo en Vensim PLE y ejecuta **Model → Check Model** (debe decir "Model is OK").
2. En **Model → Settings**, elige *Integration Type* = **Runge-Kutta 4** (de paso fijo si tu versión lo ofrece); el archivo no lo fija.
3. Comprueba INITIAL TIME = 0, FINAL TIME = 20, TIME STEP = 0.01, unidades Hour.
4. Con **Simulate**, revisa que Potencia_Generada en t = 0 sea ≈ 47,4 MW y que con el escalón de −0,1 en u_t a las 2 h, V(20 h) debe quedar ≈ 30 + 1.77 = 31.77 hm³ (la fórmula −19,61·Δu_t de `modelo.md` supone el escalón en t = 0).
5. El diagrama es de tipo causal con el nivel dibujado como caja. Para el Forrester de la entrega, reemplaza las flechas de los flujos por válvulas (herramienta *Rate*) y nubes; las ecuaciones no cambian. Marca los ciclos R1, B1, B2, B3 con la herramienta de ciclos y toma las capturas.
6. Exporta la salida a CSV (*Export Simulation Results*) como `docs/vensim_escalon.csv`.
