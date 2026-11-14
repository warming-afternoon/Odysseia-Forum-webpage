import { NotificationSocket, type NotificationSocketOptions, type NotificationSocketState } from './notificationSocket';

/** 同源同账号尽量共享一条连接；能力不可用时降级为当前标签页独立连接。 */
export class SharedNotificationSocket {
  private stopped = true;
  private socket: NotificationSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private release: (() => void) | null = null;
  private generation = 0;
  private leaderState: NotificationSocketState = 'disconnected';

  constructor(private readonly options: NotificationSocketOptions, private readonly token: string) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const generation = ++this.generation;
    void this.prepare(generation);
  }

  stop(): void {
    this.stopped = true;
    this.generation++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.release?.();
    this.release = null;
    this.socket?.stop();
    this.socket = null;
    this.channel?.close();
    this.channel = null;
  }

  private async prepare(generation: number): Promise<void> {
    if (typeof BroadcastChannel === 'undefined' || !navigator.locks || !globalThis.crypto?.subtle) {
      this.startOwnSocket(generation);
      return;
    }
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this.token));
      if (this.stopped || generation !== this.generation) return;
      const name = 'forum-notifications-v2-' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const channel = new BroadcastChannel(name);
      this.channel = channel;
      channel.onmessage = (event) => {
        if (this.stopped || generation !== this.generation) return;
        if (event.data?.type === 'changed') this.options.onChange();
        else if (event.data?.type === 'state-request' && this.socket) {
          channel.postMessage({ type: 'state', state: this.leaderState });
        } else if (event.data?.type === 'state' && !this.socket &&
          ['connecting', 'ready', 'disconnected'].includes(event.data.state)) {
          this.options.onState(event.data.state as NotificationSocketState);
        }
      };
      this.elect(name, generation);
      channel.postMessage({ type: 'state-request' });
    } catch {
      this.startOwnSocket(generation);
    }
  }

  private elect(name: string, generation: number): void {
    if (this.stopped || generation !== this.generation) return;
    void navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
      if (this.stopped || generation !== this.generation) return;
      if (!lock) {
        this.timer = setTimeout(() => { this.timer = null; this.elect(name, generation); }, 15_000 + Math.random() * 5_000);
        return;
      }
      this.startOwnSocket(generation, true);
      await new Promise<void>((resolve) => { this.release = resolve; });
      this.release = null;
      this.socket?.stop();
      this.socket = null;
    }).catch(() => this.startOwnSocket(generation));
  }

  private startOwnSocket(generation: number, broadcast = false): void {
    if (this.stopped || generation !== this.generation || this.socket) return;
    this.socket = new NotificationSocket({ ...this.options, onChange: () => {
      if (this.stopped || generation !== this.generation) return;
      this.options.onChange();
      if (broadcast) this.channel?.postMessage({ type: 'changed' });
    }, onState: (state) => {
      if (this.stopped || generation !== this.generation) return;
      this.leaderState = state;
      this.options.onState(state);
      if (broadcast) this.channel?.postMessage({ type: 'state', state });
    } });
    this.socket.start();
  }
}
