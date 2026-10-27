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
    temporizador: null,
    kiosco: new URLSearchParams(location.search).get("modo") === "kiosco"
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
    let enlaces = [
      ["menu", "🏠", "Menú"],
      ["carrito", "🛒", "Carrito", cantidadCarrito()],
      ["pedidos", "🧾", "Pedidos"],
      ["perfil", "👤", "Perfil"]
    ];
    if (esAdmin()) enlaces.push(["admin", "📊", "Cafetería"]);
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
    $$(".capa").forEach(c => c.remove());
    document.body.classList.remove("sin-scroll");
    const ruta = rutaActual();
    if (!S.sesion && ruta !== "login") { location.hash = "#/login"; return; }
    if (S.sesion && ruta === "login") { location.hash = "#/menu"; return; }
    if (S.sesion && !perfil().perfil_completo && !esAdmin() && ruta !== "bienvenida") { location.hash = "#/bienvenida"; return; }
    if (ruta === "admin" && !esAdmin()) { location.hash = "#/menu"; return; }
    if (S.kiosco && ["pedidos", "perfil", "admin"].includes(ruta)) { location.hash = "#/menu"; return; }
    pintarNavegacion();
    window.scrollTo(0, 0);
    const vistas = { login: vistaLogin, bienvenida: vistaBienvenida, menu: vistaMenu, carrito: vistaCarrito,
                     pedidos: vistaPedidos, perfil: vistaPerfil, admin: vistaAdmin };
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
        location.hash = "#/menu";
        toast("¡Hola, " + perfil().nombre.split(" ")[0] + "!");
      } catch (e) {
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
      </div>`;
    document.body.appendChild(capa);
    const ok = $("#conf-ok", capa);
    ok.focus();
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
          </article>`).join("")}</div>`
          : `<section class="vacio"><p>Aún no has hecho pedidos.</p><a class="btn btn-primario" href="#/menu">Hacer mi primer pedido</a></section>`}`;
    };
    pintar();
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
    app.innerHTML = `<section class="encabezado"><h1>Dashboard de la cafetería</h1></section><p class="cargando">Cargando…</p>`;
    let pedidos = await api.todosLosPedidos();
    let catalogo = await api.productosAdmin();

    const barras = (pares) => {
      const max = Math.max(1, ...pares.map(x => x[1]));
      return `<ul class="barras">${pares.map(([n, c]) => `
        <li><span class="barra-nombre">${n}</span><span class="barra-valor">${c}</span>
          <span class="barra"><span style="width:${(c / max * 100).toFixed(0)}%"></span></span></li>`).join("") || "<li>Sin datos</li>"}</ul>`;
    };

    const tabPedidos = () => {
      const activos = pedidos.filter(p => p.estado !== "entregado");
      const visibles = S.filtroAdmin === "activos" ? activos : pedidos;
      return `
        <div class="titulo-seccion">
          <h2>Pedidos entrantes</h2>
          <div class="chips">
            <button class="chip ${S.filtroAdmin === "activos" ? "activo" : ""}" data-filtro="activos">En curso (${activos.length})</button>
            <button class="chip ${S.filtroAdmin === "todos" ? "activo" : ""}" data-filtro="todos">Todos</button>
            <button class="chip" data-refrescar aria-label="Actualizar">↻</button>
          </div>
        </div>
        <div class="lista-pedidos">
          ${visibles.map(p => `
            <article class="tarjeta pedido ${p.estado}">
              <header><strong>#${p.id} · ${esc(p.cliente || "Cliente")}</strong>${pildora(p.estado)}</header>
              <p class="meta">${metaPedido(p)}</p>
              ${itemsHTML(p.items)}
              <footer>
                <strong>${dinero(p.total)}</strong>
                <select data-estado="${p.id}" aria-label="Estado del pedido ${p.id}">
                  ${ESTADOS.map(([k, t]) => `<option value="${k}" ${p.estado === k ? "selected" : ""}>${t}</option>`).join("")}
                </select>
              </footer>
            </article>`).join("") || `<p class="vacio-mini">No hay pedidos en curso.</p>`}
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

    const tabIndicadores = () => {
      const hoy = new Date().toDateString();
      const deHoy = pedidos.filter(p => new Date(p.created_at).toDateString() === hoy);
      const ventasHoy = deHoy.reduce((s, p) => s + p.total, 0);
      const ticket = pedidos.length ? pedidos.reduce((s, p) => s + p.total, 0) / pedidos.length : 0;
      const kiosco = pedidos.filter(p => p.canal === "kiosco").length;
      const conRec = pedidos.filter(p => p.items.some(i => i.recomendado)).length;
      const conMood = pedidos.filter(p => p.mood).length;
      const conteo = {};
      pedidos.forEach(p => p.items.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad; }));
      const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => [esc(n), c]);
      const moods = D.MOODS.map(m => [m.icono + " " + m.label, pedidos.filter(p => p.mood === m.id).length]);
      const franjas = Object.entries(D.MOMENTOS).map(([k, v]) => [v[0].toUpperCase() + v.slice(1),
        pedidos.filter(p => R.momentoDelDia(new Date(p.created_at)) === k).length]);
      const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "0%";
      return `
        <div class="stats">
          <div class="stat"><span>Pedidos hoy</span><strong>${deHoy.length}</strong></div>
          <div class="stat"><span>Ventas hoy</span><strong>${dinero(ventasHoy)}</strong></div>
          <div class="stat"><span>Ticket promedio</span><strong>${dinero(ticket)}</strong></div>
          <div class="stat"><span>Desde kiosco</span><strong>${pct(kiosco, pedidos.length)}</strong></div>
          <div class="stat destacado"><span>Aceptación de recomendaciones</span><strong>${pct(conRec, pedidos.length)}</strong><small>Pedidos con al menos un producto sugerido</small></div>
          <div class="stat"><span>Clientes que comparten su mood</span><strong>${pct(conMood, pedidos.length)}</strong></div>
        </div>
        <div class="paneles">
          <div class="tarjeta"><h2>Más vendidos</h2>${barras(top)}</div>
          <div class="tarjeta"><h2>Mood de los clientes</h2>${barras(moods)}</div>
          <div class="tarjeta"><h2>Pedidos por franja</h2>${barras(franjas)}</div>
        </div>`;
    };

    const pintar = () => {
      const tabs = [["pedidos", "🧾 Pedidos"], ["menu", "📦 Menú e inventario"], ["indicadores", "📈 Indicadores"]];
      app.innerHTML = `
        <section class="encabezado"><h1>Dashboard de la cafetería</h1>
          <p class="sub">Gestión de productos, control de pedidos y administración del menú.</p></section>
        <div class="tabs tabs-admin" role="tablist">
          ${tabs.map(([k, t]) => `<button role="tab" class="tab ${S.adminTab === k ? "activo" : ""}" data-tab="${k}" aria-selected="${S.adminTab === k}">${t}</button>`).join("")}
        </div>
        <section>${S.adminTab === "pedidos" ? tabPedidos() : S.adminTab === "menu" ? tabMenu() : tabIndicadores()}</section>`;

      $$("[data-tab]", app).forEach(b => b.addEventListener("click", () => { S.adminTab = b.dataset.tab; pintar(); }));
      $$("[data-filtro]", app).forEach(b => b.addEventListener("click", () => { S.filtroAdmin = b.dataset.filtro; pintar(); }));
      $$("[data-refrescar]", app).forEach(b => b.addEventListener("click", refrescar));
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
    try {
      S.sesion = await api.sesion();
      if (S.sesion) await cargarDatos();
    } catch (e) {
      console.error(e);
      S.sesion = null;
    }
    enrutar();
  })();
})();
