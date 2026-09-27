import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ExigirRol } from '../../components/guardas.jsx';
import { FormLoginComercio } from '../../components/logins.jsx';
import { BotonInstalar } from '../../components/pwa.jsx';
import { Aviso, Campo } from '../../components/ui.jsx';
import { capturaPath } from '../../config.js';
import { extraerIdTarjeta } from '../../lib/qr.js';

/**
 * Lector de QR de tarjetas para el comercio.
 *
 * Los QR de las tarjetas sólo contienen el IDENTIFICADOR (p. ej. "3").
 * Esta página pide login de comercio si hace falta, accede a la cámara
 * (permisos del navegador; funciona en Safari/iOS ≥15.1 y en Android) y,
 * al leer el id, navega a nuestra pantalla de captura:
 *    /comercio/captura/<id>
 *
 * Tolera también QRs antiguos que contengan la URL completa (ver lib/qr.js).
 */

function traducirErrorCamara(e) {
  const t = `${e?.name || ''} ${e?.message || ''}`;
  if (/NotAllowed|Permission|deneg|Dismissed/i.test(t))
    return 'Has denegado el acceso a la cámara. Permítelo en los ajustes del navegador (candado en la barra de direcciones) y vuelve a intentarlo.';
  if (/NotFound|DevicesNotFound|no camera|Requested device/i.test(t))
    return 'No se ha encontrado ninguna cámara en este dispositivo.';
  if (/NotReadable|TrackStart|in use|Could not start/i.test(t))
    return 'La cámara está en uso por otra aplicación o pestaña.';
  if (/Security|insecure|HTTPS/i.test(t))
    return 'El navegador bloquea la cámara porque la conexión no es segura. Publica la web en HTTPS (o usa localhost).';
  return `No se ha podido iniciar la cámara: ${e?.message || e}`;
}

export default function Escanear() {
  const { sesion } = useAuth();

  if (!sesion) return <LoginRequerido />;
  if (sesion.role !== 'comercio') return <ExigirRol rol="comercio">{null}</ExigirRol>;
  return <Lector />;
}

/* ── Aún no logado: se pide el acceso de comercio en la misma pantalla ── */
function LoginRequerido() {
  return (
    <div className="pagina-login">
      <div className="tarjeta-login">
        <div className="marca">
          <span className="marca-logo">◑</span>
          <div>
            <h1>Escanear QR de tarjeta</h1>
            <p className="muted">Necesitas iniciar sesión como comercio para capturar puntos</p>
          </div>
        </div>
        {/* onListo vacío: tras el login nos quedamos en esta misma pantalla
            para seguir al lector de QR (si no, el formulario mandaría a /comercio) */}
        <FormLoginComercio onListo={() => {}} />
        <div className="enlaces-login">
          <Link to="/comercio">Mi comercio</Link>
          <Link to="/login">Acceso unificado</Link>
          <BotonInstalar className="btn btn-ghost btn-mini enlace-boton" />
        </div>
        <Aviso tipo="info">
          Al entrar, volverás aquí con la cámara lista para escanear el QR de la tarjeta del cliente.
        </Aviso>
      </div>
    </div>
  );
}

/* ── Lector de QR ── */
function Lector() {
  const { salir } = useAuth();
  const navegar = useNavigate();

  const [estado, setEstado] = useState('apagado'); // apagado | pidiendo | escaneando | yendo
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');

  const scannerRef = useRef(null);
  const procesandoRef = useRef(false);

  const detener = async () => {
    const s = scannerRef.current;
    scannerRef.current = null; // marca: si estaba arrancando, no se queda encendida
    if (!s) return;
    try {
      await s.stop();
    } catch {
      /* ya estaba parado */
    }
    try {
      s.clear();
    } catch {
      /* nada */
    }
  };

  // Al desmontar la página: apagar la cámara (se lee el ref en el momento
  // de la limpieza, no en el del montaje: entonces aún era null)
  useEffect(() => () => void detener(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const arrancar = async () => {
    setError(null);
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('La cámara sólo funciona en un contexto seguro: publica en HTTPS o usa localhost.');
      return;
    }
    setEstado('pidiendo'); // aquí el navegador muestra su diálogo de permisos
    let s;
    try {
      s = new Html5Qrcode('lector-qr', { verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: 'environment' }, // cámara trasera en móviles
        {
          fps: 10,
          qrbox: (w, h) => {
            // w/h son las dimensiones del vídeo: el recuadro debe caber dentro
            const lado = Math.min(Math.min(w, h), Math.max(60, Math.floor(Math.min(w, h) * 0.78)));
            return { width: lado, height: lado };
          },
        },
        (texto) => {
          if (procesandoRef.current) return;
          procesandoRef.current = true;
          alLeer(texto);
        },
        () => {
          /* frames sin QR: es lo normal, se ignoran */
        }
      );
      // Si mientras arrancaba el usuario pulsó «Detener» (o se fue de la
      // página), el ref ya no apunta a esta instancia: se apaga aquí.
      if (scannerRef.current !== s) {
        try {
          await s.stop();
        } catch {
          /* noop */
        }
        try {
          s.clear();
        } catch {
          /* noop */
        }
        return;
      }
      setEstado('escaneando');
    } catch (e) {
      if (scannerRef.current === s) scannerRef.current = null;
      try {
        if (s) s.clear();
      } catch {
        /* noop */
      }
      setEstado('apagado');
      setError(traducirErrorCamara(e));
    }
  };

  const alLeer = async (texto) => {
    const id = extraerIdTarjeta(texto);
    if (!id) {
      setError(`El QR leído no es un identificador de tarjeta válido: «${String(texto).slice(0, 80)}»`);
      procesandoRef.current = false;
      return;
    }
    setEstado('yendo');
    await detener();
    // Monta la URL de captura con la constante del proyecto y abre la pantalla
    navegar(capturaPath(id));
  };

  const abrirManual = (e) => {
    e.preventDefault();
    const id = manual.trim();
    if (!/^\d+$/.test(id)) {
      setError('Introduce el número de tarjeta (identificador numérico).');
      return;
    }
    setError(null);
    navegar(capturaPath(id));
  };

  const activo = estado === 'escaneando' || estado === 'pidiendo' || estado === 'yendo';

  return (
    <div className="zona-cliente">
      <header className="barra">
        <div className="barra-izq">
          <span className="marca-logo">◑</span>
          <b>Wallet Club</b>
          <span className="barra-sep">/</span>
          <span>Escanear QR</span>
        </div>
        <div className="barra-der">
          <BotonInstalar etiqueta="Instalar app" />
          <Link className="btn btn-ghost btn-mini" to="/comercio">
            Mi comercio
          </Link>
          <Link className="btn btn-ghost btn-mini" to="/comercio/captura">
            Capturar a mano
          </Link>
          <button className="btn btn-ghost btn-mini" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <main className="contenedor contenedor-estrecho">
        <div className="tarjeta">
          <h3>Escanea el QR de la tarjeta</h3>
          <p className="muted">
            El QR de la tarjeta sólo lleva su identificador. Al leerlo te llevamos directo a la pantalla de puntos de
            esa tarjeta.
          </p>

          <div className="lector">
            <div className={`lector-caja ${activo ? '' : 'apagada'}`}>
              <div id="lector-qr" />
              {!activo && (
                <div className="lector-superpuesto">
                  {estado === 'yendo' ? 'Abriendo tarjeta…' : 'Cámara apagada'}
                </div>
              )}
            </div>

            <div className="lector-controles">
              {!activo ? (
                <button className="btn btn-primario" onClick={arrancar} disabled={estado === 'yendo'}>
                  Activar cámara
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={async () => {
                    await detener();
                    setEstado('apagado');
                  }}
                  disabled={estado === 'yendo'}
                >
                  Detener cámara
                </button>
              )}

              <p className="muted small">
                {estado === 'pidiendo'
                  ? 'Esperando permiso de cámara del navegador…'
                  : estado === 'escaneando'
                    ? 'Apunta al QR: se lee solo y se abre la tarjeta.'
                    : 'Al pulsar «Activar cámara» el navegador te pedirá permiso. Funciona en Safari (iOS ≥ 15.1) y en Chrome/Android.'}
              </p>
            </div>
          </div>

          <Aviso tipo="error" onCerrar={() => setError(null)}>
            {error}
          </Aviso>

          <div className="divider">
            <span>o si no hay cámara</span>
          </div>

          <form className="fila-manual" onSubmit={abrirManual}>
            <Campo label="Número de tarjeta">
              <input
                className="input"
                inputMode="numeric"
                placeholder="p. ej. 3"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
            </Campo>
            <button className="btn btn-primario">Abrir tarjeta</button>
          </form>

          <div className="chips">
            <Link className="chip" to="/comercio/captura">
              Elegir tarjeta de la lista
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
