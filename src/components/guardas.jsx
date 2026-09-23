import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const DESTINO = { admin: '/admin', comercio: '/comercio', tarjeta: '/tarjeta' };

export function Home() {
  const { sesion } = useAuth();
  return <Navigate to={sesion ? DESTINO[sesion.role] || '/' : '/login'} replace />;
}

export function ExigirRol({ rol, children }) {
  const { sesion } = useAuth();
  const loc = useLocation();

  if (!sesion) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?rol=${rol}&next=${next}`} replace />;
  }
  if (sesion.role !== rol) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Sesión de «{sesion.role}»</h2>
          <p className="muted">
            Esta zona es para el rol <b>{rol}</b>. Cierra sesión y vuelve a entrar con el rol correcto.
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
