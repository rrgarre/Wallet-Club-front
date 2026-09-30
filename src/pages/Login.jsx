import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormLoginAdmin, FormLoginComercio, FormLoginTarjeta, destinoTrasLogin } from '../components/logins.jsx';

const TABS = [
  { id: 'admin', etiqueta: 'Admin' },
  { id: 'comercio', etiqueta: 'Comercio' },
  { id: 'tarjeta', etiqueta: 'Tarjeta' },
];

const DESTINO = { admin: '/admin', comercio: '/comercio', operario: '/comercio/escanear', tarjeta: '/tarjeta' };

export default function Login() {
  const loc = useLocation();
  const navegar = useNavigate();
  const { sesion } = useAuth();
  const params = new URLSearchParams(loc.search);
  const inicial = TABS.some((t) => t.id === params.get('rol')) ? params.get('rol') : 'admin';
  const [tab, setTab] = useState(inicial);

  // Si ya hay sesión, no tiene sentido el login
  if (sesion) {
    return <Navigate to={DESTINO[sesion.role] || '/'} replace />;
  }

  // Tarjeta → su página de información · Comercio → su panel · Admin → su panel
  // · Operario (v1.8) → el lector de QR. `tab` sólo es la pestaña elegida: el
  // rol de verdad lo manda el login (la contraseña de operario da `operario`).
  const ir = (rol) => navegar(destinoTrasLogin(rol || tab, params.get('next')), { replace: true });

  return (
    <div className="pagina-login">
      <div className="tarjeta-login">
        <div className="marca">
          <span className="marca-logo">◑</span>
          <div>
            <h1>Wallet Club</h1>
            <p className="muted">Acceso al sistema de puntos y premios</p>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'activa' : ''}`} onClick={() => setTab(t.id)}>
              {t.etiqueta}
            </button>
          ))}
        </div>

        {tab === 'admin' && <FormLoginAdmin onListo={ir} />}
        {tab === 'comercio' && <FormLoginComercio onListo={ir} />}
        {tab === 'tarjeta' && <FormLoginTarjeta onListo={ir} />}

        <div className="enlaces-login">
          <Link to="/comercio">Área de comercio</Link>
          <Link to="/tarjeta">Área de tarjeta</Link>
          <Link to="/tarjeta/registro">Alta de tarjeta</Link>
        </div>
      </div>
    </div>
  );
}
