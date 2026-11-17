/**
 * Sonido.js
 * Sonificación continua de la planta con WebAudio (sin assets):
 *   - Rumor del agua: ruido filtrado, intensidad según Q_t + Q_v.
 *   - Zumbido de alta tensión: armónicos de 50 Hz (100/200/300 Hz), frecuencia y
 *     amplitud según la potencia generada P.
 *   - Alerta: doble pitido repetido mientras la demanda supera la potencia (D > P).
 */

import { HIDRO } from '../config/constantes.js';

const Q_MAX = HIDRO.Kt + HIDRO.Kv;   // Caudal total máximo (turbinas + vertedero) [hm³/h]
const P_REF = 150;                   // MW de referencia para escalar el zumbido

export class SonidoPlanta {
  constructor() {
    this.ctx = null;
    this.activo = false;
    this.silenciado = false;
    this.pausado = false;
    this.alertaActiva = false;
    this._tAlerta = 0;
    this.nodos = {};
  }

  /** Crea el grafo de audio. Llamar tras un gesto del usuario (los niveles se inician con clic/tecla). */
  iniciar() {
    if (this.activo) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') ctx.resume();

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ctx.destination);

      // — Rumor del agua —
      const dur = 2;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {            // ruido "marrón": más cuerpo grave
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
      const ruido = ctx.createBufferSource();
      ruido.buffer = buf;
      ruido.loop = true;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 400;
      filtro.Q.value = 0.7;
      const gAgua = ctx.createGain();
      gAgua.gain.value = 0;
      ruido.connect(filtro).connect(gAgua).connect(this.master);
      ruido.start();

      // — Zumbido eléctrico (50 Hz y armónicos) —
      const gZum = ctx.createGain();
      gZum.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      gZum.connect(lp).connect(this.master);
      const oscs = [1, 2, 3].map((k) => {
        const o = ctx.createOscillator();
        o.type = k === 1 ? 'sawtooth' : 'square';
        o.frequency.value = 100 * k;
        const g = ctx.createGain();
        g.gain.value = [0.5, 0.25, 0.12][k - 1];
        o.connect(g).connect(gZum);
        o.start();
        return o;
      });

      this.nodos = { ruido, filtro, gAgua, gZum, oscs };
      this.activo = true;
    } catch (e) {
      this.activo = false;   // Sin audio: el juego continúa
    }
  }

  /**
   * @param {number} dt - Delta [s]
   * @param {{Qt:number,Qv:number,P:number,D:number}} v - Caudales [hm³/h], potencia y demanda [MW]
   */
  actualizar(dt, { Qt, Qv, P, D }) {
    if (!this.activo) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const mudo = this.silenciado || this.pausado;

    // Rumor: volumen y brillo crecen con el caudal total
    const q = Math.min(1, (Qt + Qv) / Q_MAX);
    this.nodos.gAgua.gain.setTargetAtTime(mudo ? 0 : 0.03 + 0.55 * q, t, 0.1);
    this.nodos.filtro.frequency.setTargetAtTime(300 + 900 * q, t, 0.2);

    // Zumbido: amplitud y tono suben con P
    const p = Math.min(1.2, Math.max(0, P / P_REF));
    this.nodos.gZum.gain.setTargetAtTime(mudo ? 0 : 0.015 + 0.09 * p, t, 0.1);
    this.nodos.oscs.forEach((o, i) => o.frequency.setTargetAtTime((100 + 12 * p) * (i + 1), t, 0.15));

    // Alerta D > P (con tolerancia para no sonar por ruido numérico)
    this.alertaActiva = !mudo && (D - P) > Math.max(2, 0.05 * D);
    if (this.alertaActiva) {
      this._tAlerta -= dt;
      if (this._tAlerta <= 0) {
        this._tAlerta = 0.9;
        this._doblePitido();
      }
    } else {
      this._tAlerta = 0;
    }
  }

  _doblePitido() {
    const ctx = this.ctx;
    [[740, 0], [988, 0.16]].forEach(([f, retraso]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      const t0 = ctx.currentTime + retraso;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.16);
    });
  }

  alternarSilencio() {
    this.silenciado = !this.silenciado;
  }

  detener() {
    if (!this.activo) return;
    try {
      this.nodos.ruido.stop();
      this.nodos.oscs.forEach((o) => o.stop());
      this.ctx.close();
    } catch (e) { /* ya detenido */ }
    this.activo = false;
  }
}
