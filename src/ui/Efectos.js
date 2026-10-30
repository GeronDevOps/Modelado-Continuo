/**
 * Efectos.js
 * Efectos visuales procedurales (sin assets): lluvia, relámpagos y espuma/rocío
 * del vertedero. Se dibujan en el panel del diagrama de planta.
 */

import { COLORES } from '../config/constantes.js';

export class EfectosClima {
  /**
   * @param {Phaser.Scene} scene
   * @param {{x:number,y:number,w:number,h:number}} area - Región de la lluvia
   */
  constructor(scene, area) {
    this.scene = scene;
    this.area = area;
    this.gotas = [];
    this.rocio = [];
    this.tFlash = 0;          // s restantes de relámpago
    this.rayo = null;         // polilínea del rayo
    this.tSiguienteRayo = 2;
    this._ctxAudio = null;
    this.silenciado = false;

    this.gLluvia = scene.add.graphics().setDepth(6.5);
    this.gRocio = scene.add.graphics().setDepth(7.5);
    this.gRayo = scene.add.graphics().setDepth(7.6);
    this.destello = scene.add.rectangle(
      area.x + area.w / 2, area.y + area.h / 2, area.w, area.h, 0xcfe8ff, 0
    ).setDepth(7.7);
  }

  /**
   * @param {number} dt         - Delta [s]
   * @param {number} intensidad - Intensidad de tormenta [0,1]
   * @param {number} uv         - Apertura del vertedero [0,1]
   * @param {{x:number,y:number}} salida - Punto donde cae el vertedero (para el rocío)
   */
  actualizar(dt, intensidad, uv, salida) {
    this._lluvia(dt, intensidad);
    this._relampagos(dt, intensidad);
    this._rocio(dt, uv, salida);
  }

  _lluvia(dt, intensidad) {
    const { x, y, w, h } = this.area;
    const objetivo = Math.round(intensidad * 220);
    while (this.gotas.length < objetivo) {
      this.gotas.push({
        x: x + Math.random() * (w + 60),
        y: y + Math.random() * h,
        v: 520 + Math.random() * 280,
        l: 6 + Math.random() * 8,
      });
    }
    if (this.gotas.length > objetivo) this.gotas.length = objetivo;

    const g = this.gLluvia;
    g.clear();
    g.lineStyle(1, 0x8fb8d8, 0.25 + 0.3 * intensidad);
    g.beginPath();
    for (const d of this.gotas) {
      d.y += d.v * dt;
      d.x -= d.v * 0.22 * dt;                     // viento
      if (d.y > y + h || d.x < x - 20) {
        d.y = y + Math.random() * 20;
        d.x = x + Math.random() * (w + 60);
      }
      g.moveTo(d.x, d.y);
      g.lineTo(d.x - d.l * 0.22, d.y - d.l);
    }
    g.strokePath();
  }

  _relampagos(dt, intensidad) {
    const { x, y, w } = this.area;
    if (intensidad > 0.55) {
      this.tSiguienteRayo -= dt;
      if (this.tSiguienteRayo <= 0) {
        this.tSiguienteRayo = 2.5 + Math.random() * 5 * (1.2 - intensidad);
        this.tFlash = 0.25;
        // Rayo en zigzag desde el cielo
        let px = x + 60 + Math.random() * (w - 120);
        let py = y + 4;
        this.rayo = [[px, py]];
        while (py < y + 240) {
          px += (Math.random() - 0.5) * 40;
          py += 18 + Math.random() * 22;
          this.rayo.push([px, py]);
        }
        this._trueno();
      }
    }

    if (this.tFlash > 0) {
      this.tFlash -= dt;
      // Dos pulsos: 0.25→0.15 y 0.10→0
      const pulso = (this.tFlash > 0.15 || (this.tFlash < 0.10 && this.tFlash > 0.04)) ? 1 : 0.25;
      this.destello.setFillStyle(0xcfe8ff, 0.22 * pulso);
      this.gRayo.clear();
      if (this.rayo && pulso === 1) {
        this.gRayo.lineStyle(3, 0xffffff, 0.95);
        this.gRayo.beginPath();
        this.rayo.forEach(([rx, ry], i) => (i ? this.gRayo.lineTo(rx, ry) : this.gRayo.moveTo(rx, ry)));
        this.gRayo.strokePath();
      }
    } else if (this.rayo) {
      this.rayo = null;
      this.gRayo.clear();
      this.destello.setFillStyle(0xcfe8ff, 0);
    }
  }

  _rocio(dt, uv, salida) {
    const g = this.gRocio;
    g.clear();
    if (uv > 0.05 && salida) {
      const n = Math.ceil(uv * 160 * dt) + (Math.random() < uv ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.rocio.push({
          x: salida.x + (Math.random() - 0.5) * 16,
          y: salida.y,
          vx: 20 + Math.random() * 70 * uv,
          vy: -(60 + Math.random() * 140 * uv),
          vida: 0.5 + Math.random() * 0.4,
        });
      }
    }
    g.fillStyle(0xeaf6ff, 0.8);
    this.rocio = this.rocio.filter((p) => {
      p.vida -= dt;
      if (p.vida <= 0) return false;
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);   // píxel (pixelArt)
      return true;
    });
  }

  /** Trueno sintético: ruido filtrado con caída exponencial (WebAudio). */
  _trueno() {
    if (this.silenciado) return;
    try {
      this._ctxAudio = this._ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._ctxAudio;
      if (ctx.state === 'suspended') ctx.resume();
      const dur = 1.4;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 220;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(filtro).connect(gain).connect(ctx.destination);
      src.start();
    } catch (e) {
      // Sin audio: el efecto visual continúa
    }
  }

  /** Color del agua del embalse: azul profundo en reposo → cian turbio en tormenta. */
  static colorAgua(intensidad) {
    const a = Phaser.Display.Color.IntegerToColor(COLORES.agua_reposo);
    const b = Phaser.Display.Color.IntegerToColor(COLORES.agua_tormenta);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(Math.max(0, Math.min(1, intensidad)) * 100));
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  }

  destruir() {
    [this.gLluvia, this.gRocio, this.gRayo, this.destello].forEach((o) => o.destroy());
  }
}
