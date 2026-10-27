// Reglas de negocio compartidas: catálogos de opciones, restricciones, gustos y estados de ánimo.
(function () {
  // Nodo 3 · Restricciones médicas (intolerancias/alergias). Se filtran a nivel de datos.
  const INTOLERANCIAS = [
    { id: "lactosa",      label: "Intolerancia a la lactosa", corto: "Lactosa" },
    { id: "gluten",       label: "Celiaquía / gluten",        corto: "Gluten" },
    { id: "frutos_secos", label: "Alergia a frutos secos",    corto: "Frutos secos" },
    { id: "huevo",        label: "Alergia al huevo",          corto: "Huevo" },
    { id: "azucar",       label: "Sin azúcar (diabetes)",     corto: "Azúcar" },
    { id: "cafeina",      label: "Evito la cafeína",          corto: "Cafeína" }
  ];

  // Nodo 2 · Preferencias personales (gustos base declarados por el cliente)
  const GUSTOS = [
    { id: "cafe",      label: "Café",              icono: "☕" },
    { id: "dulce",     label: "Dulce",             icono: "🍬" },
    { id: "salado",    label: "Salado",            icono: "🥨" },
    { id: "saludable", label: "Saludable",         icono: "🥗" },
    { id: "frio",      label: "Bebidas frías",     icono: "🧊" },
    { id: "caliente",  label: "Bebidas calientes", icono: "🔥" }
  ];

  // Nodo 4 · Mood actual (input voluntario). "afines" son las etiquetas de producto que favorece.
  const MOODS = [
    { id: "feliz",     label: "Feliz",      icono: "😊", afines: ["dulce", "frio"],               frase: "si estás feliz" },
    { id: "cansado",   label: "Cansado",    icono: "😴", afines: ["energia"],                     frase: "si estás cansado" },
    { id: "estresado", label: "Estresado",  icono: "😣", afines: ["relajante", "reconfortante"],  frase: "si estás estresado", evita: "cafeina" },
    { id: "hambre",    label: "Con hambre", icono: "🤤", afines: ["salado"],                      frase: "si tienes hambre" }
  ];

  // Personalización de bebidas (resuelve "¿Tamaño? ¿Leche alternativa? ¿Extra shot?")
  const OPCIONES = {
    tamano: [
      { id: "pequeno", label: "Pequeño", detalle: "8 oz",  extra: 0 },
      { id: "mediano", label: "Mediano", detalle: "12 oz", extra: 1500 },
      { id: "grande",  label: "Grande",  detalle: "16 oz", extra: 3000 }
    ],
    leche: [
      { id: "entera",       label: "Entera",       largo: "leche entera",       extra: 0,    contiene: ["lactosa"] },
      { id: "deslactosada", label: "Deslactosada", largo: "leche deslactosada", extra: 0,    contiene: [] },
      { id: "almendras",    label: "Almendras",    largo: "leche de almendras",    extra: 1500, contiene: ["frutos_secos"] },
      { id: "avena",        label: "Avena",        largo: "leche de avena",        extra: 1000, contiene: [] }
    ],
    extra: { label: "Extra shot de espresso", extra: 2000, contiene: ["cafeina"] }
  };

  const MOMENTOS = { manana: "mañana", tarde: "tarde", noche: "noche" };

  /** ¿El producto es apto para estas restricciones?
   *  La lactosa no excluye una bebida personalizable: se sirve con leche vegetal o deslactosada. */
  function esCompatible(p, restricciones) {
    return (restricciones || []).every(r => {
      if (!(p.alergenos || []).includes(r)) return true;
      return r === "lactosa" && p.personalizable;
    });
  }

  function lechesPermitidas(restricciones) {
    return OPCIONES.leche.filter(l => !l.contiene.some(c => (restricciones || []).includes(c)));
  }

  function permiteExtra(p, restricciones) {
    return (p.gustos || []).includes("cafe") && !(restricciones || []).includes("cafeina");
  }

  function precioUnitario(p, op) {
    let precio = p.precio;
    if (p.personalizable && op) {
      const t = OPCIONES.tamano.find(x => x.id === op.tamano);
      const l = OPCIONES.leche.find(x => x.id === op.leche);
      precio += (t ? t.extra : 0) + (l ? l.extra : 0) + (op.extra ? OPCIONES.extra.extra : 0);
    }
    return precio;
  }

  function describirOpciones(op) {
    if (!op) return "";
    const t = OPCIONES.tamano.find(x => x.id === op.tamano);
    const l = OPCIONES.leche.find(x => x.id === op.leche);
    return [t && t.label, l && l.largo, op.extra && "extra shot"].filter(Boolean).join(" · ");
  }

  const claveLinea = (id, op) => id + "|" + (op ? [op.tamano, op.leche, op.extra ? 1 : 0].join("-") : "");

  window.dominio = {
    INTOLERANCIAS, GUSTOS, MOODS, OPCIONES, MOMENTOS,
    esCompatible, lechesPermitidas, permiteExtra, precioUnitario, describirOpciones, claveLinea
  };
})();
