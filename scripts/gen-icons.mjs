/**
 * Genera los iconos del proyecto (PWA + favicon) desde un SVG propio.
 *
 *   node scripts/gen-icons.mjs
 *
 * No hay imágenes en el repo: este script ES la fuente. Si cambia la marca,
 * se toca el SVG de aquí abajo y se vuelve a ejecutar; los PNG se versionan.
 *
 * Marca: cuadrado azul de marca (#1f6feb, el mismo acento de styles.css)
 * con el "◑" que se usa en la app (medio disco + anillo).
 *
 * Salida: public/icons/*.png y public/favicon.ico
 * (Vite copia todo lo de public/ a dist/ en cada `npm run build`.)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const proyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(proyecto, 'public', 'icons');
mkdirSync(salida, { recursive: true });

const AZUL = '#1f6feb';

/**
 * Lienzo 512x512, fondo a sangre (sin transparencia: iOS lo exige en el
 * apple-touch-icon y Android lo necesita para las máscaras).
 *
 * `escala` encoge la marca: en el icono "maskable" se deja margen para que
 * Android, que recorta en círculo, no se coma el logo.
 */
const svg = (escala = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${AZUL}"/>
  <g transform="translate(256 256) scale(${escala}) translate(-256 -256)">
    <circle cx="256" cy="256" r="140" fill="none" stroke="#ffffff" stroke-width="34"/>
    <path d="M256 116 A140 140 0 0 1 256 396 Z" fill="#ffffff"/>
  </g>
</svg>`;

/** [fichero, lado en px, escala de la marca] */
const tamanios = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-512-maskable.png', 512, 0.82],
  ['apple-touch-icon-180.png', 180, 1],
  ['favicon-32.png', 32, 1],
  ['favicon-16.png', 16, 1],
];

const pngs = {};
for (const [nombre, lado, escala] of tamanios) {
  const png = new Resvg(svg(escala), { fitTo: { mode: 'width', value: lado } })
    .render()
    .asPng();
  writeFileSync(path.join(salida, nombre), png);
  pngs[lado] = png;
  console.log(`${nombre.padEnd(24)} ${String(lado).padStart(3)}x${String(lado).padEnd(3)} ${String(png.length).padStart(6)} bytes`);
}

/**
 * favicon.ico: contenedor ICO estándar con entradas PNG embebidas
 * (formato soportado por todos los navegadores y sistemas actuales).
 */
const ico = (entradas) => {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo: icono
  cabecera.writeUInt16LE(entradas.length, 4);

  let offset = 6 + 16 * entradas.length;
  const directorio = [];
  for (const { lado, data } of entradas) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0); // ancho (0 = 256)
    e.writeUInt8(lado >= 256 ? 0 : lado, 1); // alto
    e.writeUInt8(0, 2); // colores
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits/pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    directorio.push(e);
  }
  return Buffer.concat([cabecera, ...directorio, ...entradas.map((e) => e.data)]);
};

const favicon = ico([
  { lado: 32, data: pngs[32] },
  { lado: 16, data: pngs[16] },
]);
writeFileSync(path.join(proyecto, 'public', 'favicon.ico'), favicon);
console.log(`${'favicon.ico'.padEnd(24)} ico ${String(favicon.length).padStart(6)} bytes (32+16)`);
console.log('\nListo: public/icons/ + public/favicon.ico');
