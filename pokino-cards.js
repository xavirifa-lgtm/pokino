/* pokino-cards.js — dibujo de cartas con las ilustraciones propias de img/. Requiere PokinoCore. */
(function (root) {
  'use strict';
  const P = root.PokinoCore;
  const IMG_BASE = 'img/';
  const COLOR = ['#b8860b', '#a3172b', '#1f4fa3', '#2e6b35'];   // oros, copas, espadas, bastos
  const FIG = { 10: 'sota', 11: 'caballo', 12: 'rey' };
  const RANK_TXT = r => r === 1 ? 'As' : r === 10 ? 'Sota' : r === 11 ? 'Caballo' : r === 12 ? 'Rey' : String(r);
  const RANK_CORNER = r => String(r);   // 1…12, como en la baraja (sota 10, caballo 11, rey 12)

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
    // 'compact' (cartón impreso): número pegado a las esquinas y dibujos más grandes.
    // 'full' (pantalla): igual pero con el marco de la carta y algo más de margen.
    const cmp = style === 'compact';
    const c = RANK_CORNER(r), fsz = cmp ? 22 : 17;
    if (fig) body += cmp ? img(figImg(p, r), 4, 14, 92, 124, bw) : img(figImg(p, r), 14, 24, 72, 104, bw);
    else {
      const L = PIPS[r];
      // en el cartón: separa los símbolos hacia los bordes y los hace más grandes
      const k = cmp ? ({ 1: 1.25, 7: 1.12, 8: 1.12, 9: 1.15 }[r] || 1.3) : 1;
      const S = L.s * k;
      const pts = L.p.map(([x, y]) => cmp ? [50 + (x - 50) * 1.25, 75 + (y - 77) * 1.12] : [x, y]);
      for (const [x, y] of pts) {
        let h = S;
        if (p !== 0) {   // copas, espadas y bastos son altos y estrechos: más alto sin pisar al de debajo
          const gaps = pts.filter(q => q[0] === x && q[1] !== y).map(q => Math.abs(q[1] - y));
          const gap = gaps.length ? Math.min(...gaps) : 999;
          h = Math.max(S, Math.min(S * 1.5, gap * 0.92));
          if (Math.abs(x - 50) < 1 && pts.some(q => Math.abs(q[0] - 50) >= 1)) h = Math.min(h, S * 1.2);   // el del centro, entre columnas
        }
        body += img(suitImg(p), x - S / 2, y - h / 2, S, h, bw);
      }
    }
    // el número va encima del dibujo, con un borde blanco para que se lea aunque lo pise
    const tx = (x, y, anchor) => `<text x="${x}" y="${y}" ${anchor ? 'text-anchor="end" ' : ''}font-family="Arial, sans-serif" font-weight="800" font-size="${fsz}" fill="${color}" stroke="#fff" stroke-width="${cmp ? 4 : 3}" stroke-linejoin="round" paint-order="stroke">${c}</text>`;
    // en el cartón la carta es algo más ancha (como la casilla) y el dibujo va centrado
    if (cmp) body = `<g transform="translate(6,0)">${body}</g>` + tx(3, 19, false) + tx(109, 147, true);
    else body += tx(9, 21, false) + tx(91, 141, true);
    return `<svg viewBox="0 0 ${cmp ? 112 : 100} 150" width="${w}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${P.cardLabel(id)}">
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
