import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Aviso, Campo } from './ui.jsx';

const DESTINO = {
  admin: '/admin',
  comercio: '/comercio',
  operario: '/comercio/escanear',
  tarjeta: '/tarjeta',
};

/**
 * Adónde manda el login tras autenticarse (v1.8):
 *  - admin → /admin · comercio → /comercio · tarjeta → /tarjeta
 *  - **operario** → /comercio/escanear (rol nuevo: sólo escanear y capturar)
 *  - sólo se respeta un `next` si cae dentro de la zona del rol: el operario
 *    sólo puede volver al lector o a una captura concreta, nunca al selector
 *    de tarjetas ni al panel.
 */
export function destinoTrasLogin(rol, next) {
  const home = DESTINO[rol];
  if (!home) return '/';
  if (!next) return home;
  const enMiZona =
    rol === 'operario'
      ? next.startsWith('/comercio/escanear') || next.startsWith('/comercio/captura/')
      : next.startsWith(`${home}/`);
  return enMiZona ? next : home;
}

/* ───────────────────────── Admin ───────────────────────── */
export function FormLoginAdmin({ onListo }) {
  const { loginAdmin } = useAuth();
  const navegar = useNavigate();
  const loc = useLocation();
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await loginAdmin(nombre, password);
      if (onListo) onListo();
      else navegar(destinoTrasLogin('admin', loc.state?.next), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="form">
      <Aviso tipo="error">{error}</Aviso>
      <Campo label="Nombre" requerido>
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Campo>
      <Campo label="Contraseña" requerido>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Campo>
      <button className="btn btn-primario" disabled={enviando || !nombre || !password}>
        {enviando ? 'Entrando…' : 'Entrar como admin'}
      </button>
    </form>
  );
}

/* ──────────────────── Comercio / operario (v1.8) ──────────────────── */
/**
 * Acceso de comercio y de operario: **mismo formulario, sólo `nombreUsuario`
 * + `password`** (§3.3 v1.8). La contraseña decide el rol:
 *
 *   · contraseña de operario → `role: "operario"` → sólo lector de QR y
 *     captura de puntos (§2 matriz de permisos)
 *   · contraseña de comercio → `role: "comercio"` → panel completo
 *
 * `onListo(rol)` recibe el rol para que la pantalla que llama ramifique;
 * sin él se navega con `destinoTrasLogin(rol, next)`.
 */
export function FormLoginComercio({ onListo }) {
  const { loginComercio } = useAuth();
  const navegar = useNavigate();
  const loc = useLocation();
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const sesion = await loginComercio({ nombreUsuario: nombreUsuario.trim(), password });
      if (onListo) onListo(sesion?.role);
      else navegar(destinoTrasLogin(sesion?.role, loc.state?.next), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="form">
      <Aviso tipo="error">{error}</Aviso>
      <Campo label="Nombre de usuario" requerido hint="3–32 caracteres: minúsculas, números y guion bajo">
        <input
          className="input"
          value={nombreUsuario}
          onChange={(e) => setNombreUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
      </Campo>
      <Campo label="Contraseña" requerido>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Campo>
      <button className="btn btn-primario" disabled={enviando || !nombreUsuario || !password}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

/* ───────────────────────── Tarjeta ───────────────────────── */
export function FormLoginTarjeta({ onListo }) {
  const { loginTarjeta } = useAuth();
  const navegar = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [comercioId, setComercioId] = useState('');
  const [ambiguo, setAmbiguo] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await loginTarjeta({ email, password, comercioId });
      if (onListo) onListo();
      else navegar(destinoTrasLogin('tarjeta', loc.state?.next), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_AMBIGUO') {
        setAmbiguo(true);
        setError('Ese email existe en varios comercios: indica a cuál perteneces.');
      } else {
        setError(err.message);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="form">
      <Aviso tipo="error">{error}</Aviso>
      <Campo label="Email" requerido>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </Campo>
      <Campo label="Contraseña" requerido>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Campo>
      {(ambiguo || comercioId) && (
        <Campo label="Comercio (id o código largo)" hint="Sólo si el email está en varios comercios">
          <input className="input" value={comercioId} onChange={(e) => setComercioId(e.target.value)} />
        </Campo>
      )}
      <button className="btn btn-primario" disabled={enviando || !email || !password}>
        {enviando ? 'Entrando…' : 'Entrar como tarjeta'}
      </button>
    </form>
  );
}
