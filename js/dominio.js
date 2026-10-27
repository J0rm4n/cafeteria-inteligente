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

  /* ---------------- Validaciones de cuenta ---------------- */

  // Estructura de correo (RFC 5321 simplificado): parte local de hasta 64 caracteres sin puntos
  // al inicio, al final ni seguidos; dominio con etiquetas válidas y extensión de 2+ letras.
  const RE_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  const RE_DOMINIO = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

  function validarEmail(valor) {
    const email = String(valor || "").trim();
    if (!email) return "Escribe tu correo electrónico.";
    if (/\s/.test(email)) return "El correo no puede tener espacios.";
    if (email.length > 254) return "El correo es demasiado largo.";
    const partes = email.split("@");
    if (partes.length !== 2) return "El correo debe tener un solo @ (ejemplo: nombre@dominio.com).";
    const [local, dominio] = partes;
    if (!local) return "Falta el usuario antes del @.";
    if (local.length > 64) return "La parte antes del @ es demasiado larga.";
    if (!RE_LOCAL.test(local)) return "La parte antes del @ tiene caracteres no válidos o puntos mal ubicados.";
    if (!dominio) return "Falta el dominio después del @.";
    if (!RE_DOMINIO.test(dominio)) return "El dominio no es válido (ejemplo: gmail.com, udes.edu.co).";
    return null;
  }

  const CLAVES_COMUNES = ["12345678", "123456789", "1234567890", "password", "password1", "contraseña", "contrasena",
    "qwerty123", "qwertyuiop", "abc12345", "admin123", "11111111", "00000000", "iloveyou", "colombia1", "cafe1234"];
  // Palabras base que, aunque se adornen con números o símbolos (Password1!), siguen siendo predecibles
  const BASES_COMUNES = ["password", "contraseña", "contrasena", "clave", "qwerty", "admin", "usuario", "welcome",
    "bienvenido", "colombia", "cucuta", "udes", "cafe", "cafeteria", "abc", "abcd", "abcdef", "iloveyou", "teamo"];

  // Política de contraseña segura (basada en OWASP / NIST 800-63B)
  function reglasClave(clave, { email = "", nombre = "" } = {}) {
    const c = String(clave || "");
    const bajo = c.toLowerCase();
    const usuario = String(email).split("@")[0].toLowerCase();
    const palabras = String(nombre).toLowerCase().split(/\s+/).filter(p => p.length >= 3);
    const datosPersonales = (usuario.length >= 3 && bajo.includes(usuario)) || palabras.some(p => bajo.includes(p));
    return [
      { id: "largo",     texto: "Entre 8 y 64 caracteres",         ok: c.length >= 8 && c.length <= 64 },
      { id: "mayuscula", texto: "Una letra mayúscula",             ok: /[A-ZÁÉÍÓÚÑ]/.test(c) },
      { id: "minuscula", texto: "Una letra minúscula",             ok: /[a-záéíóúñ]/.test(c) },
      { id: "numero",    texto: "Un número",                       ok: /\d/.test(c) },
      { id: "simbolo",   texto: "Un símbolo (! @ # $ % & * . - _ …)", ok: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(c) },
      { id: "espacios",  texto: "Sin espacios",                    ok: c.length > 0 && !/\s/.test(c) },
      { id: "personal",  texto: "Que no contenga tu nombre ni tu correo", ok: c.length > 0 && !datosPersonales },
      { id: "comun",     texto: "Que no sea una contraseña común", ok: c.length > 0 && !CLAVES_COMUNES.includes(bajo) && !/^(.)\1+$/.test(c)
                                                                  && !BASES_COMUNES.includes(bajo.replace(/[^a-zñ]/g, "")) }
    ];
  }

  function validarClave(clave, datos) {
    const falla = reglasClave(clave, datos).find(r => !r.ok);
    return falla ? "La contraseña debe cumplir: " + falla.texto.toLowerCase() + "." : null;
  }

  // 0 a 4 según cuántas reglas se cumplen y la longitud
  function fuerzaClave(clave, datos) {
    const reglas = reglasClave(clave, datos);
    const cumplidas = reglas.filter(r => r.ok).length;
    if (!clave) return 0;
    if (cumplidas < reglas.length) return Math.min(2, Math.floor(cumplidas / 3));
    return clave.length >= 12 ? 4 : 3;
  }

  function validarNombre(valor) {
    const n = String(valor || "").trim();
    if (n.length < 2) return "Escribe tu nombre (mínimo 2 letras).";
    if (n.length > 60) return "El nombre es demasiado largo.";
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(n)) return "El nombre solo puede tener letras y espacios.";
    return null;
  }

  window.dominio = {
    INTOLERANCIAS, GUSTOS, MOODS, OPCIONES, MOMENTOS,
    esCompatible, lechesPermitidas, permiteExtra, precioUnitario, describirOpciones, claveLinea,
    validarEmail, reglasClave, validarClave, fuerzaClave, validarNombre
  };
})();
