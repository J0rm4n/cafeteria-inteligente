# Optimizando la decisión · Café Inteligente

**Sistema inteligente de pedidos y recomendación personalizada para cafeterías, basado en el perfil y las preferencias del cliente.**

Proyecto Integrador I · Ingeniería de Sistemas · Universidad de Santander (UDES)
Autores: **Jorman Enrique Martínez Ramírez** · **María Camila Ramos Díaz**
Profesor evaluador: Miguel Fabián Robles Angarita

🌐 Demo en vivo: <https://j0rm4n.github.io/cafeteria-inteligente/> · Modo kiosco: <https://j0rm4n.github.io/cafeteria-inteligente/?modo=kiosco>

## El problema: la fatiga de decisión en el mostrador

El problema no es la falta de opciones, sino la incapacidad de procesarlas rápido. La indecisión ("¿caliente o frío?", "¿tamaño?", "¿leche alternativa?", "¿extra shot?") genera cuellos de botella en la atención. El objetivo es convertir la elección en una **experiencia guiada**: *preferencia clara → recomendación personalizada → confirmación rápida*.

| | Flujo tradicional | Flujo inteligente (este sistema) |
|---|---|---|
| Tiempo de elección | Alto (lectura del menú completo) | Mínimo (opciones pre-filtradas) |
| Personalización | Nula (menú estático) | Alta (historial y contexto) |
| Control de intolerancias | Manual, propenso a errores | Automatizado (filtro estricto en la base de datos) |
| Construcción de perfil | Inexistente | Evolutiva (mejora con cada pedido) |

## Ecosistema dual

Un mismo sistema responsivo atiende el **celular del cliente** y el **kiosco de autoservicio** (`?modo=kiosco`: botones grandes, canal fijo y cierre de sesión automático tras el pedido o 90 s de inactividad).

## La anatomía de la personalización (`js/recomendador.js`)

| Nodo | Qué captura | Cómo se usa |
|---|---|---|
| 1 · Frecuencia e historial | Productos pedidos, días y franja horaria | Frecuencia general + frecuencia en la misma franja ("Sueles pedirlo en la mañana") |
| 2 · Preferencias personales | Gustos declarados (café, dulce, salado, saludable, frío, caliente) | Coincidencia con el perfil de sabor del producto |
| 3 · Restricciones médicas | Lactosa, gluten, frutos secos, huevo, azúcar, cafeína | **Filtro duro en la base de datos** (`menu_para_mi()`), incluso en las opciones de leche |
| 4 · Mood actual | ¿Cómo te sientes hoy? Feliz · Cansado · Estresado · Con hambre | Etiquetas afines + lo que pidió antes con ese mismo ánimo |

Señales de apoyo: **coocurrencia** (reglas de asociación "quien pide X suele pedir Y") y **popularidad** (resuelve el arranque en frío). Cada sugerencia explica su motivo.

**Mood voluntario** (decisión arquitectónica): es viable (sin biometría ni IA predictiva), preciso (el usuario declara su estado) y respeta la privacidad.

### La curva de madurez del algoritmo

| Hito | Pedidos | Pesos dominantes |
|---|---|---|
| 1 · Perfil básico | 0 | Preferencias, mood, popularidad |
| 2 · Aprendiendo de ti | 1–3 | Frecuencia × mood diario |
| 3 · Perfil maduro | 4–9 | Historial y coocurrencias |
| 4 · Recomendaciones óptimas | 10+ | Historial (elección casi instantánea, botón "Lo de siempre") |

## Personalización de bebidas

Tamaño (8/12/16 oz), tipo de leche (entera, deslactosada, almendras, avena) y extra shot, **preseleccionados** según el último pedido. Las opciones incompatibles desaparecen (p. ej., con intolerancia a la lactosa no se ofrece leche entera).

## Dashboard de la cafetería

- **Pedidos entrantes** con estado (pendiente → preparando → listo → entregado), canal y mood.
- **Menú e inventario**: crear y editar productos, alérgenos, stock, alertas de stock bajo, ocultar productos.
- **Indicadores**: ventas, ticket promedio, % kiosco, **tasa de aceptación de recomendaciones** (métrica para la fase de evaluación), mood de los clientes y pedidos por franja.

## Arquitectura

```
Capa de presentación   HTML + CSS + JavaScript (responsivo: celular, kiosco, escritorio) — GitHub Pages
        │  supabase-js (HTTPS)
Capa lógica            Funciones PostgreSQL: crear_pedido (precios, stock, validación), menu_para_mi
                       (filtro de intolerancias), productos_populares, coocurrencias + motor de recomendación
Capa de datos          Supabase PostgreSQL: profiles, productos, pedidos, pedido_items — RLS e integridad referencial
```

- **Seguridad**: Row Level Security. Cada cliente solo ve sus pedidos; el administrador ve todo. Los precios se calculan en el servidor y un cliente no puede autoasignarse el rol de administrador.
- **Modo demo**: sin credenciales en `js/config.js`, todo funciona con datos en el navegador. Cuentas: `cliente@demo.com / cliente123` (con historial) y `admin@demo.com / admin123`.

## Puesta en marcha con Supabase

1. Crea un proyecto en <https://supabase.com>, abre *SQL Editor* y ejecuta `supabase/schema.sql`.
2. (Recomendado para pruebas) *Authentication → Sign In / Providers → Email*: desactiva **Confirm email**.
3. Copia la *Project URL* y la *anon public key* (Project Settings → API) en `js/config.js`.
4. Regístrate en la página y conviértete en administrador:
   ```sql
   update public.profiles set rol = 'admin', perfil_completo = true
     where id = (select id from auth.users where email = 'TU_CORREO');
   ```

## Estructura

```
index.html            Página única (rutas #/menu, #/carrito, #/pedidos, #/perfil, #/admin, #/bienvenida)
css/styles.css        Tema "espresso" responsivo y modo kiosco
js/config.js          Credenciales de Supabase
js/dominio.js         Reglas de negocio: intolerancias, gustos, moods, opciones y precios
js/recomendador.js    Motor de recomendación, curva de madurez y "Lo de siempre"
js/api.js             Capa de datos (Supabase o demo)
js/app.js             Vistas e interacción
js/datos-demo.js      Catálogo y pedidos simulados
supabase/schema.sql   Tablas, funciones, políticas RLS y catálogo
```
