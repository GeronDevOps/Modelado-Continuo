/**
 * Alarmas.js
 * Sistema de alarmas visuales y sonoras para el HMI.
 *
 * Alarmas implementadas:
 *   - PELIGRO: REBOSAMIENTO  (V > 45 hm³)  — Rojo intermitente + sirena aguda
 *   - ADVERTENCIA: CAVITACIÓN (V < 10 hm³)  — Naranja intermitente + tono grave
 *   - AVISO: TORMENTA (caudal elevado)      — Azul, informativo (Nivel 2)
 */

import { COLORES, LIMITES } from '../config/constantes.js';

export class SistemaAlarmas {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x     - Posición X del panel de alarmas
   * @param {number} y     - Posición Y del panel de alarmas
   * @param {number} width - Ancho del panel
   */
  constructor(scene, x, y, width = 300) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;

    this.alarmaRebosamiento = false;
    this.alarmaCavitacion = false;
    this.avisoTormenta = false;
    this.silenciada = false;
    this._tiktok = 0;
    this._ctxAudio = null;
    this._visibleAnterior = false;

    this._construir();
  }

  _construir() {
    const s = this.scene;

    // Panel alarma rebosamiento
    this.panelRebo = s.add.rectangle(
      this.x + this.width / 2, this.y + 14,
      this.width, 26, 0x300000
    ).setDepth(20).setVisible(false);
    this.panelRebo.setStrokeStyle(1, COLORES.alarma_alta);

    this.textoRebo = s.add.text(
      this.x + this.width / 2, this.y + 14,
      '⚠  ¡PELIGRO: REBOSAMIENTO!  ⚠',
      {
        fontSize: '12px', fontFamily: 'Courier New, monospace',
        color: '#e63946', align: 'center',
      }
    ).setOrigin(0.5).setDepth(21).setVisible(false);

    // Panel alarma cavitación
    this.panelCav = s.add.rectangle(
      this.x + this.width / 2, this.y + 44,
      this.width, 26, 0x302000
    ).setDepth(20).setVisible(false);
    this.panelCav.setStrokeStyle(1, COLORES.alarma_baja);

    this.textoCav = s.add.text(
      this.x + this.width / 2, this.y + 44,
      '⚠  ¡ADVERTENCIA: CAVITACIÓN!  ⚠',
      {
        fontSize: '12px', fontFamily: 'Courier New, monospace',
        color: '#f4a261', align: 'center',
      }
    ).setOrigin(0.5).setDepth(21).setVisible(false);

    // Aviso de tormenta (informativo)
    this.panelTormenta = s.add.rectangle(
      this.x + this.width / 2, this.y + 74,
      this.width, 26, 0x001a30
    ).setDepth(20).setVisible(false);
    this.panelTormenta.setStrokeStyle(1, COLORES.linea_V_bright);

    this.textoTormenta = s.add.text(
      this.x + this.width / 2, this.y + 74,
      '☂  TORMENTA: CAUDAL DEL RÍO EN ALZA — ABRIR VERTEDERO',
      {
        fontSize: '10px', fontFamily: 'Courier New, monospace',
        color: '#4fc3f7', align: 'center',
      }
    ).setOrigin(0.5).setDepth(21).setVisible(false);

    // Silenciar con la tecla A
    s.input.keyboard.on('keydown-A', () => { this.silenciada = !this.silenciada; });
  }

  /**
   * Evalúa el volumen actual y activa/desactiva las alarmas.
   * @param {number} V - Volumen actual del embalse [hm³]
   * @param {number} [Qrio] - Caudal del río [hm³/h] (opcional, para aviso de tormenta)
   */
  evaluar(V, Qrio = 0) {
    this.alarmaRebosamiento = V > LIMITES.V_alarma_alta;
    this.alarmaCavitacion   = V < LIMITES.V_alarma_baja;
    this.avisoTormenta      = Qrio > 1.2;
  }

  /**
   * Actualiza el parpadeo de las alarmas. Llamar en update() de la escena.
   * @param {number} delta - Delta time de Phaser [ms]
   */
  actualizar(delta) {
    this._tiktok += delta;
    const visible = (this._tiktok % 700) < 350;  // Parpadea a ~1.4 Hz

    // Rebosamiento
    const mostrarRebo = this.alarmaRebosamiento;
    this.panelRebo.setVisible(mostrarRebo);
    this.textoRebo.setVisible(mostrarRebo && visible);

    // Cavitación
    const mostrarCav = this.alarmaCavitacion;
    this.panelCav.setVisible(mostrarCav);
    this.textoCav.setVisible(mostrarCav && visible);

    // Tormenta
    this.panelTormenta.setVisible(this.avisoTormenta);
    this.textoTormenta.setVisible(this.avisoTormenta);

    // Sonido: un pitido en cada flanco de subida del parpadeo
    if (visible && !this._visibleAnterior) {
      if (mostrarRebo) this._pitido(880, 0.25);
      else if (mostrarCav) this._pitido(330, 0.3);
    }
    this._visibleAnterior = visible;
  }

  /** Genera un pitido con WebAudio (sin assets externos). */
  _pitido(frecuencia, duracion) {
    if (this.silenciada) return;
    try {
      this._ctxAudio = this._ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._ctxAudio;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = frecuencia;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracion);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duracion);
    } catch (e) {
      // Audio no disponible: la alarma visual sigue funcionando
    }
  }

  /**
   * Limpia todas las alarmas (para reinicio de nivel).
   */
  reset() {
    this.alarmaRebosamiento = false;
    this.alarmaCavitacion = false;
    this.avisoTormenta = false;
    this._tiktok = 0;
    this.panelRebo.setVisible(false);
    this.textoRebo.setVisible(false);
    this.panelCav.setVisible(false);
    this.textoCav.setVisible(false);
    this.panelTormenta.setVisible(false);
    this.textoTormenta.setVisible(false);
  }
}
