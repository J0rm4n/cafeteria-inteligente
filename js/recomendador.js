// Motor de recomendación — "La anatomía de la personalización"
//
// Cada producto recibe un puntaje entre 0 y 1 a partir de los cuatro nodos del perfil:
//   Nodo 1 · Frecuencia e historial  → qué pide el cliente y en qué franja horaria
//   Nodo 2 · Preferencias personales → gustos base declarados
//   Nodo 3 · Restricciones médicas   → FILTRO DURO (nunca se recomienda algo incompatible)
//   Nodo 4 · Mood actual             → etiquetas afines + lo que pidió antes con ese mismo ánimo
// más dos señales de apoyo: coocurrencia ("quien pide X suele pedir Y") y popularidad global.
//
// "La curva de madurez": los pesos cambian según el número de pedidos del cliente.
// Con pocos datos manda lo declarado (preferencias, mood, popularidad); con un perfil
// maduro manda el historial real.

(function () {
  const D = window.dominio;

  const NIVELES = [
    { n: 1, desde: 0,  nombre: "Perfil básico",            desc: "Recolectamos tus preferencias iniciales.",
      pesos: { historial: 0,    preferencias: 0.30, mood: 0.30, contexto: 0.15, coocurrencia: 0,    popularidad: 0.25 } },
    { n: 2, desde: 1,  nombre: "Aprendiendo de ti",        desc: "Cruzamos tu frecuencia con tu mood diario.",
      pesos: { historial: 0.15, preferencias: 0.20, mood: 0.25, contexto: 0.10, coocurrencia: 0.10, popularidad: 0.20 } },
    { n: 3, desde: 4,  nombre: "Perfil maduro",            desc: "Ya identificamos tus patrones de consumo.",
      pesos: { historial: 0.25, preferencias: 0.15, mood: 0.25, contexto: 0.10, coocurrencia: 0.15, popularidad: 0.10 } },
    { n: 4, desde: 10, nombre: "Recomendaciones óptimas", desc: "Sugerencias precisas para elegir casi al instante.",
      pesos: { historial: 0.35, preferencias: 0.10, mood: 0.25, contexto: 0.05, coocurrencia: 0.20, popularidad: 0.05 } }
  ];

  function nivelMadurez(numPedidos) {
    const nivel = NIVELES.filter(x => numPedidos >= x.desde).pop();
    const sig = NIVELES.find(x => x.n === nivel.n + 1);
    const progreso = sig ? (numPedidos - nivel.desde) / (sig.desde - nivel.desde) : 1;
    return { ...nivel, siguiente: sig || null, faltan: sig ? sig.desde - numPedidos : 0, progreso };
  }

  function momentoDelDia(fecha = new Date()) {
    const h = fecha.getHours();
    if (h < 12) return "manana";
    if (h < 18) return "tarde";
    return "noche";
  }

  const normalizar = (mapa) => {
    const max = Math.max(0, ...Object.values(mapa));
    const out = {};
    Object.keys(mapa).forEach(k => { out[k] = max ? mapa[k] / max : 0; });
    return out;
  };

  function contar(pedidos, filtro = () => true) {
    const c = {};
    pedidos.filter(filtro).forEach(p => p.items.forEach(it => {
      c[it.producto_id] = (c[it.producto_id] || 0) + it.cantidad;
    }));
    return c;
  }

  /**
   * @returns {Array<{producto, puntaje, motivo, senales}>}
   */
  function recomendar({ productos, misPedidos = [], globales = {}, perfil, mood = null, carrito = [], limite = 4, fecha = new Date() }) {
    const momento = momentoDelDia(fecha);
    const nivel = nivelMadurez(misPedidos.length);
    const moodDef = D.MOODS.find(m => m.id === mood);
    const restricciones = perfil.restricciones || [];
    const preferencias = perfil.preferencias || [];

    // Nodo 1: frecuencia general y en la misma franja horaria
    const freq = normalizar(contar(misPedidos));
    const freqMomento = normalizar(contar(misPedidos, p => momentoDelDia(new Date(p.created_at)) === momento));
    // Nodo 4: lo que pidió antes con este mismo mood (intersección frecuencia × mood)
    const freqMood = mood ? normalizar(contar(misPedidos, p => p.mood === mood)) : {};

    // Coocurrencia con el carrito (o con sus favoritos si el carrito está vacío)
    const base = carrito.length ? carrito
      : Object.entries(contar(misPedidos)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => Number(id));
    const co = {};
    const origen = {};
    (globales.coocurrencias || []).forEach(({ a, b, veces }) => {
      if (base.includes(a) && !base.includes(b)) {
        co[b] = (co[b] || 0) + veces;
        if (!origen[b] || veces > origen[b].veces) origen[b] = { id: a, veces };
      }
    });
    const coN = normalizar(co);
    const popN = normalizar(globales.popularidad || {});
    const nombrePorId = Object.fromEntries(productos.map(p => [p.id, p.nombre]));

    // Pesos según la madurez; se redistribuyen si falta una señal
    const pesos = { ...nivel.pesos };
    if (!mood) pesos.mood = 0;
    if (carrito.length) pesos.coocurrencia += 0.30;
    const suma = Object.values(pesos).reduce((a, b) => a + b, 0) || 1;
    Object.keys(pesos).forEach(k => { pesos[k] /= suma; });

    return productos
      .filter(p => D.esCompatible(p, restricciones))          // Nodo 3: filtro estricto
      .filter(p => p.disponible !== false && (p.stock === undefined || p.stock > 0))
      .filter(p => !carrito.includes(p.id))
      .map(p => {
        const g = p.gustos || [];
        const coincidencias = g.filter(x => preferencias.includes(x));

        let sMood = 0;
        const evitar = Boolean(moodDef && moodDef.evita && (p.alergenos || []).includes(moodDef.evita));
        if (moodDef) {
          sMood = Math.min(1, (g.some(x => moodDef.afines.includes(x)) ? 0.8 : 0) + 0.4 * (freqMood[p.id] || 0));
          if (evitar) sMood = 0;
        }

        const s = {
          historial: 0.6 * (freq[p.id] || 0) + 0.4 * (freqMomento[p.id] || 0),
          preferencias: preferencias.length ? Math.min(1, coincidencias.length / Math.min(2, preferencias.length)) : 0,
          mood: sMood,
          contexto: (p.momento || []).includes(momento) ? 1 : 0,
          coocurrencia: coN[p.id] || 0,
          popularidad: popN[p.id] || 0
        };
        let puntaje = Object.keys(pesos).reduce((acc, k) => acc + pesos[k] * s[k], 0);
        // Ej.: con mood "estresado" se penalizan los productos con cafeína
        if (evitar) puntaje *= 0.6;

        // Motivo legible = la señal que más aportó. Si el cliente acaba de declarar su mood
        // y esa señal pesa casi lo mismo que la principal, se prioriza explicarla.
        const aportes = Object.keys(pesos).map(k => [k, pesos[k] * s[k]]).sort((a, b) => b[1] - a[1]);
        let principal = aportes[0][1] > 0 ? aportes[0][0] : "popularidad";
        const aporteMood = pesos.mood * s.mood;
        if (moodDef && aporteMood > 0 && aporteMood >= 0.7 * aportes[0][1]) principal = "mood";
        const motivos = {
          historial: (freqMomento[p.id] || 0) > 0 ? "Sueles pedirlo en la " + D.MOMENTOS[momento] : "Lo pides con frecuencia",
          preferencias: "Va con tus gustos: " + coincidencias.map(x => D.GUSTOS.find(y => y.id === x).label.toLowerCase()).join(", "),
          mood: moodDef ? ((freqMood[p.id] || 0) > 0 ? "Lo pediste antes estando " + moodDef.label.toLowerCase() : "Ideal " + moodDef.frase) : "",
          contexto: "Perfecto para la " + D.MOMENTOS[momento],
          coocurrencia: origen[p.id] ? "Combina con " + nombrePorId[origen[p.id].id] : "Se pide junto a tus favoritos",
          popularidad: "De los más pedidos"
        };
        return { producto: p, puntaje, motivo: motivos[principal], senales: s };
      })
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, limite);
  }

  /** "Lo de siempre": la combinación de productos (con sus opciones) que el cliente más repite. */
  function pedidoHabitual(misPedidos, productos) {
    const grupos = {};
    misPedidos.forEach(p => {
      const firma = p.items.map(i => D.claveLinea(i.producto_id, i.opciones)).sort().join(",");
      (grupos[firma] = grupos[firma] || { veces: 0, items: p.items }).veces++;
    });
    const mejor = Object.values(grupos).sort((a, b) => b.veces - a.veces)[0];
    if (!mejor || mejor.veces < 2) return null;
    const disponibles = mejor.items.every(i => {
      const p = productos.find(x => x.id === i.producto_id);
      return p && p.stock > 0;
    });
    return disponibles ? mejor : null;
  }

  /** Opciones preseleccionadas: aprende de la última bebida personalizada y respeta las restricciones. */
  function opcionesSugeridas(producto, perfil, misPedidos) {
    const restricciones = perfil.restricciones || [];
    const leches = D.lechesPermitidas(restricciones).map(l => l.id);
    let ultima = null;
    for (const p of misPedidos) {
      const it = p.items.find(i => i.opciones);
      if (it) { ultima = it.opciones; break; }
    }
    const tamano = ultima ? ultima.tamano : "mediano";
    let leche = ultima && leches.includes(ultima.leche) ? ultima.leche : null;
    if (!leche) leche = leches.includes("entera") ? "entera" : (leches.includes("deslactosada") ? "deslactosada" : leches[0]);
    const extra = Boolean(ultima && ultima.extra && D.permiteExtra(producto, restricciones));
    return { opciones: { tamano, leche, extra }, aprendidas: Boolean(ultima) };
  }

  window.recomendador = { recomendar, pedidoHabitual, opcionesSugeridas, nivelMadurez, momentoDelDia, NIVELES };
})();
