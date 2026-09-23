import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Aviso, Badge, Campo, Cargando, Modal, Vacio } from '../../components/ui.jsx';
import { copiar, urlRegistro } from '../../lib/util.js';

const VACIO = { nombre: '', password: '', puntosPremio: 10, premioDescripcion: '', activo: true };

export default function Comercios() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // comercio en edición o "nuevo"
  const [aviso, setAviso] = useState(null);

  const cargar = async () => {
    try {
      const d = await api('/api/admin/comercios');
      setLista(d.comercios);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  /** Guarda; si falla, propaga el error para que el formulario lo pinte dentro del modal. */
  const guardar = async (datos, id) => {
    if (id) await api(`/api/admin/comercios/${id}`, { method: 'PATCH', body: datos });
    else await api('/api/admin/comercios', { method: 'POST', body: datos });
    setEditando(null);
    setAviso({ tipo: 'ok', texto: id ? 'Comercio actualizado.' : 'Comercio creado.' });
    cargar();
  };

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h2>Comercios</h2>
          <p className="muted">Alta, edición y código de registro (QR) de cada comercio</p>
        </div>
        <button className="btn btn-primario" onClick={() => setEditando({ ...VACIO })}>
          + Nuevo comercio
        </button>
      </header>

      <Aviso tipo={aviso?.tipo} onCerrar={() => setAviso(null)}>
        {aviso?.texto}
      </Aviso>
      {error && <Aviso tipo="error">{error}</Aviso>}

      {!lista && !error && <Cargando />}
      {lista && lista.length === 0 && <Vacio texto="Todavía no hay comercios." />}

      {lista && lista.length > 0 && (
        <div className="tabla-wrap tarjeta">
          <table className="tabla">
            <thead>
              <tr>
                <th>Id</th>
                <th>Nombre</th>
                <th className="der">Puntos/premio</th>
                <th>Premio</th>
                <th>Estado</th>
                <th>Código de registro (idRandomLargo)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>
                    <b>{c.nombre}</b>
                  </td>
                  <td className="der num">{c.puntosPremio}</td>
                  <td>{c.premioDescripcion || '—'}</td>
                  <td>{c.activo === 1 ? <Badge tono="ok">Activo</Badge> : <Badge tono="mal">Inactivo</Badge>}</td>
                  <td>
                    <code className="codigo" title={c.idRandomLargo}>
                      {c.idRandomLargo.slice(0, 10)}…
                    </code>
                    <button
                      className="btn btn-mini"
                      onClick={async () => setAviso({ tipo: 'ok', texto: (await copiar(c.idRandomLargo)) ? 'Código copiado.' : 'No se pudo copiar.' })}
                    >
                      Copiar
                    </button>
                  </td>
                  <td className="acciones">
                    <button className="btn btn-mini" onClick={() => setEditando({ ...c, password: '' })}>
                      Editar
                    </button>
                    <Link className="btn btn-mini" to={`/admin/tarjetas?comercioId=${c.id}`}>
                      Tarjetas
                    </Link>
                    <Link className="btn btn-mini" to={`/admin/alta-tarjeta?comercioId=${c.id}`}>
                      Alta cliente
                    </Link>
                    <button
                      className="btn btn-mini"
                      onClick={async () => {
                        const url = urlRegistro(c.idRandomLargo);
                        setAviso({ tipo: 'ok', texto: (await copiar(url)) ? `Enlace de registro copiado: ${url}` : url });
                      }}
                    >
                      Copiar enlace QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormComercio
          valor={editando}
          onCerrar={() => {
            setEditando(null);
            setAviso(null);
          }}
          onGuardar={guardar}
        />
      )}
    </>
  );
}

function FormComercio({ valor, onCerrar, onGuardar }) {
  const [f, setF] = useState(valor);
  const esEdicion = typeof valor.id === 'number';
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const body = {};
    if (f.nombre && f.nombre !== valor.nombre) body.nombre = f.nombre;
    if (f.password && (!esEdicion || f.password !== valor.password)) body.password = f.password;
    if (!esEdicion || String(f.puntosPremio) !== String(valor.puntosPremio)) body.puntosPremio = Number(f.puntosPremio);
    if ((f.premioDescripcion || '') !== (valor.premioDescripcion || '')) body.premioDescripcion = f.premioDescripcion;
    if (Boolean(f.activo) !== Boolean(valor.activo)) body.activo = Boolean(f.activo);

    if (!esEdicion && (!f.nombre || !f.password)) {
      setError('Nombre y contraseña son obligatorios.');
      setEnviando(false);
      return;
    }
    if (Object.keys(body).length === 0 && esEdicion) {
      setError('No has cambiado nada.');
      setEnviando(false);
      return;
    }
    try {
      await onGuardar(body, esEdicion ? valor.id : null);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
      return;
    }
    setEnviando(false);
  };

  return (
    <Modal titulo={esEdicion ? `Editar comercio #${valor.id}` : 'Nuevo comercio'} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="form">
        <Aviso tipo="error">{error}</Aviso>
        <Campo label="Nombre" requerido={!esEdicion}>
          <input className="input" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
        </Campo>
        <Campo
          label="Contraseña"
          requerido={!esEdicion}
          hint={esEdicion ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres'}
        >
          <input className="input" type="password" value={f.password} onChange={(e) => set('password', e.target.value)} />
        </Campo>
        <div className="rejilla rejilla-2">
          <Campo label="Puntos por premio">
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={f.puntosPremio}
              onChange={(e) => set('puntosPremio', e.target.value)}
            />
          </Campo>
          <Campo label="Descripción del premio">
            <input
              className="input"
              value={f.premioDescripcion || ''}
              onChange={(e) => set('premioDescripcion', e.target.value)}
            />
          </Campo>
        </div>
        <label className="casilla">
          <input type="checkbox" checked={Boolean(f.activo)} onChange={(e) => set('activo', e.target.checked)} />
          Comercio activo
        </label>

        {esEdicion && valor.idRandomLargo && (
          <div className="bloque-codigo">
            <span className="muted small">Código de registro (idRandomLargo):</span>
            <code className="codigo largo">{valor.idRandomLargo}</code>
            <span className="muted small">Enlace: {urlRegistro(valor.idRandomLargo)}</span>
          </div>
        )}

        <div className="form-pie">
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
