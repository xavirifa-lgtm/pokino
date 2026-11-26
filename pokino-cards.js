/* pokino-cards.js — dibujo de cartas con las ilustraciones propias de img/. Requiere PokinoCore. */
(function (root) {
  'use strict';
  const P = root.PokinoCore;
  const IMG_BASE = 'img/';
  const COLOR = ['#b8860b', '#a3172b', '#1f4fa3', '#2e6b35'];   // oros, copas, espadas, bastos
  const FIG = { 10: 'sota', 11: 'caballo', 12: 'rey' };
  const RANK_TXT = r => r === 1 ? 'As' : r === 10 ? 'Sota' : r === 11 ? 'Caballo' : r === 12 ? 'Rey' : String(r);
  const RANK_CORNER = r => r === 1 ? 'A' : r === 10 ? 'S' : r === 11 ? 'C' : r === 12 ? 'R' : String(r);

  // Posiciones de los símbolos (centro x, y) y tamaño, en una carta de 100×150
  const PIPS = {
    1: { s: 62, p: [[50, 77]] },
    2: { s: 38, p: [[50, 48], [50, 106]] },
    3: { s: 32, p: [[50, 40], [50, 77], [50, 114]] },
    4: { s: 30, p: [[32, 50], [68, 50], [32, 104], [68, 104]] },
    5: { s: 26, p: [[32, 46], [68, 46], [50, 77], [32, 108], [68, 108]] },
    6: { s: 26, p: [[32, 42], [68, 42], [32, 77], [68, 77], [32, 112], [68, 112]] },
    7: { s: 24, p: [[32, 40], [68, 40], [50, 58], [32, 77], [68, 77], [32, 114], [68, 114]] },
    8: { s: 23, p: [[32, 40], [68, 40], [50, 58], [32, 77], [68, 77], [50, 96], [32, 114], [68, 114]] },
    9: { s: 22, p: [[28, 42], [50, 42], [72, 42], [28, 77], [50, 77], [72, 77], [28, 112], [50, 112], [72, 112]] },
  };

  const img = (href, x, y, w, h, bw) =>
    `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${bw ? ' style="filter:grayscale(1) contrast(1.25)"' : ''}/>`;
  const suitImg = p => IMG_BASE + P.PALOS[p] + '.png';
  const figImg = (p, r) => IMG_BASE + P.PALOS[p] + '_' + FIG[r] + '.png';

  /**
   * SVG de una carta.
   *  style 'full'    → carta completa (pantalla): símbolos repetidos o figura grande.
   *  style 'compact' → cartón impreso: igual, con el número de las esquinas algo mayor.
   *  bw → blanco y negro (impresión). frame → dibujar borde de carta.
   */
  function cardSVG(id, { style = 'full', bw = false, w = 120, frame = true } = {}) {
    const p = P.palo(id), r = P.rango(id), color = bw ? '#000' : COLOR[p];
    const fig = r >= 10;
    let body = '';
    // 'compact' (cartón impreso) y 'full' (pantalla) se dibujan igual: símbolos repetidos o figura,
    // con el número pequeño en las esquinas; en el cartón el número va algo más grande para leerlo rápido.
    const c = RANK_CORNER(r), fsz = style === 'compact' ? 21 : 17;
    body += `<text x="8" y="${fsz + 3}" font-family="Arial, sans-serif" font-weight="800" font-size="${fsz}" fill="${color}">${c}</text>`;
    body += `<text x="92" y="145" text-anchor="end" font-family="Arial, sans-serif" font-weight="800" font-size="${fsz}" fill="${color}">${c}</text>`;
    if (fig) body += img(figImg(p, r), 14, 24, 72, 104, bw);
    else {
      // copas, espadas y bastos son dibujos altos y estrechos: se les da más alto sin pisar al de debajo
      const L = PIPS[r];
      for (const [x, y] of L.p) {
        let h = L.s;
        if (p !== 0) {
          const gaps = L.p.filter(q => q[0] === x && q[1] !== y).map(q => Math.abs(q[1] - y));
          const gap = gaps.length ? Math.min(...gaps) : 999;
          h = Math.max(L.s, Math.min(L.s * 1.5, gap * 0.92));
          if (x === 50 && L.p.some(q => q[0] !== 50)) h = Math.min(h, L.s * 1.2);   // el del centro, entre columnas
        }
        body += img(suitImg(p), x - L.s / 2, y - h / 2, L.s, h, bw);
      }
    }
    return `<svg viewBox="0 0 100 150" width="${w}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${P.cardLabel(id)}">
      ${frame ? `<rect x="2" y="2" width="96" height="146" rx="9" fill="#fff" stroke="${bw ? '#000' : '#333'}" stroke-width="2"/>` : ''}${body}</svg>`;
  }

  /** Precarga las 16 imágenes para que las cartas salgan al instante */
  function preload() {
    const urls = [...P.PALOS.map((_, p) => suitImg(p)), ...P.PALOS.flatMap((_, p) => [10, 11, 12].map(r => figImg(p, r)))];
    urls.forEach(u => { const i = new Image(); i.src = u; });
    return urls;
  }

  root.PokinoCards = { cardSVG, preload, COLOR, IMG_BASE };
})(typeof self !== 'undefined' ? self : this);
