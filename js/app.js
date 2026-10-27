// Interfaz de usuario: enrutador por hash (#/menu, #/carrito, ...) y vistas.
(function () {
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const app = $("#app");
  const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const dinero = (n) => pesos.format(n || 0);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

  const RESTRICCIONES = [
    ["vegano", "Vegano"], ["sin_lactosa", "Sin lactosa"], ["sin_gluten", "Sin gluten"], ["sin_azucar", "Sin azúcar"]
  ];
  const ANTOJOS = [["dulce", "🍬 Algo dulce"], ["salado", "🥨 Algo salado"], ["energia", "⚡ Energía"], ["ligero", "🌿 Algo ligero"]];
  const ESTADOS = [["pendiente", "Pendiente"], ["preparando", "Preparando"], ["listo", "Listo"], ["entregado", "Entregado"]];

  const S = {
    sesion: null,
    productos: [],
    misPedidos: [],
    globales: { popularidad: {}, coocurrencias: [] },
    carrito: [],
    antojo: null,
    categoria: "Todas",
    busqueda: "",
    filtroAdmin: "activos",
    temporizador: null
  };

  /* ---------------- utilidades ---------------- */
  function toast(msg, tipo = "ok") {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast " + tipo;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2800);
  }
  const guardarCarrito = () => { try { localStorage.setItem("cafe_carrito", JSON.stringify(S.carrito)); } catch (e) { /* ignorar */ } };
  const cargarCarrito = () => { try { S.carrito = JSON.parse(localStorage.getItem("cafe_carrito")) || []; } catch (e) { S.carrito = []; } };
  const cantidadCarrito = () => S.carrito.reduce((s, i) => s + i.cantidad, 0);
  const producto = (id) => S.productos.find(p => p.id === id);
  const esAdmin = () => S.sesion && S.sesion.perfil.rol === "admin";

  function agregar(id) {
    const linea = S.carrito.find(i => i.producto_id === id);
    if (linea) linea.cantidad++; else S.carrito.push({ producto_id: id, cantidad: 1 });
    guardarCarrito();
    pintarNavegacion();
    toast(producto(id).nombre + " agregado al carrito");
  }

  async function cargarDatos() {
    const [productos, misPedidos, globales] = await Promise.all([
      api.productos(),
      api.misPedidos(S.sesion.user.id),
      api.estadisticasGlobales().catch(() => ({ popularidad: {}, coocurrencias: [] }))
    ]);
    S.productos = productos;
    S.misPedidos = misPedidos;
    S.globales = globales;
    S.carrito = S.carrito.filter(i => producto(i.producto_id));
  }

  /* ---------------- navegación ---------------- */
  function pintarNavegacion() {
    const logueado = Boolean(S.sesion);
    $("#topbar").hidden = !logueado;
    $("#nav-movil").hidden = !logueado;
    if (!logueado) return;
    const ruta = location.hash.replace("#/", "") || "menu";
    const enlaces = [
      ["menu", "🏠", "Menú"],
      ["carrito", "🛒", "Carrito", cantidadCarrito()],
      ["pedidos", "🧾", "Pedidos"],
      ["perfil", "👤", "Perfil"]
    ];
    if (esAdmin()) enlaces.push(["admin", "📊", "Admin"]);
    const html = enlaces.map(([r, ico, txt, badge]) =>
      `<a href="#/${r}" class="${ruta === r ? "activo" : ""}" ${ruta === r ? 'aria-current="page"' : ""}>
        <span class="ico" aria-hidden="true">${ico}</span><span>${txt}</span>
        ${badge ? `<span class="badge">${badge}</span>` : ""}
      </a>`).join("");
    $("#nav-escritorio").innerHTML = html;
    $("#nav-movil").innerHTML = html;
  }

  async function enrutar() {
    clearInterval(S.temporizador);
    const ruta = location.hash.replace("#/", "") || "menu";
    if (!S.sesion && ruta !== "login") { location.hash = "#/login"; return; }
    if (S.sesion && ruta === "login") { location.hash = "#/menu"; return; }
    pintarNavegacion();
    window.scrollTo(0, 0);
    const vistas = { login: vistaLogin, menu: vistaMenu, carrito: vistaCarrito, pedidos: vistaPedidos, perfil: vistaPerfil, admin: vistaAdmin };
    const vista = vistas[ruta] || vistaMenu;
    if (ruta === "admin" && !esAdmin()) { location.hash = "#/menu"; return; }
    try {
      await vista();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<section class="vacio"><p>Ocurrió un error: ${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></section>`;
    }
  }

  /* ---------------- vista: login ---------------- */
  function vistaLogin() {
    app.innerHTML = `
      <section class="login">
        <div class="login-hero">
          <img src="img/icono.svg" alt="" width="64" height="64">
          <h1>${esc(window.APP_CONFIG.NOMBRE_NEGOCIO)}</h1>
          <p>Pide más rápido. Recibe sugerencias según tus gustos, tus restricciones y el momento del día.</p>
        </div>
        <div class="tarjeta login-caja">
          <div class="tabs" role="tablist">
            <button role="tab" class="tab activo" data-tab="ingresar" aria-selected="true">Iniciar sesión</button>
            <button role="tab" class="tab" data-tab="registro" aria-selected="false">Crear cuenta</button>
          </div>
          <form id="form-auth" novalidate>
            <label class="campo" id="campo-nombre" hidden>Nombre
              <input name="nombre" autocomplete="name" placeholder="Tu nombre">
            </label>
            <label class="campo">Correo electrónico
              <input name="email" type="email" autocomplete="email" required placeholder="tucorreo@ejemplo.com">
            </label>
            <label class="campo">Contraseña
              <input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="Mínimo 6 caracteres">
            </label>
            <p class="error" id="error-auth" role="alert" hidden></p>
            <button class="btn btn-primario btn-bloque" type="submit" id="btn-auth">Ingresar</button>
          </form>
          ${api.modo === "demo" ? `
          <div class="cuentas-demo">
            <p>Cuentas de prueba:</p>
            <button class="chip" data-demo="cliente@demo.com|cliente123">Cliente</button>
            <button class="chip" data-demo="admin@demo.com|admin123">Administrador</button>
          </div>` : ""}
        </div>
      </section>`;

    let modo = "ingresar";
    const form = $("#form-auth");
    app.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
      modo = b.dataset.tab;
      app.querySelectorAll(".tab").forEach(x => { x.classList.toggle("activo", x === b); x.setAttribute("aria-selected", x === b); });
      $("#campo-nombre").hidden = modo !== "registro";
      form.password.autocomplete = modo === "registro" ? "new-password" : "current-password";
      $("#btn-auth").textContent = modo === "registro" ? "Crear cuenta" : "Ingresar";
      $("#error-auth").hidden = true;
    }));
    app.querySelectorAll("[data-demo]").forEach(b => b.addEventListener("click", () => {
      const [e, p] = b.dataset.demo.split("|");
      form.email.value = e; form.password.value = p;
      form.requestSubmit();
    }));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const err = $("#error-auth");
      const email = form.email.value.trim();
      const password = form.password.value;
      const nombre = form.nombre.value.trim();
      err.hidden = true;
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Escribe un correo válido."; err.hidden = false; return; }
      if (password.length < 6) { err.textContent = "La contraseña debe tener al menos 6 caracteres."; err.hidden = false; return; }
      if (modo === "registro" && !nombre) { err.textContent = "Escribe tu nombre."; err.hidden = false; return; }
      const btn = $("#btn-auth");
      btn.disabled = true; btn.textContent = "Un momento…";
      try {
        S.sesion = modo === "registro" ? await api.registrar(email, password, nombre) : await api.ingresar(email, password);
        await cargarDatos();
        location.hash = "#/menu";
        toast("¡Hola, " + S.sesion.perfil.nombre + "!");
      } catch (e) {
        err.textContent = e.message; err.hidden = false;
        btn.disabled = false; btn.textContent = modo === "registro" ? "Crear cuenta" : "Ingresar";
      }
    });
  }

  /* ---------------- vista: menú ---------------- */
  function tarjetaProducto(p, motivo) {
    const etiquetas = (p.etiquetas || []).filter(e => RESTRICCIONES.some(r => r[0] === e))
      .map(e => `<span class="etq">${esc(RESTRICCIONES.find(r => r[0] === e)[1])}</span>`).join("");
    return `
      <article class="producto">
        <div class="producto-img" aria-hidden="true">${esc(p.emoji || "☕")}</div>
        <div class="producto-cuerpo">
          ${motivo ? `<p class="motivo">✨ ${esc(motivo)}</p>` : ""}
          <h3>${esc(p.nombre)}</h3>
          <p class="desc">${esc(p.descripcion || "")}</p>
          <div class="etqs">${etiquetas}</div>
          <div class="producto-pie">
            <strong>${dinero(p.precio)}</strong>
            <button class="btn btn-primario btn-sm" data-agregar="${p.id}" aria-label="Agregar ${esc(p.nombre)}">Agregar</button>
          </div>
        </div>
      </article>`;
  }

  function vistaMenu() {
    const perfil = S.sesion.perfil;
    const recs = recomendador.recomendar({
      productos: S.productos, misPedidos: S.misPedidos, globales: S.globales,
      restricciones: perfil.restricciones, antojo: S.antojo, limite: 4
    });
    const categorias = ["Todas", ...new Set(S.productos.map(p => p.categoria))];
    const q = S.busqueda.toLowerCase();
    const lista = S.productos
      .filter(p => S.categoria === "Todas" || p.categoria === S.categoria)
      .filter(p => !q || p.nombre.toLowerCase().includes(q) || (p.descripcion || "").toLowerCase().includes(q));
    const saludo = { manana: "Buenos días", tarde: "Buenas tardes", noche: "Buenas noches" }[recomendador.momentoDelDia()];

    app.innerHTML = `
      <section class="encabezado">
        <h1>${saludo}, ${esc(perfil.nombre.split(" ")[0])}</h1>
        <p class="sub">¿Qué se te antoja hoy? <span class="opcional">(opcional, mejora tus sugerencias)</span></p>
        <div class="chips" role="group" aria-label="Antojo">
          ${ANTOJOS.map(([k, t]) => `<button class="chip ${S.antojo === k ? "activo" : ""}" data-antojo="${k}" aria-pressed="${S.antojo === k}">${t}</button>`).join("")}
        </div>
      </section>

      <section>
        <div class="titulo-seccion">
          <h2>Recomendado para ti</h2>
          ${perfil.restricciones.length ? `<span class="nota">Filtrado: ${perfil.restricciones.map(r => esc(RESTRICCIONES.find(x => x[0] === r)?.[1] || r)).join(", ")}</span>` : ""}
        </div>
        ${recs.length
          ? `<div class="carrusel">${recs.map(r => tarjetaProducto(r.producto, r.motivo)).join("")}</div>`
          : `<p class="vacio-mini">No hay productos que cumplan todas tus restricciones. Ajusta tu <a href="#/perfil">perfil</a>.</p>`}
      </section>

      <section>
        <div class="titulo-seccion"><h2>Menú</h2></div>
        <input class="buscador" type="search" placeholder="Buscar producto…" value="${esc(S.busqueda)}" aria-label="Buscar producto">
        <div class="chips desplazable" role="group" aria-label="Categorías">
          ${categorias.map(c => `<button class="chip ${S.categoria === c ? "activo" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
        <div class="grid" id="grid-productos">
          ${lista.map(p => tarjetaProducto(p)).join("") || `<p class="vacio-mini">Sin resultados.</p>`}
        </div>
      </section>

      ${cantidadCarrito() ? `<a href="#/carrito" class="flotante">🛒 Ver carrito · ${cantidadCarrito()}</a>` : ""}`;

    app.querySelectorAll("[data-antojo]").forEach(b => b.addEventListener("click", () => {
      S.antojo = S.antojo === b.dataset.antojo ? null : b.dataset.antojo;
      vistaMenu();
    }));
    app.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => { S.categoria = b.dataset.cat; vistaMenu(); }));
    const buscador = $(".buscador", app);
    buscador.addEventListener("input", () => {
      S.busqueda = buscador.value;
      const qq = S.busqueda.toLowerCase();
      const l = S.productos
        .filter(p => S.categoria === "Todas" || p.categoria === S.categoria)
        .filter(p => !qq || p.nombre.toLowerCase().includes(qq) || (p.descripcion || "").toLowerCase().includes(qq));
      $("#grid-productos").innerHTML = l.map(p => tarjetaProducto(p)).join("") || `<p class="vacio-mini">Sin resultados.</p>`;
    });
    app.addEventListener("click", manejarAgregar);
  }

  function manejarAgregar(ev) {
    const b = ev.target.closest("[data-agregar]");
    if (!b) return;
    agregar(Number(b.dataset.agregar));
    const f = $(".flotante", app);
    if (location.hash.includes("menu")) {
      if (f) f.textContent = "🛒 Ver carrito · " + cantidadCarrito();
      else app.insertAdjacentHTML("beforeend", `<a href="#/carrito" class="flotante">🛒 Ver carrito · ${cantidadCarrito()}</a>`);
    } else {
      vistaCarrito();
    }
  }

  /* ---------------- vista: carrito ---------------- */
  function vistaCarrito() {
    app.removeEventListener("click", manejarAgregar);
    const lineas = S.carrito.map(i => ({ ...i, p: producto(i.producto_id) })).filter(l => l.p);
    const total = lineas.reduce((s, l) => s + l.p.precio * l.cantidad, 0);
    const combina = lineas.length ? recomendador.recomendar({
      productos: S.productos, misPedidos: S.misPedidos, globales: S.globales,
      restricciones: S.sesion.perfil.restricciones, antojo: S.antojo,
      carrito: lineas.map(l => l.producto_id), limite: 3
    }) : [];
    const canalGuardado = (() => { try { return localStorage.getItem("cafe_canal") || "movil"; } catch (e) { return "movil"; } })();

    app.innerHTML = `
      <section class="encabezado"><h1>Tu carrito</h1></section>
      ${lineas.length ? `
        <div class="carrito-layout">
          <div class="tarjeta">
            <ul class="lineas">
              ${lineas.map(l => `
                <li class="linea">
                  <span class="linea-emoji" aria-hidden="true">${esc(l.p.emoji)}</span>
                  <div class="linea-info"><strong>${esc(l.p.nombre)}</strong><span>${dinero(l.p.precio)}</span></div>
                  <div class="cantidad">
                    <button class="btn-redondo" data-menos="${l.producto_id}" aria-label="Quitar uno">−</button>
                    <span aria-live="polite">${l.cantidad}</span>
                    <button class="btn-redondo" data-mas="${l.producto_id}" aria-label="Agregar uno">+</button>
                  </div>
                </li>`).join("")}
            </ul>
          </div>
          <aside class="tarjeta resumen">
            <label class="campo">¿Desde dónde pides?
              <select id="canal">
                <option value="movil" ${canalGuardado === "movil" ? "selected" : ""}>📱 Mi celular</option>
                <option value="kiosco" ${canalGuardado === "kiosco" ? "selected" : ""}>🖥️ Kiosco de autoservicio</option>
              </select>
            </label>
            <div class="total"><span>Total</span><strong>${dinero(total)}</strong></div>
            <button class="btn btn-primario btn-bloque" id="btn-pedir">Confirmar pedido</button>
          </aside>
        </div>
        ${combina.length ? `
          <section>
            <div class="titulo-seccion"><h2>Combina bien con tu pedido</h2></div>
            <div class="carrusel">${combina.map(r => tarjetaProducto(r.producto, r.motivo)).join("")}</div>
          </section>` : ""}
      ` : `<section class="vacio"><p>Tu carrito está vacío.</p><a class="btn btn-primario" href="#/menu">Ver el menú</a></section>`}`;

    app.querySelectorAll("[data-mas]").forEach(b => b.addEventListener("click", () => {
      S.carrito.find(i => i.producto_id === Number(b.dataset.mas)).cantidad++;
      guardarCarrito(); pintarNavegacion(); vistaCarrito();
    }));
    app.querySelectorAll("[data-menos]").forEach(b => b.addEventListener("click", () => {
      const l = S.carrito.find(i => i.producto_id === Number(b.dataset.menos));
      l.cantidad--;
      if (l.cantidad <= 0) S.carrito = S.carrito.filter(i => i !== l);
      guardarCarrito(); pintarNavegacion(); vistaCarrito();
    }));
    app.addEventListener("click", manejarAgregar);
    const btn = $("#btn-pedir");
    if (btn) btn.addEventListener("click", async () => {
      const canal = $("#canal").value;
      try { localStorage.setItem("cafe_canal", canal); } catch (e) { /* ignorar */ }
      btn.disabled = true; btn.textContent = "Enviando…";
      try {
        const id = await api.crearPedido(S.carrito, canal);
        S.carrito = []; guardarCarrito();
        S.misPedidos = await api.misPedidos(S.sesion.user.id);
        S.globales = await api.estadisticasGlobales().catch(() => S.globales);
        toast("Pedido #" + id + " enviado. Te avisaremos cuando esté listo.");
        location.hash = "#/pedidos";
      } catch (e) {
        toast(e.message, "error");
        btn.disabled = false; btn.textContent = "Confirmar pedido";
      }
    });
  }

  /* ---------------- vista: mis pedidos ---------------- */
  const pildora = (estado) => `<span class="pildora ${estado}">${esc((ESTADOS.find(e => e[0] === estado) || [0, estado])[1])}</span>`;

  async function vistaPedidos() {
    app.removeEventListener("click", manejarAgregar);
    app.innerHTML = `<section class="encabezado"><h1>Mis pedidos</h1></section><p class="cargando">Cargando…</p>`;
    S.misPedidos = await api.misPedidos(S.sesion.user.id);
    const pintar = () => {
      app.innerHTML = `
        <section class="encabezado"><h1>Mis pedidos</h1></section>
        ${S.misPedidos.length ? `<div class="lista-pedidos">${S.misPedidos.map(p => `
          <article class="tarjeta pedido">
            <header><strong>Pedido #${p.id}</strong>${pildora(p.estado)}</header>
            <p class="meta">${fecha(p.created_at)} · ${p.canal === "kiosco" ? "Kiosco" : "Celular"}</p>
            <ul>${p.items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)}</li>`).join("")}</ul>
            <footer><span>Total</span><strong>${dinero(p.total)}</strong></footer>
          </article>`).join("")}</div>`
          : `<section class="vacio"><p>Aún no has hecho pedidos.</p><a class="btn btn-primario" href="#/menu">Hacer mi primer pedido</a></section>`}`;
    };
    pintar();
    // Actualiza el estado de los pedidos cada 20 s mientras estés en esta vista
    S.temporizador = setInterval(async () => {
      try { S.misPedidos = await api.misPedidos(S.sesion.user.id); pintar(); } catch (e) { /* reintentar luego */ }
    }, 20000);
  }

  /* ---------------- vista: perfil ---------------- */
  function vistaPerfil() {
    app.removeEventListener("click", manejarAgregar);
    const p = S.sesion.perfil;
    const totalGastado = S.misPedidos.reduce((s, x) => s + x.total, 0);
    const conteo = {};
    S.misPedidos.forEach(x => x.items.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad; }));
    const favorito = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];

    app.innerHTML = `
      <section class="encabezado"><h1>Mi perfil</h1><p class="sub">${esc(S.sesion.user.email)}</p></section>
      <div class="stats">
        <div class="stat"><span>Pedidos</span><strong>${S.misPedidos.length}</strong></div>
        <div class="stat"><span>Total consumido</span><strong>${dinero(totalGastado)}</strong></div>
        <div class="stat"><span>Tu favorito</span><strong>${favorito ? esc(favorito[0]) : "—"}</strong></div>
      </div>
      <form class="tarjeta" id="form-perfil">
        <label class="campo">Nombre <input name="nombre" value="${esc(p.nombre)}" required></label>
        <fieldset class="campo">
          <legend>Restricciones alimentarias</legend>
          <p class="ayuda">Solo te recomendaremos productos que las cumplan.</p>
          <div class="checks">
            ${RESTRICCIONES.map(([k, t]) => `
              <label class="check"><input type="checkbox" name="r" value="${k}" ${p.restricciones.includes(k) ? "checked" : ""}> ${t}</label>`).join("")}
          </div>
        </fieldset>
        <p class="ayuda">Tus datos se usan solo para personalizar tus sugerencias (Ley 1581 de 2012 de protección de datos personales).</p>
        <button class="btn btn-primario" type="submit">Guardar cambios</button>
      </form>`;

    $("#form-perfil").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const cambios = {
        nombre: f.nombre.value.trim() || p.nombre,
        restricciones: [...f.querySelectorAll("input[name=r]:checked")].map(i => i.value)
      };
      try {
        await api.actualizarPerfil(p.id, cambios);
        Object.assign(S.sesion.perfil, cambios);
        toast("Perfil actualizado");
      } catch (e) { toast(e.message, "error"); }
    });
  }

  /* ---------------- vista: administrador ---------------- */
  async function vistaAdmin() {
    app.removeEventListener("click", manejarAgregar);
    app.innerHTML = `<section class="encabezado"><h1>Panel de administración</h1></section><p class="cargando">Cargando…</p>`;
    let pedidos = await api.todosLosPedidos();

    const pintar = () => {
      const hoy = new Date().toDateString();
      const deHoy = pedidos.filter(p => new Date(p.created_at).toDateString() === hoy);
      const activos = pedidos.filter(p => p.estado !== "entregado");
      const conteo = {};
      pedidos.forEach(p => p.items.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad; }));
      const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const maxTop = top.length ? top[0][1] : 1;
      const kiosco = pedidos.filter(p => p.canal === "kiosco").length;
      const visibles = S.filtroAdmin === "activos" ? activos : pedidos;

      app.innerHTML = `
        <section class="encabezado"><h1>Panel de administración</h1></section>
        <div class="stats">
          <div class="stat"><span>Pedidos hoy</span><strong>${deHoy.length}</strong></div>
          <div class="stat"><span>Ventas hoy</span><strong>${dinero(deHoy.reduce((s, p) => s + p.total, 0))}</strong></div>
          <div class="stat"><span>En curso</span><strong>${activos.length}</strong></div>
          <div class="stat"><span>Desde kiosco</span><strong>${pedidos.length ? Math.round(kiosco / pedidos.length * 100) : 0}%</strong></div>
        </div>

        <div class="admin-layout">
          <section>
            <div class="titulo-seccion">
              <h2>Pedidos</h2>
              <div class="chips">
                <button class="chip ${S.filtroAdmin === "activos" ? "activo" : ""}" data-filtro="activos">En curso</button>
                <button class="chip ${S.filtroAdmin === "todos" ? "activo" : ""}" data-filtro="todos">Todos</button>
                <button class="chip" id="btn-refrescar" aria-label="Actualizar">↻</button>
              </div>
            </div>
            <div class="lista-pedidos">
              ${visibles.map(p => `
                <article class="tarjeta pedido">
                  <header><strong>#${p.id} · ${esc(p.cliente || "Cliente")}</strong>${pildora(p.estado)}</header>
                  <p class="meta">${fecha(p.created_at)} · ${p.canal === "kiosco" ? "Kiosco" : "Celular"}</p>
                  <ul>${p.items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)}</li>`).join("")}</ul>
                  <footer>
                    <strong>${dinero(p.total)}</strong>
                    <select data-estado="${p.id}" aria-label="Estado del pedido ${p.id}">
                      ${ESTADOS.map(([k, t]) => `<option value="${k}" ${p.estado === k ? "selected" : ""}>${t}</option>`).join("")}
                    </select>
                  </footer>
                </article>`).join("") || `<p class="vacio-mini">No hay pedidos en curso.</p>`}
            </div>
          </section>
          <aside class="tarjeta">
            <h2>Productos más vendidos</h2>
            <ul class="barras">
              ${top.map(([n, c]) => `
                <li><span class="barra-nombre">${esc(n)}</span>
                  <span class="barra"><span style="width:${(c / maxTop * 100).toFixed(0)}%"></span></span>
                  <span class="barra-valor">${c}</span></li>`).join("") || "<li>Sin datos</li>"}
            </ul>
          </aside>
        </div>`;

      app.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => { S.filtroAdmin = b.dataset.filtro; pintar(); }));
      $("#btn-refrescar").addEventListener("click", refrescar);
      app.querySelectorAll("[data-estado]").forEach(sel => sel.addEventListener("change", async () => {
        try {
          await api.cambiarEstado(Number(sel.dataset.estado), sel.value);
          pedidos.find(p => p.id === Number(sel.dataset.estado)).estado = sel.value;
          toast("Pedido #" + sel.dataset.estado + " → " + sel.options[sel.selectedIndex].text);
          pintar();
        } catch (e) { toast(e.message, "error"); }
      }));
    };
    const refrescar = async () => { try { pedidos = await api.todosLosPedidos(); pintar(); } catch (e) { /* ignorar */ } };
    pintar();
    S.temporizador = setInterval(refrescar, 15000);
  }

  /* ---------------- arranque ---------------- */
  $("#btn-salir").addEventListener("click", async () => {
    await api.salir();
    S.sesion = null; S.carrito = []; guardarCarrito();
    location.hash = "#/login";
  });
  window.addEventListener("hashchange", enrutar);

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
