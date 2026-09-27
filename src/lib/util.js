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
 * Identificador del dispositivo/navegador.
 *
 * Es lo que viaja en el campo `nombre` de cada operación: un UUID que genera
 * el navegador con `crypto.randomUUID()` la PRIMERA vez que se usa y se guarda
 * en `localStorage` — no se regenera al hacer login ni al recargar la página.
 */
export function deviceId() {
  try {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = uuid();
      localStorage.setItem('deviceId', id);
    }
    return id;
  } catch {
    // localStorage no disponible (modo privado, bloqueado…): id de esta sesión
    return uuid();
  }
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
