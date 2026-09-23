import { Aviso } from '../../components/ui.jsx';

export default function RegistroAdmin() {
  return (
    <>
      <header className="pagina-cab">
        <h2>Registro de admin</h2>
        <p className="muted">Alta de nuevas cuentas de administrador</p>
      </header>

      <div className="tarjeta">
        <Aviso tipo="info">
          El contrato actual <b>no contempla</b> un endpoint de creación de administradores: los únicos endpoints
          públicos de registro son <code>POST /api/registro/tarjeta/:idRandomLargo</code> (tarjetas) y, para admin,
          <code>POST /api/admin/comercios</code> (comercios).
        </Aviso>

        <p className="muted">
          Cuando se añada el endpoint al contrato, basta con indicarlo aquí y conectar el formulario. El admin actual
          se crea por configuración del servidor.
        </p>

        <div className="rejilla rejilla-2">
          <div className="mini-tarjeta ok">
            <b>Comercios</b>
            <span>Disponible: el admin sí puede crear comercios.</span>
            <a className="btn btn-mini" href="/admin/comercios">
              Ir a comercios
            </a>
          </div>
          <div className="mini-tarjeta ok">
            <b>Tarjetas</b>
            <span>Disponible: alta pública de clientes con el código del comercio.</span>
            <a className="btn btn-mini" href="/admin/alta-tarjeta">
              Ir a alta de tarjeta
            </a>
          </div>
          <div className="mini-tarjeta no">
            <b>Admins</b>
            <span>No existe endpoint en el contrato (v1.0).</span>
          </div>
        </div>
      </div>
    </>
  );
}
