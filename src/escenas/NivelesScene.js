/**
 * NivelesScene.js
 * Menú de selección de nivel y modo de entrada (cámara / teclado).
 * Muestra el progreso guardado localmente.
 */

import { COLORES, NIVEL1, NIVEL2, NIVEL3 } from '../config/constantes.js';
import { leerProgreso } from '../config/progreso.js';
import { calibracionValida } from '../entrada/gestos.js';

const FUENTE = 'Courier New, monospace';

const NIVELES = [
  {
    cfg: NIVEL1, color: COLORES.linea_P, dificultad: 'FÁCIL',
    desc: 'Caudal y demanda constantes.\nCalibra V en 30 ± 3 hm³ y\nP ≈ 47.4 MW por 30 s para ganar.',
    ctrl: 'Turbinas',
  },
  {
    cfg: NIVEL2, color: COLORES.linea_V_bright, dificultad: 'MEDIO',
    desc: 'Una tormenta eleva el caudal.\nUsa el vertedero y mantén\n30 s de calibración estable.',
    ctrl: 'Turbinas + vertedero',
  },
  {
    cfg: NIVEL3, color: COLORES.alarma_baja, dificultad: 'DIFÍCIL',
    desc: 'Caudal oscilante y demanda\nen rampa. Mantén 30 s de\ncalibración (error ≤ 8 MW).',
    ctrl: 'Turbinas + vertedero',
  },
];

export class NivelesScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NivelesScene' });
  }

  create() {
    this.modo = this.registry.get('modoEntrada') || 'teclado';
    const progreso = leerProgreso();

    this.add.rectangle(640, 360, 1280, 720, 0x060a0e);
    const g = this.add.graphics();
    g.lineStyle(1, 0x111111, 1);
    for (let y = 0; y < 720; y += 40) { g.moveTo(0, y); g.lineTo(1280, y); }
    for (let x = 0; x < 1280; x += 40) { g.moveTo(x, 0); g.lineTo(x, 720); }
    g.strokePath();

    this.add.rectangle(640, 30, 1280, 60, 0x0a0a0a);
    this.add.rectangle(640, 60, 1280, 2, COLORES.linea_P, 0.4);
    this.add.text(640, 30, 'SELECCIÓN DE NIVEL', {
      fontSize: '24px', fontFamily: FUENTE, color: '#52b788',
    }).setOrigin(0.5);

    NIVELES.forEach((n, i) => this._tarjeta(n, i, progreso[n.cfg.id]));

    // Selector de modo de entrada
    this.textoModo = this.add.text(640, 580, '', {
      fontSize: '16px', fontFamily: FUENTE, color: '#cccccc', align: 'center',
    }).setOrigin(0.5);
    const bgModo = this.add.rectangle(640, 580, 520, 36, 0x111111, 0.001)
      .setStrokeStyle(1, 0x555555).setInteractive({ useHandCursor: true });
    bgModo.on('pointerdown', () => this._alternarModo());
    this.input.keyboard.on('keydown-C', () => this._alternarModo());
    this._refrescarModo();

    this.add.text(640, 630,
      '[1] [2] [3] Jugar nivel   ·   [C] Cambiar entrada   ·   [ESC] Menú principal', {
        fontSize: '12px', fontFamily: FUENTE, color: '#555555',
      }).setOrigin(0.5);
    this.add.text(640, 655,
      'Cámara: mano DERECHA sube/baja = turbinas · puño IZQUIERDO = vertedero', {
        fontSize: '11px', fontFamily: FUENTE, color: '#444444',
      }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ONE', () => this._jugar(1));
    this.input.keyboard.on('keydown-TWO', () => this._jugar(2));
    this.input.keyboard.on('keydown-THREE', () => this._jugar(3));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));
  }

  _tarjeta(n, i, prog) {
    const w = 360, h = 400;
    const x = 200 + i * 440;
    const y = 330;
    const hex = `#${n.color.toString(16).padStart(6, '0')}`;

    const bg = this.add.rectangle(x, y, w, h, 0x0d1117)
      .setStrokeStyle(1, n.color).setInteractive({ useHandCursor: true });
    this.add.rectangle(x, y - h / 2 + 2, w, 4, n.color);

    this.add.text(x, y - 170, `NIVEL ${n.cfg.id}`, {
      fontSize: '30px', fontFamily: FUENTE, color: hex, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(x, y - 130, n.cfg.nombre, {
      fontSize: '14px', fontFamily: FUENTE, color: '#cccccc', align: 'center', wordWrap: { width: w - 30 },
    }).setOrigin(0.5);
    this.add.text(x, y - 98, n.dificultad, {
      fontSize: '12px', fontFamily: FUENTE, color: '#111111', backgroundColor: hex, padding: { x: 8, y: 2 },
    }).setOrigin(0.5);

    this.add.text(x, y - 30, n.desc, {
      fontSize: '13px', fontFamily: FUENTE, color: '#888888', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(x, y + 50, `Meta: 30s calibrado (máx ${n.cfg.duracion_s}s) · ${n.ctrl}`, {
      fontSize: '10px', fontFamily: FUENTE, color: '#555555', align: 'center', wordWrap: { width: w - 20 },
    }).setOrigin(0.5);

    // Progreso guardado
    let estado = 'SIN JUGAR';
    let colorEstado = '#444444';
    if (prog) {
      estado = prog.aprobado ? '✓ APROBADO' : '✗ NO APROBADO';
      colorEstado = prog.aprobado ? '#52b788' : '#e63946';
    }
    this.add.text(x, y + 100, estado, {
      fontSize: '16px', fontFamily: FUENTE, color: colorEstado,
    }).setOrigin(0.5);
    if (prog) {
      const extra = prog.mejorRmse !== undefined
        ? `Mejor RMSE: ${prog.mejorRmse.toFixed(2)} MW`
        : `Mejor error P: ${(prog.mejorErrorP * 100).toFixed(1)} %`;
      this.add.text(x, y + 124, `${extra}  ·  Intentos: ${prog.intentos}`, {
        fontSize: '10px', fontFamily: FUENTE, color: '#555555',
      }).setOrigin(0.5);
    }

    const boton = this.add.text(x, y + 165, `▶  JUGAR [${n.cfg.id}]`, {
      fontSize: '16px', fontFamily: FUENTE, color: hex,
    }).setOrigin(0.5);

    bg.on('pointerover', () => { bg.setFillStyle(n.color, 0.1); boton.setColor('#ffffff'); });
    bg.on('pointerout', () => { bg.setFillStyle(0x0d1117); boton.setColor(hex); });
    bg.on('pointerdown', () => this._jugar(n.cfg.id));
  }

  _alternarModo() {
    this.modo = this.modo === 'camara' ? 'teclado' : 'camara';
    this.registry.set('modoEntrada', this.modo);
    this._refrescarModo();
  }

  _refrescarModo() {
    const cam = this.modo === 'camara';
    this.textoModo.setText(`ENTRADA:  ${cam ? '◉ CÁMARA (MediaPipe)' : '⌨ TECLADO'}   [C]`);
    this.textoModo.setColor(cam ? '#4fc3f7' : '#cccccc');
  }

  _jugar(nivel) {
    if (this.modo === 'camara') {
      const camara = this.registry.get('camara');
      const calib = this.registry.get('calibracion');
      const listo = camara && camara.estado === 'listo' && calibracionValida(calib);
      this.scene.start(listo ? 'JuegoScene' : 'CalibracionScene', { nivel });
    } else {
      this.registry.set('calibracion', null);
      this.scene.start('JuegoScene', { nivel });
    }
  }
}
