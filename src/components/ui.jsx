import { useEffect, useRef } from 'react';

export function Aviso({ tipo = 'info', children, onCerrar }) {
  if (!children) return null;
  return (
    <div className={`aviso aviso-${tipo}`}>
      <span>{children}</span>
      {onCerrar && (
        <button className="aviso-x" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}

export function Campo({ label, hint, children, requerido }) {
  return (
    <label className="campo">
      <span className="campo-label">
        {label} {requerido && <b className="req">*</b>}
      </span>
      {children}
      {hint && <small className="campo-hint">{hint}</small>}
    </label>
  );
}

export function Modal({ titulo, children, onCerrar, ancho = '560px' }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar && onCerrar()}>
      <div className="modal" style={{ maxWidth: ancho }}>
        <div className="modal-cab">
          <h3>{titulo}</h3>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return <p className="muted centro">{texto}</p>;
}

/**
 * Desplegable «Más opciones».
 * El panel flota (no empuja la fila) y se cierra al pulsar fuera
 * o al pulsar Escape.
 */
export function MasOpciones({ children, etiqueta = 'Más opciones ▾' }) {
  const ref = useRef(null);

  useEffect(() => {
    const alPulsarFuera = (e) => {
      const el = ref.current;
      if (el && el.open && !el.contains(e.target)) el.open = false;
    };
    const alEscape = (e) => {
      if (e.key === 'Escape' && ref.current) ref.current.open = false;
    };
    document.addEventListener('pointerdown', alPulsarFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, []);

  return (
    <details ref={ref} className="mas-opciones">
      <summary>{etiqueta}</summary>
      <div className="mas-opciones-panel">{children}</div>
    </details>
  );
}

export function Vacio({ texto = 'Sin datos' }) {
  return <p className="muted centro">{texto}</p>;
}

export function Badge({ children, tono = 'neutro' }) {
  return <span className={`badge badge-${tono}`}>{children}</span>;
}

export function Accion({ children, ...props }) {
  return (
    <button className="btn btn-mini" {...props}>
      {children}
    </button>
  );
}
