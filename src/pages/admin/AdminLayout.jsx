import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

const MENU = [
  { to: '/admin', txt: 'Resumen', fin: true },
  { to: '/admin/comercios', txt: 'Comercios' },
  { to: '/admin/tarjetas', txt: 'Tarjetas' },
  { to: '/admin/operaciones', txt: 'Operaciones' },
  { to: '/admin/alta-tarjeta', txt: 'Alta de tarjeta' },
  { to: '/admin/registro-admin', txt: 'Registro admin' },
  { to: '/admin/testeo', txt: 'Testeo' },
];

export default function AdminLayout() {
  const { sesion, salir } = useAuth();

  return (
    <div className="admin">
      <aside className="admin-lateral">
        <div className="marca">
          <span className="marca-logo">◑</span>
          <div>
            <b>Wallet Club</b>
            <small className="muted">Panel admin</small>
          </div>
        </div>

        <nav className="menu">
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.fin} className={({ isActive }) => (isActive ? 'activo' : '')}>
              {m.txt}
            </NavLink>
          ))}
        </nav>

        <div className="menu-pie">
          <Link to="/comercio" className="menu-pie-link">
            Vista comercio
          </Link>
          <Link to="/tarjeta" className="menu-pie-link">
            Vista tarjeta
          </Link>
          <div className="muted small">
            {sesion?.usuario?.nombre}
            <button className="btn btn-ghost btn-mini" onClick={salir}>
              Salir
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-contenido">
        <Outlet />
      </main>
    </div>
  );
}
