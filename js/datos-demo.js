// Catálogo base (el mismo que se carga en Supabase con supabase/schema.sql).
// etiquetas:
//   - restricciones que CUMPLE el producto: vegano, sin_lactosa, sin_gluten, sin_azucar
//   - antojo (contexto voluntario): dulce, salado, energia, ligero
// momento: manana, tarde, noche
window.PRODUCTOS_BASE = [
  { id: 1,  nombre: "Tinto",                        precio: 2500,  categoria: "Bebidas calientes", emoji: "☕", descripcion: "Café negro de origen colombiano.", etiquetas: ["vegano","sin_lactosa","sin_gluten","sin_azucar","energia","ligero"], momento: ["manana","tarde"] },
  { id: 2,  nombre: "Capuchino",                    precio: 6500,  categoria: "Bebidas calientes", emoji: "☕", descripcion: "Espresso con leche espumada y canela.", etiquetas: ["sin_gluten","energia","dulce"], momento: ["manana","tarde"] },
  { id: 3,  nombre: "Latte con leche de avena",     precio: 7500,  categoria: "Bebidas calientes", emoji: "🥛", descripcion: "Espresso suave con bebida de avena.", etiquetas: ["vegano","sin_lactosa","sin_gluten","energia"], momento: ["manana","tarde"] },
  { id: 4,  nombre: "Chocolate caliente",           precio: 6000,  categoria: "Bebidas calientes", emoji: "🍫", descripcion: "Chocolate de mesa batido con leche.", etiquetas: ["sin_gluten","dulce"], momento: ["tarde","noche"] },
  { id: 5,  nombre: "Aromática de frutos rojos",    precio: 4000,  categoria: "Bebidas calientes", emoji: "🍵", descripcion: "Infusión de frutos rojos sin azúcar.", etiquetas: ["vegano","sin_lactosa","sin_gluten","sin_azucar","ligero"], momento: ["tarde","noche"] },
  { id: 6,  nombre: "Café frappé",                  precio: 9000,  categoria: "Bebidas frías",     emoji: "🧋", descripcion: "Café helado batido con crema.", etiquetas: ["sin_gluten","dulce","energia"], momento: ["tarde"] },
  { id: 7,  nombre: "Jugo natural de mango",        precio: 6000,  categoria: "Bebidas frías",     emoji: "🥭", descripcion: "Mango fresco en agua, sin conservantes.", etiquetas: ["vegano","sin_lactosa","sin_gluten","ligero"], momento: ["manana","tarde"] },
  { id: 8,  nombre: "Limonada de coco",             precio: 7500,  categoria: "Bebidas frías",     emoji: "🥥", descripcion: "Limón, crema de coco y hielo.", etiquetas: ["sin_gluten","dulce"], momento: ["tarde"] },
  { id: 9,  nombre: "Croissant de mantequilla",     precio: 5000,  categoria: "Panadería",         emoji: "🥐", descripcion: "Hojaldre francés recién horneado.", etiquetas: ["dulce"], momento: ["manana"] },
  { id: 10, nombre: "Pandebono",                    precio: 2500,  categoria: "Panadería",         emoji: "🧀", descripcion: "Almidón de yuca y queso, recién salido del horno.", etiquetas: ["sin_gluten","salado"], momento: ["manana","tarde"] },
  { id: 11, nombre: "Almojábana",                   precio: 2500,  categoria: "Panadería",         emoji: "🧀", descripcion: "Pan de cuajada y harina de maíz.", etiquetas: ["sin_gluten","salado"], momento: ["manana","tarde"] },
  { id: 12, nombre: "Pan integral de avena",        precio: 4500,  categoria: "Panadería",         emoji: "🍞", descripcion: "Pan vegano con semillas.", etiquetas: ["vegano","sin_lactosa","ligero"], momento: ["manana"] },
  { id: 13, nombre: "Torta de chocolate",           precio: 8000,  categoria: "Postres",           emoji: "🍰", descripcion: "Bizcocho húmedo con ganache.", etiquetas: ["dulce"], momento: ["tarde","noche"] },
  { id: 14, nombre: "Cheesecake de maracuyá",       precio: 9500,  categoria: "Postres",           emoji: "🍮", descripcion: "Base de galleta y salsa de maracuyá.", etiquetas: ["dulce"], momento: ["tarde","noche"] },
  { id: 15, nombre: "Galletas de avena sin azúcar", precio: 4000,  categoria: "Postres",           emoji: "🍪", descripcion: "Endulzadas con fruta, veganas.", etiquetas: ["vegano","sin_lactosa","sin_azucar","ligero","dulce"], momento: ["tarde"] },
  { id: 16, nombre: "Sándwich de pollo",            precio: 14000, categoria: "Salados",           emoji: "🥪", descripcion: "Pollo desmechado, queso y vegetales.", etiquetas: ["salado"], momento: ["tarde","noche"] },
  { id: 17, nombre: "Empanadas de maíz (3)",        precio: 7500,  categoria: "Salados",           emoji: "🥟", descripcion: "Rellenas de carne y papa, con ají.", etiquetas: ["sin_gluten","sin_lactosa","salado"], momento: ["tarde"] },
  { id: 18, nombre: "Bowl de frutas con granola",   precio: 11000, categoria: "Saludable",         emoji: "🥣", descripcion: "Frutas de temporada, granola y miel de agave.", etiquetas: ["vegano","sin_lactosa","ligero","dulce"], momento: ["manana"] },
  { id: 19, nombre: "Wrap vegetariano",             precio: 13000, categoria: "Saludable",         emoji: "🌯", descripcion: "Hummus, vegetales asados y aguacate.", etiquetas: ["vegano","sin_lactosa","salado","ligero"], momento: ["tarde","noche"] }
];

// Pedidos simulados para que el modo demo tenga popularidad y coocurrencias desde el inicio.
window.generarPedidosDemo = function () {
  const combos = [
    [1, 10], [1, 11], [1, 10, 11], [2, 9], [2, 9], [2, 13], [3, 12], [3, 18],
    [4, 11], [4, 10], [6, 13], [6, 14], [8, 16], [7, 18], [5, 15], [16, 8],
    [17, 7], [19, 5], [1, 17], [2, 14]
  ];
  const estados = ["entregado", "entregado", "entregado", "listo", "preparando", "pendiente"];
  const pedidos = [];
  let id = 1;
  const ahora = Date.now();
  for (let i = 0; i < 40; i++) {
    const combo = combos[i % combos.length];
    const items = combo.map(pid => {
      const p = window.PRODUCTOS_BASE.find(x => x.id === pid);
      return { producto_id: pid, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio };
    });
    pedidos.push({
      id: id++,
      usuario_id: "demo-cliente-" + (i % 6),
      cliente: ["Ana", "Luis", "Camila", "Andrés", "Valentina", "Sebastián"][i % 6],
      canal: i % 3 === 0 ? "kiosco" : "movil",
      estado: i < 34 ? "entregado" : estados[i % estados.length],
      total: items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0),
      created_at: new Date(ahora - (40 - i) * 3600 * 1000 * 3).toISOString(),
      items
    });
  }
  return pedidos;
};
