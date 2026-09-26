import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../api/client.js';
import { capturaPath } from '../../config.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ExigirRol } from '../../components/guardas.jsx';
import { FormLoginTarjeta } from '../../components/logins.jsx';
import TablaOperaciones from '../../components/TablaOperaciones.jsx';
import { Aviso, Badge, Cargando } from '../../components/ui.jsx';
import { copiar } from '../../lib/util.js';

export default function Zona() {
  const { sesion } = useAuth();

  if (!sesion) return <Publico />;
  if (sesion.role !== 'tarjeta') return <ExigirRol rol="tarjeta">{null}</ExigirRol>;
  return <Panel />;
}

function Publico() {
  return (
    <div className="pagina-login">
      <div className="tarjeta-login">
        <div className="marca">
          <span className="marca-logo">◑</span>
          <div>
            <h1>Wallet Club · Mis puntos</h1>
            <p className="muted">Consulta tus puntos y premios</p>
          </div>
        </div>
        <FormLoginTarjeta />
        <div className="enlaces-login">
          <Link to="/tarjeta/registro">Darme de alta</Link>
          <Link to="/comercio">Acceso de comercio</Link>
          <Link to="/login">Acceso unificado</Link>
        </div>
      </div>
    </div>
  );
}

function Panel() {
  const { sesion, salir } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [ops, setOps] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    Promise.all([api('/api/tarjeta/perfil'), api('/api/tarjeta/operaciones?limite=100')])
      .then(([p, o]) => {
        setPerfil(p.tarjeta);
        setOps(o.operaciones);
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
          <span>Mis puntos</span>
        </div>
        <div className="barra-der">
          <span className="muted">{sesion.usuario?.email}</span>
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
            <div className="captura-tarjeta">
              <div className="captura-id">
                <span className="muted small">Tarjeta #{perfil.id} · comercio #{perfil.comercioId}</span>
                <h2>{perfil.nombre}</h2>
                <span className="muted">{perfil.email}</span>
              </div>

              <div className="contadores">
                <div className="contador">
                  <span className="contador-etiqueta">Puntos</span>
                  <b className="contador-valor">{perfil.puntos}</b>
                </div>
                <div className="contador">
                  <span className="contador-etiqueta">Premios</span>
                  <b className="contador-valor premio">{perfil.premios}</b>
                </div>
              </div>

              <p className="muted small">
                {perfil.activo === 1 ? <Badge tono="ok">Tarjeta activa</Badge> : <Badge tono="mal">Tarjeta inactiva</Badge>}{' '}
                · alta {new Date(perfil.createdAt).toLocaleDateString('es-ES')}
              </p>

              <div className="qr-fila">
                <div className="qr-caja">
                  {/* El QR sólo lleva el identificador de la tarjeta */}
                  <QRCodeSVG value={String(perfil.id)} size={236} level="M" marginSize={1} />
                </div>
                <div className="qr-info">
                  <b>QR de la tarjeta</b>
                  <p className="muted small">
                    Muéstralo al comercio: su lector lee el identificador (<b>{perfil.id}</b>) y abre directamente la
                    pantalla para modificar los puntos de <b>esta</b> tarjeta.
                  </p>
                  <code className="codigo largo">Identificador: {perfil.id}</code>
                  <div className="fila-codigo">
                    <button
                      className="btn btn-mini"
                      onClick={async () =>
                        setAviso({
                          tipo: 'ok',
                          texto: (await copiar(String(perfil.id)))
                            ? 'Identificador copiado.'
                            : 'No se pudo copiar.',
                        })
                      }
                    >
                      Copiar identificador
                    </button>
                    <Link className="btn btn-mini" to={capturaPath(perfil.id)}>
                      Abrir captura
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <Aviso tipo={aviso?.tipo} onCerrar={() => setAviso(null)}>
              {aviso?.texto}
            </Aviso>

            <div className="tarjeta">
              <div className="subcab">
                <h3>Mi historial</h3>
                <span className="muted small">{ops ? `${ops.length} movimientos` : ''}</span>
              </div>
              {!ops && <Cargando />}
              {ops && ops.length === 0 && <p className="muted">Todavía no tienes movimientos.</p>}
              {ops && ops.length > 0 && <TablaOperaciones filas={ops} amplicada={false} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
