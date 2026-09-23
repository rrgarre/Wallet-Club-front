import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Aviso, Campo, Cargando } from '../../components/ui.jsx';
import TablaOperaciones from '../../components/TablaOperaciones.jsx';

const TIPOS = ['', 'acumulacion', 'canje', 'correccion', 'ajuste', 'canje_automatico'];
const VACIO = { comercioId: '', tarjetaId: '', tipo: '', desde: '', hasta: '', tamano: 50 };

export default function Operaciones() {
  const [f, setF] = useState(VACIO);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

  useEffect(() => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== '' && v !== null) qs.set(k, v);
    });
    qs.set('pagina', pagina);
    setCargando(true);
    api(`/api/admin/operaciones?${qs}`)
      .then((d) => {
        setDatos(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [f, pagina]);

  const aplicar = (e) => {
    e.preventDefault();
    setPagina(1);
    setF({ ...f });
  };

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / (datos.tamano || 50))) : 1;

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h2>Operaciones</h2>
          <p className="muted">Libro de movimientos (inmutable), con filtros y paginación</p>
        </div>
      </header>

      <form className="filtros tarjeta" onSubmit={aplicar}>
        <Campo label="Comercio id">
          <input className="input" value={f.comercioId} onChange={(e) => set('comercioId', e.target.value)} />
        </Campo>
        <Campo label="Tarjeta id">
          <input className="input" value={f.tarjetaId} onChange={(e) => set('tarjetaId', e.target.value)} />
        </Campo>
        <Campo label="Tipo">
          <select className="input" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t || 'Todos'}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Desde" hint="YYYY-MM-DD HH:MM:SS">
          <input className="input" value={f.desde} onChange={(e) => set('desde', e.target.value)} />
        </Campo>
        <Campo label="Hasta" hint="YYYY-MM-DD HH:MM:SS">
          <input className="input" value={f.hasta} onChange={(e) => set('hasta', e.target.value)} />
        </Campo>
        <Campo label="Tamaño">
          <input
            className="input"
            type="number"
            min="1"
            max="200"
            value={f.tamano}
            onChange={(e) => set('tamano', e.target.value)}
          />
        </Campo>
        <div className="filtros-acciones">
          <button className="btn btn-primario">Buscar</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setF(VACIO);
              setPagina(1);
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && <Cargando texto="Consultando…" />}

      {datos && (
        <>
          <div className="paginacion">
            <span className="muted">
              {datos.total} operaciones · página {datos.pagina} de {totalPaginas}
            </span>
            <div>
              <button className="btn btn-mini" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                ← Anterior
              </button>
              <button className="btn btn-mini" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>
                Siguiente →
              </button>
            </div>
          </div>
          <TablaOperaciones filas={datos.filas} />
        </>
      )}
    </>
  );
}
