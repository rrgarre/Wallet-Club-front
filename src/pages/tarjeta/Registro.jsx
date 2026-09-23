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
 * - `onRegistrado(datos)` recibe la respuesta completa del endpoint.
 * - `redirigir` = la ruta pública loguea al nuevo cliente y le manda a su zona.
 */
export function FormRegistro({ idRandomLargo, onRegistrado, redirigir = false }) {
  const { registrarTarjeta, entrar } = useAuth();
  const navegar = useNavigate();
  const [f, setF] = useState({ nombre: '', email: '', password: '', repetir: '' });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const set = (k, v) => setF((old) => ({ ...old, [k]: v }));

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
      if (redirigir) {
        entrar(res); // el alta devuelve token: se queda logueada
        navegar('/tarjeta', { replace: true });
      } else if (onRegistrado) {
        onRegistrado(res);
      }
    } catch (err) {
      setInfo(null);
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

  return (
    <form onSubmit={enviar} className="form">
      <Aviso tipo="error">{error}</Aviso>
      <Aviso tipo="info">{info}</Aviso>
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
