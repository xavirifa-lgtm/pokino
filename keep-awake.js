/* keep-awake.js — que la pantalla no se apague mientras la página está abierta (como Netflix al reproducir).
   Usa la Screen Wake Lock API (Chrome/Android, Safari 16.4+). El sistema suelta el bloqueo al cambiar de
   app o apagar la pantalla, así que se vuelve a pedir al volver y tras cada toque. Necesita https. */
(function () {
  'use strict';
  let lock = null;
  async function request() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || lock) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') request(); });
  ['click', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, request, { passive: true }));
  request();
  setInterval(request, 30000);   // por si el sistema lo ha soltado sin avisar
  window.keepAwakeActive = () => !!lock;
})();
