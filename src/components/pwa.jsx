import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Modal } from './ui.jsx';

/* ──────────────────────────────────────────────────────────────────────────
 * 1 · Registro del service worker + avisos
 *     (se monta una vez en main.jsx)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Registra el service worker y pinta los dos avisos:
 *
 *  · «Ya puedes instalarlo…»  → cuando la app ya está cacheada.
 *  · «Nueva versión»          → botón «Recargar» en lugar de recargar
 *                               sola la app en mitad de una captura.
 *
 * La API nunca se cachea (ver vite.config.js): los puntos van siempre a la red.
 */
export function RegistroPWA() {
  const {
    offlineReady: [lista, setLista],
    needRefresh: [actualizar, setActualizar],
    updateServiceWorker,
  } = useRegisterSW();

  // og:image necesita URL absoluta para que al compartir un enlace
  // (WhatsApp,…) salga la miniatura con el logo: se completa aquí.
  useEffect(() => {
    const meta = document.querySelector('meta[property="og:image"]');
    if (meta) meta.setAttribute('content', `${window.location.origin}/icons/icon-512.png`);
  }, []);

  if (lista) {
    return (
      <div className="pwa-barra" role="status">
        <span>✓ Lista para funcionar sin red de navegación: puedes instalarla en tu pantalla de inicio.</span>
        <button className="btn-icono" onClick={() => setLista(false)} aria-label="Cerrar">
          ×
        </button>
      </div>
    );
  }

  if (actualizar) {
    return (
      <div className="pwa-barra pwa-barra-actualiza" role="status">
        <span>Hay una versión nueva de Wallet Club.</span>
        <div className="pwa-barra-botones">
          <button className="btn btn-primario btn-mini" onClick={() => updateServiceWorker(true)}>
            Recargar
          </button>
          <button className="btn btn-ghost btn-mini" onClick={() => setActualizar(false)}>
            Más tarde
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2 · Ayuda: «Añadir a tu pantalla de inicio»
 *     (botón en el escáner y en el acceso de comercio)
 * ────────────────────────────────────────────────────────────────────────── */

/** Plataforma del navegador: ios | android | mac | windows | otro */
function plataforma() {
  if (typeof navigator === 'undefined') return 'otro';
  const ua = navigator.userAgent || '';
  const tabletaIpad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || tabletaIpad) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'otro';
}

const PASOS = {
  ios: {
    titulo: 'iPhone y iPad (Safari)',
    pasos: [
      'Abre esta página en <b>Safari</b> (en iPhone sólo Safari puede instalarla; si la abres desde otra app, cópiala y pégala en Safari).',
      'Toca el botón <b>Compartir</b> ⬆︎ (cuadrado con una flecha) de la barra de abajo.',
      'Elige <b>«Añadir a pantalla de inicio»</b>.',
      'Pulsa <b>«Añadir»</b> arriba a la derecha: aparecerá el icono de Wallet Club.',
    ],
  },
  android: {
    titulo: 'Móvil Android (Chrome)',
    pasos: [
      'Abre esta página en <b>Chrome</b>.',
      'Toca el menú <b>⋮</b> (tres puntos, esquina superior derecha).',
      'Toca <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla principal»</b>.',
      'Confirma con <b>«Instalar»</b>.',
    ],
  },
  windows: {
    titulo: 'Windows (Chrome o Edge)',
    pasos: [
      'Abre esta página en <b>Chrome</b> o <b>Edge</b>.',
      'Toca el menú <b>⋮</b> de la esquina superior derecha —o el icono <b>⬇</b> de la barra de direcciones—.',
      'Elige <b>«Instalar Wallet Club…»</b>.',
      'Confirma con <b>«Instalar»</b>: se queda en el escritorio con su icono.',
    ],
  },
  mac: {
    titulo: 'Mac (Chrome o Safari)',
    pasos: [
      '<b>Chrome:</b> menú <b>⋮</b> → «Instalar Wallet Club…». <b>Safari:</b> Compartir → «Añadir a pantalla de inicio…».',
      'Confirma: la app se abre en su propia ventana, sin barra de navegación.',
    ],
  },
  otro: {
    titulo: 'Desde el navegador',
    pasos: [
      'Busca en el menú del navegador la opción <b>«Instalar»</b>, <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.',
      'Si no aparece, crea un acceso directo normal (ver abajo): también usará el icono.',
    ],
  },
};

/** Fallback: acceso directo estándar, sin instalar nada (usa el mismo logo). */
const ACCESO_DIRECTO = [
  'Si tu móvil no es compatible o la instalación falla, crea un <b>acceso directo normal</b>: con el menú del navegador elige «<b>Crear acceso directo</b>» / «Añadir a pantalla principal», o <b>arrastra la pestaña</b> al escritorio o al inicio.',
  'Guardarla como <b>marcador</b> también vale: en ambos casos verás el mismo icono de Wallet Club.',
];

export function BotonInstalar({ etiqueta = 'Añadir a pantalla de inicio', className = 'btn btn-ghost btn-mini' }) {
  const [abierto, setAbierto] = useState(false);
  const info = PASOS[plataforma()] || PASOS.otro;

  return (
    <>
      <button type="button" className={className} onClick={() => setAbierto(true)}>
        {etiqueta}
      </button>

      {abierto && (
        <Modal titulo="Añadir a tu pantalla de inicio" onCerrar={() => setAbierto(false)} ancho="560px">
          <p className="muted small">
            Al instalarla, Wallet Club se abre como una app propia (sin barra del navegador), arranca al instante y
            empieza en la pantalla de escanear. Los puntos siempre necesitan conexión a internet.
          </p>

          <div className="pwa-pasos">
            <h4>{info.titulo}</h4>
            <ol>
              {info.pasos.map((p, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </ol>
          </div>

          <div className="pwa-pasos">
            <h4>Si no puedes instalarla</h4>
            <ul>
              {ACCESO_DIRECTO.map((p, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
}
