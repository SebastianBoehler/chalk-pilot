interface ConnectionSession {
  connect(options: { apiKey: string; model: string }): Promise<void>;
  close(): void;
}

interface RealtimeConnectionOptions<TSession extends ConnectionSession> {
  model: string;
  loadToken: (signal: AbortSignal) => Promise<string>;
  createSession: () => TSession;
  onSession: (session: TSession) => void;
  onConnecting?: () => void;
  onConnected?: () => void;
  onConnectionError?: (error: unknown) => void;
}

export class RealtimeConnection<TSession extends ConnectionSession> {
  private session: TSession | null = null;
  private connectPromise: Promise<void> | null = null;
  private connectionAbort: AbortController | null = null;
  private generation = 0;
  private closed = false;
  private readonly closedSessions = new WeakSet<TSession>();

  constructor(private readonly options: RealtimeConnectionOptions<TSession>) {}

  get currentSession(): TSession | null {
    return this.session;
  }

  connect(): Promise<void> {
    if (this.closed) return Promise.reject(connectionClosedError());
    if (this.connectPromise) return this.connectPromise;
    if (this.session) return Promise.resolve();

    const generation = ++this.generation;
    const abort = new AbortController();
    this.connectionAbort = abort;
    const attempt = this.connectAttempt(generation, abort.signal);
    const tracked = attempt.finally(() => {
      if (this.connectPromise === tracked) this.connectPromise = null;
      if (this.connectionAbort === abort) this.connectionAbort = null;
    });
    this.connectPromise = tracked;
    return tracked;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.generation += 1;
    this.connectionAbort?.abort();
    if (this.session) this.closeSession(this.session);
  }

  isCurrent(session: TSession) {
    return !this.closed && this.session === session;
  }

  private async connectAttempt(generation: number, signal: AbortSignal) {
    this.options.onConnecting?.();
    try {
      const token = await this.awaitActive(
        this.options.loadToken(signal),
        generation,
      );
      const session = this.options.createSession();
      this.assertActive(generation);
      this.session = session;
      try {
        this.options.onSession(session);
        await this.awaitActive(
          session.connect({
            apiKey: token,
            model: this.options.model,
          }),
          generation,
        );
      } catch (error) {
        this.closeSession(session);
        throw error;
      }
      this.options.onConnected?.();
    } catch (error) {
      if (this.isActive(generation)) {
        this.options.onConnectionError?.(error);
      }
      throw error;
    }
  }

  private async awaitActive<T>(
    promise: Promise<T>,
    generation: number,
  ): Promise<T> {
    let value: T;
    try {
      value = await promise;
    } catch (error) {
      this.assertActive(generation);
      throw error;
    }
    this.assertActive(generation);
    return value;
  }

  private isActive(generation: number) {
    return !this.closed && generation === this.generation;
  }

  private assertActive(generation: number) {
    if (!this.isActive(generation)) throw connectionClosedError();
  }

  private closeSession(session: TSession) {
    if (this.session === session) this.session = null;
    if (this.closedSessions.has(session)) return;
    this.closedSessions.add(session);
    session.close();
  }
}

function connectionClosedError() {
  return new Error("The voice session was closed before connecting.");
}
