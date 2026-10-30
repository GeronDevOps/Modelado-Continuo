/**
 * main.js
 * Entry point de Vite. Configura e inicia Phaser 3.
 */

import Phaser from 'phaser';
import { BootScene }      from './escenas/BootScene.js';
import { MenuScene }      from './escenas/MenuScene.js';
import { JuegoScene }     from './escenas/JuegoScene.js';
import { CalibracionScene } from './escenas/CalibracionScene.js';
import { NivelesScene }     from './escenas/NivelesScene.js';
import { ResultadosScene } from './escenas/ResultadosScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, NivelesScene, CalibracionScene, JuegoScene, ResultadosScene],
};

// Arrancar el juego
const game = new Phaser.Game(config);

// Exponer instancia para debugging en consola
if (import.meta.env.DEV) {
  window.__game = game;
}
