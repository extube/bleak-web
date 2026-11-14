/**
 * Polling primitive for live data (Concept §5: polling first, no websockets
 * in v1). Fixed-interval loop with network-failure backoff and clean
 * start/stop, built on setInterval so tests can use fake timers.
 */
export interface PollerOptions {
  intervalMs: number;
  /** Called on each tick; a thrown/rejected error triggers backoff. */
  tick: () => Promise<void>;
  onStall?: (error: unknown) => void;
  /** Interval while the last tick failed (defaults to 3× intervalMs). */
  backoffMs?: number;
}

export class Poller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private consecutiveFailures = 0;

  constructor(private readonly options: PollerOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule(this.options.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Immediately run one tick (used on visibility regain / route mount). */
  refresh(): Promise<void> {
    return this.runTick();
  }

  get isRunning(): boolean {
    return this.running;
  }

  private schedule(ms: number): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.runTick();
    }, ms);
  }

  private async runTick(): Promise<void> {
    try {
      await this.options.tick();
      this.consecutiveFailures = 0;
      if (this.running) this.schedule(this.options.intervalMs);
    } catch (error) {
      this.consecutiveFailures += 1;
      this.options.onStall?.(error);
      if (this.running && this.consecutiveFailures >= 2) {
        this.schedule(this.options.backoffMs ?? this.options.intervalMs * 3);
      }
    }
  }
}
