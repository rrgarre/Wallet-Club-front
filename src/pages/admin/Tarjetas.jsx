import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Aviso, Badge, Campo, Cargando, Modal, Vacio } from '../../components/ui.jsx';
import TablaOperaciones from '../../components/TablaOperaciones.jsx';
import { fecha } from '../../lib/util.js';

export default function Tarjetas() {
  const [params, setParams] = useSearchParams();
  const comercioId = params.get('comercioId') || '';

  const [comercios, setComercios] = useState([]);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [detalle, setDetalle] = useState(null); // { tarjeta, operaciones }

  useEffect(() => {
    api('/api/admin/comercios')
      .then((d) => setComercios(d.comercios))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLista(null);
    const qs = comercioId ? `?comercioId=${encodeURIComponent(comercioId)}` : '';
    api(`/api/admin/tarjetas${qs}`)
      .then((d) => {
        setLista(d.tarjetas);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [comercioId]);

  const abrirDetalle = async (id) => {
    setDetalle({ cargando: true });
    try {
      const [t, ops] = await Promise.all([
        api(`/api/admin/tarjetas/${id}`),
        api(`/api/admin/operaciones?tarjetaId=${id}&tamano=50`),
      ]);
      setDetalle({ tarjeta: t.tarjeta, operaciones: ops.filas || [] });
    } catch (e) {
      setDetalle({ error: e.message });
    }
  };

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h2>Tarjetas</h2>
          <p className="muted">Listado global, con filtro por comercio (sólo lectura)</p>
        </div>
        <Link className="btn btn-primario" to="/admin/alta-tarjeta">
          + Nueva tarjeta
        </Link>
      </header>

      <div className="filtros tarjeta">
        <Campo label="Comercio">
          <select className="input" value={comercioId} onChange={(e) => setParams(e.target.value ? { comercioId: e.target.value } : {})}>
            <option value="">Todos</option>
            {comercios.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} — {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <p className="muted small">
          El contrato no permite editar ni activar/desactivar tarjetas: aquí sólo se consultan.
        </p>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!lista && !error && <Cargando />}
      {lista && lista.length === 0 && <Vacio texto="No hay tarjetas con ese filtro." />}

      {lista && lista.length > 0 && (
        <div className="tabla-wrap tarjeta">
          <table className="tabla">
            <thead>
              <tr>
                <th>Id</th>
                <th>Comercio</th>
                <th>Nombre</th>
                <th>Email</th>
                <th className="der">Puntos</th>
                <th className="der">Premios</th>
                <th>Estado</th>
                <th>Creada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>
                    <Link to={`/admin/tarjetas?comercioId=${t.comercioId}`}>#{t.comercioId}</Link>
                  </td>
                  <td>
                    <b>{t.nombre}</b>
                  </td>
                  <td>{t.email}</td>
                  <td className="der num">{t.puntos}</td>
                  <td className="der num">{t.premios}</td>
                  <td>{t.activo === 1 ? <Badge tono="ok">Activa</Badge> : <Badge tono="mal">Inactiva</Badge>}</td>
                  <td className="muted small nowrap">{fecha(t.createdAt)}</td>
                  <td>
                    <button className="btn btn-mini" onClick={() => abrirDetalle(t.id)}>
                      Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <Modal titulo="Detalle de tarjeta" onCerrar={() => setDetalle(null)} ancho="900px">
          {detalle.cargando && <Cargando />}
          {detalle.error && <Aviso tipo="error">{detalle.error}</Aviso>}
          {detalle.tarjeta && (
            <>
              <div className="rejilla rejilla-4 datos-tarjeta">
                <div>
                  <span className="muted small">Nombre</span>
                  <b>{detalle.tarjeta.nombre}</b>
                </div>
                <div>
                  <span className="muted small">Email</span>
                  <b>{detalle.tarjeta.email}</b>
                </div>
                <div>
                  <span className="muted small">Puntos</span>
                  <b className="num">{detalle.tarjeta.puntos}</b>
                </div>
                <div>
                  <span className="muted small">Premios</span>
                  <b className="num">{detalle.tarjeta.premios}</b>
                </div>
                <div>
                  <span className="muted small">Comercio</span>
                  <b>#{detalle.tarjeta.comercioId}</b>
                </div>
                <div>
                  <span className="muted small">Estado</span>
                  <b>{detalle.tarjeta.activo === 1 ? 'Activa' : 'Inactiva'}</b>
                </div>
                <div>
                  <span className="muted small">Creada</span>
                  <b>{fecha(detalle.tarjeta.createdAt)}</b>
                </div>
                <div>
                  <span className="muted small">Últ. cambio</span>
                  <b>{fecha(detalle.tarjeta.updatedAt)}</b>
                </div>
              </div>

              <h4>Historial de operaciones</h4>
              <TablaOperaciones filas={detalle.operaciones} amplicada={false} />
            </>
          )}
        </Modal>
      )}
    </>
  );
}
