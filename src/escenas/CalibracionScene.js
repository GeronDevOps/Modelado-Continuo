/**
 * CalibracionScene.js
 * Calibración del rango de altura de la mano derecha (muñeca, landmark 0)
 * y prueba del puño izquierdo (vertedero).
 *
 * Pasos:
 *   1. Mano derecha ABAJO  + ESPACIO → compuerta cerrada (u_t = 0)
 *   2. Mano derecha ARRIBA + ESPACIO → compuerta abierta (u_t = 1)
 *   3. Prueba libre; ENTER inicia el nivel.
 * [K] salta la cámara y usa el teclado.
 */

import { ManoCamara } from '../entrada/ManoCamara.js';
import { aperturaDesdeAltura, calibracionValida } from '../entrada/gestos.js';
import { CAMARA, COLORES } from '../config/constantes.js';

const FUENTE = 'Courier New, monospace';
const PREV_W = 480;
const PREV_H = 360;

export class CalibracionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CalibracionScene' });
  }

  init(data) {
    this.nivelSiguiente = data?.nivel ?? 2;
  }

  create() {
    this.paso = 0;           // 0 cargando, 1 abajo, 2 arriba, 3 prueba
    this.calib = { yBajo: null, yAlto: null };

    this.camara = this.registry.get('camara');
    if (!this.camara) {
      this.camara = new ManoCamara();
      this.registry.set('camara', this.camara);
    }
    this.registry.set('calibracion', null);

    this.add.rectangle(640, 360, 1280, 720, COLORES.fondo);
    this.add.rectangle(640, 22, 1280, 44, 0x0a0a0a);
    this.add.text(12, 12, '◉ CALIBRACIÓN DE COMPUERTA — ENTRADA POR CÁMARA', {
      fontSize: '14px', fontFamily: FUENTE, color: '#52b788',
    });

    // Vista de cámara (canvas 2D como textura)
    if (this.textures.exists('cam_preview')) this.textures.remove('cam_preview');
    this.texCam = this.textures.createCanvas('cam_preview', PREV_W, PREV_H);
    this.add.image(60 + PREV_W / 2, 90 + PREV_H / 2, this.texCam);
    this.add.rectangle(60 + PREV_W / 2, 90 + PREV_H / 2, PREV_W + 4, PREV_H + 4)
      .setStrokeStyle(1, COLORES.borde_panel).setFillStyle(0, 0);
    this.marcadores = this.add.graphics().setDepth(5);

    // Panel de instrucciones
    this.textoTitulo = this.add.text(600, 90, '', {
      fontSize: '20px', fontFamily: FUENTE, color: '#4fc3f7', wordWrap: { width: 640 },
    });
    this.textoInstr = this.add.text(600, 150, '', {
      fontSize: '14px', fontFamily: FUENTE, color: '#cccccc', lineSpacing: 6, wordWrap: { width: 640 },
    });
    this.textoEstado = this.add.text(600, 330, '', {
      fontSize: '13px', fontFamily: FUENTE, color: '#f4a261', lineSpacing: 4, wordWrap: { width: 640 },
    });

    // Barra de compuerta (vista previa del u_t calculado)
    this.add.text(600, 420, 'APERTURA u_t', { fontSize: '10px', fontFamily: FUENTE, color: '#666666' });
    this.add.rectangle(600 + 150, 450, 304, 22, 0x1a1a1a).setStrokeStyle(1, 0x333333);
    this.barraUt = this.add.rectangle(602, 450, 0, 18, COLORES.linea_P).setOrigin(0, 0.5);
    this.textoUt = this.add.text(920, 450, '', { fontSize: '14px', fontFamily: FUENTE, color: '#52b788' }).setOrigin(0, 0.5);
    this.add.text(600, 490, 'VERTEDERO u_v (puño izquierdo)', { fontSize: '10px', fontFamily: FUENTE, color: '#666666' });
    this.indVertedero = this.add.rectangle(612, 520, 24, 24, 0x1a1a1a).setStrokeStyle(1, 0x333333);
    this.textoVert = this.add.text(634, 520, 'CERRADO', { fontSize: '14px', fontFamily: FUENTE, color: '#888888' }).setOrigin(0, 0.5);

    this.add.text(640, 700, '[ESPACIO] Capturar   [R] Reiniciar   [ENTER] Iniciar   [K] Usar teclado   [ESC] Menú', {
      fontSize: '10px', fontFamily: FUENTE, color: '#444444',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => this._capturar());
    this.input.keyboard.on('keydown-R', () => this._reiniciar());
    this.input.keyboard.on('keydown-ENTER', () => this._iniciar());
    this.input.keyboard.on('keydown-K', () => this._usarTeclado());
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));

    this._mostrarPaso();
    if (this.camara.estado === 'listo') {
      this.paso = 1;
      this._mostrarPaso();
    } else {
      this.camara.iniciar();
    }
  }

  _mostrarPaso() {
    const t = this.textoTitulo;
    const i = this.textoInstr;
    switch (this.paso) {
      case 0:
        t.setText('Iniciando cámara…');
        i.setText('Acepta el permiso de cámara del navegador. Se descargará el modelo de manos (solo la primera vez).');
        break;
      case 1:
        t.setText('PASO 1/3 — Compuerta CERRADA');
        i.setText('Muestra tu mano DERECHA a la cámara y bájala a la altura que quieras usar como "compuerta cerrada" (0%).\nLuego presiona ESPACIO.');
        break;
      case 2:
        t.setText('PASO 2/3 — Compuerta ABIERTA');
        i.setText('Sube la mano DERECHA hasta la altura de "compuerta abierta" (100%).\nLuego presiona ESPACIO.\nSe usa la MUÑECA, no la palma.');
        break;
      case 3:
        t.setText('PASO 3/3 — Prueba');
        i.setText('Mueve la mano derecha: la barra sigue la compuerta de turbinas.\nCierra el puño IZQUIERDO para abrir el vertedero.\nCuando estés listo presiona ENTER.');
        break;
    }
  }

  _capturar() {
    const cam = this.camara;
    if (cam.estado !== 'listo' || !cam.manoDerechaVisible || cam.yMuneca === null) return;
    if (this.paso === 1) {
      this.calib.yBajo = cam.yMuneca;
      this.paso = 2;
    } else if (this.paso === 2) {
      this.calib.yAlto = cam.yMuneca;
      if (!calibracionValida(this.calib)) {
        this.textoEstado.setText('Rango demasiado pequeño. Separa más las posiciones baja y alta.');
        this.paso = 1;
      } else {
        this.paso = 3;
      }
    }
    this._mostrarPaso();
  }

  _reiniciar() {
    if (this.camara.estado !== 'listo') return;
    this.calib = { yBajo: null, yAlto: null };
    this.paso = 1;
    this._mostrarPaso();
  }

  _iniciar() {
    if (this.paso !== 3) return;
    this.registry.set('calibracion', { ...this.calib });
    this.scene.start('JuegoScene', { nivel: this.nivelSiguiente });
  }

  _usarTeclado() {
    this.registry.set('calibracion', null);
    this.camara.detener();
    this.registry.set('camara', null);
    this.scene.start('JuegoScene', { nivel: this.nivelSiguiente });
  }

  update(time) {
    const cam = this.camara;

    if (cam.estado === 'error') {
      this.textoTitulo.setText('Cámara no disponible');
      this.textoInstr.setText(`${cam.mensajeError}\n\nPresiona K para jugar con el teclado.`);
      return;
    }
    if (cam.estado === 'listo' && this.paso === 0) {
      this.paso = 1;
      this._mostrarPaso();
    }
    if (cam.estado !== 'listo') return;

    cam.actualizar(time);

    // Frame espejado
    const ctx = this.texCam.getContext();
    cam.dibujarEn(ctx, PREV_W, PREV_H);
    this.texCam.refresh();

    // Marcadores de las muñecas
    this.marcadores.clear();
    const dibujar = (lm, color) => {
      if (!lm) return;
      const m = lm[CAMARA.landmark_muneca];
      this.marcadores.fillStyle(color, 1);
      this.marcadores.fillCircle(60 + (1 - m.x) * PREV_W, 90 + m.y * PREV_H, 8);
    };
    dibujar(cam.landmarksDerecha, 0x52b788);
    dibujar(cam.landmarksIzquierda, 0xf4d35e);

    // Líneas de calibración
    const linea = (y, color) => {
      this.marcadores.lineStyle(2, color, 0.9);
      this.marcadores.beginPath();
      this.marcadores.moveTo(60, 90 + y * PREV_H);
      this.marcadores.lineTo(60 + PREV_W, 90 + y * PREV_H);
      this.marcadores.strokePath();
    };
    if (this.calib.yBajo !== null) linea(this.calib.yBajo, 0xe63946);
    if (this.calib.yAlto !== null) linea(this.calib.yAlto, 0x52b788);

    // Estado
    const msg = [];
    msg.push(cam.manoDerechaVisible ? '● Mano derecha: detectada' : '○ Mano derecha: NO detectada');
    msg.push(cam.manoIzquierdaVisible ? '● Mano izquierda: detectada' : '○ Mano izquierda: no detectada');
    this.textoEstado.setText(msg.join('\n'));

    // Previsualización de u_t y vertedero
    let ut = 0;
    if (this.paso === 3 && cam.yMuneca !== null) ut = aperturaDesdeAltura(cam.yMuneca, this.calib);
    this.barraUt.width = 300 * ut;
    this.textoUt.setText(`${Math.round(ut * 100)}%`);
    const abierto = this.paso === 3 && cam.puno;
    this.indVertedero.setFillStyle(abierto ? COLORES.alarma_baja : 0x1a1a1a);
    this.textoVert.setText(abierto ? 'ABIERTO' : 'CERRADO');
    this.textoVert.setColor(abierto ? '#f4a261' : '#888888');
  }
}
