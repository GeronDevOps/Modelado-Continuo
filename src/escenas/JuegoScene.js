/**
 * JuegoScene.js
 * Escena principal de juego — HMI estilo sala de control 90s.
 * Integra el modelo matemático continuo (SistemaContinuo + RK4)
 * con controles de teclado y visualización en tiempo real.
 *
 * Nivel 1: Turno Tranquilo
 *   - V0=30 hm³, Qrío=0.5 hm³/h constante, P_demanda=47.4 MW
 *   - Duración: 120 s de juego
 *   - Criterio: ≥30 s en banda [27,33] hm³ + error P ≤ 5%
 * Nivel 2: Tormenta Cordillerana
 *   - Caudal del río con pulso de tormenta; vertedero habilitado
 *   - Entrada por cámara: muñeca derecha (landmark 0) → u_t; puño izquierdo → u_v
 *   - Criterio: sin rebosamiento ni cavitación, |V_final − 30| ≤ 5 y error P medio ≤ 15%
 */

import { SistemaContinuo } from '../modelo/SistemaContinuo.js';
import { rk4, H_PASO, integrarDt } from '../modelo/integradores.js';
import { saturar } from '../modelo/SistemaContinuo.js';
import { GraficaTendencia } from '../ui/GraficaTendencia.js';
import { GaugeHidraulico } from '../ui/GaugeHidraulico.js';
import { SistemaAlarmas } from '../ui/Alarmas.js';
import { aperturaDesdeAltura, calibracionValida } from '../entrada/gestos.js';
import {
  COLORES, NIVEL1, NIVEL2, NIVEL3, LIMITES, EQUILIBRIO, ACTUADORES, TIEMPO,
  caudalPorNivel, demandaPorNivel,
} from '../config/constantes.js';
import { demandaEfectiva } from '../modelo/SistemaContinuo.js';
import { EfectosClima } from '../ui/Efectos.js';

export class JuegoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JuegoScene' });
  }

  init(data) {
    this.nivelConfig = data?.nivel === 3 ? NIVEL3 : (data?.nivel === 2 ? NIVEL2 : NIVEL1);
    this.nivelId = this.nivelConfig.id;

    // Entrada por cámara solo si está lista y calibrada
    const camara = this.registry.get('camara');
    const calib = this.registry.get('calibracion');
    this.usarCamara = !!camara && camara.estado === 'listo' && calibracionValida(calib);
    this.camara = this.usarCamara ? camara : null;
    this.calib = this.usarCamara ? calib : null;
  }

  create() {
    // ─── MODELO ───────────────────────────────────────────────────────────────
    this.sistema = new SistemaContinuo(
      EQUILIBRIO.V0,
      EQUILIBRIO.ut0,
      0.0,
      this.nivelConfig.Qrio
    );
    this.sistema.Qrio = this.nivelConfig.Qrio;
    this.utObjetivo = EQUILIBRIO.ut0;   // Consigna de la compuerta (la compuerta la sigue con velocidad limitada)
    this.uvObjetivo = 0;

    // ─── ESTADO DEL JUEGO ─────────────────────────────────────────────────────
    this.tiempoJuego = 0;               // s de juego transcurridos
    this.duracion = this.nivelConfig.duracion_s;
    this.pausado = false;
    this.debugMode = false;
    this.gameOver = false;

    // Métricas de éxito
    this.tiempoBanda = 0;               // s continuos calibrados en la banda de V y potencia
    this.tiempoBandaMax = 0;
    this.metaCalibracion = this.nivelConfig.tiempo_banda_minimo ?? 30;
    this.completadoTemprano = false;
    this.acumErrorP = 0;
    this.muestrasP = 0;
    this.tiempoRebosamiento = 0;        // s con V > V_alarma_alta
    this.tiempoCavitacion = 0;          // s con V < V_alarma_baja
    this.Vmax = EQUILIBRIO.V0;
    this.Vmin = EQUILIBRIO.V0;
    this.desborde = false;
    this.descebe = false;
    this.acumSqErrP = 0;                // ∫(P − P_ref)² dt  [MW²·s]
    this.tiempoEnBandaTotal = 0;        // s totales en la banda de V
    this.desvMax = 0;                   // máx |V − V0|
    this.intensidadTormenta = 0;

    // Historial para CSV final
    this.registros = [];

    // ─── FONDO HMI ────────────────────────────────────────────────────────────
    this._construirHMI();

    // ─── EFECTOS: lluvia, relámpagos, rocío del vertedero ────────────────────
    this.efectos = new EfectosClima(this, { x: 12, y: 52, w: 636, h: 440 });
    this.events.once('shutdown', () => this.efectos?.destruir());
    // ─── CONTROLES ────────────────────────────────────────────────────────────
    this._configurarTeclado();

    // ─── ACTUALIZACIÓN PERIÓDICA (10 Hz para gráficas) ────────────────────────
    this.timerGrafica = this.time.addEvent({
      delay: 100,   // 100 ms = 10 veces por segundo
      loop: true,
      callback: this._muestrearGrafica,
      callbackScope: this,
    });
  }

  // ─── CONSTRUCCIÓN DEL HMI ──────────────────────────────────────────────────

  _construirHMI() {
    const W = 1280;
    const H = 720;

    // Fondo principal
    this.add.rectangle(W / 2, H / 2, W, H, COLORES.fondo);

    // ─── ENCABEZADO ───────────────────────────────────────────────────────────
    this._construirEncabezado();

    // ─── PANEL IZQUIERDO: Diagrama visual de la represa ───────────────────────
    this._construirPanelRepresa();

    // ─── PANEL CENTRO-DERECHA: Gráfica de tendencia ───────────────────────────
    this.graficaTendencia = new GraficaTendencia(
      this, 660, 60, 590, 300,
      { ventana_s: 30, P_min: 0, P_max: 160, V_min: 0, V_max: 60 }
    );

    // ─── PANEL INFERIOR DERECHO: Indicadores ──────────────────────────────────
    this._construirIndicadores();

    // ─── GAUGE HIDRÁULICO ─────────────────────────────────────────────────────
    this.gauge = new GaugeHidraulico(this, 1180, 530, 60, 20, 60, 'H [m]');
    this.gauge.actualizar(this.sistema.H);

    // ─── SISTEMA DE ALARMAS ───────────────────────────────────────────────────
    this.alarmas = new SistemaAlarmas(this, 490, 4, 490);

    // ─── BARRA DE PROGRESO DE TIEMPO ──────────────────────────────────────────
    this._construirBarraTiempo();

    // ─── DEBUG OVERLAY ────────────────────────────────────────────────────────
    this._construirDebug();

    // ─── VISTA PREVIA DE CÁMARA (si se usa) ───────────────────────────────────
    if (this.usarCamara) this._construirPreviewCamara();
  }

  _construirPreviewCamara() {
    const w = 160, h = 120, x = 1090, y = 592;
    if (this.textures.exists('cam_juego')) this.textures.remove('cam_juego');
    this.texCamJuego = this.textures.createCanvas('cam_juego', w, h);
    this.add.image(x + w / 2, y + h / 2, this.texCamJuego).setDepth(10);
    this.add.rectangle(x + w / 2, y + h / 2, w + 2, h + 2).setStrokeStyle(1, COLORES.borde_panel)
      .setFillStyle(0, 0).setDepth(11);
    this.marcadorCam = this.add.graphics().setDepth(12);
    this._prevCam = { w, h, x, y };
    this.textoManos = this.add.text(x, y - 12, '', {
      fontSize: '9px', fontFamily: 'Courier New', color: '#888888',
    }).setDepth(12);
  }

  _actualizarPreviewCamara() {
    const { w, h, x, y } = this._prevCam;
    const cam = this.camara;
    cam.dibujarEn(this.texCamJuego.getContext(), w, h);
    this.texCamJuego.refresh();

    const gm = this.marcadorCam;
    gm.clear();
    // Banda de calibración: línea verde (abierta) y roja (cerrada)
    gm.lineStyle(1, 0xe63946, 0.8);
    gm.beginPath(); gm.moveTo(x, y + this.calib.yBajo * h); gm.lineTo(x + w, y + this.calib.yBajo * h); gm.strokePath();
    gm.lineStyle(1, 0x52b788, 0.8);
    gm.beginPath(); gm.moveTo(x, y + this.calib.yAlto * h); gm.lineTo(x + w, y + this.calib.yAlto * h); gm.strokePath();
    if (cam.landmarksDerecha) {
      const m = cam.landmarksDerecha[0];
      gm.fillStyle(0x52b788, 1); gm.fillCircle(x + (1 - m.x) * w, y + m.y * h, 4);
    }
    if (cam.landmarksIzquierda) {
      const m = cam.landmarksIzquierda[0];
      gm.fillStyle(cam.puno ? 0xe63946 : 0xf4d35e, 1); gm.fillCircle(x + (1 - m.x) * w, y + m.y * h, 4);
    }
    this.textoManos.setText(
      `DER:${cam.manoDerechaVisible ? 'OK' : '--'}  IZQ:${cam.manoIzquierdaVisible ? (cam.puno ? 'PUÑO' : 'OK') : '--'}`
    );
  }

  _construirEncabezado() {
    // Fondo de encabezado
    this.add.rectangle(640, 22, 1280, 44, 0x0a0a0a)
      .setStrokeStyle(0, 0).setDepth(5);
    this.add.rectangle(640, 43, 1280, 1, COLORES.linea_P, 0.4).setDepth(5);

    // Logo / nombre
    this.add.text(12, 6, '◉ CENTRAL PATAGÓNICA — SALA DE CONTROL', {
      fontSize: '11px', fontFamily: 'Courier New, monospace',
      color: '#52b788', letterSpacing: 2,
    }).setDepth(6);

    // Nivel
    this.add.text(12, 22, `NIVEL ${this.nivelId}: ${this.nivelConfig.nombre}  |  ENTRADA: ${this.usarCamara ? 'CÁMARA' : 'TECLADO'}`, {
      fontSize: '9px', fontFamily: 'Courier New, monospace', color: '#444444',
    }).setDepth(6);

    // Reloj de tiempo de juego (dinámico)
    this.textoReloj = this.add.text(640, 14, '00:00 / 02:00', {
      fontSize: '20px', fontFamily: 'Courier New, monospace',
      color: '#52b788', align: 'center',
    }).setOrigin(0.5).setDepth(6);

    // Estado del sistema
    this.textoEstado = this.add.text(640, 30, 'SISTEMA OPERATIVO', {
      fontSize: '9px', fontFamily: 'Courier New, monospace',
      color: '#444444', align: 'center',
    }).setOrigin(0.5).setDepth(6);

    // Hora real
    this.textoHoraReal = this.add.text(1268, 14, '', {
      fontSize: '10px', fontFamily: 'Courier New, monospace',
      color: '#333333', align: 'right',
    }).setOrigin(1, 0.5).setDepth(6);

    this.textoHoraSimulada = this.add.text(1268, 28, '', {
      fontSize: '9px', fontFamily: 'Courier New, monospace',
      color: '#1c5270', align: 'right',
    }).setOrigin(1, 0.5).setDepth(6);
  }

  _construirPanelRepresa() {
    const px = 10;
    const py = 50;
    const pw = 640;
    const ph = 670;

    // Fondo del panel
    this.add.rectangle(px + pw / 2, py + ph / 2, pw, ph, 0x0d0d0d)
      .setStrokeStyle(1, 0x222222).setDepth(5);

    this.add.text(px + 6, py + 6, 'DIAGRAMA DE PLANTA', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#444444',
    }).setDepth(6);

    // ─── BANNER DE INSTRUCCIONES DEL NIVEL ────────────────────────────────────
    this.add.rectangle(px + pw / 2, py + 42, pw - 16, 40, 0x0a141e, 0.9)
      .setStrokeStyle(1, COLORES.linea_P, 0.5).setDepth(8);
    this.textoInstruccion = this.add.text(px + 14, py + 28,
      this.nivelConfig.instruccion || '',
      {
        fontSize: '10px', fontFamily: 'Courier New', color: '#52b788',
        wordWrap: { width: pw - 28 },
      }
    ).setDepth(9);
    this.textoGuiaDinamica = this.add.text(px + 14, py + 46,
      'Estado: Calibrando sistema...',
      {
        fontSize: '10px', fontFamily: 'Courier New', color: '#f4d35e',
      }
    ).setDepth(9);

    // ─── DIAGRAMA SVG-LIKE DE LA REPRESA ──────────────────────────────────────
    const g = this.add.graphics().setDepth(6);

    // Montañas de fondo
    g.fillStyle(0x0a1520);
    g.fillTriangle(30, 400, 150, 200, 280, 400);
    g.fillTriangle(200, 400, 320, 160, 450, 400);
    g.fillStyle(0x0d1f30, 0.5);
    g.fillTriangle(400, 400, 500, 230, 600, 400);

    // Suelo
    g.fillStyle(0x151515);
    g.fillRect(30, 530, 590, 120);

    // Estructura de la represa
    g.fillStyle(COLORES.estructura_oscura);
    g.fillRect(270, 300, 100, 240);
    // Detalles de la presa
    g.fillStyle(0x1a2a3a);
    g.fillRect(275, 320, 30, 180);
    g.fillRect(315, 320, 30, 180);

    // Embalse (agua) — tamaño dinámico
    this.graficoAgua = this.add.graphics().setDepth(6);
    this._actualizarDiagramaAgua(this.sistema.V);

    // Cuerpo de la represa (encima del agua)
    g.fillStyle(COLORES.estructura_oscura);
    g.fillRect(265, 290, 110, 20);  // Corona de la presa
    // Parapeto
    g.fillStyle(0x3d5a80);
    for (let i = 0; i < 5; i++) {
      g.fillRect(272 + i * 22, 278, 14, 14);
    }

    // Tuberías de turbinas
    g.lineStyle(6, 0x1a2a3a, 1);
    g.beginPath(); g.moveTo(285, 450); g.lineTo(285, 540); g.strokePath();
    g.beginPath(); g.moveTo(325, 450); g.lineTo(325, 540); g.strokePath();

    // Edificio sala de máquinas
    g.fillStyle(0x1a2a3a);
    g.fillRect(250, 540, 180, 60);
    g.fillStyle(0x0d1520);
    g.fillRect(258, 548, 40, 45);
    g.fillRect(308, 548, 40, 45);
    g.fillRect(358, 548, 40, 45);
    // Ventanas iluminadas
    g.fillStyle(0xf4d35e, 0.6);
    g.fillRect(265, 555, 26, 30);
    g.fillRect(315, 555, 26, 30);
    g.fillRect(365, 555, 26, 30);

    // Río aguas abajo
    g.fillStyle(0x0d2b3e, 0.7);
    g.fillRect(370, 545, 260, 35);
    g.fillStyle(0x1c5270, 0.4);
    g.fillRect(370, 545, 260, 10);

    // Torres de transmisión
    g.lineStyle(2, 0x444444);
    g.beginPath(); g.moveTo(550, 520); g.lineTo(560, 420); g.strokePath();
    g.beginPath(); g.moveTo(570, 520); g.lineTo(560, 420); g.strokePath();
    g.beginPath(); g.moveTo(555, 460); g.lineTo(540, 460); g.strokePath();
    g.beginPath(); g.moveTo(555, 460); g.lineTo(575, 460); g.strokePath();

    // ─── COMPUERTAS ANIMADAS (turbinas y vertedero) ──────────────────────────
    this.graficoCompuertas = this.add.graphics().setDepth(7);
    this.add.text(278, 440, 'T', { fontSize: '9px', fontFamily: 'Courier New', color: '#52b788' }).setDepth(8);
    this.add.text(334, 306, 'V', { fontSize: '9px', fontFamily: 'Courier New', color: '#f4a261' }).setDepth(8);
    this._actualizarCompuertas(this.sistema.ut, this.sistema.uv);

    // ─── BARRA VISUAL DE U_T (apertura turbinas) ─────────────────────────────
    this._construirBarraApertura(px + 6, py + ph - 120);

    // ─── INDICADORES NUMÉRICOS PRINCIPALES ────────────────────────────────────
    this._construirIndicadoresPlanta(px + 6, py + ph - 220);
  }

  _actualizarDiagramaAgua(V) {
    this.graficoAgua.clear();
    const t = V / 50.0;  // Normalizado [0,1]
    // Embalse: de y=490 (vacío) hasta y=310 (lleno)
    const yLleno = 305;
    const yVacio = 490;
    const yAgua = yVacio - (yVacio - yLleno) * t;

    // Color según nivel: azul oscuro → azul brillante → verde alerta
    let colorAgua = EfectosClima.colorAgua(this.intensidadTormenta);
    if (V > LIMITES.V_alarma_alta) colorAgua = COLORES.alarma_alta;
    else if (V < LIMITES.V_alarma_baja) colorAgua = 0x0a1520;

    this.graficoAgua.fillStyle(colorAgua, 0.85);
    this.graficoAgua.fillRect(30, yAgua, 240, yVacio - yAgua);

    // Olas en la superficie
    this.graficoAgua.lineStyle(1, 0x4fc3f7, 0.3);
    this.graficoAgua.beginPath();
    for (let x = 30; x < 270; x += 20) {
      this.graficoAgua.moveTo(x, yAgua + 3);
      this.graficoAgua.lineTo(x + 10, yAgua);
    }
    this.graficoAgua.strokePath();

    // Línea de nivel objetivo (V=30 hm³)
    const yObj = yVacio - (yVacio - yLleno) * (30 / 50);
    this.graficoAgua.lineStyle(1, COLORES.linea_Pdem, 0.5);
    this.graficoAgua.beginPath();
    this.graficoAgua.moveTo(30, yObj);
    this.graficoAgua.lineTo(268, yObj);
    this.graficoAgua.strokePath();

    // Banda de seguridad [27, 33]
    const yBandaHigh = yVacio - (yVacio - yLleno) * (33 / 50);
    const yBandaLow  = yVacio - (yVacio - yLleno) * (27 / 50);
    this.graficoAgua.fillStyle(0xf4d35e, 0.05);
    this.graficoAgua.fillRect(30, yBandaHigh, 238, yBandaLow - yBandaHigh);
  }

  /**
   * Dibuja las compuertas deslizantes sobre la presa.
   *   Turbinas: ranura x∈[286,314], y∈[440,500]; la placa sube al abrir (ut→1).
   *   Vertedero: ranura x∈[322,350], y∈[320,380]; la placa sube al abrir (uv→1)
   *              y cae una cascada al río cuando hay flujo.
   */
  _actualizarCompuertas(ut, uv) {
    const g = this.graficoCompuertas;
    g.clear();

    // — Turbinas —
    const tx = 286, ty = 440, tw = 28, th = 60;
    g.fillStyle(0x050a10, 1);
    g.fillRect(tx, ty, tw, th);                         // ranura (hueco)
    g.fillStyle(0x1c5270, 0.7 * Math.min(1, ut * 3));   // agua pasando
    g.fillRect(tx + 2, ty + th - th * ut, tw - 4, th * ut);
    const placaT = th * (1 - ut);                       // altura de la placa visible
    g.fillStyle(0x6b7b8c, 1);
    g.fillRect(tx, ty, tw, placaT);                     // placa cerrada desde arriba
    g.lineStyle(1, 0x9fb0c0, 1);
    g.strokeRect(tx, ty, tw, th);
    if (ut > 0.02) {                                    // chorro hacia la sala de máquinas
      g.fillStyle(COLORES.linea_V_bright, 0.5);
      g.fillRect(tx + 8, ty + th, 12, 40 * Math.min(1, ut * 1.5));
    }

    // — Vertedero —
    const vx = 322, vy = 320, vw = 28, vh = 60;
    g.fillStyle(0x050a10, 1);
    g.fillRect(vx, vy, vw, vh);
    if (uv > 0.02) {
      g.fillStyle(COLORES.linea_V_bright, 0.6);
      g.fillRect(vx + 2, vy + vh - vh * uv, vw - 4, vh * uv);
      // Cascada por el paramento de aguas abajo hasta el río
      g.fillStyle(0xcfefff, 0.35 + 0.35 * uv);
      g.fillRect(371, 330, 10 + 16 * uv, 215);
      const t = this.time.now / 80;
      g.fillStyle(0xffffff, 0.5);
      for (let i = 0; i < 6; i++) {
        const yy = 330 + ((t * 6 + i * 36) % 215);
        g.fillRect(373 + (i % 3) * 5, yy, 3, 8);
      }
      // Espuma al pie
      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(378 + 8 * uv, 545, 6 + 6 * uv);
      g.fillCircle(392 + 8 * uv, 547, 4 + 5 * uv);
    }
    const placaV = vh * (1 - uv);
    g.fillStyle(0x8a6d4b, 1);
    g.fillRect(vx, vy, vw, placaV);
    g.lineStyle(1, 0xf4a261, 1);
    g.strokeRect(vx, vy, vw, vh);
  }

  _construirBarraApertura(x, y) {
    const bw = 240;

    this.add.text(x, y, 'APERTURA TURBINAS  u_t', {
      fontSize: '9px', fontFamily: 'Courier New', color: '#444444',
    }).setDepth(8);

    // Fondo barra
    this.add.rectangle(x + bw / 2 + 2, y + 18, bw + 4, 18, 0x1a1a1a)
      .setStrokeStyle(1, 0x333333).setDepth(8);

    // Relleno dinámico
    this.barraApertura = this.add.rectangle(x + 2, y + 18, 0, 14, COLORES.linea_P)
      .setOrigin(0, 0.5).setDepth(9);

    // Texto porcentaje
    this.textoApertura = this.add.text(x + bw + 10, y + 18, '44%', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#52b788',
    }).setOrigin(0, 0.5).setDepth(9);

    // Marcas 0% 50% 100%
    const marcas = ['0%', '50%', '100%'];
    marcas.forEach((m, i) => {
      this.add.text(x + 2 + (bw / 2) * i, y + 28, m, {
        fontSize: '8px', fontFamily: 'Courier New', color: '#333333',
      }).setOrigin(0.5, 0).setDepth(9);
    });

    this._barraAperturaX = x + 2;
    this._barraAperturaMaxW = bw;
  }

  _construirIndicadoresPlanta(x, y) {
    const estilo = { fontSize: '11px', fontFamily: 'Courier New', color: '#888888' };
    const estiloVal = { fontSize: '16px', fontFamily: 'Courier New', color: '#52b788' };

    const cols = [
      { label: 'V [hm³]',  key: 'textoV',  colColor: '#4fc3f7' },
      { label: 'P [MW]',   key: 'textoP',  colColor: '#52b788' },
      { label: 'P_dem [MW]', key: 'textoPdem', colColor: '#f4d35e' },
      { label: 'Q_río',    key: 'textoQ',  colColor: '#888888' },
    ];

    cols.forEach((col, i) => {
      const cx = x + i * 155;
      this.add.text(cx, y, col.label, {
        fontSize: '9px', fontFamily: 'Courier New', color: '#444444',
      }).setDepth(8);

      const separador = this.add.rectangle(cx - 2, y + 4, 130, 1, 0x222222).setDepth(8).setOrigin(0, 0);

      this[col.key] = this.add.text(cx, y + 10, '---.--', {
        fontSize: '20px', fontFamily: 'Courier New', color: col.colColor,
        fontStyle: 'bold',
      }).setDepth(8);
    });
  }

  _construirIndicadores() {
    const x = 665;
    const y = 375;
    const w = 580;
    const h = 200;

    this.add.rectangle(x + w / 2 - 5, y + h / 2, w, h, 0x0d0d0d)
      .setStrokeStyle(1, 0x222222).setDepth(5);
    this.add.text(x, y + 6, 'PANEL DE INSTRUMENTOS', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#444444',
    }).setDepth(6);

    // Indicadores de estado (derecha)
    const campos = [
      { label: 'TIEMPO DE JUEGO',     key: 'indTiempo',   color: '#52b788' },
      { label: 'TIEMPO REAL SIMULADO',key: 'indHoraReal', color: '#1c5270' },
      { label: 'V — NIVEL EMBALSE',   key: 'indV',        color: '#4fc3f7' },
      { label: 'H — CABEZA HIDRÁULICA',key: 'indH',       color: '#888888' },
      { label: 'P — POTENCIA GEN.',   key: 'indP',        color: '#52b788' },
      { label: 'P — DEMANDA RED',     key: 'indPdem',     color: '#f4d35e' },
      { label: 'ERROR POTENCIA',      key: 'indErrP',     color: '#f4a261' },
      { label: 'CALIBRACIÓN (META 30s)', key: 'indBanda', color: '#52b788' },
    ];

    campos.forEach((c, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      const cx = x + col * 290;
      const cy = y + 28 + row * 40;

      this.add.text(cx, cy, c.label, {
        fontSize: '8px', fontFamily: 'Courier New', color: '#333333',
      }).setDepth(6);

      this[c.key] = this.add.text(cx, cy + 12, '---', {
        fontSize: '14px', fontFamily: 'Courier New', color: c.color,
      }).setDepth(6);
    });
  }

  _construirBarraTiempo() {
    const y = 588;
    this.add.rectangle(660, y, 600, 16, 0x0d0d0d)
      .setStrokeStyle(1, 0x222222).setDepth(5);

    this.barraTiempo = this.add.rectangle(661, y, 0, 12, COLORES.linea_P, 0.6)
      .setOrigin(0, 0.5).setDepth(6);

    this.add.text(665, y - 10, 'PROGRESO DEL TURNO', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#333333',
    }).setDepth(6);
  }

  _construirDebug() {
    this.panelDebug = this.add.container(660, 610).setDepth(30).setVisible(false);

    const bg = this.add.rectangle(290, 50, 580, 95, 0x050505)
      .setStrokeStyle(1, 0x333333);
    this.panelDebug.add(bg);

    this.textoDebug = this.add.text(6, 6,
      'DEBUG — dV/dt: 0.000 | A=-0.002 | B=[-1,-2] | E=1 | τ=2500s',
      {
        fontSize: '9px', fontFamily: 'Courier New', color: '#52b788',
        wordWrap: { width: 565 },
      }
    );
    this.panelDebug.add(this.textoDebug);

    this.add.text(660, 706,
      this.usarCamara
        ? '[MANO DER ↑↓] TURBINAS  [PUÑO IZQ] VERTEDERO  [P] PAUSA  [A] SILENCIAR  [D] DEBUG'
        : '[↑↓] TURBINAS  [ESPACIO] VERTEDERO  [P] PAUSA  [A] SILENCIAR  [D] DEBUG', {
      fontSize: '9px', fontFamily: 'Courier New', color: '#333333', align: 'center',
    }).setOrigin(0.5).setDepth(7);
  }

  // ─── TECLADO ───────────────────────────────────────────────────────────────

  _configurarTeclado() {
    this.keys = this.input.keyboard.addKeys({
      arriba:   Phaser.Input.Keyboard.KeyCodes.UP,
      abajo:    Phaser.Input.Keyboard.KeyCodes.DOWN,
      w:        Phaser.Input.Keyboard.KeyCodes.W,
      s:        Phaser.Input.Keyboard.KeyCodes.S,
      espacio:  Phaser.Input.Keyboard.KeyCodes.SPACE,
      pausa:    Phaser.Input.Keyboard.KeyCodes.P,
      debug:    Phaser.Input.Keyboard.KeyCodes.D,
      menu:     Phaser.Input.Keyboard.KeyCodes.M,
    });

    // Toggle pausa
    this.input.keyboard.on('keydown-P', () => {
      this.pausado = !this.pausado;
      this.textoEstado.setText(this.pausado ? '— PAUSA —' : 'SISTEMA OPERATIVO');
      this.textoEstado.setColor(this.pausado ? '#f4a261' : '#444444');
    });

    // Toggle debug
    this.input.keyboard.on('keydown-D', () => {
      this.debugMode = !this.debugMode;
      this.panelDebug.setVisible(this.debugMode);
    });

    // Menú
    this.input.keyboard.on('keydown-M', () => {
      this.scene.start('MenuScene');
    });
  }

  // ─── GAME LOOP ─────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.pausado || this.gameOver) return;

    const dt = delta / 1000;  // Convertir ms a s

    // ─── PERTURBACIONES: caudal del río y demanda según el nivel ─────────────
    this.sistema.Qrio = caudalPorNivel(this.nivelId, this.tiempoJuego);
    this.intensidadTormenta = this.nivelId === 1
      ? 0
      : Math.max(0, Math.min(1, (this.sistema.Qrio - 0.5) / 2.0));

    // ─── LECTURA DE CONTROLES ─────────────────────────────────────────────────
    this._procesarControles(dt, time);

    // ─── INTEGRACIÓN DEL MODELO ───────────────────────────────────────────────
    // Integrar con RK4 usando pasos fijos de 1/120 s
    this.sistema.V = integrarDt(
      (v) => this.sistema.f(v),
      this.sistema.V,
      dt,
      H_PASO,
      rk4
    );
    this.sistema.V = saturar(this.sistema.V, 0, LIMITES.V_max);
    this.sistema.t += dt;
    this.sistema.actualizarSalidas();

    // Avanzar tiempo de juego
    this.tiempoJuego += dt;

    // ─── MÉTRICAS DE ÉXITO ────────────────────────────────────────────────────
    this._actualizarMetricas(dt);

    // ─── ALARMAS ──────────────────────────────────────────────────────────────
    this.alarmas.evaluar(this.sistema.V, this.sistema.Qrio);
    this.alarmas.actualizar(delta);

    // ─── ACTUALIZAR HMI ───────────────────────────────────────────────────────
    this._actualizarHMI(dt);

    // ─── FIN DEL NIVEL (30s de calibración exitosa o 120s de límite / fallo) ──
    this.efectos.actualizar(dt, this.intensidadTormenta, this.sistema.uv, { x: 380, y: 545 });

    if (this.tiempoBanda >= this.metaCalibracion) {
      this.completadoTemprano = true;
      this._finalizarNivel();
    } else if (this.nivelId >= 2 && this.sistema.V >= LIMITES.V_max) {
      this.desborde = true;   // Embalse lleno: la presa desborda
      this._finalizarNivel();
    } else if (this.nivelId >= 2 && this.sistema.V <= LIMITES.V_min) {
      this.descebe = true;    // Embalse vacío: descebe de las turbinas
      this._finalizarNivel();
    } else if (this.tiempoJuego >= this.duracion) {
      this._finalizarNivel();
    }
  }

  _procesarControles(dt, time) {
    const velT = ACTUADORES.ut_velocidad_max;
    const velV = ACTUADORES.uv_velocidad_max;

    if (this.usarCamara) {
      // ─── CÁMARA: muñeca derecha (landmark 0) → u_t; puño izquierdo → u_v ────
      this.camara.actualizar(time);
      if (this.camara.manoDerechaVisible && this.camara.yMuneca !== null) {
        this.utObjetivo = aperturaDesdeAltura(this.camara.yMuneca, this.calib);
      }
      // Si se pierde la mano derecha se mantiene la última consigna
      this.uvObjetivo = (this.nivelConfig.uv_habilitado && this.camara.puno) ? 1.0 : 0.0;
      this._actualizarPreviewCamara();
    } else {
      // ─── TECLADO ─────────────────────────────────────────────────────────────
      if (this.keys.arriba.isDown || this.keys.w.isDown) {
        this.utObjetivo = saturar(this.utObjetivo + velT * dt, 0, 1);
      }
      if (this.keys.abajo.isDown || this.keys.s.isDown) {
        this.utObjetivo = saturar(this.utObjetivo - velT * dt, 0, 1);
      }
      if (this.nivelConfig.uv_habilitado) {
        this.uvObjetivo = this.keys.espacio.isDown ? 1.0 : 0.0;
      }
    }

    // Las compuertas siguen la consigna con velocidad limitada (actuador físico)
    const dUt = saturar(this.utObjetivo - this.sistema.ut, -velT * dt, velT * dt);
    this.sistema.ut = saturar(this.sistema.ut + dUt, 0, 1);
    const dUv = saturar(this.uvObjetivo - this.sistema.uv, -velV * dt, velV * dt);
    this.sistema.uv = saturar(this.sistema.uv + dUv, 0, 1);
  }

  /** Demanda eléctrica cruda en el instante actual [MW]. */
  _pdem() {
    return demandaPorNivel(this.nivelId, this.tiempoJuego);
  }

  /** Demanda de referencia alcanzable: min(P_demanda, P_max(V) + 5 MW). */
  _pdemRef() {
    const margen = this.nivelId === 3 ? NIVEL3.margen_Pmax_MW : 5;
    return demandaEfectiva(this._pdem(), this.sistema.V, margen);
  }

  _actualizarMetricas(dt) {
    const V = this.sistema.V;
    const P = this.sistema.P;
    const Pref = this._pdemRef();

    this.Vmax = Math.max(this.Vmax, V);
    this.Vmin = Math.min(this.Vmin, V);
    this.desvMax = Math.max(this.desvMax, Math.abs(V - EQUILIBRIO.V0));
    if (V > LIMITES.V_alarma_alta) this.tiempoRebosamiento += dt;
    if (V < LIMITES.V_alarma_baja) this.tiempoCavitacion += dt;

    // Tiempo en banda de V y potencia calibrada (30s para completar el nivel)
    const enBandaV = V >= (LIMITES.V_objetivo - LIMITES.V_banda) &&
                     V <= (LIMITES.V_objetivo + LIMITES.V_banda);
    const errorRelP = Math.abs(P - Pref) / Pref;
    const enBandaP = this.nivelId === 3
      ? Math.abs(P - Pref) <= NIVEL3.rmse_max_MW
      : errorRelP <= (this.nivelConfig.error_P_max ?? 0.05);

    this.enCalibracion = enBandaV && enBandaP;

    if (this.enCalibracion) {
      this.tiempoBanda += dt;
      this.tiempoEnBandaTotal += dt;
      this.tiempoBandaMax = Math.max(this.tiempoBandaMax, this.tiempoBanda);
    } else {
      this.tiempoBanda = 0;
    }

    // Error de potencia acumulado (relativo y cuadrático) contra la demanda de referencia
    this.acumErrorP += errorRelP * dt;
    this.acumSqErrP += (P - Pref) * (P - Pref) * dt;
    this.muestrasP += dt;
  }

  _muestrearGrafica() {
    if (this.gameOver) return;
    const t = this.tiempoJuego;
    const { V, P, H, ut, uv, Qrio } = this.sistema;
    const Pdem = this._pdem();

    this.graficaTendencia.agregar(t, P, Pdem, V);

    // Guardar registro para CSV
    this.registros.push({
      t_s: t.toFixed(3),
      V_hm3: V.toFixed(4),
      H_m: H.toFixed(3),
      ut: ut.toFixed(4),
      uv: uv.toFixed(4),
      Qrio: Qrio.toFixed(4),
      P_MW: P.toFixed(4),
      Pdemanda_MW: Pdem.toFixed(4),
      Pref_MW: this._pdemRef().toFixed(4),
    });
  }

  _actualizarHMI(dt) {
    const { V, P, H, ut } = this.sistema;
    const Pdem = this._pdem();
    const Pref = this._pdemRef();

    // Reloj de juego
    const seg = Math.floor(this.tiempoJuego);
    const min = Math.floor(seg / 60);
    const s2  = seg % 60;
    const totalMin = Math.floor(this.duracion / 60);
    const totalSeg = Math.floor(this.duracion % 60);
    this.textoReloj.setText(
      `${String(min).padStart(2,'0')}:${String(s2).padStart(2,'0')} / ` +
      `${String(totalMin).padStart(2,'0')}:${String(totalSeg).padStart(2,'0')}`
    );

    // Hora simulada (1 s juego = 12 min reales = 0.2 h)
    const horasSimuladas = this.tiempoJuego * TIEMPO.horas_por_segundo_juego;
    const hSim = Math.floor(horasSimuladas);
    const mSim = Math.floor((horasSimuladas - hSim) * 60);
    this.textoHoraSimulada.setText(`SIM: ${String(hSim).padStart(2,'0')}:${String(mSim).padStart(2,'0')} h`);
    this.textoHoraReal.setText(new Date().toLocaleTimeString('es-CL', { hour12: false }));

    // Indicadores del panel de planta
    this.textoV?.setText(V.toFixed(2));
    this.textoP?.setText(P.toFixed(2));
    this.textoPdem?.setText(Pdem.toFixed(2));
    this.textoQ?.setText(this.sistema.Qrio.toFixed(3));

    // Panel de instrumentos
    this.indTiempo?.setText(`${String(min).padStart(2,'0')}:${String(s2).padStart(2,'0')} s`);
    this.indHoraReal?.setText(`${String(hSim).padStart(2,'0')}:${String(mSim).padStart(2,'0')} h`);
    this.indV?.setText(`${V.toFixed(2)} hm³  ${this._estadoV(V)}`);
    this.indH?.setText(`${H.toFixed(1)} m`);
    this.indP?.setText(`${P.toFixed(2)} MW`);
    this.indPdem?.setText(`${Pdem.toFixed(2)} MW`);

    const errP = Math.abs(P - Pref) / Pref * 100;
    const umbralPct = this.nivelId === 3
      ? (NIVEL3.rmse_max_MW / Pref * 100)
      : ((this.nivelConfig.error_P_max ?? 0.05) * 100);
    const okP = errP <= umbralPct;
    this.indErrP?.setText(`${errP.toFixed(1)}%  ${okP ? '✓' : '✗'}`);
    this.indErrP?.setColor(okP ? '#52b788' : '#f4a261');

    const bandaActual = this.tiempoBanda.toFixed(1);
    const meta = this.metaCalibracion;
    this.indBanda?.setText(`${bandaActual}s / ${meta}s  ${this.enCalibracion ? '● CALIBRADO' : '○ AJUSTAR'}`);
    this.indBanda?.setColor(this.enCalibracion ? '#52b788' : '#f4a261');

    // Instrucciones dinámicas en tiempo real para guiar al jugador a completar los 30s
    if (this.textoGuiaDinamica) {
      if (this.enCalibracion) {
        const rest = Math.max(0, meta - this.tiempoBanda).toFixed(1);
        this.textoGuiaDinamica.setText(`✓ CALIBRACIÓN ESTABLE — Mantén así ${rest}s más para completar el nivel`);
        this.textoGuiaDinamica.setColor('#52b788');
      } else {
        const acciones = [];
        if (V > LIMITES.V_objetivo + LIMITES.V_banda) {
          acciones.push(this.nivelConfig.uv_habilitado
            ? 'Nivel V alto (>33 hm³): abre VERTEDERO [ESPACIO / Puño Izq] o sube turbinas'
            : 'Nivel V alto (>33 hm³): abre más las TURBINAS [↑ / Mano Der arriba]');
        } else if (V < LIMITES.V_objetivo - LIMITES.V_banda) {
          acciones.push('Nivel V bajo (<27 hm³): cierra VERTEDERO y reduce TURBINAS [↓ / Mano Der abajo]');
        }
        if (!okP) {
          acciones.push(P < Pref
            ? `Potencia baja (${P.toFixed(1)} < ${Pref.toFixed(1)} MW): SUBE turbinas [↑]`
            : `Potencia alta (${P.toFixed(1)} > ${Pref.toFixed(1)} MW): BAJA turbinas [↓]`);
        }
        this.textoGuiaDinamica.setText(`⚠ ${acciones.join('  |  ')}`);
        this.textoGuiaDinamica.setColor('#f4d35e');
      }
    }

    // Barra de apertura de turbinas
    if (this.barraApertura) {
      this.barraApertura.width = this._barraAperturaMaxW * ut;
      const pct = Math.round(ut * 100);
      this.textoApertura.setText(`${pct}%`);
      this.barraApertura.setFillStyle(ut > 0.8 ? COLORES.alarma_alta : COLORES.linea_P);
    }

    // Barra de progreso de tiempo
    if (this.barraTiempo) {
      this.barraTiempo.width = 596 * Math.min(1, this.tiempoJuego / this.duracion);
    }

    // Diagrama agua (cada frame → la función es ligera)
    this._actualizarDiagramaAgua(V);
    this._actualizarCompuertas(ut, this.sistema.uv);

    // Gauge H
    this.gauge.actualizar(H);

    // Gráfica de tendencia
    this.graficaTendencia.dibujar();

    // Debug
    if (this.debugMode) {
      const dV = this.sistema.f(V);
      this.textoDebug.setText(
        `[DEBUG] t=${this.tiempoJuego.toFixed(2)}s | V=${V.toFixed(4)} hm³ | dV/dt=${dV.toFixed(6)} hm³/s_juego\n` +
        `A=-0.002 h⁻¹ | B=[-1,-2] | E=1 | τ=2500 s_juego | H=${H.toFixed(2)}m | P=${P.toFixed(3)}MW\n` +
        `ut=${ut.toFixed(4)} | uv=${this.sistema.uv.toFixed(4)} | Qrío=${this.sistema.Qrio.toFixed(4)} hm³/h`
      );
    }
  }

  _estadoV(V) {
    if (V > LIMITES.V_alarma_alta) return '[!PELIGRO]';
    if (V > LIMITES.V_objetivo + LIMITES.V_banda) return '[ALTO]';
    if (V < LIMITES.V_alarma_baja) return '[!CRÍTICO]';
    if (V < LIMITES.V_objetivo - LIMITES.V_banda) return '[BAJO]';
    return '[OK]';
  }

  _finalizarNivel() {
    if (this.gameOver) return;
    this.gameOver = true;

    // Calcular métricas finales
    const errorPMedio = this.muestrasP > 0 ? this.acumErrorP / this.muestrasP : 1;
    // RMSE de potencia contra la demanda de referencia min(P_dem, P_max(V)+5)
    const rmse = this.muestrasP > 0 ? Math.sqrt(this.acumSqErrP / this.muestrasP) : Infinity;
    const pctBanda = this.tiempoJuego > 0 ? 100 * this.tiempoEnBandaTotal / this.tiempoJuego : 0;
    // Si completó los 30s de calibración continua, aprueba inmediatamente.
    // Si no lo logró y se agotaron los 120s (2 minutos) o hubo desborde/descebe, falla.
    const exito = this.completadoTemprano && !this.desborde && !this.descebe;

    this.scene.start('ResultadosScene', {
      nivel: this.nivelId,
      registros: this.registros,
      tiempoBandaMax: this.tiempoBandaMax,
      metaCalibracion: this.metaCalibracion,
      tiempoJugado: this.tiempoJuego,
      errorPMedio: errorPMedio,
      rmse: rmse,
      pctBanda: pctBanda,
      desvMax: this.desvMax,
      Vmin: this.Vmin,
      exito: exito,
      desborde: this.desborde,
      descebe: this.descebe,
      Vmax: this.Vmax,
      tiempoRebosamiento: this.tiempoRebosamiento,
      tiempoCavitacion: this.tiempoCavitacion,
      sistema: {
        V_final: this.sistema.V,
        P_final: this.sistema.P,
      },
    });
  }
}
