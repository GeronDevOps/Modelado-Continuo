"""Genera CSV SINTÉTICOS (modelo + ruido de sensor) para PROBAR identificar_represa.py.
NO son datos de partida: no se entregan como ident_1.csv / valid_1.csv reales."""
import numpy as np, pandas as pd
rng = np.random.default_rng(7)
ESC, KP = 5.0, 0.002

def partida(guion, qrio_fun, T=120, h=0.1, V0=30.0, ruido=0.0):
    n=int(T/h); t=np.arange(n+1)*h; V=V0; u=0.0; filas=[]
    for ti in t:
        ref=guion(ti); u+=np.clip(ref-u,-0.2*h,0.2*h)       # actuador: 0.2 1/s
        uv=0.0; qr=qrio_fun(ti); qt=1.0*u; qv=2.0*uv
        H=20+0.8*V; P=2.45*H*qt
        filas.append(dict(t=round(ti,3),u_t=u,u_v=uv,Q_rio=qr,V=V+rng.normal(0,ruido),H=H,Q_t=qt,Q_v=qv,P=P,P_demanda=47.4))
        # RK4 con paso h (u constante en el paso)
        f=lambda v:(qr-qt-qv-KP*v)/ESC
        k1=f(V);k2=f(V+h*k1/2);k3=f(V+h*k2/2);k4=f(V+h*k3); V+=h*(k1+2*k2+2*k3+k4)/6
    return pd.DataFrame(filas)

# Ensayo de identificación (guía 5.10): reposo, apertura máx, regreso, mitad
def g_ident(t):
    if t<10: return 0.0
    if t<40: return 1.0
    if t<60: return 0.0
    if t<90: return 0.5
    return 0.0
# Validación: partida "normal" con tormenta
def g_valid(t): return 0.44 + 0.25*np.sin(2*np.pi*t/40)
qr_const=lambda t:0.5
qr_storm=lambda t:2.5 if 30<=t<90 else 0.5

partida(g_ident,qr_const,ruido=0.02).to_csv("analisis/sinteticos/ident_sintetico.csv",index=False)
partida(g_valid,qr_storm,ruido=0.02).to_csv("analisis/sinteticos/valid_sintetico.csv",index=False)
print("OK: analisis/sinteticos/ident_sintetico.csv, analisis/sinteticos/valid_sintetico.csv")
