/* pokino-core.js — lógica pura del Pokino de mesa (baraja española de 48, cartones 5×5 numerados). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PokinoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PALOS = ['oros', 'copas', 'espadas', 'bastos'];
  const RANGOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];          // baraja de 48
  const NOMBRE_RANGO = { 1: 'as', 10: 'sota', 11: 'caballo', 12: 'rey' };
  const NUM_TXT = { 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve' };

  // id de carta: palo*12 + (rango-1)  → 0..47
  const cardId = (palo, rango) => palo * 12 + (rango - 1);
  const palo = id => Math.floor(id / 12);
  const rango = id => (id % 12) + 1;
  const DECK = [];
  for (let p = 0; p < 4; p++) for (const r of RANGOS) DECK.push(cardId(p, r));

  function rangoTxt(r) { return NOMBRE_RANGO[r] || String(r); }
  /** "7 de copas", "Rey de bastos" */
  function cardLabel(id) { const r = rango(id); const t = rangoTxt(r); return (t[0].toUpperCase() + t.slice(1)) + ' de ' + PALOS[palo(id)]; }
  /** Frase para decir en voz alta: "¡El siete de copas!", "¡La sota de oros!" */
  function cardSpeech(id) {
    const r = rango(id), art = r === 10 ? 'la' : 'el';
    return `${art} ${NOMBRE_RANGO[r] || NUM_TXT[r]} de ${PALOS[palo(id)]}`;
  }

  // ---------- RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- Cartón 5×5 ----------
  // Fila 1 (índices 0-4): las 4 cartas de un mismo número (PÓKER) + 1 carta suelta.
  // Fila 2 (índices 5-9): FULL = 3 cartas de un número + 2 de otro.
  // Resto: cartas al azar. 25 cartas distintas.
  /** Cartón determinista a partir de su número. Devuelve {n, cells:[25 ids], pokerRank} */
  function cardFromNumber(n) {
    const rng = mulberry32(n * 104729 + 7);
    const ranks = shuffle(RANGOS, rng);
    const pokerRank = ranks[0], fullA = ranks[1], fullB = ranks[2];
    const used = new Set();
    const take = id => { used.add(id); return id; };
    const poker = [0, 1, 2, 3].map(p => take(cardId(p, pokerRank)));
    const fa = shuffle([0, 1, 2, 3], rng).slice(0, 3).map(p => take(cardId(p, fullA)));
    const fb = shuffle([0, 1, 2, 3], rng).slice(0, 2).map(p => take(cardId(p, fullB)));
    const rest = shuffle(DECK.filter(id => !used.has(id)), rng);
    const row1 = shuffle([...poker, rest.pop()], rng);
    const row2 = shuffle([...fa, ...fb], rng);
    const others = rest.slice(0, 15);
    return { n, cells: [...row1, ...row2, ...others], pokerRank };
  }

  // ---------- Premios ----------
  const PREMIOS = ['centro', 'esquina', 'estampa', 'poker', 'full', 'pokino'];
  const PREMIO_LABEL = { centro: 'Centro', esquina: 'Esquina', estampa: 'Estampa', poker: 'Póker', full: 'Full', pokino: 'Pokino' };
  const PREMIO_DESC = {
    centro: 'la carta del centro',
    esquina: 'las 4 esquinas',
    estampa: 'un bloque de 2×2 en una esquina',
    poker: 'las 4 cartas iguales de la primera fila',
    full: 'la segunda fila entera',
    pokino: 'una línea de 5 (horizontal, vertical o diagonal), menos la fila del Full',
  };
  const LINES = [];
  for (let r = 0; r < 5; r++) LINES.push({ name: `fila ${r + 1}`, idx: [0, 1, 2, 3, 4].map(c => r * 5 + c) });
  for (let c = 0; c < 5; c++) LINES.push({ name: `columna ${c + 1}`, idx: [0, 1, 2, 3, 4].map(r => r * 5 + c) });
  LINES.push({ name: 'diagonal ↘', idx: [0, 6, 12, 18, 24] }, { name: 'diagonal ↙', idx: [4, 8, 12, 16, 20] });
  const POKINO_LINES = LINES.filter(l => l.name !== 'fila 2');
  const ESTAMPAS = [
    { name: 'esquina superior izquierda', idx: [0, 1, 5, 6] }, { name: 'esquina superior derecha', idx: [3, 4, 8, 9] },
    { name: 'esquina inferior izquierda', idx: [15, 16, 20, 21] }, { name: 'esquina inferior derecha', idx: [18, 19, 23, 24] },
  ];

  /** Opciones (grupos de casillas) que completan cada premio en un cartón */
  function options(card, premio) {
    switch (premio) {
      case 'centro': return [{ name: 'centro', idx: [12] }];
      case 'esquina': return [{ name: 'esquinas', idx: [0, 4, 20, 24] }];
      case 'estampa': return ESTAMPAS;
      case 'poker': return [{ name: 'póker de ' + rangoTxt(card.pokerRank), idx: [0, 1, 2, 3, 4].filter(i => rango(card.cells[i]) === card.pokerRank) }];
      case 'full': return [{ name: 'fila 2', idx: [5, 6, 7, 8, 9] }];
      case 'pokino': return POKINO_LINES;
    }
    return [];
  }

  /**
   * Comprueba un premio cantado. drawn: array de ids en el orden en que han salido.
   * Devuelve {ok, opcion:{name, idx}, faltan:[ids] (de la opción más cercana), casi}
   */
  function validate(card, premio, drawn) {
    const set = new Set(drawn);
    let best = null;
    for (const o of options(card, premio)) {
      const faltan = o.idx.filter(i => !set.has(card.cells[i])).map(i => card.cells[i]);
      if (!best || faltan.length < best.faltan.length) best = { opcion: o, faltan };
      if (!faltan.length) return { ok: true, opcion: o, faltan: [] };
    }
    return { ok: false, opcion: best ? best.opcion : null, faltan: best ? best.faltan : [] };
  }

  /** Premios que tiene completos un cartón (para avisar si alguien se ha despistado) */
  function completed(card, drawn) { return PREMIOS.filter(p => validate(card, p, drawn).ok); }

  // ---------- Detección de lo que se canta (reconocimiento de voz) ----------
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const PATRONES = [
    ['pokino', /\b(pokino|pokinos|poquino|poquinos|bokino|pokin|poki no|po kino|poke no|pokemon|poquini|pequino)\b/],
    ['poker', /\b(poker|poquer|pocker|poke)\b/],
    ['full', /\b(full|ful|fool|fullo)\b/],
    ['esquina', /\b(esquina|esquinas)\b/],
    ['estampa', /\b(estampa|estampas|estampao)\b/],
    ['centro', /\b(centro|centros)\b/],
  ];
  /** Devuelve el primer premio reconocido en el texto (o null). Pokino tiene prioridad. */
  function detectClaim(text) {
    const t = norm(text);
    for (const [p, re] of PATRONES) if (re.test(t)) return p;
    return null;
  }

  return {
    PALOS, RANGOS, DECK, PREMIOS, PREMIO_LABEL, PREMIO_DESC, LINES, POKINO_LINES, ESTAMPAS,
    cardId, palo, rango, cardLabel, cardSpeech, rangoTxt, mulberry32, shuffle,
    cardFromNumber, options, validate, completed, detectClaim,
  };
});
