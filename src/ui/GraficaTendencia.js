/**
 * GraficaTendencia.js
 * Componente de gráfica de tendencia en tiempo real estilo HMI sala de control 90s.
 *
 * Muestra tres señales en una ventana temporal de 30 segundos:
 *   - P(t) generada         [MW]  — Línea verde fósforo
 *   - P_demanda(t)          [MW]  — Línea amarilla punteada
 *   - V(t) nivel embalse    [hm³] — Línea azul (eje secundario)
 */

import { COLORES } from '../config/constantes.js';

export class GraficaTendencia {
  /**
   * @param {Phaser.Scene} scene   - Escena de Phaser donde se renderiza
   * @param {number}       x       - Posición X del borde izquierdo
   * @param {number}       y       - Posición Y del borde superior
   * @param {number}       width   - Ancho en píxeles
   * @param {number}       height  - Alto en píxeles
   * @param {object}       config  - Configuración de rangos y ventana
   */
  constructor(scene, x, y, width, height, config = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.w = width;
    this.h = height;

    // Configuración de la ventana temporal y rangos
    this.ventana_s = config.ventana_s ?? 30;       // segundos visibles
    this.P_min = config.P_min ?? 0;
    this.P_max = config.P_max ?? 160;              // MW
    this.V_min = config.V_min ?? 0;
    this.V_max = config.V_max ?? 60;               // hm³
    this.maxPuntos = config.maxPuntos ?? 300;      // puntos de historial

    // Historial de datos
    this.historialP    = [];   // {t, v}
    this.historialPdem = [];
    this.historialV    = [];

    this._construirUI();
  }

  _construirUI() {
    const s = this.scene;

    // Fondo del panel
    this.fondo = s.add.rectangle(
      this.x + this.w / 2,
      this.y + this.h / 2,
      this.w,
      this.h,
      COLORES.fondo_panel
    ).setDepth(10);

    // Borde del panel
    this.borde = s.add.rectangle(
      this.x + this.w / 2,
      this.y + this.h / 2,
      this.w,
      this.h
    ).setDepth(11).setFillStyle(0x000000, 0).setStrokeStyle(1, COLORES.borde_panel);

    // Título
    s.add.text(this.x + 6, this.y + 4, 'TENDENCIA — 30s', {
      fontSize: '10px',
      fontFamily: 'Courier New, monospace',
      color: '#52b788',
    }).setDepth(12);

    // Leyenda
    const ly = this.y + this.h - 14;
    s.add.rectangle(this.x + 8,  ly + 5, 16, 2, COLORES.linea_P).setDepth(12);
    s.add.text(this.x + 28,  ly, 'P gen', { fontSize: '9px', fontFamily: 'Courier New', color: '#52b788' }).setDepth(12);
    s.add.rectangle(this.x + 76, ly + 5, 16, 2, COLORES.linea_Pdem).setDepth(12);
    s.add.text(this.x + 96,  ly, 'P dem', { fontSize: '9px', fontFamily: 'Courier New', color: '#f4d35e' }).setDepth(12);
    s.add.rectangle(this.x + 144, ly + 5, 16, 2, COLORES.linea_V_bright).setDepth(12);
    s.add.text(this.x + 164,  ly, 'V (hm³)', { fontSize: '9px', fontFamily: 'Courier New', color: '#4fc3f7' }).setDepth(12);

    // Graphics object para dibujar las líneas
    this.g = s.add.graphics().setDepth(12);

    // Líneas de cuadrícula (estáticas)
    this._dibujarGrilla();
  }

  _dibujarGrilla() {
    const g = this.scene.add.graphics().setDepth(11);
    g.lineStyle(1, 0x222222, 0.8);

    const paddingX = 4;
    const paddingY = 16;
    const iw = this.w - paddingX * 2;
    const ih = this.h - paddingY - 16;

    // Líneas horizontales (5 divisiones)
    for (let i = 0; i <= 4; i++) {
      const yy = this.y + paddingY + (ih / 4) * i;
      g.moveTo(this.x + paddingX, yy);
      g.lineTo(this.x + paddingX + iw, yy);
    }
    // Líneas verticales (6 divisiones = 5s cada una)
    for (let i = 0; i <= 6; i++) {
      const xx = this.x + paddingX + (iw / 6) * i;
      g.moveTo(xx, this.y + paddingY);
      g.lineTo(xx, this.y + paddingY + ih);
    }
    g.strokePath();

    // Etiquetas MW
    const etiquetas = [0, 40, 80, 120, 160];
    for (let i = 0; i < etiquetas.length; i++) {
      const yy = this.y + paddingY + ih - (ih / 4) * i;
      this.scene.add.text(this.x + paddingX, yy - 5, `${etiquetas[i]}`, {
        fontSize: '8px', fontFamily: 'Courier New', color: '#444444',
      }).setDepth(12);
    }
  }

  /**
   * Agrega un nuevo punto de datos al historial.
   *
   * @param {number} t      - Tiempo actual [s]
   * @param {number} P      - Potencia generada [MW]
   * @param {number} Pdem   - Potencia demandada [MW]
   * @param {number} V      - Volumen embalse [hm³]
   */
  agregar(t, P, Pdem, V) {
    this.historialP.push({ t, v: P });
    this.historialPdem.push({ t, v: Pdem });
    this.historialV.push({ t, v: V });

    // Mantener solo los últimos maxPuntos
    if (this.historialP.length > this.maxPuntos) {
      this.historialP.shift();
      this.historialPdem.shift();
      this.historialV.shift();
    }
  }

  /**
   * Redibuja la gráfica con los datos actuales.
   */
  dibujar() {
    this.g.clear();

    const paddingX = 4;
    const paddingY = 16;
    const iw = this.w - paddingX * 2;
    const ih = this.h - paddingY - 16;

    const x0 = this.x + paddingX;
    const y0 = this.y + paddingY;

    // Obtener el tiempo actual para la ventana
    const tFin = this.historialP.length > 0
      ? this.historialP[this.historialP.length - 1].t
      : 0;
    const tIni = Math.max(0, tFin - this.ventana_s);

    this._trazarSerie(this.historialP,    x0, y0, iw, ih, tIni, tFin, this.P_min, this.P_max, COLORES.linea_P,      2);
    this._trazarSerie(this.historialPdem, x0, y0, iw, ih, tIni, tFin, this.P_min, this.P_max, COLORES.linea_Pdem,   1, true);
    this._trazarSerie(this.historialV,    x0, y0, iw, ih, tIni, tFin, this.V_min, this.V_max, COLORES.linea_V_bright, 1);
  }

  /**
   * Traza una serie de datos sobre el área de la gráfica.
   */
  _trazarSerie(datos, x0, y0, iw, ih, tIni, tFin, vMin, vMax, color, grosor = 1, punteado = false) {
    if (datos.length < 2) return;

    const deltaT = tFin - tIni;
    if (deltaT <= 0) return;

    this.g.lineStyle(grosor, color, 1.0);
    this.g.beginPath();

    let primero = true;
    const paso = punteado ? 2 : 1;  // Simular punteado saltando puntos

    for (let i = 0; i < datos.length; i++) {
      const { t, v } = datos[i];
      if (t < tIni) continue;

      const px = x0 + ((t - tIni) / deltaT) * iw;
      const py = y0 + ih - ((v - vMin) / (vMax - vMin)) * ih;
      const pyClamp = Math.max(y0, Math.min(y0 + ih, py));

      if (primero || (punteado && i % 3 === 0)) {
        this.g.moveTo(px, pyClamp);
        primero = false;
      } else if (!punteado || i % 3 !== 1) {
        this.g.lineTo(px, pyClamp);
      } else {
        this.g.moveTo(px, pyClamp);
      }
    }
    this.g.strokePath();
  }
}
