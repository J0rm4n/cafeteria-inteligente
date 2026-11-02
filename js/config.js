// Configuración de conexión a Supabase (base de datos y usuarios).
// Si SUPABASE_ANON_KEY queda vacío, la aplicación funciona en MODO DEMO
// (datos guardados solo en el navegador).
//
// Dónde encontrar la clave: Supabase → Project Settings → API Keys → "Publishable key"
// (empieza por sb_publishable_). Es pública por diseño: la seguridad la dan las
// políticas RLS de supabase/schema.sql. NUNCA pongas aquí la "secret key".
window.APP_CONFIG = {
  SUPABASE_URL: "https://xopfntunlcqoxnyafsqn.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_FthzqdfXvO9z2w3TV7WFbQ_VReC0Iv5",
  NOMBRE_NEGOCIO: "Café Inteligente"
};
