// Configuración de conexión a Supabase.
// Si dejas estos valores vacíos, la aplicación funciona en MODO DEMO
// (datos guardados solo en el navegador, útil para presentar sin internet de base de datos).
//
// Dónde encontrarlos: Supabase → tu proyecto → Project Settings → API
//   - Project URL        → SUPABASE_URL
//   - anon public key    → SUPABASE_ANON_KEY  (es pública; la seguridad la dan las políticas RLS)
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  NOMBRE_NEGOCIO: "Café Inteligente"
};
