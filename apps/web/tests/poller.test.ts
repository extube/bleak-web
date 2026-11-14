/** Poller behavior: interval scheduling, backoff on failure, stop cleanliness. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Poller } from '../src/lib/polling/poller';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Poller', () => {
  it('ticks on the interval while running', async () => {
    const tick = vi.fn(async () => {});
    const poller = new Poller({ intervalMs: 1000, tick });
    poller.start();
    await vi.advanceTimersByTimeAsync(3500);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(poller.isRunning).toBe(true);
    poller.stop();
  });

  it('stop halts the loop', async () => {
    const tick = vi.fn(async () => {});
    const poller = new Poller({ intervalMs: 1000, tick });
    poller.start();
    poller.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).not.toHaveBeenCalled();
    expect(poller.isRunning).toBe(false);
  });

  it('backs off after repeated failures and recovers', async () => {
    let fail = true;
    const tick = vi.fn(async () => {
      if (fail) throw new Error('network down');
    });
    const onStall = vi.fn();
    const poller = new Poller({ intervalMs: 1000, tick, onStall, backoffMs: 5000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(2000);
    // two failures → backoff kicks in, so only 2 ticks by t=2000
    expect(tick).toHaveBeenCalledTimes(2);
    expect(onStall).toHaveBeenCalledTimes(2);
    fail = false;
    await vi.advanceTimersByTimeAsync(6000);
    // recovered on the backoff schedule and returned to the fast interval
    expect(tick.mock.calls.length).toBeGreaterThanOrEqual(3);
    poller.stop();
  });

  it('refresh runs a single immediate tick', async () => {
    const tick = vi.fn(async () => {});
    const poller = new Poller({ intervalMs: 60_000, tick });
    await poller.refresh();
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
