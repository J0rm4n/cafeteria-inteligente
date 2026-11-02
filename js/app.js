// Interfaz de usuario: enrutador por hash (#/menu, #/carrito, ...) y vistas.
(function () {
  const D = window.dominio;
  const R = window.recomendador;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const app = $("#app");
  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const dinero = (n) => fmt.format(n || 0);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  const ESTADOS = [["pendiente", "Pendiente"], ["preparando", "Preparando"], ["listo", "Listo"], ["entregado", "Entregado"]];
  const ETIQUETAS_EXTRA = [["energia", "Energía"], ["relajante", "Relajante"], ["reconfortante", "Reconfortante"]];

  const S = {
    sesion: null,
    productos: [],
    misPedidos: [],
    globales: { popularidad: {}, coocurrencias: [] },
    carrito: [],
    mood: null,
    categoria: "Todas",
    busqueda: "",
    adminTab: "pedidos",
    filtroAdmin: "activos",
    periodoAdmin: "7",
    temporizador: null,
    kiosco: new URLSearchParams(location.search).get("modo") === "kiosco",
    // Tiempo real
    avisosNuevos: new Set(),   // pedidos que la cafetería aún no ha visto
    conexion: "conectando",
    estadosMios: {},           // último estado conocido de los pedidos del cliente
    recargarAdmin: null,
    desuscribir: []
  };
  const perfil = () => S.sesion.perfil;
  const esAdmin = () => S.sesion && perfil().rol === "admin";
  const producto = (id) => S.productos.find(p => p.id === id);
  const moodDef = (id) => D.MOODS.find(m => m.id === id);

  /* ================= utilidades ================= */
  function toast(msg, tipo = "ok") {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast " + tipo;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2800);
  }
  const guardarCarrito = () => { try { localStorage.setItem("cafe_carrito_v2", JSON.stringify(S.carrito)); } catch (e) { /* ignorar */ } };
  const cargarCarrito = () => { try { S.carrito = JSON.parse(localStorage.getItem("cafe_carrito_v2")) || []; } catch (e) { S.carrito = []; } };
  const cantidadCarrito = () => S.carrito.reduce((s, i) => s + i.cantidad, 0);

  async function cargarDatos() {
    const [productos, misPedidos, globales] = await Promise.all([
      api.productos(),
      api.misPedidos(S.sesion.user.id),
      api.estadisticasGlobales().catch(() => ({ popularidad: {}, coocurrencias: [] }))
    ]);
    S.productos = productos;
    S.misPedidos = misPedidos;
    S.globales = globales;
    S.carrito = S.carrito.filter(l => producto(l.producto_id));
    guardarCarrito();
    S.estadosMios = Object.fromEntries(misPedidos.map(p => [p.id, p.estado]));
  }

  /* ================= tiempo real: notificaciones de pedidos ================= */
  const datosCliente = () => ({ nombre: perfil().nombre, email: S.sesion.user.email });
  const resumenItems = (p) => p.items.map(i => (i.cantidad > 1 ? i.cantidad + "× " : "") + i.nombre).join(", ");

  function detenerTiempoReal() {
    S.desuscribir.forEach(f => { try { f(); } catch (e) { /* ignorar */ } });
    S.desuscribir = [];
  }

  function iniciarTiempoReal() {
    detenerTiempoReal();
    if (!S.sesion) return;
    if (esAdmin()) {
      S.desuscribir.push(api.suscribirPedidos(alNuevoPedido, (estado) => {
        S.conexion = estado;
        const indicador = $("#en-vivo");
        if (indicador) { indicador.className = "en-vivo " + estado; indicador.textContent = estado === "en-vivo" ? "● En vivo" : "○ Conectando…"; }
      }));
    }
    S.desuscribir.push(api.suscribirMisPedidos(S.sesion.user.id, alCambioMiPedido));
  }

  // La cafetería recibe un pedido nuevo
  function alNuevoPedido(p) {
    if (!p) return;
    S.avisosNuevos.add(p.id);
    actualizarContadorAvisos();
    avisos.sonar();
    const titulo = `🔔 Nuevo pedido #${p.id}`;
    const cuerpo = `${p.cliente || "Cliente"} · ${dinero(p.total)} · ${resumenItems(p)}`;
    avisos.notificar(titulo, cuerpo, "pedido-" + p.id);
    avisos.mostrar({ titulo, cuerpo, tipo: "nuevo",
      accion: rutaActual() === "admin/pedidos" ? null : { texto: "Ver pedidos", fn: () => { location.hash = "#/admin/pedidos"; } } });
    if (S.recargarAdmin) S.recargarAdmin();
  }

  // El cliente recibe el cambio de estado de su pedido
  function alCambioMiPedido({ id, estado }) {
    const antes = S.estadosMios[id];
    S.estadosMios[id] = estado;
    if (!antes || antes === estado) return;
    const textos = {
      preparando: ["👩‍🍳 Estamos preparando tu pedido #" + id, "Te avisaremos cuando esté listo."],
      listo: ["☕ ¡Tu pedido #" + id + " está listo!", "Acércate a la barra para recogerlo."],
      entregado: ["✅ Pedido #" + id + " entregado", "¡Que lo disfrutes! Tu factura está en Mis pedidos."]
    };
    const [titulo, cuerpo] = textos[estado] || ["Pedido #" + id, "Nuevo estado: " + estado];
    if (estado === "listo") { avisos.sonar(); avisos.notificar(titulo, cuerpo, "mi-pedido-" + id); }
    avisos.mostrar({ titulo, cuerpo, tipo: estado === "listo" ? "listo" : "info" });
    if (rutaActual() === "pedidos") vistaPedidos();
  }

  function actualizarContadorAvisos() {
    const n = S.avisosNuevos.size;
    document.title = (n ? `(${n}) ` : "") + "Café Inteligente · Optimizando la decisión";
    pintarNavegacion();
  }

  function agregarLinea(producto_id, opciones, recomendado, cantidad = 1) {
    const clave = D.claveLinea(producto_id, opciones);
    const linea = S.carrito.find(l => l.clave === clave);
    if (linea) { linea.cantidad += cantidad; linea.recomendado = linea.recomendado || recomendado; }
    else S.carrito.push({ clave, producto_id, cantidad, opciones: opciones || null, recomendado: Boolean(recomendado) });
    guardarCarrito();
    pintarNavegacion();
    actualizarFlotante();
  }

  function actualizarFlotante() {
    const ruta = rutaActual();
    if (ruta === "carrito") { vistaCarrito(); return; }
    if (ruta !== "menu") return;
    const f = $(".flotante", app);
    const n = cantidadCarrito();
    const texto = `🛒 Ver carrito · ${n} · ${dinero(totalCarrito())}`;
    if (f) f.textContent = texto;
    else if (n) app.insertAdjacentHTML("beforeend", `<a href="#/carrito" class="flotante">${texto}</a>`);
  }
  const totalCarrito = () => S.carrito.reduce((s, l) => {
    const p = producto(l.producto_id);
    return s + (p ? D.precioUnitario(p, l.opciones) * l.cantidad : 0);
  }, 0);

  /* ================= hoja de personalización ================= */
  function abrirHoja(p, recomendado) {
    const restr = perfil().restricciones || [];
    const { opciones, aprendidas } = R.opcionesSugeridas(p, perfil(), S.misPedidos);
    const leches = D.lechesPermitidas(restr);
    const ocultas = D.OPCIONES.leche.filter(l => !leches.includes(l));
    const op = { ...opciones };
    const capa = document.createElement("div");
    capa.className = "capa";
    capa.innerHTML = `
      <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">
        <button class="hoja-cerrar" aria-label="Cerrar">✕</button>
        <div class="hoja-cab">
          <span class="hoja-emoji" aria-hidden="true">${esc(p.emoji)}</span>
          <div><h2 id="hoja-titulo">${esc(p.nombre)}</h2><p class="desc">${esc(p.descripcion || "")}</p></div>
        </div>
        ${aprendidas ? `<p class="nota-ia">✨ Preseleccionado según tus pedidos anteriores</p>` : ""}
        <fieldset class="grupo-op"><legend>Tamaño</legend>
          <div class="segmentos">${D.OPCIONES.tamano.map(t => `
            <label class="seg"><input type="radio" name="tamano" value="${t.id}" ${op.tamano === t.id ? "checked" : ""}>
              <span><strong>${t.label}</strong><small>${t.detalle}${t.extra ? " · +" + dinero(t.extra) : ""}</small></span></label>`).join("")}
          </div>
        </fieldset>
        <fieldset class="grupo-op"><legend>Tipo de leche</legend>
          <div class="segmentos">${leches.map(l => `
            <label class="seg"><input type="radio" name="leche" value="${l.id}" ${op.leche === l.id ? "checked" : ""}>
              <span><strong>${l.label}</strong><small>${l.extra ? "+" + dinero(l.extra) : "Incluida"}</small></span></label>`).join("")}
          </div>
          ${ocultas.length ? `<p class="ayuda">🛡️ Ocultamos ${ocultas.map(l => l.largo).join(" y ")} por tus restricciones.</p>` : ""}
        </fieldset>
        ${D.permiteExtra(p, restr) ? `
        <label class="interruptor"><input type="checkbox" name="extra" ${op.extra ? "checked" : ""}>
          <span>${D.OPCIONES.extra.label} <small>+${dinero(D.OPCIONES.extra.extra)}</small></span></label>` : ""}
        <button class="btn btn-primario btn-bloque" id="hoja-ok"></button>
      </div>`;
    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");
    const btn = $("#hoja-ok", capa);
    const leer = () => {
      op.tamano = $("input[name=tamano]:checked", capa).value;
      op.leche = $("input[name=leche]:checked", capa).value;
      const ex = $("input[name=extra]", capa);
      op.extra = ex ? ex.checked : false;
      btn.textContent = "Agregar · " + dinero(D.precioUnitario(p, op));
    };
    const cerrar = () => { capa.remove(); document.body.classList.remove("sin-scroll"); };
    leer();
    capa.addEventListener("change", leer);
    capa.addEventListener("click", (e) => { if (e.target === capa || e.target.closest(".hoja-cerrar")) cerrar(); });
    btn.addEventListener("click", () => {
      agregarLinea(p.id, { ...op }, recomendado);
      toast(p.nombre + " agregado · " + D.describirOpciones(op));
      cerrar();
    });
    btn.focus();
  }

  function alAgregar(id, recomendado) {
    const p = producto(id);
    if (!p || p.stock <= 0) return;
    if (p.personalizable) { abrirHoja(p, recomendado); return; }
    agregarLinea(id, null, recomendado);
    toast(p.nombre + " agregado al carrito");
  }

  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-agregar]");
    if (b) alAgregar(Number(b.dataset.agregar), b.dataset.rec === "1");
  });

  /* ================= navegación ================= */
  const rutaActual = () => location.hash.replace("#/", "") || "menu";

  function pintarNavegacion() {
    const logueado = Boolean(S.sesion) && rutaActual() !== "bienvenida";
    $("#topbar").hidden = !logueado;
    $("#nav-movil").hidden = !logueado;
    if (!logueado) return;
    const ruta = rutaActual();
    // La cuenta de la cafetería solo ve su Dashboard
    if (esAdmin() && !S.kiosco) {
      const html = [["admin/pedidos", "🧾", "Pedidos", S.avisosNuevos.size], ["admin/indicadores", "📈", "Estadísticas"], ["admin/menu", "📦", "Menú e inventario"]]
        .map(([r, ico, txt, badge]) => `<a href="#/${r}" class="${ruta === r ? "activo" : ""}" ${ruta === r ? 'aria-current="page"' : ""}>
          <span class="ico" aria-hidden="true">${ico}</span><span>${txt}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</a>`).join("");
      $("#nav-escritorio").innerHTML = html;
      $("#nav-movil").innerHTML = html;
      $("#marca-sub").textContent = "Panel de la cafetería";
      return;
    }
    let enlaces = [
      ["menu", "🏠", "Menú"],
      ["carrito", "🛒", "Carrito", cantidadCarrito()],
      ["pedidos", "🧾", "Pedidos"],
      ["perfil", "👤", "Perfil"]
    ];
    if (S.kiosco) enlaces = enlaces.slice(0, 2);
    const html = enlaces.map(([r, ico, txt, badge]) =>
      `<a href="#/${r}" class="${ruta === r ? "activo" : ""}" ${ruta === r ? 'aria-current="page"' : ""}>
        <span class="ico" aria-hidden="true">${ico}</span><span>${txt}</span>
        ${badge ? `<span class="badge">${badge}</span>` : ""}
      </a>`).join("");
    $("#nav-escritorio").innerHTML = html;
    $("#nav-movil").innerHTML = html;
    $("#marca-sub").textContent = S.kiosco ? "Kiosco de autoservicio" : "Optimizando la decisión";
  }

  async function enrutar() {
    clearInterval(S.temporizador);
    S.recargarAdmin = null;
    app.onclick = null;
    $$(".capa").forEach(c => c.remove());
    document.body.classList.remove("sin-scroll");
    let ruta = rutaActual();
    if (S.sesion && api.recuperando && ruta !== "nueva-clave") { location.hash = "#/nueva-clave"; return; }
    if (!S.sesion && ruta !== "login") { location.hash = "#/login"; return; }
    if (S.sesion && ruta === "login") { location.hash = "#/menu"; return; }
    if (S.sesion && !perfil().perfil_completo && !esAdmin() && !["bienvenida", "nueva-clave"].includes(ruta)) { location.hash = "#/bienvenida"; return; }
    if (ruta.startsWith("admin") && !esAdmin()) { location.hash = "#/menu"; return; }
    // Cuenta de la cafetería: siempre en el Dashboard (#/admin/pedidos, #/admin/indicadores, #/admin/menu)
    if (esAdmin() && !S.kiosco && ruta !== "nueva-clave") {
      const tab = ruta.split("/")[1];
      if (!ruta.startsWith("admin/") || !["pedidos", "indicadores", "menu"].includes(tab)) { location.hash = "#/admin/" + S.adminTab; return; }
      S.adminTab = tab;
      ruta = "admin";
    }
    if (S.kiosco && ["pedidos", "perfil", "admin"].includes(ruta)) { location.hash = "#/menu"; return; }
    pintarNavegacion();
    window.scrollTo(0, 0);
    const vistas = { login: vistaLogin, bienvenida: vistaBienvenida, menu: vistaMenu, carrito: vistaCarrito,
                     pedidos: vistaPedidos, perfil: vistaPerfil, admin: vistaAdmin, "nueva-clave": vistaNuevaClave };
    try {
      await (vistas[ruta] || vistaMenu)();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<section class="vacio"><p>Ocurrió un error: ${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></section>`;
    }
  }

  /* ================= vista: login ================= */
  function vistaLogin() {
    app.innerHTML = `
      <section class="login">
        <div class="login-hero">
          <p class="sobretitulo">${S.kiosco ? "Kiosco de autoservicio" : "Proyecto Integrador I · Ingeniería de Sistemas"}</p>
          <h1>Optimizando<br>la decisión</h1>
          <p class="lead">Sistema inteligente de pedidos y recomendación personalizada para cafeterías, basado en tu perfil y tus preferencias.</p>
          <ol class="pasos">
            <li><span>1</span><div><strong>Preferencia clara</strong><small>Tus gustos, intolerancias y cómo te sientes.</small></div></li>
            <li><span>2</span><div><strong>Recomendación personalizada</strong><small>Opciones pre-filtradas para ti.</small></div></li>
            <li><span>3</span><div><strong>Confirmación rápida</strong><small>Pide sin filas y sin indecisión.</small></div></li>
          </ol>
        </div>
        <div class="tarjeta login-caja">
          <div class="tabs" role="tablist">
            <button role="tab" class="tab activo" data-tab="ingresar" aria-selected="true">Iniciar sesión</button>
            <button role="tab" class="tab" data-tab="registro" aria-selected="false">Crear cuenta</button>
          </div>
          <form id="form-auth" novalidate>
            <div class="campo" id="campo-nombre" hidden>
              <label for="f-nombre">Nombre</label>
              <input id="f-nombre" name="nombre" autocomplete="name" maxlength="60" placeholder="Tu nombre" aria-describedby="e-nombre">
              <small class="campo-error" id="e-nombre" hidden></small>
            </div>
            <div class="campo">
              <label for="f-email">Correo electrónico</label>
              <input id="f-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required placeholder="tucorreo@ejemplo.com" aria-describedby="e-email">
              <small class="campo-error" id="e-email" hidden></small>
            </div>
            <div class="campo">
              <label for="f-clave">Contraseña</label>
              <div class="con-boton">
                <input id="f-clave" name="password" type="password" autocomplete="current-password" maxlength="64" required placeholder="Tu contraseña" aria-describedby="e-clave reglas-clave">
                <button type="button" class="ver-clave" data-ver="f-clave" aria-label="Mostrar contraseña" aria-pressed="false">👁</button>
              </div>
              <small class="campo-error" id="e-clave" hidden></small>
              <button type="button" class="btn-texto" id="btn-olvide">¿Olvidaste tu contraseña?</button>
            </div>
            <div id="ayuda-clave" hidden>
              <div class="medidor" aria-hidden="true"><span id="medidor-barra"></span></div>
              <p class="medidor-texto" id="medidor-texto" aria-live="polite"></p>
              <ul class="reglas" id="reglas-clave"></ul>
            </div>
            <div class="campo" id="campo-confirmar" hidden>
              <label for="f-confirmar">Confirmar contraseña</label>
              <div class="con-boton">
                <input id="f-confirmar" name="confirmar" type="password" autocomplete="new-password" maxlength="64" placeholder="Repite la contraseña" aria-describedby="e-confirmar">
                <button type="button" class="ver-clave" data-ver="f-confirmar" aria-label="Mostrar contraseña" aria-pressed="false">👁</button>
              </div>
              <small class="campo-error" id="e-confirmar" hidden></small>
            </div>
            <p class="error" id="error-auth" role="alert" hidden></p>
            <button class="btn btn-primario btn-bloque" type="submit" id="btn-auth">Ingresar</button>
          </form>
          ${api.modo === "demo" ? `
          <div class="cuentas-demo">
            <p>Cuentas de prueba:</p>
            <button class="chip" data-demo="cliente@demo.com|Cliente#2026">Cliente con historial</button>
            ${S.kiosco ? "" : `<button class="chip" data-demo="admin@demo.com|Barista#2026">Cafetería (admin)</button>`}
          </div>` : ""}
          <p class="enlace-modo">${S.kiosco
            ? `<a href="${location.pathname}">Salir del modo kiosco</a>`
            : `<a href="${location.pathname}?modo=kiosco">Abrir en modo kiosco 🖥️</a>`}</p>
        </div>
      </section>
      <footer class="creditos">
        Autores: Jorman Enrique Martínez Ramírez · María Camila Ramos Díaz — Docente evaluador: Miguel Fabián Robles Angarita — Universidad de Santander (UDES)
      </footer>`;

    let modo = "ingresar";
    const form = $("#form-auth");
    const btn = $("#btn-auth");
    const errGeneral = $("#error-auth");
    const tocados = new Set();
    const NIVELES_FUERZA = ["", "Muy débil", "Débil", "Segura", "Muy segura"];

    const marcar = (nombre, mensaje) => {
      const input = form[nombre];
      const salida = $("#e-" + { nombre: "nombre", email: "email", password: "clave", confirmar: "confirmar" }[nombre]);
      input.setAttribute("aria-invalid", mensaje ? "true" : "false");
      input.classList.toggle("invalido", Boolean(mensaje));
      salida.textContent = mensaje || "";
      salida.hidden = !mensaje;
      return !mensaje;
    };
    const datosPersonales = () => ({ email: form.email.value.trim(), nombre: form.nombre.value.trim() });

    // Reglas de cada campo. En "ingresar" solo se exige formato de correo y contraseña no vacía:
    // la política de contraseña segura se aplica al crearla (registro), como recomienda OWASP.
    const validar = {
      nombre: () => modo !== "registro" || marcar("nombre", D.validarNombre(form.nombre.value)),
      email: () => marcar("email", D.validarEmail(form.email.value)),
      password: () => marcar("password", modo === "registro"
        ? D.validarClave(form.password.value, datosPersonales())
        : (form.password.value ? null : "Escribe tu contraseña.")),
      confirmar: () => modo !== "registro" || marcar("confirmar",
        !form.confirmar.value ? "Confirma tu contraseña." :
        form.confirmar.value !== form.password.value ? "Las contraseñas no coinciden." : null)
    };

    const pintarReglas = () => {
      if (modo !== "registro") return;
      const clave = form.password.value;
      const reglas = D.reglasClave(clave, datosPersonales());
      const fuerza = D.fuerzaClave(clave, datosPersonales());
      $("#reglas-clave").innerHTML = reglas.map(r =>
        `<li class="${r.ok ? "ok" : ""}"><span aria-hidden="true">${r.ok ? "✓" : "○"}</span> ${r.texto}<span class="sr-only">${r.ok ? " (cumplido)" : " (pendiente)"}</span></li>`).join("");
      const barra = $("#medidor-barra");
      barra.style.width = (fuerza / 4 * 100) + "%";
      barra.dataset.nivel = fuerza;
      $("#medidor-texto").textContent = clave ? "Seguridad: " + NIVELES_FUERZA[fuerza] : "";
    };

    // Bloqueo temporal tras 5 intentos fallidos (protección básica contra fuerza bruta)
    const BLOQUEO_KEY = "cafe_intentos";
    const leerBloqueo = () => { try { return JSON.parse(localStorage.getItem(BLOQUEO_KEY)) || { fallos: 0, hasta: 0 }; } catch (e) { return { fallos: 0, hasta: 0 }; } };
    const guardarBloqueo = (b) => { try { localStorage.setItem(BLOQUEO_KEY, JSON.stringify(b)); } catch (e) { /* ignorar */ } };
    let cuentaAtras = null;
    const textoBoton = () => modo === "registro" ? "Crear cuenta" : "Ingresar";
    const revisarBloqueo = () => {
      clearInterval(cuentaAtras);
      const actualizar = () => {
        const resta = Math.ceil((leerBloqueo().hasta - Date.now()) / 1000);
        if (resta > 0 && modo === "ingresar") {
          btn.disabled = true;
          btn.textContent = `Demasiados intentos. Espera ${resta} s`;
          return true;
        }
        clearInterval(cuentaAtras);
        btn.disabled = false;
        btn.textContent = textoBoton();
        return false;
      };
      if (actualizar()) cuentaAtras = setInterval(actualizar, 1000);
    };

    const cambiarModo = (nuevo) => {
      modo = nuevo;
      $$(".tab", app).forEach(x => { const activo = x.dataset.tab === modo; x.classList.toggle("activo", activo); x.setAttribute("aria-selected", activo); });
      const registro = modo === "registro";
      $("#campo-nombre").hidden = !registro;
      $("#campo-confirmar").hidden = !registro;
      $("#ayuda-clave").hidden = !registro;
      $("#btn-olvide").hidden = registro;
      form.password.autocomplete = registro ? "new-password" : "current-password";
      form.password.placeholder = registro ? "Crea una contraseña segura" : "Tu contraseña";
      tocados.clear();
      ["nombre", "email", "password", "confirmar"].forEach(n => marcar(n, null));
      errGeneral.hidden = true;
      pintarReglas();
      revisarBloqueo();
    };
    $$(".tab", app).forEach(b => b.addEventListener("click", () => cambiarModo(b.dataset.tab)));

    // Validación en vivo: al salir de un campo y, después, mientras se corrige
    ["nombre", "email", "password", "confirmar"].forEach(n => {
      form[n].addEventListener("blur", () => { if (form[n].value) { tocados.add(n); validar[n](); } });
      form[n].addEventListener("input", () => {
        if (n === "password" || n === "nombre" || n === "email") pintarReglas();
        if (tocados.has(n)) validar[n]();
        if (n === "password" && tocados.has("confirmar")) validar.confirmar();
      });
    });

    $("#btn-olvide").addEventListener("click", () => dialogoRecuperar(form.email.value.trim()));

    $$(".ver-clave", app).forEach(b => b.addEventListener("click", () => {
      const input = $("#" + b.dataset.ver);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      b.setAttribute("aria-pressed", visible);
      b.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
      b.textContent = visible ? "🙈" : "👁";
    }));

    $$("[data-demo]", app).forEach(b => b.addEventListener("click", () => {
      const [e, p] = b.dataset.demo.split("|");
      if (modo !== "ingresar") cambiarModo("ingresar");
      form.email.value = e; form.password.value = p;
      form.requestSubmit();
    }));

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errGeneral.hidden = true;
      if (btn.disabled) return;
      ["nombre", "email", "password", "confirmar"].forEach(n => tocados.add(n));
      const resultados = ["nombre", "email", "password", "confirmar"].map(n => validar[n]());
      if (resultados.includes(false)) {
        const primero = $$("[aria-invalid=true]", form)[0];
        if (primero) primero.focus();
        return;
      }
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      const nombre = form.nombre.value.trim().replace(/\s+/g, " ");
      btn.disabled = true; btn.textContent = "Un momento…";
      try {
        S.sesion = modo === "registro" ? await api.registrar(email, password, nombre) : await api.ingresar(email, password);
        guardarBloqueo({ fallos: 0, hasta: 0 });
        await cargarDatos();
        iniciarTiempoReal();
        location.hash = "#/menu";
        toast("¡Hola, " + perfil().nombre.split(" ")[0] + "!");
      } catch (e) {
        // Con confirmación por correo activa, el registro "falla" con un aviso de éxito
        if (modo === "registro" && /^Cuenta creada/.test(e.message)) {
          cambiarModo("ingresar");
          form.email.value = email;
          errGeneral.textContent = e.message;
          errGeneral.classList.add("exito");
          errGeneral.hidden = false;
          return;
        }
        errGeneral.classList.remove("exito");
        errGeneral.textContent = e.message;
        errGeneral.hidden = false;
        if (modo === "ingresar") {
          const b = leerBloqueo();
          b.fallos += 1;
          if (b.fallos >= 5) { b.hasta = Date.now() + 30000; b.fallos = 0; }
          guardarBloqueo(b);
        }
        btn.disabled = false; btn.textContent = textoBoton();
        revisarBloqueo();
      }
    });
    revisarBloqueo();
  }

  /* ================= recuperación de contraseña ================= */
  function dialogoRecuperar(emailInicial) {
    const capa = document.createElement("div");
    capa.className = "capa centro";
    capa.innerHTML = `
      <form class="confirmacion recuperar" role="dialog" aria-modal="true" aria-labelledby="rec-titulo" novalidate>
        <h2 id="rec-titulo">Recuperar contraseña</h2>
        <p>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
        <div class="campo">
          <label for="rec-email">Correo electrónico</label>
          <input id="rec-email" type="email" autocomplete="email" maxlength="254" value="${esc(emailInicial)}" aria-describedby="rec-error">
          <small class="campo-error" id="rec-error" hidden></small>
        </div>
        <p class="error" id="rec-mensaje" role="status" hidden></p>
        <div class="acciones">
          <button type="button" class="btn" id="rec-cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primario" id="rec-enviar">Enviar enlace</button>
        </div>
      </form>`;
    document.body.appendChild(capa);
    const input = $("#rec-email", capa);
    const cerrar = () => capa.remove();
    input.focus();
    $("#rec-cancelar", capa).addEventListener("click", cerrar);
    capa.addEventListener("click", (e) => { if (e.target === capa) cerrar(); });
    $("form", capa).addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#rec-error", capa), msg = $("#rec-mensaje", capa), btn = $("#rec-enviar", capa);
      const fallo = D.validarEmail(input.value);
      err.textContent = fallo || ""; err.hidden = !fallo;
      input.classList.toggle("invalido", Boolean(fallo));
      if (fallo) return;
      btn.disabled = true; btn.textContent = "Enviando…";
      try {
        await api.recuperarClave(input.value.trim().toLowerCase());
        // Mensaje genérico: no revela si el correo existe
        msg.textContent = "Si ese correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.";
        msg.className = "error exito";
        btn.textContent = "Enviado";
      } catch (x) {
        msg.textContent = x.message; msg.className = "error";
        btn.disabled = false; btn.textContent = "Enviar enlace";
      }
      msg.hidden = false;
    });
  }

  function vistaNuevaClave() {
    const datos = { email: S.sesion.user.email, nombre: perfil().nombre };
    app.innerHTML = `
      <section class="bienvenida">
        <p class="sobretitulo">Recuperación de cuenta</p>
        <h1>Crea una contraseña nueva</h1>
        <p class="sub">${esc(S.sesion.user.email)}</p>
        <form id="form-clave" class="tarjeta" novalidate>
          <div class="campo">
            <label for="n-clave">Nueva contraseña</label>
            <div class="con-boton">
              <input id="n-clave" type="password" autocomplete="new-password" maxlength="64" aria-describedby="n-error reglas-clave">
              <button type="button" class="ver-clave" data-ver="n-clave" aria-label="Mostrar contraseña" aria-pressed="false">👁</button>
            </div>
            <small class="campo-error" id="n-error" hidden></small>
          </div>
          <div class="medidor" aria-hidden="true"><span id="medidor-barra"></span></div>
          <p class="medidor-texto" id="medidor-texto" aria-live="polite"></p>
          <ul class="reglas" id="reglas-clave"></ul>
          <div class="campo">
            <label for="n-confirmar">Confirmar contraseña</label>
            <input id="n-confirmar" type="password" autocomplete="new-password" maxlength="64" aria-describedby="n-error2">
            <small class="campo-error" id="n-error2" hidden></small>
          </div>
          <p class="error" id="n-general" role="alert" hidden></p>
          <button class="btn btn-primario btn-bloque" type="submit" id="n-guardar">Guardar contraseña</button>
        </form>
      </section>`;
    const clave = $("#n-clave"), conf = $("#n-confirmar");
    const niveles = ["", "Muy débil", "Débil", "Segura", "Muy segura"];
    const pintar = () => {
      const reglas = D.reglasClave(clave.value, datos);
      const f = D.fuerzaClave(clave.value, datos);
      $("#reglas-clave").innerHTML = reglas.map(r => `<li class="${r.ok ? "ok" : ""}"><span aria-hidden="true">${r.ok ? "✓" : "○"}</span> ${r.texto}</li>`).join("");
      $("#medidor-barra").style.width = (f / 4 * 100) + "%";
      $("#medidor-barra").dataset.nivel = f;
      $("#medidor-texto").textContent = clave.value ? "Seguridad: " + niveles[f] : "";
    };
    const marcar = (input, salida, m) => { input.classList.toggle("invalido", Boolean(m)); salida.textContent = m || ""; salida.hidden = !m; return !m; };
    pintar();
    clave.addEventListener("input", pintar);
    $(".ver-clave", app).addEventListener("click", (e) => {
      const ver = clave.type === "password";
      clave.type = conf.type = ver ? "text" : "password";
      e.currentTarget.textContent = ver ? "🙈" : "👁";
      e.currentTarget.setAttribute("aria-pressed", ver);
    });
    $("#form-clave").addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = marcar(clave, $("#n-error"), D.validarClave(clave.value, datos));
      const b = marcar(conf, $("#n-error2"), conf.value !== clave.value ? "Las contraseñas no coinciden." : null);
      if (!a || !b) return;
      const btn = $("#n-guardar"), gen = $("#n-general");
      btn.disabled = true; btn.textContent = "Guardando…"; gen.hidden = true;
      try {
        await api.cambiarClave(clave.value);
        toast("Contraseña actualizada. Ya puedes usarla para iniciar sesión.");
        location.hash = perfil().perfil_completo || esAdmin() ? "#/menu" : "#/bienvenida";
      } catch (x) {
        gen.textContent = x.message; gen.hidden = false;
        btn.disabled = false; btn.textContent = "Guardar contraseña";
      }
    });
  }

  /* ================= vista: bienvenida (Hito 1) ================= */
  function formPerfilHTML(p) {
    return `
      <fieldset class="bloque">
        <legend>🛡️ Restricciones médicas</legend>
        <p class="ayuda">Lo que marques se filtra de forma estricta: nunca verás ni te recomendaremos productos que no sean aptos.</p>
        <div class="checks">${D.INTOLERANCIAS.map(i => `
          <label class="check"><input type="checkbox" name="r" value="${i.id}" ${(p.restricciones || []).includes(i.id) ? "checked" : ""}> ${i.label}</label>`).join("")}
        </div>
      </fieldset>
      <fieldset class="bloque">
        <legend>💛 Tus gustos</legend>
        <p class="ayuda">Elige los que quieras. Son el punto de partida mientras aprendemos de tus pedidos.</p>
        <div class="chips">${D.GUSTOS.map(g => `
          <label class="chip-check"><input type="checkbox" name="g" value="${g.id}" ${(p.preferencias || []).includes(g.id) ? "checked" : ""}><span>${g.icono} ${g.label}</span></label>`).join("")}
        </div>
      </fieldset>`;
  }
  const leerFormPerfil = (f) => ({
    restricciones: $$("input[name=r]:checked", f).map(i => i.value),
    preferencias: $$("input[name=g]:checked", f).map(i => i.value)
  });

  function vistaBienvenida() {
    app.innerHTML = `
      <section class="bienvenida">
        <p class="sobretitulo">Hito 1 · Primer pedido</p>
        <h1>Construyamos tu perfil, ${esc(perfil().nombre.split(" ")[0])}</h1>
        <p class="sub">Toma 20 segundos y hace que tus recomendaciones sean útiles desde el primer pedido. Puedes cambiarlo cuando quieras.</p>
        <form id="form-bienvenida" class="tarjeta">
          ${formPerfilHTML(perfil())}
          <p class="ayuda">🔒 Tus datos solo se usan para personalizar tus sugerencias (Ley 1581 de 2012).</p>
          <div class="acciones">
            <button type="button" class="btn" id="btn-omitir">Omitir por ahora</button>
            <button class="btn btn-primario" type="submit">Empezar a pedir →</button>
          </div>
        </form>
      </section>`;
    const terminar = async (cambios) => {
      await api.actualizarPerfil(perfil().id, { ...cambios, perfil_completo: true });
      Object.assign(perfil(), cambios, { perfil_completo: true });
      S.productos = await api.productos();
      location.hash = "#/menu";
    };
    $("#form-bienvenida").addEventListener("submit", (e) => { e.preventDefault(); terminar(leerFormPerfil(e.target)).catch(x => toast(x.message, "error")); });
    $("#btn-omitir").addEventListener("click", () => terminar({}).catch(x => toast(x.message, "error")));
  }

  /* ================= vista: menú ================= */
  function tarjetaProducto(p, motivo, rec) {
    const agotado = p.stock <= 0;
    const alergenos = (p.alergenos || [])
      .map(a => D.INTOLERANCIAS.find(i => i.id === a)?.corto).filter(Boolean);
    return `
      <article class="producto ${agotado ? "agotado" : ""}">
        <div class="producto-img" aria-hidden="true">${esc(p.emoji || "☕")}</div>
        <div class="producto-cuerpo">
          ${motivo ? `<p class="motivo">✨ ${esc(motivo)}</p>` : ""}
          <h3>${esc(p.nombre)}</h3>
          <p class="desc">${esc(p.descripcion || "")}</p>
          <p class="contiene">${p.personalizable ? "Personalizable · " : ""}${alergenos.length ? "Contiene: " + esc(alergenos.join(", ")) : "Sin alérgenos comunes"}</p>
          <div class="producto-pie">
            <strong>${p.personalizable ? "desde " : ""}${dinero(p.precio)}</strong>
            ${agotado ? `<span class="pildora agotado">Agotado</span>`
              : `<button class="btn btn-primario btn-sm" data-agregar="${p.id}" data-rec="${rec ? 1 : 0}" aria-label="Agregar ${esc(p.nombre)}">${p.personalizable ? "Elegir" : "Agregar"}</button>`}
          </div>
        </div>
      </article>`;
  }

  function filtrarMenu() {
    const q = S.busqueda.toLowerCase();
    return S.productos
      .filter(p => S.categoria === "Todas" || p.categoria === S.categoria)
      .filter(p => !q || p.nombre.toLowerCase().includes(q) || (p.descripcion || "").toLowerCase().includes(q));
  }

  function vistaMenu() {
    const pf = perfil();
    const recs = R.recomendar({ productos: S.productos, misPedidos: S.misPedidos, globales: S.globales, perfil: pf, mood: S.mood, limite: 4 });
    const nivel = R.nivelMadurez(S.misPedidos.length);
    const habitual = R.pedidoHabitual(S.misPedidos, S.productos);
    const categorias = ["Todas", ...new Set(S.productos.map(p => p.categoria))];
    const saludo = { manana: "Buenos días", tarde: "Buenas tardes", noche: "Buenas noches" }[R.momentoDelDia()];
    const restr = (pf.restricciones || []).map(r => D.INTOLERANCIAS.find(i => i.id === r)?.corto).filter(Boolean);

    app.innerHTML = `
      <section class="encabezado">
        <div class="fila-saludo">
          <h1>${saludo}, ${esc(pf.nombre.split(" ")[0])}</h1>
          ${S.kiosco ? "" : `<a class="nivel-mini" href="#/perfil" title="${esc(nivel.desc)}">Nivel ${nivel.n} · ${esc(nivel.nombre)}</a>`}
        </div>
        <div class="tarjeta mood">
          <p class="mood-pregunta">¿Cómo te sientes hoy? <span class="opcional">Opcional · tú decides qué compartes</span></p>
          <div class="chips" role="group" aria-label="Estado de ánimo">
            ${D.MOODS.map(m => `<button class="chip chip-mood ${S.mood === m.id ? "activo" : ""}" data-mood="${m.id}" aria-pressed="${S.mood === m.id}"><span aria-hidden="true">${m.icono}</span> ${m.label}</button>`).join("")}
          </div>
        </div>
      </section>

      ${habitual ? `
      <section class="tarjeta habitual">
        <div>
          <p class="sobretitulo">⚡ Confirmación rápida · lo pediste ${habitual.veces} veces</p>
          <h2>Lo de siempre</h2>
          <p class="desc">${habitual.items.map(i => `${i.cantidad > 1 ? i.cantidad + "× " : ""}${esc(i.nombre)}${i.opciones ? ` <small>(${esc(D.describirOpciones(i.opciones))})</small>` : ""}`).join(" + ")}</p>
        </div>
        <button class="btn btn-primario" id="btn-habitual">Pedir ahora · ${dinero(habitual.items.reduce((s, i) => s + D.precioUnitario(producto(i.producto_id), i.opciones) * i.cantidad, 0))}</button>
      </section>` : ""}

      <section>
        <div class="titulo-seccion">
          <h2>Recomendado para ti</h2>
          ${restr.length ? `<span class="nota">🛡️ Filtrado: sin ${esc(restr.join(", ").toLowerCase())}</span>` : ""}
        </div>
        ${recs.length
          ? `<div class="carrusel">${recs.map(r => tarjetaProducto(r.producto, r.motivo, true)).join("")}</div>`
          : `<p class="vacio-mini">No hay productos que cumplan todas tus restricciones. Ajusta tu <a href="#/perfil">perfil</a>.</p>`}
      </section>

      <section>
        <div class="titulo-seccion"><h2>Menú completo</h2></div>
        <input class="buscador" type="search" placeholder="Buscar producto…" value="${esc(S.busqueda)}" aria-label="Buscar producto">
        <div class="chips desplazable" role="group" aria-label="Categorías">
          ${categorias.map(c => `<button class="chip ${S.categoria === c ? "activo" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
        <div class="grid" id="grid-productos">
          ${filtrarMenu().map(p => tarjetaProducto(p)).join("") || `<p class="vacio-mini">Sin resultados.</p>`}
        </div>
      </section>
      ${cantidadCarrito() ? `<a href="#/carrito" class="flotante">🛒 Ver carrito · ${cantidadCarrito()} · ${dinero(totalCarrito())}</a>` : ""}`;

    $$("[data-mood]", app).forEach(b => b.addEventListener("click", () => {
      S.mood = S.mood === b.dataset.mood ? null : b.dataset.mood;
      vistaMenu();
    }));
    $$("[data-cat]", app).forEach(b => b.addEventListener("click", () => { S.categoria = b.dataset.cat; vistaMenu(); }));
    const buscador = $(".buscador", app);
    buscador.addEventListener("input", () => {
      S.busqueda = buscador.value;
      $("#grid-productos").innerHTML = filtrarMenu().map(p => tarjetaProducto(p)).join("") || `<p class="vacio-mini">Sin resultados.</p>`;
    });
    const bh = $("#btn-habitual");
    if (bh) bh.addEventListener("click", () => {
      habitual.items.forEach(i => agregarLinea(i.producto_id, i.opciones, false, i.cantidad));
      location.hash = "#/carrito";
    });
  }

  /* ================= vista: carrito ================= */
  function vistaCarrito() {
    const lineas = S.carrito.map(l => ({ ...l, p: producto(l.producto_id) })).filter(l => l.p);
    const total = totalCarrito();
    const combina = lineas.length ? R.recomendar({
      productos: S.productos, misPedidos: S.misPedidos, globales: S.globales, perfil: perfil(), mood: S.mood,
      carrito: lineas.map(l => l.producto_id), limite: 3
    }) : [];
    const canalGuardado = S.kiosco ? "kiosco" : (() => { try { return localStorage.getItem("cafe_canal") || "movil"; } catch (e) { return "movil"; } })();
    const m = moodDef(S.mood);

    app.innerHTML = `
      <section class="encabezado"><h1>Tu pedido</h1></section>
      ${lineas.length ? `
        <div class="carrito-layout">
          <div class="tarjeta">
            <ul class="lineas">
              ${lineas.map(l => `
                <li class="linea">
                  <span class="linea-emoji" aria-hidden="true">${esc(l.p.emoji)}</span>
                  <div class="linea-info">
                    <strong>${esc(l.p.nombre)} ${l.recomendado ? `<span class="rec" title="Agregado desde una recomendación">✨</span>` : ""}</strong>
                    ${l.opciones ? `<small>${esc(D.describirOpciones(l.opciones))}</small>` : ""}
                    <span>${dinero(D.precioUnitario(l.p, l.opciones))}</span>
                  </div>
                  <div class="cantidad">
                    <button class="btn-redondo" data-menos="${esc(l.clave)}" aria-label="Quitar uno">−</button>
                    <span aria-live="polite">${l.cantidad}</span>
                    <button class="btn-redondo" data-mas="${esc(l.clave)}" aria-label="Agregar uno">+</button>
                  </div>
                </li>`).join("")}
            </ul>
          </div>
          <aside class="tarjeta resumen">
            <p class="mood-resumen">${m ? `${m.icono} Hoy te sientes <strong>${m.label.toLowerCase()}</strong>` : "Sin mood registrado"} · <a href="#/menu">cambiar</a></p>
            ${S.kiosco ? `<p class="canal-fijo">🖥️ Pedido desde kiosco</p>` : `
            <label class="campo">¿Desde dónde pides?
              <select id="canal">
                <option value="movil" ${canalGuardado === "movil" ? "selected" : ""}>📱 Mi celular</option>
                <option value="kiosco" ${canalGuardado === "kiosco" ? "selected" : ""}>🖥️ Kiosco de autoservicio</option>
              </select>
            </label>`}
            <div class="total"><span>Total</span><strong>${dinero(total)}</strong></div>
            <button class="btn btn-primario btn-bloque" id="btn-pedir">Confirmar pedido</button>
          </aside>
        </div>
        ${combina.length ? `
          <section>
            <div class="titulo-seccion"><h2>Combina bien con tu pedido</h2></div>
            <div class="carrusel">${combina.map(r => tarjetaProducto(r.producto, r.motivo, true)).join("")}</div>
          </section>` : ""}
      ` : `<section class="vacio"><p>Tu carrito está vacío.</p><a class="btn btn-primario" href="#/menu">Ver el menú</a></section>`}`;

    const cambiar = (clave, delta) => {
      const l = S.carrito.find(i => i.clave === clave);
      l.cantidad += delta;
      if (l.cantidad <= 0) S.carrito = S.carrito.filter(i => i !== l);
      guardarCarrito(); pintarNavegacion(); vistaCarrito();
    };
    $$("[data-mas]", app).forEach(b => b.addEventListener("click", () => cambiar(b.dataset.mas, 1)));
    $$("[data-menos]", app).forEach(b => b.addEventListener("click", () => cambiar(b.dataset.menos, -1)));
    const btn = $("#btn-pedir");
    if (btn) btn.addEventListener("click", async () => {
      const canal = S.kiosco ? "kiosco" : $("#canal").value;
      try { localStorage.setItem("cafe_canal", canal); } catch (e) { /* ignorar */ }
      btn.disabled = true; btn.textContent = "Enviando…";
      try {
        const id = await api.crearPedido(S.carrito, canal, S.mood);
        S.carrito = []; guardarCarrito();
        await cargarDatos();
        pintarNavegacion();
        confirmarPedido(id, total);
      } catch (e) {
        toast(e.message, "error");
        btn.disabled = false; btn.textContent = "Confirmar pedido";
      }
    });
  }

  function confirmarPedido(id, total) {
    const capa = document.createElement("div");
    capa.className = "capa centro";
    capa.innerHTML = `
      <div class="confirmacion" role="alertdialog" aria-labelledby="conf-titulo">
        <div class="check" aria-hidden="true">✓</div>
        <h2 id="conf-titulo">Pedido #${id} confirmado</h2>
        <p>${dinero(total)} · ${S.kiosco ? "Recógelo en la barra cuando lo llamemos." : "Te avisaremos cuando esté listo."}</p>
        ${S.kiosco ? `<p class="ayuda" id="cuenta">Cerrando sesión en 8 s…</p><button class="btn btn-primario btn-bloque" id="conf-ok">Terminar</button>`
          : `<button class="btn btn-primario btn-bloque" id="conf-ok">Ver mis pedidos</button>`}
        <div class="conf-extra">
          <button class="btn btn-sm" id="conf-factura">🧾 Ver factura</button>
          ${!S.kiosco && avisos.permiso() === "default" ? `<button class="btn btn-sm" id="conf-avisar">🔔 Avisarme cuando esté listo</button>` : ""}
        </div>
      </div>`;
    document.body.appendChild(capa);
    const ok = $("#conf-ok", capa);
    ok.focus();
    $("#conf-factura", capa).addEventListener("click", async () => {
      try { factura.abrir(await api.obtenerPedido(id), datosCliente()); } catch (e) { toast(e.message, "error"); }
    });
    const avisar = $("#conf-avisar", capa);
    if (avisar) avisar.addEventListener("click", async () => {
      const r = await avisos.pedirPermiso();
      avisar.textContent = r === "granted" ? "✓ Te avisaremos" : "Notificaciones bloqueadas";
      avisar.disabled = true;
    });
    if (S.kiosco) {
      let s = 8;
      const t = setInterval(() => {
        s--;
        const c = $("#cuenta", capa);
        if (c) c.textContent = `Cerrando sesión en ${s} s…`;
        if (s <= 0) { clearInterval(t); salir(); }
      }, 1000);
      ok.addEventListener("click", () => { clearInterval(t); salir(); });
    } else {
      ok.addEventListener("click", () => { capa.remove(); location.hash = "#/pedidos"; });
    }
  }

  /* ================= vista: mis pedidos ================= */
  const pildora = (estado) => `<span class="pildora ${estado}">${esc((ESTADOS.find(e => e[0] === estado) || [0, estado])[1])}</span>`;
  const itemsHTML = (items) => `<ul>${items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)}${i.opciones ? ` <small>(${esc(D.describirOpciones(i.opciones))})</small>` : ""}${i.recomendado ? ` <span class="rec" title="Recomendado por el sistema">✨</span>` : ""}</li>`).join("")}</ul>`;
  const metaPedido = (p) => `${fecha(p.created_at)} · ${p.canal === "kiosco" ? "🖥️ Kiosco" : "📱 Celular"}${p.mood && moodDef(p.mood) ? " · " + moodDef(p.mood).icono + " " + moodDef(p.mood).label : ""}`;

  async function vistaPedidos() {
    app.innerHTML = `<section class="encabezado"><h1>Mis pedidos</h1></section><p class="cargando">Cargando…</p>`;
    S.misPedidos = await api.misPedidos(S.sesion.user.id);
    const pintar = () => {
      app.innerHTML = `
        <section class="encabezado"><h1>Mis pedidos</h1></section>
        ${S.misPedidos.length ? `<div class="lista-pedidos">${S.misPedidos.map(p => `
          <article class="tarjeta pedido">
            <header><strong>Pedido #${p.id}</strong>${pildora(p.estado)}</header>
            <p class="meta">${metaPedido(p)}</p>
            ${itemsHTML(p.items)}
            <footer><span>Total</span><strong>${dinero(p.total)}</strong></footer>
            <button class="btn btn-sm btn-factura" data-factura="${p.id}">🧾 Ver factura ${factura.numero(p.id)}</button>
          </article>`).join("")}</div>`
          : `<section class="vacio"><p>Aún no has hecho pedidos.</p><a class="btn btn-primario" href="#/menu">Hacer mi primer pedido</a></section>`}`;
    };
    pintar();
    app.onclick = (e) => {
      const b = e.target.closest("[data-factura]");
      if (!b) return;
      const p = S.misPedidos.find(x => x.id === Number(b.dataset.factura));
      if (p) factura.abrir(p, datosCliente());
    };
    S.temporizador = setInterval(async () => {
      try { S.misPedidos = await api.misPedidos(S.sesion.user.id); pintar(); } catch (e) { /* reintentar luego */ }
    }, 20000);
  }

  /* ================= vista: perfil (curva de madurez) ================= */
  function vistaPerfil() {
    const p = perfil();
    const nivel = R.nivelMadurez(S.misPedidos.length);
    const totalGastado = S.misPedidos.reduce((s, x) => s + x.total, 0);
    const conteo = {};
    S.misPedidos.forEach(x => x.items.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad; }));
    const favorito = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
    const moods = {};
    S.misPedidos.forEach(x => { if (x.mood) moods[x.mood] = (moods[x.mood] || 0) + 1; });
    const moodFrecuente = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];

    app.innerHTML = `
      <section class="encabezado"><h1>Mi perfil</h1><p class="sub">${esc(S.sesion.user.email)}</p></section>

      <section class="tarjeta madurez">
        <div class="titulo-seccion">
          <h2>Curva de madurez de tus recomendaciones</h2>
          <span class="nota">${S.misPedidos.length} pedido${S.misPedidos.length === 1 ? "" : "s"}</span>
        </div>
        <ol class="hitos">
          ${R.NIVELES.map(n => `
            <li class="${n.n < nivel.n ? "hecho" : n.n === nivel.n ? "actual" : ""}">
              <span class="hito-punto">${n.n}</span>
              <strong>${esc(n.nombre)}</strong>
              <small>${esc(n.desc)}</small>
            </li>`).join("")}
        </ol>
        <div class="barra-progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(nivel.progreso * 100)}">
          <span style="width:${Math.round(((nivel.n - 1) + nivel.progreso) / 4 * 100)}%"></span>
        </div>
        <p class="ayuda">${nivel.siguiente ? `Te faltan <strong>${nivel.faltan}</strong> pedido${nivel.faltan === 1 ? "" : "s"} para llegar a “${esc(nivel.siguiente.nombre)}”.` : "Tu perfil alcanzó su máxima precisión."}
          Con cada pedido el sistema da más peso a tu historial real y menos a lo declarado.</p>
      </section>

      <div class="stats">
        <div class="stat"><span>Pedidos</span><strong>${S.misPedidos.length}</strong></div>
        <div class="stat"><span>Total consumido</span><strong>${dinero(totalGastado)}</strong></div>
        <div class="stat"><span>Tu favorito</span><strong>${favorito ? esc(favorito[0]) : "—"}</strong></div>
        <div class="stat"><span>Mood más frecuente</span><strong>${moodFrecuente ? moodDef(moodFrecuente[0]).icono + " " + moodDef(moodFrecuente[0]).label : "—"}</strong></div>
      </div>

      <form class="tarjeta" id="form-perfil">
        <label class="campo">Nombre <input name="nombre" value="${esc(p.nombre)}" required></label>
        ${formPerfilHTML(p)}
        <p class="ayuda">🔒 Tus datos se usan solo para personalizar tus sugerencias (Ley 1581 de 2012 de protección de datos personales).</p>
        <button class="btn btn-primario" type="submit">Guardar cambios</button>
      </form>`;

    $("#form-perfil").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const cambios = { nombre: ev.target.nombre.value.trim() || p.nombre, ...leerFormPerfil(ev.target) };
      try {
        await api.actualizarPerfil(p.id, cambios);
        Object.assign(p, cambios);
        S.productos = await api.productos();
        S.carrito = S.carrito.filter(l => producto(l.producto_id));
        guardarCarrito(); pintarNavegacion();
        toast("Perfil actualizado. Tu menú ya refleja los cambios.");
      } catch (e) { toast(e.message, "error"); }
    });
  }

  /* ================= vista: dashboard de la cafetería ================= */
  async function vistaAdmin() {
    app.innerHTML = `<section class="encabezado"><h1>Dashboard</h1></section><p class="cargando">Cargando…</p>`;
    let pedidos = await api.todosLosPedidos();
    let catalogo = await api.productosAdmin();

    const barras = (pares) => {
      const max = Math.max(1, ...pares.map(x => x[1]));
      return `<ul class="barras">${pares.map(([n, c]) => `
        <li><span class="barra-nombre">${n}</span><span class="barra-valor">${c}</span>
          <span class="barra"><span style="width:${(c / max * 100).toFixed(0)}%"></span></span></li>`).join("") || "<li>Sin datos</li>"}</ul>`;
    };

    const haceCuanto = (iso) => {
      const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
      return min < 1 ? "ahora" : min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h ${min % 60} min`;
    };
    const SIGUIENTE = { pendiente: ["preparando", "▶ Empezar a preparar"], preparando: ["listo", "✓ Marcar listo"], listo: ["entregado", "Entregado"] };

    const tarjetaPedido = (p, conSelector) => `
      <article class="tarjeta pedido ${p.estado} ${S.avisosNuevos.has(p.id) ? "nuevo" : ""}" data-id="${p.id}">
        <header><strong>#${p.id} · ${esc(p.cliente || "Cliente")}</strong>${S.avisosNuevos.has(p.id) ? `<span class="pildora nuevo">Nuevo</span>` : pildora(p.estado)}</header>
        <p class="meta">${haceCuanto(p.created_at)} · ${metaPedido(p)}</p>
        ${itemsHTML(p.items)}
        <footer>
          <strong>${dinero(p.total)}</strong>
          <span class="acciones-pedido">
            <button class="btn-redondo" data-factura-admin="${p.id}" title="Ver factura" aria-label="Ver factura del pedido ${p.id}">🧾</button>
            ${conSelector
              ? `<select data-estado="${p.id}" aria-label="Estado del pedido ${p.id}">
                  ${ESTADOS.map(([k, t]) => `<option value="${k}" ${p.estado === k ? "selected" : ""}>${t}</option>`).join("")}
                </select>`
              : SIGUIENTE[p.estado] ? `<button class="btn btn-primario btn-sm" data-avanzar="${p.id}" data-a="${SIGUIENTE[p.estado][0]}">${SIGUIENTE[p.estado][1]}</button>` : ""}
          </span>
        </footer>
      </article>`;

    const tabPedidos = () => {
      const activos = pedidos.filter(p => p.estado !== "entregado");
      const permiso = avisos.permiso();
      const controles = `
        <div class="barra-vivo">
          <span id="en-vivo" class="en-vivo ${S.conexion}">${S.conexion === "en-vivo" ? "● En vivo" : "○ Conectando…"}</span>
          <span class="ayuda">Los pedidos nuevos aparecen solos, con sonido y aviso.</span>
          <span class="controles-vivo">
            ${permiso === "default" ? `<button class="btn btn-sm" data-permiso>🔔 Activar notificaciones</button>`
              : permiso === "granted" ? `<span class="nota">🔔 Notificaciones activas</span>`
              : permiso === "denied" ? `<span class="nota">🔕 Notificaciones bloqueadas en el navegador</span>` : ""}
            <button class="btn btn-sm" data-sonido aria-pressed="${avisos.sonidoActivo()}">${avisos.sonidoActivo() ? "🔊 Sonido activado" : "🔇 Sonido apagado"}</button>
            <button class="btn btn-sm" data-probar>Probar sonido</button>
          </span>
        </div>`;
      if (S.filtroAdmin === "todos") {
        return controles + `
          <div class="titulo-seccion">
            <h2>Historial de pedidos</h2>
            <div class="chips">
              <button class="chip" data-filtro="activos">Tablero en curso (${activos.length})</button>
              <button class="chip activo" data-filtro="todos">Historial</button>
              <button class="chip" data-refrescar aria-label="Actualizar">↻</button>
            </div>
          </div>
          <div class="lista-pedidos">${pedidos.map(p => tarjetaPedido(p, true)).join("") || `<p class="vacio-mini">Aún no hay pedidos.</p>`}</div>`;
      }
      const columnas = [["pendiente", "Pendientes"], ["preparando", "En preparación"], ["listo", "Listos para entregar"]];
      return controles + `
        <div class="titulo-seccion">
          <h2>Pedidos en curso</h2>
          <div class="chips">
            <button class="chip activo" data-filtro="activos">Tablero en curso (${activos.length})</button>
            <button class="chip" data-filtro="todos">Historial</button>
            <button class="chip" data-refrescar aria-label="Actualizar">↻</button>
          </div>
        </div>
        <div class="tablero">
          ${columnas.map(([estado, titulo]) => {
            const lista = activos.filter(p => p.estado === estado).sort((a, b) => a.created_at.localeCompare(b.created_at));
            return `<section class="columna ${estado}" aria-label="${titulo}">
              <h3>${titulo} <span class="contador">${lista.length}</span></h3>
              ${lista.map(p => tarjetaPedido(p, false)).join("") || `<p class="vacio-mini">Sin pedidos</p>`}
            </section>`;
          }).join("")}
        </div>`;
    };

    const tabMenu = () => {
      const bajos = catalogo.filter(p => p.stock <= 5);
      return `
        <div class="titulo-seccion">
          <h2>Menú e inventario</h2>
          <button class="btn btn-primario btn-sm" data-editar="nuevo">+ Nuevo producto</button>
        </div>
        ${bajos.length ? `<p class="alerta">⚠️ Stock bajo o agotado: ${bajos.map(p => `${esc(p.nombre)} (${p.stock})`).join(", ")}</p>` : ""}
        <div class="tabla-envoltura">
          <table class="tabla">
            <thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Visible</th><th></th></tr></thead>
            <tbody>${catalogo.map(p => `
              <tr class="${p.stock <= 0 ? "fila-agotada" : p.stock <= 5 ? "fila-baja" : ""}">
                <td><span aria-hidden="true">${esc(p.emoji)}</span> ${esc(p.nombre)}<small>${esc(p.categoria)}${p.personalizable ? " · personalizable" : ""}</small></td>
                <td>${dinero(p.precio)}</td>
                <td><div class="stock">
                  <button class="btn-redondo" data-stock="${p.id}" data-delta="-1" aria-label="Restar stock">−</button>
                  <span>${p.stock}</span>
                  <button class="btn-redondo" data-stock="${p.id}" data-delta="10" aria-label="Sumar 10 al stock">+10</button>
                </div></td>
                <td><label class="interruptor solo"><input type="checkbox" data-visible="${p.id}" ${p.disponible ? "checked" : ""} aria-label="Visible en el menú"><span></span></label></td>
                <td><button class="btn btn-sm" data-editar="${p.id}">Editar</button></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    };

    // ---------- estadísticas ----------
    const PERIODOS = [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"], ["todo", "Todo"]];
    const DIA = 86400000;
    const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    // Devuelve [desde, hasta) del periodo elegido y del periodo anterior equivalente (para comparar)
    const rango = (periodo) => {
      const manana = inicioDia(Date.now()).getTime() + DIA;
      if (periodo === "todo") return { desde: 0, hasta: manana, antes: null };
      const dias = periodo === "hoy" ? 1 : Number(periodo);
      const desde = manana - dias * DIA;
      return { desde, hasta: manana, antes: [desde - dias * DIA, desde], dias };
    };
    const enRango = (p, d, h) => { const t = new Date(p.created_at).getTime(); return t >= d && t < h; };
    const sumar = (lista) => lista.reduce((s, p) => s + p.total, 0);
    const variacion = (actual, previo) => {
      if (previo == null) return "";
      if (!previo) return actual ? `<small class="delta sube">nuevo</small>` : `<small class="delta">sin cambios</small>`;
      const v = Math.round((actual - previo) / previo * 100);
      return `<small class="delta ${v > 0 ? "sube" : v < 0 ? "baja" : ""}">${v > 0 ? "▲" : v < 0 ? "▼" : "="} ${Math.abs(v)}% vs. periodo anterior</small>`;
    };
    // Gráfica de columnas (CSS); cada dato: [etiqueta, valor, texto del valor]
    const columnasGrafica = (datos, titulo) => {
      const max = Math.max(1, ...datos.map(d => d[1]));
      const cada = Math.ceil(datos.length / 8);
      return `<div class="grafica" role="img" aria-label="${esc(titulo)}">
        ${datos.map(([etq, v, txt], i) => `
          <div class="col" title="${esc(etq)}: ${esc(txt ?? v)}">
            <span class="col-valor">${v && datos.length <= 16 ? esc(txt ?? v) : ""}</span>
            <span class="col-barra" style="height:${Math.max(v ? 3 : 0, v / max * (datos.length <= 16 ? 66 : 92)).toFixed(1)}%"></span>
            <span class="col-etq">${i % cada === 0 ? esc(etq) : ""}</span>
          </div>`).join("")}
      </div>`;
    };
    const exportarCSV = (lista) => {
      const filas = [["pedido", "fecha", "cliente", "canal", "estado", "mood", "producto", "cantidad", "precio_unitario", "subtotal", "recomendado"]];
      lista.forEach(p => p.items.forEach(i => filas.push([p.id, new Date(p.created_at).toLocaleString("es-CO"), p.cliente || "", p.canal, p.estado, p.mood || "",
        i.nombre, i.cantidad, i.precio_unitario, i.precio_unitario * i.cantidad, i.recomendado ? "si" : "no"])));
      const csv = "﻿" + filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = `pedidos-${S.periodoAdmin}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const tabIndicadores = () => {
      const r = rango(S.periodoAdmin);
      const lista = pedidos.filter(p => enRango(p, r.desde, r.hasta));
      const previos = r.antes ? pedidos.filter(p => enRango(p, r.antes[0], r.antes[1])) : null;
      const ventas = sumar(lista);
      const ticket = lista.length ? ventas / lista.length : 0;
      const unidades = lista.reduce((s, p) => s + p.items.reduce((t, i) => t + i.cantidad, 0), 0);
      const clientes = new Set(lista.map(p => p.usuario_id)).size;
      const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "0%";
      const conRec = lista.filter(p => p.items.some(i => i.recomendado)).length;
      const conMood = lista.filter(p => p.mood).length;
      const kiosco = lista.filter(p => p.canal === "kiosco").length;
      const enCurso = pedidos.filter(p => p.estado !== "entregado").length;

      // Ventas en el tiempo: por hora si es "hoy", si no por día
      let serie;
      if (S.periodoAdmin === "hoy") {
        serie = Array.from({ length: 16 }, (_, k) => k + 6).map(h => {
          const v = sumar(lista.filter(p => new Date(p.created_at).getHours() === h));
          return [h + "h", v, dinero(v)];
        });
      } else {
        const dias = r.dias || Math.min(60, Math.max(1, Math.ceil((r.hasta - (lista.length ? Math.min(...lista.map(p => new Date(p.created_at).getTime())) : r.hasta - DIA)) / DIA)));
        serie = Array.from({ length: dias }, (_, k) => {
          const d0 = r.hasta - (dias - k) * DIA;
          const v = sumar(lista.filter(p => enRango(p, d0, d0 + DIA)));
          return [new Date(d0).toLocaleDateString("es-CO", { day: "numeric", month: "numeric" }), v, dinero(v)];
        });
      }
      const porHora = Array.from({ length: 16 }, (_, k) => k + 6).map(h => [h + "h", lista.filter(p => new Date(p.created_at).getHours() === h).length]);
      const hora = porHora.reduce((m, x) => x[1] > m[1] ? x : m, ["—", 0]);

      // Productos y categorías
      const porProducto = {}, porCategoria = {};
      lista.forEach(p => p.items.forEach(i => {
        const ing = i.precio_unitario * i.cantidad;
        const pr = porProducto[i.nombre] = porProducto[i.nombre] || { u: 0, ing: 0 };
        pr.u += i.cantidad; pr.ing += ing;
        const cat = (catalogo.find(c => c.id === i.producto_id) || {}).categoria || "Otros";
        porCategoria[cat] = (porCategoria[cat] || 0) + ing;
      }));
      const topUnidades = Object.entries(porProducto).sort((a, b) => b[1].u - a[1].u).slice(0, 6).map(([n, v]) => [esc(n), v.u]);
      const topIngresos = Object.entries(porProducto).sort((a, b) => b[1].ing - a[1].ing).slice(0, 6).map(([n, v]) => [esc(n), Math.round(v.ing)]);
      const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([n, v]) => [esc(n), Math.round(v)]);

      // Clientes frecuentes
      const porCliente = {};
      lista.forEach(p => { const c = porCliente[p.usuario_id] = porCliente[p.usuario_id] || { n: p.cliente || "Cliente", k: 0, g: 0 }; c.k++; c.g += p.total; });
      const frecuentes = Object.values(porCliente).sort((a, b) => b.k - a.k || b.g - a.g).slice(0, 5);

      const moods = D.MOODS.map(m => [m.icono + " " + m.label, lista.filter(p => p.mood === m.id).length]);
      const franjas = Object.entries(D.MOMENTOS).map(([k, v]) => [v[0].toUpperCase() + v.slice(1),
        lista.filter(p => R.momentoDelDia(new Date(p.created_at)) === k).length]);
      const barrasDinero = (pares) => barras(pares).replace(/<span class="barra-valor">(\d+)<\/span>/g, (_, n) => `<span class="barra-valor">${dinero(Number(n))}</span>`);

      return `
        <div class="titulo-seccion">
          <div class="chips" role="group" aria-label="Periodo">
            ${PERIODOS.map(([k, t]) => `<button class="chip ${S.periodoAdmin === k ? "activo" : ""}" data-periodo="${k}" aria-pressed="${S.periodoAdmin === k}">${t}</button>`).join("")}
          </div>
          <div class="chips">
            <button class="chip" data-refrescar aria-label="Actualizar">↻</button>
            <button class="btn btn-sm" data-csv ${lista.length ? "" : "disabled"}>⬇ Descargar CSV</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><span>Ventas</span><strong>${dinero(ventas)}</strong>${variacion(ventas, previos && sumar(previos))}</div>
          <div class="stat"><span>Pedidos</span><strong>${lista.length}</strong>${variacion(lista.length, previos && previos.length)}</div>
          <div class="stat"><span>Ticket promedio</span><strong>${dinero(ticket)}</strong><small>${unidades} productos vendidos</small></div>
          <div class="stat"><span>Clientes atendidos</span><strong>${clientes}</strong><small>${enCurso} pedidos en curso ahora</small></div>
          <div class="stat destacado"><span>Aceptación de recomendaciones</span><strong>${pct(conRec, lista.length)}</strong><small>Pedidos con al menos un producto sugerido</small></div>
          <div class="stat"><span>Hora pico</span><strong>${hora[1] ? hora[0] : "—"}</strong><small>Kiosco: ${pct(kiosco, lista.length)} · Mood: ${pct(conMood, lista.length)}</small></div>
        </div>
        ${lista.length ? `
        <div class="paneles paneles-2">
          <div class="tarjeta"><h2>${S.periodoAdmin === "hoy" ? "Ventas por hora (hoy)" : "Ventas por día"}</h2>${columnasGrafica(serie, "Ventas en el periodo")}</div>
          <div class="tarjeta"><h2>Pedidos por hora del día</h2>${columnasGrafica(porHora, "Pedidos por hora")}</div>
        </div>
        <div class="paneles">
          <div class="tarjeta"><h2>Más vendidos (unidades)</h2>${barras(topUnidades)}</div>
          <div class="tarjeta"><h2>Ingresos por producto</h2>${barrasDinero(topIngresos)}</div>
          <div class="tarjeta"><h2>Ingresos por categoría</h2>${barrasDinero(categorias)}</div>
          <div class="tarjeta"><h2>Clientes frecuentes</h2>
            <ol class="ranking">${frecuentes.map(c => `<li><span>${esc(c.n)}</span><small>${c.k} pedido${c.k > 1 ? "s" : ""} · ${dinero(c.g)}</small></li>`).join("")}</ol></div>
          <div class="tarjeta"><h2>Mood de los clientes</h2>${barras(moods)}</div>
          <div class="tarjeta"><h2>Pedidos por franja</h2>${barras(franjas)}</div>
        </div>` : `<section class="vacio"><p>No hay pedidos en este periodo.</p></section>`}`;
    };

    const pintar = () => {
      const sub = { pedidos: "Recibe y atiende los pedidos de tus clientes en tiempo real.",
                    indicadores: "Ventas, productos y comportamiento de tus clientes.",
                    menu: "Productos, precios, stock y visibilidad en el menú." }[S.adminTab];
      app.innerHTML = `
        <section class="encabezado"><p class="sobretitulo">Dashboard · ${esc(perfil().nombre)}</p>
          <h1>${{ pedidos: "Pedidos", indicadores: "Estadísticas", menu: "Menú e inventario" }[S.adminTab]}</h1>
          <p class="sub">${sub}</p></section>
        <section>${S.adminTab === "pedidos" ? tabPedidos() : S.adminTab === "menu" ? tabMenu() : tabIndicadores()}</section>`;

      $$("[data-periodo]", app).forEach(b => b.addEventListener("click", () => { S.periodoAdmin = b.dataset.periodo; pintar(); }));
      $$("[data-csv]", app).forEach(b => b.addEventListener("click", () => { const r = rango(S.periodoAdmin); exportarCSV(pedidos.filter(p => enRango(p, r.desde, r.hasta))); }));
      $$("[data-filtro]", app).forEach(b => b.addEventListener("click", () => { S.filtroAdmin = b.dataset.filtro; pintar(); }));
      $$("[data-refrescar]", app).forEach(b => b.addEventListener("click", refrescar));
      $$("[data-permiso]", app).forEach(b => b.addEventListener("click", async () => { await avisos.pedirPermiso(); pintar(); }));
      $$("[data-sonido]", app).forEach(b => b.addEventListener("click", () => { avisos.activarSonido(!avisos.sonidoActivo()); pintar(); }));
      $$("[data-probar]", app).forEach(b => b.addEventListener("click", () => { avisos.sonar(); avisos.notificar("🔔 Prueba de notificación", "Así te avisaremos de cada pedido nuevo.", "prueba"); }));
      $$("[data-factura-admin]", app).forEach(b => b.addEventListener("click", () => {
        const p = pedidos.find(x => x.id === Number(b.dataset.facturaAdmin));
        if (p) factura.abrir(p, { nombre: p.cliente });
      }));
      $$("[data-avanzar]", app).forEach(b => b.addEventListener("click", async () => {
        const id = Number(b.dataset.avanzar);
        b.disabled = true;
        try {
          await api.cambiarEstado(id, b.dataset.a);
          pedidos.find(p => p.id === id).estado = b.dataset.a;
          S.avisosNuevos.delete(id); actualizarContadorAvisos();
          toast("Pedido #" + id + " → " + (ESTADOS.find(e => e[0] === b.dataset.a) || [0, b.dataset.a])[1]);
          pintar();
        } catch (e) { toast(e.message, "error"); b.disabled = false; }
      }));
      $$("[data-estado]", app).forEach(sel => sel.addEventListener("change", async () => {
        try {
          const id = Number(sel.dataset.estado);
          await api.cambiarEstado(id, sel.value);
          pedidos.find(p => p.id === id).estado = sel.value;
          toast("Pedido #" + id + " → " + sel.options[sel.selectedIndex].text);
          pintar();
        } catch (e) { toast(e.message, "error"); }
      }));
      $$("[data-stock]", app).forEach(b => b.addEventListener("click", async () => {
        const p = catalogo.find(x => x.id === Number(b.dataset.stock));
        const stock = Math.max(0, p.stock + Number(b.dataset.delta));
        try { await api.guardarProducto({ id: p.id, stock }); p.stock = stock; pintar(); } catch (e) { toast(e.message, "error"); }
      }));
      $$("[data-visible]", app).forEach(c => c.addEventListener("change", async () => {
        const p = catalogo.find(x => x.id === Number(c.dataset.visible));
        try { await api.guardarProducto({ id: p.id, disponible: c.checked }); p.disponible = c.checked; toast(p.nombre + (c.checked ? " visible en el menú" : " oculto del menú")); }
        catch (e) { toast(e.message, "error"); }
      }));
      $$("[data-editar]", app).forEach(b => b.addEventListener("click", () => {
        const p = b.dataset.editar === "nuevo" ? null : catalogo.find(x => x.id === Number(b.dataset.editar));
        editarProducto(p, catalogo, async () => { catalogo = await api.productosAdmin(); pintar(); });
      }));
    };
    const refrescar = async () => {
      try { [pedidos, catalogo] = await Promise.all([api.todosLosPedidos(), api.productosAdmin()]); pintar(); } catch (e) { /* ignorar */ }
    };
    pintar();
    S.recargarAdmin = async () => {
      await refrescar();
      if (S.adminTab === "pedidos") setTimeout(() => { S.avisosNuevos.clear(); actualizarContadorAvisos(); }, 8000);
    };
    if (S.adminTab === "pedidos" && S.avisosNuevos.size) setTimeout(() => {
      if (!rutaActual().startsWith("admin")) return;
      S.avisosNuevos.clear(); actualizarContadorAvisos(); pintar();
    }, 8000);
    S.temporizador = setInterval(() => { if (!$(".capa")) refrescar(); }, 15000);
  }

  function editarProducto(p, catalogo, alGuardar) {
    const v = p || { nombre: "", descripcion: "", categoria: "", precio: 0, emoji: "☕", stock: 20, disponible: true,
                     personalizable: false, alergenos: [], gustos: [], momento: ["manana", "tarde"] };
    const categorias = [...new Set(catalogo.map(x => x.categoria))];
    const checks = (nombre, lista, sel) => lista.map(([id, t]) =>
      `<label class="chip-check"><input type="checkbox" name="${nombre}" value="${id}" ${sel.includes(id) ? "checked" : ""}><span>${t}</span></label>`).join("");
    const capa = document.createElement("div");
    capa.className = "capa";
    capa.innerHTML = `
      <form class="hoja editor" role="dialog" aria-modal="true" aria-labelledby="ed-titulo">
        <button type="button" class="hoja-cerrar" aria-label="Cerrar">✕</button>
        <h2 id="ed-titulo">${p ? "Editar producto" : "Nuevo producto"}</h2>
        <div class="fila-campos">
          <label class="campo corto">Ícono <input name="emoji" value="${esc(v.emoji)}" maxlength="4" required></label>
          <label class="campo">Nombre <input name="nombre" value="${esc(v.nombre)}" required></label>
        </div>
        <label class="campo">Descripción <input name="descripcion" value="${esc(v.descripcion)}"></label>
        <div class="fila-campos">
          <label class="campo">Categoría <input name="categoria" list="lista-cat" value="${esc(v.categoria)}" required>
            <datalist id="lista-cat">${categorias.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
          <label class="campo">Precio (COP) <input name="precio" type="number" min="0" step="100" value="${v.precio}" required></label>
          <label class="campo">Stock <input name="stock" type="number" min="0" value="${v.stock}" required></label>
        </div>
        <fieldset class="bloque"><legend>Contiene (alérgenos)</legend>
          <div class="chips">${checks("alergenos", D.INTOLERANCIAS.map(i => [i.id, i.corto]), v.alergenos || [])}</div></fieldset>
        <fieldset class="bloque"><legend>Perfil de sabor</legend>
          <div class="chips">${checks("gustos", D.GUSTOS.map(g => [g.id, g.icono + " " + g.label]).concat(ETIQUETAS_EXTRA), v.gustos || [])}</div></fieldset>
        <fieldset class="bloque"><legend>Momento del día</legend>
          <div class="chips">${checks("momento", Object.entries(D.MOMENTOS), v.momento || [])}</div></fieldset>
        <label class="interruptor"><input type="checkbox" name="personalizable" ${v.personalizable ? "checked" : ""}><span>Bebida personalizable (tamaño, leche, extra shot)</span></label>
        <label class="interruptor"><input type="checkbox" name="disponible" ${v.disponible ? "checked" : ""}><span>Visible en el menú</span></label>
        <button class="btn btn-primario btn-bloque" type="submit">Guardar</button>
      </form>`;
    document.body.appendChild(capa);
    document.body.classList.add("sin-scroll");
    const cerrar = () => { capa.remove(); document.body.classList.remove("sin-scroll"); };
    capa.addEventListener("click", (e) => { if (e.target === capa || e.target.closest(".hoja-cerrar")) cerrar(); });
    $("form", capa).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const vals = (n) => $$(`input[name=${n}]:checked`, f).map(i => i.value);
      const datos = {
        nombre: f.nombre.value.trim(), descripcion: f.descripcion.value.trim(), categoria: f.categoria.value.trim(),
        emoji: f.emoji.value.trim() || "☕", precio: Number(f.precio.value), stock: Number(f.stock.value),
        alergenos: vals("alergenos"), gustos: vals("gustos"), momento: vals("momento"),
        personalizable: f.personalizable.checked, disponible: f.disponible.checked
      };
      if (p) datos.id = p.id;
      try { await api.guardarProducto(datos); cerrar(); toast("Producto guardado"); await alGuardar(); }
      catch (x) { toast(x.message, "error"); }
    });
    $("input[name=nombre]", capa).focus();
  }

  /* ================= sesión y modo kiosco ================= */
  async function salir() {
    detenerTiempoReal();
    S.avisosNuevos.clear(); actualizarContadorAvisos();
    await api.salir();
    S.sesion = null; S.carrito = []; S.mood = null; guardarCarrito();
    $$(".capa").forEach(c => c.remove());
    document.body.classList.remove("sin-scroll");
    if (location.hash === "#/login") enrutar(); else location.hash = "#/login";
  }
  $("#btn-salir").addEventListener("click", salir);
  window.addEventListener("hashchange", enrutar);

  if (S.kiosco) {
    document.body.classList.add("kiosco");
    // Cierra la sesión tras 90 s sin interacción para el siguiente cliente
    let inactivo;
    const reiniciar = () => {
      clearTimeout(inactivo);
      inactivo = setTimeout(() => { if (S.sesion) { salir(); toast("Sesión cerrada por inactividad"); } }, 90000);
    };
    ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, reiniciar));
    reiniciar();
  }

  (async function iniciar() {
    $("#banner-demo").hidden = api.modo !== "demo";
    cargarCarrito();
    app.innerHTML = `<p class="cargando">Cargando…</p>`;
    // Enlaces de Supabase (confirmar correo / recuperar contraseña) vuelven con datos en el hash
    const hashInicial = location.hash;
    try {
      S.sesion = await api.sesion();
      if (S.sesion) { await cargarDatos(); iniciarTiempoReal(); }
    } catch (e) {
      console.error(e);
      S.sesion = null;
    }
    if (/error_code=otp_expired|error=access_denied/.test(hashInicial)) {
      history.replaceState(null, "", location.pathname + location.search + "#/login");
      toast("El enlace expiró o ya se usó. Pide uno nuevo.", "error");
    } else if (/access_token|type=/.test(hashInicial)) {
      const destino = api.recuperando ? "#/nueva-clave" : "#/menu";
      history.replaceState(null, "", location.pathname + location.search + destino);
      if (!api.recuperando && S.sesion) toast("¡Correo confirmado! Bienvenido.");
    }
    enrutar();
  })();
})();
