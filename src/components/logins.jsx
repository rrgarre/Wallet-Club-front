import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Aviso, Campo } from './ui.jsx';

const DESTINO = { admin: '/admin', comercio: '/comercio', tarjeta: '/tarjeta' };

/**
 * Adónde manda el login tras autenticarse:
 *  - admin → /admin · comercio → /comercio · tarjeta → /tarjeta
 *  - sólo se respeta un `next` si cae dentro de la propia zona del rol
 *    (p. ej. llegar al login desde /comercio/captura/3).
 */
export function destinoTrasLogin(rol, next) {
  const home = DESTINO[rol];
  if (!home) return '/';
  return next && next.startsWith(`${home}/`) ? next : home;
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

/* ──────────────────────── Comercio ──────────────────────── */
export function FormLoginComercio({ onListo, prefijo }) {
  const { loginComercio } = useAuth();
  const navegar = useNavigate();
  const loc = useLocation();
  const [por, setPor] = useState(prefijo && /^[0-9a-f]{48}$/i.test(prefijo) ? 'codigo' : 'nombre');
  const [identificador, setIdentificador] = useState(prefijo || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await loginComercio({
        password,
        nombre: por === 'nombre' ? identificador : undefined,
        idRandomLargo: por === 'codigo' ? identificador : undefined,
      });
      if (onListo) onListo();
      else navegar(destinoTrasLogin('comercio', loc.state?.next), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="form">
      <Aviso tipo="error">{error}</Aviso>
      <Campo label="Identificarse por" requerido>
        <select className="input" value={por} onChange={(e) => setPor(e.target.value)}>
          <option value="nombre">Nombre del comercio</option>
          <option value="codigo">Código largo (idRandomLargo)</option>
        </select>
      </Campo>
      <Campo label={por === 'nombre' ? 'Nombre del comercio' : 'Código largo'} requerido>
        <input className="input" value={identificador} onChange={(e) => setIdentificador(e.target.value)} autoFocus />
      </Campo>
      <Campo label="Contraseña" requerido>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Campo>
      <button className="btn btn-primario" disabled={enviando || !identificador || !password}>
        {enviando ? 'Entrando…' : 'Entrar como comercio'}
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
