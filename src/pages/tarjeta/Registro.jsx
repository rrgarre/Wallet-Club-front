import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

        <div className="bloque-codigo">
          <span className="muted small">Comercio (código de la URL, fijo en el formulario):</span>
          <code className="codigo largo">{codigo}</code>
          <span className="muted small">
            Editando el navegador: <code>/tarjeta/registro/&lt;idRandomLargo&gt;</code>
          </span>
        </div>

        <FormRegistro idRandomLargo={codigo} redirigir />

        <div className="enlaces-login">
          <Link to="/tarjeta">Ya tengo cuenta</Link>
          <Link to="/login">Acceso unificado</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Formulario de alta reutilizado por la ruta pública y por el panel de admin.
 * - `onRegistrado(respuesta)` recibe la respuesta completa del endpoint.
 * - `redirigir` = la ruta pública loguea al nuevo cliente (sin salir todavía
 *   de esta pantalla, para poder enseñar el enlace de Google Wallet).
 *
 * El backend devuelve `googleWalletUrl` tras el alta: es el enlace con el que
 * el cliente registra la tarjeta en su Wallet.
 */
export function urlWallet(res) {
  return res?.googleWalletUrl || res?.usuario?.googleWalletUrl || res?.tarjeta?.googleWalletUrl || null;
}

export function FormRegistro({ idRandomLargo, onRegistrado, redirigir = false }) {
  const { registrarTarjeta, entrar } = useAuth();
  const navegar = useNavigate();
  const [f, setF] = useState({ nombre: '', email: '', password: '', repetir: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState(null); // respuesta del alta

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

  const reiniciar = () => {
    setCreado(null);
    setF({ nombre: '', email: '', password: '', repetir: '' });
    setError(null);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    if (f.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (f.password !== f.repetir) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      const res = await registrarTarjeta(idRandomLargo, {
        nombre: f.nombre.trim(),
        email: f.email.trim(),
        password: f.password,
      });
      if (redirigir) entrar(res); // alta con token: queda logueada, pero NO salimos todavía
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
          {creado.usuario?.id ? ` (id ${creado.usuario.id})` : ''}.
        </Aviso>

        {wallet ? (
          <>
            <a className="btn btn-wallet" href={wallet} target="_blank" rel="noopener noreferrer">
              <span className="wallet-icono">＋</span> Añadir tarjeta a Google Wallet
            </a>
            <p className="muted small">
              Se abrirá Google Wallet para que el cliente registre su tarjeta en el móvil.
            </p>
            <code className="codigo largo">{wallet}</code>
          </>
        ) : (
          <p className="muted small">
            El servidor no ha devuelto enlace de Google Wallet para esta tarjeta (campo <code>googleWalletUrl</code>).
          </p>
        )}

        <div className="form-pie">
          {redirigir ? (
            <button className="btn btn-primario" onClick={() => navegar('/tarjeta', { replace: true })}>
              Continuar a mi tarjeta →
            </button>
          ) : (
            <button className="btn" onClick={reiniciar}>
              Registrar otra tarjeta
            </button>
          )}
        </div>
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
      <Campo label="Contraseña" requerido hint="Mínimo 6 caracteres">
        <input className="input" type="password" value={f.password} onChange={(e) => set('password', e.target.value)} />
      </Campo>
      <Campo label="Repite la contraseña" requerido>
        <input
          className="input"
          type="password"
          value={f.repetir}
          onChange={(e) => set('repetir', e.target.value)}
        />
      </Campo>
      <button className="btn btn-primario" disabled={enviando || !f.nombre || !f.email || !f.password}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
