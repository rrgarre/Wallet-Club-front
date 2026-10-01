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
  // v1.10: techo de premios del comercio (0 = sin límite). Viene de §5.3
  // (`maximoPremios` a nivel superior), que SÍ puede leer el operario.
  const [maximoPremios, setMaximoPremios] = useState(0);
  // Modal de confirmación: «Confirmar» abre el resumen; el envío sólo
  // ocurre cuando se acepta ahí dentro.
  const [confirmando, setConfirmando] = useState(false);
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

        if (codigoTarjeta) {
          setLista(null);
          const t = await api(`/api/comercio/tarjetas/${encodeURIComponent(codigoTarjeta)}`);
          if (!vivo) return;
          setTarjeta(t.tarjeta);
          // v1.10: el techo viene en la propia tarjeta (§5.3), legible también
          // para el operario; el perfil queda como respaldo.
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

  const umbral = (perfil && perfil.puntosPremio) || 0;

  /* ── simulación sólo visual ────────────────────────── */
  const previo = useMemo(() => {
    if (!tarjeta) return null;
    return simularSaldo(tarjeta.puntos, tarjeta.premios, puntosDelta, premiosDelta, umbral);
  }, [tarjeta, puntosDelta, premiosDelta, umbral]);

  const hayBuffer = puntosDelta !== 0 || premiosDelta > 0;
  const puntosMostrar = previo ? previo.puntos : tarjeta ? tarjeta.puntos : 0;
  const premiosMostrar = previo ? previo.premios : tarjeta ? tarjeta.premios : 0;

  /** Premios que SE GENERARÍAN al confirmar (sólo visual; luego manda el servidor) */
  const generados = useMemo(() => {
    if (!tarjeta || puntosDelta <= 0 || umbral <= 0) return 0;
    return Math.floor((tarjeta.puntos + puntosDelta) / umbral) - Math.floor(tarjeta.puntos / umbral);
  }, [tarjeta, puntosDelta, umbral]);

  /* ── v1.10 · techo de premios (§6.7) ────────────────
     Si el resultado simulado supera `maximoPremios` (0 = sin límite), el
     servidor lo recorta EN SILENCIO en esa misma operación y devuelve 201
     con `tarjeta.premios` ya recortado (sin indicador). Aquí sólo Avisamos:
     el envío nunca se bloquea, que es lo que pide el contrato. */
  const techo = maximoPremios > 0 ? maximoPremios : 0;
  const premiosFinales = premiosMostrar;
  const excedeTecho = techo > 0 && premiosFinales > techo;
  const premiosPerdidos = excedeTecho ? premiosFinales - techo : 0;
  // ¿Este movimiento ES el que empuja por encima (pérdida de este envío)?
  // Si no, la tarjeta ya estaba por encima (p. ej. el admin bajó el techo).
  const esteMovimientoSuma = Boolean(tarjeta && premiosFinales > tarjeta.premios);
  const textoTecho = !excedeTecho
    ? null
    : esteMovimientoSuma
      ? `Al confirmar, los premios quedarán en el techo de ${techo}: se perderían ${premiosPerdidos}. ` +
        `Canjea ahora los que sobran (o pide al cliente que los canjee) para no perderlos — aun así puedes enviar: el servidor recortará.`
      : hayBuffer
        ? `Esta operación igualará los premios al techo de ${techo}: se recortarían ${premiosPerdidos} (la tarjeta está por encima: ${premiosFinales} > ${techo}).`
        : `Esta tarjeta ya está por encima del techo (${premiosFinales} > ${techo}): la próxima operación que envíes igualará los premios a ${techo} (se recortarían ${premiosPerdidos}).`;

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

  const sumarPuntos = (n) => setPuntosDelta((v) => (tarjeta && tarjeta.puntos + v + n < 0 ? v : v + n));
  const sumarPremios = (n) => setPremiosDelta((v) => (tarjeta && tarjeta.premios + v + n < 0 ? v : v + n));
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

    // v1.10: lo previsto ANTES de enviar, para detectar si el servidor
    // recortó al techo (§6.7 lo hace sin indicador en la respuesta).
    const premiosPrevistos = premiosMostrar;

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
      // v1.10: la respuesta trae `maximoPremios` (§5.4) → refrescamos el techo.
      if (res.maximoPremios !== undefined) setMaximoPremios(Number(res.maximoPremios) || 0);
      if (res.tarjeta) setTarjeta(res.tarjeta);

      // v1.10: el recorte al techo es silencioso: lo deducimos comparando lo
      // que aquí habíamos previsto con el saldo que devuelve el servidor.
      const techoRespuesta = Number(res.maximoPremios ?? maximoPremios) || 0;
      const recortados =
        techoRespuesta > 0 && res.tarjeta && res.tarjeta.premios < premiosPrevistos
          ? premiosPrevistos - res.tarjeta.premios
          : 0;

      let textoAviso;
      let tipoAviso = 'ok';
      if (res.duplicado) {
        tipoAviso = 'info';
        textoAviso = res.mensaje || 'Operación ya registrada previamente: no se aplicó de nuevo.';
      } else if (res.conversion) {
        textoAviso = `¡Premio conseguido! +${res.conversion.n} premio(s) · se descontaron ${res.conversion.puntosDescontados} puntos (umbral ${res.conversion.umbral}).`;
      } else {
        textoAviso = 'Movimiento registrado.';
      }
      if (recortados > 0) {
        tipoAviso = 'warn';
        textoAviso += ` Atención: el servidor ha recortado los premios al techo de ${techoRespuesta} (perdiste ${recortados}).`;
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
              {lista.map((t) => (
                <Link key={t.id} className="chip" to={capturaPath(t.id)}>
                  #{t.id} · {t.nombre} · {t.puntos} pts
                </Link>
              ))}
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
              {umbral > 0
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

        {/* v1.10: el techo del comercio, siempre a la vista */}
        <div className="techo-limite">
          <span className="muted small">
            {techo > 0
              ? `Techo de premios: ${techo} por tarjeta — si una operación lo supera, el servidor recorta el exceso.`
              : 'Techo de premios: sin límite (0 = nunca se recortan).'}
          </span>
        </div>
      </div>

      {/* v1.10: aviso NO bloqueante de pérdida por techo (el envío se permite) */}
      <Aviso tipo="warn">{textoTecho}</Aviso>

      {/* ── CONTROLES MINIMALISTAS ── */}
      <div className="controles">
        {/* FILA 1 · PUNTOS */}
        <div className="fila-controles">
          <span className="etiqueta">Puntos</span>
          <button className="btn-grande" onClick={() => sumarPuntos(1)} title="Sumar un punto">
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
              <span className="muted">Sin cambios pendientes: pulsa +1 para sumar puntos.</span>
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
                disabled={!(cantidadPuntos > 0)}
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
            {!puedeRestarPuntos ? (
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
              <button className="btn btn-mini" onClick={() => sumarPremios(1)}>
                +1 premio
              </button>
              {puedeRestarPremios && (
                <button className="btn btn-mini" onClick={() => sumarPremios(-1)}>
                  −1 premio
                </button>
              )}
            </div>
            {!puedeRestarPremios && (
              <p className="muted small">Con 0 premios no se puede restar: no se permiten valores negativos.</p>
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
                disabled={!(cantidadPremios > 0)}
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
            {puedeRestarPremios && !restarPremiosOK && (
              <p className="muted small">Sólo hay {premiosMostrar} premios disponibles.</p>
            )}
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
          <Aviso tipo="warn">{textoTecho}</Aviso>

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
