import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Aviso, Campo, Cargando } from '../../components/ui.jsx';
import { copiar, fecha } from '../../lib/util.js';

/**
 * POST /api/admin/comercios/:idRandomLargo/google-wallet/clase
 *
 * Alta de la CLASE (plantilla) de fidelización en Google Wallet.
 * Una sola clase por comercio; NO crea tarjetas individuales (ese endpoint
 * no existe). Sólo rol admin.
 */

const OPCIONES_REVISION = [
  {
    valor: 'UNDER_REVIEW',
    titulo: 'UNDER_REVIEW — lista para usar (defecto)',
    desc: 'Google acepta crear tarjetas con esta clase.',
  },
  {
    valor: 'DRAFT',
    titulo: 'DRAFT — en diseño',
    desc: 'Google aún NO admite crear tarjetas con ella. Una vez salgas de DRAFT no se puede volver atrás.',
  },
];

/** Errores que son del servidor (5xx): el front sólo avisa, no es culpa del usuario */
const ERRORES_SERVIDOR = {
  GOOGLE_WALLET_PERMISOS: 'La service account no tiene el rol GCP «Wallet Object Issuer»: avisa al equipo backend.',
  GOOGLE_WALLET_AUTH: 'Google rechazó la autenticación: avisa al equipo backend.',
  GOOGLE_WALLET_SIN_CONFIG: 'Falta configuración en el .env del servidor: avisa al equipo backend.',
  GOOGLE_WALLET_INDISPONIBLE: 'Google no responde / error no previsto. Sí es reintentable.',
};

const ES_ERROR_USUARIO = ['VALIDATION', 'COMERCIO_NOT_FOUND', 'GOOGLE_CLASE_YA_EXISTE', 'GOOGLE_WALLET_400'];

const esHttps = (v) => /^https:\/\/\S+$/i.test(v.trim());

export default function GoogleWallet() {
  const [comercios, setComercios] = useState(null);
  const [errorLista, setErrorLista] = useState(null);

  // formulario
  const [idRandomLargo, setIdRandomLargo] = useState('');
  const [imgLogo, setImgLogo] = useState('');
  const [imgHero, setImgHero] = useState('');
  const [imgModulo, setImgModulo] = useState('');
  const [sinColor, setSinColor] = useState(true); // default: no enviar hexBackgroundColor
  const [hexBackgroundColor, setHexBackgroundColor] = useState('#0B57D0');
  const [terminosTexto, setTerminosTexto] = useState('');
  const [reviewStatus, setReviewStatus] = useState('UNDER_REVIEW');

  const [errorForm, setErrorForm] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // resultado: { tipo, titulo, mensaje, code, reintentable, clase, comercio }
  const [resultado, setResultado] = useState(null);
  const [crudo, setCrudo] = useState(null);

  const cargarComercios = () =>
    api('/api/admin/comercios')
      .then((d) => {
        setComercios(d.comercios);
        setErrorLista(null);
        setIdRandomLargo((v) => v || (d.comercios[0] ? String(d.comercios[0].idRandomLargo) : ''));
      })
      .catch((e) => setErrorLista(e.message));

  useEffect(() => {
    cargarComercios();
  }, []);

  const comercioSel = comercios ? comercios.find((c) => c.idRandomLargo === idRandomLargo) : null;

  /* ── validación en cliente (evita la ida y vuelta) ── */
  const validar = () => {
    if (!idRandomLargo) return 'Selecciona un comercio.';
    if (!imgLogo.trim()) return 'El campo imgLogo es obligatorio.';
    if (!esHttps(imgLogo)) return 'imgLogo debe ser una URL pública https://…';
    if (imgHero.trim() && !esHttps(imgHero)) return 'imgHero debe ser una URL pública https://…';
    if (imgModulo.trim() && !esHttps(imgModulo)) return 'imgModulo debe ser una URL pública https://…';
    const t = terminosTexto.trim();
    if (!t) return 'El campo terminosTexto es obligatorio.';
    if (t.length > 1000) return 'terminosTexto no puede superar los 1000 caracteres.';
    if (!sinColor && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexBackgroundColor))
      return 'hexBackgroundColor debe ser #rgb o #rrggbb.';
    return null;
  };

  const construirBody = () => {
    const body = {
      imgLogo: imgLogo.trim(),
      terminosTexto: terminosTexto.trim(),
      reviewStatus,
    };
    if (imgHero.trim()) body.imgHero = imgHero.trim();
    if (imgModulo.trim()) body.imgModulo = imgModulo.trim();
    // Vacío = no enviado (Google usa el color dominante de imgHero).
    // NUNCA se manda cadena vacía: eso sí daría error.
    if (!sinColor && hexBackgroundColor) body.hexBackgroundColor = hexBackgroundColor;
    return body;
  };

  const enviar = async (e) => {
    e.preventDefault();
    const v = validar();
    if (v) {
      setErrorForm(v);
      return;
    }
    setErrorForm(null);
    setEnviando(true);
    setResultado(null);
    setCrudo(null);

    const body = construirBody();
    try {
      const res = await api(`/api/admin/comercios/${idRandomLargo}/google-wallet/clase`, {
        method: 'POST',
        body,
      });
      setResultado({
        tipo: 'ok',
        titulo: 'Clase creada en Google Wallet',
        mensaje: res.clase?.id
          ? `Id de la clase: ${res.clase.id}`
          : 'El servidor no devolvió el id de la clase.',
        clase: res.clase,
        comercio: res.comercio,
      });
      setCrudo(res);
      // refresca el estado de la clase en el listado (googleWalletClaseId/Estado)
      cargarComercios();
    } catch (err) {
      setCrudo({ error: { message: err.message, code: err.code, status: err.status } });

      if (err.code === 'GOOGLE_CLASE_YA_EXISTE') {
        // 409: se informa, NO se reintenta en bucle.
        setResultado({
          tipo: 'warn',
          titulo: 'La clase de este comercio ya existe',
          mensaje: err.message,
          code: err.code,
        });
      } else if (ERRORES_SERVIDOR[err.code]) {
        setResultado({
          tipo: 'error',
          titulo: 'Problema del servidor (Google Wallet)',
          mensaje: `${err.message} — ${ERRORES_SERVIDOR[err.code]}`,
          code: err.code,
          reintentable: err.code === 'GOOGLE_WALLET_INDISPONIBLE',
        });
      } else if (ES_ERROR_USUARIO.includes(err.code)) {
        setResultado({
          tipo: 'error',
          titulo: err.code === 'COMERCIO_NOT_FOUND' ? 'Comercio no encontrado' : 'No se pudo crear la clase',
          mensaje: err.message,
          code: err.code,
        });
      } else {
        setResultado({
          tipo: 'error',
          titulo: 'Error inesperado',
          mensaje: `${err.message}${err.code ? ` (${err.code})` : ''}`,
          code: err.code,
        });
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <header className="pagina-cab">
        <div>
          <h2>Google Wallet · alta de clase</h2>
          <p className="muted">
            Crea la plantilla de fidelización de un comercio en Google Wallet. <b>Una clase por comercio</b>; no crea
            tarjetas individuales (ese endpoint no existe todavía).
          </p>
        </div>
      </header>

      <div className="rejilla rejilla-2">
        {/* ─────────── FORMULARIO ─────────── */}
        <form className="tarjeta form" onSubmit={enviar}>
          <Aviso tipo="error">{errorForm}</Aviso>

          <Campo label="Comercio" requerido>
            <select className="input" value={idRandomLargo} onChange={(e) => setIdRandomLargo(e.target.value)}>
              {!comercios && <option value="">Cargando…</option>}
              {comercios && comercios.length === 0 && <option value="">No hay comercios</option>}
              {comercios &&
                comercios.map((c) => (
                  <option key={c.id} value={c.idRandomLargo}>
                    #{c.id} — {c.nombre}
                    {c.googleWalletClaseId ? ' · clase YA creada' : ''}
                  </option>
                ))}
            </select>
          </Campo>

          {errorLista && <Aviso tipo="error">{errorLista}</Aviso>}
          {!comercios && !errorLista && <Cargando texto="Cargando comercios…" />}

          {comercioSel && (
            <div className="bloque-codigo">
              <span className="muted small">idRandomLargo (sufijo de la clase):</span>
              <code className="codigo largo">{comercioSel.idRandomLargo}</code>
              <span className="muted small">
                {comercioSel.googleWalletClaseId ? (
                  <>
                    Clase existente: <code>{comercioSel.googleWalletClaseId}</code> · estado{' '}
                    {comercioSel.googleWalletClaseEstado || 'desconocido'} — reenviar dará{' '}
                    <code>409 GOOGLE_CLASE_YA_EXISTE</code>.
                  </>
                ) : (
                  'Este comercio todavía no tiene clase creada.'
                )}
              </span>
            </div>
          )}

          <Campo
            label="imgLogo — logo del programa"
            requerido
            hint="URL pública https://… (Google la descarga)"
          >
            <input
              className="input"
              type="url"
              placeholder="https://ejemplo.com/logo.png"
              value={imgLogo}
              onChange={(e) => setImgLogo(e.target.value)}
            />
          </Campo>

          <Campo label="imgHero — banner grande (opcional)" hint="URL pública https://…">
            <input
              className="input"
              type="url"
              placeholder="https://ejemplo.com/hero.png"
              value={imgHero}
              onChange={(e) => setImgHero(e.target.value)}
            />
          </Campo>

          <Campo label="imgModulo — foto del módulo (opcional)" hint="URL pública https://…">
            <input
              className="input"
              type="url"
              placeholder="https://ejemplo.com/foto.png"
              value={imgModulo}
              onChange={(e) => setImgModulo(e.target.value)}
            />
          </Campo>

          <Campo
            label="hexBackgroundColor — color de fondo (opcional)"
            hint="Si se omite, Google usa el color dominante de imgHero (nunca da error omitirlo)"
          >
            <div className="fila-color">
              <label className="casilla">
                <input type="checkbox" checked={sinColor} onChange={(e) => setSinColor(e.target.checked)} />
                No enviar (usar color de imgHero)
              </label>
              <input
                className="input color"
                type="color"
                value={hexBackgroundColor}
                disabled={sinColor}
                onChange={(e) => setHexBackgroundColor(e.target.value)}
              />
              <code className="codigo">{sinColor ? '— no se envía —' : hexBackgroundColor}</code>
            </div>
          </Campo>

          <Campo
            label="terminosTexto — cuerpo del bloque «Términos»"
            requerido
            hint={`El título del bloque es fijo: «Términos». ${terminosTexto.length}/1000`}
          >
            <textarea
              className="input"
              rows="4"
              maxLength="1000"
              placeholder="1 punto por cada 1 € comprado…"
              value={terminosTexto}
              onChange={(e) => setTerminosTexto(e.target.value)}
            />
          </Campo>

          <Campo label="reviewStatus — estado de la clase" hint="Una vez fuera de DRAFT no se puede volver atrás">
            <select className="input" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
              {OPCIONES_REVISION.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.titulo}
                </option>
              ))}
            </select>
            <small className="campo-hint">
              {OPCIONES_REVISION.find((o) => o.valor === reviewStatus)?.desc}
            </small>
          </Campo>

          <div className="bloque-codigo">
            <span className="muted small">Se rellena solo en el servidor (no se envía):</span>
            <span className="muted small">
              issuerName = «{comercioSel?.nombre || 'nombre del comercio'}» · programName = «Fidelización{' '}
              {comercioSel?.nombre || 'nombre del comercio'}»
            </span>
          </div>

          <div className="form-pie">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setErrorForm(null);
                setResultado(null);
                setCrudo(null);
              }}
              disabled={!resultado && !errorForm}
            >
              Limpiar avisos
            </button>
            <button className="btn btn-primario" disabled={enviando || !comercios || comercios.length === 0}>
              {enviando ? 'Enviando a Google…' : 'Crear clase'}
            </button>
          </div>
        </form>

        {/* ─────────── RESULTADO ─────────── */}
        <div className="tarjeta">
          <h4>Resultado</h4>

          {!resultado && !crudo && (
            <p className="muted">
              Aún no se ha enviado nada. Al crear la clase obtendrás aquí el <b>id</b> de Google Wallet
              (&lt;ISSUER_ID&gt;.&lt;idRandomLargo&gt;).
            </p>
          )}

          {resultado && (
            <>
              <Aviso tipo={resultado.tipo} onCerrar={() => setResultado(null)}>
                <b>{resultado.titulo}.</b> {resultado.mensaje}
                {resultado.code ? ` (${resultado.code})` : ''}
              </Aviso>

              {resultado.tipo === 'ok' && resultado.clase && (
                <div className="resultado-clase">
                  <span className="muted small">Id de la clase</span>
                  <code className="codigo largo">{resultado.clase.id}</code>
                  <div className="fila-codigo">
                    <button
                      className="btn btn-mini"
                      onClick={async () => {
                        const ok = await copiar(resultado.clase.id);
                        setResultado((r) => ({ ...r, copiado: ok ? 'Id copiado.' : 'No se pudo copiar.' }));
                      }}
                    >
                      Copiar id
                    </button>
                    {resultado.copiado && <span className="muted small">{resultado.copiado}</span>}
                  </div>

                  <div className="rejilla rejilla-2">
                    <div className="mini-dato">
                      <span className="muted small">reviewStatus</span>
                      <b>{resultado.clase.reviewStatus}</b>
                    </div>
                    <div className="mini-dato">
                      <span className="muted small">issuerName</span>
                      <b>{resultado.clase.issuerName}</b>
                    </div>
                    <div className="mini-dato">
                      <span className="muted small">programName</span>
                      <b>{resultado.clase.programName}</b>
                    </div>
                    <div className="mini-dato">
                      <span className="muted small">Creada en</span>
                      <b>{fecha(resultado.comercio?.googleWalletClaseCreadaEn)}</b>
                    </div>
                  </div>
                </div>
              )}

              {resultado.tipo === 'warn' && (
                <p className="muted">
                  No insistas con «Crear clase»: el comercio ya tiene su clase. Puedes consultarla con{' '}
                  <code>GET /api/admin/comercios/&lt;id&gt;</code> → <code>googleWalletClaseId</code>.
                </p>
              )}

              {resultado.reintentable && (
                <button className="btn" onClick={enviar}>
                  Reintentar
                </button>
              )}
            </>
          )}

          {crudo && (
            <>
              <h4>Respuesta cruda</h4>
              <pre className="json">{JSON.stringify(crudo, null, 2)}</pre>
            </>
          )}
        </div>
      </div>

      <Aviso tipo="info">
        Sólo existe el alta de clase: no hay endpoint para crear tarjetas individuales, ni para modificar o borrar la
        clase, ni para leerla desde Google (el estado se ve en <code>GET /api/admin/comercios/:id</code> →{' '}
        <code>googleWalletClaseEstado</code>).
      </Aviso>
    </>
  );
}
