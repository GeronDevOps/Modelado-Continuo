"""Identificación del modelo de la represa a partir de partida_represa.csv (guía 5.10).

Modelo a ajustar (tiempo de juego, s):   dV/dt = b*(Q_rio - Q_t - Q_v) - a*V
  valores esperados:  b = 1/5 = 0.2  [(hm3/s)/(hm3/h)]   a = 0.002/5 = 4e-4 [1/s]
  (en horas simuladas:  b_h = 1,  a_h = 0.002 1/h)
Además:  P = c*H*Q_t   (c esperado = 2.45 MW/(m*hm3/h)),   H = h0 + m*V (esperado 20 y 0.8)

Uso:  python analisis/identificar_represa.py docs/ident_1.csv docs/valid_1.csv
Método: forma integral  V(t)-V(0) = b*∫u_net dt - a*∫V dt  -> mínimos cuadrados lineales
(evita derivar datos ruidosos). Solo usa numpy, pandas, scipy y matplotlib."""
import sys
import numpy as np, pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.integrate import cumulative_trapezoid as cumtrapz

B_ESP, A_ESP = 0.2, 0.002/5

def cargar(ruta):
    d = pd.read_csv(ruta)
    t = np.arange(d["t"].iloc[0], d["t"].iloc[-1], 1/30)        # paso uniforme 30 Hz
    g = lambda c: np.interp(t, d["t"], d[c])
    un = g("Q_rio") - g("Q_t") - g("Q_v")                        # caudal neto de entrada [hm3/h]
    return t - t[0], un, g("V"), g("H"), g("Q_t"), g("P")

def ajustar(t, un, V):
    X = np.column_stack([cumtrapz(un, t, initial=0), -cumtrapz(V, t, initial=0)])
    y = V - V[0]
    (b, a), *_ = np.linalg.lstsq(X, y, rcond=None)
    # incertidumbre (desviación estándar) de los coeficientes
    res = y - X @ np.array([b, a]); s2 = res @ res / (len(y) - 2)
    cov = s2 * np.linalg.inv(X.T @ X)
    return b, a, np.sqrt(np.diag(cov))

def simular(b, a, t, un, V0):
    """RK4 con la entrada interpolada (paso 1/30 s)."""
    V = np.empty_like(t); V[0] = V0
    for k in range(len(t) - 1):
        h = t[k+1]-t[k]; u0, u1 = un[k], un[k+1]; um = (u0+u1)/2
        f = lambda v, u: b*u - a*v
        k1=f(V[k],u0); k2=f(V[k]+h*k1/2,um); k3=f(V[k]+h*k2/2,um); k4=f(V[k]+h*k3,u1)
        V[k+1] = V[k] + h*(k1+2*k2+2*k3+k4)/6
    return V

def metricas(y, ym):
    rmse = np.sqrt(np.mean((y-ym)**2))
    r2 = 1 - np.sum((y-ym)**2)/np.sum((y-np.mean(y))**2)
    return rmse, r2

ruta_id = sys.argv[1] if len(sys.argv) > 1 else "docs/ident_1.csv"
ruta_va = sys.argv[2] if len(sys.argv) > 2 else "docs/valid_1.csv"

t, un, V, H, Qt, P = cargar(ruta_id)
b, a, sd = ajustar(t, un, V)
print(f"b = {b:.5f} ± {sd[0]:.5f}   (esperado {B_ESP})  error rel = {abs(b-B_ESP)/B_ESP:.2%}")
print(f"a = {a:.6f} ± {sd[1]:.6f}  (esperado {A_ESP})  error rel = {abs(a-A_ESP)/A_ESP:.2%}")
print(f"  -> en horas simuladas: b_h = {b*5:.4f} (esp. 1.0), k_perd = {a*5:.5f} 1/h (esp. 0.002)")
print(f"  -> tau identificado = {1/a:.0f} s de juego = {1/a/5:.0f} h  (esperado 2500 s = 500 h)" if a > 0 else "  -> a <= 0: pérdidas no identificables con estos datos")
print(f"  -> T_exc/tau = {t[-1]*a:.3f}  (la guía pide >= 4 para un 1.er orden; aquí es << 1: ver informe)")

# Relación algebraica P = c*H*Qt y H = h0 + m*V
m_, h0 = np.polyfit(V, H, 1)
c = np.linalg.lstsq((H*Qt)[:, None], P, rcond=None)[0][0]
print(f"H = {h0:.3f} + {m_:.4f}*V  (esperado 20 + 0.8 V)")
print(f"P = {c:.4f} * H * Q_t     (esperado 2.45)")

for nombre, ruta in [("identificacion", ruta_id), ("validacion", ruta_va)]:
    tv, unv, Vv, *_ = cargar(ruta)
    Vm = simular(b, a, tv, unv, Vv[0])
    rmse, r2 = metricas(Vv, Vm)
    print(f"{nombre}: RMSE = {rmse:.4f} hm3   R2 = {r2:.4f}   {'(cumple R2>=0.90)' if r2>=0.90 else '(NO cumple R2>=0.90)'}")
    plt.figure(figsize=(7,3.5)); plt.plot(tv, Vv, label="juego"); plt.plot(tv, Vm, "--", label="modelo identificado")
    plt.xlabel("t (s de juego)"); plt.ylabel("V (hm³)"); plt.title(f"{nombre} (R² = {r2:.4f})"); plt.legend(); plt.tight_layout()
    plt.savefig(f"analisis/{nombre}.png", dpi=150); plt.close()
