import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { capturaPath, FRONT_BASE } from '../../config.js';
import { Aviso, Cargando, MasOpciones, Modal } from '../../components/ui.jsx';
import { deviceId, simularSaldo, uuid } from '../../lib/util.js';

/**
 * Captura de puntos.
 *
 * La tarjeta viene identificada por la URL:  /comercio/captura/<codigoTarjeta>
 * (también acepta  /comercio/captura?tarjeta=<codigoTarjeta>)
 * Enlace/QR de esta pantalla: ver src/config.js → capturaUrl().
 *
 * Reglas:
 *  - El paquete enviado al servidor es SÓLO la suma de puntos (y los premios
 *    si se tocan a mano). La conversión puntos→premios la hace el servidor.
 *  - El contador de la pantalla sí simula esa conversión para que el camarero
 *    vea el resultado al instante; el estado definitivo llega de `tarjeta`
 *    en la respuesta.
 *  - `nombre` NO es un campo del formulario: se envía SIEMPRE y se rellena
 *    solo con el id del dispositivo/navegador (`deviceId()` de lib/util.js,
 *    UUID guardado en localStorage). Si el servidor pide `codigoCamarero`,
 *    se muestra ese campo y se reenvía con la MISMA idempotencia.
 *  - El cuadro de información está SIEMPRE visible, con altura reservada y a
 *    la altura de los botones: no aparece ni desplaza nada al sumar.
 */
export default function Captura() {
  const { codigo } = useParams();
  const [params] = useSearchParams();
  const codigoTarjeta = codigo || params.get('tarjeta') || '';
  const { sesion } = useAuth();
  // v1.8: el operario sólo llega aquí desde el QR (con el código en la URL):
  // no lee el perfil del comercio (403) ni puede listar tarjetas.
  const esOperario = sesion?.role === 'operario';

  const [perfil, setPerfil] = useState(null);
  const [tarjeta, setTarjeta] = useState(null);
  const [lista, setLista] = useState(null); // sólo para la pantalla de selección
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Operación en curso (buffer hasta pulsar confirmar)
  const [puntosDelta, setPuntosDelta] = useState(0);
  const [premiosDelta, setPremiosDelta] = useState(0);
  const [cantidadPuntos, setCantidadPuntos] = useState(5);
  const [cantidadPremios, setCantidadPremios] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const [codigoCamarero, setCodigoCamarero] = useState('');
  const [pedirCodigo, setPedirCodigo] = useState(false); // activado por el servidor

  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  // v1.10/v1.11: umbral y techo del comercio. Vienen de §5.3 (`tarjeta`)
  // y se refrescan con §5.4 (respuesta del movimiento): así los tiene TAMBIÉN
  // el operario, que no puede leer el perfil (403).
  const [puntosPremio, setPuntosPremio] = useState(0);
  const [maximoPremios, setMaximoPremios] = useState(0);
  // Modal de confirmación: «Confirmar» abre el resumen; el envío sólo
  // ocurre cuando se acepta ahí dentro.
  const [confirmando, setConfirmando] = useState(false);
  // v1.11: modal «Tope alcanzado», una sola vez por entrada en el estado.
  const [modalTope, setModalTope] = useState(false);
  const topeAvisado = useRef(false);
  const intento = useRef(null); // { idem, puntosDelta, premiosDelta }

  /* ── carga ─────────────────────────────────────────── */
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        // El perfil da el umbral de premios; el operario (v1.8) no puede
        // leerlo (403 FORBIDDEN_ROLE), así que seguimos sin umbral en vez de
        // romper la pantalla: los contadores los decide el servidor igual.
        let perfilCargado = null;
        try {
          const p = await api('/api/comercio/perfil');
          if (!vivo) return;
          perfilCargado = p.comercio;
          setPerfil(perfilCargado);
        } catch (e) {
          if (e.code !== 'FORBIDDEN_ROLE') throw e;
        }

        // v1.11: umbral y techo del comercio (§5.1) — sirven para marcar «tope»
        // en el listado (§5.2 trae puntos/premios de cada tarjeta). Al abrir una
        // tarjeta se refrescan con §5.3, que sí lo da también al operario.
        setPuntosPremio(Number(perfilCargado?.puntosPremio ?? 0) || 0);
        setMaximoPremios(Number(perfilCargado?.maximoPremios ?? 0) || 0);

        if (codigoTarjeta) {
          setLista(null);
          const t = await api(`/api/comercio/tarjetas/${encodeURIComponent(codigoTarjeta)}`);
          if (!vivo) return;
          setTarjeta(t.tarjeta);
          // v1.11: umbral y techo en la propia tarjeta (§5.3), legibles
          // también para el operario; el perfil queda como respaldo.
          setPuntosPremio(Number(t.puntosPremio ?? perfilCargado?.puntosPremio ?? 0) || 0);
          setMaximoPremios(Number(t.maximoPremios ?? perfilCargado?.maximoPremios ?? 0) || 0);
        } else {
          setTarjeta(null);
          const l = await api('/api/comercio/tarjetas');
          if (!vivo) return;
          setLista(l.tarjetas);
        }
      } catch (e) {
        if (!vivo) return;
        setTarjeta(null);
        setError(e.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [codigoTarjeta]);

  const umbral = puntosPremio; // §5.3 / §5.4 (0 mientras no venga)
  const techo = maximoPremios > 0 ? maximoPremios : 0;

  /* ── simulación sólo visual ────────────────────────── */
  const previo = useMemo(() => {
    if (!tarjeta) return null;
    return simularSaldo(tarjeta.puntos, tarjeta.premios, puntosDelta, premiosDelta, umbral, techo);
  }, [tarjeta, puntosDelta, premiosDelta, umbral, techo]);

  const hayBuffer = puntosDelta !== 0 || premiosDelta > 0;
  const puntosMostrar = previo ? previo.puntos : tarjeta ? tarjeta.puntos : 0;
  const premiosMostrar = previo ? previo.premios : tarjeta ? tarjeta.premios : 0;

  /** Premios que SE GENERARÍAN al confirmar. Lo decide la propia simulación
   * (§6.8: con los premios en el techo, la conversión no se produce). */
  const generados = previo ? previo.generados : 0;

  /* ── v1.11 · estados de tope (§6.8) ──────────────────
     «En el techo»: los premios valen ya `maximoPremios` (los incrementos de
     premio se absorben en el servidor).
     «En tope»: además los puntos están en `puntosPremio - 1` — el estado
     exacto del contrato: TODO lo que suba queda absorbido. El estado se
     mira SIEMPRE sobre el saldo guardado (la tarjeta), no sobre el buffer. */
  const enTecho = techo > 0 && Boolean(tarjeta) && tarjeta.premios >= techo;
  const enTope = enTecho && umbral > 0 && tarjeta.puntos >= umbral - 1;
  // (los puntos que faltan para el tope se muestran en el contador de Puntos)

  /* ── límites del buffer: nunca proponemos lo que el servidor va a
     ignorar (§6.7 recorte de premios / §6.8 puntos congelados) ── */
  const premiosMaximos = techo > 0 ? techo : Infinity;
  const enTechoBuffer = techo > 0 && Boolean(tarjeta) && tarjeta.premios + premiosDelta >= techo;
  const puntosMaximos = enTechoBuffer && umbral > 0 ? umbral - 1 : Infinity;
  const puedeSumarPuntos = (n) => Boolean(tarjeta) && tarjeta.puntos + puntosDelta + n <= puntosMaximos;
  const puedeSumarPremios = (n) => Boolean(tarjeta) && tarjeta.premios + premiosDelta + n <= premiosMaximos;

  /* ¿Este envío dejaría la tarjeta ya en tope? (aviso en el modal de revisión) */
  const quedaraEnTope =
    techo > 0 && umbral > 0 && Boolean(previo) && previo.premios >= techo && previo.puntos >= umbral - 1;

  /* ── avisos de techo: el envío NUNCA se bloquea aquí; sólo informamos.
     (El incremento, en cambio, sí está cortado por los límites de arriba.) */
  const avisosTecho = [
    techo > 0 &&
      tarjeta &&
      tarjeta.premios > techo &&
      `Esta tarjeta está por encima del techo (${tarjeta.premios} > ${techo}): al enviar, el servidor igualará los premios a ${techo}.`,
    !enTope &&
      quedaraEnTope &&
      `Al enviar, la tarjeta quedará EN TOPE (${techo} premios y ${umbral - 1} puntos): a partir de ahí no acepta más incrementos, sólo canjes.`,
    enTope &&
      'La tarjeta está EN TOPE: puntos y premios congelados — sólo se aplican las operaciones que restan (canjear un premio la vuelve a poner en marcha).',
  ].filter(Boolean);

  /* v1.11: modal «Tope alcanzado» — una sola vez por entrada en el estado
     (al cargar una tarjeta que ya está, o al dejarla en tope con un envío). */
  useEffect(() => {
    if (enTope && !topeAvisado.current) {
      topeAvisado.current = true;
      setModalTope(true);
    } else if (!enTope) {
      topeAvisado.current = false;
    }
  }, [enTope]);

  /* ── consumiciones de la operación en curso ──────────
     Sumar puntos y canjear premios SUMAN consumición:
       3 desayunos + 1 premio canjeado = 4 consumiciones.
     Las correcciones (restar puntos o sumar premio a mano) NO cuentan.  */
  const puntosConsumidos = Math.max(0, puntosDelta);
  const canjesConsumidos = Math.max(0, -premiosDelta);
  const consumiciones = puntosConsumidos + canjesConsumidos;
  const partesConsumicion = [
    puntosConsumidos > 0 && `${puntosConsumidos} por puntos`,
    canjesConsumidos > 0 && `${canjesConsumidos} por canje`,
  ].filter(Boolean);
  const resumenConsumicion = partesConsumicion.length
    ? `${partesConsumicion.join(' + ')} = ${consumiciones} consumición${consumiciones === 1 ? '' : 'es'}`
    : 'ninguna en esta operación';

  /* ── acciones del buffer ─────────────────────────────
     Saldo visible nunca baja de 0: no se permiten negativos,
     así que el botón que lo haría ni siquiera llega a ejecutarse. */
  const puedeRestarPuntos = puntosMostrar > 0;
  const puedeRestarPremios = premiosMostrar > 0;
  const restarPuntosOK = cantidadPuntos > 0 && puntosMostrar - cantidadPuntos >= 0;
  const restarPremiosOK = cantidadPremios > 0 && premiosMostrar - cantidadPremios >= 0;

  // Ni negativos ni por encima de lo que el servidor aplicaría (techo de
  // premios / puntos congelados en tope): el botón ni siquiera llega a sumar.
  const sumarPuntos = (n) =>
    setPuntosDelta((v) =>
      tarjeta && tarjeta.puntos + v + n >= 0 && tarjeta.puntos + v + n <= puntosMaximos ? v + n : v
    );
  const sumarPremios = (n) =>
    setPremiosDelta((v) =>
      tarjeta && tarjeta.premios + v + n >= 0 && tarjeta.premios + v + n <= premiosMaximos ? v + n : v
    );
  const limpiar = () => {
    setPuntosDelta(0);
    setPremiosDelta(0);
    setCodigoCamarero('');
    setPedirCodigo(false);
    setDescripcion('');
    intento.current = null;
    setAviso(null);
  };

  /* ── envío ─────────────────────────────────────────── */
  const enviar = async () => {
    if (!tarjeta) return;
    setConfirmando(false); // el resumen ya se aceptó: se va a enviar
    if (puntosDelta === 0 && premiosDelta === 0) {
      setAviso({ tipo: 'error', texto: 'La operación no cambia nada: suma o resta algo antes de confirmar.' });
      return;
    }

    // v1.10/v1.11: saldo previo ANTES de enviar, para deducir después lo que
    // el servidor hizo en silencio (recorte al techo / subidas absorbidas).
    const puntosPrevistos = tarjeta.puntos;
    const premiosPrevistos = tarjeta.premios;

    // `nombre` SIEMPRE va: lo rellena el navegador con el id del dispositivo.
    const body = { puntosDelta, premiosDelta, nombre: deviceId() };
    if (descripcion.trim()) body.descripcion = descripcion.trim();
    if (codigoCamarero.trim()) body.codigoCamarero = codigoCamarero.trim();

    // Idempotencia: clave nueva por acción; se reutiliza si los deltas no cambian.
    const prev = intento.current;
    const idem =
      prev && prev.puntosDelta === puntosDelta && prev.premiosDelta === premiosDelta ? prev.idem : uuid();
    intento.current = { idem, puntosDelta, premiosDelta };

    setEnviando(true);
    setAviso(null);
    try {
      const res = await api(`/api/comercio/tarjetas/${tarjeta.id}/movimiento`, {
        method: 'POST',
        body,
        idempotencia: idem,
      });

      // El servidor es autoritativo: su `tarjeta` manda.
      // v1.11: la respuesta trae `puntosPremio` y `maximoPremios` (§5.4).
      const techoRespuesta = Number(res.maximoPremios ?? maximoPremios) || 0;
      const umbralRespuesta = Number(res.puntosPremio ?? puntosPremio) || 0;
      if (res.puntosPremio !== undefined) setPuntosPremio(umbralRespuesta);
      if (res.maximoPremios !== undefined) setMaximoPremios(techoRespuesta);
      if (res.tarjeta) setTarjeta(res.tarjeta);

      // v1.10/v1.11: lo que el servidor hace "en silencio" se deduce
      // comparando el saldo previo con el que devuelve.
      const subia = puntosDelta > 0 || premiosDelta > 0;
      const absorbida = Boolean(
        subia && res.tarjeta && res.tarjeta.puntos === puntosPrevistos && res.tarjeta.premios === premiosPrevistos
      );
      const igualado = Boolean(
        techoRespuesta > 0 &&
          res.tarjeta &&
          res.tarjeta.premios === techoRespuesta &&
          premiosPrevistos > techoRespuesta
      );
      const enTopeRespuesta = Boolean(
        techoRespuesta > 0 &&
          umbralRespuesta > 0 &&
          res.tarjeta &&
          res.tarjeta.premios >= techoRespuesta &&
          res.tarjeta.puntos >= umbralRespuesta - 1
      );

      let textoAviso;
      let tipoAviso = 'ok';
      if (res.duplicado) {
        tipoAviso = 'info';
        textoAviso = res.mensaje || 'Operación ya registrada previamente: no se aplicó de nuevo.';
      } else if (absorbida) {
        tipoAviso = 'warn';
        textoAviso = 'Operación sin efecto: la tarjeta está en tope y el servidor absorbe las subidas.';
      } else if (res.conversion) {
        textoAviso = `¡Premio conseguido! +${res.conversion.n} premio(s) · se descontaron ${res.conversion.puntosDescontados} puntos (umbral ${res.conversion.umbral}).`;
      } else {
        textoAviso = 'Movimiento registrado.';
      }
      if (igualado) {
        tipoAviso = 'warn';
        textoAviso += ` Atención: el servidor ha igualado los premios al techo de ${techoRespuesta} (había ${premiosPrevistos}).`;
      }
      if (enTopeRespuesta && !absorbida) {
        textoAviso += ` La tarjeta ha quedado EN TOPE: ${techoRespuesta} premios y ${umbralRespuesta - 1} puntos congelados.`;
      }
      setAviso({ tipo: tipoAviso, texto: textoAviso });

      setPuntosDelta(0);
      setPremiosDelta(0);
      setCodigoCamarero('');
      setDescripcion('');
      setPedirCodigo(false);
      intento.current = null;
    } catch (e) {
      if (e.code === 'CODIGO_CAMARERO_REQUERIDO') {
        setPedirCodigo(true);
        setAviso({ tipo: 'error', texto: `${e.message} — rellena el código y vuelve a confirmar (misma operación).` });
      } else {
        setAviso({ tipo: 'error', texto: `${e.message}${e.code ? ` (${e.code})` : ''}` });
      }
    } finally {
      setEnviando(false);
    }
  };

  /* ── pantalla sin código en la URL: selector ───────── */
  if (!codigoTarjeta) {
    // El operario (v1.8) no puede listar tarjetas: su camino es escanear el
    // QR o escribir el número, así que este selector no es para él.
    if (esOperario) return <Navigate to="/comercio/escanear" replace />;
    return (
      <Cuerpo>
        <div className="tarjeta">
          <h3>Elige la tarjeta</h3>
          <p className="muted">
            La URL de captura lleva el código de la tarjeta: <code>{FRONT_BASE}{capturaPath('&lt;id de la tarjeta&gt;')}</code>
          </p>
          <div className="chips">
            <Link className="chip chip-escanear" to="/comercio/escanear">
              📷 Escanear QR de la tarjeta
            </Link>
          </div>
          {!lista && <Cargando />}
          {lista && lista.length === 0 && <p className="muted">No tienes tarjetas todavía.</p>}
          {lista && lista.length > 0 && (
            <div className="chips">
              {lista.map((t) => {
                // v1.11: el tope se calcula aquí mismo (perfil §5.1 + saldos §5.2)
                const enTope =
                  techo > 0 && umbral > 0 && t.premios >= techo && t.puntos >= umbral - 1;
                return (
                  <Link
                    key={t.id}
                    className={`chip${enTope ? ' chip-tope' : ''}`}
                    to={capturaPath(t.id)}
                  >
                    #{t.id} · {t.nombre} · {t.puntos} pts{enTope ? ' · 🔒 tope' : ''}
                  </Link>
                );
              })}
            </div>
          )}
          <Link className="btn btn-ghost" to="/comercio">
            ← Volver
          </Link>
        </div>
      </Cuerpo>
    );
  }

  if (cargando) {
    return (
      <Cuerpo>
        <Cargando texto="Cargando tarjeta…" />
      </Cuerpo>
    );
  }

  if (error || !tarjeta) {
    return (
      <Cuerpo>
        <div className="tarjeta">
          <Aviso tipo="error">{error || 'No se pudo cargar la tarjeta.'}</Aviso>
          <p className="muted">
            Comprueba el código de la URL: <code>{codigoTarjeta}</code>. Si no pertenece a tu comercio, la API
            responde <code>404 TARJETA_NOT_FOUND</code> (igual que si no existe).
          </p>
          <Link className="btn" to={esOperario ? '/comercio/escanear' : '/comercio/captura'}>
            {esOperario ? 'Volver al lector QR' : 'Volver al selector de tarjetas'}
          </Link>
        </div>
      </Cuerpo>
    );
  }

  return (
    <Cuerpo>
      <Aviso tipo={aviso?.tipo} onCerrar={() => setAviso(null)}>
        {aviso?.texto}
      </Aviso>

      {/* ── TARJETA + CONTADORES EN GRANDE ── */}
      <div className="captura-tarjeta">
        <div className="captura-id">
          <span className="muted small">Tarjeta #{tarjeta.id}</span>
          <h2>{tarjeta.nombre}</h2>
          <span className="muted">{tarjeta.email}</span>
        </div>

        <div className="contadores">
          <div className="contador">
            <span className="contador-etiqueta">Puntos</span>
            <b className={`contador-valor ${hayBuffer && puntosDelta !== 0 ? 'editando' : ''}`}>{puntosMostrar}</b>
            <span className="contador-sub">
              {enTope
                ? `TOPE: congelado en ${umbral - 1} puntos`
                : enTecho && umbral > 0
                  ? `faltan ${Math.max(0, umbral - 1 - puntosMostrar)} puntos para el tope (máx. ${umbral - 1})`
                  : umbral > 0
                    ? hayBuffer
                      ? `de ${umbral} para el premio (simulado)`
                      : `faltan ${Math.max(0, umbral - puntosMostrar)} para el premio`
                    : 'sin umbral de premio'}
            </span>
          </div>

          <div className="contador">
            <span className="contador-etiqueta">Premios</span>
            <b className={`contador-valor premio ${hayBuffer && premiosDelta !== 0 ? 'editando' : ''}`}>
              {premiosMostrar}
            </b>
            <span className="contador-sub">{perfil?.premioDescripcion || 'premio'}</span>
          </div>
        </div>

        {/* Consumiciones: SIEMPRE visible y con la misma altura (no mueve nada) */}
        <div className="consumiciones">
          <div className="consumiciones-cifra">
            <span className="contador-etiqueta">Consumiciones</span>
            <b className={`consumiciones-valor ${consumiciones > 0 ? 'editando' : ''}`}>{consumiciones}</b>
          </div>
          <div className="consumiciones-detalles">
            <b className="consumiciones-formula">{resumenConsumicion}</b>
            <span className="consumiciones-nota">
              {consumiciones > 0
                ? 'Cada punto sumado y cada premio canjeado es una consumición: se envía todo junto en un solo movimiento.'
                : 'Suma puntos o canjea un premio: cada uno cuenta como una consumición.'}
            </span>
          </div>
        </div>

        {/* v1.10/v1.11: el techo del comercio, siempre a la vista */}
        <div className="techo-limite">
          <span className="muted small">
            {techo > 0
              ? enTope
                ? `Techo de premios: ${techo} — TOPE ALCANZADO (${tarjeta.premios} premios · ${tarjeta.puntos} puntos): sólo se aceptan canjes hasta que se descongele.`
                : `Techo de premios: ${techo} por tarjeta — con los premios en el techo, los puntos no superan ${umbral > 0 ? umbral - 1 : 'umbral − 1'}.`
              : 'Techo de premios: sin límite (0 = nunca se recortan).'}
          </span>
        </div>
      </div>

      {/* v1.10/v1.11: avisos NO bloqueantes de techo (el envío se permite) */}
      {avisosTecho.map((t, i) => (
        <Aviso key={i} tipo="warn">
          {t}
        </Aviso>
      ))}

      {/* ── CONTROLES MINIMALISTAS ── */}
      <div className="controles">
        {/* FILA 1 · PUNTOS */}
        <div className="fila-controles">
          <span className="etiqueta">Puntos</span>
          <button
            className="btn-grande"
            onClick={() => sumarPuntos(1)}
            disabled={!puedeSumarPuntos(1)}
            title={puedeSumarPuntos(1) ? 'Sumar un punto' : 'Tope de puntos: ya no caben más'}
          >
            +1
          </button>
          {puedeRestarPuntos && (
            <button className="btn btn-ghost" onClick={() => sumarPuntos(-1)} title="Quitar un punto">
              −1
            </button>
          )}

          {/* Cuadro de información FIJO: ya está desde el principio y no mueve los botones */}
          <div className="info-fija">
            {!hayBuffer ? (
              <span className="muted">
                {!puedeSumarPuntos(1)
                  ? `Tope de puntos: ya no caben más (congelado en ${umbral - 1}). Canjea un premio para descongelar.`
                  : 'Sin cambios pendientes: pulsa +1 para sumar puntos.'}
              </span>
            ) : (
              <span className="info-fija-contenido">
                <b>Pendiente:</b>
                {puntosDelta !== 0 && (
                  <code>
                    puntos {puntosDelta > 0 ? '+' : ''}
                    {puntosDelta}
                  </code>
                )}
                {premiosDelta !== 0 && (
                  <code>
                    premios {premiosDelta > 0 ? '+' : ''}
                    {premiosDelta}
                  </code>
                )}
                {generados > 0 && <b className="premio-info">🎉 +{generados} premio(s)</b>}
                <em>· lo revisas antes de enviar</em>
              </span>
            )}
          </div>

          <MasOpciones>
            <span className="campo-label">Añadir o restar varios puntos</span>
            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={cantidadPuntos}
              onChange={(e) => setCantidadPuntos(parseInt(e.target.value || '0', 10))}
            />
            <div className="mas-opciones-acciones">
              <button
                className="btn btn-primario btn-mini"
                disabled={!(cantidadPuntos > 0) || !puedeSumarPuntos(cantidadPuntos)}
                onClick={() => sumarPuntos(cantidadPuntos)}
              >
                Sumar
              </button>
              {puedeRestarPuntos && (
                <button
                  className="btn btn-mini"
                  disabled={!restarPuntosOK}
                  onClick={() => sumarPuntos(-cantidadPuntos)}
                >
                  Restar
                </button>
              )}
            </div>
            {!puedeSumarPuntos(cantidadPuntos) ? (
              <p className="muted small">
                Tope de puntos: con los premios en el techo sólo caben {puntosMaximos} puntos
                {hayBuffer ? ` (ahora mismo irías a ${tarjeta.puntos + puntosDelta})` : ''}.
              </p>
            ) : !puedeRestarPuntos ? (
              <p className="muted small">Con 0 puntos no se puede restar: no se permiten valores negativos.</p>
            ) : !restarPuntosOK ? (
              <p className="muted small">Sólo hay {puntosMostrar} puntos disponibles.</p>
            ) : (
              <p className="muted small">Se acumula en el envío: sólo se manda la suma total.</p>
            )}
          </MasOpciones>
        </div>

        {/* FILA 2 · PREMIO */}
        <div className="fila-controles">
          <span className="etiqueta">Premio</span>
          {premiosMostrar > 0 && (
            <button className="btn-grande" onClick={() => sumarPremios(-1)} title="Canjear un premio">
              Canjear
            </button>
          )}

          <MasOpciones>
            <span className="campo-label">Premio a mano</span>
            <div className="mas-opciones-acciones">
              <button
                className="btn btn-mini"
                disabled={!puedeSumarPremios(1)}
                onClick={() => sumarPremios(1)}
                title={puedeSumarPremios(1) ? 'Añadir un premio' : 'Techo de premios alcanzado'}
              >
                +1 premio
              </button>
              {puedeRestarPremios && (
                <button className="btn btn-mini" onClick={() => sumarPremios(-1)}>
                  −1 premio
                </button>
              )}
            </div>
            {!puedeSumarPremios(1) ? (
              <p className="muted small">
                {techo > 0
                  ? `Techo de premios alcanzado (${tarjeta.premios} de ${techo}): no se admiten más premios — el servidor los ignoraría.`
                  : 'No se admiten más premios.'}
              </p>
            ) : (
              !puedeRestarPremios && (
                <p className="muted small">Con 0 premios no se puede restar: no se permiten valores negativos.</p>
              )
            )}

            <span className="campo-label">Varios premios</span>
            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={cantidadPremios}
              onChange={(e) => setCantidadPremios(parseInt(e.target.value || '0', 10))}
            />
            <div className="mas-opciones-acciones">
              <button
                className="btn btn-primario btn-mini"
                disabled={!(cantidadPremios > 0) || !puedeSumarPremios(cantidadPremios)}
                onClick={() => sumarPremios(cantidadPremios)}
              >
                Añadir
              </button>
              {puedeRestarPremios && (
                <button
                  className="btn btn-mini"
                  disabled={!restarPremiosOK}
                  onClick={() => sumarPremios(-cantidadPremios)}
                >
                  Restar
                </button>
              )}
            </div>
            {!puedeSumarPremios(cantidadPremios) ? (
              <p className="muted small">Sólo caben {Math.max(0, premiosMaximos - (tarjeta.premios + premiosDelta))} premios más hasta el techo de {techo}.</p>
            ) : puedeRestarPremios && !restarPremiosOK ? (
              <p className="muted small">Sólo hay {premiosMostrar} premios disponibles.</p>
            ) : null}
            <p className="muted small">Los premios modificados a mano SÍ se envían al servidor.</p>
          </MasOpciones>

          <span className="muted small">
            {premiosMostrar > 0 ? 'Canjear resta un premio de forma estándar.' : 'Sin premios para canjear.'}
          </span>
        </div>

        <Campo2 label="Descripción (opcional)">
          <input
            className="input"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="p. ej. 2 desayunos"
          />
        </Campo2>

        {/* Sin campo de nombre: el navegador rellena `nombre` con su propio id */}
        <p className="muted small">
          Operación registrada con el identificador de este navegador: <code className="codigo">{deviceId()}</code>
        </p>

        {pedirCodigo && (
          <Campo2 label="Código de camarero" requerido>
            <input
              className="input"
              value={codigoCamarero}
              onChange={(e) => setCodigoCamarero(e.target.value.toUpperCase())}
            />
          </Campo2>
        )}

        <div className="pie-controles">
          <button
            className="btn btn-primario btn-confirmar"
            onClick={() => setConfirmando(true)}
            disabled={enviando || (puntosDelta === 0 && premiosDelta === 0)}
          >
            {enviando ? 'Enviando…' : 'Confirmar'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={limpiar}
            disabled={!hayBuffer && !codigoCamarero && !descripcion && !aviso}
          >
            Limpiar
          </button>
          <Link className="btn btn-ghost" to={esOperario ? '/comercio/escanear' : '/comercio'}>
            Volver
          </Link>
        </div>
      </div>

      {/* ── v1.10 · CONFIRMACIÓN INTERMEDIA ──────────────
         «Confirmar» ya no envía: abre este resumen. «Seguir editando»
         cierra sin tocar el buffer (deltas, descripción y código intactos);
         «Sí, enviar» es el que realmente dispara el movimiento. */}
      {confirmando && (
        <Modal titulo="Revisar antes de enviar" onCerrar={() => setConfirmando(false)}>
          <div className="resumen-op">
            <div className="resumen-fila">
              <span className="muted">Tarjeta</span>
              <b>
                #{tarjeta.id} · {tarjeta.nombre}
              </b>
            </div>
            <div className="resumen-fila">
              <span className="muted">Puntos</span>
              <b className="num">
                {puntosDelta === 0
                  ? `${tarjeta.puntos} (sin cambios)`
                  : `${tarjeta.puntos} → ${puntosMostrar} (${puntosDelta > 0 ? '+' : ''}${puntosDelta})`}
              </b>
            </div>
            <div className="resumen-fila">
              <span className="muted">Premios</span>
              <b className="num">
                {premiosDelta === 0
                  ? `${tarjeta.premios} (sin cambios)`
                  : `${tarjeta.premios} → ${premiosMostrar} (${premiosDelta > 0 ? '+' : ''}${premiosDelta})`}
              </b>
            </div>
            {generados > 0 && (
              <div className="resumen-fila resumen-canje">
                <span className="muted">Canjes por acumulación</span>
                <b>
                  🎉 +{generados} premio{generados === 1 ? '' : 's'} al sumar {puntosDelta} punto
                  {puntosDelta === 1 ? '' : 's'}
                </b>
              </div>
            )}
            {canjesConsumidos > 0 && (
              <div className="resumen-fila resumen-canje">
                <span className="muted">Canjes a mano</span>
                <b>
                  🎟️ −{canjesConsumidos} premio{canjesConsumidos === 1 ? '' : 's'} (se canjea
                  {canjesConsumidos === 1 ? '' : 'n'} ahora)
                </b>
              </div>
            )}
            <div className="resumen-fila">
              <span className="muted">Consumiciones</span>
              <b>{resumenConsumicion}</b>
            </div>
            {descripcion.trim() && (
              <div className="resumen-fila">
                <span className="muted">Descripción</span>
                <b>{descripcion.trim()}</b>
              </div>
            )}
            {codigoCamarero.trim() && (
              <div className="resumen-fila">
                <span className="muted">Código de camarero</span>
                <b className="num">{codigoCamarero.trim()}</b>
              </div>
            )}
          </div>

          {/* El aviso de techo se repite aquí: es el último momento para canjear */}
          {avisosTecho.map((t, i) => (
            <Aviso key={i} tipo="warn">
              {t}
            </Aviso>
          ))}

          <div className="form-pie">
            <button className="btn btn-ghost" onClick={() => setConfirmando(false)} disabled={enviando}>
              Seguir editando
            </button>
            <button className="btn btn-primario" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Sí, enviar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── v1.11 · MODAL «TOPE ALCANZADO» ──────────────
         Sólo cuando la tarjeta ENTRA en tope (al cargar ya en él, o porque un
         movimiento la deja ahí): una sola vez por entrada hasta que se salga. */}
      {modalTope && tarjeta && (
        <Modal titulo="Tope de premios alcanzado" onCerrar={() => setModalTope(false)}>
          <div className="tope-contenido">
            <p>
              <b>La tarjeta ha llegado a su tope de puntos:</b> ya no puede acumular más.
            </p>
            <div className="resumen-op">
              <div className="resumen-fila">
                <span className="muted">Premios</span>
                <b className="num">
                  {tarjeta.premios} de {techo} (en el techo)
                </b>
              </div>
              <div className="resumen-fila">
                <span className="muted">Puntos</span>
                <b className="num">
                  {tarjeta.puntos} = {umbral} − 1 (congelado)
                </b>
              </div>
            </div>
            <p className="muted small">
              Los botones de sumar quedan desactivados: el servidor absorbería esas subidas sin
              mover los saldos. Para volver a ponerla en marcha basta con <b>canjear un premio</b> (o
              restar premios): al bajar del techo la tarjeta se descongela y los puntos vuelven a
              convertirse en premios.
            </p>
          </div>
          <div className="form-pie">
            <button className="btn btn-primario" onClick={() => setModalTope(false)}>
              Entendido
            </button>
          </div>
        </Modal>
      )}
    </Cuerpo>
  );
}

function Campo2({ label, children, requerido }) {
  return (
    <label className="campo">
      <span className="campo-label">
        {label} {requerido && <b className="req">*</b>}
      </span>
      {children}
    </label>
  );
}

function Cuerpo({ children }) {
  // «Mi comercio» se oculta al operario (v1.8): su panel no es accesible
  // (el servidor responde 403 FORBIDDEN_ROLE en todo el panel).
  const { sesion } = useAuth();
  const esOperario = sesion?.role === 'operario';

  return (
    <div className="zona-cliente">
      <header className="barra">
        <div className="barra-izq">
          <span className="marca-logo">◑</span>
          <b>Wallet Club</b>
          <span className="barra-sep">/</span>
          <span>Captura de puntos</span>
        </div>
        <div className="barra-der">
          <Link className="btn btn-mini" to="/comercio/escanear">
            📷 Escanear QR
          </Link>
          {!esOperario && (
            <Link className="btn btn-ghost btn-mini" to="/comercio">
              Mi comercio
            </Link>
          )}
        </div>
      </header>

      <main className="contenedor captura-sin-lateral">
        <div className="captura-principal">{children}</div>
      </main>
    </div>
  );
}
