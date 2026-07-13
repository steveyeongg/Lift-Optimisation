// Small, fast, seedable PRNG. Same seed → identical stream, which is essential
// for fair strategy comparison across otherwise identical runs.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Exponential inter-arrival for Poisson process with rate lambda events/sec.
export function sampleExponential(rand: () => number, lambda: number): number {
  const u = Math.max(rand(), 1e-12);
  return -Math.log(u) / Math.max(lambda, 1e-12);
}

// Weighted discrete pick.
export function pickWeighted<T>(
  rand: () => number,
  items: T[],
  weights: number[],
): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
