import { useState } from 'react';
import { api } from '../../api/client.js';
import { Aviso, Campo } from '../../components/ui.jsx';
import { deviceId, uuid } from '../../lib/util.js';

const TIPOS = ['', 'acumulacion', 'canje', 'correccion', 'ajuste'];

const VACIO = {
  tarjetaId: '',
  comercioId: '',
  puntosDelta: 0,
  premiosDelta: 0,
  tipo: '',
  descripcion: '',
  nombre: '',
  codigoCamarero: '',
  idempotencia: '',
};

/** Consola de testeo: cualquier movimiento, con la respuesta JSON a la vista. */
export default function Testeo() {
  const [f, setF] = useState(VACIO);
  const [respuesta, setRespuesta] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

  const consultarSalud = async () => {
    try {
      setRespuesta({ peticion: 'GET /health', ...(await api('/health', { token: false })) });
    } catch (e) {
      setRespuesta({ peticion: 'GET /health', error: e.message, code: e.code });
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    const idem = f.idempotencia || uuid();
    const body = {
      puntosDelta: Number(f.puntosDelta),
      premiosDelta: Number(f.premiosDelta),
    };
    if (f.tipo) body.tipo = f.tipo;
    if (f.descripcion) body.descripcion = f.descripcion;
    // Igual que en la captura normal: `nombre` SIEMPRE va y, salvo que se
    // fuerce aquí, se rellena con el identificador del dispositivo.
    body.nombre = f.nombre.trim() || deviceId();
    if (f.codigoCamarero) body.codigoCamarero = f.codigoCamarero;
    if (f.comercioId) body.comercioId = Number(f.comercioId);

    const peticion = `POST /api/comercio/tarjetas/${f.tarjetaId}/movimiento · Idempotency-Key: ${idem}`;
    try {
      const res = await api(`/api/comercio/tarjetas/${f.tarjetaId}/movimiento`, {
        method: 'POST',
        body,
        idempotencia: idem,
      });
      setRespuesta({ peticion, enviado: body, ...res });
      if (!f.idempotencia) set('idempotencia', idem); // reutilizar en reintentos
    } catch (err) {
      setRespuesta({ peticion, enviado: body, error: err.message, code: err.code, status: err.status });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h2>Testeo</h2>
          <p className="muted">Movimiento de puntos/premios a mano y respuesta cruda del servidor</p>
        </div>
        <button className="btn" onClick={consultarSalud}>
          GET /health
        </button>
      </header>

      <div className="rejilla rejilla-2">
        <form className="tarjeta form" onSubmit={enviar}>
          <h4>Movimiento</h4>
          <div className="rejilla rejilla-2">
            <Campo label="tarjetaId" requerido>
              <input className="input" type="number" min="1" value={f.tarjetaId} onChange={(e) => set('tarjetaId', e.target.value)} />
            </Campo>
            <Campo label="comercioId (sólo admin)" hint="Obligatorio si actúas sobre comercio sin sesión propia">
              <input className="input" type="number" min="1" value={f.comercioId} onChange={(e) => set('comercioId', e.target.value)} />
            </Campo>
            <Campo label="puntosDelta" requerido>
              <input className="input" type="number" step="1" value={f.puntosDelta} onChange={(e) => set('puntosDelta', e.target.value)} />
            </Campo>
            <Campo label="premiosDelta" requerido>
              <input className="input" type="number" step="1" value={f.premiosDelta} onChange={(e) => set('premiosDelta', e.target.value)} />
            </Campo>
            <Campo label="tipo (opcional)">
              <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t || '— deducir —'}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Idempotency-Key" hint="Vacío = se genera una nueva">
              <input className="input" value={f.idempotencia} onChange={(e) => set('idempotencia', e.target.value)} />
            </Campo>
          </div>
          <Campo label="descripcion">
            <input className="input" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
          </Campo>
          <div className="rejilla rejilla-2">
            <Campo
              label="nombre"
              hint={`Vacío = se envía el identificador de este dispositivo (${deviceId()}). Escrito = se fuerza ese valor.`}
            >
              <input className="input" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </Campo>
            <Campo label="codigoCamarero">
              <input className="input" value={f.codigoCamarero} onChange={(e) => set('codigoCamarero', e.target.value)} />
            </Campo>
          </div>
          <button className="btn btn-primario" disabled={enviando || !f.tarjetaId}>
            {enviando ? 'Enviando…' : 'Enviar movimiento'}
          </button>
        </form>

        <div className="tarjeta">
          <h4>Respuesta</h4>
          {respuesta ? <pre className="json alto">{JSON.stringify(respuesta, null, 2)}</pre> : <p className="muted">Aún no se ha enviado nada.</p>}
        </div>
      </div>

      <Aviso tipo="info">
        Regla de oro del contrato: reutiliza la misma <code>Idempotency-Key</code> en los reintentos de una misma
        acción; si cambias los deltas, genera una clave nueva (o recibirás <code>409 IDEMPOTENCIA_CONFLICTO</code>).
      </Aviso>
    </>
  );
}
