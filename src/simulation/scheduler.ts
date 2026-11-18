export interface ScheduledEvent<T> { time: number; sequence: number; payload: T }

export class StableEventQueue<T> {
  private heap: ScheduledEvent<T>[] = [];
  private nextSequence = 0;
  schedule(time: number, payload: T): ScheduledEvent<T> {
    if (!Number.isFinite(time) || time < 0) throw new Error("Event time must be finite and nonnegative");
    const event = { time, sequence: this.nextSequence++, payload };
    this.heap.push(event); this.bubbleUp(this.heap.length - 1); return event;
  }
  pop(): ScheduledEvent<T> | undefined {
    const first = this.heap[0]; const last = this.heap.pop();
    if (this.heap.length && last) { this.heap[0] = last; this.bubbleDown(0); }
    return first;
  }
  peek(): ScheduledEvent<T> | undefined { return this.heap[0]; }
  get size(): number { return this.heap.length; }
  private before(a: ScheduledEvent<T>, b: ScheduledEvent<T>): boolean { return a.time < b.time || (a.time === b.time && a.sequence < b.sequence); }
  private bubbleUp(index: number): void { while (index > 0) { const p = Math.floor((index - 1) / 2); if (!this.before(this.heap[index]!, this.heap[p]!)) break; [this.heap[p], this.heap[index]] = [this.heap[index]!, this.heap[p]!]; index = p; } }
  private bubbleDown(index: number): void { for (;;) { const l = index * 2 + 1; const r = l + 1; let n = index; if (l < this.heap.length && this.before(this.heap[l]!, this.heap[n]!)) n = l; if (r < this.heap.length && this.before(this.heap[r]!, this.heap[n]!)) n = r; if (n === index) return; [this.heap[index], this.heap[n]] = [this.heap[n]!, this.heap[index]!]; index = n; } }
}
