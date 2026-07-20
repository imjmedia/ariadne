import { describe, it, expect } from 'vitest';
import { AsyncSemaphore } from './async-semaphore';

describe('AsyncSemaphore', () => {
  it('limits concurrent runners', async () => {
    const sem = new AsyncSemaphore(2);
    let concurrent = 0;
    let maxSeen = 0;
    const tasks = Array.from({ length: 8 }, () =>
      sem.run(async () => {
        concurrent += 1;
        maxSeen = Math.max(maxSeen, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent -= 1;
      }),
    );
    await Promise.all(tasks);
    expect(maxSeen).toBeLessThanOrEqual(2);
  });
});
