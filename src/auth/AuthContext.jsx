import { createContext, useContext, useState } from 'react';
import { api, SESSION_KEY, TOKEN_KEY } from '../api/client.js';

const AuthCtx = createContext(null);

function leerSesion() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Guarda la respuesta de cualquier login: { token, role, usuario } */
function guardar(data) {
  const sesion = { token: data.token, role: data.role, usuario: data.usuario };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
  localStorage.setItem(TOKEN_KEY, data.token);
  return sesion;
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);

  const entrar = (data) => setSesion(guardar(data));

  const salir = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setSesion(null);
  };

  const loginAdmin = async (nombre, password) =>
    entrar(await api('/api/auth/admin/login', { method: 'POST', body: { nombre, password }, token: false }));

  /**
   * Login de comercio: **SÓLO por código largo** (`idRandomLargo`) — en el
   * front ya no existe la opción de entrar con `nombre` (se quitó el
   * desplegable del formulario).
   */
  const loginComercio = async ({ password, idRandomLargo }) => {
    // `entrar` guarda en localStorage Y actualiza el estado de React:
    // sin eso haría falta pulsar F5 para que se vea la sesión.
    return entrar(
      await api('/api/auth/comercio/login', { method: 'POST', body: { password, idRandomLargo }, token: false })
    );
  };

  const loginTarjeta = async ({ email, password, comercioId }) => {
    const body = { email, password };
    if (comercioId !== undefined && comercioId !== '') body.comercioId = comercioId;
    return entrar(await api('/api/auth/tarjeta/login', { method: 'POST', body, token: false }));
  };

  /**
   * Alta de tarjeta. Devuelve la respuesta cruda SIN tocar la sesión.
   *
   * §3.5 (v1.6): el `201` viene **sin `token` ni `role`** → el alta nunca
   * inicia sesión en el navegador (sólo `usuario`, `comercio` y
   * `googleWalletUrl`). Quien quiera entrar en `/tarjeta` lo hace con el
   * login (§3.4), que sí devuelve token.
   *
   * v1.6 también: NO se envía `password` — la pone el servidor
   * (`USUARIO_PASSWORD`) y el login de tarjeta autentica con ella; si el
   * body la trae, se ignora.
   */
  const registrarTarjeta = async (idRandomLargo, { nombre, email }) =>
    api(`/api/registro/tarjeta/${idRandomLargo}`, {
      method: 'POST',
      body: { nombre, email },
      token: false,
    });

  return (
    <AuthCtx.Provider value={{ sesion, entrar, salir, loginAdmin, loginComercio, loginTarjeta, registrarTarjeta }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
