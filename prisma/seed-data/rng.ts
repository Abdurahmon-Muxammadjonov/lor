/**
 * Deterministik pseudo-random generator (mulberry32).
 * Seed bir xil boʻlsa, ketma-ketlik ham bir xil — seed qayta ishga tushirilganda
 * xuddi shu demo maʼlumotlar hosil boʻladi.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) oraligʻida float */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] oraligʻida butun son (ikkala chegara ham kiradi) */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max < min (${min}, ${max})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** p ehtimol bilan true */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Roʻyxatdan tasodifiy element */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: boʻsh roʻyxat');
    const v = arr[this.int(0, arr.length - 1)];
    if (v === undefined) throw new Error('Rng.pick: element topilmadi');
    return v;
  }

  /** Vaznli tanlov: [[qiymat, vazn], ...] */
  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    if (total <= 0) throw new Error('Rng.weighted: vaznlar yigʻindisi 0');
    let r = this.next() * total;
    for (const [value, w] of items) {
      r -= w;
      if (r < 0) return value;
    }
    const last = items[items.length - 1];
    if (!last) throw new Error('Rng.weighted: boʻsh roʻyxat');
    return last[0];
  }

  /** Fisher–Yates aralashtirish (asl massiv oʻzgarmaydi) */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = out[i];
      const b = out[j];
      if (a === undefined || b === undefined) continue;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }

  /** Roʻyxatdan n ta takrorlanmas element */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
  }
}

/** Satrdan barqaror 32-bit seed (FNV-1a) */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
