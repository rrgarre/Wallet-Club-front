import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const DESTINO = { admin: '/admin', comercio: '/comercio', operario: '/comercio/escanear', tarjeta: '/tarjeta' };

export function Home() {
  const { sesion } = useAuth();
  return <Navigate to={sesion ? DESTINO[sesion.role] || '/' : '/login'} replace />;
}

/**
 * Zona protegida. Acepta UN rol (`rol`) o VARIOS (`roles`), p. ej.
 * `<ExigirRol roles={['comercio', 'operario']}>` para la captura (v1.8: el
 * operario sólo puede escanear y mover contadores).
 */
export function ExigirRol({ rol, roles, children }) {
  const { sesion } = useAuth();
  const loc = useLocation();
  const permitidos = roles || [rol];
  const principal = permitidos[0];

  if (!sesion) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?rol=${principal}&next=${next}`} replace />;
  }
  if (!permitidos.includes(sesion.role)) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Sesión de «{sesion.role}»</h2>
          <p className="muted">
            Esta zona es para {permitidos.length > 1 ? 'los roles' : 'el rol'}{' '}
            {permitidos.map((r, i) => (
              <span key={r}>
                {i > 0 && ' o '}
                <b>{r}</b>
              </span>
            ))}
            . Cierra sesión y vuelve a entrar con el rol correcto.
          </p>
          <Link className="btn" to={DESTINO[sesion.role] || '/'}>
            Ir a mi zona
          </Link>
        </div>
      </div>
    );
  }
  return children;
}

/** Barra superior de las zonas de cliente (comercio / tarjeta) */
export function BarraCliente({ titulo, extra }) {
  const { sesion, salir } = useAuth();
  return (
    <header className="barra">
      <div className="barra-izq">
        <span className="marca-logo">◑</span>
        <b>Wallet Club</b>
        <span className="barra-sep">/</span>
        <span>{titulo}</span>
      </div>
      <div className="barra-der">
        {extra}
        {sesion && <span className="muted">{sesion.usuario?.nombre || sesion.usuario?.email}</span>}
        <button className="btn btn-ghost btn-mini" onClick={salir}>
          Salir
        </button>
      </div>
    </header>
  );
}
