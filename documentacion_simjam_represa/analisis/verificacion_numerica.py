"""Verificación numérica del modelo de la represa (referencia independiente del juego).
Tiempo de juego en s: dV/dt_juego = (1/5)*(Qrio - Kt*ut - Kv*uv - kp*V)."""
import numpy as np
KT, KV, KP, ESC = 1.0, 2.0, 0.002, 5.0

def f(V, ut, uv, qr, kt=KT, kp=KP):
    return (qr - kt*ut - KV*uv - kp*V)/ESC

def rk4(V, ut, uv, qr, h, **k):
    k1=f(V,ut,uv,qr,**k); k2=f(V+h*k1/2,ut,uv,qr,**k)
    k3=f(V+h*k2/2,ut,uv,qr,**k); k4=f(V+h*k3,ut,uv,qr,**k)
    return V+h*(k1+2*k2+2*k3+k4)/6
def euler(V, ut, uv, qr, h, **k): return V+h*f(V,ut,uv,qr,**k)

def analitica(t, V0, ut, uv, qr, kt=KT, kp=KP):
    a=kp/ESC; vss=(qr-kt*ut-KV*uv)/kp
    return vss+(V0-vss)*np.exp(-a*t)

def sim(metodo, V0, ut, uv, qr, T, h):
    n=int(round(T/h)); V=V0; out=[V0]
    for _ in range(n): V=metodo(V,ut,uv,qr,h); out.append(V)
    return np.array(out)

print("== (a) Equilibrio ==")
V0=30; qr=0.5; ut=0.44
dV=(qr-ut-KP*V0); H=20+0.8*V0; P=2.45*H*ut
print(f"dV/dt={dV:.2e} hm3/h  H={H} m  P={P:.3f} MW")

print("\n== (b) Error RK4 y Euler vs analítica, h=1/120 s, T=120 s ==")
h=1/120; T=120; t=np.arange(0,T+h/2,h)
for nombre,(ut_,uv_,qr_) in {"ut=0 uv=0 Qrio=0.5":(0,0,0.5),"ut=1 uv=0 Qrio=0.5":(1,0,0.5),
                              "ut=0.44 uv=0 Qrio=0.5 (equilibrio)":(0.44,0,0.5),
                              "ut=0.5 uv=1 Qrio=2.5":(0.5,1,2.5)}.items():
    ref=analitica(t,30,ut_,uv_,qr_)
    e4=np.max(np.abs(sim(rk4,30,ut_,uv_,qr_,T,h)-ref)); ee=np.max(np.abs(sim(euler,30,ut_,uv_,qr_,T,h)-ref))
    print(f"{nombre:40s} RK4={e4:.3e}  Euler={ee:.3e} hm3  V(120)={ref[-1]:.4f}")

print("\n== (c) ut=0, uv=0, Qrio=0.5 sube ==")
v=sim(rk4,30,0,0,0.5,T,h); print(f"V(0)=30 -> V(120)={v[-1]:.4f} (dV={v[-1]-30:.4f}) ; pendiente inicial={f(30,0,0,0.5)*5:.3f} hm3/h")

print("\n== Parámetros del modelo lineal ==")
print(f"polo (h^-1)=-{KP}  tau_fisica={1/KP:.0f} h  ganancia K=-{1/KP:.0f} hm3/unidad")
print(f"polo (s juego^-1)=-{KP/ESC}  tau_juego={ESC/KP:.0f} s  ts(2%)=4tau={4*ESC/KP:.0f} s juego = {4/KP:.0f} h")
print(f"factor tiempo: 1 s juego = {3600/ESC:.0f} s reales; 120 s juego = {120/ESC:.0f} h")

print("\n== Factibilidad de potencia ==")
for V in (10,30,36.2,45,50):
    print(f"V={V:5.1f}  Pmax(ut=1)={2.45*(20+0.8*V):7.2f} MW")
print(f"V minimo para 120 MW = {((120/2.45)-20)/0.8:.2f} hm3")
print(f"ut para 60 MW en V=30: {60/(2.45*44):.3f}")
print(f"Pmax absoluto (V=50) = {2.45*60:.1f} MW")

print("\n== Tormenta (Nivel 2): sin vertedero, ut=0.44 ==")
# Qrio 0.5 -> 2.5 entre 30 y 90 s
def run(uv_fun, ut=0.44):
    V=30; tt=np.arange(0,120,h); Vmax=V
    for ti in tt:
        qr=2.5 if 30<=ti<90 else 0.5
        V=rk4(V,ut,uv_fun(V),qr,h); Vmax=max(Vmax,V)
    return V,Vmax
print("sin vertedero ut=0.44: V(120)=%.2f Vmax=%.2f"%run(lambda V:0))
print("vertedero si V>40: V(120)=%.2f Vmax=%.2f"%run(lambda V:1 if V>40 else 0))
print("ut=1 sin vertedero: V(120)=%.2f Vmax=%.2f"%run(lambda V:0,ut=1))

print("\n== Sensibilidad (escalón: ut 0->1 a t=2 s con rampa 0.2/s, Qrio=0.5, V0=30, T=120 s) ==")
def escalon(kt=KT,kp=KP,qr=0.5):
    V=30; u=0.0; Vs=[V]
    for ti in np.arange(0,120,h):
        ref=1.0 if ti>=2 else 0.0
        u+=np.clip(ref-u,-0.2*h,0.2*h)
        V=rk4(V,u,0,qr,h,kt=kt,kp=kp); Vs.append(V)
    return np.array(Vs)
base=escalon(); Vb=base[-1]
print(f"Nominal: V(120)={Vb:.4f}  dV={Vb-30:.4f}  Mp=0%  ts(2%) no alcanzado (4tau=10000 s)")
for nom,kw,p0 in [("k_perd",'kp',KP),("K_t",'kt',KT),("Q_rio",'qr',0.5)]:
    for d in (-0.2,0.2):
        v=escalon(**{kw:p0*(1+d)})[-1]
        S=((v-Vb)/(Vb-30))/d   # sobre el cambio dV
        S2=((v-Vb)/Vb)/d
        print(f"{nom:7s} {d:+.0%}: V(120)={v:.4f}  dV={v-30:.4f}  S(dV)={S:+.3f}  S(V)={S2:+.3f}")

print("\n== Sistemas de prueba de la guía 5.9 a) (h = 1/120 s, escalón unitario, T = 20 s) ==")
def integra(f, x0, h, T, m):
    n=int(round(T/h)); x=np.array(x0,float); xs=[x.copy()]
    for _ in range(n):
        if m=="euler": x=x+h*f(x)
        else:
            k1=f(x);k2=f(x+h*k1/2);k3=f(x+h*k2/2);k4=f(x+h*k3); x=x+h*(k1+2*k2+2*k3+k4)/6
        xs.append(x.copy())
    return np.array(xs)
h=1/120; T=20; t=np.arange(0,T+h/2,h)
K,tau=2.0,0.5
ref1=K*(1-np.exp(-t/tau)); f1=lambda x:np.array([(K*1.0-x[0])/tau])
z,wn=0.3,4.0; wd=wn*np.sqrt(1-z**2)
ref2=1-np.exp(-z*wn*t)*(np.cos(wd*t)+z/np.sqrt(1-z**2)*np.sin(wd*t))
f2=lambda x:np.array([x[1], wn**2*(1-x[0])-2*z*wn*x[1]])
for nombre,f,x0,ref,col in [("1.er orden K=2 tau=0.5",f1,[0],ref1,0),("2.º orden zeta=0.3 wn=4",f2,[0,0],ref2,0)]:
    for m in ("rk4","euler"):
        e=np.max(np.abs(integra(f,x0,h,T,m)[:,col]-ref)); print(f"{nombre:26s} {m:5s} error máx = {e:.3e}")
