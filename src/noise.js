// Tiny deterministic 2D value-noise with fractal octaves.
// Good enough for rolling solarpunk hills — not production quality, but fast
// and dependency-free.

export function makeNoise(seed = 1337) {
  const P = new Uint8Array(512);
  let s = (seed >>> 0) || 1;
  // xorshift32
  function rand() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  }
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];

  function hash(ix, iy) {
    return P[(ix + P[iy & 255]) & 255] / 255;
  }
  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function value2D(x, y) {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const tx = smoothstep(x - x0),
      ty = smoothstep(y - y0);
    const v00 = hash(x0, y0);
    const v10 = hash(x0 + 1, y0);
    const v01 = hash(x0, y0 + 1);
    const v11 = hash(x0 + 1, y0 + 1);
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
  }

  function fbm2D(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1,
      freq = 1,
      sum = 0,
      norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * value2D(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm; // 0..1
  }

  return { value2D, fbm2D };
}
