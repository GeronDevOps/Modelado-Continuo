/**
 * ManoCamara.js
 * Entrada biométrica con MediaPipe HandLandmarker (modo VIDEO).
 *
 *   - Mano DERECHA: altura de la muñeca (landmark 0) → apertura de turbinas u_t.
 *   - Mano IZQUIERDA: puño cerrado → vertedero abierto (u_v).
 *
 * Si la cámara o el modelo no están disponibles, `estado` pasa a 'error' y la
 * escena de juego continúa con el teclado.
 */

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CAMARA } from '../config/constantes.js';
import { esPuno, separarManos } from './gestos.js';

export class ManoCamara {
  constructor() {
    this.estado = 'inactivo';   // inactivo | cargando | listo | error
    this.mensajeError = '';
    this.video = null;
    this.stream = null;
    this.landmarker = null;
    this._ultimoTs = -1;

    // Señales (actualizadas en cada llamada a actualizar())
    this.manoDerechaVisible = false;
    this.manoIzquierdaVisible = false;
    this.yMuneca = null;        // Suavizada, [0,1], 0 = arriba
    this.yMunecaCruda = null;
    this.puno = false;
    this.landmarksDerecha = null;
    this.landmarksIzquierda = null;
  }

  async iniciar() {
    if (this.estado === 'listo' || this.estado === 'cargando') return;
    this.estado = 'cargando';
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador no soporta acceso a cámara.');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.playsInline = true;
      this.video.muted = true;
      await this.video.play();

      const fileset = await FilesetResolver.forVisionTasks(CAMARA.wasm_url);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: CAMARA.modelo_url },
        runningMode: 'VIDEO',
        numHands: 2,
      });
      this.estado = 'listo';
    } catch (err) {
      this.estado = 'error';
      this.mensajeError = err?.message || String(err);
      this.detener();
      this.estado = 'error';
    }
  }

  /**
   * Procesa el frame actual. Llamar una vez por frame de Phaser.
   * @param {number} ahoraMs - performance.now()
   */
  actualizar(ahoraMs) {
    if (this.estado !== 'listo' || !this.video || this.video.readyState < 2) return;
    // detectForVideo exige marcas de tiempo estrictamente crecientes
    const ts = Math.floor(ahoraMs);
    if (ts <= this._ultimoTs) return;
    this._ultimoTs = ts;

    const res = this.landmarker.detectForVideo(this.video, ts);
    const { derecha, izquierda } = separarManos(res);

    this.landmarksDerecha = derecha;
    this.landmarksIzquierda = izquierda;
    this.manoDerechaVisible = !!derecha;
    this.manoIzquierdaVisible = !!izquierda;

    if (derecha) {
      // Estrictamente la muñeca (landmark 0), nunca el centro de la palma
      const y = derecha[CAMARA.landmark_muneca].y;
      this.yMunecaCruda = y;
      this.yMuneca = this.yMuneca === null
        ? y
        : this.yMuneca + CAMARA.suavizado * (y - this.yMuneca);
    }
    this.puno = izquierda ? esPuno(izquierda) : false;
  }

  /** Dibuja el frame (espejado, como un espejo) en un canvas 2D. */
  dibujarEn(ctx, w, h) {
    if (!this.video || this.video.readyState < 2) return;
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0, w, h);
    ctx.restore();
  }

  detener() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.landmarker?.close?.();
    this.landmarker = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
    if (this.estado !== 'error') this.estado = 'inactivo';
  }
}
