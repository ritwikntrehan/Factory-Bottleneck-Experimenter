function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export class SeededRng {
  private state: number;
  constructor(seed: number, key = "root") { this.state = (seed ^ hashString(key)) >>> 0 || 0x6d2b79f5; }
  uniform(): number {
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }
  exponential(mean: number): number { return -Math.log(1 - this.uniform()) * mean; }
  normal(): number { return Math.sqrt(-2 * Math.log(Math.max(this.uniform(), Number.EPSILON))) * Math.cos(2 * Math.PI * this.uniform()); }
}

export class KeyedRng {
  private readonly streams = new Map<string, SeededRng>();
  constructor(private readonly seed: number) {}
  stream(key: string): SeededRng {
    let stream = this.streams.get(key);
    if (!stream) { stream = new SeededRng(this.seed, key); this.streams.set(key, stream); }
    return stream;
  }
}
