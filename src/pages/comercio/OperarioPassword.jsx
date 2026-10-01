import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { BarraCliente } from '../../components/guardas.jsx';
import { Aviso, Campo } from '../../components/ui.jsx';
import { traducir } from './Password.jsx';

/**
 * Cambio de la contraseña de OPERARIO/camarero (contrato §5.6, v1.9):
 *
 *     PATCH /api/comercio/operario-password
 *     { passwordActual, operarioPasswordNueva, operarioPasswordConfirmacion }
 *
 * Réplica de la pantalla de cambio de contraseña del comercio (§5.5), con un
 * matiz que hay que dejar claro en la interfaz: `passwordActual` es la
 * contraseña DEL COMERCIO (la del panel), **no** la de operario — el comercio
 * no la conoce ni la necesita; su propia contraseña es la que garantía.
 *
 * Sólo el rol comercio (el operario recibe 403 FORBIDDEN_ROLE: nadie se
 * autorrestringe; el admin también puede cambiarla con `comercioId` desde
 * /admin/comercios).
 */
const MIN_PASSWORD = 8;

export default function OperarioPassword() {
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
      setError(`La nueva contraseña de operario debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (f.nueva !== f.repetir) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    // Mismo motivo que el 400 PASSWORDS_IGUALES del servidor (v1.9): si la
    // nueva de operario fuera igual a la del comercio, el login sólo daría
    // rol operario y el comercio perdería su panel. Como aquí la contraseña
    // del comercio está tecleada en `actual`, podemos avisar antes de enviar.
    if (f.nueva === f.actual) {
      setError('La contraseña de operario no puede ser igual a tu contraseña de comercio: el servidor la rechaza.');
      return;
    }
    setEnviando(true);
    try {
      await api('/api/comercio/operario-password', {
        method: 'PATCH',
        body: {
          passwordActual: f.actual,
          operarioPasswordNueva: f.nueva,
          operarioPasswordConfirmacion: f.repetir,
        },
      });
      // El contrato: la de operario anterior deja de valer al instante.
      setOk('Contraseña de operario actualizada: la anterior deja de valer en el login al instante.');
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
        titulo="Contraseña de operario"
        extra={
          <Link className="btn btn-ghost btn-mini" to="/comercio">
            Mi comercio
          </Link>
        }
      />

      <main className="contenedor contenedor-estrecho">
        <div className="tarjeta">
          <h3>Cambiar contraseña de operario</h3>
          <p className="muted">
            Es la contraseña con la que entran tus camareros (rol <b>operario</b>: sólo escanear y capturar). Aquí{' '}
            <b>no se teclea la contraseña de operario antigua</b> — no hace falta conocerla: como garantía se usa{' '}
            <b>tu contraseña de comercio</b> (la del panel). Si la pierdes, el administrador puede restablecerla desde{' '}
            <code>/admin/comercios</code>.
          </p>

          <form className="form" onSubmit={enviar}>
            <Aviso tipo="error" onCerrar={() => setError(null)}>
              {error}
            </Aviso>
            <Aviso tipo="ok" onCerrar={() => setOk(null)}>
              {ok}
            </Aviso>

            <Campo label="Tu contraseña de comercio" requerido hint="La del panel: es la que valida el cambio">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={f.actual}
                onChange={(e) => set('actual', e.target.value)}
                autoFocus
              />
            </Campo>

            <Campo
              label="Nueva contraseña de operario"
              requerido
              hint={`Mínimo ${MIN_PASSWORD} caracteres · no puede ser igual a la tuya`}
            >
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={f.nueva}
                onChange={(e) => set('nueva', e.target.value)}
              />
            </Campo>

            <Campo label="Repite la nueva contraseña de operario" requerido>
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
