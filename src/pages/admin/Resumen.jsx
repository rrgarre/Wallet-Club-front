import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Aviso, Cargando } from '../../components/ui.jsx';

export default function Resumen() {
  const [salud, setSalud] = useState(null);
  const [errorSalud, setErrorSalud] = useState(null);
  const [comercios, setComercios] = useState(null);
  const [tarjetas, setTarjetas] = useState(null);

  const consultarSalud = async () => {
    setSalud(null);
    setErrorSalud(null);
    try {
      setSalud(await api('/health', { token: false }));
    } catch (e) {
      setErrorSalud(e.message);
    }
  };

  useEffect(() => {
    consultarSalud();
    api('/api/admin/comercios')
      .then((d) => setComercios(d.total))
      .catch((e) => setComercios(`error: ${e.message}`));
    api('/api/admin/tarjetas')
      .then((d) => setTarjetas(d.total))
      .catch((e) => setTarjetas(`error: ${e.message}`));
  }, []);

  return (
    <>
      <header className="pagina-cab">
        <h2>Resumen</h2>
        <p className="muted">Estado del servicio y accesos rápidos</p>
      </header>

      <div className="rejilla rejilla-3">
        <div className="tarjeta dato">
          <span className="muted">Comercios</span>
          <b className="dato-valor">{comercios === null ? '…' : comercios}</b>
          <Link to="/admin/comercios">Gestionar →</Link>
        </div>
        <div className="tarjeta dato">
          <span className="muted">Tarjetas</span>
          <b className="dato-valor">{tarjetas === null ? '…' : tarjetas}</b>
          <Link to="/admin/tarjetas">Ver listado →</Link>
        </div>
        <div className="tarjeta dato">
          <span className="muted">GET /health</span>
          <b className="dato-valor">{salud ? 'conectada' : errorSalud ? 'sin API' : '…'}</b>
          <button className="btn btn-mini" onClick={consultarSalud}>
            Reconsultar
          </button>
        </div>
      </div>

      {errorSalud && <Aviso tipo="error">{errorSalud}</Aviso>}
      {salud && (
        <div className="tarjeta">
          <h4>Última salud</h4>
          <pre className="json">{JSON.stringify(salud, null, 2)}</pre>
        </div>
      )}

      <div className="tarjeta">
        <h4>Accesos rápidos</h4>
        <div className="chips">
          <Link className="chip" to="/admin/comercios">
            + Crear comercio
          </Link>
          <Link className="chip" to="/admin/alta-tarjeta">
            + Dar de alta tarjeta
          </Link>
          <Link className="chip" to="/admin/operaciones">
            Buscar operaciones
          </Link>
          <Link className="chip" to="/admin/testeo">
            Consola de testeo
          </Link>
        </div>
      </div>

      {comercios === null && <Cargando />}
    </>
  );
}
