/**
 * Lectura del QR de una tarjeta.
 *
 * Los QR de las tarjetas ya NO llevan la URL de captura: sólo contienen el
 * IDENTIFICADOR numérico de la tarjeta (p. ej. "3").
 *
 * Esta función es tolerante:
 *  - "3"                  → QR nuevo (identificador).
 *  - "https://…/comercio/captura/3" → QR antiguo (URL completa), se extrae el id.
 *  - "…?tarjeta=3"        → otras variantes con query.
 * Cualquier otra cosa → null (no es un QR de tarjeta).
 */
export function extraerIdTarjeta(texto) {
  if (!texto) return null;
  const t = String(texto).trim();
  if (/^\d+$/.test(t)) return t; // QR nuevo: sólo el identificador
  const ruta = t.match(/\/comercio\/captura\/(\d+)/); // QR antiguo: URL completa
  if (ruta) return ruta[1];
  const query = t.match(/[?&]tarjeta=(\d+)/);
  if (query) return query[1];
  return null;
}
