/* pk-theme.js — aspecto visual del Pokino: mascota Don Oro, iconos de premios, confeti, celebraciones y sonidos. */
(function (root) {
  'use strict';
  const IMG = 'img_pk/';
  const prize = p => IMG + 'pk_premio_' + p + '.png';            // centro, esquina, estampa, poker, full, pokino
  const MASCOT = ['reparte', 'escucha', 'celebra', 'fallo'];
  const mascot = m => IMG + 'pk_mascota_' + (MASCOT.includes(m) ? m : 'reparte') + '.png';

  const CSS = `
  @keyframes pkBob { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-8px) rotate(2deg) } }
  @keyframes pkPop { 0% { transform: scale(.2) rotate(-12deg); opacity: 0 } 60% { transform: scale(1.12) rotate(4deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
  @keyframes pkShake { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-8px) rotate(-3deg) } 40%,80% { transform: translateX(8px) rotate(3deg) } }
  @keyframes pkRays { from { transform: rotate(0) } to { transform: rotate(360deg) } }
  @keyframes pkFall { to { transform: translate(var(--dx), 110vh) rotate(var(--rot)); } }
  @keyframes pkFadeIn { from { opacity: 0 } to { opacity: 1 } }
  .pk-bob { animation: pkBob 2.4s ease-in-out infinite; }
  .pk-pop { animation: pkPop .55s cubic-bezier(.2,1.4,.4,1) both; }
  .pk-shake { animation: pkShake .6s ease-in-out both; }
  .pk-confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 60; }
  .pk-confetti i { position: absolute; top: -20px; width: 10px; height: 14px; border-radius: 2px; animation: pkFall var(--t) cubic-bezier(.3,.6,.5,1) forwards; }
  .pk-cele { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: radial-gradient(circle, #0f6b45ee, #04140cf2); animation: pkFadeIn .2s; cursor: pointer; text-align: center; padding: 20px; overflow: hidden; }
  .pk-cele .rays { position: absolute; width: 160vmax; height: 160vmax; opacity: .12; animation: pkRays 14s linear infinite;
    background: repeating-conic-gradient(#ffd54a 0 8deg, transparent 8deg 22deg); border-radius: 50%; }
  .pk-cele .row { position: relative; display: flex; align-items: flex-end; gap: 10px; }
  .pk-cele .icon { width: min(40vw, 220px); animation: pkPop .6s cubic-bezier(.2,1.4,.4,1) both; filter: drop-shadow(0 10px 30px #ffd54a66); }
  .pk-cele .pkmasc { width: min(28vw, 170px); animation: pkPop .6s .2s cubic-bezier(.2,1.4,.4,1) both; }
  .pk-cele .t { position: relative; font-size: clamp(34px, 8vw, 72px); font-weight: 700; color: #ffd54a; margin-top: 10px; text-shadow: 0 4px 0 #a3172b; animation: pkPop .6s .15s both; }
  .pk-cele .s { position: relative; font-size: clamp(18px, 4vw, 28px); color: #fff8e6; margin-top: 4px; animation: pkFadeIn .4s .3s both; }
  `;
  function injectStyles() {
    if (document.getElementById('pk-theme-css')) return;
    const st = document.createElement('style'); st.id = 'pk-theme-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function confetti(n = 90) {
    injectStyles();
    const box = document.createElement('div'); box.className = 'pk-confetti';
    const colors = ['#ffd54a', '#c8102e', '#1f8f5a', '#ffffff', '#f2b705', '#1f4fa3'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      c.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      c.style.setProperty('--t', (1.8 + Math.random() * 1.6) + 's');
      c.style.animationDelay = (Math.random() * 0.4) + 's';
      if (Math.random() < 0.35) { c.style.borderRadius = '50%'; c.style.width = c.style.height = '11px'; c.style.background = '#ffd54a'; }   // monedas
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  let actx = null;
  function ctx() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch {} return actx; }
  function tone(f, start, dur, type = 'triangle', vol = 0.18) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = f; o.connect(g); g.connect(a.destination);
    const t = a.currentTime + start;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3)); tone(1047, 0.48, 0.6, 'triangle', 0.2); tone(1319, 0.48, 0.6, 'sine', 0.12); }
  function coins() { [1568, 2093, 1760, 2349, 1976].forEach((f, i) => tone(f, i * 0.06, 0.12, 'square', 0.05)); }
  // aviso de "¡premio cantado!": campanilla de concurso, suave y alegre (sustituye al pitido)
  function chime() {
    const a = ctx(); if (!a) return;
    const bell = (f, t0, dur, vol) => {
      [1, 2.01, 3.02].forEach((m, i) => {   // fundamental + armónicos, como una campana
        const o = a.createOscillator(), g = a.createGain();
        o.type = 'sine'; o.frequency.value = f * m; o.connect(g); g.connect(a.destination);
        const t = a.currentTime + t0, v = vol / (i * 2 + 1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.05);
      });
    };
    bell(784, 0, 0.7, 0.22); bell(988, 0.12, 0.7, 0.22); bell(1319, 0.24, 1.1, 0.25);
  }
  function boing() { tone(220, 0, 0.18, 'square', 0.08); tone(160, 0.12, 0.25, 'square', 0.07); }

  /** Celebración a pantalla completa: {premio, title, subtitle}. Se cierra tocando o a los ms. */
  function celebrate({ premio, title = '', subtitle = '' }, { sound = true, ms = 3200 } = {}) {
    injectStyles();
    const el = document.createElement('div'); el.className = 'pk-cele';
    el.innerHTML = `<div class="rays"></div><div class="row"><img class="icon" src="${prize(premio)}" alt=""><img class="pkmasc pk-bob" src="${mascot('celebra')}" alt=""></div>
      <div class="t">${title}</div>${subtitle ? `<div class="s">${subtitle}</div>` : ''}`;
    document.body.appendChild(el);
    confetti(); if (sound) { fanfare(); setTimeout(coins, 650); }
    if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 200]);
    let done = false;
    const close = () => { if (done) return; done = true; el.remove(); };
    el.onclick = close; setTimeout(close, ms);
  }

  function preload() {
    ['centro', 'esquina', 'estampa', 'poker', 'full', 'pokino'].forEach(p => { const i = new Image(); i.src = prize(p); });
    MASCOT.forEach(m => { const i = new Image(); i.src = mascot(m); });
    ['pk_logo.png', 'pk_fondo.jpg'].forEach(n => { const i = new Image(); i.src = IMG + n; });
  }

  root.PK = { IMG, prize, mascot, confetti, celebrate, fanfare, coins, boing, chime, injectStyles, preload };
})(typeof self !== 'undefined' ? self : this);
