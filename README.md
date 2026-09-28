# Wallet Club — Front

SPA en **React + Vite** (JavaScript, CSS propio) contra la API descrita en
`API_CONTRACT.md`. Dos bloques: la **administración** (control y testeo) y las
**webs de cliente** (comercio y tarjeta).

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
```

**No hay ficheros `.env`**: al clonar no hay nada que rellenar. La única
configuración (la URL del servidor API) está a la vista en `src/config.js`.

### Configuración (`src/config.js`)

| Constante | Valor por defecto | Cuándo tocarla |
|---|---|---|
| `API_BASE` | `http://localhost:3010` | Si el API corre en otro puerto o dominio. El contrato (§1) pone `http://localhost:3000`; se cambia esa línea y nada más. Justo debajo hay **una línea comentada** con el servidor remoto (`api.walletclub.ssl-alert`) para alternar commentando/descomentando |
| `FRONT_BASE` | origen del navegador (`window.location.origin`) | Nunca: se calcula sola, así que sirve igual en dev, pruebas y producción |

Helpers exportados: `capturaUrl(id)`, `capturaPath(id)`, `registroUrl(código)`,
`registroPath(código)`.

Producción: `npm run build` → carpeta `dist/` (el enrutado es *history*).

**Rutas directas**: el servidor debe devolver `index.html` para cualquier
`/ruta` que no sea un fichero, si no, entrar a mano en
`https://tu-dominio/comercio/escanear` responde *404 página no encontrada*
(aunque dentro de la app sí se llegue navegando). Para eso el proyecto incluye
`public/.htaccess` (Apache/Hostinger), que Vite copia a `dist/` en cada build:
sube ese `.htaccess` junto al resto y **purga la caché del CDN** del hosting.
Si tu servidor no es Apache, crea su equivalente (Nginx
`try_files $uri $uri/ /index.html;`, Netlify/Cloudflare `_redirects`
`/* /index.html 200`, Vercel rewrites). Comprobación: `curl -I
https://tu-dominio/comercio/escanear` debe dar `200`.

### PWA (instalable en móviles y escritorio)

El front se puede **instalar** desde el navegador: icono propio con el logo,
abre en ventana aparte (sin barra) y **empieza en `/comercio/escanear`** (la
pantalla de batalla de los camareros). Funciona en **Android/Chrome** e
**iPhone/Safari**.

| Pieza | Fichero |
|---|---|
| Iconos (fuente) | `scripts/gen-icons.mjs` → genera `public/icons/*` y `public/favicon.ico` desde un SVG propio |
| Manifest + service worker | `vite.config.js` → `VitePWA` (plugin `vite-plugin-pwa`) |
| Registro, aviso de versión y ayuda de instalación | `src/components/pwa.jsx` |
| Metas iOS, favicon, `og:image` | `index.html` |
| No cachear `sw.js`/`manifest` en el CDN | `public/.htaccess` |

- **Regenerar iconos** (sólo si cambia la marca): `node scripts/gen-icons.mjs`.
  Los PNG se versionan, no hace falta ejecutarlo al clonar.
- **Build**: `npm run build` añade a `dist/` el `sw.js`, el
  `manifest.webmanifest` y el `workbox-*.js`; precachea **18 entradas**
  (HTML/JS/CSS/iconos ≈ 632 KiB).
- **Qué se cachea**: sólo los ficheros estáticos de la app → abre al instante y
  aguanta caídas breves del servidor. **Qué no: la API** (no hay
  `runtimeCaching`), así que los puntos van siempre a la red y, sin conexión,
  se ve el aviso de error en lugar de datos viejos.
- **Actualizaciones**: con `registerType: 'prompt'`, al detectar versión nueva
  aparece una barra *«Hay una versión nueva»* con botón **Recargar** (nunca
  recarga sola en mitad de una captura). El `.htaccess` manda
  `Cache-Control: no-cache` a `sw.js` y `manifest.webmanifest` para que esa
  comisión llegue por el CDN.
- **Instalación manual por plataforma**: botón **«Añadir a pantalla de
  inicio»** en el lector y en el acceso de comercio → abre una ayuda con los
  pasos de iPhone (Safari → Compartir), Android (Chrome → ⋮), Windows y Mac.
- **Si el PWA falla o el móvil no es compatible**: la propia ayuda explica el
  **acceso directo estándar** del navegador (crear acceso directo / arrastrar
  la pestaña / marcador), que usa **el mismo logo** (`favicon.ico` +
  `apple-touch-icon`).
- **Límites de iPhone**: iOS no ofrece instalación automática (siempre desde
  Safari) y puede purgar la caché si pasan 7 días sin abrir la app; el splash
  de arranque es neutro.
- **Comprobación**: `npm run preview` → `http://localhost:4173` (localhost
  cuenta como seguro, el SW también funciona en local) → DevTools
  *Application → Manifest / Service Workers*, o **Lighthouse → PWA**. En móvil:
  instalar, y en modo avión la app debe abrir y dar error al confirmar.

---

## 1 · Administración (`/admin`)

Login único en **`/login`** con selector de rol: *Admin · Comercio · Tarjeta*.
Según con quién entres, te manda a tu zona (y cada zona protege su rol).

| Ruta | Contenido |
|---|---|
| `/admin` | Resumen: `GET /health`, totales, accesos rápidos |
| `/admin/comercios` | Listado, alta (`POST`) y edición (`PATCH`), copia del `idRandomLargo` y del enlace/QR de alta |
| `/admin/tarjetas` | Listado global filtrable por comercio, detalle + historial (sólo lectura: el contrato no permite editar tarjetas) |
| `/admin/operaciones` | Buscador con filtros (comercio, tarjeta, tipo, desde/hasta) y paginación |
| `/admin/google-wallet` | **Alta de clase en Google Wallet** (`POST /api/admin/comercios/:idRandomLargo/google-wallet/clase`): selector de comercio, URLs https, color, términos y `reviewStatus` en desplegable; muestra el `clase.id` devuelto o el aviso del error |
| `/admin/alta-tarjeta` | Alta de cliente eligiendo comercio (usa el endpoint público con su código) |
| `/admin/registro-admin` | **Aviso**: el contrato v1.0 no tiene endpoint de alta de administradores |
| `/admin/testeo` | Consola: `GET /health` y movimiento con todos los parámetros, mostrando lo enviado y la respuesta JSON cruda. En `nombre`, **vacío = se envía el `deviceId`** del navegador; escrito = se fuerza ese valor |

---

## 2 · Webs de cliente

### Comercio
| Ruta | Contenido |
|---|---|
| `/comercio` | Login (por nombre o por `idRandomLargo`) + perfil del comercio + su lista de tarjetas + **botones de acceso rápido** a *Escanear QR* y *Capturar puntos*. `?c=<codigo>` precarga el identificador (ideal para el QR) |
| `/comercio/escanear` | **Lector de QR de tarjeta** (pide login de comercio si hace falta) |
| `/comercio/captura/:codigo` | **Captura de puntos.** `:codigo` es el id de la tarjeta; también vale `/comercio/captura?tarjeta=<id>`. Sin código, muestra el selector de tarjetas |
| `/comercio/password` | **Cambio de contraseña del comercio** (`PATCH /api/comercio/password`, §5.5): actual + nueva (mínimo 8) + repetición. Errores traducidos: `PASSWORD_ACTUAL_INCORRECTA`, `VALIDATION`, `COMERCIO_INACTIVO`. Pide login de comercio |

La API no expone el histórico de operaciones al comercio, sólo al admin.

#### Lector de QR (`/comercio/escanear`)
- **Los QR de las tarjetas ya no llevan la URL**: sólo contienen el
  **identificador** numérico de la tarjeta.
- Si no hay sesión se enseña el **login de comercio en la misma pantalla**; al
  entrar se vuelve al lector (no manda a `/comercio`).
- Botón **«Activar cámara»**: el navegador pide su permiso (`getUserMedia`).
  Funciona en **Safari/iOS ≥ 15.1** y en **Chrome/Android** (usa `BarcodeDetector`
  cuando existe y ZXing de respaldo). Fallos de permiso, cámara ocupada o
  conexión no segura (HTTPS) se traducen a mensajes claros.
- Al leer el QR se **construye la URL de captura** (`capturaPath(id)`, con la
  constante del proyecto) y se abre nuestra pantalla de captura para editar los
  puntos de esa tarjeta.
- Tolera QRs antiguos que contengan la URL completa (`lib/qr.js`).
- **Alternativa sin cámara**: campo manual «Número de tarjeta» + enlace al
  selector de tarjetas. El lector se descarga aparte (`lazy`), no engorda el
  bundle del resto de la web.

#### Reglas de la captura (lo importante)
- **Todo en grande**: contador de **puntos** y de **premios**, con el umbral
  (`puntosPremio`) del comercio.
- **Cuadro de información fijo**: la zona de estado está **desde el principio**,
  a la altura de los botones y con altura reservada, así que al sumar puntos
  **no se mueve ningún botón**. Muestra el pendiente y «🎉 +N premio(s)».
- **Fila 1 · Puntos**: `+1` (principal) y `−1` (secundario). El campo numérico
  (sumar/restar N) está **dentro de «Más opciones»**, en un desplegable que
  flota sin empujar la fila.
- **Fila 2 · Premio**: `Canjear` (sólo visible si hay premios) y «Más opciones»
  con `+1/−1 premio` y cantidad N para añadir/restar.
- **Nunca negativos**: al llegar a 0 desaparecen los botones de resta
  (`−1`, `Canjear`, `−1 premio`, `Restar`) y la resta numérica se bloquea si
  supera lo disponible — el contrato rechaza saldos negativos.
- **Los desplegables «Más opciones» se cierran al pulsar fuera** (y con Escape).
- **Consumiciones**: barra siempre visible en la tarjeta azul — cada punto
  sumado y cada premio canjeado suma 1 (`3 por puntos + 1 por canje = 4
  consumiciones`); las correcciones no cuentan.
- **Acumular y enviar una sola vez**: todo queda en un *buffer*; al pulsar
  **Confirmar** se envía únicamente `puntosDelta` (la suma) y `premiosDelta`.
- **Conversión sólo visual**: el contador resta los puntos del umbral y suma el
  premio como hará el servidor… pero **el servidor es el que lo calcula de
  verdad**; el estado definitivo se lee de `tarjeta` de la respuesta (y de
  `conversion`, si la hay).
- **Premios a mano**: `premiosDelta` sí va literal en el paquete.
- **Sin campo `nombre`**: el formulario no lo tiene (ni oculto ni vacío). El
  campo viaja **siempre** en el paquete y lo rellena el navegador con su
  `deviceId`: UUID generado con `crypto.randomUUID()` la **primera** vez que se
  usa y guardado en `localStorage` (no se regenera al hacer login ni al
  recargar). Si el servidor reclama `codigoCamarero`, se muestra ese campo y
  **se reenvía con la misma `Idempotency-Key`**.
- **Idempotencia**: UUID generado al confirmar y reutilizado mientras los
  deltas no cambien (protege los reintentos por red).
- **Sin atajos a otras tarjetas**: esta pantalla no muestra listado lateral de
  tarjetas; cada tarjeta se abre con su propia URL/QR.

### Tarjeta (cliente)
| Ruta | Contenido |
|---|---|
| `/tarjeta` | Login (email + contraseña; si el email está en varios comercios pide el comercio) + saldo en grande + **QR grande** que contiene **sólo el identificador** de la tarjeta (lo escanea el comercio) + historial propio |
| `/tarjeta/registro/:idRandomLargo` | **Alta pública.** El código va en la URL y no se puede tocar desde el formulario. **Sin contraseña** (v1.6): sólo pide nombre y email, la contraseña la fija el servidor. Sin parámetro usa `0000…0000` (48 ceros), que **no** corresponde a ningún comercio real. También acepta `?c=<codigo>` |

El registro devuelve `token`: el cliente queda logueado automáticamente. Además
**no navega enseguida**: se queda en la pantalla de éxito para enseñar el
`googleWalletUrl` devuelto (botón «Añadir tarjeta a Google Wallet», que abre en
pestaña nueva). Ya **no hay botón para ir a `/tarjeta`** ni redirección
automática: el usuario entra a su sitio cuando quiera, con la sesión ya
iniciada. Tampoco se explica la URL: sólo se muestra el código del comercio
(la ruta sigue siendo la que trae el navegador).

### Destino tras el login
`/login` y los logins individuales mandan **admin → `/admin`,
comercio → `/comercio`, tarjeta → `/tarjeta`**. Sólo se conserva un `next` si
apunta dentro de la propia zona (p. ej. llegar al login desde
`/comercio/captura/3` vuelve a esa pantalla).

---

## Decisiones / límites marcados por el contrato

- No existen DELETE, edición de tarjetas, reset de contraseñas por email,
  logout en servidor ni registro de admins: esas acciones **no están
  implementadas**. El cambio de contraseña **del comercio** sí está
  (§5.5 → `/comercio/password`); el admin restablece la de otros desde
  `/admin/comercios`.
- **Alta de tarjeta sin contraseña (v1.6)**: el formulario sólo envía
  `nombre` y `email`. La contraseña la fija el servidor
  (`USUARIO_PASSWORD`), así que el login de `/tarjeta` sigue implementado
  (contrato §3.4) pero **ya no se le pide contraseña a nadie** al darse de
  alta: cualquier `password` enviada al registro se ignora.
- Un `404 TARJETA_NOT_FOUND` significa «no existe o no es de tu comercio»: la
  interfaz no distingue ambos casos (como pide el contrato).
- **Google Wallet (contrato v1.1)**: sólo existe el alta de clase. Si se
  reenvía el formulario, el `409 GOOGLE_CLASE_YA_EXISTE` se pinta como aviso
  (con el `message` de la API) y **no** se reintenta en bucle; los `5xx`
  (`GOOGLE_WALLET_PERMISOS/AUTH/SIN_CONFIG/INDISPONIBLE`) se marcan como
  problema del servidor, y sólo `INDISPONIBLE` ofrece botón de reintento.
- El cliente ya no decide cuándo enviar `nombre`: **siempre** va con el
  `deviceId`. Si el servidor rechaza una operación grande o en negativo pidiendo
  `codigoCamarero` (`CODIGO_CAMARERO_REQUERIDO`), se muestra ese campo y el
  reenvío se hace con la misma idempotencia.

## Estructura

```
src/
  api/client.js          fetch + JWT + errores {message, code}
  auth/AuthContext.jsx   sesión en localStorage (token, role, usuario)
  lib/util.js            uuid, deviceId (id del dispositivo), simulación de saldo
  lib/qr.js              lectura del QR de tarjeta (sólo identificador)
  components/            logins, guardas de rol, tabla de operaciones, ui, pwa
  pages/admin/           SPA de administración
  pages/comercio/        web del comercio + captura + lector de QR + contraseña
  pages/tarjeta/         web del cliente + registro
scripts/
  gen-icons.mjs          iconos de la PWA + favicon (node scripts/gen-icons.mjs)
```
