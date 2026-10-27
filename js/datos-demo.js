// Catálogo base (el mismo que carga supabase/schema.sql).
//   alergenos: ingredientes que CONTIENE (lactosa, gluten, frutos_secos, huevo, azucar, cafeina)
//   gustos:    etiquetas de sabor/estilo (cafe, dulce, salado, saludable, frio, caliente,
//              energia, relajante, reconfortante)
//   momento:   franjas en que suele consumirse (manana, tarde, noche)
//   personalizable: admite tamaño, tipo de leche y extra shot
window.PRODUCTOS_BASE = [
  { id: 1,  nombre: "Tinto",                        precio: 2500,  categoria: "Bebidas calientes", emoji: "☕", descripcion: "Café negro de origen colombiano.",                 alergenos: ["cafeina"], gustos: ["cafe","caliente","energia"], momento: ["manana","tarde"], personalizable: false, stock: 80 },
  { id: 2,  nombre: "Espresso doble",               precio: 4500,  categoria: "Bebidas calientes", emoji: "☕", descripcion: "Dos shots intensos, crema densa.",                 alergenos: ["cafeina"], gustos: ["cafe","caliente","energia"], momento: ["manana","tarde"], personalizable: false, stock: 60 },
  { id: 3,  nombre: "Capuchino",                    precio: 6500,  categoria: "Bebidas calientes", emoji: "☕", descripcion: "Espresso con leche espumada y canela.",            alergenos: ["lactosa","cafeina"], gustos: ["cafe","caliente","dulce","reconfortante"], momento: ["manana","tarde"], personalizable: true, stock: 50 },
  { id: 4,  nombre: "Latte",                        precio: 7000,  categoria: "Bebidas calientes", emoji: "🥛", descripcion: "Espresso suave con abundante leche.",              alergenos: ["lactosa","cafeina"], gustos: ["cafe","caliente","reconfortante"], momento: ["manana","tarde"], personalizable: true, stock: 50 },
  { id: 5,  nombre: "Mocaccino",                    precio: 8000,  categoria: "Bebidas calientes", emoji: "☕", descripcion: "Espresso, chocolate y leche.",                     alergenos: ["lactosa","cafeina","azucar"], gustos: ["cafe","caliente","dulce","reconfortante"], momento: ["tarde","noche"], personalizable: true, stock: 40 },
  { id: 6,  nombre: "Chocolate caliente",           precio: 6000,  categoria: "Bebidas calientes", emoji: "🍫", descripcion: "Chocolate de mesa batido con leche.",              alergenos: ["lactosa","azucar"], gustos: ["caliente","dulce","reconfortante","relajante"], momento: ["tarde","noche"], personalizable: true, stock: 40 },
  { id: 7,  nombre: "Aromática de frutos rojos",    precio: 4000,  categoria: "Bebidas calientes", emoji: "🍵", descripcion: "Infusión sin cafeína ni azúcar.",                  alergenos: [], gustos: ["caliente","saludable","relajante"], momento: ["tarde","noche"], personalizable: false, stock: 60 },
  { id: 8,  nombre: "Café frappé",                  precio: 9000,  categoria: "Bebidas frías",     emoji: "🧋", descripcion: "Café helado batido con crema.",                    alergenos: ["lactosa","cafeina","azucar"], gustos: ["cafe","frio","dulce","energia"], momento: ["tarde"], personalizable: true, stock: 35 },
  { id: 9,  nombre: "Cold brew",                    precio: 7500,  categoria: "Bebidas frías",     emoji: "🧊", descripcion: "Extracción en frío por 18 horas.",                 alergenos: ["cafeina"], gustos: ["cafe","frio","energia"], momento: ["manana","tarde"], personalizable: false, stock: 30 },
  { id: 10, nombre: "Jugo natural de mango",        precio: 6000,  categoria: "Bebidas frías",     emoji: "🥭", descripcion: "Mango fresco en agua, sin conservantes.",          alergenos: [], gustos: ["frio","saludable"], momento: ["manana","tarde"], personalizable: false, stock: 40 },
  { id: 11, nombre: "Limonada de coco",             precio: 7500,  categoria: "Bebidas frías",     emoji: "🥥", descripcion: "Limón, crema de coco y hielo.",                    alergenos: ["azucar"], gustos: ["frio","dulce"], momento: ["tarde"], personalizable: false, stock: 40 },
  { id: 12, nombre: "Croissant de mantequilla",     precio: 5000,  categoria: "Panadería",         emoji: "🥐", descripcion: "Hojaldre francés recién horneado.",                alergenos: ["gluten","lactosa","huevo"], gustos: ["dulce"], momento: ["manana"], personalizable: false, stock: 30 },
  { id: 13, nombre: "Pandebono",                    precio: 2500,  categoria: "Panadería",         emoji: "🧀", descripcion: "Almidón de yuca y queso, recién horneado.",        alergenos: ["lactosa","huevo"], gustos: ["salado","reconfortante"], momento: ["manana","tarde"], personalizable: false, stock: 50 },
  { id: 14, nombre: "Almojábana",                   precio: 2500,  categoria: "Panadería",         emoji: "🧀", descripcion: "Pan de cuajada y harina de maíz.",                 alergenos: ["lactosa","huevo"], gustos: ["salado"], momento: ["manana","tarde"], personalizable: false, stock: 50 },
  { id: 15, nombre: "Pan integral de avena",        precio: 4500,  categoria: "Panadería",         emoji: "🍞", descripcion: "Masa madre con semillas, sin lácteos.",            alergenos: ["gluten"], gustos: ["saludable"], momento: ["manana"], personalizable: false, stock: 25 },
  { id: 16, nombre: "Torta de chocolate",           precio: 8000,  categoria: "Postres",           emoji: "🍰", descripcion: "Bizcocho húmedo con ganache.",                     alergenos: ["gluten","lactosa","huevo","azucar"], gustos: ["dulce","reconfortante"], momento: ["tarde","noche"], personalizable: false, stock: 20 },
  { id: 17, nombre: "Cheesecake de maracuyá",       precio: 9500,  categoria: "Postres",           emoji: "🍮", descripcion: "Base de galleta y salsa de maracuyá.",             alergenos: ["gluten","lactosa","huevo","azucar"], gustos: ["dulce"], momento: ["tarde","noche"], personalizable: false, stock: 15 },
  { id: 18, nombre: "Brownie con nueces",           precio: 6500,  categoria: "Postres",           emoji: "🍫", descripcion: "Chocolate intenso con nueces tostadas.",           alergenos: ["gluten","lactosa","huevo","azucar","frutos_secos"], gustos: ["dulce","reconfortante"], momento: ["tarde","noche"], personalizable: false, stock: 4 },
  { id: 19, nombre: "Galletas de avena sin azúcar", precio: 4000,  categoria: "Postres",           emoji: "🍪", descripcion: "Endulzadas con fruta.",                            alergenos: ["gluten"], gustos: ["saludable","dulce"], momento: ["tarde"], personalizable: false, stock: 30 },
  { id: 20, nombre: "Sándwich de pollo",            precio: 14000, categoria: "Salados",           emoji: "🥪", descripcion: "Pollo desmechado, queso y vegetales.",             alergenos: ["gluten","lactosa"], gustos: ["salado"], momento: ["tarde","noche"], personalizable: false, stock: 15 },
  { id: 21, nombre: "Empanadas de maíz (3)",        precio: 7500,  categoria: "Salados",           emoji: "🥟", descripcion: "Rellenas de carne y papa, con ají.",               alergenos: [], gustos: ["salado","reconfortante"], momento: ["tarde"], personalizable: false, stock: 25 },
  { id: 22, nombre: "Wrap vegetariano",             precio: 13000, categoria: "Salados",           emoji: "🌯", descripcion: "Hummus, vegetales asados y aguacate.",             alergenos: ["gluten"], gustos: ["salado","saludable"], momento: ["tarde","noche"], personalizable: false, stock: 12 },
  { id: 23, nombre: "Bowl de frutas con granola",   precio: 11000, categoria: "Saludable",         emoji: "🥣", descripcion: "Frutas de temporada, granola y miel de agave.",    alergenos: ["frutos_secos"], gustos: ["saludable","dulce"], momento: ["manana"], personalizable: false, stock: 15 },
  { id: 24, nombre: "Pudín de chía y coco",         precio: 8500,  categoria: "Saludable",         emoji: "🫐", descripcion: "Chía, bebida de coco y arándanos.",                alergenos: [], gustos: ["saludable","dulce"], momento: ["manana","tarde"], personalizable: false, stock: 0 }
].map(p => ({ ...p, disponible: true }));

// Pedidos simulados: dan popularidad, coocurrencias e historial al modo demo desde el inicio.
window.generarPedidosDemo = function () {
  const P = (id) => window.PRODUCTOS_BASE.find(p => p.id === id);
  const op = (tamano, leche, extra) => ({ tamano, leche, extra: Boolean(extra) });
  const linea = (id, opciones, cantidad = 1) => {
    const p = P(id);
    return { producto_id: id, nombre: p.nombre, cantidad, opciones: p.personalizable ? opciones : null,
             precio_unitario: window.dominio.precioUnitario(p, opciones), recomendado: false };
  };
  // [cliente, hora, mood, líneas, díasAtrás]
  const plantillas = [
    ["Cliente Demo", 8,  "cansado",   [linea(3, op("mediano", "avena")), linea(12)], 9],
    ["Cliente Demo", 8,  "cansado",   [linea(3, op("mediano", "avena")), linea(12)], 7],
    ["Cliente Demo", 9,  null,        [linea(3, op("mediano", "avena")), linea(12)], 5],
    ["Cliente Demo", 15, "feliz",     [linea(8, op("grande", "avena"))], 4],
    ["Cliente Demo", 19, "estresado", [linea(7), linea(19)], 2],
    ["Cliente Demo", 8,  "cansado",   [linea(3, op("mediano", "avena")), linea(15)], 1],
    ["Ana",       7,  "cansado",   [linea(1), linea(13)], 6],
    ["Luis",      8,  "cansado",   [linea(2), linea(14)], 6],
    ["Camila",    10, "feliz",     [linea(4, op("mediano", "almendras")), linea(23)], 5],
    ["Andrés",    13, "hambre",    [linea(20), linea(11)], 5],
    ["Valentina", 16, "feliz",     [linea(8, op("grande", "entera")), linea(16)], 5],
    ["Sebastián", 17, "estresado", [linea(6, op("mediano", "entera")), linea(14)], 4],
    ["Ana",       7,  "cansado",   [linea(1), linea(13), linea(14)], 4],
    ["Luis",      12, "hambre",    [linea(21), linea(10)], 4],
    ["Camila",    15, "feliz",     [linea(11), linea(17)], 3],
    ["Andrés",    18, null,        [linea(5, op("grande", "entera")), linea(18)], 3],
    ["Valentina", 9,  null,        [linea(3, op("pequeno", "deslactosada")), linea(12)], 3],
    ["Sebastián", 20, "estresado", [linea(7), linea(19)], 2],
    ["Ana",       8,  "cansado",   [linea(1), linea(13)], 2],
    ["Luis",      14, "hambre",    [linea(22), linea(10)], 2],
    ["Camila",    16, "feliz",     [linea(8, op("mediano", "avena")), linea(16)], 1],
    ["Andrés",    9,  "cansado",   [linea(9), linea(15)], 1],
    ["Valentina", 11, null,        [linea(4, op("mediano", "entera")), linea(12)], 0],
    ["Sebastián", 8,  "cansado",   [linea(2), linea(13)], 0],
    ["Ana",       13, "hambre",    [linea(20), linea(11)], 0],
    ["Luis",      10, "feliz",     [linea(6, op("mediano", "deslactosada")), linea(16)], 0]
  ];
  const usuarios = { "Cliente Demo": "demo-cliente" };
  return plantillas.map(([cliente, hora, mood, items, dias], i) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(hora, (i * 7) % 60, 0, 0);
    if (d > new Date()) d.setDate(d.getDate() - 1);
    const recientes = i >= plantillas.length - 3;
    return {
      id: i + 1,
      usuario_id: usuarios[cliente] || "demo-" + cliente.toLowerCase(),
      cliente, mood,
      canal: i % 3 === 0 ? "kiosco" : "movil",
      estado: recientes ? ["pendiente", "preparando", "listo"][i % 3] : "entregado",
      total: items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0),
      created_at: d.toISOString(),
      // Simula que algunos acompañamientos se agregaron desde una recomendación
      items: items.map((it, k) => ({ ...it, recomendado: k > 0 && i % 2 === 0 }))
    };
  }).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((p, i) => ({ ...p, id: i + 1 }));
};
