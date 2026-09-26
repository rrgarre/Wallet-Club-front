/**
 * Configuración del proyecto — NO se usan ficheros .env.
 *
 * Todo lo que hay que tocar al clonar o desplegar está aquí, a la vista:
 *
 *   · API_BASE  → URL del servidor API. Si tu API corre en otro puerto o
 *                 dominio, se cambia UNA LÍNEA (no hay nada que rellenar a mano).
 *   · FRONT_BASE→ no se toca nunca: se calcula del origen del navegador,
 *                 así que sirve igual en desarrollo, pruebas y producción.
 */

/** Deja la URL sin barras finales sobrantes. */
const limpiar = (url) => (url || '').replace(/\/+$/, '');

/**
 * URL base del servidor API (contrato §1).
 *
 * Local: el API arranca con `PORT=3010` (ver Wallet-Club-API/.env).
 * El contrato pone `http://localhost:3000` por defecto: si tu API corre ahí,
 * cambia el valor de abajo y ya está.
 */
export const API_BASE = limpiar('http://localhost:3010') || 'http://localhost:3000';
// ↓ Alternativa rápida: comenta la línea de arriba y descomenta esta para
//   apuntar al servidor remoto (sólo puede estar activa una de las dos).
// export const API_BASE = limpiar('https://api.walletclub.ssl-alert');

/** Base del front: origen dinámico del navegador (sin configurar). */
export const FRONT_BASE = window.location.origin;

/** Ruta (relativa) de la pantalla de captura de una tarjeta. */
export const capturaPath = (tarjetaId) => `/comercio/captura/${tarjetaId}`;

/** URL absoluta de captura: `FRONT_BASE` + la ruta anterior. */
export const capturaUrl = (tarjetaId) => FRONT_BASE + capturaPath(tarjetaId);

/** Ruta (relativa) del formulario de alta con el código del comercio. */
export const registroPath = (idRandomLargo) => `/tarjeta/registro/${idRandomLargo}`;

/** URL absoluta del formulario de alta (enlace/QR del comercio). */
export const registroUrl = (idRandomLargo) => FRONT_BASE + registroPath(idRandomLargo);
