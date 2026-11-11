// Factura de venta del pedido: se ve en pantalla y se imprime o guarda como PDF.
(function () {
  // Datos del establecimiento (proyecto académico: NIT y datos de contacto ficticios)
  const NEGOCIO = {
    nombre: "Café Inteligente",
    razonSocial: "Café Inteligente — Proyecto Integrador I (UDES)",
    nit: "900.000.000-0 (ficticio)",
    direccion: "Universidad de Santander, Cúcuta, Norte de Santander",
    prefijo: "PI1"
  };
  // En Colombia los restaurantes y cafeterías cobran impoconsumo del 8 %, incluido en el precio
  const IMPUESTO = { nombre: "Impoconsumo", tasa: 0.08 };

  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const dinero = (n) => fmt.format(Math.round(n || 0));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const numero = (id) => NEGOCIO.prefijo + "-" + String(id).padStart(6, "0");

  function calcular(pedido) {
    const total = pedido.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0) || pedido.total;
    const base = total / (1 + IMPUESTO.tasa);
    return { total, base, impuesto: total - base };
  }

  function html(pedido, cliente) {
    const D = window.dominio;
    const { total, base, impuesto } = calcular(pedido);
    const fecha = new Date(pedido.created_at);
    return `
      <article class="factura" aria-labelledby="factura-titulo">
        <header class="factura-cab">
          <div class="factura-marca">
            <img src="img/logo_sin_fondo.png" alt="Logo de Café Inteligente" width="56" height="58">
            <div>
              <strong>${esc(NEGOCIO.nombre)}</strong>
              <small>${esc(NEGOCIO.razonSocial)}</small>
              <small>NIT ${esc(NEGOCIO.nit)}</small>
              <small>${esc(NEGOCIO.direccion)}</small>
            </div>
          </div>
          <div class="factura-num">
            <span>Factura de venta</span>
            <strong id="factura-titulo">N.° ${numero(pedido.id)}</strong>
            <small>${fecha.toLocaleDateString("es-CO", { dateStyle: "long" })}</small>
            <small>${fecha.toLocaleTimeString("es-CO", { timeStyle: "short" })}</small>
          </div>
        </header>

        <section class="factura-datos">
          <div><span>Cliente</span><strong>${esc(cliente.nombre || "Consumidor final")}</strong>${cliente.email ? `<small>${esc(cliente.email)}</small>` : ""}</div>
          <div><span>Pedido</span><strong>#${pedido.id}</strong><small>${pedido.canal === "kiosco" ? "Kiosco de autoservicio" : "Aplicación móvil"}</small></div>
          <div><span>Forma de pago</span><strong>En caja al recoger</strong><small>Estado: ${esc(pedido.estado)}</small></div>
        </section>

        <table class="factura-tabla">
          <thead><tr><th>Cant.</th><th>Descripción</th><th class="num">V. unitario</th><th class="num">V. total</th></tr></thead>
          <tbody>
            ${pedido.items.map(i => `
              <tr>
                <td>${i.cantidad}</td>
                <td>${esc(i.nombre)}${i.opciones ? `<small>${esc(D.describirOpciones(i.opciones))}</small>` : ""}</td>
                <td class="num">${dinero(i.precio_unitario)}</td>
                <td class="num">${dinero(i.precio_unitario * i.cantidad)}</td>
              </tr>`).join("")}
          </tbody>
        </table>

        <section class="factura-totales">
          <div><span>Subtotal (base gravable)</span><span>${dinero(base)}</span></div>
          <div><span>${IMPUESTO.nombre} ${Math.round(IMPUESTO.tasa * 100)} %</span><span>${dinero(impuesto)}</span></div>
          <div class="factura-total"><span>Total a pagar</span><span>${dinero(total)}</span></div>
          <small>Precios con impuestos incluidos.</small>
        </section>

        <footer class="factura-pie">
          <p>¡Gracias por tu compra! Conserva este comprobante.</p>
          <p class="factura-aviso">Documento de prueba generado por un proyecto académico. No es una factura electrónica válida ante la DIAN.</p>
        </footer>
      </article>`;
  }

  function abrir(pedido, cliente = {}) {
    document.querySelectorAll(".capa-factura").forEach(c => c.remove());
    const capa = document.createElement("div");
    capa.className = "capa centro capa-factura";
    capa.setAttribute("role", "dialog");
    capa.setAttribute("aria-modal", "true");
    capa.setAttribute("aria-label", "Factura " + numero(pedido.id));
    capa.innerHTML = `
      <div class="factura-contenedor">
        ${html(pedido, cliente)}
        <div class="factura-acciones no-imprimir">
          <button type="button" class="btn" data-cerrar>Cerrar</button>
          <button type="button" class="btn btn-primario" data-imprimir>🖨️ Imprimir / Guardar PDF</button>
        </div>
      </div>`;
    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");
    const cerrar = () => { capa.remove(); document.body.classList.remove("sin-scroll"); };
    capa.querySelector("[data-cerrar]").addEventListener("click", cerrar);
    capa.addEventListener("click", (e) => { if (e.target === capa) cerrar(); });
    capa.querySelector("[data-imprimir]").addEventListener("click", () => {
      // El nombre sugerido del PDF sale del título de la página
      const titulo = document.title;
      document.title = "Factura " + numero(pedido.id);
      document.body.classList.add("imprimiendo-factura");
      window.print();
      setTimeout(() => { document.title = titulo; document.body.classList.remove("imprimiendo-factura"); }, 500);
    });
    capa.querySelector("[data-imprimir]").focus();
  }

  window.factura = { abrir, numero, calcular, NEGOCIO, IMPUESTO };
})();
