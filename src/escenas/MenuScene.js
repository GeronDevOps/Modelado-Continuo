/**
 * MenuScene.js
 * Menú principal del juego con estética de sala de control industrial nocturna.
 */

import { COLORES, NIVEL1 } from '../config/constantes.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = 640;
    const cy = 360;

    // ─── FONDO: Montañas patagónicas estilizadas ─────────────────────────────
    this._dibujarFondo();

    // ─── PANEL CENTRAL ───────────────────────────────────────────────────────
    const panelW = 600;
    const panelH = 500;
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    // Sombra del panel
    this.add.rectangle(cx + 4, cy + 4, panelW, panelH, 0x000000, 0.7);
    // Panel
    this.add.rectangle(cx, cy, panelW, panelH, 0x0d1117)
      .setStrokeStyle(1, COLORES.borde_panel);
    // Línea decorativa superior
    this.add.rectangle(cx, panelY + 2, panelW, 3, COLORES.linea_P);

    // ─── LOGO / TÍTULO ────────────────────────────────────────────────────────
    this.add.text(cx, panelY + 30, 'CENTRAL HIDROELÉCTRICA', {
      fontSize: '13px', fontFamily: 'Courier New, monospace',
      color: '#666666', letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(cx, panelY + 60, 'AISLADOS EN LA', {
      fontSize: '36px', fontFamily: 'Courier New, monospace',
      color: '#52b788',
    }).setOrigin(0.5);

    this.add.text(cx, panelY + 100, 'PATAGONIA', {
      fontSize: '52px', fontFamily: 'Courier New, monospace',
      color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, panelY + 145, 'BALANCE HÍDRICO', {
      fontSize: '18px', fontFamily: 'Courier New, monospace',
      color: '#293241', letterSpacing: 6,
      backgroundColor: '#52b788', padding: { x: 12, y: 4 },
    }).setOrigin(0.5);

    // ─── DESCRIPCIÓN ─────────────────────────────────────────────────────────
    this.add.text(cx, panelY + 205,
      'Turno nocturno en la represa.\nEquilibra la potencia. Protege el embalse.\nSistema dinámico de primer orden.',
      {
        fontSize: '13px', fontFamily: 'Courier New, monospace',
        color: '#888888', align: 'center', lineSpacing: 6,
      }
    ).setOrigin(0.5);

    // ─── BOTÓN SELECCIÓN DE NIVEL ─────────────────────────────────────────────
    this._crearBoton(cx, panelY + 300, 'SELECCIONAR NIVEL', () => {
      this.scene.start('NivelesScene');
    }, COLORES.linea_P);

    // ─── CONTROLES ────────────────────────────────────────────────────────────
    this.add.text(cx, panelY + 380,
      'Teclado: ↑ ↓ Turbinas · ESPACIO Vertedero · P Pausa · D Debug · A Silenciar\n' +
      'Cámara: mano DERECHA sube/baja = turbinas · puño IZQUIERDO = vertedero',
      {
        fontSize: '10px', fontFamily: 'Courier New, monospace',
        color: '#444444', align: 'center',
      }
    ).setOrigin(0.5);

    // ─── VERSION ──────────────────────────────────────────────────────────────
    this.add.text(cx, panelY + panelH - 8, 'SimJam 2024 — Fase 3 v3.0', {
      fontSize: '9px', fontFamily: 'Courier New, monospace', color: '#333333',
    }).setOrigin(0.5);

    // ─── ANIMACIÓN CURSOR PARPADEANTE ─────────────────────────────────────────
    const cursor = this.add.text(panelX + 16, panelY + 18, '█', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#52b788',
    });
    this.time.addEvent({
      delay: 500, loop: true,
      callback: () => { cursor.setVisible(!cursor.visible); },
    });
  }

  _dibujarFondo() {
    const g = this.add.graphics();

    // Cielo nocturno con gradiente simulado (rectángulos superpuestos)
    g.fillStyle(0x020d18); g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0x041020, 0.6); g.fillRect(0, 0, 1280, 400);

    // Estrellas
    const rng = new Phaser.Math.RandomDataGenerator(['patagonia']);
    g.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 120; i++) {
      const sx = rng.integerInRange(0, 1280);
      const sy = rng.integerInRange(0, 300);
      const sr = rng.realInRange(0.5, 1.5);
      g.fillCircle(sx, sy, sr);
    }

    // Montañas nevadas de fondo (azul oscuro)
    g.fillStyle(0x0a1929);
    g.fillTriangle(0, 500, 200, 200, 400, 500);
    g.fillTriangle(180, 500, 450, 150, 700, 500);
    g.fillTriangle(500, 500, 750, 220, 980, 500);
    g.fillTriangle(850, 500, 1100, 170, 1280, 500);
    g.fillRect(0, 490, 1280, 230);

    // Nieve en las cimas
    g.fillStyle(0x4fc3f7, 0.3);
    g.fillTriangle(160, 230, 200, 200, 240, 230);
    g.fillTriangle(420, 170, 450, 150, 480, 170);
    g.fillTriangle(730, 235, 750, 220, 765, 235);
    g.fillTriangle(1080, 185, 1100, 170, 1115, 185);

    // Represa al fondo (estructura de concreto)
    g.fillStyle(COLORES.estructura_oscura);
    g.fillRect(540, 480, 200, 130);
    // Detalle de compuertas
    g.fillStyle(0x1a2a3a);
    for (let i = 0; i < 3; i++) {
      g.fillRect(550 + i * 60, 490, 40, 80);
    }

    // Agua del embalse
    g.fillStyle(0x0d2b3e, 0.9);
    g.fillRect(0, 560, 540, 160);

    // Luces amarillas de trabajo en la represa
    g.fillStyle(0xf4d35e, 0.9);
    for (let i = 0; i < 5; i++) {
      g.fillCircle(560 + i * 45, 485, 3);
    }

    // Niebla baja
    g.fillStyle(0x1a2a3a, 0.3);
    g.fillRect(0, 580, 1280, 80);
  }

  _crearBoton(x, y, texto, callback, colorBorde = 0x52b788) {
    const w = 360;
    const h = 44;

    const bg = this.add.rectangle(x, y, w, h, 0x111111)
      .setStrokeStyle(1, colorBorde)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y, texto, {
      fontSize: '14px', fontFamily: 'Courier New, monospace',
      color: `#${colorBorde.toString(16).padStart(6, '0')}`,
      align: 'center',
    }).setOrigin(0.5);

    // Hover
    bg.on('pointerover', () => {
      bg.setFillStyle(colorBorde, 0.15);
      label.setColor('#ffffff');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x111111);
      label.setColor(`#${colorBorde.toString(16).padStart(6, '0')}`);
    });
    bg.on('pointerdown', () => {
      this.cameras.main.flash(100, 82, 183, 136, false);
      this.time.delayedCall(150, callback);
    });

    return { bg, label };
  }
}
