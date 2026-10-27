# Café Inteligente

**Sistema inteligente de pedidos e hiperpersonalización de consumo en cafeterías**
Proyecto Integrador 1 · Ingeniería de Sistemas · Universidad de Santander (UDES) · Jorman E. Martínez Ramírez

Aplicación web responsiva (celular, tablet/kiosco y escritorio) con inicio de sesión, menú, carrito, recomendaciones personalizadas y panel de administración.

## Funcionalidades

| Módulo | Descripción |
|---|---|
| Login y registro | Correo y contraseña (Supabase Auth). Perfil creado automáticamente. |
| Menú | Catálogo por categorías, buscador y sección **"Recomendado para ti"**. |
| Carrito | Cantidades, canal (celular o kiosco), sugerencias "combina con tu pedido". |
| Mis pedidos | Historial y estado en tiempo casi real (actualiza cada 20 s). |
| Perfil | Nombre y restricciones alimentarias (vegano, sin lactosa, sin gluten, sin azúcar). |
| Administrador | Pedidos entrantes, cambio de estado, ventas del día, productos más vendidos. |

## Motor de recomendación (`js/recomendador.js`)

Modelo híbrido que puntúa cada producto con cuatro señales:

| Señal | Peso | Técnica |
|---|---|---|
| Historial personal | 35 % | Frecuencia de consumo del usuario |
| Coocurrencia | 30 % | Reglas de asociación ("quien pide X suele pedir Y") |
| Contexto | 20 % | Hora del día + antojo declarado voluntariamente |
| Popularidad | 15 % | Resuelve el arranque en frío (cliente nuevo) |

Las **restricciones alimentarias son un filtro duro**: nunca se recomienda un producto que no las cumpla. Para clientes sin historial, el peso se redistribuye hacia contexto y popularidad. Cada sugerencia muestra su motivo ("Combina con Tinto", "Lo pides con frecuencia"...).

## Arquitectura

```
Navegador (HTML + CSS + JavaScript)  ──►  GitHub Pages (hosting estático, HTTPS)
          │
          └── supabase-js ──►  Supabase: PostgreSQL + Auth + Row Level Security
```

- **Seguridad**: políticas RLS — cada cliente solo ve sus pedidos; el administrador ve todos. Los pedidos se crean con la función `crear_pedido`, que calcula precios en el servidor para que el total no pueda ser alterado desde el navegador. Un cliente no puede autoasignarse el rol de administrador.
- **Modo demo**: si `js/config.js` no tiene credenciales, la app funciona con datos en el navegador (cuentas `cliente@demo.com / cliente123` y `admin@demo.com / admin123`).

## Puesta en marcha

1. **Supabase**: crea un proyecto en <https://supabase.com>, abre *SQL Editor* y ejecuta `supabase/schema.sql`.
2. (Opcional, recomendado para pruebas) *Authentication → Sign In / Providers → Email*: desactiva **Confirm email**.
3. Copia *Project URL* y la *anon public key* (Project Settings → API) en `js/config.js`.
4. Regístrate en la página y conviértete en administrador ejecutando en el SQL Editor:
   ```sql
   update public.profiles set rol = 'admin'
     where id = (select id from auth.users where email = 'TU_CORREO');
   ```
5. **GitHub Pages**: Settings → Pages → *Deploy from a branch* → `main` / `(root)`.

## Estructura

```
index.html            Página única (SPA con rutas #/menu, #/carrito, ...)
css/styles.css        Estilos responsivos (mobile-first, modo oscuro)
js/config.js          Credenciales de Supabase
js/api.js             Capa de datos (Supabase o demo)
js/recomendador.js    Motor de recomendación
js/app.js             Vistas e interacción
js/datos-demo.js      Catálogo y pedidos simulados
supabase/schema.sql   Tablas, funciones, políticas RLS y catálogo
```
