import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ExigirRol } from '../../components/guardas.jsx';
import { FormLoginComercio } from '../../components/logins.jsx';
import { Aviso, Badge, Campo, Cargando } from '../../components/ui.jsx';
import { copiar, fecha, urlRegistro } from '../../lib/util.js';

export default function Zona() {
  const { sesion } = useAuth();

  if (!sesion) return <Publico />;
  if (sesion.role !== 'comercio') return <ExigirRol rol="comercio">{null}</ExigirRol>;
  return <Panel />;
}

function Publico() {
  const [recargar, setRecargar] = useState(0);
  const params = new URLSearchParams(window.location.search);
  const prefijo = params.get('c') || '';

  return (
    <div className="pagina-login">
      <div className="tarjeta-login">
        <div className="marca">
          <span className="marca-logo">◑</span>
          <div>
            <h1>Wallet Club · Comercios</h1>
            <p className="muted">Consulta tus tarjetas y acumula puntos</p>
          </div>
        </div>
        <FormLoginComercio key={recargar} prefijo={prefijo} />
        <div className="enlaces-login">
          <Link to="/login">Acceso unificado</Link>
          <Link to="/tarjeta">Acceso de tarjeta</Link>
        </div>
        <Aviso tipo="info">
          Si llegas desde el QR de tu comercio, añade <code>?c=TU_CODIGO_LARGO</code> a esta URL y el identificador
          quedará rellenado.
        </Aviso>
        <button className="btn btn-ghost btn-mini" onClick={() => setRecargar(recargar + 1)}>
          Reiniciar formulario
        </button>
      </div>
    </div>
  );
}

function Panel() {
  const { salir } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [tarjetas, setTarjetas] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    Promise.all([api('/api/comercio/perfil'), api('/api/comercio/tarjetas')])
      .then(([p, t]) => {
        setPerfil(p.comercio);
        setTarjetas(t.tarjetas);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="zona-cliente">
      <header className="barra">
        <div className="barra-izq">
          <span className="marca-logo">◑</span>
          <b>Wallet Club</b>
          <span className="barra-sep">/</span>
          <span>Mi comercio</span>
        </div>
        <div className="barra-der">
          <Link className="btn btn-primario btn-mini" to="/comercio/captura">
            Capturar puntos
          </Link>
          <button className="btn btn-ghost btn-mini" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <main className="contenedor">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!perfil && !error && <Cargando />}

        {perfil && (
          <>
            <div className="tarjeta">
              <div className="perfil-comercio">
                <div>
                  <span className="muted small">Comercio</span>
                  <h2>{perfil.nombre}</h2>
                  <p className="muted">
                    {perfil.activo === 1 ? <Badge tono="ok">Activo</Badge> : <Badge tono="mal">Inactivo</Badge>} ·{' '}
                    alta {fecha(perfil.createdAt)}
                  </p>
                </div>
                <div className="rejilla rejilla-2">
                  <div className="mini-dato">
                    <span className="muted small">Puntos por premio</span>
                    <b className="num grande">{perfil.puntosPremio}</b>
                  </div>
                  <div className="mini-dato">
                    <span className="muted small">Premio</span>
                    <b>{perfil.premioDescripcion || '—'}</b>
                  </div>
                </div>
              </div>

              <div className="bloque-codigo">
                <span className="muted small">Tu código de registro (idRandomLargo) — pégalo en el QR:</span>
                <div className="fila-codigo">
                  <code className="codigo largo">{perfil.idRandomLargo}</code>
                  <button
                    className="btn btn-mini"
                    onClick={async () =>
                      setAviso({
                        tipo: 'ok',
                        texto: (await copiar(perfil.idRandomLargo)) ? 'Código copiado.' : 'No se pudo copiar.',
                      })
                    }
                  >
                    Copiar código
                  </button>
                  <button
                    className="btn btn-mini"
                    onClick={async () => {
                      const url = urlRegistro(perfil.idRandomLargo);
                      setAviso({ tipo: 'ok', texto: (await copiar(url)) ? `Enlace de alta copiado: ${url}` : url });
                    }}
                  >
                    Copiar enlace de alta
                  </button>
                  <Link className="btn btn-mini" to={`/tarjeta/registro/${perfil.idRandomLargo}`}>
                    Ver formulario de alta
                  </Link>
                </div>
                <span className="muted small">Alta: {urlRegistro(perfil.idRandomLargo)}</span>
              </div>
            </div>

            <Aviso tipo={aviso?.tipo} onCerrar={() => setAviso(null)}>
              {aviso?.texto}
            </Aviso>

            <div className="tarjeta">
              <div className="subcab">
                <h3>Mis tarjetas</h3>
                <Link className="btn btn-mini" to="/comercio/captura">
                  Elegir para capturar
                </Link>
              </div>
              {!tarjetas && <Cargando />}
              {tarjetas && tarjetas.length === 0 && <p className="muted">Todavía no tienes clientes.</p>}
              {tarjetas && tarjetas.length > 0 && (
                <div className="tabla-wrap">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Id</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th className="der">Puntos</th>
                        <th className="der">Premios</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarjetas.map((t) => (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>
                            <b>{t.nombre}</b>
                          </td>
                          <td>{t.email}</td>
                          <td className="der num">{t.puntos}</td>
                          <td className="der num">{t.premios}</td>
                          <td>{t.activo === 1 ? <Badge tono="ok">Activa</Badge> : <Badge tono="mal">Inactiva</Badge>}</td>
                          <td>
                            <Link className="btn btn-mini" to={`/comercio/captura/${t.id}`}>
                              Capturar
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <Aviso tipo="info">
              El contrato no expone el histórico de operaciones al comercio (sólo a admin). Para verlo, entra en el
              panel de administración.
            </Aviso>
          </>
        )}
      </main>
    </div>
  );
}
