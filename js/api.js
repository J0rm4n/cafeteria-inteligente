// Capa de acceso a datos. La interfaz es la misma en los dos modos:
//   - SupabaseAPI: base de datos real (PostgreSQL + autenticación de Supabase)
//   - DemoAPI:     simulación en localStorage (para presentar sin configurar nada)
//
// Formato normalizado de un pedido:
// { id, usuario_id, cliente, canal, estado, total, created_at,
//   items: [{ producto_id, nombre, cantidad, precio_unitario }] }

(function () {
  const cfg = window.APP_CONFIG || {};
  const usarSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  /* ------------------------------------------------------------------ */
  /*  Modo Supabase                                                      */
  /* ------------------------------------------------------------------ */
  function SupabaseAPI() {
    const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    const normalizar = (p) => ({
      id: p.id,
      usuario_id: p.usuario_id,
      cliente: p.profiles ? p.profiles.nombre : "",
      canal: p.canal,
      estado: p.estado,
      total: p.total,
      created_at: p.created_at,
      items: (p.pedido_items || []).map(it => ({
        producto_id: it.producto_id,
        nombre: it.productos ? it.productos.nombre : "Producto " + it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
      }))
    });

    const traducirError = (error) => {
      const m = (error && error.message) || String(error);
      if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
      if (/already registered/i.test(m)) return "Ese correo ya está registrado.";
      if (/Email not confirmed/i.test(m)) return "Debes confirmar tu correo antes de iniciar sesión.";
      if (/Password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
      return m;
    };
    const ok = ({ data, error }) => { if (error) throw new Error(traducirError(error)); return data; };

    async function perfil(user) {
      const data = ok(await db.from("profiles").select("*").eq("id", user.id).maybeSingle());
      return data || { id: user.id, nombre: user.email, restricciones: [], rol: "cliente" };
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
        const data = ok(await db.auth.signUp({ email, password, options: { data: { nombre } } }));
        if (!data.session) {
          throw new Error("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
        }
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
      async productos() {
        return ok(await db.from("productos").select("*").eq("disponible", true).order("id"));
      },
      async crearPedido(items, canal) {
        const p_items = items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }));
        return ok(await db.rpc("crear_pedido", { p_items, p_canal: canal }));
      },
      async misPedidos(usuarioId) {
        const data = ok(await db.from("pedidos")
          .select("*, pedido_items(producto_id, cantidad, precio_unitario, productos(nombre))")
          .eq("usuario_id", usuarioId)
          .order("created_at", { ascending: false }));
        return data.map(normalizar);
      },
      async todosLosPedidos() {
        const data = ok(await db.from("pedidos")
          .select("*, profiles(nombre), pedido_items(producto_id, cantidad, precio_unitario, productos(nombre))")
          .order("created_at", { ascending: false })
          .limit(200));
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
    const K = "cafe_demo_v1";
    const leer = () => {
      try {
        const raw = localStorage.getItem(K);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* almacenamiento no disponible */ }
      return null;
    };
    let estado = leer() || {
      usuarios: [
        { id: "demo-admin", email: "admin@demo.com", clave: "admin123", nombre: "Administrador", restricciones: [], rol: "admin" },
        { id: "demo-cliente", email: "cliente@demo.com", clave: "cliente123", nombre: "Cliente Demo", restricciones: [], rol: "cliente" }
      ],
      pedidos: window.generarPedidosDemo(),
      sesion: null
    };
    const guardar = () => { try { localStorage.setItem(K, JSON.stringify(estado)); } catch (e) { /* ignorar */ } };
    guardar();
    const espera = () => new Promise(r => setTimeout(r, 150));
    const publico = (u) => ({ user: { id: u.id, email: u.email }, perfil: { id: u.id, nombre: u.nombre, restricciones: u.restricciones, rol: u.rol } });

    return {
      modo: "demo",
      async sesion() {
        const u = estado.usuarios.find(x => x.id === estado.sesion);
        return u ? publico(u) : null;
      },
      async registrar(email, password, nombre) {
        await espera();
        email = email.trim().toLowerCase();
        if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
        if (estado.usuarios.some(u => u.email === email)) throw new Error("Ese correo ya está registrado.");
        const u = { id: "u-" + Date.now(), email, clave: password, nombre, restricciones: [], rol: "cliente" };
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
        const u = estado.usuarios.find(x => x.id === id);
        Object.assign(u, cambios);
        guardar();
      },
      async productos() { return window.PRODUCTOS_BASE.slice(); },
      async crearPedido(items, canal) {
        await espera();
        const u = estado.usuarios.find(x => x.id === estado.sesion);
        const lineas = items.map(i => {
          const p = window.PRODUCTOS_BASE.find(x => x.id === i.producto_id);
          return { producto_id: p.id, nombre: p.nombre, cantidad: i.cantidad, precio_unitario: p.precio };
        });
        const pedido = {
          id: Math.max(0, ...estado.pedidos.map(p => p.id)) + 1,
          usuario_id: u.id, cliente: u.nombre, canal, estado: "pendiente",
          total: lineas.reduce((s, l) => s + l.precio_unitario * l.cantidad, 0),
          created_at: new Date().toISOString(), items: lineas
        };
        estado.pedidos.push(pedido);
        guardar();
        return pedido.id;
      },
      async misPedidos(usuarioId) {
        return estado.pedidos.filter(p => p.usuario_id === usuarioId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
      },
      async todosLosPedidos() {
        return estado.pedidos.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
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
          for (let i = 0; i < ids.length; i++) {
            for (let j = 0; j < ids.length; j++) {
              if (i === j) continue;
              const k = ids[i] + "-" + ids[j];
              pares[k] = (pares[k] || 0) + 1;
            }
          }
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
