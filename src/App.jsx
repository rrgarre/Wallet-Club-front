import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home, ExigirRol } from './components/guardas.jsx';

import Login from './pages/Login.jsx';

import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminResumen from './pages/admin/Resumen.jsx';
import AdminComercios from './pages/admin/Comercios.jsx';
import AdminTarjetas from './pages/admin/Tarjetas.jsx';
import AdminOperaciones from './pages/admin/Operaciones.jsx';
import AdminGoogleWallet from './pages/admin/GoogleWallet.jsx';
import AdminAltaTarjeta from './pages/admin/AltaTarjeta.jsx';
import AdminRegistroAdmin from './pages/admin/RegistroAdmin.jsx';
import AdminTesteo from './pages/admin/Testeo.jsx';

import ComercioZona from './pages/comercio/Zona.jsx';
import ComercioCaptura from './pages/comercio/Captura.jsx';
// El lector de QR lleva su motor de decodificación (zxing): se carga sólo
// cuando alguien entra en /comercio/escanear, para no engordar el bundle.
const ComercioEscanear = lazy(() => import('./pages/comercio/Escanear.jsx'));

import TarjetaZona from './pages/tarjeta/Zona.jsx';
import RegistroTarjeta from './pages/tarjeta/Registro.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* 1 — SPA de administración (control total + testeo) */}
      <Route
        path="/admin"
        element={
          <ExigirRol rol="admin">
            <AdminLayout />
          </ExigirRol>
        }
      >
        <Route index element={<AdminResumen />} />
        <Route path="comercios" element={<AdminComercios />} />
        <Route path="tarjetas" element={<AdminTarjetas />} />
        <Route path="operaciones" element={<AdminOperaciones />} />
        <Route path="google-wallet" element={<AdminGoogleWallet />} />
        <Route path="alta-tarjeta" element={<AdminAltaTarjeta />} />
        <Route path="registro-admin" element={<AdminRegistroAdmin />} />
        <Route path="testeo" element={<AdminTesteo />} />
      </Route>

      {/* 2a — Web del comercio: login + su información */}
      <Route path="/comercio" element={<ComercioZona />} />
      {/* Escaneo del QR de tarjeta: pide login de comercio si hace falta */}
      <Route
        path="/comercio/escanear"
        element={
          <Suspense fallback={<p className="muted centro">Cargando lector de QR…</p>}>
            <ComercioEscanear />
          </Suspense>
        }
      />
      {/* 2b — Captura: el código de tarjeta viene en la URL */}
      <Route
        path="/comercio/captura/:codigo?"
        element={
          <ExigirRol rol="comercio">
            <ComercioCaptura />
          </ExigirRol>
        }
      />

      {/* 2c — Zona de tarjeta (cliente): login + su información */}
      <Route path="/tarjeta" element={<TarjetaZona />} />
      {/* 2d — Registro público de tarjeta: idRandomLargo en la URL */}
      <Route path="/tarjeta/registro/:idRandomLargo?" element={<RegistroTarjeta />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
