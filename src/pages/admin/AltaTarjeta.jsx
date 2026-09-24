import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Aviso, Campo, Cargando } from '../../components/ui.jsx';
import { FormRegistro } from '../tarjeta/Registro.jsx';

export default function AltaTarjeta() {
  const [params, setParams] = useSearchParams();
  const prefijo = params.get('comercioId') || '';
  const [comercios, setComercios] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/admin/comercios')
      .then((d) => setComercios(d.comercios))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!comercios) return <Cargando texto="Cargando comercios…" />;

  const sel = prefijo || (comercios[0] ? String(comercios[0].id) : '');
  const comercio = comercios.find((c) => String(c.id) === String(sel));

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h2>Alta de tarjeta</h2>
          <p className="muted">
            Se usa el endpoint público <code>POST /api/registro/tarjeta/:idRandomLargo</code> con el código del
            comercio elegido
          </p>
        </div>
      </header>

      <div className="filtros tarjeta">
        <Campo label="Comercio" requerido>
          <select
            className="input"
            value={sel}
            onChange={(e) => setParams(e.target.value ? { comercioId: e.target.value } : {})}
          >
            {comercios.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} — {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        {comercio && (
          <p className="muted small">
            Código que se usará: <code className="codigo largo">{comercio.idRandomLargo}</code>
          </p>
        )}
      </div>

      <div className="tarjeta ancho-medio">
        {comercio ? (
          <>
            {/* key: al cambiar de comercio se reinicia el formulario y su estado de éxito */}
            <FormRegistro key={comercio.idRandomLargo} idRandomLargo={comercio.idRandomLargo} />
            <p className="muted small">
              Nota: al registrarse se emite un token de tarjeta; aquí no se guarda para no pisar tu sesión de admin.
            </p>
          </>
        ) : (
          <Aviso tipo="info">Crea primero un comercio: no hay ninguno donde dar de alta tarjetas.</Aviso>
        )}
      </div>
    </>
  );
}
