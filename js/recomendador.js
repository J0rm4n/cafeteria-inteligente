// Motor de recomendación híbrido.
//
// Para cada producto calcula un puntaje entre 0 y 1 combinando cuatro señales:
//   1. Historial personal   (filtrado basado en el usuario: qué pide más seguido)
//   2. Coocurrencia         (reglas de asociación: "quien pide X suele pedir Y")
//   3. Contexto             (hora del día + antojo declarado voluntariamente)
//   4. Popularidad global   (resuelve el "arranque en frío" de clientes nuevos)
//
// Las restricciones alimentarias son un FILTRO DURO: un producto que no cumple
// alguna restricción del usuario nunca se recomienda.

(function () {
  const PESOS = { historial: 0.35, coocurrencia: 0.30, contexto: 0.20, popularidad: 0.15 };

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

  function cumpleRestricciones(producto, restricciones) {
    return (restricciones || []).every(r => (producto.etiquetas || []).includes(r));
  }

  /**
   * @param {object} p
   * @param {Array}  p.productos      catálogo
   * @param {Array}  p.misPedidos     pedidos del usuario (formato normalizado)
   * @param {object} p.globales       { popularidad: {id: n}, coocurrencias: [{a,b,veces}] }
   * @param {Array}  p.restricciones  p. ej. ["vegano"]
   * @param {string} [p.antojo]       dulce | salado | energia | ligero
   * @param {Array}  [p.carrito]      ids de productos en el carrito (para "combina con")
   * @param {number} [p.limite]
   * @returns {Array<{producto, puntaje, motivo}>}
   */
  function recomendar({ productos, misPedidos, globales, restricciones, antojo, carrito = [], limite = 4, fecha }) {
    const momento = momentoDelDia(fecha);

    // 1. Frecuencia personal
    const freq = {};
    (misPedidos || []).forEach(p => p.items.forEach(it => {
      freq[it.producto_id] = (freq[it.producto_id] || 0) + it.cantidad;
    }));
    const freqN = normalizar(freq);

    // 2. Coocurrencia con lo que hay en el carrito (o, si está vacío, con lo que más pide el usuario)
    const base = carrito.length
      ? carrito
      : Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => Number(id));
    const co = {};
    const origen = {};
    (globales.coocurrencias || []).forEach(({ a, b, veces }) => {
      if (base.includes(a) && !base.includes(b)) {
        co[b] = (co[b] || 0) + veces;
        if (!origen[b] || veces > origen[b].veces) origen[b] = { id: a, veces };
      }
    });
    const coN = normalizar(co);

    // 4. Popularidad
    const popN = normalizar(globales.popularidad || {});

    const nombrePorId = Object.fromEntries(productos.map(p => [p.id, p.nombre]));
    const esNuevo = Object.keys(freq).length === 0;

    const candidatos = productos
      .filter(p => cumpleRestricciones(p, restricciones))
      .filter(p => !carrito.includes(p.id))
      .map(p => {
        // 3. Contexto
        let ctx = 0;
        if ((p.momento || []).includes(momento)) ctx += 0.5;
        if (antojo && (p.etiquetas || []).includes(antojo)) ctx += 0.5;
        else if (!antojo) ctx *= 2; // sin antojo declarado, la hora pesa todo el componente

        const s = {
          historial: freqN[p.id] || 0,
          coocurrencia: coN[p.id] || 0,
          contexto: ctx,
          popularidad: popN[p.id] || 0
        };
        // Cliente nuevo: se reparte el peso del historial entre contexto y popularidad.
        const pesos = esNuevo && !carrito.length
          ? { historial: 0, coocurrencia: 0.15, contexto: 0.45, popularidad: 0.40 }
          : PESOS;
        const puntaje = Object.keys(pesos).reduce((acc, k) => acc + pesos[k] * s[k], 0);

        // Motivo legible: la señal que más aportó
        const aportes = Object.keys(pesos).map(k => [k, pesos[k] * s[k]]).sort((a, b) => b[1] - a[1]);
        const principal = aportes[0][1] > 0 ? aportes[0][0] : "popularidad";
        const motivos = {
          historial: "Lo pides con frecuencia",
          coocurrencia: origen[p.id] ? "Combina con " + nombrePorId[origen[p.id].id] : "Suele pedirse junto a tus favoritos",
          contexto: antojo && (p.etiquetas || []).includes(antojo)
            ? "Ideal para tu antojo " + ({ dulce: "dulce", salado: "salado", energia: "de energía", ligero: "ligero" }[antojo])
            : "Perfecto para la " + ({ manana: "mañana", tarde: "tarde", noche: "noche" }[momento]),
          popularidad: "De los más pedidos"
        };
        return { producto: p, puntaje, motivo: motivos[principal], senales: s };
      });

    return candidatos.sort((a, b) => b.puntaje - a.puntaje).slice(0, limite);
  }

  window.recomendador = { recomendar, momentoDelDia, cumpleRestricciones, PESOS };
})();
