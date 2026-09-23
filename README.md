# Wallet Club — Front

SPA en **React + Vite** (JavaScript, CSS propio) contra la API descrita en
`API_CONTRACT.md`. Dos bloques: la **administración** (control y testeo) y las
**webs de cliente** (comercio y tarjeta).

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
```

### Configuración de URLs (`src/config.js`)

Todo se construye de forma dinámica desde `.env`, sin tocar código:

| Variable | Uso | Ejemplos |
|---|---|---|
| `VITE_FRONT_URL` | Base del front: enlaces y **QR** de captura/registro | `http://localhost:5173` (dev) · `https://test.…` · `https://…` |
| `VITE_API_URL` | Base del API (contrato §1) | `http://localhost:3000` |

Si `VITE_FRONT_URL` está vacío se usa el **origen del navegador**, así que en
cualquier entorno la URL sale correcta aunque no configures nada. Helpers:
`capturaUrl(id)`, `capturaPath(id)`, `registroUrl(codigo)`, `registroPath(codigo)`.

Producción: `npm run build` → carpeta `dist/` (el enrutado es *history*, el
servidor debe servir `index.html` para cualquier `/ruta`).

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
| `/admin/alta-tarjeta` | Alta de cliente eligiendo comercio (usa el endpoint público con su código) |
| `/admin/registro-admin` | **Aviso**: el contrato v1.0 no tiene endpoint de alta de administradores |
| `/admin/testeo` | Consola: `GET /health` y movimiento con todos los parámetros, mostrando la respuesta JSON cruda |

---

## 2 · Webs de cliente

### Comercio
| Ruta | Contenido |
|---|---|
| `/comercio` | Login (por nombre o por `idRandomLargo`) + perfil del comercio + su lista de tarjetas. `?c=<codigo>` precarga el identificador (ideal para el QR) |
| `/comercio/captura/:codigo` | **Captura de puntos.** `:codigo` es el id de la tarjeta; también vale `/comercio/captura?tarjeta=<id>`. Sin código, muestra el selector de tarjetas |

La API no expone el histórico de operaciones al comercio, sólo al admin.

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
- **Campo `nombre`**: oculto y vacío por defecto. Aparece —y es obligatorio—
  si el premio se modifica a mano, si los puntos van en negativo, o si la suma
  de puntos añadidos es **≥ 5**. Si el servidor además reclama
  `nombre`/`codigoCamarero`, se muestran los campos y **se reenvía con la misma
  `Idempotency-Key`**.
- **Idempotencia**: UUID generado al confirmar y reutilizado mientras los
  deltas no cambien (protege los reintentos por red).
- **Sin atajos a otras tarjetas**: esta pantalla no muestra listado lateral de
  tarjetas; cada tarjeta se abre con su propia URL/QR.

### Tarjeta (cliente)
| Ruta | Contenido |
|---|---|
| `/tarjeta` | Login (email + contraseña; si el email está en varios comercios pide el comercio) + saldo en grande + **QR grande de captura** (`FRONT_BASE/comercio/captura/<id>`, copiable) + historial propio |
| `/tarjeta/registro/:idRandomLargo` | **Alta pública.** El código va en la URL y no se puede tocar desde el formulario. Sin parámetro usa `0000…0000` (48 ceros), que **no** corresponde a ningún comercio real. También acepta `?c=<codigo>` |

El registro devuelve `token`: el cliente queda logueado automáticamente.

### Destino tras el login
`/login` y los logins individuales mandan **admin → `/admin`,
comercio → `/comercio`, tarjeta → `/tarjeta`**. Sólo se conserva un `next` si
apunta dentro de la propia zona (p. ej. llegar al login desde
`/comercio/captura/3` vuelve a esa pantalla).

---

## Decisiones / límites marcados por el contrato

- No existen DELETE, edición de tarjetas, reset de contraseñas, logout en
  servidor ni registro de admins: esas acciones **no están implementadas**.
- Un `404 TARJETA_NOT_FOUND` significa «no existe o no es de tu comercio»: la
  interfaz no distingue ambos casos (como pide el contrato).
- El umbral de `nombre` del cliente (≥ 5 puntos) puede ser menor que el del
  servidor (`UMBRAL_PUNTOS_NOMBRE`, 100 por defecto): por eso el reenvío con la
  misma idempotencia está contemplado.

## Estructura

```
src/
  api/client.js          fetch + JWT + errores {message, code}
  auth/AuthContext.jsx   sesión en localStorage (token, role, usuario)
  lib/util.js            uuid, simulación de saldo, regla de `nombre`
  components/            logins, guardas de rol, tabla de operaciones, ui
  pages/admin/           SPA de administración
  pages/comercio/        web del comercio + captura
  pages/tarjeta/         web del cliente + registro
```
