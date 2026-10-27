// Capa de acceso a datos. La interfaz es la misma en los dos modos:
//   - SupabaseAPI: base de datos real (PostgreSQL + autenticación de Supabase)
//   - DemoAPI:     simulación en localStorage (para presentar sin configurar nada)
//
// Perfil:  { id, nombre, restricciones[], preferencias[], perfil_completo, rol }
// Pedido:  { id, usuario_id, cliente, canal, estado, mood, total, created_at,
//            items: [{ producto_id, nombre, cantidad, opciones, precio_unitario, recomendado }] }

(function () {
  const cfg = window.APP_CONFIG || {};
  const usarSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const D = window.dominio;

  // Validación del lado del servidor/capa de datos: nunca se confía solo en el formulario
  function validarRegistro(email, password, nombre) {
    const error = D.validarNombre(nombre) || D.validarEmail(email) || D.validarClave(password, { email, nombre });
    if (error) throw new Error(error);
  }

  /* ------------------------------------------------------------------ */
  /*  Modo Supabase                                                      */
  /* ------------------------------------------------------------------ */
  function SupabaseAPI() {
    const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const ITEMS = "pedido_items(producto_id, cantidad, opciones, precio_unitario, recomendado, productos(nombre))";

    const normalizar = (p) => ({
      id: p.id,
      usuario_id: p.usuario_id,
      cliente: p.profiles ? p.profiles.nombre : "",
      canal: p.canal,
      estado: p.estado,
      mood: p.mood,
      total: p.total,
      created_at: p.created_at,
      items: (p.pedido_items || []).map(it => ({
        producto_id: it.producto_id,
        nombre: it.productos ? it.productos.nombre : "Producto " + it.producto_id,
        cantidad: it.cantidad,
        opciones: it.opciones,
        precio_unitario: it.precio_unitario,
        recomendado: it.recomendado
      }))
    });

    const traducirError = (error) => {
      const m = (error && error.message) || String(error);
      if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
      if (/already registered/i.test(m)) return "Ese correo ya está registrado.";
      if (/Email not confirmed/i.test(m)) return "Debes confirmar tu correo antes de iniciar sesión.";
      if (/Password should be at least/i.test(m)) return "La contraseña es demasiado corta.";
      if (/Password should contain|weak.?password|pwned|leaked/i.test(m)) return "La contraseña no es segura o aparece en filtraciones conocidas. Elige otra.";
      if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      if (/invalid.*email|email.*invalid/i.test(m)) return "El correo no es válido.";
      return m;
    };
    const ok = ({ data, error }) => { if (error) throw new Error(traducirError(error)); return data; };

    async function perfil(user) {
      const data = ok(await db.from("profiles").select("*").eq("id", user.id).maybeSingle());
      return data || { id: user.id, nombre: user.email, restricciones: [], preferencias: [], perfil_completo: false, rol: "cliente" };
    }

    return {
      modo: "supabase",
      async sesion() {
        const { data } = await db.auth.getSession();
        if (!data.session) return null;
        const user = data.session.user;
        return { user: { id: user.id, email: user.email }, perfil: await perfil(user) };
      },
      async registrar(email, password, nombre) {
        validarRegistro(email, password, nombre);
        const data = ok(await db.auth.signUp({ email, password, options: { data: { nombre } } }));
        if (!data.session) throw new Error("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
        return this.sesion();
      },
      async ingresar(email, password) {
        ok(await db.auth.signInWithPassword({ email, password }));
        return this.sesion();
      },
      async salir() { await db.auth.signOut(); },
      async actualizarPerfil(id, cambios) {
        ok(await db.from("profiles").update(cambios).eq("id", id));
      },
      // El filtro de intolerancias se aplica en la base de datos (función menu_para_mi)
      async productos() {
        return ok(await db.rpc("menu_para_mi"));
      },
      async productosAdmin() {
        return ok(await db.from("productos").select("*").order("id"));
      },
      async guardarProducto(p) {
        const { id, ...datos } = p;
        if (id) ok(await db.from("productos").update(datos).eq("id", id));
        else ok(await db.from("productos").insert(datos));
      },
      async crearPedido(lineas, canal, mood) {
        const p_items = lineas.map(l => ({ producto_id: l.producto_id, cantidad: l.cantidad, opciones: l.opciones, recomendado: Boolean(l.recomendado) }));
        return ok(await db.rpc("crear_pedido", { p_items, p_canal: canal, p_mood: mood || null }));
      },
      async misPedidos(usuarioId) {
        const data = ok(await db.from("pedidos").select("*, " + ITEMS)
          .eq("usuario_id", usuarioId).order("created_at", { ascending: false }));
        return data.map(normalizar);
      },
      async todosLosPedidos() {
        const data = ok(await db.from("pedidos").select("*, profiles(nombre), " + ITEMS)
          .order("created_at", { ascending: false }).limit(300));
        return data.map(normalizar);
      },
      async cambiarEstado(id, estado) {
        ok(await db.from("pedidos").update({ estado }).eq("id", id));
      },
      async estadisticasGlobales() {
        const pop = ok(await db.rpc("productos_populares")) || [];
        const co = ok(await db.rpc("coocurrencias")) || [];
        const popularidad = {};
        pop.forEach(r => { popularidad[r.producto_id] = Number(r.veces); });
        return { popularidad, coocurrencias: co.map(r => ({ a: r.a, b: r.b, veces: Number(r.veces) })) };
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Modo demo (localStorage)                                           */
  /* ------------------------------------------------------------------ */
  function DemoAPI() {
    const K = "cafe_demo_v3";
    const leer = () => {
      try { const raw = localStorage.getItem(K); if (raw) return JSON.parse(raw); } catch (e) { /* sin almacenamiento */ }
      return null;
    };
    let estado = leer() || {
      usuarios: [
        { id: "demo-admin", email: "admin@demo.com", clave: "Barista#2026", nombre: "Administrador",
          restricciones: [], preferencias: [], perfil_completo: true, rol: "admin" },
        { id: "demo-cliente", email: "cliente@demo.com", clave: "Cliente#2026", nombre: "Cliente Demo",
          restricciones: [], preferencias: ["cafe", "dulce"], perfil_completo: true, rol: "cliente" }
      ],
      productos: window.PRODUCTOS_BASE.map(p => ({ ...p })),
      pedidos: window.generarPedidosDemo(),
      sesion: null
    };
    const guardar = () => { try { localStorage.setItem(K, JSON.stringify(estado)); } catch (e) { /* ignorar */ } };
    guardar();
    const espera = () => new Promise(r => setTimeout(r, 120));
    const actual = () => estado.usuarios.find(x => x.id === estado.sesion);
    const publico = (u) => ({
      user: { id: u.id, email: u.email },
      perfil: { id: u.id, nombre: u.nombre, restricciones: u.restricciones, preferencias: u.preferencias,
                perfil_completo: u.perfil_completo, rol: u.rol }
    });
    const copia = (x) => JSON.parse(JSON.stringify(x));

    return {
      modo: "demo",
      async sesion() { const u = actual(); return u ? publico(u) : null; },
      async registrar(email, password, nombre) {
        await espera();
        email = email.trim().toLowerCase();
        validarRegistro(email, password, nombre);   // el "servidor" vuelve a validar
        if (estado.usuarios.some(u => u.email === email)) throw new Error("Ese correo ya está registrado.");
        const u = { id: "u-" + Date.now(), email, clave: password, nombre, restricciones: [], preferencias: [],
                    perfil_completo: false, rol: "cliente" };
        estado.usuarios.push(u);
        estado.sesion = u.id;
        guardar();
        return publico(u);
      },
      async ingresar(email, password) {
        await espera();
        const u = estado.usuarios.find(x => x.email === email.trim().toLowerCase() && x.clave === password);
        if (!u) throw new Error("Correo o contraseña incorrectos.");
        estado.sesion = u.id;
        guardar();
        return publico(u);
      },
      async salir() { estado.sesion = null; guardar(); },
      async actualizarPerfil(id, cambios) {
        Object.assign(estado.usuarios.find(x => x.id === id), cambios);
        guardar();
      },
      // Igual que menu_para_mi() en SQL: solo productos disponibles y compatibles con el perfil
      async productos() {
        const u = actual();
        return copia(estado.productos.filter(p => p.disponible && D.esCompatible(p, u ? u.restricciones : [])));
      },
      async productosAdmin() { return copia(estado.productos); },
      async guardarProducto(p) {
        if (p.id) Object.assign(estado.productos.find(x => x.id === p.id), p);
        else estado.productos.push({ ...p, id: Math.max(...estado.productos.map(x => x.id)) + 1 });
        guardar();
      },
      async crearPedido(lineas, canal, mood) {
        await espera();
        const u = actual();
        const items = lineas.map(l => {
          const p = estado.productos.find(x => x.id === l.producto_id);
          if (!p || !p.disponible) throw new Error("Un producto ya no está disponible.");
          if (!D.esCompatible(p, u.restricciones)) throw new Error(p.nombre + " no es compatible con tus restricciones.");
          if (p.stock < l.cantidad) throw new Error("No hay suficiente stock de " + p.nombre + ".");
          return { producto_id: p.id, nombre: p.nombre, cantidad: l.cantidad, opciones: p.personalizable ? l.opciones : null,
                   precio_unitario: D.precioUnitario(p, l.opciones), recomendado: Boolean(l.recomendado) };
        });
        items.forEach(it => { estado.productos.find(x => x.id === it.producto_id).stock -= it.cantidad; });
        const pedido = {
          id: Math.max(0, ...estado.pedidos.map(p => p.id)) + 1,
          usuario_id: u.id, cliente: u.nombre, canal, mood: mood || null, estado: "pendiente",
          total: items.reduce((s, l) => s + l.precio_unitario * l.cantidad, 0),
          created_at: new Date().toISOString(), items
        };
        estado.pedidos.push(pedido);
        guardar();
        return pedido.id;
      },
      async misPedidos(usuarioId) {
        return copia(estado.pedidos.filter(p => p.usuario_id === usuarioId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)));
      },
      async todosLosPedidos() {
        return copia(estado.pedidos.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
      },
      async cambiarEstado(id, nuevo) {
        const p = estado.pedidos.find(x => x.id === id);
        if (p) { p.estado = nuevo; guardar(); }
      },
      async estadisticasGlobales() {
        const popularidad = {};
        const pares = {};
        estado.pedidos.forEach(p => {
          const ids = [...new Set(p.items.map(i => i.producto_id))];
          ids.forEach(id => { popularidad[id] = (popularidad[id] || 0) + 1; });
          ids.forEach(a => ids.forEach(b => { if (a !== b) pares[a + "-" + b] = (pares[a + "-" + b] || 0) + 1; }));
        });
        const coocurrencias = Object.entries(pares).map(([k, veces]) => {
          const [a, b] = k.split("-").map(Number);
          return { a, b, veces };
        });
        return { popularidad, coocurrencias };
      }
    };
  }

  window.api = usarSupabase ? SupabaseAPI() : DemoAPI();
})();
