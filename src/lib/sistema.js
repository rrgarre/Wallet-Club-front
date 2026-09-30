/**
 * Detección del sistema del dispositivo para el campo `sistema` del alta de
 * tarjeta (API v1.7: `"google" | "apple"`).
 *
 * Es detección LOCAL (se lee el User-Agent del navegador): no se envía nada
 * al servidor, sólo sirve para premarcar el desplegable del formulario, que
 * el usuario puede cambiar a mano.
 */

/**
 * Plataforma del navegador: ios | android | mac | windows | otro.
 *
 * Se lee el userAgent clásico —funciona en todos los navegadores y también
 * dentro de otras apps (Instagram, WhatsApp…)— con el apaño de iPadOS 13+,
 * que se hace pasar por «Macintosh» y sólo se delata con maxTouchPoints.
 */
export function plataforma() {
  if (typeof navigator === 'undefined') return 'otro';
  const ua = navigator.userAgent || '';
  const tabletaIpad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || tabletaIpad) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'otro';
}

/**
 * Qué sistema hay que premarcar y qué texto enseñar encima del desplegable:
 *
 *   · iOS (iPhone/iPad)  → `apple` · Android (y ChromeOS) → `google`
 *   · Ordenador (Mac/Windows/Linux) → `sistema: null`: el contrato manda
 *     `google` por defecto y el aviso lo dice a la cara.
 *
 * Se detecta el SISTEMA OPERATIVO, no la app: desde la web no hay forma de
 * saber si el móvil tiene Google Wallet o Apple Wallet instalados.
 */
export function deteccionDispositivo() {
  const plat = plataforma();
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';

  if (plat === 'ios') return { sistema: 'apple', etiqueta: 'Apple · iPhone/iPad (iOS)' };
  if (plat === 'android') return { sistema: 'google', etiqueta: 'Android (Google)' };
  if (/CrOS/.test(ua)) return { sistema: 'google', etiqueta: 'ChromeOS (Google)' };
  if (plat === 'mac') return { sistema: null, etiqueta: 'Mac (ordenador)' };
  if (plat === 'windows') return { sistema: null, etiqueta: 'Windows (ordenador)' };
  return { sistema: null, etiqueta: 'no se detecta el sistema' };
}
