/* bingo-core.js — lógica pura del Bingo Musical (sin DOM ni red).
   Se usa en el navegador (window.BingoCore) y en Node (require) para tests/simulación. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BingoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GAME_NAME = 'Musikino';   // nombre del juego (cartones y pantallas)
  const DECADAS = ['50s', '60s', '70s', '80s', '90s', '00s', '10s', '20s'];   // '50s' = 1940-1959
  const DECADA_LABEL = { '50s': 'Años 40 y 50', '60s': 'Años 60', '70s': 'Años 70', '80s': 'Años 80', '90s': 'Años 90', '00s': 'Años 2000', '10s': 'Años 2010', '20s': 'Años 2020' };
  const GENEROS = ['pop', 'rock', 'dance', 'latino', 'hiphop', 'cantautor'];
  const GENERO_LABEL = { pop: 'Pop', rock: 'Rock', dance: 'Dance / Electrónica', latino: 'Latino', hiphop: 'Hip-hop / R&B', cantautor: 'Cantautor / Balada' };
  const IDIOMAS = ['es', 'en', 'otro'];
  const IDIOMA_LABEL = { es: 'En castellano', en: 'En inglés', otro: 'Otro idioma', ca: 'En catalán', inst: 'Instrumental' };   // ca e inst no tienen casilla
  const ESPECIALES = ['bso', 'onehit', 'verano'];
  const ESPECIAL_LABEL = { bso: 'Banda sonora', onehit: 'One-hit wonder', verano: 'Canción del verano' };

  // Composición fija de cada cartón (16 casillas)
  const COMPOSICION = { decada: 4, genero: 3, idioma: 1, especial: 2, combo: 6 };
  const MIN_CANCIONES_COMBO = 10;
  const MAX_COMBO_MISMO = 2;      // máx. combinadas por cartón que compartan género o década   // una combinada solo entra si hay al menos N canciones que la cumplan
  const RACHA = 4;      // turnos seguidos acertando (no marcar o fallar la rompe)
  const EXPERTO = 3;    // aciertos en casillas difíciles (combinadas o especiales)
  const POTS = ['linea', 'esquinas', 'cuadrado', 'racha', 'experto', 'final'];
  const POT_LABEL = { linea: 'Línea', esquinas: 'Esquinas', cuadrado: 'Cuadrado', racha: 'Racha', experto: 'Experto', final: 'Doble línea' };

  // ---------- RNG reproducible opcional ----------
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

  // ---------- Categorías ----------
  // Una categoría es {type, key, [key2], label, dificil}
  function catLabel(c) {
    switch (c.type) {
      case 'decada': return DECADA_LABEL[c.key];
      case 'genero': return GENERO_LABEL[c.key];
      case 'idioma': return IDIOMA_LABEL[c.key];
      case 'especial': return ESPECIAL_LABEL[c.key];
      case 'combo_dg': return GENERO_LABEL[c.key2] + ' · ' + DECADA_LABEL[c.key];
      case 'combo_gi': return GENERO_LABEL[c.key] + ' ' + IDIOMA_LABEL[c.key2].toLowerCase();
    }
    return '?';
  }
  function matches(c, s) {
    switch (c.type) {
      case 'decada': return s.decada === c.key;
      case 'genero': return s.genero === c.key;
      case 'idioma': return s.idioma === c.key;
      case 'especial': return Array.isArray(s.especial) && s.especial.includes(c.key);
      case 'combo_dg': return s.decada === c.key && s.genero === c.key2;
      case 'combo_gi': return s.genero === c.key && s.idioma === c.key2;
    }
    return false;
  }
  function makeCat(type, key, key2) {
    const c = { type, key };
    if (key2 !== undefined) c.key2 = key2;
    c.dificil = type === 'especial' || type.startsWith('combo');
    c.label = catLabel(c);
    return c;
  }

  // Catálogo FIJO: los cartones dependen solo de su número, no de canciones.json.
  // (v2, nov 2026: se añadieron años 40-50 y 60; los cartones impresos con la v1 ya no coinciden.)
  const COMBOS_DG = {
    '50s': ['pop', 'rock', 'latino'],
    '60s': ['pop', 'rock', 'cantautor'],
    '70s': ['pop', 'rock', 'dance', 'hiphop', 'cantautor'],
    '80s': ['pop', 'rock', 'dance', 'hiphop', 'cantautor'],
    '90s': ['pop', 'rock', 'dance', 'latino', 'hiphop', 'cantautor'],
    '00s': ['pop', 'rock', 'dance', 'latino', 'hiphop', 'cantautor'],
    '10s': ['pop', 'dance', 'latino', 'cantautor'],
    '20s': ['pop', 'dance', 'latino', 'hiphop'],
  };
  const COMBOS_GI = [['pop', 'es'], ['rock', 'es'], ['cantautor', 'es']];
  const CATALOGO_COMBOS = [
    ...DECADAS.flatMap(d => COMBOS_DG[d].map(g => makeCat('combo_dg', d, g))),
    ...COMBOS_GI.map(([g, i]) => makeCat('combo_gi', g, i)),
  ];
  const CATALOGO_SIMPLE = {
    decada: DECADAS.map(k => makeCat('decada', k)),
    genero: GENEROS.map(k => makeCat('genero', k)),
    idioma: IDIOMAS.map(k => makeCat('idioma', k)),
    especial: ESPECIALES.map(k => makeCat('especial', k)),
  };
  // Se mantienen por compatibilidad: ignoran las canciones y devuelven el catálogo fijo
  function eligibleCombos() { return CATALOGO_COMBOS; }
  function simplePools() { return CATALOGO_SIMPLE; }
  function allCategories() { return [...Object.values(CATALOGO_SIMPLE).flat(), ...CATALOGO_COMBOS]; }

  /** Avisos de cobertura: categorías del catálogo con pocas canciones en la lista */
  function coverage(songs, min = MIN_CANCIONES_COMBO) {
    return allCategories().map(c => ({ cat: c, n: songs.filter(s => matches(c, s)).length }))
      .filter(x => x.n < min);
  }

  /** Genera un cartón: array de 16 categorías en orden aleatorio */
  function makeCard(songs, rng = Math.random, combos = null, pools = null) {
    pools = pools || simplePools(songs);
    combos = combos || eligibleCombos(songs);
    const cats = [];
    for (const type of ['decada', 'genero', 'idioma', 'especial']) {
      cats.push(...shuffle(pools[type], rng).slice(0, COMPOSICION[type]));
    }
    // combinadas: como máximo MAX_COMBO_MISMO del mismo género y de la misma década
    const usoG = {}, usoD = {};
    for (const c of shuffle(combos, rng)) {
      if (cats.length >= 10 + COMPOSICION.combo) break;
      const g = c.type === 'combo_dg' ? c.key2 : c.key;
      const d = c.type === 'combo_dg' ? c.key : null;
      if ((usoG[g] || 0) >= MAX_COMBO_MISMO || (d && (usoD[d] || 0) >= MAX_COMBO_MISMO)) continue;
      usoG[g] = (usoG[g] || 0) + 1; if (d) usoD[d] = (usoD[d] || 0) + 1;
      cats.push(c);
    }
    if (cats.length !== 16) throw new Error('No hay categorías suficientes para un cartón de 16 (' + cats.length + ')');
    return shuffle(cats, rng);
  }

  // ---------- Patrones (4x4, índices 0..15, fila*4+col) ----------
  const LINES = [];
  for (let r = 0; r < 4; r++) LINES.push([0, 1, 2, 3].map(c => r * 4 + c));
  for (let c = 0; c < 4; c++) LINES.push([0, 1, 2, 3].map(r => r * 4 + c));
  LINES.push([0, 5, 10, 15], [3, 6, 9, 12]);
  const CORNERS = [0, 3, 12, 15];
  const SQUARES = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) SQUARES.push([r * 4 + c, r * 4 + c + 1, (r + 1) * 4 + c, (r + 1) * 4 + c + 1]);

  const allHit = (cells, idxs) => idxs.every(i => cells[i] === 'hit');
  const countLines = cells => LINES.filter(l => allHit(cells, l)).length;
  const hasCorners = cells => allHit(cells, CORNERS);
  const hasSquare = cells => SQUARES.some(q => allHit(cells, q));

  // ---------- Selección de canción ----------
  /** Elige la siguiente canción, equilibrando la ronda.
      songs: lista completa · excludeIds: ya sonadas (historial entre partidas) o fallidas
      cards: [{cats, cells}] de los jugadores activos · roundSongs: canciones ya sonadas en ESTA ronda
      hardExclude: canciones que nunca deben salir (sin fragmento) · historyOrder: ids sonados, del más antiguo al más reciente.
      1) Elige década: todas pesan igual (no según cuántas canciones haya de cada una), se penaliza
         la década que ya ha salido en la ronda y se favorece la que encaja en casillas libres.
      2) Dentro de la década elige canción: se penaliza el género ya repetido en la ronda
         y se favorece la que encaja en casillas libres. */
  function pickSong(songs, excludeIds, cards, rng = Math.random, roundSongs = [], hardExclude = new Set(), historyOrder = []) {
    // Si una década ya no tiene canciones sin sonar, se recicla (salvo las de esta ronda),
    // para que las décadas con menos canciones no desaparezcan de la partida.
    const inRound = new Set(roundSongs.map(s => s.id));
    const usable = songs.filter(s => !hardExclude.has(s.id) && !inRound.has(s.id));
    const fresh = usable.filter(s => !excludeIds.has(s.id));
    const freshD = new Set(fresh.map(s => s.decada));
    // En las décadas recicladas solo entra la mitad que sonó hace más tiempo
    const last = new Map(); historyOrder.forEach((id, i) => last.set(id, i));
    const recyc = {};
    for (const s of usable) if (excludeIds.has(s.id) && !freshD.has(s.decada)) (recyc[s.decada] = recyc[s.decada] || []).push(s);
    const old = Object.values(recyc).flatMap(arr => {
      arr.sort((a, b) => (last.has(a.id) ? last.get(a.id) : -1) - (last.has(b.id) ? last.get(b.id) : -1));
      return arr.slice(0, Math.max(1, Math.ceil(arr.length / 2)));
    });
    const cand = fresh.concat(old);
    if (!cand.length) return null;
    const nCards = Math.max(1, cards.length);
    const fit = s => {               // 1 + casillas libres de la mesa que cumple (media por cartón)
      let n = 0;
      for (const cd of cards) cd.cats.forEach((c, i) => { if (cd.cells[i] === 'free' && matches(c, s)) n++; });
      return 1 + n / nCards;
    };
    const cntD = {}, cntG = {};
    for (const s of roundSongs) { cntD[s.decada] = (cntD[s.decada] || 0) + 1; cntG[s.genero] = (cntG[s.genero] || 0) + 1; }
    const pickW = (items, w) => {
      const ws = items.map(w), tot = ws.reduce((a, b) => a + b, 0);
      let r = rng() * tot;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    };
    const byD = {};
    for (const s of cand) (byD[s.decada] = byD[s.decada] || []).push({ s, f: fit(s) });
    const decs = Object.keys(byD);
    const d = pickW(decs, k => {
      const avgFit = byD[k].reduce((a, x) => a + x.f, 0) / byD[k].length;
      return avgFit / Math.pow(1 + (cntD[k] || 0), 2);
    });
    return pickW(byD[d], x => x.f / Math.pow(1 + (cntG[x.s.genero] || 0), 1.5)).s;
  }

  // ---------- Evaluación de un turno ----------
  /**
   * players: [{id, cats, cells, streak, mark:{idx, t}|null}]
   * gameWon: {linea:bool, ...}  (qué botes ya se han ganado en esta partida)
   * Devuelve {results:{id:{res:'hit'|'miss'|'none', idx}}, speedWinner:id|null,
   *           awards:{pot:[ids]}, gameOver:bool}
   * Muta cells y streak de cada jugador.
   */
  function evaluateTurn(players, song, gameWon) {
    const results = {};
    let speed = null;
    for (const p of players) {
      const m = p.mark;
      if (!m || m.idx == null || p.cells[m.idx] !== 'free') { results[p.id] = { res: 'none' }; p.streak = 0; continue; }
      const ok = matches(p.cats[m.idx], song);
      p.cells[m.idx] = ok ? 'hit' : 'blocked';
      results[p.id] = { res: ok ? 'hit' : 'miss', idx: m.idx, dificil: !!p.cats[m.idx].dificil };
      if (ok) {
        p.streak = (p.streak || 0) + 1;
        if (p.cats[m.idx].dificil) p.hard = (p.hard || 0) + 1;
        if (!speed || m.t < speed.t) speed = { id: p.id, t: m.t };
      } else p.streak = 0;
    }
    const awards = {};
    const give = (pot, cond) => {
      if (gameWon[pot]) return;
      const ids = players.filter(cond).map(p => p.id);
      if (ids.length) awards[pot] = ids;
    };
    give('linea', p => countLines(p.cells) >= 1);
    give('esquinas', p => hasCorners(p.cells));
    give('cuadrado', p => hasSquare(p.cells));
    give('racha', p => (p.streak || 0) >= RACHA);
    give('experto', p => (p.hard || 0) >= EXPERTO);
    give('final', p => countLines(p.cells) >= 2);
    return { results, speedWinner: speed ? speed.id : null, awards, gameOver: !!awards.final };
  }

  /** Reparte un bote entre ganadores; devuelve {each, rest} */
  function splitPot(amount, n) { return { each: Math.floor(amount / n), rest: amount % n }; }


  // ---------- Etiquetas cortas para el cartón impreso (máx. 2 líneas) ----------
  const GEN_CORTO = { pop: 'Pop', rock: 'Rock', dance: 'Dance', latino: 'Latino', hiphop: 'Hip-hop / R&B', cantautor: 'Cantautor' };
  const DEC_CORTO = { '50s': 'años 40-50', '60s': 'años 60', '70s': 'años 70', '80s': 'años 80', '90s': 'años 90', '00s': 'años 2000', '10s': 'años 2010', '20s': 'años 2020' };
  function printLines(c) {
    switch (c.type) {
      case 'decada': return ['Años ' + DEC_CORTO[c.key].slice(5)];
      case 'genero': return c.key === 'hiphop' ? ['Hip-hop', 'R&B'] : [GEN_CORTO[c.key]];
      case 'idioma': return c.key === 'otro' ? ['Otro', 'idioma'] : ['En', c.key === 'es' ? 'castellano' : c.key === 'en' ? 'inglés' : 'catalán'];
      case 'especial': return { bso: ['Banda', 'sonora'], onehit: ['One-hit', 'wonder'], verano: ['Canción', 'del verano'] }[c.key];
      case 'combo_dg': return [c.key2 === 'hiphop' ? 'Hip-hop' : GEN_CORTO[c.key2], DEC_CORTO[c.key]];
      case 'combo_gi': return [c.key === 'hiphop' ? 'Hip-hop' : GEN_CORTO[c.key], 'en castellano'];
    }
    return [c.label];
  }


  // ---------- Validación de premios (versión de mesa) ----------
  /**
   * cats: categorías del cartón (16). prize: 'linea'|'esquinas'|'cuadrado'|'racha'|'experto'|'final'
   * assign: {idx: nºCanción} solo de las casillas reclamadas. history: canciones por turno (history[0] = canción 1).
   * Devuelve {ok, errors:[texto], cells:{idx:{ok,msg}}}
   */
  function validateClaim(cats, prize, assign, history) {
    const errors = [], cells = {};
    const idxs = Object.keys(assign).map(Number).sort((a, b) => a - b);
    const nums = idxs.map(i => assign[i]);
    const turn = history.length;
    const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
    // 1) patrón
    let patternOk = false, needs = '';
    switch (prize) {
      case 'linea': patternOk = idxs.length === 4 && LINES.some(l => sameSet(l, idxs)); needs = 'una fila, columna o diagonal completa (4 casillas)'; break;
      case 'esquinas': patternOk = sameSet(CORNERS, idxs); needs = 'las 4 esquinas'; break;
      case 'cuadrado': patternOk = idxs.length === 4 && SQUARES.some(q => sameSet(q, idxs)); needs = 'un bloque de 2×2'; break;
      case 'final': {
        const lines = LINES.filter(l => l.every(i => idxs.includes(i)));
        patternOk = lines.length >= 2 && idxs.every(i => lines.some(l => l.includes(i)));
        needs = 'dos líneas completas'; break;
      }
      case 'racha': {
        const s = nums.slice().sort((a, b) => a - b);
        patternOk = idxs.length === RACHA && s.every((n, k) => k === 0 || n === s[k - 1] + 1);
        needs = RACHA + ' casillas con números de canción seguidos'; break;
      }
      case 'experto': patternOk = idxs.length === EXPERTO && idxs.every(i => cats[i].dificil); needs = EXPERTO + ' casillas difíciles (con triángulo)'; break;
      default: errors.push('Premio desconocido');
    }
    if (!patternOk && needs) errors.push('El premio necesita ' + needs + '.');
    // 2) cada casilla
    const seen = {};
    for (const i of idxs) {
      const n = assign[i], c = cats[i];
      if (!Number.isInteger(n) || n < 1 || n > turn) { cells[i] = { ok: false, msg: `El ${n} no es una canción que haya sonado` }; continue; }
      if (seen[n] !== undefined) { cells[i] = { ok: false, msg: `La canción ${n} ya está usada en otra casilla` }; continue; }
      seen[n] = i;
      const song = history[n - 1];
      cells[i] = matches(c, song)
        ? { ok: true, msg: `Canción ${n}: ${song.titulo} (${song.artista}) ✓` }
        : { ok: false, msg: `Canción ${n}: ${song.titulo} no es "${c.label}"` };
    }
    for (const i of idxs) if (!cells[i].ok) errors.push(`${cats[i].label}: ${cells[i].msg}`);
    return { ok: errors.length === 0, errors, cells };
  }


  // ---------- Detección de timbre por micrófono (funciones puras, testeables) ----------
  // frame: espectro en dB (Float32Array de AnalyserNode.getFloatFrequencyData); binHz = sampleRate / fftSize
  function _median(arr) { const a = Array.from(arr).sort((x, y) => x - y); return a[a.length >> 1]; }
  function _spectrumStats(frame, binHz, lo = 1000, hi = 9000) {
    const b0 = Math.max(1, Math.round(300 / binHz)), b1 = Math.min(frame.length - 1, Math.round(10000 / binHz));
    const med = _median(frame.subarray ? frame.subarray(b0, b1) : frame.slice(b0, b1));
    let pk = -Infinity, pb = -1;
    for (let b = Math.round(lo / binHz); b <= Math.min(frame.length - 1, Math.round(hi / binHz)); b++) if (frame[b] > pk) { pk = frame[b]; pb = b; }
    return { med, pk, pb };
  }
  /** Aprende el timbre a partir de los espectros grabados mientras se toca 2-3 veces. Devuelve {bin, hz, peakDb} o null */
  function bellCalibrate(frames, binHz) {
    const loud = frames.map(f => _spectrumStats(f, binHz)).filter(x => x.pk - x.med >= 25);
    if (loud.length < 3) return null;
    const hist = {};
    for (const x of loud) for (let d = -2; d <= 2; d++) hist[x.pb + d] = (hist[x.pb + d] || 0) + (d === 0 ? 2 : 1);
    const bin = +Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0];
    const peaks = loud.filter(x => Math.abs(x.pb - bin) <= 3).map(x => x.pk).sort((a, b) => a - b);
    if (peaks.length < 3) return null;
    return { bin, hz: Math.round(bin * binHz), peakDb: peaks[Math.floor(peaks.length * 0.75)] };
  }
  /** ¿Este espectro contiene el timbre? sens 1 (estricto) .. 10 (sensible) */
  function bellDetect(frame, calib, sens, binHz) {
    const { med } = _spectrumStats(frame, binHz);
    let band = -Infinity;
    for (let b = calib.bin - 3; b <= calib.bin + 3; b++) if (b > 0 && b < frame.length && frame[b] > band) band = frame[b];
    const prom = band - med;
    return { ok: prom >= 30 - 2 * sens && band >= calib.peakDb - (6 + 2 * sens), prom, band };
  }


  // ---------- Detección por voz de lo que se canta (Musikino) ----------
  const _nv = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const VOZ = [
    ['final', /\b(doble linea|dobles lineas|dos lineas|doble lineas|bingo|musikino|musiquino|musi kino)\b/],
    ['linea', /\b(linea|lineas)\b/],
    ['esquinas', /\b(esquina|esquinas)\b/],
    ['cuadrado', /\b(cuadrado|cuadrados)\b/],
    ['racha', /\b(racha|rachas)\b/],
    ['experto', /\b(experto|experta|expertos)\b/],
    ['premio', /\b(premio|tengo premio)\b/],
  ];
  /** Devuelve el bote cantado ('linea', 'final'…), 'premio' si solo se oye "premio", o null */
  function detectClaimVoz(text) { const x = _nv(text); for (const [k, re] of VOZ) if (re.test(x)) return k; return null; }

  /** Cartón determinista a partir de su número */
  function cardFromNumber(songs, n, combos, pools) { return makeCard(songs, mulberry32(n * 7919 + 13), combos, pools); }

  return {
    GAME_NAME, DECADAS, GENEROS, IDIOMAS, ESPECIALES, POTS, POT_LABEL, COMPOSICION, RACHA, EXPERTO, LINES, CORNERS, SQUARES,
    mulberry32, shuffle, makeCat, matches, eligibleCombos, simplePools, makeCard,
    countLines, hasCorners, hasSquare, pickSong, evaluateTurn, splitPot,
    printLines, cardFromNumber, allCategories, coverage, validateClaim, CATALOGO_COMBOS, bellCalibrate, bellDetect, detectClaimVoz,
  };
});
