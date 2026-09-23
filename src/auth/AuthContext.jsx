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

  /** identificador: { nombre } o { idRandomLargo } según lo que introduzca el usuario */
  const loginComercio = async ({ password, nombre, idRandomLargo }) => {
    const body = { password };
    if (idRandomLargo) body.idRandomLargo = idRandomLargo;
    else body.nombre = nombre;
    // `entrar` guarda en localStorage Y actualiza el estado de React:
    // sin eso haría falta pulsar F5 para que se vea la sesión.
    return entrar(await api('/api/auth/comercio/login', { method: 'POST', body, token: false }));
  };

  const loginTarjeta = async ({ email, password, comercioId }) => {
    const body = { email, password };
    if (comercioId !== undefined && comercioId !== '') body.comercioId = comercioId;
    return entrar(await api('/api/auth/tarjeta/login', { method: 'POST', body, token: false }));
  };

  /**
   * Alta de tarjeta. Devuelve la respuesta cruda (con token) SIN tocar la sesión:
   * quien decide si loguear al nuevo cliente es la pantalla que llama
   * (la ruta pública usa `entrar()`, el alta desde el panel de admin no).
   */
  const registrarTarjeta = async (idRandomLargo, { nombre, email, password }) =>
    api(`/api/registro/tarjeta/${idRandomLargo}`, {
      method: 'POST',
      body: { nombre, email, password },
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
