/** Forum 通知实时通道；HTTP 始终是通知事实来源。 */
export type NotificationSocketState = 'connecting' | 'ready' | 'disconnected';

export interface NotificationSocketOptions {
  url: string;
  getTicket: (signal: AbortSignal) => Promise<string>;
  onChange: () => void;
  onState: (state: NotificationSocketState) => void;
  createSocket?: (url: string) => WebSocket;
}

/** 单连接控制器。不将登录令牌或票据放进 URL。 */
export class NotificationSocket {
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ticketRequest: AbortController | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private generation = 0;
  private stopped = true;

  constructor(private readonly options: NotificationSocketOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.generation++;
    this.ticketRequest?.abort();
    this.ticketRequest = null;
    this.clearHandshakeTimer();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.options.onState('disconnected');
  }

  private connect(): void {
    if (this.stopped) return;
    const generation = ++this.generation;
    const abort = new AbortController();
    this.ticketRequest = abort;
    this.options.onState('connecting');
    void this.options.getTicket(abort.signal).then((ticket) => {
      if (this.stopped || generation !== this.generation) return;
      this.ticketRequest = null;
      let socket: WebSocket;
      try {
        socket = (this.options.createSocket ?? ((url) => new WebSocket(url)))(this.options.url);
      } catch {
        this.retry(generation);
        return;
      }
      this.socket = socket;
      let authTicket = ticket;
      this.handshakeTimer = setTimeout(() => socket.close(), 10_000);
      socket.onopen = () => {
        if (this.stopped || generation !== this.generation) return;
        try { socket.send(JSON.stringify({ type: 'authenticate', ticket: authTicket })); }
        catch { socket.close(); }
        finally { authTicket = ''; }
      };
      socket.onmessage = (event: MessageEvent) => {
        if (this.stopped || generation !== this.generation || typeof event.data !== 'string') return;
        let message: unknown;
        try { message = JSON.parse(event.data); } catch { return; }
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        if (message.type === 'ready') {
          this.clearHandshakeTimer();
          this.attempts = 0;
          this.options.onState('ready');
          // 订阅确认后立即校准，覆盖断线期间和首次连接竞态。
          this.options.onChange();
        } else if (message.type === 'notification.changed' || message.type === 'resync') {
          this.options.onChange();
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket === socket) {
          this.socket = null;
          this.clearHandshakeTimer();
        }
        this.retry(generation);
      };
    }).catch(() => {
      if (!abort.signal.aborted) this.retry(generation);
    });
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer !== null) clearTimeout(this.handshakeTimer);
    this.handshakeTimer = null;
  }

  private retry(generation: number): void {
    if (this.stopped || generation !== this.generation || this.timer !== null) return;
    this.ticketRequest = null;
    this.options.onState('disconnected');
    const ceiling = Math.min(120_000, 1_000 * 2 ** Math.min(this.attempts++, 7));
    const delay = Math.floor(ceiling * (0.5 + Math.random() * 0.5));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }
}
