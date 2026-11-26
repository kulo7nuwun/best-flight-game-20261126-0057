// A tiny deterministic random-number generator (mulberry32) plus a 1D value
// noise helper. The game seeds it per run so replays and screenshots are
// reproducible, while a fresh seed keeps each sortie's terrain different.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise: a seeded table of random heights, interpolated with
// a cosine curve so hills roll instead of stepping. `octaves` stacks detail.
export function makeNoise1D(seed, octaves = 3) {
  const rng = makeRng(seed);
  const tables = [];
  for (let o = 0; o < octaves; o++) {
    const size = 16 * 2 ** o;
    const table = new Float32Array(size + 1);
    for (let i = 0; i <= size; i++) table[i] = rng() * 2 - 1;
    tables.push({ size, table });
  }
  function sample(table, x) {
    const scaled = ((x % 1) + 1) % 1 * table.size;
    const i = Math.floor(scaled);
    const f = scaled - i;
    const a = table.table[i];
    const b = table.table[(i + 1) % table.size];
    const u = (1 - Math.cos(f * Math.PI)) / 2;
    return a + (b - a) * u;
  }
  return function noise(x) {
    let sum = 0;
    let amp = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += sample(tables[o], x * 2 ** o) * amp;
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  };
}
