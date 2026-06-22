export class IntervalScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private intervalMs: number) {}

  start(callback: () => void | Promise<void>) {
    if (this.running) return;

    this.running = true;

    // Run immediately on start
    this.runCallback(callback);

    // Then schedule interval
    this.intervalId = setInterval(() => {
      this.runCallback(callback);
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  private async runCallback(callback: () => void | Promise<void>) {
    try {
      await callback();
    } catch (error) {
      console.error('Scheduler callback error:', error);
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
