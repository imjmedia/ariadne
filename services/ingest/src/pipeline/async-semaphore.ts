/**
 * Simple async semaphore for capping concurrent FalkorDB queries.
 */
export class AsyncSemaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (max < 1) throw new Error('AsyncSemaphore max must be >= 1');
  }

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.active += 1;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
