// Avisos en tiempo real: sonido, notificaciones del navegador y tarjetas emergentes dentro de la página.
(function () {
  const CLAVE_SONIDO = "cafe_sonido";
  let ctx = null;

  // Los navegadores solo permiten sonido después de una interacción del usuario
  const desbloquear = () => {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { /* sin audio */ }
  };
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, desbloquear, { passive: true }));

  function sonidoActivo() {
    try { return localStorage.getItem(CLAVE_SONIDO) !== "no"; } catch (e) { return true; }
  }
  function activarSonido(si) {
    try { localStorage.setItem(CLAVE_SONIDO, si ? "si" : "no"); } catch (e) { /* ignorar */ }
  }

  // Campanita de dos tonos generada con Web Audio (no necesita archivos de sonido)
  function sonar() {
    if (!sonidoActivo() || !ctx) return;
    try {
      const ahora = ctx.currentTime;
      [[880, 0], [1318.5, 0.16]].forEach(([frecuencia, retraso]) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frecuencia;
        vol.gain.setValueAtTime(0.0001, ahora + retraso);
        vol.gain.exponentialRampToValueAtTime(0.25, ahora + retraso + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, ahora + retraso + 0.5);
        osc.connect(vol).connect(ctx.destination);
        osc.start(ahora + retraso);
        osc.stop(ahora + retraso + 0.55);
      });
    } catch (e) { /* ignorar */ }
  }

  const soportaNotificaciones = () => "Notification" in window;
  const permiso = () => soportaNotificaciones() ? Notification.permission : "no-soportado";
  async function pedirPermiso() {
    if (!soportaNotificaciones()) return "no-soportado";
    try { return await Notification.requestPermission(); } catch (e) { return "denied"; }
  }

  // Notificación del sistema operativo (funciona aunque la pestaña esté en segundo plano)
  function notificar(titulo, cuerpo, etiqueta) {
    if (permiso() !== "granted") return;
    try {
      const n = new Notification(titulo, { body: cuerpo, icon: "img/logo_sin_fondo.png", tag: etiqueta });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* algunos móviles solo permiten notificaciones con service worker */ }
  }

  // Tarjeta emergente dentro de la página
  function mostrar({ titulo, cuerpo, accion, tipo = "info", duracion = 12000 }) {
    let pila = document.getElementById("avisos");
    if (!pila) {
      pila = document.createElement("div");
      pila.id = "avisos";
      pila.className = "avisos";
      pila.setAttribute("role", "status");
      pila.setAttribute("aria-live", "polite");
      document.body.appendChild(pila);
    }
    const tarjeta = document.createElement("div");
    tarjeta.className = "aviso " + tipo;
    const t = document.createElement("strong"); t.textContent = titulo;
    const c = document.createElement("p"); c.textContent = cuerpo;
    const cerrar = document.createElement("button");
    cerrar.className = "aviso-cerrar"; cerrar.type = "button"; cerrar.setAttribute("aria-label", "Cerrar aviso"); cerrar.textContent = "✕";
    tarjeta.append(t, c, cerrar);
    if (accion) {
      const b = document.createElement("button");
      b.className = "btn btn-primario btn-sm"; b.type = "button"; b.textContent = accion.texto;
      b.addEventListener("click", () => { accion.fn(); tarjeta.remove(); });
      tarjeta.appendChild(b);
    }
    cerrar.addEventListener("click", () => tarjeta.remove());
    pila.prepend(tarjeta);
    while (pila.children.length > 4) pila.lastChild.remove();
    if (duracion) setTimeout(() => tarjeta.remove(), duracion);
  }

  window.avisos = { sonar, notificar, mostrar, permiso, pedirPermiso, sonidoActivo, activarSonido };
})();
