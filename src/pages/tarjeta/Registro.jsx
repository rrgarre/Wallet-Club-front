import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Aviso, Campo } from '../../components/ui.jsx';
/**
 * Código por defecto a 48 ceros: NO corresponde a ningún comercio real,
 * así la web funciona para probar y el parámetro se cambia en el navegador:
 *   /tarjeta/registro/<idRandomLargo del comercio>
 * (también acepta ?c=<idRandomLargo>)
 */
export const CODIGO_POR_DEFECTO = '0000000000000000000000000000000000000000';

export default function Registro() {
  const { idRandomLargo } = useParams();
  const [params] = useSearchParams();
  const codigo = idRandomLargo || params.get('c') || CODIGO_POR_DEFECTO;

  return (
    <div className="pagina-login">
      <div className="tarjeta-login">
        <div className="marca">
          <span className="marca-logo">◑</span>
          <div>
            <h1>Alta de tarjeta</h1>
            <p className="muted">Crea tu cuenta y empieza a sumar puntos</p>
          </div>
        </div>

        {/* <div className="bloque-codigo">
          <span className="muted small">Comercio:</span>
          <code className="codigo largo">{codigo}</code>
        </div> */}

        <FormRegistro idRandomLargo={codigo} publico />

        </div>
    </div>
  );
}

/**
 * Formulario de alta reutilizado por la ruta pública y por el panel de admin.
 * - `onRegistrado(respuesta)` recibe la respuesta completa del endpoint.
 * - `publico` = la ruta pública (frente al alta desde el panel de admin): no
 *   ofrece «Registrar otra tarjeta».
 *
 * El alta **NO inicia sesión** (contrato §3.5, v1.6): el `201` viene sin
 * `token` ni `role`, así que el navegador queda sin loguear y quien quiera
 * entrar en `/tarjeta` lo hace a mano con el login.
 *
 * El backend devuelve `googleWalletUrl` tras el alta: es el enlace con el que
 * el cliente registra la tarjeta en su Wallet.
 */
export function urlWallet(res) {
  return res?.googleWalletUrl || res?.usuario?.googleWalletUrl || res?.tarjeta?.googleWalletUrl || null;
}

export function FormRegistro({ idRandomLargo, onRegistrado, publico = false }) {
  const { registrarTarjeta } = useAuth();
  // v1.6: sin contraseña — la pone el servidor (USUARIO_PASSWORD) y el
  // formulario de alta ya no la pide ni la envía (API_CONTRACT §3.5).
  const [f, setF] = useState({ nombre: '', email: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState(null); // respuesta del alta

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

  const reiniciar = () => {
    setCreado(null);
    setF({ nombre: '', email: '' });
    setError(null);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await registrarTarjeta(idRandomLargo, {
        nombre: f.nombre.trim(),
        email: f.email.trim(),
      });
      // §3.5 (v1.6): el 201 llega SIN token → aquí NO se abre sesión: ni
      // `entrar()`, ni localStorage, ni redirección a la pantalla de usuario.
      setCreado(res);
      if (onRegistrado) onRegistrado(res);
    } catch (err) {
      if (err.code === 'COMERCIO_NOT_FOUND') {
        setError('Ese código de comercio no existe. Comprueba el enlace o pide el QR correcto al comercio.');
      } else if (err.code === 'EMAIL_DUPLICADO') {
        setError('Ese email ya está registrado en este comercio.');
      } else {
        setError(`${err.message}${err.code ? ` (${err.code})` : ''}`);
      }
    } finally {
      setEnviando(false);
    }
  };

  /* ── Alta correcta: enseñar el enlace de Google Wallet ── */
  if (creado) {
    const wallet = urlWallet(creado);
    return (
      <div className="alta-exito">
        <Aviso tipo="ok">
          Tarjeta creada: <b>{creado.usuario?.nombre || f.nombre}</b>
          {creado.comercio?.nombre ? (
            <>
              {' '}
              en <b>{creado.comercio.nombre}</b>
            </>
          ) : null}
          {/* {creado.usuario?.id ? ` (id ${creado.usuario.id})` : ''} */}
          .
        </Aviso>

        {wallet ? (
          <>
            <a className="btn btn-wallet" href={wallet} target="_blank" rel="noopener noreferrer">
              <span className="wallet-icono">＋</span> Añadir tarjeta a Google Wallet
            </a>
            <p className="muted small">
              Se abrirá Google Wallet para que el cliente registre su tarjeta en el móvil.
            </p>
            {/* <code className="codigo largo">{wallet}</code> */}
          </>
        ) : (
          <p className="muted small">
            El servidor no ha devuelto enlace de Google Wallet para esta tarjeta (campo <code>googleWalletUrl</code>).
          </p>
        )}

        {/* Sólo el alta desde admin ofrece repetir. La pública no inicia
            sesión (201 sin token): quien quiera ver su tarjeta entra a mano
            desde /tarjeta con los enlaces de abajo. */}
        {!publico && (
          <div className="form-pie">
            <button className="btn" onClick={reiniciar}>
              Registrar otra tarjeta
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="form">
      <Aviso tipo="error">{error}</Aviso>
      <Campo label="Nombre" requerido>
        <input className="input" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus />
      </Campo>
      <Campo label="Email" requerido>
        <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
      </Campo>
      {/* Sin contraseña: la fija el servidor (contrato §3.5 v1.6) */}
      <button className="btn btn-primario" disabled={enviando || !f.nombre || !f.email}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
