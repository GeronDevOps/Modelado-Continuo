/**
 * GaugeHidraulico.js
 * Manómetro/gauge circular de cabeza hidráulica H(t) estilo sala de control industrial.
 */

import { COLORES } from '../config/constantes.js';

export class GaugeHidraulico {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} cx    - Centro X
   * @param {number} cy    - Centro Y
   * @param {number} radio - Radio del gauge
   * @param {number} min   - Valor mínimo (e.g. 20 m)
   * @param {number} max   - Valor máximo (e.g. 60 m)
   * @param {string} label - Etiqueta (e.g. 'H [m]')
   */
  constructor(scene, cx, cy, radio, min = 20, max = 60, label = 'H [m]') {
    this.scene = scene;
    this.cx = cx;
    this.cy = cy;
    this.radio = radio;
    this.min = min;
    this.max = max;
    this.label = label;
    this.valor = min;

    this._construir();
  }

  _construir() {
    const s = this.scene;
    const r = this.radio;

    // Fondo circular
    s.add.circle(this.cx, this.cy, r + 4, 0x1a1a1a).setDepth(10);
    s.add.circle(this.cx, this.cy, r + 4, 0x000000, 0)
      .setStrokeStyle(2, COLORES.borde_panel).setDepth(11);

    // Arco de fondo (gris oscuro)
    this.gFondo = s.add.graphics().setDepth(11);
    this.gFondo.lineStyle(6, 0x333333, 1);
    this.gFondo.beginPath();
    this.gFondo.arc(this.cx, this.cy, r - 6, Phaser.Math.DegToRad(135), Phaser.Math.DegToRad(405), false);
    this.gFondo.strokePath();

    // Arco de valor (activo)
    this.gArco = s.add.graphics().setDepth(12);

    // Aguja
    this.gAguja = s.add.graphics().setDepth(13);

    // Texto del valor
    this.textoValor = s.add.text(this.cx, this.cy + 6, '-- m', {
      fontSize: `${Math.max(10, Math.floor(r * 0.45))}px`,
      fontFamily: 'Courier New, monospace',
      color: '#52b788',
      align: 'center',
    }).setOrigin(0.5).setDepth(14);

    // Label
    s.add.text(this.cx, this.cy + r - 4, this.label, {
      fontSize: '9px',
      fontFamily: 'Courier New, monospace',
      color: '#666666',
      align: 'center',
    }).setOrigin(0.5).setDepth(14);

    // Marcas de escala
    this._dibujarMarcas();
  }

  _dibujarMarcas() {
    const g = this.scene.add.graphics().setDepth(11);
    const r = this.radio;
    const nMarcas = 5;

    for (let i = 0; i <= nMarcas; i++) {
      const angDeg = 135 + (270 / nMarcas) * i;
      const angRad = Phaser.Math.DegToRad(angDeg);
      const x1 = this.cx + (r - 10) * Math.cos(angRad);
      const y1 = this.cy + (r - 10) * Math.sin(angRad);
      const x2 = this.cx + (r - 4) * Math.cos(angRad);
      const y2 = this.cy + (r - 4) * Math.sin(angRad);

      g.lineStyle(1, 0x555555);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();

      // Etiqueta numérica
      const val = Math.round(this.min + (this.max - this.min) * (i / nMarcas));
      const xt = this.cx + (r - 18) * Math.cos(angRad);
      const yt = this.cy + (r - 18) * Math.sin(angRad);
      this.scene.add.text(xt, yt, `${val}`, {
        fontSize: '7px', fontFamily: 'Courier New', color: '#444444',
      }).setOrigin(0.5).setDepth(11);
    }
  }

  /**
   * Actualiza el gauge con el nuevo valor de H.
   * @param {number} H - Cabeza hidráulica [m]
   */
  actualizar(H) {
    this.valor = H;
    const t = Math.max(0, Math.min(1, (H - this.min) / (this.max - this.min)));
    const r = this.radio;

    // Color del arco: verde (seguro) → amarillo → rojo (crítico)
    let color = COLORES.linea_P;
    if (t > 0.85) color = COLORES.alarma_alta;
    else if (t > 0.65) color = COLORES.linea_Pdem;

    // Redibujar arco activo
    this.gArco.clear();
    this.gArco.lineStyle(6, color, 1);
    this.gArco.beginPath();
    const angFin = Phaser.Math.DegToRad(135 + 270 * t);
    this.gArco.arc(this.cx, this.cy, r - 6, Phaser.Math.DegToRad(135), angFin, false);
    this.gArco.strokePath();

    // Redibujar aguja
    this.gAguja.clear();
    const angAguja = Phaser.Math.DegToRad(135 + 270 * t);
    const x2 = this.cx + (r - 12) * Math.cos(angAguja);
    const y2 = this.cy + (r - 12) * Math.sin(angAguja);
    this.gAguja.lineStyle(2, 0xffffff, 1);
    this.gAguja.beginPath();
    this.gAguja.moveTo(this.cx, this.cy);
    this.gAguja.lineTo(x2, y2);
    this.gAguja.strokePath();
    this.gAguja.fillStyle(0xffffff);
    this.gAguja.fillCircle(this.cx, this.cy, 3);

    // Texto
    this.textoValor.setText(`${H.toFixed(1)} m`);
  }
}
