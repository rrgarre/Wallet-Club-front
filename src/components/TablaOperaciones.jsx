/** Tabla de movimientos compartida (admin / historial de tarjeta) */
export default function TablaOperaciones({ filas, amplicada = true }) {
  if (!filas || filas.length === 0) return <p className="muted centro">No hay operaciones.</p>;

  return (
    <div className="tabla-wrap">
      <table className="tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            {amplicada && <th>Tarjeta</th>}
            {amplicada && <th>Comercio</th>}
            <th className="der">Puntos</th>
            <th className="der">Premios</th>
            <th>Descripción</th>
            <th>Nombre</th>
            <th>Camarero</th>
            {amplicada && <th>Idempotencia</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td className="nowrap">{new Date(f.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>
                <span className={`tipo tipo-${f.tipo}`}>{String(f.tipo || '').replace('_', ' ')}</span>
              </td>
              {amplicada && (
                <td>
                  {amplicada && f.tarjetaNombre ? (
                    <>
                      {f.tarjetaNombre} <span className="muted small">#{f.tarjetaId}</span>
                    </>
                  ) : (
                    <>#{f.tarjetaId}</>
                  )}
                </td>
              )}
              {amplicada && <td>{f.comercioNombre || `#${f.comercioId}`}</td>}
              <td className={`der num ${f.puntosDelta > 0 ? 'pos' : f.puntosDelta < 0 ? 'neg' : ''}`}>
                {f.puntosDelta > 0 ? '+' : ''}
                {f.puntosDelta}
              </td>
              <td className={`der num ${f.premiosDelta > 0 ? 'pos' : f.premiosDelta < 0 ? 'neg' : ''}`}>
                {f.premiosDelta > 0 ? '+' : ''}
                {f.premiosDelta}
              </td>
              <td>{f.descripcion || '—'}</td>
              <td>{f.nombre || '—'}</td>
              <td>{f.codigoCamarero || '—'}</td>
              {amplicada && <td className="muted small">{f.idempotenciaKey || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
