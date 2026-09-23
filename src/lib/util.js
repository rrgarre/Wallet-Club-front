import { registroUrl } from '../config.js';

/** UUID v4 para Idempotency-Key (máx 64 caracteres en el contrato) */
export function uuid() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Umbral del cliente para exigir `nombre`:
 *  - premio modificado a mano (premiosDelta != 0)
 *  - puntos en negativo (puntosDelta < 0)
 *  - suma de puntos añadidos >= UMBRAL_NOMBRE
 * NOTA: el servidor tiene su propio umbral (UMBRAL_PUNTOS_NOMBRE, 100 por defecto);
 * si él también lo exige, el envío se repite con la misma idempotencia.
 */
export const UMBRAL_NOMBRE = 5;

export function requiereNombre(puntosDelta, premiosDelta) {
  return premiosDelta !== 0 || puntosDelta < 0 || puntosDelta >= UMBRAL_NOMBRE;
}

/**
 * Sólo VISUAL: simula lo que el servidor hará con los puntos
 * (n = floor(puntos / puntosPremio) premios, descontando n * umbral).
 * El paquete enviado al servidor es únicamente la suma de puntos:
 * la conversión definitiva la calcula el servidor y se lee de `tarjeta` de la respuesta.
 */
export function simularSaldo(puntos, premios, puntosDelta, premiosDelta, umbral) {
  let p = puntos + puntosDelta;
  let pr = premios + premiosDelta;
  let generados = 0;
  if (puntosDelta > 0 && umbral > 0) {
    const n = Math.floor(p / umbral);
    if (n > 0) {
      generados = n;
      p -= n * umbral;
      pr += n;
    }
  }
  return { puntos: p, premios: pr, generados };
}

export function fecha(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** URL pública de alta de tarjeta de un comercio (para el QR) — ver src/config.js */
export { registroUrl as urlRegistro };

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
