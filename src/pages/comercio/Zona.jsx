import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ExigirRol } from '../../components/guardas.jsx';
import { FormLoginComercio } from '../../components/logins.jsx';
import { BotonInstalar } from '../../components/pwa.jsx';
import { Aviso, Badge, Campo, Cargando } from '../../components/ui.jsx';
import { copiar, fecha, urlRegistro } from '../../lib/util.js';

export default function Zona() {
  const { sesion } = useAuth();

  if (!sesion) return <Publico />;
  // El operario (v1.8) sólo puede escanear y capturar: si ha ido a parar
  // aquí, se le manda directamente a su lector en lugar de a un panel que
  // no puede ver (el servidor le respondería 403 en todo caso).
  if (sesion.role === 'operario') return <Navigate to="/comercio/escanear" replace />;
  if (sesion.role !== 'comercio') return <ExigirRol rol="comercio">{null}</ExigirRol>;
  return <Panel />;
}

function Publico() {
  const [recargar, setRecargar] = useState(0);

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
        <FormLoginComercio key={recargar} />
        {/* Acceso directo al lector: si no hay sesión, allí se pedirá el login */}
        <div className="accesos">
          <Link className="acceso-grande" to="/comercio/escanear">
            <span className="acceso-icono">📷</span> Escanear QR de tarjeta
          </Link>
        </div>
        <div className="enlaces-login">
          <Link to="/login">Acceso unificado</Link>
          <Link to="/tarjeta">Acceso de tarjeta</Link>
          <BotonInstalar className="btn btn-ghost btn-mini enlace-boton" />
        </div>
        <Aviso tipo="info">
          Entra con tu <b>nombre de usuario</b> (te lo dio el admin) y tu contraseña. Si introduces la de camarero
          entrarás como <b>operario</b>: sólo lector de QR y captura de puntos.
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
          <Link className="btn btn-primario btn-mini" to="/comercio/escanear">
            Escanear QR
          </Link>
          <Link className="btn btn-ghost btn-mini" to="/comercio/captura">
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
            {/* Accesos rápidos: lector de QR y captura manual */}
            <div className="accesos">
              <Link className="acceso-grande" to="/comercio/escanear">
                <span className="acceso-icono">📷</span> Escanear QR de tarjeta
              </Link>
              <Link className="acceso-grande secundario" to="/comercio/captura">
                <span className="acceso-icono">✏️</span> Capturar puntos
              </Link>
              <Link className="acceso-grande secundario" to="/comercio/password">
                <span className="acceso-icono">🔑</span> Cambiar contraseña
              </Link>
              <Link className="acceso-grande secundario" to="/comercio/operario-password">
                <span className="acceso-icono">🧑‍🍳</span> Cambiar contraseña de operario
              </Link>
            </div>

            <div className="tarjeta">
              <div className="perfil-comercio">
                <div>
                  <span className="muted small">Comercio</span>
                  <h2>{perfil.nombre}</h2>
                  <p className="muted">
                    {perfil.activo === 1 ? <Badge tono="ok">Activo</Badge> : <Badge tono="mal">Inactivo</Badge>} ·{' '}
                    alta {fecha(perfil.createdAt)}
                  </p>
                  {perfil.nombreUsuario && (
                    <p className="muted small">
                      Nombre de usuario: <code>{perfil.nombreUsuario}</code>
                    </p>
                  )}
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
                  <div className="mini-dato">
                    {/* v1.10: 0 = sin límite → los premios nunca se recortan */}
                    <span className="muted small">Techo de premios (por tarjeta)</span>
                    {Number(perfil.maximoPremios) > 0 ? (
                      <b className="num grande">{perfil.maximoPremios}</b>
                    ) : (
                      <b>Sin límite</b>
                    )}
                    <span className="muted small">
                      {Number(perfil.maximoPremios) > 0
                        ? 'Al superarlo, el servidor recorta el exceso'
                        : '0 = sin recorte de premios'}
                    </span>
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
                          <td>
                            {t.activo === 1 ? <Badge tono="ok">Activa</Badge> : <Badge tono="mal">Inactiva</Badge>}
                            {/* v1.11: tope = premios en el techo y puntos en umbral − 1
                                (perfil §5.1 + saldos §5.2: no hace falta pedirlo al API) */}
                            {Number(perfil?.maximoPremios) > 0 &&
                              Number(perfil?.puntosPremio) > 0 &&
                              t.premios >= Number(perfil.maximoPremios) &&
                              t.puntos >= Number(perfil.puntosPremio) - 1 && (
                                <Badge tono="aviso">Tope</Badge>
                              )}
                          </td>
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
