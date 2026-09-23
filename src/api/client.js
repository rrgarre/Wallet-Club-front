import { API_BASE } from '../config.js';

const BASE = API_BASE;

export const TOKEN_KEY = 'wc_token';
export const SESSION_KEY = 'wc_session';

export class ApiError extends Error {
  constructor(message, code = 'UNKNOWN', status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Petición genérica contra el API.
 * - token: undefined → se lee de localStorage; false → sin cabecera; string → ese token.
 * - idempotencia: se envía como cabecera `Idempotency-Key`.
 * Lanza ApiError con message (español) y code del contrato en cualquier respuesta no exitosa.
 */
export async function api(path, { method = 'GET', body, token, idempotencia, headers = {} } = {}) {
  const finalHeaders = { 'Content-Type': 'application/json; charset=utf-8', ...headers };

  const t = token === false ? null : token ?? localStorage.getItem(TOKEN_KEY);
  if (t) finalHeaders.Authorization = `Bearer ${t}`;
  if (idempotencia) finalHeaders['Idempotency-Key'] = idempotencia;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor', 'NETWORK', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!res.ok || !data || data.ok === false) {
    const msg = (data && data.error && data.error.message) || `Error del servidor (${res.status})`;
    const code = (data && data.error && data.error.code) || 'INTERNAL';
    throw new ApiError(msg, code, res.status);
  }
  return data;
}

export const apiUrl = (path) => BASE + path;
