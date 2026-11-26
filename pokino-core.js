/* pokino-core.js — lógica pura del Pokino de mesa (baraja española de 48, cartones 5×5 numerados). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PokinoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PALOS = ['oros', 'copas', 'espadas', 'bastos'];
  const RANGOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];          // baraja de 48
  const NOMBRE_RANGO = { 1: 'as', 10: 'sota', 11: 'caballo', 12: 'rey' };
  const NUM_TXT = { 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez', 11: 'once', 12: 'doce' };

  // id de carta: palo*12 + (rango-1)  → 0..47
  const cardId = (palo, rango) => palo * 12 + (rango - 1);
  const palo = id => Math.floor(id / 12);
  const rango = id => (id % 12) + 1;
  const DECK = [];
  for (let p = 0; p < 4; p++) for (const r of RANGOS) DECK.push(cardId(p, r));

  function rangoTxt(r) { return String(r); }               // se canta y se escribe por número: 1…12 (no as/sota/caballo/rey)
  /** "7 de copas", "12 de bastos" */
  function cardLabel(id) { return rangoTxt(rango(id)) + ' de ' + PALOS[palo(id)]; }
  /** Frase para decir en voz alta: "el siete de copas", "el doce de oros" */
  function cardSpeech(id) { return `el ${NUM_TXT[rango(id)]} de ${PALOS[palo(id)]}`; }

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
    ['pokino', /\b(pokino|pokinos|poquino|poquinos|bokino|pokin|poki no|po kino|poke no|pokemon|poquini|pequino|bingo|linea)\b/],   // bingo y línea también valen como pokino
    ['poker', /\b(poker|poquer|pocker|poke)\b/],
    ['full', /\b(full|ful|fool|fullo)\b/],
    ['esquina', /\b(esquina|esquinas)\b/],
    ['estampa', /\b(estampa|estampas|estampao)\b/],
    ['centro', /\b(centro|centros)\b/],
  ];
  // "Pokino" no es una palabra del diccionario y el reconocedor la escribe de mil maneras
  // (poquino, boquino, toquino, poki no...): se compara cómo suena, admitiendo una letra de diferencia.
  const fon = w => w.replace(/h/g, '').replace(/qu/g, 'k').replace(/c([aou])/g, 'k$1').replace(/c([ei])/g, 's$1')
    .replace(/z/g, 's').replace(/v/g, 'b').replace(/b/g, 'p').replace(/ll/g, 'y').replace(/(.)\1/g, '$1');
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function soundsPokino(t) {
    const w = t.split(' ').filter(Boolean);
    const cands = [...w, ...w.slice(1).map((x, i) => w[i] + x)];          // palabras sueltas y pares juntos ("poki no")
    const NO = ['poquito', 'poquita', 'poquitos', 'poquitas'];          // palabras normales que suenan parecido
    return cands.some(c => c.length >= 5 && c.length <= 8 && !NO.includes(c) && lev(fon(c), 'pokino') <= 1);
  }
  /** Devuelve el primer premio reconocido en el texto (o null). Pokino tiene prioridad. */
  function detectClaim(text) {
    const t = norm(text);
    for (const [p, re] of PATRONES) if (re.test(t)) return p;
    if (soundsPokino(t)) return 'pokino';
    // Lo que el reconocedor suele escribir al oír "pokino": "por qué no", "aquí no", "poqui no"...
    // Son frases normales, así que solo cuentan si es casi lo único que se ha dicho (como cuando se grita).
    const w = t.split(' ').filter(Boolean);
    if (w.length <= 4 && /\b(porque no|por que no|por qui no|aqui no|poqui no|boqui no|toqui no|po qui no|pa qui no)\b/.test(t)) return 'pokino';
    return null;
  }

  // ---------- Número de cartón dicho en voz alta ----------
  const NUM = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
    setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
    cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
  /** "123", "1 2 3", "ciento veintitrés", "uno dos tres", "cartón número 45"… → 123 / 45 (o null) */
  function parseNumber(text) {
    const t = norm(text);
    const digits = (t.match(/\d/g) || []).join('');
    if (digits) return digits.length <= 4 && +digits > 0 ? +digits : null;
    const toks = t.split(' ').filter(x => x in NUM || x === 'mil');
    if (!toks.length) return null;
    // "uno dos tres" (cifra a cifra) → 123
    if (toks.length > 1 && toks.every(x => x !== 'mil' && NUM[x] <= 9)) { const n = +toks.map(x => NUM[x]).join(''); return n > 0 && n <= 9999 ? n : null; }
    let total = 0, cur = 0;
    for (const x of toks) { if (x === 'mil') { total += (cur || 1) * 1000; cur = 0; } else cur += NUM[x]; }
    const n = total + cur;
    return n > 0 && n <= 9999 ? n : null;
  }

  return {
    PALOS, RANGOS, DECK, PREMIOS, PREMIO_LABEL, PREMIO_DESC, LINES, POKINO_LINES, ESTAMPAS,
    cardId, palo, rango, cardLabel, cardSpeech, rangoTxt, mulberry32, shuffle,
    cardFromNumber, options, validate, completed, detectClaim, parseNumber,
  };
});
