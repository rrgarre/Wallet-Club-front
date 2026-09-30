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

  /** Guarda la sesión en React Y la devuelve: el login de comercio (v1.8)
   *  necesita el `role` recién recibido para ramificar (comercio u operario). */
  const entrar = (data) => {
    const s = guardar(data);
    setSesion(s);
    return s;
  };

  const salir = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setSesion(null);
  };

  const loginAdmin = async (nombre, password) =>
    entrar(await api('/api/auth/admin/login', { method: 'POST', body: { nombre, password }, token: false }));

  /**
   * Login de comercio (§3.3, v1.8): **sólo `nombreUsuario` + `password`**.
   * Ya no se manda `idRandomLargo` ni `nombre` (sin `nombreUsuario` el
   * servidor responde `400 VALIDATION`).
   *
   * La contraseña decide el rol — primero se prueba la de operario — así que
   * la respuesta puede traer `role: "comercio"` o `role: "operario"`: devuelve
   * la sesión para que la pantalla que llama navegue según ese rol.
   */
  const loginComercio = async ({ nombreUsuario, password }) =>
    // `entrar` guarda en localStorage Y actualiza el estado de React:
    // sin eso haría falta pulsar F5 para que se vea la sesión.
    entrar(await api('/api/auth/comercio/login', { method: 'POST', body: { nombreUsuario, password }, token: false }));

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
   *
   * v1.7: `sistema` (`"google"` | `"apple"`) lo manda el formulario, ya
   * preseleccionado según el SO. Si llegara vacío el servidor usa `google`
   * y cualquier otro valor devuelve `400 VALIDATION`.
   */
  const registrarTarjeta = async (idRandomLargo, { nombre, email, sistema }) =>
    api(`/api/registro/tarjeta/${idRandomLargo}`, {
      method: 'POST',
      body: { nombre, email, sistema },
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
