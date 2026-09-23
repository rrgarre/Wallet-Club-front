/**
 * Configuración de URLs del proyecto.
 *
 * Todo se construye de forma dinámica a partir de las variables de entorno
 * (`.env`, `.env.local`, variables del despliegue…), de modo que el mismo
 * código sirve en desarrollo, pruebas y producción sin tocar código:
 *
 *   VITE_FRONT_URL  → base del front (QR, enlaces de alta…)
 *                     Si no está definida se usa el origen del navegador,
 *                     que ya es correcto en cualquier entorno.
 *   VITE_API_URL    → base del API (contrato: http://localhost:3000 en dev)
 */

const limpiar = (url) => (url || '').replace(/\/+$/, '');

/** Base del front. Vacío en .env = origen dinámico del navegador. */
export const FRONT_BASE = limpiar(import.meta.env.VITE_FRONT_URL) || window.location.origin;

/** Base del API. */
export const API_BASE = limpiar(import.meta.env.VITE_API_URL) || 'http://localhost:3000';

/** Ruta (relativa) de la pantalla de captura de una tarjeta. */
export const capturaPath = (tarjetaId) => `/comercio/captura/${tarjetaId}`;

/** URL absoluta de captura: la que va dentro del QR de la tarjeta. */
export const capturaUrl = (tarjetaId) => FRONT_BASE + capturaPath(tarjetaId);

/** Ruta (relativa) del formulario de alta con el código del comercio. */
export const registroPath = (idRandomLargo) => `/tarjeta/registro/${idRandomLargo}`;

/** URL absoluta del formulario de alta (enlace/QR del comercio). */
export const registroUrl = (idRandomLargo) => FRONT_BASE + registroPath(idRandomLargo);
