/**
 * generar_linea_base_niveles.mjs — Regenera docs/niveles_linea_base_v2.json con la
 * configuración actual de NIVEL1, NIVEL2 y NIVEL3 (rediseño de niveles).
 *
 * Solo se ejecuta cuando se cambian los niveles A PROPÓSITO (y se actualiza
 * docs/niveles.md en el mismo commit). El arte y el sonido no deben cambiarla.
 *
 *   node documentacion_simjam_represa/analisis/generar_linea_base_niveles.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NIVEL1, NIVEL2, NIVEL3 } from '../../src/config/constantes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const destino = join(__dirname, '../docs/niveles_linea_base_v2.json');
writeFileSync(destino, JSON.stringify({ NIVEL1, NIVEL2, NIVEL3 }, null, 2) + '\n');
console.log(`Escrito ${destino}`);
