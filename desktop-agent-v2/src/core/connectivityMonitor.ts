export type ConnectivitySnapshot = {
  online: boolean;
  latencyMs: number | null;
  checkedAtIso: string;
};

export class ConnectivityMonitor {
  private last: ConnectivitySnapshot = {
    online: false,
    latencyMs: null,
    checkedAtIso: new Date(0).toISOString(),
  };

  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<ConnectivitySnapshot> | null = null;

  constructor(private pingFn: () => Promise<{ online: boolean; latencyMs: number | null }>) {}

  start(intervalMs: number) {
    if (this.timer) clearInterval(this.timer);

    // run immediately
    void this.refresh();

    this.timer = setInterval(() => {
      void this.refresh();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getSnapshot(): ConnectivitySnapshot {
    return this.last;
  }

  async refresh(): Promise<ConnectivitySnapshot> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const res = await this.pingFn();
        this.last = {
          online: res.online,
          latencyMs: res.latencyMs,
          checkedAtIso: new Date().toISOString(),
        };
        return this.last;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }
}
