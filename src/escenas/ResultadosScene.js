/**
 * ResultadosScene.js
 * Pantalla final con métricas de la partida, gráficas completas
 * y exportación CSV. Incluye texto educativo.
 */

import { COLORES, LIMITES, EQUILIBRIO } from '../config/constantes.js';
import { guardarResultado } from '../config/progreso.js';

export class ResultadosScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultadosScene' });
  }

  init(data) {
    this.data_nivel = data;
  }

  create() {
    const d = this.data_nivel;
    guardarResultado(d.nivel, { exito: d.exito, errorPMedio: d.errorPMedio, rmse: d.nivel === 3 ? d.rmse : undefined });
    const cx = 640;

    // ─── FONDO ────────────────────────────────────────────────────────────────
    this.add.rectangle(cx, 360, 1280, 720, 0x060a0e);

    // Líneas de cuadrícula decorativas
    const g = this.add.graphics();
    g.lineStyle(1, 0x111111, 1);
    for (let y = 0; y < 720; y += 40) {
      g.moveTo(0, y); g.lineTo(1280, y);
    }
    for (let x = 0; x < 1280; x += 40) {
      g.moveTo(x, 0); g.lineTo(x, 720);
    }
    g.strokePath();

    // ─── BANNER ───────────────────────────────────────────────────────────────
    const bannerColor = d.exito ? COLORES.linea_P : COLORES.alarma_alta;
    this.add.rectangle(cx, 36, 1280, 70, 0x0d0d0d).setStrokeStyle(0);
    this.add.rectangle(cx, 71, 1280, 2, bannerColor, 0.5);

    this.add.text(cx, 18, d.exito ? `▲  NIVEL COMPLETADO — NIVEL ${d.nivel}  ▲` : (d.desborde ? '▼  PRESA DESBORDADA  ▼' : (d.descebe ? '▼  DESCEBE: EMBALSE VACÍO  ▼' : '▼  TURNO FALLIDO (120s AGOTADOS)  ▼')), {
      fontSize: '22px', fontFamily: 'Courier New, monospace',
      color: d.exito ? '#52b788' : '#e63946',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(cx, 52, d.exito
      ? '¡Nivel completado! Mantuviste el sistema calibrado durante 30 segundos continuos.'
      : 'No alcanzaste los 30s de calibración continua dentro de los 2 minutos del turno.',
      {
        fontSize: '12px', fontFamily: 'Courier New', color: '#666666', align: 'center',
      }
    ).setOrigin(0.5);

    // ─── MÉTRICAS ─────────────────────────────────────────────────────────────
    this._construirMetricas(d);

    // ─── GRÁFICA COMPLETA ─────────────────────────────────────────────────────
    this._construirGraficaCompleta(d.registros);

    // ─── TEXTO EDUCATIVO ──────────────────────────────────────────────────────
    this._construirTextoEducativo();

    // ─── BOTONES DE ACCIÓN ────────────────────────────────────────────────────
    this._construirBotones(d);
  }

  _construirMetricas(d) {
    const metricaX = 30;
    const metricaY = 88;
    const items = d.nivel === 3 ? [
      {
        label: 'RMSE POTENCIA (vs demanda alcanzable)',
        valor: `${d.rmse.toFixed(2)} MW`,
        ok: d.rmse <= 8.0,
        req: '≤ 8.0 MW',
      },
      {
        label: 'DESVIACIÓN MÁXIMA DE V RESPECTO A V0',
        valor: `${d.desvMax.toFixed(2)} hm³`,
        ok: true,
        req: 'informativo',
      },
      {
        label: 'CALIBRACIÓN CONTINUA ALCANZADA',
        valor: `${d.tiempoBandaMax.toFixed(1)} s`,
        ok: d.tiempoBandaMax >= 30,
        req: '≥ 30 s continuos',
      },
      {
        label: 'RANGO DE V  (sin descebe ni desborde)',
        valor: `${d.Vmin.toFixed(1)} – ${d.Vmax.toFixed(1)} hm³`,
        ok: !d.desborde && !d.descebe,
        req: '5 < V < 50 hm³',
      },
    ] : d.nivel === 2 ? [
      {
        label: 'CALIBRACIÓN CONTINUA ALCANZADA',
        valor: `${d.tiempoBandaMax.toFixed(1)} s`,
        ok: d.tiempoBandaMax >= 30,
        req: '≥ 30 s continuos',
      },
      {
        label: 'VOLUMEN MÁXIMO ALCANZADO',
        valor: `${d.Vmax.toFixed(2)} hm³`,
        ok: !d.desborde && d.tiempoRebosamiento === 0,
        req: '≤ 45 hm³',
      },
      {
        label: 'ERROR MEDIO POTENCIA',
        valor: `${(d.errorPMedio * 100).toFixed(2)} %`,
        ok: d.errorPMedio <= 0.15,
        req: '≤ 15%',
      },
      {
        label: 'NIVEL FINAL EMBALSE',
        valor: `${d.sistema.V_final.toFixed(2)} hm³`,
        ok: Math.abs(d.sistema.V_final - LIMITES.V_objetivo) <= 5,
        req: '30 ± 5 hm³',
      },
    ] : [
      {
        label: 'CALIBRACIÓN CONTINUA ALCANZADA',
        valor: `${d.tiempoBandaMax.toFixed(1)} s`,
        ok: d.tiempoBandaMax >= 30,
        req: '≥ 30 s continuos',
      },
      {
        label: 'ERROR MEDIO POTENCIA',
        valor: `${(d.errorPMedio * 100).toFixed(2)} %`,
        ok: d.errorPMedio <= 0.05,
        req: '≤ 5%',
      },
      {
        label: 'NIVEL FINAL EMBALSE',
        valor: `${d.sistema.V_final.toFixed(2)} hm³`,
        ok: d.sistema.V_final >= LIMITES.V_min && d.sistema.V_final <= LIMITES.V_max,
        req: '[5, 50] hm³',
      },
      {
        label: 'POTENCIA FINAL GENERADA',
        valor: `${d.sistema.P_final.toFixed(2)} MW`,
        ok: true,
        req: '~47.4 MW',
      },
    ];

    items.forEach((item, i) => {
      const x = metricaX + (i % 2) * 300;
      const y = metricaY + Math.floor(i / 2) * 70;

      this.add.rectangle(x + 138, y + 25, 276, 56, 0x0d0d0d)
        .setStrokeStyle(1, item.ok ? 0x222222 : 0x3a1010);

      this.add.text(x + 4, y + 6, item.label, {
        fontSize: '8px', fontFamily: 'Courier New', color: '#444444',
      });

      this.add.text(x + 4, y + 20, item.valor, {
        fontSize: '22px', fontFamily: 'Courier New', fontStyle: 'bold',
        color: item.ok ? '#52b788' : '#e63946',
      });

      this.add.text(x + 4, y + 46, `Requisito: ${item.req}`, {
        fontSize: '9px', fontFamily: 'Courier New', color: '#333333',
      });

      this.add.text(x + 250, y + 20, item.ok ? '✓' : '✗', {
        fontSize: '24px', fontFamily: 'Courier New',
        color: item.ok ? '#52b788' : '#e63946',
      }).setOrigin(0.5);
    });
  }

  _construirGraficaCompleta(registros) {
    if (!registros || registros.length < 2) return;

    const gx = 630;
    const gy = 88;
    const gw = 620;
    const gh = 240;
    const pad = 20;

    // Panel de la gráfica
    this.add.rectangle(gx + gw / 2, gy + gh / 2, gw, gh, 0x0d0d0d)
      .setStrokeStyle(1, 0x222222);
    this.add.text(gx + 4, gy + 4, 'REGISTRO COMPLETO DE LA PARTIDA (0–120 s)', {
      fontSize: '9px', fontFamily: 'Courier New', color: '#444444',
    });

    const g = this.add.graphics();
    const iw = gw - pad * 2;
    const ih = gh - pad * 2;
    const x0 = gx + pad;
    const y0 = gy + pad;

    // Cuadrícula
    g.lineStyle(1, 0x1a1a1a);
    for (let i = 0; i <= 4; i++) {
      const yy = y0 + (ih / 4) * i;
      g.moveTo(x0, yy); g.lineTo(x0 + iw, yy);
    }
    g.strokePath();

    const tMax = 120;
    const pMax = 160;
    const vMax = 60;

    // Trazar P generada (verde)
    g.lineStyle(1.5, COLORES.linea_P, 1);
    g.beginPath();
    registros.forEach((r, i) => {
      const px = x0 + (parseFloat(r.t_s) / tMax) * iw;
      const py = y0 + ih - (parseFloat(r.P_MW) / pMax) * ih;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    });
    g.strokePath();

    // Trazar P demanda (amarillo punteado)
    g.lineStyle(1, COLORES.linea_Pdem, 0.8);
    g.beginPath();
    registros.forEach((r, i) => {
      const px = x0 + (parseFloat(r.t_s) / tMax) * iw;
      const py = y0 + ih - (parseFloat(r.Pdemanda_MW) / pMax) * ih;
      if (i % 3 === 0) g.moveTo(px, py);
      else if (i % 3 === 1) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.strokePath();

    // Trazar V (azul)
    g.lineStyle(1, COLORES.linea_V_bright, 1);
    g.beginPath();
    registros.forEach((r, i) => {
      const px = x0 + (parseFloat(r.t_s) / tMax) * iw;
      const py = y0 + ih - (parseFloat(r.V_hm3) / vMax) * ih;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    });
    g.strokePath();

    // Banda de V [27,33]
    const yBandaHigh = y0 + ih - (33 / vMax) * ih;
    const yBandaLow  = y0 + ih - (27 / vMax) * ih;
    g.fillStyle(0xf4d35e, 0.05);
    g.fillRect(x0, yBandaHigh, iw, yBandaLow - yBandaHigh);
    g.lineStyle(1, 0xf4d35e, 0.2);
    g.strokeRect(x0, yBandaHigh, iw, yBandaLow - yBandaHigh);

    // Leyenda
    const ly = gy + gh - 12;
    g.fillStyle(COLORES.linea_P);    g.fillRect(gx + 4,  ly, 20, 2);
    g.fillStyle(COLORES.linea_Pdem); g.fillRect(gx + 90, ly, 20, 2);
    g.fillStyle(COLORES.linea_V_bright); g.fillRect(gx + 170, ly, 20, 2);

    this.add.text(gx + 28,  ly - 4, 'P gen', { fontSize: '8px', fontFamily: 'Courier New', color: '#52b788' });
    this.add.text(gx + 114, ly - 4, 'P dem', { fontSize: '8px', fontFamily: 'Courier New', color: '#f4d35e' });
    this.add.text(gx + 194, ly - 4, 'V [hm³]',{ fontSize: '8px', fontFamily: 'Courier New', color: '#4fc3f7' });
  }

  _construirTextoEducativo() {
    const x = 30;
    const y = 370;
    const w = 580;

    this.add.rectangle(x + w / 2, y + 90, w, 175, 0x080d12)
      .setStrokeStyle(1, 0x1a2a1a);

    this.add.text(x + 8, y + 6, '◈  LO QUE OCURRIÓ EN EL MODELO', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#52b788', letterSpacing: 2,
    });

    this.add.rectangle(x + w / 2, y + 16, w, 1, COLORES.linea_P, 0.3);

    const texto = this.data_nivel.nivel === 3
      ? `Aquí perturbación y consigna cambian a la vez: Q_río(t) oscila y la\n` +
        `demanda sube en escalones. Como P = 2.45·H(V)·u_t, la potencia disponible\n` +
        `depende del volumen almacenado: P_max(V) = 2.45·(20 + 0.8·V).\n\n` +
        `Por eso la referencia es min(P_dem, P_max(V) + 5): nadie puede entregar\n` +
        `más de lo que el embalse permite. El RMSE resume el error cuadrático medio.\n\n` +
        `Con la ecuación dV/dt = Q_río − u_t − 2·u_v − 0.002·V, el volumen\n` +
        `integra la diferencia entre lo que entra y lo que sale: anticiparse a la\n` +
        `punta de demanda y a la crecida es control de lazo abierto + cerrado.`
      : this.data_nivel.nivel === 2
      ? `Una tormenta eleva el caudal del río Q_río(t): es una PERTURBACIÓN que no\n` +
        `controlas. Con las turbinas solas no alcanza: el vertedero u_v (ganancia\n` +
        `B₂ = −2 hm³/h) agrega capacidad de evacuación cuando V se acerca al límite.\n\n` +
        `Ecuación de estado:  dV/dt = Q_río − u_t − 2·u_v − 0.002·V\n` +
        `Al abrir el vertedero baja V pero NO produce potencia: seguridad vs. energía.\n` +
        `Como P = 2.45·H(V)·u_t, un V alto sube la cabeza H y la potencia para el\n` +
        `mismo u_t: la planta realimenta su propio estado.\n\n` +
        `Anticipar la crecida (feedforward) es mejor que reaccionar tarde (feedback).`
      : `El embalse actúa como un sistema acumulador continuo de primer orden.\n` +
      `Al modificar u_t (apertura de turbinas), no fijas el nivel directamente,\n` +
      `sino la tasa de cambio dV/dt del volumen almacenado.\n\n` +
      `Ecuación de estado:  dV/dt = Q_río − u_t − 0.002·V\n` +
      `Constante de tiempo:  τ = 500 h reales = 2500 s de juego\n` +
      `Función de transferencia:  G(s) = −500/(500s + 1)\n\n` +
      `El retardo entre el ajuste del actuador y la respuesta del volumen\n` +
      `demuestra por qué el control de sistemas continuos requiere\n` +
      `anticipación y monitoreo de lazo cerrado.`;

    this.add.text(x + 8, y + 22, texto, {
      fontSize: '10px', fontFamily: 'Courier New', color: '#666666',
      lineSpacing: 3, wordWrap: { width: w - 16 },
    });
  }

  _construirBotones(d) {
    // Botón descargar CSV
    this._boton(670, 430, '⬇  DESCARGAR DATOS (CSV)', () => {
      this._exportarCSV(d.registros, d.nivel);
    }, COLORES.linea_P);

    // Botón reintentar
    this._boton(670, 490, `↺  REINTENTAR NIVEL ${d.nivel}`, () => {
      this.scene.start('JuegoScene', { nivel: d.nivel });
    }, COLORES.linea_V_bright);

    // Botón menú
    this._boton(670, 550, '◁  MENÚ DE NIVELES', () => {
      this.scene.start('NivelesScene');
    }, 0x555555);

    // Botón siguiente nivel (si se aprobó y existe)
    if (d.exito && d.nivel < 3) {
      this._boton(670, 610, `▶  SIGUIENTE: NIVEL ${d.nivel + 1}`, () => {
        this.scene.start('JuegoScene', { nivel: d.nivel + 1 });
      }, COLORES.linea_Pdem);
    }
  }

  _boton(x, y, texto, callback, color = 0x52b788) {
    const w = 360;
    const h = 38;

    const bg = this.add.rectangle(x, y, w, h, 0x0d0d0d)
      .setStrokeStyle(1, color)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y, texto, {
      fontSize: '13px', fontFamily: 'Courier New',
      color: `#${color.toString(16).padStart(6,'0')}`,
      align: 'center',
    }).setOrigin(0.5);

    bg.on('pointerover', () => { bg.setFillStyle(color, 0.1); label.setColor('#ffffff'); });
    bg.on('pointerout',  () => { bg.setFillStyle(0x0d0d0d); label.setColor(`#${color.toString(16).padStart(6,'0')}`); });
    bg.on('pointerdown', () => {
      this.cameras.main.flash(80, 82, 183, 136, false);
      this.time.delayedCall(120, callback);
    });
  }

  _exportarCSV(registros, nivel = 1) {
    if (!registros || registros.length === 0) return;

    const encabezado = 't_s,V_hm3,H_m,ut,uv,Qrio,P_MW,Pdemanda_MW,Pref_MW';
    const filas = registros.map(r =>
      `${r.t_s},${r.V_hm3},${r.H_m},${r.ut},${r.uv},${r.Qrio},${r.P_MW},${r.Pdemanda_MW},${r.Pref_MW ?? r.Pdemanda_MW}`
    );
    const csv = [encabezado, ...filas].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partida_represa_nivel${nivel}_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
