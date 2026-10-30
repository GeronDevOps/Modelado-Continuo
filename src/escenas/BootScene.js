/**
 * BootScene.js
 * Escena de arranque: precarga assets y pasa a MenuScene.
 * Si los assets no existen, genera placeholders procedurales.
 */

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Barra de carga (estilo sala de control)
    this._crearBarraCarga();

    // Assets de audio (opcionales — no bloquean si faltan)
    this.load.on('loaderror', (file) => {
      console.warn(`[Boot] Asset no encontrado: ${file.key} — usando placeholder`);
    });
  }

  _crearBarraCarga() {
    const cx = 640;
    const cy = 360;

    // Fondo negro total
    this.add.rectangle(cx, cy, 1280, 720, 0x000000);

    // Texto de título con efecto "terminal"
    this.add.text(cx, cy - 80, 'AISLADOS EN LA PATAGONIA', {
      fontSize: '32px',
      fontFamily: 'Courier New, monospace',
      color: '#52b788',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 40, 'BALANCE HÍDRICO', {
      fontSize: '20px',
      fontFamily: 'Courier New, monospace',
      color: '#1c5270',
      align: 'center',
    }).setOrigin(0.5);

    // Barra de progreso
    const barW = 400;
    const barH = 20;
    this.add.rectangle(cx, cy + 20, barW + 4, barH + 4, 0x1a1a1a)
      .setStrokeStyle(1, 0x333333);
    const barFill = this.add.rectangle(cx - barW / 2, cy + 20, 0, barH - 4, 0x52b788)
      .setOrigin(0, 0.5);

    this.textoEstado = this.add.text(cx, cy + 55, 'INICIANDO SISTEMA...', {
      fontSize: '12px',
      fontFamily: 'Courier New, monospace',
      color: '#52b788',
    }).setOrigin(0.5);

    // Escuchar progreso de carga
    this.load.on('progress', (v) => {
      barFill.width = barW * v;
    });

    this.load.on('fileprogress', (file) => {
      this.textoEstado.setText(`CARGANDO: ${file.key.toUpperCase()}`);
    });
  }

  create() {
    this.textoEstado?.setText('SISTEMA LISTO');

    // Breve pausa para el efecto de arranque, luego a menú
    this.time.delayedCall(600, () => {
      this.scene.start('MenuScene');
    });
  }
}
