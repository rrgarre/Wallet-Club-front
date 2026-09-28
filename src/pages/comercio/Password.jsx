import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { BarraCliente } from '../../components/guardas.jsx';
import { Aviso, Campo } from '../../components/ui.jsx';

/**
 * Cambio de contraseña del propio comercio (contrato §5.5):
 *
 *     PATCH /api/comercio/password
 *     { passwordActual, passwordNueva }
 *
 * Sólo el rol comercio: el admin la restablece desde /admin/comercios.
 * `passwordNueva` mínimo 8 caracteres (MIN_PASSWORD_ADMIN).
 */
const MIN_PASSWORD = 8;

/** Traduce los códigos del contrato a texto para el comercio. */
function traducir(err) {
  switch (err.code) {
    case 'PASSWORD_ACTUAL_INCORRECTA':
      return 'La contraseña actual no coincide.';
    case 'COMERCIO_INACTIVO':
      return 'Tu comercio está inactivo: pide al administrador que reactive la cuenta o que te restablezca la contraseña.';
    case 'FORBIDDEN_ROLE':
      return 'Esta pantalla es sólo para el rol comercio.';
    case 'UNAUTHORIZED':
    case 'INVALID_TOKEN':
      return 'Tu sesión ha caducado. Cierra sesión y vuelve a entrar.';
    case 'VALIDATION':
      // El servidor ya detalla el motivo (faltan campos o nueva < 8)
      return err.message;
    default:
      return `${err.message}${err.code ? ` (${err.code})` : ''}`;
  }
}

export default function PasswordComercio() {
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (f.nueva.length < MIN_PASSWORD) {
      setError(`La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (f.nueva !== f.repetir) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      await api('/api/comercio/password', {
        method: 'PATCH',
        body: { passwordActual: f.actual, passwordNueva: f.nueva },
      });
      // El contrato: los tokens ya emitidos siguen valiendo hasta expirar.
      setOk('Contraseña actualizada: la anterior deja de valer en todos los logins de este comercio.');
      setF({ actual: '', nueva: '', repetir: '' });
    } catch (err) {
      setError(traducir(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="zona-cliente">
      <BarraCliente
        titulo="Contraseña"
        extra={
          <Link className="btn btn-ghost btn-mini" to="/comercio">
            Mi comercio
          </Link>
        }
      />

      <main className="contenedor contenedor-estrecho">
        <div className="tarjeta">
          <h3>Cambiar contraseña</h3>
          <p className="muted">
            Es la contraseña con la que entras en este panel (rol comercio). Sólo puedes cambiar tú la tuya; si la
            pierdes, el administrador puede restablecerla desde <code>/admin/comercios</code>.
          </p>

          <form className="form" onSubmit={enviar}>
            <Aviso tipo="error" onCerrar={() => setError(null)}>
              {error}
            </Aviso>
            <Aviso tipo="ok" onCerrar={() => setOk(null)}>
              {ok}
            </Aviso>

            <Campo label="Contraseña actual" requerido>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={f.actual}
                onChange={(e) => set('actual', e.target.value)}
                autoFocus
              />
            </Campo>

            <Campo label="Contraseña nueva" requerido hint={`Mínimo ${MIN_PASSWORD} caracteres`}>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={f.nueva}
                onChange={(e) => set('nueva', e.target.value)}
              />
            </Campo>

            <Campo label="Repite la contraseña nueva" requerido>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={f.repetir}
                onChange={(e) => set('repetir', e.target.value)}
              />
            </Campo>

            <div className="form-pie">
              <button
                className="btn btn-primario"
                disabled={enviando || !f.actual || !f.nueva || !f.repetir}
              >
                {enviando ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
              <Link className="btn" to="/comercio">
                Volver
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
